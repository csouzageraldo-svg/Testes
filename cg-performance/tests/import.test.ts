import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/seed/private', () => ({ privateSeed: { profile: undefined, bodyCompCsv: undefined, equipmentPhotos: [], wodPrints: [] } }));

import { db } from '../src/db/db';
import { addAsset, confirmPrescribed, ensureSeeded, exportBackup, importBackup, markBoxPerformed, upsertBodyComp, wipeAll } from '../src/db/repo';
import { parseBodyCompCsv } from '../src/domain/bodycomp';
import { titleSimilarity } from '../src/domain/dedupe';
import { computeSuggestion } from '../src/domain/suggestion';
import { summarizeWindow } from '../src/domain/stimulus';
import { movementIdsOf, parseWodText } from '../src/domain/wodParser';

// Texto sintético no formato típico de apps de box (NÃO é um print real do atleta).
const PRINT_A = `CrossFit Box\nSegunda, 28/09\nTOMMY PICKLES\nWarm-up\n2 rounds\n10 air squats\n200m run\nStrength\nFront Squat 5x3 @ 75%\nWOD\nAMRAP 12\n9 Power Snatch (43/30 kg)\n12 Cal Bike\n400m Run\nCool down\nalongamento`;
const PRINT_B = `28/09/2026\nTommy Pickle5\nWOD\nAMRAP 12\n9 power snatch 43/30kg\n12 cal echo bike\n400 m run`;

beforeEach(async () => {
  await wipeAll();
  await ensureSeeded();
});

describe('parser de WOD', () => {
  it('extrai data, título, blocos, formato e movimentos', () => {
    const p = parseWodText(PRINT_A, '2026-10-28');
    expect(p.dateCandidates[0].iso).toBe('2026-09-28');
    expect(p.title.toLowerCase()).toContain('tommy');
    const kinds = p.blocks.map((b) => b.kind);
    expect(kinds).toEqual(expect.arrayContaining(['warmup', 'strength', 'metcon', 'cooldown']));
    const wod = p.blocks.find((b) => b.kind === 'metcon')!;
    expect(wod.format).toMatch(/amrap 12/);
    expect(movementIdsOf([wod])).toEqual(expect.arrayContaining(['power_snatch', 'bike', 'run']));
    expect(wod.movements.find((m) => m.exerciseId === 'power_snatch')?.loadText).toMatch(/43\/30/);
    expect(wod.movements.find((m) => m.exerciseId === 'run')?.distanceM).toBe(400);
  });
  it('marca campos incertos para revisão', () => {
    const p = parseWodText('treino\nalgo estranho 12 xpto', '2026-10-28');
    expect(p.uncertainFields).toEqual(expect.arrayContaining(['date']));
  });
  it('títulos com erro de OCR continuam semelhantes', () => {
    expect(titleSimilarity('TOMMY PICKLES', 'Tommy Pickle5')).toBeGreaterThan(0.75);
  });
});

describe('critério 4 — dois prints do mesmo WOD', () => {
  it('cria um único treino prescrito com duas fontes vinculadas', async () => {
    const a1 = await addAsset(new Blob(['img-1'], { type: 'image/jpeg' }), '431101.jpg', 'wod_print');
    const a2 = await addAsset(new Blob(['img-2'], { type: 'image/jpeg' }), '431103.jpg', 'wod_print');
    for (const [txt, asset] of [[PRINT_A, a1.asset], [PRINT_B, a2.asset]] as const) {
      const p = parseWodText(txt, '2026-10-28');
      await confirmPrescribed({ event_date: p.dateCandidates[0].iso, title: p.title, blocks: p.blocks, rawText: txt, uncertainFields: [], source_type: 'image_ocr_reviewed', assetIds: [asset.id], confidence: 0.9 });
    }
    const day = await db.prescribed.where('event_date').equals('2026-09-28').toArray();
    expect(day).toHaveLength(1);
    // Fontes: índice-semente + 2 prints.
    expect(day[0].sources.filter((s) => s.assetId)).toHaveLength(2);
    expect(day[0].source_type).toBe('image_ocr_reviewed');
    expect(day[0].performed_status).toBe('unknown');
  });
  it('o mesmo arquivo enviado duas vezes é detectado pelo hash', async () => {
    const b = new Blob(['same'], { type: 'image/jpeg' });
    expect((await addAsset(b, 'x.jpg', 'wod_print')).duplicate).toBe(false);
    expect((await addAsset(b, 'x-copia.jpg', 'wod_print')).duplicate).toBe(true);
  });
});

