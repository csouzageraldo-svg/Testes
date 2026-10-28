import { findDuplicate, mergePrescribed } from '../domain/dedupe';
import { parseBodyCompCsv, type BodyCompRow } from '../domain/bodycomp';
import { PHOTO_INVENTORY } from '../domain/equipment';
import { BackupFile, type SourceType, type WodBlockParsed } from '../domain/schemas';
import { localDate, nowIso, sha256Hex, uid } from '../lib/util';
import { OFFICIAL_SOURCES } from '../seed/officialSources';
import { privateSeed } from '../seed/private';
import { indexEntryBlocks, WOD_INDEX } from '../seed/wodIndex';
import { ATHLETE_ID, DATA_TABLES, db, SCHEMA_VERSION } from './db';
import type {
  AthleteProfile, BaseEntity, BodyCompositionMeasurement, EquipmentItem, OfficialEvent, OfficialWod, PerformedWorkout,
  PrescribedWorkout, UploadedAsset,
} from './types';

export function baseFields(source_type: SourceType, confidence = 1, verified = true, event_date?: string): BaseEntity {
  const t = nowIso();
  return { id: uid(), athlete_id: ATHLETE_ID, created_at: t, updated_at: t, source_type, confidence, verified_by_user: verified, event_date };
}

export async function audit(action: string, detail: string) {
  // Logs sem dados sensíveis: apenas ação e identificadores.
  await db.audit.add({ id: uid('audit'), at: nowIso(), action, detail });
}

export async function revise(entity: string, entityId: string, before: unknown, after: unknown, reason: string) {
  await db.revisions.add({ id: uid('rev'), entity, entityId, at: nowIso(), reason, before, after });
}

export function defaultProfile(): AthleteProfile {
  return {
    ...baseFields('seed', 1, false), id: ATHLETE_ID, displayName: 'Atleta',
    goals: { sessionsPerWeek: [3, 5], emphasis: ['core', 'upper', 'cardio'], text: [
      'Reduzir gordura corporal preservando massa magra.',
      'Melhorar capacidade cardiorrespiratória (corrida, burpees, wall balls, WODs longos).',
      'Desenvolver força, core e membros superiores sem deixar pernas de lado.',
      'Consistência, recuperação, técnica e zero lesões.',
      'Saúde metabólica, longevidade e autonomia.',
    ] },
    limitations: [], preferredMovements: [], avoidedMovements: [],
    consents: { healthDataInExports: false, notifications: false, officialSync: true },
    spaceNotes: [],
  };
}

// ───────────────────────── Seed ─────────────────────────

export async function ensureSeeded(): Promise<void> {
  const done = await db.kv.get('seeded_v1');
  if (done) return;
  await db.transaction('rw', [db.profile, db.equipment, db.prescribed, db.officialSources, db.bodycomp, db.performed, db.kv, db.audit], async () => {
    const p = defaultProfile();
    const ps = privateSeed.profile;
    if (ps) {
      Object.assign(p, {
        displayName: ps.displayName, birthDate: ps.birthDate, heightCm: ps.heightCm, crossfitStart: ps.crossfitStart,
        declaredFrequency: ps.declaredFrequency, limitations: ps.limitations ?? [], verified_by_user: true, source_type: 'seed',
      });
      if (ps.goals) {
        p.goals = { ...p.goals, bodyFatTarget: ps.goals.bodyFatTarget, weightTarget: ps.goals.weightTarget, sessionsPerWeek: ps.goals.sessionsPerWeek ?? p.goals.sessionsPerWeek, text: ps.goals.text ?? p.goals.text };
      }
    }
    await db.profile.put(p);

    const inv: EquipmentItem[] = PHOTO_INVENTORY.map((s) => ({
      ...baseFields('seed', 0.6, false), id: `eq_${s.key}`, key: s.key, type: s.type, label: s.label, quantity: s.quantity,
      loadKg: s.loadKg, loadNote: s.loadNote, confirmed: false, available: true, evidence: s.evidence, photoRefs: s.photoRefs, safetyNote: s.safetyNote,
    }));
    inv.push({ ...baseFields('seed', 0.5, false), id: 'eq_wall', key: 'wall', type: 'wall', label: 'Parede livre (wall walk / handstand)', confirmed: false, available: true, photoRefs: [], evidence: 'Capacidade do espaço — confirmar se há parede livre e piso adequado' });
    await db.equipment.bulkPut(inv);

    for (const e of WOD_INDEX) {
      await db.prescribed.put({
        ...baseFields('chat_summary_index', 0.35, false, e.date), id: `wod_idx_${e.date}`, event_date: e.date, title: e.title,
        blocks: indexEntryBlocks(e), rawText: '', performed_status: 'unknown', uncertainFields: ['blocks', 'title'],
        sources: [{ source_type: 'chat_summary_index', label: 'Índice de conversa anterior (prompt mestre §6) — validar com o print', added_at: nowIso() }],
      });
    }
    await db.officialSources.bulkPut(OFFICIAL_SOURCES);

    if (privateSeed.bodyCompCsv) await upsertBodyComp(parseBodyCompCsv(privateSeed.bodyCompCsv).rows, 'csv_import', 'Planilha Google (snapshot CSV até 20/10/2026)');
    for (const log of ps?.personalLog ?? []) {
      await db.performed.put({
        ...baseFields('user_report', 0.75, true, log.date), id: `pw_seed_${log.date}`, event_date: log.date, title: log.title,
        status: 'completed', items: log.items, rpe: log.rpe, pains: [], notes: log.notes, location: (log.location as PerformedWorkout['location']) ?? 'home',
      });
    }
    await db.kv.put({ key: 'seeded_v1', value: nowIso() });
    await audit('seed', `perfil=${ps ? 'private-seed' : 'padrão'}; wods_indice=${WOD_INDEX.length}`);
  });
  // Assets privados (fotos) são carregados fora da transação (fetch assíncrono), best-effort.
  void seedPrivateAssets();
}

