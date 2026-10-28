import { Link } from 'react-router-dom';
import { EXERCISE_BY_ID } from '../domain/exercises';
import type { PlanBlock, PlanItem, WorkoutPlan } from '../domain/schemas';
import { INTENSITY_LABEL, INTENSITY_RPE, LOCATION_LABEL } from '../domain/taxonomy';
import { fmtDuration } from '../lib/util';

export function itemQuantity(it: PlanItem): string {
  const parts: string[] = [];
  if (it.sets) parts.push(`${it.sets}×`);
  if (it.reps) parts.push(`${it.reps}`);
  else if (it.durationSec) parts.push(it.durationSec >= 60 ? fmtDuration(it.durationSec) : `${it.durationSec}s`);
  else if (it.distanceM) parts.push(`${it.distanceM} m`);
  else if (it.calories) parts.push(`${it.calories} cal`);
  return parts.join('');
}

export function loadText(it: PlanItem): string {
  switch (it.load.kind) {
    case 'kg': return `${it.load.value} kg`;
    case 'rpe': return `RPE ${it.load.value}`;
    case 'percent_1rm': return `${it.load.value}% 1RM`;
    default: return '';
  }
}

export const FORMAT_LABEL: Record<PlanBlock['format'], string> = {
  sets: 'Séries', amrap: 'AMRAP', emom: 'EMOM', for_time: 'For Time', intervals: 'Intervalado', tabata: 'Tabata', flow: 'Fluxo',
};

export function BlockView({ block, renderItem }: { block: PlanBlock; renderItem?: (it: PlanItem, i: number) => JSX.Element }) {
  return (
    <div className="rounded-xl bg-ink-850 p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-bone-50">{block.title}</div>
        <span className="text-xs text-bone-400">{FORMAT_LABEL[block.format]} · ~{Math.round(block.estimatedMin)} min</span>
      </div>
      {block.format === 'intervals' && <div className="text-xs text-bone-400">{block.rounds} × {block.workSec}s trabalho / {block.restSec}s descanso</div>}
      {block.format === 'for_time' && <div className="text-xs text-bone-400">{block.rounds} rounds · time cap {block.timeCapMin} min</div>}
      <ul className="mt-2 space-y-1.5">
        {block.items.map((it, i) => renderItem ? <li key={i}>{renderItem(it, i)}</li> : (
          <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
            <Link to={`/biblioteca/${it.exerciseId}`} className="text-bone-100 underline decoration-ink-600 underline-offset-4">
              <span className="font-semibold text-petrol-300">{itemQuantity(it)}</span> {EXERCISE_BY_ID[it.exerciseId]?.name_pt ?? it.exerciseId}
            </Link>
            <span className="shrink-0 text-xs text-bone-400">{loadText(it)}{it.restSec ? ` · desc. ${it.restSec}s` : ''}</span>
          </li>
        ))}
      </ul>
      {block.notes && <p className="mt-2 text-xs text-bone-400">{block.notes}</p>}
    </div>
  );
}

export function PlanSummary({ plan, onChoose }: { plan: WorkoutPlan; onChoose?: () => void }) {
  const [lo, hi] = INTENSITY_RPE[plan.intensity];
  return (
    <section className={`card ${plan.option === 'A' ? 'border-petrol-600' : ''}`} data-testid={`option-${plan.option}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-petrol-300">{plan.option} — {plan.label}</div>
          <h3 className="mt-0.5 text-lg font-semibold text-bone-50">{plan.title}</h3>
          <div className="text-xs text-bone-400">{LOCATION_LABEL[plan.location]} · {INTENSITY_LABEL[plan.intensity]} (RPE {lo}–{hi}) · <span data-testid={`est-${plan.option}`}>~{plan.estimatedMin} min</span></div>
        </div>
      </div>
      {plan.inspiredByOfficialId && <div className="mt-2 rounded-lg border border-sky-400/50 bg-sky-400/10 p-2 text-xs">Adaptação própria do CG Performance — não é a programação oficial da CrossFit.</div>}
      {plan.safetyNotes.length > 0 && <div className="mt-2 rounded-lg border border-warn/50 bg-warn/10 p-2 text-xs">{plan.safetyNotes.map((s, i) => <p key={i}>{s}</p>)}</div>}
      {plan.rationale.length > 0 && <ul className="mt-2 space-y-1 text-sm text-bone-300" data-testid={`rationale-${plan.option}`}>{plan.rationale.map((r, i) => <li key={i}>• {r}</li>)}</ul>}
      {plan.tradeoffs.length > 0 && <ul className="mt-2 space-y-1 text-xs text-bone-400">{plan.tradeoffs.map((r, i) => <li key={i}>⚖ {r}</li>)}</ul>}
      <div className="mt-3 space-y-2">{plan.blocks.map((b, i) => <BlockView key={i} block={b} />)}</div>
      {onChoose && <button className={`${plan.option === 'A' ? 'btn-primary' : 'btn-secondary'} mt-3 w-full`} onClick={onChoose} data-testid={`choose-${plan.option}`}>{plan.isRest ? 'Registrar descanso' : `Escolher opção ${plan.option}`}</button>}
    </section>
  );
}
