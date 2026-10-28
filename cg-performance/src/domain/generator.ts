import type { EquipmentItem, PerformedWorkout, PrescribedWorkout, RecoveryCheckin } from '../db/types';
import { clamp, rng, round5, uid } from '../lib/util';
import type { EquipmentType } from './equipment';
import { EXERCISES, EXERCISE_BY_ID, type Exercise } from './exercises';
import { assessSafety, exerciseAllowedBySafety, type SafetyAssessment } from './safety';
import { WorkoutPlan as WorkoutPlanSchema, type Briefing, type BlockFormat, type PlanBlock, type PlanItem, type WorkoutPlan } from './schemas';
import { computeSuggestion, type Suggestion } from './suggestion';
import {
  FOCUS_LABEL, INTENSITY_LABEL, INTENSITY_ORDER, INTENSITY_RPE, MUSCLE_GROUPS, MUSCLE_LABEL, MUSCLES, minIntensity,
  type Focus, type Intensity, type Location, type Muscle, type Pattern,
} from './taxonomy';

/**
 * Motor de programação baseado em regras verificáveis (spec §5).
 * Determinístico para uma mesma seed; regerar = nova seed preservando `briefing.locks`.
 */

export interface GeneratorContext {
  today: string;
  equipment: EquipmentItem[];
  performed: PerformedWorkout[];
  prescribedById: Map<string, PrescribedWorkout>;
  checkin?: RecoveryCheckin;
}

export interface Inspiration {
  officialId: string;
  title: string;
  exerciseIds: string[];
}

export interface GenerateResult {
  options: WorkoutPlan[];
  suggestion: Suggestion;
  safety: SafetyAssessment;
  effectiveFocus: Exclude<Focus, 'auto'>;
  effectiveIntensity: Intensity;
  equipmentUsed: EquipmentType[];
}

// ───────────────────────── Equipamento e ambiente ─────────────────────────

export function availableEquipment(b: Briefing, ctx: Pick<GeneratorContext, 'equipment'>): Set<EquipmentType> {
  const s = new Set<EquipmentType>();
  if (b.location === 'home') {
    for (const e of ctx.equipment) if (e.confirmed && e.available) s.add(e.type);
  } else if (b.location === 'hotel_gym') {
    for (const t of b.dayEquipment) s.add(t as EquipmentType);
    s.add('wall');
  } else if (b.location === 'no_equipment') {
    s.add('wall');
  }
  if (b.canRunOutside && b.location !== 'hotel_room') s.add('outdoor');
  return s;
}

export function implementFor(ex: Exercise, eq: Set<EquipmentType>, preferLoaded: boolean): EquipmentType[] | null {
  if (ex.equipment.length === 0) return [];
  const ok = ex.equipment.filter((alt) => alt.every((t) => eq.has(t)));
  if (!ok.length) return null;
  return preferLoaded ? [...ok].sort((a, b) => b.length - a.length)[0] : ok[0];
}

interface Constraints {
  eq: Set<EquipmentType>;
  location: Location;
  intensity: Intensity;
  safety: SafetyAssessment;
  avoided: Set<string>;
}

export function exerciseFits(ex: Exercise, c: Constraints): boolean {
  if (c.avoided.has(ex.id)) return false;
  if (implementFor(ex, c.eq, false) === null) return false;
  if (!exerciseAllowedBySafety(ex, c.safety)) return false;
  if (c.location === 'hotel_room' && (ex.noise !== 'silent' || ex.space !== 'small' || ex.jumps || ex.impact !== 'low')) return false;
  const unsupervised = c.location !== 'hotel_gym';
  if (unsupervised && ex.unsupervisedMax && INTENSITY_ORDER.indexOf(c.intensity) > INTENSITY_ORDER.indexOf(ex.unsupervisedMax)) return false;
  return true;
}

// ───────────────────────── Foco ─────────────────────────

type FocusKey = Exclude<Focus, 'auto'>;

function focusMuscleWeights(focus: FocusKey): Partial<Record<Muscle, number>> {
  const w: Partial<Record<Muscle, number>> = {};
  const add = (ms: readonly Muscle[], v: number) => ms.forEach((m) => (w[m] = (w[m] ?? 0) + v));
  switch (focus) {
    case 'core': add(MUSCLE_GROUPS.core, 1); break;
    case 'upper': add(MUSCLE_GROUPS.upper, 1); add(['core_ant'], 0.2); break;
    case 'legs': add(MUSCLE_GROUPS.legs, 1); add(['core_ant'], 0.1); break;
    case 'strength': add(MUSCLE_GROUPS.upper, 0.6); add(MUSCLE_GROUPS.legs, 0.8); add(['lower_back', 'core_ant'], 0.4); break;
    case 'full_body': case 'cardio': case 'technique':
      add(MUSCLE_GROUPS.upper, 0.5); add(MUSCLE_GROUPS.legs, 0.5); add(MUSCLE_GROUPS.core, 0.5); break;
    case 'mobility': case 'recovery': add(MUSCLES, 0.2); break;
  }
  return w;
}

