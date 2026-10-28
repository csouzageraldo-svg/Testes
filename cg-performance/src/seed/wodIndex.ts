import type { WodBlockParsed } from '../domain/schemas';

/**
 * Índice de referência dos WODs do box citados em conversas anteriores (spec §6, "Treinos-semente").
 * NÃO são dados definitivos nem resultados do atleta: entram como programação com
 * `source_type = chat_summary_index`, confiança baixa e `performed_status = unknown`.
 * Ao importar o print original da mesma data, a deduplicação funde e promove os dados revisados.
 */
interface IndexEntry { date: string; title: string; movements: Array<[string | null, string, number]> }

const E = (date: string, title: string, movements: IndexEntry['movements']): IndexEntry => ({ date, title, movements });

export const WOD_INDEX: IndexEntry[] = [
  E('2026-09-23', 'Wednesday Mood', [['deadlift', 'deadlift', 0.6], ['strict_hspu', 'strict HSPU', 0.6], [null, 'corda (pular ou escalar? validar no print)', 0.2]]),
  E('2026-09-28', 'Tommy Pickles', [['front_squat', 'front squat', 0.6], ['power_snatch', 'snatch', 0.5], [null, 'cardio (modalidade não informada)', 0.2], ['run', 'corrida', 0.6]]),
  E('2026-09-29', 'Iron Arms', [['bench_press', 'bench press', 0.6], [null, 'handstand (hold/walk? validar)', 0.2], [null, 'cardio (não informado)', 0.2], [null, 'core (não informado)', 0.2]]),
  E('2026-09-30', 'Phil and Lil', [['deadlift', 'deadlift', 0.6], ['kb_swing', 'kettlebell swing', 0.6], ['thruster', 'thruster', 0.6], ['burpee', 'burpees', 0.6]]),
  E('2026-10-05', 'The Victors', [['back_squat', 'back squat', 0.6], ['power_snatch', 'snatch', 0.5], ['lunge', 'lunges', 0.6], ['bulgarian_split_squat', 'split squat', 0.5]]),
  E('2026-10-06', 'Battle Cry', [['power_clean', 'clean', 0.5], ['wall_walk', 'wall walk', 0.6], ['double_under', 'double under', 0.6], ['row_erg', 'row', 0.5]]),
  E('2026-10-07', 'Texas Hot', [['deadlift', 'deadlift', 0.6], ['run', 'corrida', 0.6], ['toes_to_bar', 'toes-to-bar', 0.6], ['burpee', 'burpee', 0.6]]),
  E('2026-10-09', 'Minnesota / Kelly', [['run', 'corrida 400 m', 0.6], ['box_jump', 'box jump', 0.6], ['wall_ball', 'wall ball', 0.6]]),
  E('2026-10-14', 'Jailhouse Rock', [['deadlift', 'deadlift', 0.6], ['run', 'corrida', 0.6], ['power_snatch', 'snatch', 0.5], ['clean_and_jerk', 'clean and jerk', 0.6]]),
  E('2026-10-16', 'Viva Las Vegas', [['air_squat', 'squat (variação não informada)', 0.4], ['step_up', 'step overs', 0.5], ['bike', 'echo bike', 0.6], ['double_under', 'double under', 0.6]]),
  E('2026-10-20', 'Bugs Bunny', [['pull_up', 'pull-up/chin-up', 0.5], ['db_press', 'Z-press', 0.5], ['run', 'corrida', 0.6], ['power_snatch', 'snatch', 0.5], ['toes_to_bar', 'toes-to-bar', 0.6]]),
];

export function indexEntryBlocks(e: IndexEntry): WodBlockParsed[] {
  return [{
    kind: 'unknown', title: 'Movimentos citados (validar no print)', text: e.movements.map((m) => m[1]).join('\n'),
    movements: e.movements.map(([exerciseId, raw, confidence]) => ({ exerciseId, raw, confidence })),
  }];
}
