import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { itemQuantity } from '../components/PlanView';
import { Card, Chips, Notice, Page, Slider } from '../components/ui';
import { db } from '../db/db';
import { audit, baseFields } from '../db/repo';
import type { ActiveSession, PerformedWorkout } from '../db/types';
import { EXERCISE_BY_ID } from '../domain/exercises';
import type { PainEntry, PerformedItem, PlanBlock, WorkoutPlan } from '../domain/schemas';
import { JOINT_LABEL, JOINTS, type Joint } from '../domain/taxonomy';
import { uid } from '../lib/util';

/** Volume executado a partir do plano + o que foi marcado/contado na execução. Cargas só se informadas. */
export function executedItems(plan: WorkoutPlan, session: ActiveSession | undefined): Array<PerformedItem & { key: string; label: string }> {
  const out: Array<PerformedItem & { key: string; label: string }> = [];
  plan.blocks.forEach((b: PlanBlock, bi) => {
    if (session && bi > session.blockIndex) return; // blocos não alcançados
    const mult = (() => {
      switch (b.format) {
        case 'amrap': return Math.max(1, session?.roundsByBlock[bi] ?? 1);
        case 'for_time': return Math.max(1, session?.roundsByBlock[bi] ?? b.rounds ?? 1);
        case 'emom': return Math.max(1, Math.floor((b.timeCapMin ?? b.items.length) / b.items.length));
        case 'intervals': return Math.max(1, Math.round((b.rounds ?? 1) / b.items.length));
        case 'tabata': return b.rounds ?? 8;
        case 'flow': return 2;
        default: return 1;
      }
    })();
    b.items.forEach((it, ii) => {
      let sets = it.sets ?? 1;
      if (session && b.format === 'sets') {
        const marked = Array.from({ length: sets }).filter((_, si) => session.doneItems[sets > 1 ? `${bi}:${ii}:${si}` : `${bi}:${ii}`]).length;
        sets = marked;
      }
      if (sets === 0) return;
      const durationSec = b.format === 'intervals' && it.durationSec ? it.durationSec : it.durationSec;
      out.push({
        key: `${bi}:${ii}`, label: `${b.title}: ${EXERCISE_BY_ID[it.exerciseId]?.name_pt ?? it.exerciseId}`,
        exerciseId: it.exerciseId, sets: b.format === 'sets' ? sets : undefined,
        reps: it.reps ? it.reps * mult : undefined, durationSec: durationSec ? durationSec * mult : undefined,
        distanceM: it.distanceM ? it.distanceM * mult : undefined, calories: it.calories ? it.calories * mult : undefined,
        // Carga real só quando o atleta definiu kg; RPE prescrito não vira carga.
        loadKg: it.load.kind === 'kg' && it.load.note === 'definida pelo atleta' ? it.load.value : undefined,
        completed: true,
      });
    });
  });
  return out;
}