function focusRelevance(ex: Exercise, focus: FocusKey): number {
  const fw = focusMuscleWeights(focus);
  let s = 0;
  for (const [m, v] of Object.entries(ex.muscles)) s += (fw[m as Muscle] ?? 0) * (v ?? 0);
  if (focus === 'cardio') s = ex.modality === 'M' ? 3 + s * 0.2 : ex.capacities.includes('cardio_endurance') ? 1.5 + s * 0.3 : s * 0.4;
  if (focus === 'strength') s *= ex.capacities.includes('strength') && ex.loadable ? 1.4 : 0.4;
  if (focus === 'mobility' || focus === 'recovery') s = ex.patterns.includes('mobility') ? 2 : ex.complexity === 1 && ex.impact === 'low' ? 0.5 : -2;
  if (focus === 'technique') s += ex.complexity >= 3 ? 1 : 0;
  return s;
}

// ───────────────────────── Seleção ─────────────────────────

interface Picker {
  c: Constraints;
  rand: () => number;
  recent: Record<Muscle, number>;
  stressed: Set<Muscle>;
  preferred: Set<string>;
  used: Set<string>;
}

function overlapPenalty(ex: Exercise, p: Picker): number {
  let pen = 0;
  for (const [m, v] of Object.entries(ex.muscles)) {
    if (p.stressed.has(m as Muscle)) pen += (v ?? 0) * 0.9;
  }
  return pen;
}

function pick(
  p: Picker,
  filter: (ex: Exercise) => boolean,
  score: (ex: Exercise) => number,
  opts: { usedPatterns?: Set<Pattern>; lockId?: string } = {},
): Exercise | null {
  if (opts.lockId) {
    const locked = EXERCISE_BY_ID[opts.lockId];
    if (locked && exerciseFits(locked, p.c)) {
      p.used.add(locked.id);
      return locked;
    }
  }
  const cands = EXERCISES.filter((ex) => !p.used.has(ex.id) && exerciseFits(ex, p.c) && filter(ex))
    .filter((ex) => !opts.usedPatterns || !opts.usedPatterns.has(ex.patterns[0]) || ex.modality === 'M')
    .map((ex) => ({ ex, s: score(ex) - overlapPenalty(ex, p) + (p.preferred.has(ex.id) ? 1.2 : 0) + p.rand() * 0.45 }))
    .sort((a, b) => b.s - a.s);
  const chosen = cands[0]?.ex ?? null;
  if (chosen) {
    p.used.add(chosen.id);
    opts.usedPatterns?.add(chosen.patterns[0]);
  }
  return chosen;
}

// ───────────────────────── Prescrição de itens ─────────────────────────

const DENSITY: Record<Intensity, number> = { recovery: 0.5, light: 0.6, moderate: 0.72, high: 0.82 };

function niceReps(n: number): number {
  if (n <= 3) return Math.max(1, Math.round(n));
  if (n <= 12) return Math.round(n);
  if (n <= 30) return Math.round(n / 2) * 2;
  return Math.round(n / 5) * 5;
}

function loadFor(ex: Exercise, intensity: Intensity, eq: Set<EquipmentType>, inv: EquipmentItem[], implement: EquipmentType[] | null): PlanItem['load'] {
  if (!ex.loadable || !implement || implement.length === 0) return { kind: 'bodyweight' };
  const [lo, hi] = INTENSITY_RPE[intensity];
  // Só mostramos kg quando o implemento tem carga CONFIRMADA no inventário (ex.: sandbag 20 kg confirmado).
  if (implement.length === 1 && implement[0] === 'sandbag' && eq.has('sandbag')) {
    const sb = inv.find((e) => e.type === 'sandbag' && e.confirmed && e.loadKg);
    if (sb?.loadKg) return { kind: 'kg', value: sb.loadKg, note: `sandbag ${sb.loadKg} kg (inventário confirmado)` };
  }
  return { kind: 'rpe', value: Math.round((lo + hi) / 2), note: `carga que permita RPE ${lo}–${hi}` };
}

/** Prescreve um item para ocupar ~`targetWorkSec` de trabalho. */
function prescribe(ex: Exercise, targetWorkSec: number, b: { intensity: Intensity; eq: Set<EquipmentType>; inv: EquipmentItem[]; volumeFactor: number; preferLoaded: boolean }): PlanItem {
  const implement = implementFor(ex, b.eq, b.preferLoaded);
  const load = loadFor(ex, b.intensity, b.eq, b.inv, implement);
  const work = Math.max(10, targetWorkSec * b.volumeFactor);
  const mobility = ex.patterns.includes('mobility');
  switch (ex.unit) {
    case 'seconds': return { exerciseId: ex.id, durationSec: clamp(Math.round(work / 5) * 5, 15, mobility ? 90 : 600), load };
    case 'meters': return { exerciseId: ex.id, distanceM: clamp(Math.round(work / ex.secPerUnit / 100) * 100, 100, 1600), load };
    case 'calories': return { exerciseId: ex.id, calories: clamp(Math.round(work / 4), 3, 40), load };
    default: return { exerciseId: ex.id, reps: clamp(niceReps(work / ex.secPerUnit), 1, mobility ? 15 : 100), load };
  }
}

