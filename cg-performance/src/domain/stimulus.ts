import type { PerformedWorkout, PrescribedWorkout } from '../db/types';
import { addDays, daysBetween } from '../lib/util';
import { EXERCISE_BY_ID, type Exercise } from './exercises';
import type { PerformedItem } from './schemas';
import {
  MUSCLE_GROUPS, MUSCLES, PATTERNS, type Capacity, type Modality, type Muscle, type MuscleGroup, type Pattern,
} from './taxonomy';

/**
 * Modelo heurístico de EXPOSIÇÃO a estímulos (spec §5.3).
 * Unidade: "minutos-estímulo" = segundos de trabalho estimados × peso do músculo × fator de esforço / 60.
 * NÃO é recuperação fisiológica, inflamação nem hipertrofia medida.
 */

export type MuscleMap = Record<Muscle, number>;

export const emptyMuscleMap = (): MuscleMap => Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleMap;

export function workSeconds(item: Pick<PerformedItem, 'reps' | 'sets' | 'durationSec' | 'distanceM' | 'calories'>, ex: Exercise): number {
  const sets = item.sets ?? 1;
  if (item.durationSec) return item.durationSec * sets;
  if (item.distanceM) return item.distanceM * (ex.unit === 'meters' ? ex.secPerUnit : 0.33) * sets;
  if (item.calories) return item.calories * 4 * sets;
  if (item.reps) return item.reps * (ex.unit === 'reps' ? ex.secPerUnit : 1) * sets;
  return 0;
}

/** RPE 7 = fator 1. Sem RPE: fator 1 com confiança menor. */
export function effortFactor(rpe?: number): number {
  if (rpe == null) return 1;
  return Math.min(1.4, Math.max(0.4, rpe / 7));
}

export interface WorkoutStimulus {
  muscles: MuscleMap;
  patterns: Partial<Record<Pattern, number>>;
  capacities: Partial<Record<Capacity, number>>;
  modalities: Partial<Record<Modality, number>>;
  workMin: number;
  /** 0–1: quão bem os dados descrevem o que foi feito. */
  confidence: number;
}

/** Quando um treino do box foi marcado como realizado mas sem detalhes, estimamos pela prescrição (confiança baixa). */
const DEFAULT_REPS_FROM_PRESCRIPTION = 30;

export function stimulusOfItems(items: PerformedItem[], rpe?: number): WorkoutStimulus {
  const muscles = emptyMuscleMap();
  const patterns: WorkoutStimulus['patterns'] = {};
  const capacities: WorkoutStimulus['capacities'] = {};
  const modalities: WorkoutStimulus['modalities'] = {};
  const f = effortFactor(rpe);
  let workSec = 0;
  for (const it of items) {
    if (it.completed === false) continue;
    const ex = EXERCISE_BY_ID[it.exerciseId];
    if (!ex) continue;
    const ws = workSeconds(it, ex);
    workSec += ws;
    const units = (ws * f) / 60;
    for (const [m, w] of Object.entries(ex.muscles)) muscles[m as Muscle] += units * (w ?? 0);
    for (const p of ex.patterns) patterns[p] = (patterns[p] ?? 0) + units;
    for (const c of ex.capacities) capacities[c] = (capacities[c] ?? 0) + units;
    modalities[ex.modality] = (modalities[ex.modality] ?? 0) + units;
  }
  return { muscles, patterns, capacities, modalities, workMin: workSec / 60, confidence: 1 };
}

export function stimulusOfPerformed(w: PerformedWorkout, prescribed?: PrescribedWorkout): WorkoutStimulus {
  if (w.status === 'not_done') return { ...stimulusOfItems([]), confidence: 1 };
  let items = w.items;
  let confidence = w.items.length ? (w.rpe != null ? 0.85 : 0.7) : 0.3;
  if (!items.length && prescribed) {
    items = prescribed.blocks.flatMap((b) => b.movements)
      .filter((m) => m.exerciseId)
      .map((m) => ({ exerciseId: m.exerciseId!, reps: m.reps ?? DEFAULT_REPS_FROM_PRESCRIPTION, distanceM: m.distanceM, calories: m.calories, completed: true }));
    confidence = 0.4;
  }
  const s = stimulusOfItems(items, w.rpe);
  if (w.status === 'partial') {
    for (const m of MUSCLES) s.muscles[m] *= 0.6;
    confidence *= 0.8;
  }
  return { ...s, confidence };
}

