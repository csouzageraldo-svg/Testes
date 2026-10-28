import { db } from '../db/db';
import { upsertOfficialEvent, upsertOfficialWod } from '../db/repo';

/** Resposta do backend (`server/index.ts`). */
interface ServerState {
  sources: Record<string, { last_checked_at?: string; last_success_at?: string; last_error?: string; robots?: string }>;
  wods: Array<{ title: string; text: string; publication_date: string | null; source_url: string; method: string; confidence: number }>;
  events: Array<{ canonical_id: string; name: string; kind: string; start_date: string; end_date?: string; timezone: string; status: 'confirmed' | 'unverified'; source_url: string }>;
}

export interface SyncReport { ok: boolean; message: string; wods: Record<string, number>; events: Record<string, number> }

export async function syncOfficial(force = true): Promise<SyncReport> {
  const report: SyncReport = { ok: false, message: '', wods: {}, events: {} };
  let state: ServerState;
  try {
    const r = await fetch(force ? '/api/official/sync' : '/api/official/state', { method: force ? 'POST' : 'GET' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    state = await r.json();
  } catch (e) {
    const now = new Date().toISOString();
    for (const s of await db.officialSources.toArray()) if (s.sync_mode === 'auto') await db.officialSources.update(s.id, { last_checked_at: now, last_error: `Servidor de sincronização indisponível (${(e as Error).message}). Use a consulta manual.` });
    report.message = 'Servidor de sincronização indisponível — nada foi atualizado.';
    return report;
  }
  for (const [id, s] of Object.entries(state.sources)) {
    await db.officialSources.update(id, { last_checked_at: s.last_checked_at, last_success_at: s.last_success_at, last_error: s.last_error ?? undefined });
  }
  for (const w of state.wods) {
    if (!w.publication_date) continue;
    const r = await upsertOfficialWod({ publication_date: w.publication_date, title: w.title, text: w.text, source_url: w.source_url, verification: 'synced' });
    report.wods[r.status] = (report.wods[r.status] ?? 0) + 1;
  }
  for (const e of state.events) {
    const r = await upsertOfficialEvent({ ...e, location: undefined, division: undefined });
    report.events[r] = (report.events[r] ?? 0) + 1;
  }
  const errors = Object.values(state.sources).filter((s) => s.last_error).length;
  report.ok = errors === 0;
  report.message = errors ? `${errors} fonte(s) com erro — veja detalhes abaixo.` : 'Fontes sincronizadas.';
  return report;
}
