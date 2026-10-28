import { normalizeText } from '../lib/util';
import { EXERCISES } from './exercises';
import type { WodBlockParsed } from './schemas';

/**
 * Extração de WOD a partir de texto (OCR de print, texto colado, TXT/PDF convertido).
 * Heurístico e SEMPRE seguido de revisão humana: campos incertos vão para `uncertainFields`.
 * O texto importado é tratado como dado — nunca como instrução para o app.
 */

export interface DateCandidate { iso: string; raw: string; confidence: number }

export interface ParsedWod {
  dateCandidates: DateCandidate[];
  title: string;
  titleConfidence: number;
  blocks: WodBlockParsed[];
  uncertainFields: string[];
  rawText: string;
}

const PT_MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6,
  jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
};
const EN_MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Sem ano explícito: escolhe o ano que deixa a data mais próxima (e preferencialmente não futura) da referência. */
function inferYear(m: number, d: number, ref: string): number {
  const [ry] = ref.split('-').map(Number);
  const cands = [ry - 1, ry, ry + 1].filter((y) => validDate(y, m, d));
  const refT = new Date(`${ref}T12:00:00`).getTime();
  return cands.sort((a, b) => {
    const da = new Date(a, m - 1, d).getTime() - refT;
    const dbb = new Date(b, m - 1, d).getTime() - refT;
    const pa = da > 7 * 86400000 ? 1e13 : 0;
    const pb = dbb > 7 * 86400000 ? 1e13 : 0;
    return Math.abs(da) + pa - (Math.abs(dbb) + pb);
  })[0] ?? ry;
}