export function itemWorkSec(it: PlanItem): number {
  const ex = EXERCISE_BY_ID[it.exerciseId];
  if (!ex) return 0;
  const sets = it.sets ?? 1;
  if (it.durationSec) return it.durationSec * sets;
  if (it.distanceM) return it.distanceM * ex.secPerUnit * sets;
  if (it.calories) return it.calories * 4 * sets;
  return (it.reps ?? 0) * ex.secPerUnit * sets;
}

/** Estimativa de duração de um bloco (min). AMRAP/EMOM/flow têm duração fixa; sets/for_time são calculados. */
export function estimateBlockMin(block: Omit<PlanBlock, 'estimatedMin'>, intensity: Intensity): number {
  const transition = 8;
  switch (block.format) {
    case 'amrap': case 'emom': case 'flow': return block.timeCapMin ?? 0;
    case 'tabata': return (block.rounds ?? 8) * 0.5 * Math.max(1, block.items.length);
    case 'intervals': return ((block.rounds ?? 1) * ((block.workSec ?? 60) + (block.restSec ?? 0))) / 60;
    case 'for_time': {
      const perRound = block.items.reduce((a, it) => a + itemWorkSec(it) + transition, 0) / (DENSITY[intensity] + 0.15);
      const est = ((block.rounds ?? 1) * perRound) / 60;
      return block.timeCapMin ? Math.min(est, block.timeCapMin) : est;
    }
    case 'sets': {
      let total = 0;
      for (const it of block.items) {
        const sets = it.sets ?? 1;
        const perSet = itemWorkSec({ ...it, sets: 1 }) + transition;
        total += sets * perSet + Math.max(0, sets - 1) * (it.restSec ?? 60);
      }
      return total / 60;
    }
  }
}

export function finalizeBlock(block: Omit<PlanBlock, 'estimatedMin'>, intensity: Intensity): PlanBlock {
  return { ...block, estimatedMin: Math.round(estimateBlockMin(block, intensity) * 10) / 10 };
}

export function recalcPlan(plan: WorkoutPlan): WorkoutPlan {
  const blocks = plan.blocks.map((b) => finalizeBlock(b, plan.intensity));
  return { ...plan, blocks, estimatedMin: Math.round(blocks.reduce((a, b) => a + b.estimatedMin, 0)) || 1 };
}

// ───────────────────────── Estrutura da sessão ─────────────────────────

function budget(minutes: number, focus: FocusKey, intensity: Intensity) {
  const warm = minutes <= 10 ? 2 : minutes <= 15 ? 3 : minutes <= 20 ? 4 : minutes <= 30 ? 5 : minutes <= 45 ? 7 : 9;
  const cool = minutes <= 10 ? 1 : minutes <= 20 ? 2 : minutes <= 30 ? 3 : minutes <= 45 ? 4 : 5;
  const wantsStrength = ['strength', 'upper', 'legs', 'full_body', 'technique'].includes(focus) && intensity !== 'recovery';
  const strength = wantsStrength && minutes >= 30 ? (minutes >= 60 ? 15 : minutes >= 45 ? 12 : 8) : 0;
  const accessory = minutes >= 45 && !['mobility', 'recovery'].includes(focus) ? (minutes >= 60 ? 10 : 6) : 0;
  const metcon = Math.max(4, minutes - warm - cool - strength - accessory);
  return { warm, cool, strength, accessory, metcon };
}

interface BuildArgs {
  b: Briefing;
  ctx: GeneratorContext;
  focus: FocusKey;
  intensity: Intensity;
  minutes: number;
  seed: number;
  safety: SafetyAssessment;
  suggestion: Suggestion;
  inspiration?: Inspiration;
  secondaryCardio: boolean;
}

function warmupBlock(a: BuildArgs, p: Picker, minutes: number): PlanBlock {
  const items: PlanItem[] = [];
  const cardio = pick(p, (ex) => ex.modality === 'M' && ex.complexity === 1 && ex.impact !== 'high', () => 1);
  const focusMob: Record<string, string[]> = {
    upper: ['shoulder_passthrough', 'band_pull_apart', 'thoracic_rotation', 'push_up_incline'],
    legs: ['hip_90_90', 'air_squat', 'glute_bridge', 'box_squat_bench'],
    core: ['cat_cow', 'dead_bug', 'glute_bridge'],
    strength: ['hip_hinge_drill', 'air_squat', 'shoulder_passthrough'],
    cardio: ['air_squat', 'thoracic_rotation', 'hip_90_90'],
    full_body: ['air_squat', 'shoulder_passthrough', 'hip_hinge_drill'],
    technique: ['hip_hinge_drill', 'shoulder_passthrough', 'air_squat'],
    mobility: ['cat_cow', 'thoracic_rotation'], recovery: ['cat_cow', 'thoracic_rotation'],
  };
  const sec = minutes * 60;
  const vol = { intensity: 'light' as Intensity, eq: p.c.eq, inv: a.ctx.equipment, volumeFactor: 1, preferLoaded: false };
  if (cardio) items.push(prescribe(cardio, sec * 0.3, vol));
  for (const id of focusMob[a.focus] ?? focusMob.full_body) {
    const ex = EXERCISE_BY_ID[id];
    if (items.length >= 4 || !ex || p.used.has(id) || !exerciseFits(ex, { ...p.c, intensity: 'light' })) continue;
    p.used.add(id);
    items.push(prescribe(ex, (sec * 0.6) / 3 / 2, vol));
  }
  if (!items.length) items.push({ exerciseId: 'cat_cow', reps: 8, load: { kind: 'bodyweight' } });
  return finalizeBlock({ kind: 'warmup', title: 'Aquecimento', format: 'flow', timeCapMin: minutes, items, notes: '2 voltas em ritmo leve, aumentando a amplitude.' }, a.intensity);
}

