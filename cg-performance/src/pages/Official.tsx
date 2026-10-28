import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, Notice, Page } from '../components/ui';
import { db } from '../db/db';
import { upsertOfficialEvent, upsertOfficialWod } from '../db/repo';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { movementIdsOf, parseWodText } from '../domain/wodParser';
import { syncOfficial } from '../lib/officialClient';
import { formatDateBR, localDate } from '../lib/util';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

export default function Official() {
  const today = localDate();
  const sources = useLiveQuery(() => db.officialSources.toArray(), []) ?? [];
  const wods = useLiveQuery(() => db.officialWods.orderBy('publication_date').reverse().toArray(), []) ?? [];
  const events = useLiveQuery(() => db.officialEvents.orderBy('start_date').toArray(), []) ?? [];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mw, setMw] = useState({ date: today, title: '', text: '', url: 'https://www.crossfit.com/workout/' });
  const [me, setMe] = useState({ name: '', start: '', end: '', url: 'https://games.crossfit.com/open/schedule' });

  const latest = wods[0];
  const upcoming = events.filter((e) => (e.end_date ?? e.start_date) >= today);
  const past = events.filter((e) => (e.end_date ?? e.start_date) < today);

  return (
    <Page title="Fontes oficiais CrossFit" subtitle="Consulta e atualização com fonte, data e estado de verificação. App não oficial e não afiliado à CrossFit." back="/mais">
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={async () => { setBusy(true); const r = await syncOfficial(true); setMsg(`${r.message} WODs: ${JSON.stringify(r.wods)} · eventos: ${JSON.stringify(r.events)}`); setBusy(false); }} data-testid="sync">{busy ? 'Sincronizando…' : 'Sincronizar agora'}</button>
      </div>
      {msg && <Notice tone={msg.includes('indisponível') || msg.includes('erro') ? 'warn' : 'info'}>{msg}</Notice>}

      <Card title="WOD oficial publicado">
        {latest ? (
          <div data-testid="official-wod">
            <div className="flex flex-wrap items-center gap-2"><b className="text-bone-50">{latest.title}</b><span className="badge bg-ink-700 text-bone-300">{formatDateBR(latest.publication_date)}</span>
              <span className={`badge ${latest.verification === 'synced' ? 'bg-petrol-500/20 text-petrol-300' : 'bg-warn/15 text-warn'}`}>{latest.verification === 'synced' ? 'sincronizado' : 'inserido manualmente'}</span>{latest.version > 1 && <span className="badge bg-sky-400/20 text-sky-400">alterado (v{latest.version})</span>}</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-ink-850 p-3 text-sm text-bone-200">{latest.text}</pre>
            <div className="mt-1 text-xs text-bone-400">Fonte: <a className="text-petrol-300" href={latest.source_url} target="_blank" rel="noreferrer">{latest.source_url}</a> · checado {fmt(latest.last_checked_at)} · {latest.attribution}</div>
            <div className="mt-1 text-xs text-bone-400">Movimentos reconhecidos: {movementIdsOf(parseWodText(latest.text, today).blocks).map((id) => EXERCISE_BY_ID[id]?.name_pt).join(', ') || '—'}</div>
            <Link to={`/treinar?inspirar=${latest.id}`} className="btn-secondary mt-3 w-full" data-testid="inspire">Inspirar treino de hoje neste WOD</Link>
            <p className="mt-1 text-center text-[11px] text-bone-400">Gera uma adaptação própria do CG Performance (scaling e equipamentos), não a programação oficial.</p>
            {latest.history.length > 0 && <details className="mt-2 text-xs text-bone-400"><summary>Versões anteriores ({latest.history.length})</summary>{latest.history.map((h, i) => <pre key={i} className="mt-1 whitespace-pre-wrap">{fmt(h.seen_at)}: {h.text}</pre>)}</details>}
          </div>
        ) : (
          <Empty>Nenhum WOD oficial sincronizado. Se o acesso automático falhar, abra <a className="text-petrol-300" href="https://www.crossfit.com/workout/" target="_blank" rel="noreferrer">crossfit.com/workout</a> e registre abaixo.</Empty>
        )}
        {wods.length > 1 && <details className="mt-2 text-xs text-bone-400"><summary>Arquivo local ({wods.length})</summary>{wods.slice(1).map((w) => <div key={w.id}>{formatDateBR(w.publication_date)} — {w.title}</div>)}</details>}
      </Card>

      <Card title="Próximos eventos oficiais">
        {upcoming.length ? upcoming.map((e) => (
          <div key={e.id} className="border-b border-ink-700 py-2 text-sm last:border-0" data-testid="official-event">
            <div className="flex flex-wrap items-center gap-2"><b className="text-bone-50">{e.name}</b>
              <span className={`badge ${e.status === 'confirmed' ? 'bg-petrol-500/20 text-petrol-300' : e.status === 'changed' ? 'bg-sky-400/20 text-sky-400' : e.status === 'cancelled' ? 'bg-danger/20 text-danger' : 'bg-warn/15 text-warn'}`}>{e.status === 'confirmed' ? 'confirmado' : e.status === 'changed' ? 'alterado' : e.status === 'cancelled' ? 'cancelado' : 'não verificado'}</span></div>
            <div className="text-xs text-bone-400">{formatDateBR(e.start_date)}{e.end_date ? ` → ${formatDateBR(e.end_date)}` : ''} · fuso: {e.timezone} · checado {fmt(e.last_checked_at)}</div>
            <a className="break-all text-xs text-petrol-300" href={e.source_url} target="_blank" rel="noreferrer">{e.source_url}</a>
            {e.history.length > 0 && <div className="text-xs text-sky-400">Antes: {e.history.map((h) => `${formatDateBR(h.start_date)} (${h.note ?? 'alteração'})`).join('; ')}</div>}
          </div>
        )) : <Empty>Nenhum evento futuro verificado. Datas mudam a cada temporada — o app não reutiliza datas antigas.</Empty>}
        {past.length > 0 && <details className="mt-2 text-xs text-bone-400"><summary>Snapshots passados ({past.length})</summary>{past.map((e) => <div key={e.id}>{formatDateBR(e.start_date)} — {e.name}</div>)}</details>}
      </Card>

      <Card title="Estado das fontes">
        {sources.map((s) => (
          <div key={s.id} className="border-b border-ink-700 py-2 text-sm last:border-0" data-testid="source-row">
            <div className="flex items-center justify-between gap-2"><a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-bone-50 underline decoration-ink-600">{s.name} ↗</a>
              <span className={`badge ${s.sync_mode === 'auto' ? (s.last_success_at ? 'bg-petrol-500/20 text-petrol-300' : 'bg-warn/15 text-warn') : 'bg-ink-700 text-bone-300'}`}>{s.sync_mode === 'auto' ? (s.last_success_at ? 'sincronizado' : 'não sincronizado') : 'consulta por link'}</span></div>
            <div className="text-xs text-bone-400">{s.terms_status}</div>
            {s.sync_mode === 'auto' && <div className="text-xs text-bone-400">Última checagem: {fmt(s.last_checked_at)} · último sucesso: {fmt(s.last_success_at)}</div>}
            {s.last_error && <div className="text-xs text-warn">{s.last_error}</div>}
          </div>
        ))}
      </Card>

      <Card title="Registro manual (fallback)">
        <div className="text-xs text-bone-400">Copie da página oficial somente o necessário para seu uso pessoal e mantenha a URL de origem.</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className="input" type="date" value={mw.date} onChange={(e) => setMw({ ...mw, date: e.target.value })} aria-label="Data do WOD" />
          <input className="input" placeholder="Título" value={mw.title} onChange={(e) => setMw({ ...mw, title: e.target.value })} />
        </div>
        <textarea className="input mt-2" rows={4} placeholder="Texto do WOD oficial" value={mw.text} onChange={(e) => setMw({ ...mw, text: e.target.value })} data-testid="manual-wod-text" />
        <input className="input mt-2" placeholder="URL da fonte" value={mw.url} onChange={(e) => setMw({ ...mw, url: e.target.value })} />
        <button className="btn-secondary mt-2 w-full" disabled={!mw.text.trim() || !mw.url.startsWith('https://')} onClick={async () => { const r = await upsertOfficialWod({ publication_date: mw.date, title: mw.title || `WOD ${formatDateBR(mw.date)}`, text: mw.text.trim(), source_url: mw.url, verification: 'manual' }); setMsg(`WOD oficial ${r.status === 'created' ? 'registrado' : r.status === 'updated' ? 'atualizado (versão anterior preservada)' : 'sem alterações'}.`); }} data-testid="save-manual-wod">Salvar WOD oficial (manual)</button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <input className="input col-span-2" placeholder="Evento (ex.: CrossFit Open 2027 — 27.1)" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} />
          <input className="input" type="date" value={me.start} onChange={(e) => setMe({ ...me, start: e.target.value })} aria-label="Início" />
          <input className="input" type="date" value={me.end} onChange={(e) => setMe({ ...me, end: e.target.value })} aria-label="Fim" />
          <input className="input col-span-2" placeholder="URL de confirmação" value={me.url} onChange={(e) => setMe({ ...me, url: e.target.value })} />
        </div>
        <button className="btn-secondary mt-2 w-full" disabled={!me.name || !me.start || !me.url.startsWith('https://')} onClick={async () => { await upsertOfficialEvent({ canonical_id: `manual:${me.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`, name: me.name, kind: 'manual', start_date: me.start, end_date: me.end || undefined, timezone: 'verificar na fonte', status: 'unverified', source_url: me.url, manual: true }); setMsg('Evento registrado como "não verificado" até a sincronização confirmar.'); }}>Salvar evento (manual)</button>
      </Card>
    </Page>
  );
}
