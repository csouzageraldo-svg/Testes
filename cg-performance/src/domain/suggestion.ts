import type { PerformedWorkout, PrescribedWorkout, RecoveryCheckin } from '../db/types';
import { addDays, daysBetween } from '../lib/util';
import { assessSafety } from './safety';
import { recentLoad, stressedMuscles, summarizeWindow, type MuscleMap, type WindowSummary } from './stimulus';
import { MUSCLE_GROUPS, MUSCLE_LABEL, type Focus, type Intensity, type Muscle, type MuscleGroup } from './taxonomy';

/** Distribuição-alvo por grupo, ponderada pelos objetivos (cardio e core/superiores priorizados, pernas mantidas). */
export const TARGET_SHARE: Record<MuscleGroup | 'cardio', number> = { upper: 0.27, core: 0.24, cardio: 0.27, legs: 0.22 };

const GROUP_LABEL: Record<MuscleGroup | 'cardio', string> = { upper: 'superiores', core: 'core', cardio: 'cardio', legs: 'pernas' };

export interface Suggestion {
  focus: Exclude<Focus, 'auto'>;
  secondary?: 'cardio' | 'core' | 'mobility';
  intensity: Intensity;
  headline: string;
  reasons: string[];
  /** 0–1: confiança da análise (quantidade/qualidade dos dados recentes). */
  confidence: number;
  daysSinceLast: number | null;
  windows: { d7: WindowSummary; d14: WindowSummary; d30: WindowSummary };
  recent: MuscleMap;
  stressed: Muscle[];
}

export interface SuggestionInput {
  today: string;
  performed: PerformedWorkout[];
  prescribedById: Map<string, PrescribedWorkout>;
  checkin?: RecoveryCheckin;
}

function topMuscles(m: MuscleMap, n = 2): Muscle[] {
  return (Object.keys(m) as Muscle[]).filter((k) => m[k] > 0.2).sort((a, b) => m[b] - m[a]).slice(0, n);
}

export function computeSuggestion({ today, performed, prescribedById, checkin }: SuggestionInput): Suggestion {
  const done = performed.filter((w) => w.status !== 'not_done' && w.event_date <= today).sort((a, b) => b.event_date.localeCompare(a.event_date));
  const d7 = summarizeWindow(done, prescribedById, today, 7);
  const d14 = summarizeWindow(done, prescribedById, today, 14);
  const d30 = summarizeWindow(done, prescribedById, today, 30);
  const recent = recentLoad(done, prescribedById, today);
  const stressed = stressedMuscles(recent, 1.5);
  const daysSinceLast = done.length ? daysBetween(done[0].event_date, today) : null;
  const reasons: string[] = [];

  let intensity = 'moderate' as Intensity;
  if (d7.avgRpe != null && d7.avgRpe >= 8 && d7.sessions >= 3) {
    intensity = 'light';
    reasons.push(`RPE médio alto nos últimos 7 dias (${d7.avgRpe.toFixed(1)}): hoje sugiro intensidade leve.`);
  }
  if (checkin && checkin.event_date === today) {
    const s = assessSafety({ symptoms: checkin.symptoms, pains: checkin.pains, energy: checkin.energy, sleep: checkin.sleep });
    if (s.restRecommended) {
      return {
        focus: 'recovery', intensity: 'recovery', headline: 'Hoje o melhor treino é descanso/recuperação.',
        reasons: [...s.messages], confidence: 0.9, daysSinceLast, windows: { d7, d14, d30 }, recent, stressed,
      };
    }
    if (s.maxIntensity !== 'high') {
      const order: Intensity[] = ['recovery', 'light', 'moderate', 'high'];
      if (order.indexOf(s.maxIntensity) < order.indexOf(intensity)) intensity = s.maxIntensity;
      reasons.push(...s.messages);
    }
  }

  // Sem dados: ponto de partida alinhado aos objetivos.
  if (!done.length) {
    return {
      focus: 'core', secondary: 'cardio', intensity, headline: 'Sugiro core + cardio moderado para começar.',
      reasons: [...reasons, 'Ainda não há treinos realizados registrados: uso seus objetivos (core, superiores e fôlego) como ponto de partida.'],
      confidence: 0.2, daysSinceLast, windows: { d7, d14, d30 }, recent, stressed,
    };
  }

  // Sequência longa de dias treinados → recuperação.
  let streak = 0;
  for (let i = 1; i <= 7; i++) {
    const target = addDays(today, -i);
    if (done.some((w) => w.event_date === target)) streak++; else break;
  }
  const confidence = Math.min(0.9, 0.25 + 0.12 * d14.sessions) * (d14.confidence || 0.5);

  if (streak >= 4) {
    return {
      focus: 'mobility', secondary: 'cardio', intensity: 'light', headline: `Você treinou ${streak} dias seguidos: sugiro mobilidade + cardio leve.`,
      reasons: [...reasons, 'Sequências longas sem descanso aumentam fadiga acumulada; um dia leve ajuda a manter a consistência de 3–5 sessões/semana.'],
      confidence, daysSinceLast, windows: { d7, d14, d30 }, recent, stressed,
    };
  }
  if (daysSinceLast != null && daysSinceLast >= 4) {
    reasons.push(`Última sessão há ${daysSinceLast} dias: retomada com full body moderado.`);
    return {
      focus: 'full_body', secondary: 'cardio', intensity: intensity === 'high' ? 'moderate' : intensity,
      headline: 'Sugiro full body moderado para retomar o ritmo.', reasons, confidence, daysSinceLast, windows: { d7, d14, d30 }, recent, stressed,
    };
  }

  const win = d7.sessions >= 2 ? d7 : d14;
  const total = Object.values(win.groups).reduce((a, b) => a + b, 0) || 1;
  const recentGroups = { upper: 0, legs: 0, core: 0, cardio: 0 } as Record<MuscleGroup | 'cardio', number>;
  for (const g of Object.keys(MUSCLE_GROUPS) as MuscleGroup[]) for (const m of MUSCLE_GROUPS[g]) recentGroups[g] += recent[m];
  const candidates = (Object.keys(TARGET_SHARE) as Array<MuscleGroup | 'cardio'>)
    .map((g) => ({ g, deficit: TARGET_SHARE[g] - win.groups[g] / total, recent: recentGroups[g] }))
    // Grupo muito exigido nas últimas ~48 h perde prioridade.
    .map((c) => ({ ...c, score: c.deficit - (c.g !== 'cardio' && c.recent > 4 ? 0.25 : 0) }))
    .sort((a, b) => b.score - a.score);
  const pick = candidates[0].g;
  const focus: Suggestion['focus'] = pick;
  const secondary: Suggestion['secondary'] = pick === 'cardio' ? 'core' : 'cardio';

  const top = topMuscles(recent);
  if (top.length) reasons.push(`Seus últimos treinos tiveram mais esforço de ${top.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(' e ')}.`);
  reasons.push(
    `Nos últimos ${win.days} dias, ${GROUP_LABEL[pick]} ficou abaixo da distribuição-alvo (${Math.round((win.groups[pick] / total) * 100)}% vs ${Math.round(TARGET_SHARE[pick] * 100)}%).`,
  );
  const headline = `Sugiro ${GROUP_LABEL[pick]} + ${secondary === 'cardio' ? 'cardio' : 'core'} ${intensity === 'light' ? 'leve' : intensity === 'moderate' ? 'moderado' : intensity === 'high' ? 'intenso' : 'regenerativo'}.`;
  return { focus, secondary, intensity, headline, reasons, confidence, daysSinceLast, windows: { d7, d14, d30 }, recent, stressed };
}