function cooldownBlock(a: BuildArgs, p: Picker, minutes: number): PlanBlock {
  const ids = a.focus === 'upper' ? ['thoracic_rotation', 'shoulder_passthrough', 'breathing_recovery']
    : a.focus === 'legs' ? ['hamstring_stretch', 'hip_90_90', 'breathing_recovery']
      : ['hamstring_stretch', 'thoracic_rotation', 'breathing_recovery'];
  const items: PlanItem[] = [];
  for (const id of ids) {
    const ex = EXERCISE_BY_ID[id];
    if (!exerciseFits(ex, { ...p.c, intensity: 'recovery' }) || (p.used.has(id) && id !== 'breathing_recovery')) continue;
    items.push(prescribe(ex, (minutes * 60) / ids.length, { intensity: 'recovery', eq: p.c.eq, inv: a.ctx.equipment, volumeFactor: 1, preferLoaded: false }));
  }
  return finalizeBlock({ kind: 'cooldown', title: 'Volta à calma', format: 'flow', timeCapMin: minutes, items: items.length ? items : [{ exerciseId: 'breathing_recovery', durationSec: minutes * 60, load: { kind: 'bodyweight' } }] }, a.intensity);
}

const STRENGTH_PATTERNS: Partial<Record<FocusKey, Pattern[]>> = {
  upper: ['push_h', 'pull_h', 'push_v', 'pull_v'],
  legs: ['squat', 'lunge', 'hinge'],
  strength: ['squat', 'hinge', 'push_h', 'push_v', 'pull_h'],
  full_body: ['squat', 'hinge', 'push_v', 'pull_h'],
  technique: ['olympic', 'hinge', 'squat'],
};

function strengthBlock(a: BuildArgs, p: Picker, minutes: number, stressedNote: (ex: Exercise) => number): PlanBlock | null {
  const patterns = STRENGTH_PATTERNS[a.focus] ?? [];
  const technique = a.focus === 'technique';
  const movementLock = a.b.movementFocus;
  const ex1 = pick(
    p,
    (ex) => ex.loadable && ex.patterns.some((pt) => patterns.includes(pt)) && (technique ? ex.complexity >= 2 : ex.capacities.includes('strength')),
    (ex) => focusRelevance(ex, a.focus) + (ex.equipment.some((alt) => alt.includes('barbell')) && implementFor(ex, p.c.eq, true)?.includes('barbell') ? 0.4 : 0),
    { lockId: a.b.locks['strength:0'] ?? (technique ? movementLock : undefined) },
  );
  if (!ex1) return null;
  const intensity = technique ? minIntensity(a.intensity, 'light') : a.intensity;
  const reps = technique ? 3 : a.focus === 'strength' ? 5 : a.focus === 'upper' ? 8 : 6;
  const rest = technique ? 60 : a.focus === 'strength' ? 120 : 90;
  const implement = implementFor(ex1, p.c.eq, true);
  const load = loadFor(ex1, intensity, p.c.eq, a.ctx.equipment, implement);
  const perSet = reps * ex1.secPerUnit + 8 + rest;
  const sets = clamp(Math.round((minutes * 60 + rest) / perSet), 3, 6);
  const vf = stressedNote(ex1);
  const item: PlanItem = { exerciseId: ex1.id, sets, reps: Math.max(1, Math.round(reps * vf)), restSec: rest, load, locked: !!a.b.locks['strength:0'] };
  const notes = technique
    ? 'Técnica: carga leve, qualidade em cada repetição. Pare a série se a forma piorar.'
    : `Aumente a carga gradualmente nas séries mantendo ${load.kind === 'rpe' ? `RPE ${load.value}` : 'a técnica'}. Sem 1RM registrado: prescrição conservadora por RPE.`;
  return finalizeBlock({ kind: technique ? 'skill' : 'strength', title: technique ? 'Técnica' : 'Força', format: 'sets', items: [item], notes }, intensity);
}

function chooseMetconFormat(focus: FocusKey, intensity: Intensity, minutes: number, r: () => number): BlockFormat {
  if (focus === 'mobility' || focus === 'recovery' || intensity === 'recovery') return 'flow';
  if (focus === 'cardio') return intensity === 'high' && minutes <= 12 ? 'tabata' : 'intervals';
  if (focus === 'core') return 'emom';
  if (focus === 'technique' || focus === 'strength') return 'emom';
  if (intensity === 'high') return r() < 0.5 ? 'for_time' : 'amrap';
  if (intensity === 'light') return r() < 0.5 ? 'emom' : 'amrap';
  return r() < 0.6 ? 'amrap' : 'emom';
}