async function seedPrivateAssets() {
  for (const ph of privateSeed.equipmentPhotos) {
    try {
      const blob = await (await fetch(ph.url)).blob();
      await addAsset(blob, ph.name, 'equipment_photo', 'private-seed/equipamentos');
    } catch { /* offline ou indisponível */ }
  }
  const jobs: string[] = [];
  for (const pr of privateSeed.wodPrints) {
    try {
      const blob = await (await fetch(pr.url)).blob();
      const { asset, duplicate } = await addAsset(blob, pr.name, 'wod_print', 'private-seed/treinos_box');
      if (!duplicate) jobs.push(asset.id);
    } catch { /* ignore */ }
  }
  for (const id of jobs) await createImportJob([id]);
}

// ───────────────────────── Assets e importação ─────────────────────────

export async function addAsset(blob: Blob, name: string, kind: UploadedAsset['kind'], source_ref?: string): Promise<{ asset: UploadedAsset; duplicate: boolean }> {
  const hash = await sha256Hex(await blob.arrayBuffer());
  const existing = await db.assets.where('hash').equals(hash).first();
  if (existing) return { asset: existing, duplicate: true };
  const asset: UploadedAsset = {
    ...baseFields('user_report', 1, false), id: uid('asset'), hash, kind, name, mime: blob.type || 'image/jpeg', size: blob.size, blob, source_ref,
  };
  await db.assets.add(asset);
  await audit('asset.add', `${kind} ${hash.slice(0, 12)}`);
  return { asset, duplicate: false };
}

export async function createImportJob(assetIds: string[], ocrText = ''): Promise<string> {
  const id = uid('job');
  await db.importJobs.add({ ...baseFields('image_ocr_unreviewed', 0.3, false), id, assetIds, status: 'queued', ocrText });
  return id;
}

export interface PrescribedDraft {
  event_date: string;
  title: string;
  boxName?: string;
  blocks: WodBlockParsed[];
  rawText: string;
  uncertainFields: string[];
  source_type: SourceType;
  assetIds: string[];
  confidence: number;
}