export interface WindowSummary {
  days: number;
  sessions: number;
  muscles: MuscleMap;
  groups: Record<MuscleGroup | 'cardio', number>;
  patterns: Partial<Record<Pattern, number>>;
  capacities: Partial<Record<Capacity, number>>;
  modalities: Partial<Record<Modality, number>>;
  avgRpe?: number;
  workMin: number;
  confidence: number;
}

export function groupTotals(muscles: MuscleMap, cardioUnits: number): Record<MuscleGroup | 'cardio', number> {
  const g = { upper: 0, legs: 0, core: 0, cardio: cardioUnits };
  for (const k of Object.keys(MUSCLE_GROUPS) as MuscleGroup[]) {
    for (const m of MUSCLE_GROUPS[k]) g[k] += muscles[m];
  }
  return g;
}

export function summarizeWindow(
  performed: PerformedWorkout[], prescribedById: Map<string, PrescribedWorkout>, today: string, days: number,
): WindowSummary {
  const from = addDays(today, -(days - 1));
  const inWin = performed.filter((w) => w.status !== 'not_done' && w.event_date >= from && w.event_date <= today);
  const muscles = emptyMuscleMap();
  const patterns: WindowSummary['patterns'] = {};
  const capacities: WindowSummary['capacities'] = {};
  const modalities: WindowSummary['modalities'] = {};
  let workMin = 0;
  let confSum = 0;
  const rpes: number[] = [];
  for (const w of inWin) {
    const s = stimulusOfPerformed(w, w.prescribedId ? prescribedById.get(w.prescribedId) : undefined);
    for (const m of MUSCLES) muscles[m] += s.muscles[m];
    for (const [k, v] of Object.entries(s.patterns)) patterns[k as Pattern] = (patterns[k as Pattern] ?? 0) + (v ?? 0);
    for (const [k, v] of Object.entries(s.capacities)) capacities[k as Capacity] = (capacities[k as Capacity] ?? 0) + (v ?? 0);
    for (const [k, v] of Object.entries(s.modalities)) modalities[k as Modality] = (modalities[k as Modality] ?? 0) + (v ?? 0);
    workMin += s.workMin;
    confSum += s.confidence;
    if (w.rpe != null) rpes.push(w.rpe);
  }
  const cardio = (modalities.M ?? 0) + (capacities.cardio_endurance ?? 0) * 0.5;
  return {
    days, sessions: inWin.length, muscles, groups: groupTotals(muscles, cardio), patterns, capacities, modalities,
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : undefined,
    workMin, confidence: inWin.length ? confSum / inWin.length : 0,
  };
}

/** Exposição recente com decaimento (meia-vida ~36 h): usada para evitar sobreposição em treinos seguidos. */
export function recentLoad(performed: PerformedWorkout[], prescribedById: Map<string, PrescribedWorkout>, today: string): MuscleMap {
  const out = emptyMuscleMap();
  for (const w of performed) {
    if (w.status === 'not_done') continue;
    const age = daysBetween(w.event_date, today);
    if (age < 0 || age > 4) continue;
    const decay = Math.pow(0.5, (age * 24 + 12) / 36);
    const s = stimulusOfPerformed(w, w.prescribedId ? prescribedById.get(w.prescribedId) : undefined);
    for (const m of MUSCLES) out[m] += s.muscles[m] * decay;
  }
  return out;
}

/** Músculos "em alta" recentemente (acima de um limiar absoluto), em ordem decrescente. */
export function stressedMuscles(recent: MuscleMap, threshold = 2.5): Muscle[] {
  return MUSCLES.filter((m) => recent[m] >= threshold).sort((a, b) => recent[b] - recent[a]);
}

export const PATTERN_KEYS = PATTERNS;