function metconBlock(a: BuildArgs, p: Picker, minutes: number, stressedFactor: (ex: Exercise) => number): PlanBlock {
  const r = p.rand;
  const format = chooseMetconFormat(a.focus, a.intensity, minutes, r);
  const usedPatterns = new Set<Pattern>();
  const n = format === 'flow' ? 3 : minutes <= 8 ? 2 : format === 'emom' ? (minutes >= 16 ? 4 : 3) : 3;
  const chosen: Exercise[] = [];
  const preferComplexityMax = a.intensity === 'high' ? 3 : 4;

  if (a.inspiration) {
    // Inspiração em WOD oficial: substitui cada movimento pelo equivalente disponível (mesmo padrão/estímulo).
    for (const id of a.inspiration.exerciseIds) {
      const orig = EXERCISE_BY_ID[id];
      if (!orig) continue;
      const ex = exerciseFits(orig, p.c) && !p.used.has(orig.id) ? orig : substitutes(orig.id, p.c, p.used)[0];
      if (ex && !chosen.includes(ex)) { chosen.push(ex); p.used.add(ex.id); }
      if (chosen.length >= 4) break;
    }
  }

  for (let i = chosen.length; i < n; i++) {
    const lockId = a.b.locks[`metcon:${i}`] ?? (i === 0 && a.b.movementFocus && a.focus !== 'technique' ? a.b.movementFocus : undefined);
    const wantCardio = (a.focus === 'cardio' && i % 2 === 0) || (a.secondaryCardio && i === n - 1);
    const ex = pick(
      p,
      (e) => (format === 'flow' ? e.complexity <= 2 && e.impact === 'low' : e.complexity <= preferComplexityMax) && (wantCardio ? e.modality === 'M' || e.capacities.includes('cardio_endurance') : true),
      (e) => (wantCardio ? focusRelevance(e, 'cardio') : focusRelevance(e, a.focus)) + (e.patterns.includes('mobility') && format !== 'flow' ? -3 : 0),
      { usedPatterns, lockId },
    );
    if (ex) chosen.push(ex);
  }
  if (!chosen.length) chosen.push(EXERCISE_BY_ID.plank);

  const vol = (ex: Exercise) => ({ intensity: a.intensity, eq: p.c.eq, inv: a.ctx.equipment, volumeFactor: stressedFactor(ex), preferLoaded: true });
  const density = DENSITY[a.intensity];
  const sec = minutes * 60;
  let items: PlanItem[];
  let block: Omit<PlanBlock, 'estimatedMin'>;
  const locked = (ex: Exercise, i: number) => a.b.locks[`metcon:${i}`] === ex.id;

  switch (format) {
    case 'emom': {
      const work = a.intensity === 'high' ? 45 : a.intensity === 'moderate' ? 38 : 30;
      items = chosen.map((ex, i) => ({ ...prescribe(ex, work, vol(ex)), locked: locked(ex, i) }));
      const total = Math.max(chosen.length, Math.floor(minutes / chosen.length) * chosen.length);
      block = { kind: 'metcon', title: `EMOM ${total} min`, format, timeCapMin: total, items, notes: `A cada minuto, alterne os ${chosen.length} movimentos. Sobra do minuto = descanso.` };
      break;
    }
    case 'intervals': {
      const [workSec, restSec] = a.intensity === 'high' ? [40, 20] : a.intensity === 'moderate' ? [60, 45] : [60, 60];
      const rounds = Math.max(2, Math.floor(sec / (workSec + restSec)));
      items = chosen.map((ex, i) => ({ ...prescribe(ex, workSec * density, vol(ex)), durationSec: ex.unit === 'reps' ? undefined : workSec, locked: locked(ex, i) }));
      block = { kind: 'metcon', title: `${rounds} intervalos ${workSec}s/${restSec}s`, format, rounds, workSec, restSec, items, notes: 'Alterne os movimentos a cada intervalo. Ritmo constante e sustentável — fôlego controlado.' };
      break;
    }
    case 'tabata': {
      items = chosen.slice(0, 2).map((ex, i) => ({ exerciseId: ex.id, durationSec: 20, load: loadFor(ex, a.intensity, p.c.eq, a.ctx.equipment, implementFor(ex, p.c.eq, false)), locked: locked(ex, i) }));
      block = { kind: 'metcon', title: 'Tabata', format, rounds: 8, workSec: 20, restSec: 10, items, notes: '8 × (20 s forte / 10 s descanso) por movimento.' };
      break;
    }
    case 'for_time': {
      const roundTarget = 150;
      items = chosen.map((ex, i) => ({ ...prescribe(ex, (roundTarget * density) / chosen.length, vol(ex)), locked: locked(ex, i) }));
      const perRound = items.reduce((acc, it) => acc + itemWorkSec(it) + 8, 0) / (density + 0.15);
      const rounds = clamp(Math.round(sec / perRound), 2, 10);
      block = { kind: 'metcon', title: `${rounds} rounds for time`, format, rounds, timeCapMin: minutes, items, notes: `Time cap ${minutes} min. Quebre as séries antes de "estourar".` };
      break;
    }
    case 'flow': {
      items = chosen.map((ex, i) => ({ ...prescribe(ex, (sec * 0.55) / chosen.length / 2, vol(ex)), locked: locked(ex, i) }));
      block = { kind: 'metcon', title: a.focus === 'mobility' || a.focus === 'recovery' ? 'Mobilidade guiada' : `Circuito leve ${minutes} min`, format, timeCapMin: minutes, items, notes: 'Ritmo de conversa, sem pressa. Respire pelo nariz quando possível.' };
      break;
    }
    default: {
      const roundTarget = a.intensity === 'light' ? 150 : 120;
      items = chosen.map((ex, i) => ({ ...prescribe(ex, (roundTarget * density) / chosen.length, vol(ex)), locked: locked(ex, i) }));
      block = { kind: 'metcon', title: `AMRAP ${minutes} min`, format: 'amrap', timeCapMin: minutes, items, notes: 'Máximo de rodadas com boa técnica. Anote rodadas + reps.' };
    }
  }
  return finalizeBlock(block, a.intensity);
}