describe('critério 6 — print sem resultado', () => {
  it('não conta como treino realizado nem gera PR', async () => {
    const all = await db.prescribed.toArray();
    expect(all.length).toBeGreaterThanOrEqual(11);
    expect(all.every((w) => w.performed_status === 'unknown')).toBe(true);
    expect(await db.performed.count()).toBe(0);
    const prescribedById = new Map(all.map((w) => [w.id, w]));
    const s = summarizeWindow(await db.performed.toArray(), prescribedById, '2026-10-21', 30);
    expect(s.sessions).toBe(0);
  });
  it('marcar como realizado sem detalhes conta a sessão com confiança baixa e sem cargas', async () => {
    const pw = await markBoxPerformed('wod_idx_2026-10-20', { status: 'completed', items: [], pains: [] });
    expect(pw.items).toHaveLength(0);
    expect((await db.prescribed.get('wod_idx_2026-10-20'))!.performed_status).toBe('performed');
    const all = await db.prescribed.toArray();
    const s = summarizeWindow([pw], new Map(all.map((w) => [w.id, w])), '2026-10-21', 7);
    expect(s.sessions).toBe(1);
    expect(s.confidence).toBeLessThan(0.5);
  });
});

describe('critério 5 — novos WODs semanas depois', () => {
  it('recalcula sugestão sem perder dados antigos', async () => {
    await markBoxPerformed('wod_idx_2026-09-30', { status: 'completed', items: [], rpe: 8, pains: [] });
    const before = await db.prescribed.count();
    const txt = `10/11/2026\nUpper Grind\nWOD\nEMOM 16\n12 push-ups\n10 dumbbell press\n12 db row\n10 pike push-up`;
    const p = parseWodText(txt, '2026-11-12');
    const { workout } = await confirmPrescribed({ event_date: p.dateCandidates[0].iso, title: p.title, blocks: p.blocks, rawText: txt, uncertainFields: [], source_type: 'image_ocr_reviewed', assetIds: [], confidence: 0.9 });
    expect(await db.prescribed.count()).toBe(before + 1);
    const prescribedById = new Map((await db.prescribed.toArray()).map((w) => [w.id, w]));
    const s1 = computeSuggestion({ today: '2026-11-11', performed: await db.performed.toArray(), prescribedById });
    await markBoxPerformed(workout.id, { status: 'completed', items: [], rpe: 8, pains: [] });
    const s2 = computeSuggestion({ today: '2026-11-11', performed: await db.performed.toArray(), prescribedById: new Map((await db.prescribed.toArray()).map((w) => [w.id, w])) });
    expect(s2.windows.d30.sessions).toBe(s1.windows.d30.sessions + 1);
    expect(s2.recent.delts).toBeGreaterThan(s1.recent.delts);
    expect(await db.prescribed.get('wod_idx_2026-09-30')).toBeTruthy();
  });
});

describe('composição corporal e backup (critério 14)', () => {
  it('importa CSV e exporta/reimporta JSON', async () => {
    const csv = 'data,peso_kg,musculo_percent,gordura_percent,gordura_visceral_nivel\n2026-10-20,88.0,37.0,23.6,14\n2026-10-14,88.7,36.8,23.9,14';
    const { rows, errors } = parseBodyCompCsv(csv);
    expect(errors).toEqual([]);
    await upsertBodyComp(rows, 'csv_import', 'teste');
    await upsertBodyComp(rows, 'csv_import', 'teste'); // idempotente por data
    expect(await db.bodycomp.count()).toBe(2);
    const backup = await exportBackup({ includeSensitive: false });
    expect(backup.tables.bodycomp).toHaveLength(2);
    await wipeAll();
    await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(await db.bodycomp.count()).toBe(2);
    expect(await db.prescribed.count()).toBeGreaterThanOrEqual(11);
  });
});
