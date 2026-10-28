import type {
  AthleteProfile, BodyCompositionMeasurement, EquipmentItem, PerformedWorkout, PrescribedWorkout, RecommendationRecord,
} from '../db/types';
import { addDays } from '../lib/util';
import { EXERCISE_BY_ID } from './exercises';
import { summarizeWindow } from './stimulus';
import { MUSCLE_LABEL, PATTERN_LABEL, type Muscle, type Pattern } from './taxonomy';

function qty(it: PerformedWorkout['items'][number]): string {
  if (it.sets && it.reps) return `${it.sets}×${it.reps}`;
  if (it.reps) return `${it.reps}`;
  if (it.durationSec) return `${it.durationSec}s`;
  if (it.distanceM) return `${it.distanceM}m`;
  if (it.calories) return `${it.calories}cal`;
  return '';
}

/**
 * Sumário em Markdown para colar no ChatGPT/Claude (EXPORT_FOR_CHATGPT.md).
 * Por padrão NÃO inclui dados sensíveis (sintomas, dores, notas, data de nascimento, composição corporal).
 */
export function buildChatSummary(input: {
  today: string;
  profile?: AthleteProfile;
  performed: PerformedWorkout[];
  prescribed: PrescribedWorkout[];
  bodycomp: BodyCompositionMeasurement[];
  equipment: EquipmentItem[];
  recommendations: RecommendationRecord[];
  includeSensitive: boolean;
}): string {
  const { today, profile, performed, prescribed, bodycomp, equipment, recommendations, includeSensitive } = input;
  const byId = new Map(prescribed.map((w) => [w.id, w]));
  const w30 = summarizeWindow(performed, byId, today, 30);
  const w7 = summarizeWindow(performed, byId, today, 7);
  const L: string[] = [];
  L.push(`# CG Performance — resumo para assistente (${today})`, '');
  L.push('> Gerado pelo app CG Performance (não oficial, não afiliado à CrossFit). Estimativas heurísticas; não são medidas clínicas.', '');
  L.push('## Perfil e objetivos');
  if (profile) {
    L.push(`- Nome de exibição: ${profile.displayName}`);
    if (profile.crossfitStart) L.push(`- Início no CrossFit: ${profile.crossfitStart}`);
    if (includeSensitive && profile.birthDate) L.push(`- Nascimento: ${profile.birthDate}`);
    if (profile.heightCm) L.push(`- Altura: ${profile.heightCm} cm`);
    L.push(`- Meta de frequência: ${profile.goals.sessionsPerWeek.join('–')} sessões/semana`);
    for (const g of profile.goals.text) L.push(`- ${g}`);
    if (includeSensitive && profile.goals.bodyFatTarget) L.push(`- Gordura-alvo: ${profile.goals.bodyFatTarget.join('–')}%`);
    if (includeSensitive && profile.goals.weightTarget) L.push(`- Peso-alvo: ${profile.goals.weightTarget.join('–')} kg`);
  }
  L.push('', '## Últimos 30 dias');
  L.push(`- Sessões realizadas: ${w30.sessions} (7 dias: ${w7.sessions}); trabalho estimado: ${Math.round(w30.workMin)} min; RPE médio: ${w30.avgRpe?.toFixed(1) ?? 'n/d'}; confiança: ${Math.round(w30.confidence * 100)}%`);
  const g = w30.groups; const tot = Object.values(g).reduce((a, b) => a + b, 0) || 1;
  L.push(`- Distribuição: superiores ${Math.round((g.upper / tot) * 100)}%, pernas ${Math.round((g.legs / tot) * 100)}%, core ${Math.round((g.core / tot) * 100)}%, cardio ${Math.round((g.cardio / tot) * 100)}%`);
  const topM = (Object.entries(w30.muscles) as Array<[Muscle, number]>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (topM.length) L.push(`- Músculos mais/menos expostos: ${topM.slice(0, 3).map(([m]) => MUSCLE_LABEL[m]).join(', ')} / ${topM.slice(-3).map(([m]) => MUSCLE_LABEL[m]).join(', ')}`);
  const topP = (Object.entries(w30.patterns) as Array<[Pattern, number]>).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topP.length) L.push(`- Padrões dominantes: ${topP.map(([p]) => PATTERN_LABEL[p]).join(', ')}`);
  L.push('', '## Treinos realizados (30 dias)');
  const from = addDays(today, -29);
  for (const w of performed.filter((x) => x.event_date >= from).sort((a, b) => a.event_date.localeCompare(b.event_date))) {
    const items = w.items.map((it) => `${qty(it)} ${EXERCISE_BY_ID[it.exerciseId]?.name_en ?? it.exerciseId}${it.loadKg ? ` @${it.loadKg}kg` : ''}`).join('; ');
    L.push(`- ${w.event_date} · ${w.title} · ${w.status}${w.rpe != null ? ` · RPE ${w.rpe}` : ''}${w.durationMin ? ` · ${w.durationMin} min` : ''} · origem ${w.source_type}${items ? ` — ${items}` : ' — sem detalhes'}${includeSensitive && w.notes ? ` — nota: ${w.notes}` : ''}`);
  }
  L.push('', '## Programação do box (prescrita; execução só quando indicada acima)');
  for (const w of prescribed.filter((x) => x.event_date >= addDays(today, -45)).sort((a, b) => a.event_date.localeCompare(b.event_date))) {
    const mv = [...new Set(w.blocks.flatMap((b) => b.movements.map((m) => (m.exerciseId ? EXERCISE_BY_ID[m.exerciseId]?.name_en : m.raw))))].join(', ');
    L.push(`- ${w.event_date} · ${w.title} · status execução: ${w.performed_status} · fonte: ${w.source_type} — ${mv}`);
  }
  L.push('', '## Equipamentos confirmados em casa');
  const conf = equipment.filter((e) => e.confirmed);
  L.push(conf.length ? conf.map((e) => `- ${e.label}${e.loadKg ? ` (${e.loadKg} kg)` : ''}`).join('\n') : '- nenhum confirmado ainda');
  if (includeSensitive && bodycomp.length) {
    L.push('', '## Composição corporal (bioimpedância doméstica — estimativa)');
    for (const m of bodycomp.slice(-8)) L.push(`- ${m.event_date}: ${m.weightKg ?? '—'} kg · gordura ${m.fatPct ?? '—'}% · músculo (balança) ${m.musclePct ?? '—'}% · visceral ${m.visceralLevel ?? '—'}`);
  }
  L.push('', '## Recomendações recentes do app');
  for (const r of recommendations.slice(-5)) L.push(`- ${r.event_date}: ${r.headline} (confiança ${Math.round(r.analysisConfidence * 100)}%)`);
  if (!includeSensitive) L.push('', '_Dados de saúde sensíveis omitidos (consentimento desativado)._');
  return L.join('\n');
}