function accessoryBlock(a: BuildArgs, p: Picker, minutes: number): PlanBlock | null {
  const groupPref: Pattern[] = a.focus === 'legs' ? ['core_stability', 'core_flexion'] : ['core_stability', 'core_flexion', 'pull_h'];
  const items: PlanItem[] = [];
  for (let i = 0; i < 2; i++) {
    const ex = pick(
      p,
      (e) => e.complexity <= 2 && e.impact === 'low' && (i === 0 ? e.patterns.some((pt) => groupPref.includes(pt)) : focusRelevance(e, a.focus === 'cardio' ? 'core' : a.focus) > 0.4),
      (e) => focusRelevance(e, i === 0 ? 'core' : a.focus === 'cardio' ? 'core' : a.focus),
      { lockId: a.b.locks[`accessory:${i}`] },
    );
    if (!ex) continue;
    const it = prescribe(ex, ex.unit === 'seconds' ? 40 : 30, { intensity: a.intensity, eq: p.c.eq, inv: a.ctx.equipment, volumeFactor: 1, preferLoaded: true });
    items.push({ ...it, sets: 3, restSec: 45 });
  }
  if (!items.length) return null;
  // Ajusta séries para caber no tempo do bloco.
  const block0 = { kind: 'accessory' as const, title: 'Acessórios (superset)', format: 'sets' as const, items, notes: 'Alterne os dois exercícios; descanso curto.' };
  const est = estimateBlockMin(block0, a.intensity);
  const factor = clamp(minutes / Math.max(1, est), 0.5, 1.7);
  const sets = clamp(Math.round(3 * factor), 2, 5);
  return finalizeBlock({ ...block0, items: items.map((it) => ({ ...it, sets })) }, a.intensity);
}

function stressedFactorFor(stressed: Set<Muscle>, ex: Exercise): number {
  const main = (Object.entries(ex.muscles) as Array<[Muscle, number]>).sort((x, y) => y[1] - x[1])[0]?.[0];
  return main && stressed.has(main) ? 0.75 : 1;
}

function buildPlan(a: BuildArgs, option: 'A' | 'B' | 'C', label: string): WorkoutPlan {
  const p: Picker = {
    c: { eq: availableEquipment(a.b, a.ctx), location: a.b.location, intensity: a.intensity, safety: a.safety, avoided: new Set(a.b.avoided) },
    rand: rng(a.seed + option.charCodeAt(0) * 7919),
    recent: a.suggestion.recent,
    stressed: new Set(a.suggestion.stressed),
    preferred: new Set(a.b.preferred),
    used: new Set(),
  };
  const bud = budget(a.minutes, a.focus, a.intensity);
  const sf = (ex: Exercise) => stressedFactorFor(p.stressed, ex);
  const blocks: PlanBlock[] = [warmupBlock(a, p, bud.warm)];
  if (bud.strength) {
    const s = strengthBlock(a, p, bud.strength, sf);
    if (s) blocks.push(s); else bud.metcon += bud.strength;
  }
  blocks.push(metconBlock(a, p, bud.metcon, sf));
  if (bud.accessory) {
    const acc = accessoryBlock(a, p, bud.accessory);
    if (acc) blocks.push(acc);
  }
  blocks.push(cooldownBlock(a, p, bud.cool));

  const estimatedMin = Math.round(blocks.reduce((acc, b) => acc + b.estimatedMin, 0));
  const plan: WorkoutPlan = {
    id: uid('plan'), option, label,
    title: a.inspiration ? `Inspirado em: ${a.inspiration.title}` : `${FOCUS_LABEL[a.focus]} · ${INTENSITY_LABEL[a.intensity].toLowerCase()} · ${a.minutes} min`,
    focus: a.focus, location: a.b.location, intensity: a.intensity, targetMin: a.minutes, estimatedMin,
    blocks, rationale: [], tradeoffs: [], safetyNotes: [...a.safety.messages], isRest: false,
    inspiredByOfficialId: a.inspiration?.officialId, seed: a.seed, generatedAt: new Date().toISOString(),
  };
  if (a.inspiration) {
    plan.rationale.push('Adaptação própria do CG Performance a partir do WOD oficial — NÃO é a programação oficial da CrossFit. Movimentos substituídos pelo equivalente disponível preservando o estímulo.');
  }
  const usesBarbellAtHome = a.b.location === 'home' && blocks.some((b) => b.items.some((it) => implementFor(EXERCISE_BY_ID[it.exerciseId], p.c.eq, true)?.includes('barbell')));
  if (usesBarbellAtHome && !p.c.eq.has('safety_arms')) {
    plan.safetyNotes.push('Barra em casa sem barras de segurança confirmadas: termine as séries 2–3 reps antes da falha e só solte a barra sobre tapete com anilhas bumper.');
  }
  return plan;
}