export function extractDates(text: string, ref: string): DateCandidate[] {
  const out: DateCandidate[] = [];
  const t = normalizeText(text);
  const push = (y: number, m: number, d: number, raw: string, confidence: number) => {
    if (!validDate(y, m, d)) return;
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const ex = out.find((o) => o.iso === iso);
    if (ex) ex.confidence = Math.max(ex.confidence, confidence);
    else out.push({ iso, raw, confidence });
  };
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const y = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    push(y, Number(m[2]), Number(m[1]), m[0], 0.9);
  }
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(Number(m[1]), Number(m[2]), Number(m[3]), m[0], 0.95);
  for (const m of t.matchAll(/(?<![\d/.-])(\d{1,2})\/(\d{1,2})(?![\d/])/g)) {
    const d = Number(m[1]); const mo = Number(m[2]);
    if (validDate(2000, mo, d)) push(inferYear(mo, d, ref), mo, d, m[0], 0.7);
  }
  for (const m of t.matchAll(/\b(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})\.?(?:\s+(?:de\s+)?(\d{4}))?/g)) {
    const mo = PT_MONTHS[m[2]] ?? EN_MONTHS[m[2]];
    if (!mo) continue;
    const d = Number(m[1]);
    push(m[3] ? Number(m[3]) : inferYear(mo, d, ref), mo, d, m[0], m[3] ? 0.9 : 0.75);
  }
  for (const m of t.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/g)) {
    const mo = EN_MONTHS[m[1]] ?? PT_MONTHS[m[1]];
    if (!mo) continue;
    const d = Number(m[2]);
    push(m[3] ? Number(m[3]) : inferYear(mo, d, ref), mo, d, m[0], m[3] ? 0.9 : 0.7);
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

// ───────────── Movimentos ─────────────

interface SynEntry { syn: string; id: string; re: RegExp }
const SYN_INDEX: SynEntry[] = EXERCISES.flatMap((ex) =>
  [ex.name_en, ex.name_pt, ...ex.synonyms].map((s) => normalizeText(s)).filter(Boolean).map((syn) => ({
    syn, id: ex.id, re: new RegExp(`(^|[^a-z])${syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?($|[^a-z])`),
  })),
).sort((a, b) => b.syn.length - a.syn.length);

export function matchMovement(line: string): { id: string; syn: string } | null {
  const n = normalizeText(line);
  for (const e of SYN_INDEX) if (e.re.test(n)) return { id: e.id, syn: e.syn };
  return null;
}

const BLOCK_KEYWORDS: Array<[WodBlockParsed['kind'], RegExp]> = [
  ['warmup', /^(warm[\s-]?up|aquecimento|aquec)\b/],
  ['skill', /^(skill|tecnica|habilidade|gymnastics skill)\b/],
  ['strength', /^(strength|forca|lpo|weightlifting|levantamento|heavy)\b/],
  ['metcon', /^(wod|metcon|conditioning|condicionamento|treino do dia)\b/],
  ['accessory', /^(accessory|accessories|acessorio|acessorios|finisher|core work|core)\b/],
  ['cooldown', /^(cool[\s-]?down|volta a calma|alongamento|mobility|mobilidade)\b/],
];

const FORMAT_RE = /\b(amrap\s*\d*|emom\s*\d*|e\d+mom|for time|tabata|\d+\s*rounds?|\d+\s*rft|every\s+\d+[:.]?\d*|chipper|\d+(?:-\d+){2,})\b/;

function parseMovementLine(raw: string): WodBlockParsed['movements'][number] | null {
  const n = normalizeText(raw);
  if (!n || n.length < 3) return null;
  const mv = matchMovement(raw);
  const repsM = n.match(/^(\d{1,3})\s*(?:x\s*)?(?=[a-z])/) ?? n.match(/\b(\d{1,3})\s*(?:reps?|repeticoes)\b/);
  const setsReps = n.match(/\b(\d{1,2})\s*x\s*(\d{1,3})\b/);
  const meters = n.match(/\b(\d{2,5})\s*m\b/);
  const cals = n.match(/\b(\d{1,3})\s*(?:cal|cals|calorias)\b/);
  const load = raw.match(/(\d{1,3}(?:[.,]\d)?\s*\/\s*\d{1,3}(?:[.,]\d)?\s*(?:kg|lb|lbs)?|@?\s*\d{1,3}(?:[.,]\d)?\s*(?:kg|lb|lbs)|\d{2,3}\s*%)/i);
  if (!mv) {
    // Linha com números + palavras pode ser um movimento não reconhecido: vai para revisão.
    if (/[a-z]{4,}/.test(n) && /\d/.test(n) && !FORMAT_RE.test(n)) return { exerciseId: null, raw: raw.trim(), confidence: 0.2 };
    return null;
  }
  const reps = setsReps ? Number(setsReps[2]) : repsM ? Number(repsM[1]) : undefined;
  return {
    exerciseId: mv.id, raw: raw.trim(), reps, loadText: load?.[0]?.trim(),
    distanceM: meters ? Number(meters[1]) : undefined, calories: cals ? Number(cals[1]) : undefined,
    confidence: reps || meters || cals ? 0.85 : 0.65,
  };
}

function guessTitle(lines: string[]): { title: string; confidence: number } {
  let best = { title: '', confidence: 0, score: -Infinity };
  let afterDate = false;
  for (const l of lines.slice(0, 10)) {
    const n = normalizeText(l);
    const isDate = /\d{1,2}[/.-]\d{1,2}/.test(n) || /^(seg|ter|qua|qui|sex|sab|dom|mon|tue|wed|thu|fri|sat|sun)/.test(n);
    if (isDate) { afterDate = true; continue; }
    if (!n || n.length < 3 || n.length > 40) continue;
    if (BLOCK_KEYWORDS.some(([, re]) => re.test(n)) || FORMAT_RE.test(n) || matchMovement(l)) continue;
    const letters = n.replace(/[^a-z]/g, '').length;
    if (letters / n.length < 0.6) continue;
    const trimmed = l.trim();
    let score = 0;
    if (trimmed === trimmed.toUpperCase()) score += 0.3;
    if (afterDate) score += 0.3;
    if (/["“”]/.test(trimmed)) score += 0.2;
    // Nome do box/app costuma aparecer no topo: não é o título do WOD.
    if (/\b(crossfit|box|academia|gym|app|wodify|sugarwod)\b/.test(n)) score -= 0.8;
    if (score > best.score) best = { title: trimmed.replace(/^["“”']|["“”']$/g, ''), confidence: Math.min(0.8, 0.45 + Math.max(0, score) / 2), score };
  }
  return { title: best.title, confidence: best.title ? best.confidence : 0 };
}

export function parseWodText(text: string, ref: string): ParsedWod {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const dateCandidates = extractDates(text, ref);
  const { title, confidence: titleConfidence } = guessTitle(lines);
  const blocks: WodBlockParsed[] = [];
  let cur: WodBlockParsed = { kind: 'unknown', title: 'Sem seção', text: '', movements: [] };
  const flush = () => { if (cur.text.trim() || cur.movements.length) blocks.push(cur); };
  for (const line of lines) {
    const n = normalizeText(line);
    const heading = BLOCK_KEYWORDS.find(([, re]) => re.test(n));
    if (heading && n.length <= 40) {
      flush();
      cur = { kind: heading[0], title: line, text: '', movements: [] };
      const fm = n.match(FORMAT_RE);
      if (fm) cur.format = fm[0];
      // Cabeçalho na mesma linha do conteúdo (ex.: "Core: 3x20 sit-ups").
      const inline = parseMovementLine(line);
      if (inline?.exerciseId) { cur.movements.push(inline); cur.text += `${line}\n`; }
      continue;
    }
    const fm = n.match(FORMAT_RE);
    if (fm && !cur.format) cur.format = fm[0];
    if (fm && cur.kind === 'unknown') cur.kind = 'metcon';
    cur.text += `${line}\n`;
    const mv = parseMovementLine(line);
    if (mv) cur.movements.push(mv);
  }
  flush();

  const uncertainFields: string[] = [];
  if (!dateCandidates.length) uncertainFields.push('date');
  else if (dateCandidates[0].confidence < 0.8 || (dateCandidates.length > 1 && dateCandidates[1].iso !== dateCandidates[0].iso)) uncertainFields.push('date');
  if (titleConfidence < 0.6) uncertainFields.push('title');
  blocks.forEach((b, i) => {
    if (b.kind === 'unknown') uncertainFields.push(`blocks.${i}.kind`);
    b.movements.forEach((m, j) => { if (m.confidence < 0.6) uncertainFields.push(`blocks.${i}.movements.${j}`); });
  });
  return { dateCandidates, title, titleConfidence, blocks, uncertainFields, rawText: text };
}

export function movementIdsOf(blocks: WodBlockParsed[]): string[] {
  return [...new Set(blocks.flatMap((b) => b.movements.map((m) => m.exerciseId).filter((x): x is string => !!x)))];
}
