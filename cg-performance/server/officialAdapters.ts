/**
 * OfficialCrossFitSourceAdapter — leitura de páginas PÚBLICAS da CrossFit (spec §7).
 * Regras: respeitar robots.txt, sem login/paywall/anti-bot, sem copiar vídeos ou conteúdo em massa.
 * Guarda apenas o texto do WOD do dia e datas de eventos, com URL, timestamp, checksum e atribuição.
 * Os parsers são heurísticos e independentes de estrutura fixa de URL/HTML: quando nada confiável é
 * encontrado, retornam null e o app mostra "não sincronizado" + acesso manual (nunca inventa dados).
 */

export const USER_AGENT = 'CG-Performance/0.1 (uso pessoal, nao comercial; respeita robots.txt)';

export interface ParsedOfficialWod {
  title: string;
  text: string;
  publication_date: string | null;
  source_url: string;
  method: 'next_data' | 'json_ld' | 'html_text';
  confidence: number;
}

export interface ParsedOfficialEvent {
  canonical_id: string;
  name: string;
  kind: string;
  start_date: string;
  end_date?: string;
  timezone: string;
  status: 'confirmed' | 'unverified';
  source_url: string;
  evidence: string;
}

// ───────────── robots.txt ─────────────

export function robotsAllows(robotsTxt: string, path: string, agent = 'cg-performance'): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if (cur && (key === 'allow' || key === 'disallow')) {
      cur.rules.push({ allow: key === 'allow', path: val });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)));
  const group = specific ?? groups.find((g) => g.agents.includes('*'));
  if (!group) return true;
  let best: { allow: boolean; len: number } = { allow: true, len: -1 };
  for (const r of group.rules) {
    if (!r.path) continue;
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && r.path.length > best.len) best = { allow: r.allow, len: r.path.length };
  }
  return best.allow;
}

// ───────────── utilidades de HTML ─────────────

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&ndash;|&mdash;/g, '-')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

const WOD_TOKENS = /\b(for time|rounds?|amrap|emom|reps?|pull-ups?|push-ups?|squats?|deadlifts?|thrusters?|burpees?|run|row|clean|snatch|jerk|lunges?|sit-ups?|double-unders?|wall-ball|kettlebell|handstand|muscle-ups?|toes-to-bar|rest)\b/gi;

function wodScore(s: string): number {
  return (s.match(WOD_TOKENS) ?? []).length + (/\d/.test(s) ? 1 : 0);
}

/** Títulos de WOD do crossfit.com costumam trazer a data como AAMMDD (ex.: "Wednesday 261028"). */
export function dateFromYYMMDD(s: string): string | null {
  const m = s.match(/\b(\d{2})(\d{2})(\d{2})\b/);
  if (!m) return null;
  const [y, mo, d] = [2000 + Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isoFrom(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function walk(obj: unknown, visit: (key: string, value: unknown, parent: Record<string, unknown>) => void, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 40) return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    visit(k, v, obj as Record<string, unknown>);
    walk(v, visit, depth + 1);
  }
}

export function parseOfficialWod(html: string, url: string): ParsedOfficialWod | null {
  // 1) Next.js __NEXT_DATA__: procura o objeto com o texto mais "WOD-like".
  const nd = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nd) {
    try {
      const data = JSON.parse(nd[1]);
      let best: { text: string; parent: Record<string, unknown>; score: number } | null = null;
      walk(data, (k, v, parent) => {
        if (typeof v !== 'string' || v.length < 30 || v.length > 4000) return;
        if (!/wod|workout|content|body|description|text/i.test(k)) return;
        const text = /<[a-z]/i.test(v) ? htmlToText(v) : v;
        const score = wodScore(text);
        if (score >= 3 && (!best || score > best.score)) best = { text, parent, score };
      });
      if (best) {
        const b = best as { text: string; parent: Record<string, unknown>; score: number };
        const title = String(b.parent.title ?? b.parent.name ?? b.parent.headline ?? '').trim();
        const date = isoFrom(b.parent.publishingDate ?? b.parent.publishedAt ?? b.parent.date ?? b.parent.datePublished) ?? dateFromYYMMDD(title);
        return { title: title || 'WOD', text: b.text.trim(), publication_date: date, source_url: url, method: 'next_data', confidence: date ? 0.85 : 0.6 };
      }
    } catch { /* segue para próximos métodos */ }
  }
  // 2) JSON-LD (Article/BlogPosting).
  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      const arr = Array.isArray(data) ? data : [data];
      for (const d of arr) {
        const body = typeof d.articleBody === 'string' ? d.articleBody : typeof d.description === 'string' ? d.description : '';
        if (wodScore(body) >= 3) {
          const title = String(d.headline ?? d.name ?? 'WOD');
          return { title, text: htmlToText(body), publication_date: isoFrom(d.datePublished) ?? dateFromYYMMDD(title), source_url: url, method: 'json_ld', confidence: 0.8 };
        }
      }
    } catch { /* ignora */ }
  }
  // 3) Texto visível: maior parágrafo com cara de WOD + título da página.
  // Prefere o conteúdo principal (<article>/<main>) para fugir de menus e rodapés.
  const main = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const text = htmlToText(main);
  // Agrupa apenas linhas consecutivas com cara de WOD.
  const paragraphs = text.split(/\n+/).reduce<string[]>((acc, line) => {
    const prev = acc[acc.length - 1];
    if (!prev || wodScore(line) === 0 || wodScore(prev.split('\n').pop() ?? '') === 0) acc.push(line); else acc[acc.length - 1] += `\n${line}`;
    return acc;
  }, []);
  const best = paragraphs.map((p) => ({ p, s: wodScore(p) })).sort((a, b) => b.s - a.s)[0];
  if (!best || best.s < 4) return null;
  const title = (html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+)<\/title>/)?.[1] ?? 'WOD').trim();
  const timeAttr = html.match(/<time[^>]+datetime="([^"]+)"/)?.[1];
  return { title, text: best.p.trim(), publication_date: isoFrom(timeAttr) ?? dateFromYYMMDD(title), source_url: url, method: 'html_text', confidence: 0.55 };
}

