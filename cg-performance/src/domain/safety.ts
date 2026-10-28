import type { Exercise } from './exercises';
import { SYMPTOMS, type PainEntry, type SymptomKey } from './schemas';
import { minIntensity, type Intensity, type Joint } from './taxonomy';

/**
 * Regras de segurança (spec §5.5). São aplicadas DEPOIS das escolhas do usuário e não podem ser
 * sobrescritas por opção de UI, preferência ou texto livre.
 * Heurísticas conservadoras de triagem — não são diagnóstico médico.
 */

export type SafetyLevel = 'ok' | 'caution' | 'stop' | 'urgent';

export interface SafetyAssessment {
  level: SafetyLevel;
  maxIntensity: Intensity;
  /** Articulações com dor: exercícios que as solicitam acima do limite são removidos. */
  blockedJoints: Partial<Record<Joint, number>>;
  messages: string[];
  /** Quando true, a opção A vira descanso/recuperação. */
  restRecommended: boolean;
  allowJumps: boolean;
}

export interface SafetyInput {
  symptoms: string[];
  pains: PainEntry[];
  energy: number;
  sleep: number;
}

export function assessSafety(input: SafetyInput): SafetyAssessment {
  const messages: string[] = [];
  let level: SafetyLevel = 'ok';
  let maxIntensity: Intensity = 'high';
  let restRecommended = false;
  let allowJumps = true;
  const raise = (l: SafetyLevel) => {
    const order: SafetyLevel[] = ['ok', 'caution', 'stop', 'urgent'];
    if (order.indexOf(l) > order.indexOf(level)) level = l;
  };

  const sym = input.symptoms.filter((s): s is SymptomKey => s in SYMPTOMS);
  const urgent = sym.filter((s) => SYMPTOMS[s].severity === 'urgent');
  const stop = sym.filter((s) => SYMPTOMS[s].severity === 'stop');
  const caution = sym.filter((s) => SYMPTOMS[s].severity === 'caution');

  if (urgent.length) {
    raise('urgent');
    maxIntensity = 'recovery';
    restRecommended = true;
    allowJumps = false;
    messages.push(
      `Você relatou: ${urgent.map((s) => SYMPTOMS[s].label.toLowerCase()).join(', ')}. Não treine hoje. ` +
      'Procure avaliação médica — se for intenso, súbito ou acompanhado de mal-estar, procure atendimento de urgência (SAMU 192).',
    );
  }
  if (stop.length) {
    raise('stop');
    maxIntensity = 'recovery';
    restRecommended = true;
    allowJumps = false;
    messages.push(
      `Sintomas sistêmicos (${stop.map((s) => SYMPTOMS[s].label.toLowerCase()).join(', ')}): hoje a recomendação é descanso. ` +
      'Retorne de forma progressiva após 24–48 h sem sintomas; se persistirem ou piorarem, procure avaliação médica.',
    );
  }
  if (caution.length && !urgent.length && !stop.length) {
    raise('caution');
    maxIntensity = minIntensity(maxIntensity, 'light');
    allowJumps = false;
    messages.push(
      `Sintomas leves (${caution.map((s) => SYMPTOMS[s].label.toLowerCase()).join(', ')}): intensidade limitada a leve, ` +
      'sem picos anaeróbicos. Pare se surgir febre, piora respiratória ou tontura.',
    );
  }

  if (input.sleep <= 3 || input.energy <= 3) {
    raise('caution');
    maxIntensity = minIntensity(maxIntensity, input.sleep <= 2 && input.energy <= 2 ? 'light' : 'moderate');
    messages.push('Sono/energia baixos hoje: limitei a intensidade. Volume moderado rende mais que forçar.');
  }

  const blockedJoints: SafetyAssessment['blockedJoints'] = {};
  for (const p of input.pains) {
    if (p.level <= 2 && !p.acute) continue;
    // Limite de exigência articular permitida: dor maior → menos carga sobre a articulação.
    const limit = p.acute || p.level >= 7 ? 0.15 : p.level >= 4 ? 0.35 : 0.55;
    blockedJoints[p.joint] = Math.min(blockedJoints[p.joint] ?? 1, limit);
    if (p.acute || p.level >= 7) {
      raise('stop');
      maxIntensity = minIntensity(maxIntensity, 'light');
      messages.push(`Dor ${p.acute ? 'aguda' : 'forte'} relatada (${p.level}/10): evitei movimentos que exigem essa articulação. Se a dor persistir, procure avaliação profissional.`);
    } else if (p.level >= 4) {
      raise('caution');
      messages.push(`Dor moderada (${p.level}/10): removi exercícios com exigência relevante dessa articulação.`);
    }
    if (['knee', 'ankle', 'hip', 'lumbar'].includes(p.joint) && p.level >= 4) allowJumps = false;
  }

  return { level, maxIntensity, blockedJoints, messages, restRecommended, allowJumps };
}

export function exerciseAllowedBySafety(ex: Exercise, s: SafetyAssessment): boolean {
  if (!s.allowJumps && (ex.jumps || ex.impact === 'high')) return false;
  for (const [j, limit] of Object.entries(s.blockedJoints)) {
    if ((ex.joints[j as Joint] ?? 0) > (limit ?? 1)) return false;
  }
  return true;
}
