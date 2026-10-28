import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOfficialWod, parseSchedule, robotsAllows, USER_AGENT, type ParsedOfficialEvent, type ParsedOfficialWod } from './officialAdapters';

/**
 * Backend mínimo: sincroniza fontes oficiais CrossFit (o navegador não pode ler crossfit.com por CORS),
 * guarda snapshots versionados e serve o build da PWA em produção. Sem segredos no cliente.
 */

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA_DIR = join(ROOT, 'server', 'data');
const STATE_FILE = join(DATA_DIR, 'official.json');
const PORT = Number(process.env.PORT ?? 8787);
const WOD_URL = process.env.CF_WOD_URL ?? 'https://www.crossfit.com/workout/';
const SCHEDULE_URLS = (process.env.CF_SCHEDULE_URLS ?? 'https://games.crossfit.com/open/schedule,https://games.crossfit.com/competitions').split(',');
const PROD = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const WOD_INTERVAL_H = 6;
const EVENTS_INTERVAL_H = 24 * 7;

interface SourceRun { last_checked_at?: string; last_success_at?: string; last_error?: string; robots?: 'allowed' | 'disallowed' | 'unknown' }
interface WodSnapshot extends ParsedOfficialWod { checksum: string; fetched_at: string; version: number; history: Array<{ checksum: string; text: string; seen_at: string }> }
interface EventSnapshot extends ParsedOfficialEvent { checksum: string; fetched_at: string; version: number; history: Array<{ checksum: string; start_date: string; end_date?: string; seen_at: string }> }
interface State { sources: Record<string, SourceRun>; wods: WodSnapshot[]; events: EventSnapshot[]; last_wod_sync?: string; last_events_sync?: string }

function load(): State {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return { sources: {}, wods: [], events: [] }; }
}
function save(s: State) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

const robotsCache = new Map<string, { txt: string; at: number }>();
async function allowed(url: string): Promise<'allowed' | 'disallowed' | 'unknown'> {
  const u = new URL(url);
  let entry = robotsCache.get(u.origin);
  if (!entry || Date.now() - entry.at > 86_400_000) {
    try { entry = { txt: await fetchText(`${u.origin}/robots.txt`), at: Date.now() }; } catch { return 'unknown'; }
    robotsCache.set(u.origin, entry);
  }
  return robotsAllows(entry.txt, u.pathname) ? 'allowed' : 'disallowed';
}

async function runSource(state: State, id: string, url: string, fn: (html: string) => void) {
  const run: SourceRun = state.sources[id] ?? {};
  run.last_checked_at = new Date().toISOString();
  try {
    run.robots = await allowed(url);
    // Sem robots.txt acessível não sincronizamos (postura conservadora).
    if (run.robots !== 'allowed') throw new Error(run.robots === 'disallowed' ? 'robots.txt não permite este caminho' : 'robots.txt indisponível — sincronização não realizada');
    fn(await fetchText(url));
    run.last_success_at = run.last_checked_at;
    run.last_error = undefined;
  } catch (e) {
    run.last_error = (e as Error).message || String(e);
  }
  state.sources[id] = run;
}

export async function syncWod(state: State) {
  await runSource(state, 'wod', WOD_URL, (html) => {
    const p = parseOfficialWod(html, WOD_URL);
    if (!p || !p.publication_date) throw new Error('WOD não reconhecido na página (estrutura mudou?) — use a consulta manual.');
    const checksum = sha(`${p.title}\n${p.text}`);
    const now = new Date().toISOString();
    const ex = state.wods.find((w) => w.publication_date === p.publication_date);
    if (!ex) state.wods.unshift({ ...p, checksum, fetched_at: now, version: 1, history: [] });
    else if (ex.checksum !== checksum) {
      ex.history.push({ checksum: ex.checksum, text: ex.text, seen_at: ex.fetched_at });
      Object.assign(ex, p, { checksum, fetched_at: now, version: ex.version + 1 });
    } else ex.fetched_at = now;
    state.wods = state.wods.slice(0, 60);
  });
  state.last_wod_sync = new Date().toISOString();
}

export async function syncEvents(state: State) {
  for (const url of SCHEDULE_URLS) {
    const id = url.includes('/open/') ? 'open_schedule' : 'competitions';
    await runSource(state, id, url, (html) => {
      const events = parseSchedule(html, url, id === 'open_schedule' ? 'open' : 'competition');
      if (!events.length) throw new Error('Nenhuma data reconhecida na página — use a consulta manual.');
      const now = new Date().toISOString();
      for (const e of events) {
        const checksum = sha(`${e.name}|${e.start_date}|${e.end_date ?? ''}|${e.status}`);
        const ex = state.events.find((x) => x.canonical_id === e.canonical_id);
        if (!ex) state.events.push({ ...e, checksum, fetched_at: now, version: 1, history: [] });
        else if (ex.checksum !== checksum) {
          ex.history.push({ checksum: ex.checksum, start_date: ex.start_date, end_date: ex.end_date, seen_at: ex.fetched_at });
          Object.assign(ex, e, { checksum, fetched_at: now, version: ex.version + 1 });
        } else ex.fetched_at = now;
      }
    });
  }
  state.last_events_sync = new Date().toISOString();
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const dist = join(ROOT, 'dist');
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = normalize(join(dist, urlPath));
  if (!file.startsWith(dist) || !existsSync(file) || urlPath === '/') file = join(dist, 'index.html');
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Build não encontrado. Rode `npm run build`.');
  }
}

let state = load();
let syncing: Promise<void> | null = null;

async function syncAll(force: boolean) {
  if (syncing) return syncing;
  syncing = (async () => {
    const h = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / 3_600_000 : Infinity);
    if (force || h(state.last_wod_sync) >= WOD_INTERVAL_H) await syncWod(state);
    if (force || h(state.last_events_sync) >= EVENTS_INTERVAL_H) await syncEvents(state);
    save(state);
  })().finally(() => { syncing = null; });
  return syncing;
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  if (path === '/api/health') return send(res, 200, { ok: true, at: new Date().toISOString() });
  if (path === '/api/official/state') return send(res, 200, state);
  if (path === '/api/official/sync' && req.method === 'POST') {
    await syncAll(true);
    return send(res, 200, state);
  }
  if (path.startsWith('/api/')) return send(res, 404, { error: 'not found' });
  if (PROD) return serveStatic(req, res);
  res.writeHead(404); res.end('Em desenvolvimento a PWA é servida pelo Vite (porta 5173).');
});

if (process.env.CG_NO_LISTEN !== '1') {
  server.listen(PORT, () => console.log(`[cg-performance] API em http://localhost:${PORT}`));
  // Agendador: checa a cada hora; WOD a cada 6 h, eventos semanalmente.
  void syncAll(false);
  setInterval(() => void syncAll(false), 3_600_000);
}

export { server, state };
