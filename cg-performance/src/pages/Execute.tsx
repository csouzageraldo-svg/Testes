import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExerciseAnimation } from '../animation/StickFigure';
import { FORMAT_LABEL, itemQuantity, loadText } from '../components/PlanView';
import { Notice } from '../components/ui';
import { db } from '../db/db';
import type { ActiveSession } from '../db/types';
import { EXERCISE_BY_ID } from '../domain/exercises';
import type { PlanBlock } from '../domain/schemas';
import { fmtDuration } from '../lib/util';

/** Estado derivado do timer do bloco a partir de timestamps (resiste a fechar a aba / segundo plano). */
export function blockClock(block: PlanBlock, elapsedMs: number) {
  const el = elapsedMs / 1000;
  switch (block.format) {
    case 'amrap': case 'flow': {
      const total = (block.timeCapMin ?? 10) * 60;
      return { label: 'restante', display: fmtDuration(total - el), done: el >= total, itemIndex: -1, phase: 'work' as const, beepKey: el >= total - 3 ? `end${Math.ceil(total - el)}` : '' };
    }
    case 'emom': {
      const total = (block.timeCapMin ?? 10) * 60;
      const minute = Math.floor(el / 60);
      const left = 60 - (el % 60);
      return { label: `minuto ${Math.min(minute + 1, total / 60)}/${total / 60}`, display: fmtDuration(left), done: el >= total, itemIndex: minute % block.items.length, phase: 'work' as const, beepKey: left <= 3 ? `m${minute}-${Math.ceil(left)}` : '' };
    }
    case 'intervals': case 'tabata': {
      const work = block.workSec ?? 60;
      const rest = block.restSec ?? 30;
      const segs = (block.rounds ?? 8) * (block.format === 'tabata' ? block.items.length : 1);
      const idx = Math.floor(el / (work + rest));
      const inSeg = el % (work + rest);
      const phase = inSeg < work ? ('work' as const) : ('rest' as const);
      const left = phase === 'work' ? work - inSeg : work + rest - inSeg;
      return { label: `${phase === 'work' ? 'TRABALHO' : 'DESCANSO'} · ${Math.min(idx + 1, segs)}/${segs}`, display: fmtDuration(left), done: idx >= segs, itemIndex: idx % block.items.length, phase, beepKey: left <= 3 ? `s${idx}${phase}${Math.ceil(left)}` : '' };
    }
    case 'for_time': {
      const cap = (block.timeCapMin ?? 20) * 60;
      return { label: `cap ${block.timeCapMin} min`, display: fmtDuration(el), done: el >= cap, itemIndex: -1, phase: 'work' as const, beepKey: el >= cap - 3 && el < cap + 1 ? `cap${Math.ceil(cap - el)}` : '' };
    }
    default:
      return { label: 'cronômetro', display: fmtDuration(el), done: false, itemIndex: -1, phase: 'work' as const, beepKey: '' };
  }
}

let audioCtx: AudioContext | null = null;
function beep(freq = 880, ms = 140) {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.15;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* áudio indisponível */ }
}

