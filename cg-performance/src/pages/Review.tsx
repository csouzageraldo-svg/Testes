import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BlockView, itemQuantity } from '../components/PlanView';
import { Card, Notice, Page } from '../components/ui';
import { db } from '../db/db';
import { audit, revise } from '../db/repo';
import type { ActiveSession } from '../db/types';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { constraintsFor, recalcPlan, simplify, substitutes } from '../domain/generator';
import type { PlanItem, WorkoutPlan } from '../domain/schemas';
import { INTENSITY_LABEL } from '../domain/taxonomy';
import { useEquipment } from '../lib/hooks';

export default function Review() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const planned = useLiveQuery(() => db.planned.get(id), [id]);
  const equipment = useEquipment();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { if (planned && !plan) setPlan(planned.edited ?? planned.recommended); }, [planned, plan]);
  const constraints = useMemo(() => (planned ? constraintsFor(planned.briefing, { equipment }, planned.recommended.intensity) : null), [planned, equipment]);

  if (!planned || !plan || !constraints) return <Page title="Revisão" back="/treinar"><p className="muted">Carregando…</p></Page>;
  const dirty = JSON.stringify(plan) !== JSON.stringify(planned.recommended);

  const updateItem = (bi: number, ii: number, patch: Partial<PlanItem>) => {
    setPlan((p) => p && recalcPlan({ ...p, blocks: p.blocks.map((b, i) => (i !== bi ? b : { ...b, items: b.items.map((it, j) => (j !== ii ? it : { ...it, ...patch })) })) }));
  };
  const removeItem = (bi: number, ii: number) => {
    setPlan((p) => p && recalcPlan({ ...p, blocks: p.blocks.map((b, i) => (i !== bi || b.items.length <= 1 ? b : { ...b, items: b.items.filter((_, j) => j !== ii) })) }));
  };
  const updateBlock = (bi: number, patch: Partial<WorkoutPlan['blocks'][number]>) => setPlan((p) => p && recalcPlan({ ...p, blocks: p.blocks.map((b, i) => (i === bi ? { ...b, ...patch } : b)) }));

  async function approve() {
    if (!plan || !planned) return;
    const edited = dirty ? plan : null;
    // Escolhas manuais viram "locks" para que um novo Regerar as preserve.
    const locks = { ...planned.briefing.locks };
    plan.blocks.forEach((b) => b.items.forEach((it, i) => { if (it.locked) locks[`${b.kind === 'skill' ? 'strength' : b.kind}:${i}`] = it.exerciseId; }));
    await db.planned.update(planned.id, { edited, status: plan.isRest ? 'done' : 'approved', briefing: { ...planned.briefing, locks }, updated_at: new Date().toISOString() });
    if (edited) await revise('planned', planned.id, planned.recommended, edited, 'edição do atleta antes de iniciar');
    if (plan.isRest) { await audit('planned.rest', planned.id); nav('/'); return; }
    const now = Date.now();
    const session: ActiveSession = {
      id: 'active', plannedId: planned.id, plan, startedAt: now, blockIndex: 0, blockStartedAt: null, pausedAt: null, pausedTotalMs: 0,
      roundsByBlock: {}, doneItems: {}, actuals: {}, soundOn: true,
    };
    await db.session.put(session);
    await db.planned.update(planned.id, { status: 'started' });
    nav('/executar');
  }

  return (
    <Page title="Revisar treino" subtitle={`${plan.title} · ~${plan.estimatedMin} min · ${INTENSITY_LABEL[plan.intensity]}`} back="/treinar">
      <Notice>Edite exercícios, séries, tempo e carga. Você aprova a <b>versão final</b> antes de iniciar; a recomendação original fica guardada separadamente.</Notice>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary flex-1" onClick={() => setPlan(simplify(plan, constraints))} data-testid="simplify">Versão mais simples</button>
        <button className="btn-secondary flex-1" disabled={!dirty} onClick={() => setPlan(planned.recommended)}>Restaurar recomendado</button>
      </div>
      {plan.blocks.map((block, bi) => (
        <Card key={bi} title={block.kind === 'metcon' ? 'Bloco principal' : block.title}
          right={(block.format === 'amrap' || block.format === 'emom' || block.format === 'flow' || block.format === 'for_time') ? (
            <label className="flex items-center gap-1 text-xs text-bone-300">min
              <input className="input w-16 py-1" type="number" min={1} max={60} value={block.timeCapMin ?? 0} onChange={(e) => updateBlock(bi, { timeCapMin: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
          ) : null}>
          <BlockView block={block} renderItem={(it, ii) => {
            const ex = EXERCISE_BY_ID[it.exerciseId];
            const key = `${bi}:${ii}`;
            const subs = editing === key ? substitutes(it.exerciseId, constraints).slice(0, 8) : [];
            return (
              <div className="rounded-lg border border-ink-700 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm"><span className="font-semibold text-petrol-300">{itemQuantity(it)}</span> {ex?.name_pt}{it.locked && <span className="badge ml-1 bg-ink-700 text-bone-300">escolha sua</span>}</div>
                  <div className="flex gap-1">
                    <button className="btn-ghost text-xs" onClick={() => setEditing(editing === key ? null : key)} data-testid={`edit-${bi}-${ii}`}>{editing === key ? 'fechar' : 'editar'}</button>
                    <button className="btn-ghost text-xs" onClick={() => removeItem(bi, ii)} aria-label="Remover">✕</button>
                  </div>
                </div>
                {editing === key && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <label className="col-span-2"><span className="label">Trocar exercício (estímulo semelhante)</span>
                      <select className="input" value={it.exerciseId} onChange={(e) => updateItem(bi, ii, { exerciseId: e.target.value, locked: true, load: EXERCISE_BY_ID[e.target.value].loadable ? it.load : { kind: 'bodyweight' } })} data-testid={`swap-${bi}-${ii}`}>
                        <option value={it.exerciseId}>{ex?.name_pt}</option>
                        {subs.map((s) => <option key={s.id} value={s.id}>{s.name_pt}</option>)}
                      </select></label>
                    {block.format === 'sets' && <label><span className="label">Séries</span><input className="input" type="number" min={1} value={it.sets ?? 1} onChange={(e) => updateItem(bi, ii, { sets: Math.max(1, Number(e.target.value) || 1) })} /></label>}
                    {it.reps != null && <label><span className="label">Reps</span><input className="input" type="number" min={1} value={it.reps} onChange={(e) => updateItem(bi, ii, { reps: Math.max(1, Number(e.target.value) || 1) })} data-testid={`reps-${bi}-${ii}`} /></label>}
                    {it.durationSec != null && <label><span className="label">Segundos</span><input className="input" type="number" min={5} value={it.durationSec} onChange={(e) => updateItem(bi, ii, { durationSec: Math.max(5, Number(e.target.value) || 5) })} /></label>}
                    {it.distanceM != null && <label><span className="label">Metros</span><input className="input" type="number" min={50} step={50} value={it.distanceM} onChange={(e) => updateItem(bi, ii, { distanceM: Math.max(50, Number(e.target.value) || 50) })} /></label>}
                    {block.format === 'sets' && <label><span className="label">Descanso (s)</span><input className="input" type="number" min={0} step={15} value={it.restSec ?? 60} onChange={(e) => updateItem(bi, ii, { restSec: Math.max(0, Number(e.target.value) || 0) })} /></label>}
                    {ex?.loadable && (
                      <label><span className="label">Carga (kg) — opcional</span>
                        <input className="input" type="number" min={0} step={0.5} placeholder={it.load.kind === 'rpe' ? `RPE ${it.load.value}` : ''} value={it.load.kind === 'kg' ? it.load.value ?? '' : ''}
                          onChange={(e) => updateItem(bi, ii, { load: e.target.value ? { kind: 'kg', value: Number(e.target.value), note: 'definida pelo atleta' } : { kind: 'rpe', value: 7 } })} data-testid={`load-${bi}-${ii}`} /></label>
                    )}
                  </div>
                )}
              </div>
            );
          }} />
        </Card>
      ))}
      <div className="sticky bottom-24 z-10 rounded-2xl border border-ink-600 bg-ink-850/95 p-3 backdrop-blur">
        <div className="mb-2 flex justify-between text-sm"><span className="muted">Duração estimada</span><b data-testid="review-est">~{plan.estimatedMin} min</b></div>
        <button className="btn-primary w-full text-base" onClick={approve} data-testid="approve">{plan.isRest ? 'Confirmar descanso' : 'Aprovar e iniciar'}</button>
      </div>
    </Page>
  );
}
