import type { PrescribedWorkout, WorkoutSourceRef } from '../db/types';
import { normalizeText } from '../lib/util';
import type { WodBlockParsed } from './schemas';
import { movementIdsOf } from './wodParser';

/** Similaridade de Dice por bigramas (0–1) — robusta a pequenos erros de OCR no título. */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeText(a).replace(/\s/g, '');
  const y = normalizeText(b).replace(/\s/g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const bx = bigrams(x);
  const by = bigrams(y);
  let inter = 0;
  for (const [k, v] of bx) inter += Math.min(v, by.get(k) ?? 0);
  return (2 * inter) / (x.length - 1 + (y.length - 1));
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const v of A) if (B.has(v)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface DuplicateMatch {
  workout: PrescribedWorkout;
  score: number;
  reason: string;
}

/**
 * Mesmo dia + título parecido OU mesmos movimentos ⇒ mesmo WOD (ex.: dois prints do mesmo treino,
 * ou um print que confirma um item do índice-semente).
 */
export function findDuplicate(
  cand: { event_date: string; title: string; blocks: WodBlockParsed[] },
  existing: PrescribedWorkout[],
): DuplicateMatch | null {
  const ids = movementIdsOf(cand.blocks);
  let best: DuplicateMatch | null = null;
  for (const w of existing) {
    if (w.event_date !== cand.event_date) continue;
    const ts = titleSimilarity(cand.title, w.title);
    const js = jaccard(ids, movementIdsOf(w.blocks));
    const score = Math.max(ts, js);
    if (ts >= 0.75 || js >= 0.5 || (ts >= 0.5 && js >= 0.3)) {
      const reason = ts >= js ? `título semelhante (${Math.round(ts * 100)}%)` : `movimentos em comum (${Math.round(js * 100)}%)`;
      if (!best || score > best.score) best = { workout: w, score, reason };
    }
  }
  return best;
}

const SOURCE_RANK: Record<string, number> = {
  chat_summary_index: 1, image_ocr_unreviewed: 2, seed: 2, csv_import: 3, json_import: 3, user_manual_entry: 4, image_ocr_reviewed: 5,
};

/** Merge sem perder fontes: une as referências e completa blocos; prefere dados revisados. */
export function mergePrescribed(
  base: PrescribedWorkout,
  incoming: { title: string; blocks: WodBlockParsed[]; rawText: string; source: WorkoutSourceRef; uncertainFields: string[]; confidence: number },
): PrescribedWorkout {
  const incomingBetter = (SOURCE_RANK[incoming.source.source_type] ?? 0) > (SOURCE_RANK[base.source_type] ?? 0);
  const blocks = [...base.blocks];
  for (const nb of incoming.blocks) {
    const i = blocks.findIndex((b) => b.kind === nb.kind && nb.kind !== 'unknown');
    if (i < 0) blocks.push(nb);
    else if (incomingBetter || nb.movements.length > blocks[i].movements.length) blocks[i] = nb;
  }
  const sources = [...base.sources];
  if (!sources.some((s) => (s.hash && s.hash === incoming.source.hash) || (s.assetId && s.assetId === incoming.source.assetId))) {
    sources.push(incoming.source);
  }
  return {
    ...base,
    title: incomingBetter && incoming.title ? incoming.title : base.title || incoming.title,
    blocks,
    rawText: [base.rawText, incoming.rawText].filter(Boolean).join('\n---\n'),
    sources,
    source_type: incomingBetter ? incoming.source.source_type : base.source_type,
    confidence: Math.max(base.confidence, incoming.confidence),
    verified_by_user: base.verified_by_user || incoming.source.source_type === 'image_ocr_reviewed' || incoming.source.source_type === 'user_manual_entry',
    uncertainFields: incomingBetter ? incoming.uncertainFields : base.uncertainFields,
    updated_at: new Date().toISOString(),
  };
}
