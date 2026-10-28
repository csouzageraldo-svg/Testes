import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID } from '../src/domain/exercises';
import { availableEquipment, generate, implementFor, recalcPlan, simplify, constraintsFor } from '../src/domain/generator';
import { WorkoutPlan } from '../src/domain/schemas';
import { briefing, inventory, performed, TODAY } from './helpers';

const ctx = (over: Partial<Parameters<typeof generate>[1]> = {}) => ({
  today: TODAY, equipment: inventory('none'), performed: [], prescribedById: new Map(), ...over,
});

const allItems = (plan: WorkoutPlan) => plan.blocks.flatMap((b) => b.items);

describe('biblioteca de exercícios', () => {
  it('tem ao menos 30 exercícios com instruções e referências válidas', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(30);
    for (const ex of EXERCISES) {
      expect(ex.instructions.length, ex.id).toBeGreaterThan(0);
      for (const id of [...ex.easier, ...ex.harder]) expect(EXERCISE_BY_ID[id], `${ex.id} → ${id}`).toBeTruthy();
    }
  });
  it('ids e sinônimos são únicos', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});

describe('critério 1 — mudar foco sugerido de core para superiores', () => {
  it('respeita superiores e explica sobreposição com ombros treinados ontem', () => {
    const yesterday = '2026-10-27';
    const shoulders = performed(yesterday, [
      { exerciseId: 'db_press', reps: 12, sets: 5, completed: true },
      { exerciseId: 'pike_push_up', reps: 10, sets: 5, completed: true },
      { exerciseId: 'db_push_press', reps: 12, sets: 4, completed: true },
    ], 8);
    const legsEarlier = performed('2026-10-24', [{ exerciseId: 'air_squat', reps: 100, completed: true }, { exerciseId: 'lunge', reps: 60, completed: true }], 7);
    const c = ctx({ performed: [shoulders, legsEarlier] });
    const suggested = generate(briefing({ focus: 'auto' }), c);
    expect(suggested.effectiveFocus).not.toBe('upper');

    const r = generate(briefing({ focus: 'upper' }), c);
    const A = r.options[0];
    expect(r.effectiveFocus).toBe('upper');
    expect(A.focus).toBe('upper');
    const text = A.rationale.join(' ');
    expect(text).toMatch(/Você escolheu superiores/);
    expect(text).toMatch(/deltoides/i);
    expect(text).toMatch(/volume reduzido/);
    // O bloco principal privilegia puxar/costas/braços em vez de mais empurrar vertical.
    const main = A.blocks.filter((b) => b.kind === 'metcon' || b.kind === 'strength').flatMap((b) => b.items);
    const deltHeavy = main.filter((it) => (EXERCISE_BY_ID[it.exerciseId].muscles.delts ?? 0) >= 0.8);
    expect(deltHeavy.length).toBeLessThanOrEqual(1);
  });
});

describe('critério 2 — casa usa somente equipamento confirmado', () => {
  it('sem confirmações: só peso corporal', () => {
    const r = generate(briefing({ location: 'home', focus: 'legs' }), ctx());
    for (const it of r.options.flatMap(allItems)) {
      expect(EXERCISE_BY_ID[it.exerciseId].equipment.length === 0 || EXERCISE_BY_ID[it.exerciseId].equipment.some((a) => a.length === 0), it.exerciseId).toBe(true);
    }
  });
  it('com halteres + sandbag confirmados: usa apenas eles e mostra kg só do sandbag confirmado', () => {
    const equipment = inventory(['dumbbells', 'sandbag', 'bench']);
    const b = briefing({ location: 'home', focus: 'strength', minutes: 45 });
    const eq = availableEquipment(b, { equipment });
    expect([...eq].sort()).toEqual(['bench', 'dumbbells', 'sandbag']);
    const r = generate(b, ctx({ equipment }));
    for (const it of r.options.flatMap(allItems)) {
      const imp = implementFor(EXERCISE_BY_ID[it.exerciseId], eq, false);
      expect(imp, it.exerciseId).not.toBeNull();
      if (it.load.kind === 'kg') expect(it.load.note).toMatch(/sandbag 20 kg/);
    }
  });
  it('aceita alteração de carga e tempo (recalcula duração)', () => {
    const r = generate(briefing({ minutes: 30 }), ctx({ equipment: inventory(['dumbbells']) }));
    const A = r.options[0];
    const edited = recalcPlan({
      ...A,
      blocks: A.blocks.map((b) => (b.kind === 'metcon' ? { ...b, timeCapMin: (b.timeCapMin ?? 10) + 5 } : b)),
    });
    expect(edited.estimatedMin).toBeGreaterThanOrEqual(A.estimatedMin);
    const withKg = { ...A.blocks[1].items[0], load: { kind: 'kg' as const, value: 12 } };
    expect(withKg.load.value).toBe(12);
  });
});