export default function Execute() {
  const nav = useNavigate();
  const s = useLiveQuery(() => db.session.get('active'), []);
  const [now, setNow] = useState(Date.now());
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const lastBeep = useRef('');
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => {
    const nav2 = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (s?.blockStartedAt && !s.pausedAt && nav2.wakeLock && !wake.current) nav2.wakeLock.request('screen').then((w) => { wake.current = w; }).catch(() => {});
    return () => { void wake.current?.release(); wake.current = null; };
  }, [s?.blockStartedAt, s?.pausedAt]);

  useEffect(() => {
    if (!s) return;
    const b = s.plan.blocks[s.blockIndex];
    const el = s.blockStartedAt ? (s.pausedAt ?? now) - s.blockStartedAt - s.pausedTotalMs : 0;
    const c = blockClock(b, el);
    const isRunning = !!s.blockStartedAt && !s.pausedAt && !c.done;
    if (s.soundOn && isRunning && c.beepKey && c.beepKey !== lastBeep.current) {
      lastBeep.current = c.beepKey;
      beep(c.beepKey.endsWith('1') ? 1200 : 880);
    }
    if (restEnd && now >= restEnd) {
      setRestEnd(null);
      if (s.soundOn) beep(1200, 300);
    }
  }, [now, s, restEnd]);

  if (s === undefined) return null;
  if (!s) return (
    <div className="mx-auto max-w-xl p-6"><Notice>Nenhum treino em andamento. <Link to="/treinar" className="text-petrol-300">Montar treino</Link></Notice></div>
  );

  const save = (patch: Partial<ActiveSession>) => db.session.put({ ...s, ...patch });
  const block = s.plan.blocks[s.blockIndex];
  const elapsed = s.blockStartedAt ? (s.pausedAt ?? now) - s.blockStartedAt - s.pausedTotalMs : 0;
  const clock = blockClock(block, elapsed);
  const restLeft = restEnd ? Math.max(0, (restEnd - now) / 1000) : 0;
  const focusItem = clock.itemIndex >= 0 ? block.items[clock.itemIndex] : block.items.find((_, i) => !s.doneItems[`${s.blockIndex}:${i}`]) ?? block.items[0];
  const rounds = s.roundsByBlock[s.blockIndex] ?? 0;
  const totalElapsed = (now - s.startedAt) / 1000;

  const goBlock = (i: number) => save({ blockIndex: i, blockStartedAt: null, pausedAt: null, pausedTotalMs: 0 });
  const finish = () => nav(`/checkout/${s.plannedId}`);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 pb-10 pt-5">
      <div className="flex items-center justify-between text-sm">
        <span className="muted">Bloco {s.blockIndex + 1}/{s.plan.blocks.length} · total {fmtDuration(totalElapsed)}</span>
        <button className="btn-ghost" onClick={() => save({ soundOn: !s.soundOn })}>{s.soundOn ? '🔊 som' : '🔇 mudo'}</button>
      </div>
      <div className={`rounded-3xl p-5 text-center ${clock.phase === 'rest' ? 'bg-sky-400/15' : 'bg-ink-800'}`}>
        <div className="text-xs uppercase tracking-widest text-bone-400">{block.title} · {FORMAT_LABEL[block.format]}</div>
        <div className="mt-2 font-mono text-6xl font-semibold tabular-nums text-bone-50" data-testid="clock">{clock.display}</div>
        <div className="mt-1 text-sm text-petrol-300" data-testid="clock-label">{clock.done ? 'bloco concluído' : clock.label}</div>
        <div className="mt-4 flex justify-center gap-2">
          {!s.blockStartedAt && <button className="btn-primary px-8" onClick={() => save({ blockStartedAt: Date.now(), pausedTotalMs: 0, pausedAt: null })} data-testid="start-block">Iniciar bloco</button>}
          {s.blockStartedAt && !s.pausedAt && !clock.done && <button className="btn-secondary px-6" onClick={() => save({ pausedAt: Date.now() })} data-testid="pause">Pausar</button>}
          {s.pausedAt && <button className="btn-primary px-6" onClick={() => save({ pausedTotalMs: s.pausedTotalMs + (Date.now() - s.pausedAt!), pausedAt: null })} data-testid="resume">Retomar</button>}
          {(block.format === 'amrap' || block.format === 'for_time') && s.blockStartedAt && (
            <div className="flex items-center gap-1">
              <button className="btn-secondary px-3" onClick={() => save({ roundsByBlock: { ...s.roundsByBlock, [s.blockIndex]: Math.max(0, rounds - 1) } })}>−</button>
              <span className="min-w-[72px] text-sm">{rounds} rodada(s)</span>
              <button className="btn-secondary px-3" onClick={() => save({ roundsByBlock: { ...s.roundsByBlock, [s.blockIndex]: rounds + 1 } })} data-testid="round-plus">+</button>
            </div>
          )}
        </div>
      </div>

      {focusItem && (
        <div className="card flex flex-col items-center">
          <div className="text-lg font-semibold text-bone-50">{itemQuantity(focusItem)} {EXERCISE_BY_ID[focusItem.exerciseId]?.name_pt}</div>
          <div className="text-xs text-bone-400">{loadText(focusItem)}</div>
          <ExerciseAnimation exerciseId={focusItem.exerciseId} size={150} />
        </div>
      )}

      <div className="card">
        <div className="h3 mb-2">Checklist do bloco</div>
        {block.items.map((it, i) => {
          const sets = it.sets ?? 1;
          return (
            <div key={i} className="flex items-center justify-between gap-2 border-b border-ink-700 py-2 last:border-0">
              <div className="text-sm"><b className="text-petrol-300">{itemQuantity(it)}</b> {EXERCISE_BY_ID[it.exerciseId]?.name_pt} <span className="text-xs text-bone-400">{loadText(it)}</span></div>
              <div className="flex gap-1">
                {Array.from({ length: sets }).map((_, si) => {
                  const k = sets > 1 ? `${s.blockIndex}:${i}:${si}` : `${s.blockIndex}:${i}`;
                  return <button key={si} className={`h-8 w-8 rounded-lg border ${s.doneItems[k] ? 'border-petrol-500 bg-petrol-500 text-ink-950' : 'border-ink-600'}`}
                    onClick={() => { save({ doneItems: { ...s.doneItems, [k]: !s.doneItems[k] } }); if (!s.doneItems[k] && it.restSec) setRestEnd(Date.now() + it.restSec * 1000); }} aria-label={`Marcar série ${si + 1}`} data-testid={`done-${i}-${si}`}>✓</button>;
                })}
              </div>
            </div>
          );
        })}
        {restEnd && <div className="mt-3 rounded-xl bg-sky-400/15 p-3 text-center"><div className="text-xs uppercase text-bone-400">descanso</div><div className="font-mono text-3xl" data-testid="rest-timer">{fmtDuration(restLeft)}</div><button className="btn-ghost" onClick={() => setRestEnd(null)}>pular</button></div>}
        {block.format === 'sets' && !restEnd && <div className="mt-3 flex gap-2">{[60, 90, 120].map((r) => <button key={r} className="btn-secondary flex-1" onClick={() => setRestEnd(Date.now() + r * 1000)}>descanso {r}s</button>)}</div>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" disabled={s.blockIndex === 0} onClick={() => goBlock(s.blockIndex - 1)}>‹ Bloco anterior</button>
        {s.blockIndex < s.plan.blocks.length - 1
          ? <button className="btn-primary" onClick={() => goBlock(s.blockIndex + 1)} data-testid="next-block">Próximo bloco ›</button>
          : <button className="btn-primary" onClick={finish} data-testid="finish">Concluir treino</button>}
      </div>
      <button className="btn-ghost justify-center" onClick={finish} data-testid="end-early">Encerrar agora (salvar parcial)</button>
      <p className="text-center text-xs text-bone-400">O progresso é salvo a cada toque. Se o celular bloquear ou a aba fechar, o tempo continua contando pelo relógio e você retoma daqui. Em segundo plano, o navegador pode atrasar os bipes.</p>
    </div>
  );
}