function restPlan(a: BuildArgs, option: 'A' | 'B' | 'C', label: string, minutes: number, gentle: boolean): WorkoutPlan {
  const items: PlanItem[] = gentle
    ? [
      { exerciseId: 'breathing_recovery', durationSec: 120, load: { kind: 'bodyweight' } },
      { exerciseId: 'cat_cow', reps: 10, load: { kind: 'bodyweight' } },
      { exerciseId: 'thoracic_rotation', reps: 8, load: { kind: 'bodyweight' } },
      { exerciseId: 'hip_90_90', reps: 8, load: { kind: 'bodyweight' } },
    ]
    : [{ exerciseId: 'breathing_recovery', durationSec: 180, load: { kind: 'bodyweight' } }];
  const block = finalizeBlock({ kind: 'cooldown', title: gentle ? 'Recuperação suave' : 'Descanso', format: 'flow', timeCapMin: gentle ? minutes : 3, items, notes: gentle ? 'Somente se você se sentir bem. Sem esforço.' : 'Hidrate-se, durma bem e faça novo check-in amanhã.' }, 'recovery');
  return {
    id: uid('plan'), option, label, title: gentle ? `Recuperação suave · ${minutes} min` : 'Descanso', focus: 'recovery', location: a.b.location,
    intensity: 'recovery', targetMin: gentle ? minutes : 3, estimatedMin: Math.max(1, Math.round(block.estimatedMin)), blocks: [block],
    rationale: [], tradeoffs: [], safetyNotes: [...a.safety.messages], isRest: !gentle, seed: a.seed, generatedAt: new Date().toISOString(),
  };
}

// ───────────────────────── API pública ─────────────────────────

export function substitutes(exerciseId: string, c: Constraints, exclude: Set<string> = new Set()): Exercise[] {
  const orig = EXERCISE_BY_ID[exerciseId];
  if (!orig) return [];
  const vec = (e: Exercise) => MUSCLES.map((m) => e.muscles[m] ?? 0);
  const ov = vec(orig);
  const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return EXERCISES.filter((e) => e.id !== exerciseId && !exclude.has(e.id) && exerciseFits(e, c))
    .map((e) => {
      const v = vec(e);
      const cos = v.reduce((s, x, i) => s + x * ov[i], 0) / (norm(v) * norm(ov));
      const pat = e.patterns.some((pt) => orig.patterns.includes(pt)) ? 0.4 : 0;
      const mod = e.modality === orig.modality ? 0.2 : 0;
      return { e, s: cos + pat + mod };
    })
    .sort((x, y) => y.s - x.s)
    .map((x) => x.e);
}

export function constraintsFor(b: Briefing, ctx: Pick<GeneratorContext, 'equipment'>, intensity: Intensity): Constraints {
  return {
    eq: availableEquipment(b, ctx), location: b.location, intensity,
    safety: assessSafety({ symptoms: b.symptoms, pains: b.pains, energy: b.energy, sleep: b.sleep }), avoided: new Set(b.avoided),
  };
}