export async function confirmPrescribed(draft: PrescribedDraft, jobId?: string): Promise<{ workout: PrescribedWorkout; merged: boolean; reason?: string }> {
  const assets = (await db.assets.bulkGet(draft.assetIds)).filter(Boolean) as UploadedAsset[];
  const sources = assets.length
    ? assets.map((a) => ({ assetId: a.id, hash: a.hash, source_type: draft.source_type, label: a.name, added_at: nowIso() }))
    : [{ source_type: draft.source_type, label: draft.source_type === 'user_manual_entry' ? 'Entrada manual' : 'Texto importado', added_at: nowIso() }];
  const sameDay = await db.prescribed.where('event_date').equals(draft.event_date).toArray();
  const dup = findDuplicate(draft, sameDay);
  let workout: PrescribedWorkout;
  if (dup) {
    workout = dup.workout;
    for (const src of sources) {
      workout = mergePrescribed(workout, { title: draft.title, blocks: draft.blocks, rawText: draft.rawText, source: src, uncertainFields: draft.uncertainFields, confidence: draft.confidence });
    }
    await revise('prescribed', workout.id, dup.workout, workout, `merge: ${dup.reason}`);
    await db.prescribed.put(workout);
  } else {
    workout = {
      ...baseFields(draft.source_type, draft.confidence, true, draft.event_date), id: uid('wod'), event_date: draft.event_date,
      title: draft.title || 'WOD sem título', boxName: draft.boxName, blocks: draft.blocks, rawText: draft.rawText, sources,
      performed_status: 'unknown', uncertainFields: draft.uncertainFields,
    };
    await db.prescribed.add(workout);
    await revise('prescribed', workout.id, null, workout, 'criado');
  }
  if (jobId) await db.importJobs.update(jobId, { status: 'confirmed', resultWorkoutId: workout.id, mergedInto: dup ? workout.id : undefined, updated_at: nowIso() });
  await audit(dup ? 'prescribed.merge' : 'prescribed.create', `${workout.id} ${workout.event_date}`);
  return { workout, merged: !!dup, reason: dup?.reason };
}

export async function updatePrescribed(id: string, patch: Partial<PrescribedWorkout>, reason: string) {
  const before = await db.prescribed.get(id);
  if (!before) return;
  const after = { ...before, ...patch, updated_at: nowIso() };
  await db.prescribed.put(after);
  await revise('prescribed', id, before, after, reason);
}

/** Marca um treino do box como realizado. Sem resultados informados, NÃO cria PR nem usa a carga prescrita. */
export async function markBoxPerformed(prescribedId: string, data: Pick<PerformedWorkout, 'status' | 'items' | 'rpe' | 'durationMin' | 'notes' | 'pains'> & { breath?: number }) {
  const w = await db.prescribed.get(prescribedId);
  if (!w) throw new Error('WOD não encontrado');
  const pw: PerformedWorkout = {
    ...baseFields('user_report', data.items.length ? 0.85 : 0.5, true, w.event_date), id: uid('pw'), event_date: w.event_date, title: w.title,
    prescribedId, location: 'box', status: data.status, items: data.items, rpe: data.rpe, durationMin: data.durationMin, notes: data.notes,
    pains: data.pains, breath: data.breath,
  };
  await db.transaction('rw', db.performed, db.prescribed, db.revisions, async () => {
    if (w.performedId) await db.performed.delete(w.performedId);
    await db.performed.add(pw);
    await updatePrescribed(prescribedId, { performed_status: data.status === 'not_done' ? 'skipped' : 'performed', performedId: pw.id }, 'status de execução');
  });
  return pw;
}

// ───────────────────────── Composição corporal ─────────────────────────

export async function upsertBodyComp(rows: BodyCompRow[], source: SourceType, ref: string, device = 'Balança de bioimpedância doméstica') {
  for (const r of rows) {
    const existing = await db.bodycomp.where('event_date').equals(r.event_date).first();
    const m: BodyCompositionMeasurement = {
      ...(existing ?? baseFields(source, 0.7, true, r.event_date)), ...r, event_date: r.event_date, source_type: source, source_ref: ref, device, updated_at: nowIso(),
    };
    if (existing) await revise('bodycomp', existing.id, existing, m, `reimportação (${ref})`);
    await db.bodycomp.put(m);
  }
}

// ───────────────────────── Fontes oficiais ─────────────────────────

