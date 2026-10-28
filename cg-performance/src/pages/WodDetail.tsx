import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Chips, ConfidenceBadge, Notice, Page, Slider, SourceBadge } from '../components/ui';
import { WodEditor, type WodDraft } from '../components/WodEditor';
import { db } from '../db/db';
import { audit, markBoxPerformed, updatePrescribed } from '../db/repo';
import type { PerformedWorkout } from '../db/types';
import { EXERCISE_BY_ID } from '../domain/exercises';
import type { PerformedItem } from '../domain/schemas';
import { formatDateBR } from '../lib/util';

function AssetThumb({ id }: { id: string }) {
  const asset = useLiveQuery(() => db.assets.get(id), [id]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!asset) return;
    const u = URL.createObjectURL(asset.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [asset]);
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={asset?.name} className="h-28 w-20 rounded-lg object-cover" /></a>;
}

export default function WodDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const w = useLiveQuery(() => db.prescribed.get(id), [id]);
  const performed = useLiveQuery(() => (w?.performedId ? db.performed.get(w.performedId) : undefined), [w?.performedId]);
  const revisions = useLiveQuery(() => db.revisions.where('entityId').equals(id).toArray(), [id]) ?? [];
  const [editing, setEditing] = useState<WodDraft | null>(null);
  const [logging, setLogging] = useState(false);
  const [status, setStatus] = useState<PerformedWorkout['status']>('completed');
  const [rpe, setRpe] = useState(7);
  const [duration, setDuration] = useState('');
  const [results, setResults] = useState<Record<string, { reps?: string; kg?: string }>>({});
  const [notes, setNotes] = useState('');

  if (!w) return <Page title="WOD" back="/historico"><p className="muted">Carregando…</p></Page>;
  const moves = w.blocks.flatMap((b) => b.movements.filter((m) => m.exerciseId));

  async function saveLog() {
    const items: PerformedItem[] = Object.entries(results)
      .filter(([, r]) => r.reps || r.kg)
      .map(([exerciseId, r]) => ({ exerciseId, reps: r.reps ? Number(r.reps) : undefined, loadKg: r.kg ? Number(r.kg) : undefined, completed: true }));
    await markBoxPerformed(w!.id, { status, items, rpe: status === 'not_done' ? undefined : rpe, durationMin: duration ? Number(duration) : undefined, notes: notes || undefined, pains: [] });
    setLogging(false);
  }

  return (
    <Page title={w.title} subtitle={`${formatDateBR(w.event_date)} · programação do box`} back="/historico">
      <div className="flex flex-wrap items-center gap-2"><SourceBadge source={w.source_type} /><ConfidenceBadge value={w.confidence} />{!w.verified_by_user && <span className="badge bg-warn/15 text-warn">não verificado</span>}</div>
      {w.source_type === 'chat_summary_index' && <Notice tone="warn">Este item veio de um resumo de conversa anterior. Importe o print original desta data para validar — a deduplicação vai fundir automaticamente.</Notice>}

      <Card title="Execução pessoal">
        {w.performed_status === 'unknown' && <p className="text-sm text-bone-300">Não sabemos se você fez este treino. Ele <b>não</b> conta na sua evolução até você registrar.</p>}
        {performed && (
          <div className="text-sm text-bone-300">
            <p>Registrado como <b>{performed.status === 'completed' ? 'concluído' : performed.status === 'partial' ? 'parcial' : 'não realizado'}</b>{performed.rpe != null && ` · RPE ${performed.rpe}`}{performed.durationMin && ` · ${performed.durationMin} min`}.</p>
            {performed.items.map((it, i) => <p key={i}>• {EXERCISE_BY_ID[it.exerciseId]?.name_pt}: {it.reps ?? '—'} reps{it.loadKg ? ` @ ${it.loadKg} kg` : ''}</p>)}
            {!performed.items.length && <p className="text-xs text-bone-400">Sem resultados detalhados: estímulo estimado pela prescrição com confiança baixa; nenhum PR é gerado.</p>}
          </div>
        )}
        {!logging ? (
          <div className="mt-3 flex gap-2">
            <button className="btn-primary flex-1" onClick={() => setLogging(true)} data-testid="log-performed">{w.performed_status === 'unknown' ? 'Realizei este treino' : 'Editar registro'}</button>
            {w.performed_status === 'unknown' && <button className="btn-secondary" onClick={() => markBoxPerformed(w.id, { status: 'not_done', items: [], pains: [] })}>Não fiz</button>}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <Chips options={[{ value: 'completed', label: 'Completo' }, { value: 'partial', label: 'Parcial/escalado' }, { value: 'not_done', label: 'Não fiz' }]} value={status} onChange={(v) => setStatus(v as PerformedWorkout['status'])} />
            {status !== 'not_done' && <>
              <Slider label="RPE" value={rpe} onChange={setRpe} />
              <label><span className="label">Duração (min)</span><input className="input" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
              <div className="text-xs text-bone-400">Resultados reais (opcional). Deixe vazio o que não lembra — não usamos a carga prescrita.</div>
              {moves.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px_70px] items-center gap-2 text-sm">
                  <span>{EXERCISE_BY_ID[m.exerciseId!]?.name_pt}{m.loadText && <span className="text-xs text-bone-400"> (prescr. {m.loadText})</span>}</span>
                  <input className="input py-1.5" placeholder="reps" type="number" value={results[m.exerciseId!]?.reps ?? ''} onChange={(e) => setResults((r) => ({ ...r, [m.exerciseId!]: { ...r[m.exerciseId!], reps: e.target.value } }))} />
                  <input className="input py-1.5" placeholder="kg" type="number" value={results[m.exerciseId!]?.kg ?? ''} onChange={(e) => setResults((r) => ({ ...r, [m.exerciseId!]: { ...r[m.exerciseId!], kg: e.target.value } }))} />
                </div>
              ))}
              <label><span className="label">Notas</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            </>}
            <div className="flex gap-2"><button className="btn-primary flex-1" onClick={saveLog} data-testid="save-log">Salvar</button><button className="btn-secondary" onClick={() => setLogging(false)}>Cancelar</button></div>
          </div>
        )}
      </Card>

      <Card title="Programação" right={<button className="btn-ghost text-sm" onClick={() => setEditing(editing ? null : { event_date: w.event_date, title: w.title, blocks: w.blocks, uncertainFields: w.uncertainFields })}>{editing ? 'cancelar' : 'corrigir'}</button>}>
        {editing ? (
          <>
            <WodEditor draft={editing} onChange={setEditing} />
            <button className="btn-primary mt-3 w-full" onClick={async () => { await updatePrescribed(w.id, { ...editing, verified_by_user: true, confidence: Math.max(w.confidence, 0.9) }, 'correção manual'); setEditing(null); }}>Salvar correções</button>
          </>
        ) : w.blocks.map((b, i) => (
          <div key={i} className="mb-2 rounded-xl bg-ink-850 p-3 text-sm">
            <div className="font-semibold text-bone-50">{b.title}{b.format && <span className="ml-2 text-xs text-petrol-300">{b.format}</span>}</div>
            {b.movements.map((m, k) => <div key={k} className={m.confidence < 0.6 ? 'text-warn' : 'text-bone-300'}>• {m.reps ? `${m.reps} ` : ''}{m.exerciseId ? EXERCISE_BY_ID[m.exerciseId]?.name_pt : m.raw}{m.loadText ? ` (${m.loadText})` : ''}</div>)}
          </div>
        ))}
      </Card>

      <Card title={`Fontes (${w.sources.length})`}>
        <div className="flex flex-wrap gap-2">{w.sources.filter((s) => s.assetId).map((s) => <AssetThumb key={s.assetId} id={s.assetId!} />)}</div>
        <ul className="mt-2 space-y-1 text-xs text-bone-400">{w.sources.map((s, i) => <li key={i}>• {s.label} — {s.source_type}{s.hash ? ` · sha256 ${s.hash.slice(0, 10)}…` : ''}</li>)}</ul>
        {w.rawText && <details className="mt-2 text-xs text-bone-400"><summary>Texto extraído</summary><pre className="whitespace-pre-wrap">{w.rawText}</pre></details>}
      </Card>

      <Card title={`Histórico de alterações (${revisions.length})`}>
        {revisions.map((r) => <div key={r.id} className="text-xs text-bone-400">{new Date(r.at).toLocaleString('pt-BR')} — {r.reason}</div>)}
      </Card>
      <button className="btn-ghost justify-center text-danger" onClick={async () => { if (confirm('Apagar este WOD e seus vínculos?')) { await db.prescribed.delete(w.id); if (w.performedId) await db.performed.delete(w.performedId); await audit('prescribed.delete', w.id); nav('/historico'); } }}>Apagar este WOD</button>
    </Page>
  );
}