export function generate(b: Briefing, ctx: GeneratorContext, inspiration?: Inspiration): GenerateResult {
  const suggestion = computeSuggestion({ today: ctx.today, performed: ctx.performed, prescribedById: ctx.prescribedById, checkin: ctx.checkin });
  const safety = assessSafety({ symptoms: b.symptoms, pains: b.pains, energy: b.energy, sleep: b.sleep });
  const userChoseFocus = b.focus !== 'auto';
  const focus: FocusKey = userChoseFocus ? (b.focus as FocusKey) : suggestion.focus;
  const intensity = minIntensity(b.intensity, safety.maxIntensity);
  const secondaryCardio = !userChoseFocus ? suggestion.secondary === 'cardio' : ['core', 'upper', 'legs', 'full_body'].includes(focus);
  const base: BuildArgs = { b, ctx, focus, intensity, minutes: b.minutes, seed: b.seed, safety, suggestion, inspiration, secondaryCardio };

  const explain: string[] = [];
  const tradeoffs: string[] = [];
  if (userChoseFocus && focus !== suggestion.focus) {
    explain.push(`Você escolheu ${FOCUS_LABEL[focus].toLowerCase()} (a sugestão era ${FOCUS_LABEL[suggestion.focus].toLowerCase()}). Respeitei sua escolha e recalculei o treino.`);
  } else if (!userChoseFocus) {
    explain.push(suggestion.headline, ...suggestion.reasons);
  }
  // Sobreposição com músculos recentemente exigidos (ex.: ombros ontem + foco superiores).
  const focusMs = new Set<Muscle>(focus === 'upper' || focus === 'legs' || focus === 'core' ? MUSCLE_GROUPS[focus] : []);
  const overlap = suggestion.stressed.filter((m) => focusMs.has(m));
  if (overlap.length) {
    const others = [...focusMs].filter((m) => !suggestion.stressed.includes(m)).slice(0, 3);
    explain.push(
      `Você trabalhou ${overlap.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')} recentemente; priorizei ${others.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')} com volume reduzido (−25%) para ${overlap.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')}.`,
    );
    tradeoffs.push('Treinar o mesmo grupo em dias seguidos é possível, mas limita a carga e pode atrasar a recuperação percebida.');
  } else if (suggestion.stressed.length) {
    explain.push(`Músculos mais exigidos recentemente (${suggestion.stressed.slice(0, 3).map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')}) receberam menor prioridade.`);
  }
  if (intensity !== b.intensity) {
    tradeoffs.push(`Você pediu intensidade ${INTENSITY_LABEL[b.intensity].toLowerCase()}, mas o check-in de hoje limita a ${INTENSITY_LABEL[intensity].toLowerCase()}. Esta regra de segurança não pode ser desativada.`);
  }
  if (b.location === 'home') {
    const unconfirmed = ctx.equipment.filter((e) => !e.confirmed).length;
    if (unconfirmed) tradeoffs.push(`${unconfirmed} item(ns) do inventário ainda não confirmados não foram usados. Confirme em Equipamentos para ampliar as opções.`);
  }
  if (b.location === 'hotel_room') explain.push('Quarto de hotel: apenas movimentos silenciosos, sem saltos e em pouco espaço.');

  const options: WorkoutPlan[] = [];
  if (safety.restRecommended) {
    const a = restPlan(base, 'A', 'Recomendado', 10, safety.level !== 'urgent');
    a.rationale.push('O check-in de hoje indica descanso. Treinar com sintomas sistêmicos pode prolongar a recuperação.');
    options.push(a);
    options.push(restPlan(base, 'B', 'Descanso total', 3, false));
    if (safety.level !== 'urgent') {
      const mob = buildPlan({ ...base, focus: 'mobility', intensity: 'recovery', minutes: 15 }, 'C', 'Mobilidade leve (opcional)');
      options.push(mob);
    }
  } else {
    const A = buildPlan(base, 'A', 'Recomendado');
    A.rationale.push(...explain);
    A.tradeoffs.push(...tradeoffs);
    options.push(A);
    const bMin = b.minutes <= 15 ? 10 : b.minutes <= 20 ? 12 : round5(b.minutes / 2);
    const B = buildPlan({ ...base, minutes: Math.min(bMin, 15), seed: b.seed + 1 }, 'B', 'Express');
    B.rationale.push(`Versão express de ${B.targetMin} min com o mesmo foco: sem bloco de força, aquecimento curto.`);
    options.push(B);
    const recoveryFocus: FocusKey = suggestion.stressed.length >= 4 || intensity === 'light' ? 'recovery' : 'mobility';
    const C = buildPlan({ ...base, focus: recoveryFocus, intensity: 'recovery', minutes: Math.min(20, b.minutes), seed: b.seed + 2, secondaryCardio: false }, 'C', 'Recuperação/mobilidade');
    C.rationale.push('Opção regenerativa: mobilidade e movimento leve para dias de fadiga ou pouco tempo.');
    options.push(C);
  }
  const validated = options.map((o) => WorkoutPlanSchema.parse(o));
  return { options: validated, suggestion, safety, effectiveFocus: focus, effectiveIntensity: intensity, equipmentUsed: [...availableEquipment(b, ctx)] };
}

/** "Versão mais simples": troca cada item pela escala mais fácil disponível e reduz volume. */
export function simplify(plan: WorkoutPlan, c: Constraints): WorkoutPlan {
  const blocks = plan.blocks.map((bl) => ({
    ...bl,
    items: bl.items.map((it) => {
      const ex = EXERCISE_BY_ID[it.exerciseId];
      const easier = ex?.easier.map((id) => EXERCISE_BY_ID[id]).find((e) => e && exerciseFits(e, c));
      const scale = (n?: number) => (n ? Math.max(1, Math.round(n * 0.8)) : n);
      const base = easier ? { ...it, exerciseId: easier.id, load: easier.loadable ? it.load : { kind: 'bodyweight' as const } } : it;
      return { ...base, reps: scale(base.reps), durationSec: scale(base.durationSec), distanceM: scale(base.distanceM), calories: scale(base.calories) };
    }),
  }));
  const intensity = INTENSITY_ORDER[Math.max(0, INTENSITY_ORDER.indexOf(plan.intensity) - 1)];
  return recalcPlan({ ...plan, intensity, blocks, title: `${plan.title} (simplificado)` });
}