// ───────────── Calendário ─────────────

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const EVENT_WORDS = /(open|quarterfinals?|semifinals?|games|masters|adaptive|teen|community cup|workout \d{2}\.\d|announcement|registration|leaderboard|in-affiliate|online)/i;

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Extrai linhas com (palavra de evento + data) do texto de páginas de calendário oficiais.
 * Ano: o explícito na linha; senão o ano predominante na página. Sem ano confiável → `unverified`.
 */
export function parseSchedule(html: string, url: string, kindHint = 'open'): ParsedOfficialEvent[] {
  const text = htmlToText(html);
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  const freq = new Map<number, number>();
  years.forEach((y) => freq.set(y, (freq.get(y) ?? 0) + 1));
  const pageYear = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const out: ParsedOfficialEvent[] = [];
  const lines = text.split('\n');
  const dateRe = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(20\d{2}))?(?:\s*[-–to]+\s*(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+)?(\d{1,2})(?:,?\s+(20\d{2}))?)?/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(dateRe);
    if (!m) continue;
    const context = [lines[i - 1] ?? '', line, lines[i + 1] ?? ''].join(' ');
    const ev = context.match(EVENT_WORDS);
    if (!ev) continue;
    const mo = MONTHS[m[1].toLowerCase().replace('.', '')];
    const year = m[3] ? Number(m[3]) : pageYear;
    if (!mo || !year) continue;
    const start = iso(year, mo, Number(m[2]));
    let end: string | undefined;
    if (m[5]) {
      const mo2 = m[4] ? MONTHS[m[4].toLowerCase()] : mo;
      const y2 = m[6] ? Number(m[6]) : mo2 < mo ? year + 1 : year;
      end = iso(y2, mo2, Number(m[5]));
    }
    const nameSource = EVENT_WORDS.test(line) ? line : `${lines[i - 1] ?? ''} ${line}`;
    const name = nameSource.replace(dateRe, '').replace(/\s+/g, ' ').replace(/[:\-–|]+\s*$/, '').trim().slice(0, 90) || ev[0];
    const canonical_id = `${kindHint}:${name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}:${year}`;
    if (out.some((o) => o.canonical_id === canonical_id)) continue;
    out.push({
      canonical_id, name, kind: ev[0].toLowerCase(), start_date: start, end_date: end, timezone: 'conforme fonte (verificar fuso na página)',
      status: m[3] ? 'confirmed' : 'unverified', source_url: url, evidence: line.slice(0, 160),
    });
  }
  return out;
}
