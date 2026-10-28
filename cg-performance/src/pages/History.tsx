import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Chips, Empty, Notice, Page, SourceBadge } from '../components/ui';
import { db } from '../db/db';
import { audit } from '../db/repo';
import type { PerformedWorkout, PrescribedWorkout } from '../db/types';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { placeLabel } from '../domain/taxonomy';
import { movementIdsOf } from '../domain/wodParser';
import { usePerformed, usePrescribed } from '../lib/hooks';
import { formatDateBR } from '../lib/util';

type Row = { date: string; kind: 'prescribed'; w: PrescribedWorkout } | { date: string; kind: 'performed'; w: PerformedWorkout };

const STATUS_BADGE: Record<PrescribedWorkout['performed_status'], [string, string]> = {
  unknown: ['programação · execução não informada', 'bg-ink-700 text-bone-300'],
  performed: ['realizado', 'bg-petrol-500/20 text-petrol-300'],
  skipped: ['não realizado', 'bg-ink-700 text-bone-400'],
};

function itemLine(it: PerformedWorkout['items'][number]) {
  const q = it.sets && it.reps ? `${it.sets}×${it.reps}` : it.reps ?? (it.durationSec ? `${it.durationSec}s` : it.distanceM ? `${it.distanceM} m` : it.calories ? `${it.calories} cal` : '');
  return `${q} ${EXERCISE_BY_ID[it.exerciseId]?.name_pt ?? it.exerciseId}${it.loadKg ? ` @ ${it.loadKg} kg` : ''}${it.completed === false ? ' (não feito)' : ''}`;
}

export default function History() {
  const prescribed = usePrescribed();
  const performed = usePerformed();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'box' | 'done'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const rows: Row[] = [
    ...(filter !== 'done' ? prescribed.map((w) => ({ date: w.event_date, kind: 'prescribed' as const, w })) : []),
    ...(filter !== 'box' ? performed.filter((w) => filter === 'done' || !w.prescribedId).map((w) => ({ date: w.event_date, kind: 'performed' as const, w })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Page title="Histórico" subtitle="Programação do box e treinos realizados ficam separados: print não é treino feito." actions={<Link to="/importar" className="btn-primary px-3 py-2 text-sm">+ Importar</Link>}>
      {params.get('saved') && <Notice>Treino salvo. Sugestões, mapa e gráficos foram recalculados.</Notice>}
      <Chips options={[{ value: 'all', label: 'Tudo' }, { value: 'box', label: 'Box (prescrito)' }, { value: 'done', label: 'Realizados' }]} value={filter} onChange={(v) => setFilter(v as typeof filter)} />
      {!rows.length && <Empty>Nada por aqui ainda.</Empty>}
      {rows.map((r) => r.kind === 'prescribed' ? (
        <Link key={r.w.id} to={`/historico/wod/${r.w.id}`} className="card-tight block" data-testid="prescribed-row">
          <div className="text-xs text-bone-400">{formatDateBR(r.date)} · box · {r.w.sources.length} fonte(s)</div>
          <div className="font-semibold text-bone-50">{r.w.title}</div>
          <div className="text-xs text-bone-400">{movementIdsOf(r.w.blocks).map((id) => EXERCISE_BY_ID[id]?.name_pt).join(' · ') || 'movimentos a revisar'}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className={`badge ${STATUS_BADGE[r.w.performed_status][1]}`}>{STATUS_BADGE[r.w.performed_status][0]}</span>
            <SourceBadge source={r.w.source_type} />
          </div>
        </Link>
      ) : (
        <Card key={r.w.id} className="!p-3">
          <button className="w-full text-left" onClick={() => setOpen(open === r.w.id ? null : r.w.id)} data-testid="performed-row">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-bone-400">{formatDateBR(r.date)} · {placeLabel(r.w.location)}</div>
                <div className="font-semibold text-bone-50">{r.w.title}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="badge bg-petrol-500/20 text-petrol-300">{r.w.status === 'completed' ? 'concluído' : r.w.status === 'partial' ? 'parcial' : 'não realizado'}</span>
                <SourceBadge source={r.w.source_type} />
              </div>
            </div>
            <div className="mt-1 text-xs text-bone-400">{[r.w.durationMin && `${r.w.durationMin} min`, r.w.rpe != null && `RPE ${r.w.rpe}`, r.w.breath && `fôlego ${r.w.breath}/5`].filter(Boolean).join(' · ')}</div>
          </button>
          {open === r.w.id && (
            <div className="mt-2 space-y-1 text-sm text-bone-300">
              {r.w.items.map((it, i) => <div key={i}>• {itemLine(it)}</div>)}
              {!r.w.items.length && <div className="text-bone-400">Sem detalhes de execução registrados.</div>}
              {r.w.notes && <div className="text-bone-400">“{r.w.notes}”</div>}
              <button className="btn-ghost text-danger" onClick={async () => { if (confirm('Apagar este registro de treino?')) { await db.performed.delete(r.w.id); await audit('performed.delete', r.w.id); } }}>Apagar registro</button>
            </div>
          )}
        </Card>
      ))}
    </Page>
  );
}