export async function upsertOfficialWod(input: { publication_date: string; title: string; text: string; source_url: string; canonical_id?: string; verification: OfficialWod['verification']; attribution?: string }) {
  const canonical_id = input.canonical_id ?? `wod:${input.publication_date}`;
  const checksum = await sha256Hex(`${input.title}\n${input.text}`.trim());
  const existing = await db.officialWods.where('canonical_id').equals(canonical_id).first();
  const t = nowIso();
  if (existing) {
    if (existing.checksum === checksum) {
      await db.officialWods.update(existing.id, { last_checked_at: t });
      return { status: 'unchanged' as const, wod: { ...existing, last_checked_at: t } };
    }
    const updated: OfficialWod = {
      ...existing, title: input.title, text: input.text, checksum, version: existing.version + 1, last_checked_at: t, updated_at: t,
      history: [...existing.history, { checksum: existing.checksum, text: existing.text, seen_at: existing.last_checked_at }], verification: input.verification,
    };
    await db.officialWods.put(updated);
    return { status: 'updated' as const, wod: updated };
  }
  const wod: OfficialWod = {
    ...baseFields(input.verification === 'manual' ? 'official_manual' : 'official_wod', input.verification === 'manual' ? 0.7 : 0.9, input.verification === 'manual', input.publication_date),
    canonical_id, publication_date: input.publication_date, title: input.title, text: input.text, source_url: input.source_url, last_checked_at: t,
    checksum, version: 1, attribution: input.attribution ?? 'CrossFit, LLC — crossfit.com', verification: input.verification, history: [],
  };
  await db.officialWods.add(wod);
  return { status: 'created' as const, wod };
}

export async function upsertOfficialEvent(input: Omit<OfficialEvent, keyof BaseEntity | 'checksum' | 'version' | 'history' | 'last_checked_at'> & { manual?: boolean }) {
  const checksum = await sha256Hex(`${input.name}|${input.start_date}|${input.end_date ?? ''}|${input.status}`);
  const existing = await db.officialEvents.where('canonical_id').equals(input.canonical_id).first();
  const t = nowIso();
  if (existing) {
    if (existing.checksum === checksum) {
      await db.officialEvents.update(existing.id, { last_checked_at: t });
      return 'unchanged' as const;
    }
    const dateChanged = existing.start_date !== input.start_date || existing.end_date !== input.end_date;
    await db.officialEvents.put({
      ...existing, ...input, checksum, version: existing.version + 1, last_checked_at: t, updated_at: t,
      status: dateChanged && input.status === 'confirmed' ? 'changed' : input.status,
      history: [...existing.history, { checksum: existing.checksum, start_date: existing.start_date, end_date: existing.end_date, seen_at: existing.last_checked_at, note: dateChanged ? 'datas alteradas pela fonte' : 'status/nome alterado' }],
    });
    return 'updated' as const;
  }
  const { manual, ...rest } = input;
  await db.officialEvents.add({
    ...baseFields(manual ? 'official_manual' : 'official_wod', manual ? 0.7 : 0.9, !!manual, input.start_date), ...rest,
    checksum, version: 1, last_checked_at: t, history: [],
  });
  return 'created' as const;
}

// ───────────────────────── Exportação / backup ─────────────────────────

const SENSITIVE_FIELDS = ['pains', 'symptoms', 'limitations', 'recoveryNote', 'notes', 'birthDate'];

export async function exportBackup(opts: { includeSensitive: boolean }): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const t of DATA_TABLES) {
    const rows = await db.table(t).toArray();
    tables[t] = opts.includeSensitive ? rows : rows.map((r) => {
      const c = { ...(r as Record<string, unknown>) };
      for (const f of SENSITIVE_FIELDS) if (f in c) c[f] = Array.isArray(c[f]) ? [] : undefined;
      return c;
    });
  }
  // Metadados dos arquivos (sem o binário) para rastreabilidade das fontes.
  tables.assets = (await db.assets.toArray()).map(({ blob: _b, ...meta }) => meta);
  await audit('export.json', `sensíveis=${opts.includeSensitive}`);
  return { app: 'cg-performance', schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), tables };
}

export async function importBackup(raw: unknown): Promise<Record<string, number>> {
  const parsed = BackupFile.parse(raw);
  const counts: Record<string, number> = {};
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      const rows = parsed.tables[t];
      if (!rows?.length) continue;
      await db.table(t).bulkPut(rows);
      counts[t] = rows.length;
    }
  });
  await db.kv.put({ key: 'seeded_v1', value: nowIso() });
  await audit('import.json', JSON.stringify(counts));
  return counts;
}

export function toCSV(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n');
}

export async function wipeAll() {
  await db.delete();
  await db.open();
}

export async function today(): Promise<string> {
  return localDate();
}