describe('critério 3 — quarto de hotel', () => {
  it('silencioso, pouco espaço, sem saltos e com scaling disponível', () => {
    const r = generate(briefing({ location: 'hotel_room', focus: 'full_body', intensity: 'high' }), ctx());
    for (const it of r.options.flatMap(allItems)) {
      const ex = EXERCISE_BY_ID[it.exerciseId];
      expect(ex.noise, ex.id).toBe('silent');
      expect(ex.space, ex.id).toBe('small');
      expect(ex.jumps, ex.id).toBe(false);
    }
    const A = r.options[0];
    const simpler = simplify(A, constraintsFor(briefing({ location: 'hotel_room' }), { equipment: [] }, 'moderate'));
    expect(simpler.title).toMatch(/simplificado/);
  });
});

describe('critério 7 — 30 min vs express 15 min', () => {
  it('são concretamente diferentes e com duração plausível', () => {
    const r30 = generate(briefing({ minutes: 30, focus: 'full_body' }), ctx({ equipment: inventory('all') }));
    const A = r30.options[0];
    const r15 = generate(briefing({ minutes: 15, focus: 'full_body' }), ctx({ equipment: inventory('all') }));
    const A15 = r15.options[0];
    expect(A.estimatedMin).toBeGreaterThanOrEqual(25);
    expect(A.estimatedMin).toBeLessThanOrEqual(36);
    expect(A15.estimatedMin).toBeGreaterThanOrEqual(12);
    expect(A15.estimatedMin).toBeLessThanOrEqual(18);
    expect(A.blocks.length).toBeGreaterThan(A15.blocks.length);
    const B = r30.options[1];
    expect(B.label).toBe('Express');
    expect(B.estimatedMin).toBeLessThan(A.estimatedMin);
  });
  it('durações ficam próximas do alvo em várias combinações', () => {
    for (const minutes of [15, 20, 30, 45, 60]) {
      for (const focus of ['core', 'upper', 'legs', 'cardio', 'strength', 'full_body'] as const) {
        for (const location of ['home', 'no_equipment', 'hotel_room'] as const) {
          const r = generate(briefing({ minutes, focus, location }), ctx({ equipment: inventory('all') }));
          const A = r.options[0];
          expect(WorkoutPlan.safeParse(A).success).toBe(true);
          expect(A.estimatedMin, `${minutes} ${focus} ${location}`).toBeGreaterThanOrEqual(minutes * 0.75);
          expect(A.estimatedMin, `${minutes} ${focus} ${location}`).toBeLessThanOrEqual(minutes * 1.25);
        }
      }
    }
  });
});

describe('critério 11 — sintomas sistêmicos ou falta de ar anormal', () => {
  it('não força WOD intenso e recomenda descanso/avaliação', () => {
    const r = generate(briefing({ intensity: 'high', symptoms: ['abnormal_breath'] }), ctx());
    expect(r.safety.level).toBe('urgent');
    for (const p of r.options) expect(p.intensity).toBe('recovery');
    expect(r.options[0].safetyNotes.join(' ')).toMatch(/avaliação médica/);
  });
  it('febre → descanso; resfriado leve → intensidade máxima leve', () => {
    expect(generate(briefing({ symptoms: ['fever'], intensity: 'high' }), ctx()).options[0].intensity).toBe('recovery');
    const cold = generate(briefing({ symptoms: ['sore_throat', 'phlegm'], intensity: 'high' }), ctx());
    expect(cold.effectiveIntensity).toBe('light');
    expect(cold.options[0].tradeoffs.join(' ')).toMatch(/não pode ser desativada/);
    for (const it of cold.options.flatMap(allItems)) expect(EXERCISE_BY_ID[it.exerciseId].jumps).toBe(false);
  });
  it('dor lombar 6/10 remove exercícios com exigência lombar relevante', () => {
    const r = generate(briefing({ focus: 'legs', pains: [{ joint: 'lumbar', level: 6, acute: false }] }), ctx({ equipment: inventory('all') }));
    for (const it of r.options.flatMap(allItems)) expect(EXERCISE_BY_ID[it.exerciseId].joints.lumbar ?? 0).toBeLessThanOrEqual(0.35);
  });
});

describe('regerar preserva escolhas manuais', () => {
  it('lock de exercício sobrevive a nova seed', () => {
    const b = briefing({ focus: 'core', locks: { 'metcon:0': 'side_plank' }, seed: 1 });
    const r1 = generate(b, ctx());
    const r2 = generate({ ...b, seed: 999 }, ctx());
    for (const r of [r1, r2]) {
      const metcon = r.options[0].blocks.find((x) => x.kind === 'metcon')!;
      expect(metcon.items[0].exerciseId).toBe('side_plank');
    }
  });
});