export default function Checkout() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const planned = useLiveQuery(() => db.planned.get(id), [id]);
  const session = useLiveQuery(() => db.session.get('active'), []);
  const plan = planned ? planned.edited ?? planned.recommended : null;
  const reachedEnd = session ? session.blockIndex >= (plan?.blocks.length ?? 1) - 1 : true;

  const [status, setStatus] = useState<PerformedWorkout['status']>('completed');
  const [rpe, setRpe] = useState(7);
  const [breath, setBreath] = useState(3);
  const [fatigue, setFatigue] = useState(5);
  const [duration, setDuration] = useState<number>(0);
  const [hr, setHr] = useState('');
  const [notes, setNotes] = useState('');
  const [recovery, setRecovery] = useState('');
  const [pains, setPains] = useState<PainEntry[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<PerformedItem>>>({});

  useEffect(() => { if (session) setDuration(Math.max(1, Math.round((Date.now() - session.startedAt) / 60000))); else if (plan) setDuration(plan.estimatedMin); }, [session, plan]);
  useEffect(() => { if (!reachedEnd) setStatus('partial'); }, [reachedEnd]);
  const items = useMemo(() => (plan ? executedItems(plan, session ?? undefined) : []), [plan, session]);

  if (!planned || !plan) return <Page title="Check-out" back="/"><p className="muted">Carregando…</p></Page>;

  async function save() {
    const finalItems = status === 'not_done' ? [] : items.map(({ key, label: _l, ...it }) => ({ ...it, ...overrides[key] }));
    const pw: PerformedWorkout = {
      ...baseFields('user_report', 0.85, true, planned!.event_date), id: uid('pw'), event_date: planned!.event_date, title: plan!.title, plannedId: planned!.id,
      location: plan!.location, focus: plan!.focus, intensity: plan!.intensity, status, durationMin: duration, items: finalItems, rpe: status === 'not_done' ? undefined : rpe,
      breath, muscleFatigue: fatigue, pains, recoveryNote: recovery || undefined, hrAvg: hr ? Number(hr) : undefined, notes: notes || undefined, executedPlan: plan!,
    };
    await db.transaction('rw', db.performed, db.planned, db.session, async () => {
      await db.performed.add(pw);
      await db.planned.update(planned!.id, { status: status === 'not_done' ? 'abandoned' : 'done', performedId: pw.id });
      await db.session.delete('active');
    });
    await audit('performed.create', `${pw.id} ${status}`);
    nav('/historico?saved=1');
  }

  return (
    <Page title="Check-out" subtitle={plan.title}>
      <Card title="Como foi?">
        <Chips testId="status" options={[{ value: 'completed', label: 'Concluído' }, { value: 'partial', label: 'Parcial' }, { value: 'not_done', label: 'Não realizado' }]} value={status} onChange={(v) => setStatus(v as PerformedWorkout['status'])} />
        {status !== 'not_done' && (
          <div className="mt-4 grid grid-cols-1 gap-4">
            <Slider label="Esforço percebido (RPE)" value={rpe} onChange={setRpe} left="muito leve" right="máximo" testId="rpe" />
            <Slider label="Fôlego" value={breath} onChange={setBreath} min={1} max={5} left="sobrou" right="faltou muito" />
            <Slider label="Fadiga muscular" value={fatigue} onChange={setFatigue} left="nenhuma" right="extrema" />
            <label><span className="label">Duração real (min)</span><input className="input" type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 1)} data-testid="duration" /></label>
          </div>
        )}
      </Card>

      {status !== 'not_done' && (
        <Card title="Resultado por exercício">
          <p className="mb-2 text-xs text-bone-400">Pré-preenchido com o volume marcado na execução. Ajuste o que foi diferente. Cargas só entram se você informar.</p>
          {items.map((it) => {
            const o = overrides[it.key] ?? {};
            return (
              <div key={it.key} className="border-b border-ink-700 py-2 last:border-0">
                <div className="text-sm text-bone-100">{it.label}</div>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {it.reps != null && <label className="text-xs"><span className="muted">reps</span><input className="input py-1.5" type="number" value={o.reps ?? it.reps} onChange={(e) => setOverrides((x) => ({ ...x, [it.key]: { ...o, reps: Number(e.target.value) } }))} /></label>}
                  {it.durationSec != null && <label className="text-xs"><span className="muted">segundos</span><input className="input py-1.5" type="number" value={o.durationSec ?? it.durationSec} onChange={(e) => setOverrides((x) => ({ ...x, [it.key]: { ...o, durationSec: Number(e.target.value) } }))} /></label>}
                  {it.distanceM != null && <label className="text-xs"><span className="muted">metros</span><input className="input py-1.5" type="number" value={o.distanceM ?? it.distanceM} onChange={(e) => setOverrides((x) => ({ ...x, [it.key]: { ...o, distanceM: Number(e.target.value) } }))} /></label>}
                  {EXERCISE_BY_ID[it.exerciseId]?.loadable && <label className="text-xs"><span className="muted">kg (real)</span><input className="input py-1.5" type="number" step={0.5} placeholder="—" value={o.loadKg ?? it.loadKg ?? ''} onChange={(e) => setOverrides((x) => ({ ...x, [it.key]: { ...o, loadKg: e.target.value ? Number(e.target.value) : undefined } }))} data-testid={`kg-${it.key}`} /></label>}
                  <label className="flex items-end gap-1 text-xs"><input type="checkbox" checked={o.completed ?? true} onChange={(e) => setOverrides((x) => ({ ...x, [it.key]: { ...o, completed: e.target.checked } }))} /> feito</label>
                </div>
              </div>
            );
          })}
          {!items.length && <p className="text-sm muted">Nenhum item marcado como feito.</p>}
          <details className="mt-2 text-xs text-bone-400"><summary>Plano executado</summary>{plan.blocks.map((b, i) => <div key={i}>{b.title}: {b.items.map((x) => `${itemQuantity(x)} ${EXERCISE_BY_ID[x.exerciseId]?.name_pt}`).join(', ')}</div>)}</details>
        </Card>
      )}

      <Card title="Dor e recuperação (opcional)">
        {pains.map((p, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <select className="input" value={p.joint} onChange={(e) => setPains(pains.map((x, j) => (j === i ? { ...x, joint: e.target.value as Joint } : x)))}>{JOINTS.map((j) => <option key={j} value={j}>{JOINT_LABEL[j]}</option>)}</select>
            <input className="input w-20" type="number" min={0} max={10} value={p.level} onChange={(e) => setPains(pains.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))} aria-label="nível 0-10" />
            <button className="btn-ghost" onClick={() => setPains(pains.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="chip" onClick={() => setPains([...pains, { joint: 'shoulder', level: 3, acute: false }])}>+ dor pós-treino</button>
        <label className="mt-3 block"><span className="label">Recuperação / sensação</span><input className="input" value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="Ex.: fôlego voltou rápido" /></label>
        <label className="mt-3 block"><span className="label">FC média (opcional)</span><input className="input" type="number" value={hr} onChange={(e) => setHr(e.target.value)} /></label>
        <label className="mt-3 block"><span className="label">Notas</span><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </Card>
      {pains.some((p) => p.level >= 7) && <Notice tone="warn">Dor forte registrada. Se persistir ou piorar, procure avaliação profissional; o próximo briefing vai evitar essa articulação.</Notice>}
      <button className="btn-primary w-full text-base" onClick={save} data-testid="save-checkout">Salvar treino</button>
    </Page>
  );
}
