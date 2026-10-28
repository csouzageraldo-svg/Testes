import { useEffect, useMemo, useRef, useState } from 'react';
import { animationFor, type Animation, type Pose } from './poses';

const L = { torso: 50, ua: 27, la: 25, th: 38, sh: 38, head: 9 };
const GROUND = 182;

type Pt = [number, number];
const dir = (deg: number): Pt => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
const add = (p: Pt, d: Pt, len: number): Pt => [p[0] + d[0] * len, p[1] + d[1] * len];

export interface Skeleton {
  hip: Pt; shoulder: Pt; spineCtrl: Pt; head: Pt;
  elbow: Pt; hand: Pt; elbow2: Pt; hand2: Pt;
  knee: Pt; foot: Pt; knee2: Pt; foot2: Pt;
}

export function skeleton(p: Pose, anchor: Animation['anchor']): Skeleton {
  const hip: Pt = [p.hx, 0];
  const td = dir(p.torso);
  const shoulder = add(hip, td, L.torso);
  const mid: Pt = [(hip[0] + shoulder[0]) / 2, (hip[1] + shoulder[1]) / 2];
  const perp: Pt = [-td[1], td[0]];
  const spineCtrl = add(mid, perp, -(p.bend ?? 0));
  const head = add(shoulder, dir(p.torso + (p.head ?? 0)), L.head + 3);
  const elbow = add(shoulder, dir(p.ua), L.ua);
  const hand = add(elbow, dir(p.la), L.la);
  const elbow2 = add(shoulder, dir(p.ua2 ?? p.ua), L.ua);
  const hand2 = add(elbow2, dir(p.la2 ?? p.la), L.la);
  const knee = add(hip, dir(p.th), L.th);
  const foot = add(knee, dir(p.sh), L.sh);
  const knee2 = add(hip, dir(p.th2 ?? p.th), L.th);
  const foot2 = add(knee2, dir(p.sh2 ?? p.sh), L.sh);
  const s: Skeleton = { hip, shoulder, spineCtrl, head, elbow, hand, elbow2, hand2, knee, foot, knee2, foot2 };
  let dy: number;
  if (anchor === 'hang') dy = 42 - Math.min(hand[1], hand2[1]);
  else if (anchor === 'seat') dy = 112 - hip[1];
  else {
    const ys = [foot[1], foot2[1], knee[1], knee2[1], hand[1], hand2[1], hip[1], shoulder[1], head[1] + L.head, elbow[1], elbow2[1]];
    dy = GROUND - Math.max(...ys) - (p.lift ?? 0);
  }
  for (const k of Object.keys(s) as Array<keyof Skeleton>) s[k] = [s[k][0], s[k][1] + dy];
  return s;
}

const ease = (t: number) => t * t * (3 - 2 * t);

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const k = ease(t);
  const l = (x?: number, y?: number, dx = 0) => (x ?? dx) + ((y ?? dx) - (x ?? dx)) * k;
  return {
    hx: l(a.hx, b.hx), torso: l(a.torso, b.torso), bend: l(a.bend, b.bend), head: l(a.head, b.head),
    ua: l(a.ua, b.ua), la: l(a.la, b.la), ua2: l(a.ua2 ?? a.ua, b.ua2 ?? b.ua), la2: l(a.la2 ?? a.la, b.la2 ?? b.la),
    th: l(a.th, b.th), sh: l(a.sh, b.sh), th2: l(a.th2 ?? a.th, b.th2 ?? b.th), sh2: l(a.sh2 ?? a.sh, b.sh2 ?? b.sh), lift: l(a.lift, b.lift),
  };
}

export function poseAt(anim: Animation, phase: number): Pose {
  const f = anim.frames;
  if (f.length === 1) return f[0];
  // Percorre f0→f1→…→fn→f0 (ciclo fechado), com pausa opcional ao fim.
  const hold = anim.hold ?? 0;
  const seq = [...f, f[0]];
  const segs = seq.length - 1;
  const p = phase % 1;
  const moving = 1 - hold;
  const holdAt = Math.floor(segs / 2);
  const segT = moving / segs;
  let acc = 0;
  for (let i = 0; i < segs; i++) {
    if (hold && i === holdAt) {
      if (p < acc + hold) return seq[i];
      acc += hold;
    }
    if (p < acc + segT) return lerpPose(seq[i], seq[i + 1], (p - acc) / segT);
    acc += segT;
  }
  return seq[segs];
}

function Props({ id, anim, s }: { id: string; anim: Animation; s: Skeleton }) {
  const out: JSX.Element[] = [];
  const prop = 'var(--prop)';
  for (const p of anim.props) {
    switch (p) {
      case 'pullbar': out.push(<g key={p}><line x1={30} y1={40} x2={170} y2={40} stroke={prop} strokeWidth={4} strokeLinecap="round" /><line x1={30} y1={40} x2={30} y2={GROUND} stroke={prop} strokeWidth={3} opacity={0.5} /></g>); break;
      case 'bench': {
        if (id.includes('bench_press')) out.push(<rect key={p} x={s.hip[0] - 58} y={s.hip[1] + 5} width={66} height={7} rx={2} fill={prop} />);
        else if (id === 'push_up_incline') out.push(<rect key={p} x={s.hand[0] - 22} y={s.hand[1]} width={40} height={GROUND - s.hand[1]} rx={2} fill={prop} opacity={0.6} />);
        else if (id === 'bulgarian_split_squat') out.push(<rect key={p} x={s.foot2[0] - 20} y={s.foot2[1]} width={34} height={GROUND - s.foot2[1]} rx={2} fill={prop} opacity={0.6} />);
        else out.push(<rect key={p} x={s.hip[0] - 48} y={GROUND - 42} width={36} height={42} rx={2} fill={prop} opacity={0.6} />);
        break;
      }
      case 'box': out.push(<rect key={p} x={id === 'box_jump' ? 98 : 102} y={GROUND - (id === 'box_jump' ? 40 : 35)} width={70} height={id === 'box_jump' ? 40 : 35} rx={3} fill={prop} opacity={0.55} />); break;
      case 'wall': out.push(<rect key={p} x={id === 'wall_ball' ? 186 : 160} y={8} width={8} height={GROUND - 8} fill={prop} opacity={0.45} />); break;
      case 'rope': out.push(<ellipse key={p} cx={(s.hand[0] + s.foot[0]) / 2} cy={(s.hand[1] + GROUND) / 2 + 4} rx={26} ry={(GROUND - s.hand[1]) / 2 + 6} fill="none" stroke={prop} strokeWidth={2} strokeDasharray="4 3" />); break;
      case 'bike': out.push(<g key={p} stroke={prop} strokeWidth={4} fill="none" strokeLinecap="round"><line x1={s.hip[0]} y1={s.hip[1] + 6} x2={s.hip[0] + 10} y2={GROUND - 8} /><line x1={s.hip[0] + 10} y1={GROUND - 8} x2={s.hip[0] + 70} y2={GROUND - 8} /><line x1={s.hip[0] + 55} y1={GROUND - 8} x2={s.hip[0] + 62} y2={s.hand[1] + 4} /><circle cx={s.hip[0] + 20} cy={s.hip[1] + 52} r={16} /><line x1={s.hip[0] - 15} y1={s.hip[1] + 6} x2={s.hip[0] + 12} y2={s.hip[1] + 6} /></g>); break;
      case 'rower': out.push(<g key={p}><line x1={30} y1={GROUND - 6} x2={190} y2={GROUND - 6} stroke={prop} strokeWidth={4} /><rect x={s.hip[0] - 12} y={s.hip[1] + 4} width={24} height={6} fill={prop} /><circle cx={185} cy={GROUND - 22} r={14} fill="none" stroke={prop} strokeWidth={3} /></g>); break;
      case 'barbell_back': out.push(<circle key={p} cx={s.shoulder[0] - 3} cy={s.shoulder[1] - 2} r={15} fill="none" stroke={prop} strokeWidth={5} />); break;
      default: break;
    }
  }
  const hp = anim.handProp;
  if (hp === 'barbell') out.push(<g key="hp"><circle cx={s.hand[0]} cy={s.hand[1]} r={16} fill="none" stroke={prop} strokeWidth={5} /><circle cx={s.hand[0]} cy={s.hand[1]} r={2.5} fill={prop} /></g>);
  if (hp === 'dumbbell') for (const h of [s.hand, s.hand2]) out.push(<rect key={`db${h[0]}`} x={h[0] - 7} y={h[1] - 4} width={14} height={8} rx={3} fill={prop} />);
  if (hp === 'kettlebell') out.push(<g key="kb"><circle cx={s.hand[0]} cy={s.hand[1] + 9} r={8} fill={prop} /><path d={`M${s.hand[0] - 5},${s.hand[1] + 3} Q${s.hand[0]},${s.hand[1] - 5} ${s.hand[0] + 5},${s.hand[1] + 3}`} stroke={prop} strokeWidth={2.5} fill="none" /></g>);
  if (hp === 'sandbag') out.push(<rect key="sb" x={s.hand[0] - 15} y={s.hand[1] - 7} width={30} height={14} rx={6} fill={prop} />);
  if (hp === 'ball') out.push(<circle key="ball" cx={s.hand[0]} cy={s.hand[1] - 6} r={10} fill={prop} />);
  if (hp === 'band') out.push(<path key="band" d={`M${s.hand[0]},${s.hand[1]} Q${(s.hand[0] + s.foot[0]) / 2 + 10},${(s.hand[1] + s.foot[1]) / 2} ${s.foot[0]},${s.foot[1]}`} stroke="var(--accent2)" strokeWidth={2} fill="none" strokeDasharray="5 3" />);
  return <>{out}</>;
}

export function Figure({ id, anim, pose, size = 220 }: { id: string; anim: Animation; pose: Pose; size?: number }) {
  const s = useMemo(() => skeleton(pose, anim.anchor), [pose, anim.anchor]);
  const limb = (a: Pt, b: Pt, c: Pt, back: boolean) => (
    <polyline points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]}`} fill="none" stroke="var(--fig)" strokeWidth={back ? 5 : 6} strokeLinecap="round" strokeLinejoin="round" opacity={back ? 0.45 : 1} />
  );
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Demonstração animada do movimento" style={{ maxWidth: '100%', height: 'auto' }}>
      <line x1={8} y1={GROUND} x2={192} y2={GROUND} stroke="var(--prop)" strokeWidth={1.5} opacity={0.5} />
      <Props id={id} anim={anim} s={s} />
      {limb(s.hip, s.knee2, s.foot2, true)}
      {limb(s.shoulder, s.elbow2, s.hand2, true)}
      <path d={`M${s.hip[0]},${s.hip[1]} Q${s.spineCtrl[0]},${s.spineCtrl[1]} ${s.shoulder[0]},${s.shoulder[1]}`} fill="none" stroke="var(--fig)" strokeWidth={8} strokeLinecap="round" />
      {limb(s.hip, s.knee, s.foot, false)}
      {limb(s.shoulder, s.elbow, s.hand, false)}
      <circle cx={s.head[0]} cy={s.head[1]} r={L.head} fill="var(--fig)" />
    </svg>
  );
}

export function ExerciseAnimation({ exerciseId, size = 220, autoPlay = true }: { exerciseId: string; size?: number; autoPlay?: boolean }) {
  const anim = animationFor(exerciseId);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(autoPlay && !reduced);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState(0);
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (!playing || !anim) return;
    const tick = (t: number) => {
      if (last.current != null) setPhase((p) => (p + ((t - last.current!) / 1000 / anim.cycle) * speed) % 1);
      last.current = t;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = undefined; };
  }, [playing, speed, anim]);

  if (!anim) return <div className="text-sm text-bone-400">Demonstração indisponível para este movimento.</div>;
  const pose = poseAt(anim, phase);
  return (
    <div className="flex flex-col items-center gap-2" data-testid="exercise-animation">
      <div className="anim-stage rounded-2xl bg-ink-850 p-2">
        <Figure id={exerciseId} anim={anim} pose={pose} size={size} />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button className="btn-ghost" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pausar' : 'Reproduzir'}>{playing ? '❚❚ Pausar' : '▶ Reproduzir'}</button>
        <button className="btn-ghost" onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}>{speed === 1 ? 'Câmera lenta' : 'Velocidade normal'}</button>
        <button className="btn-ghost" onClick={() => { setPlaying(false); setPhase((p) => (p + 1 / (anim.frames.length * 2)) % 1); }}>Passo ›</button>
      </div>
      <div className="flex gap-1" aria-label="Sequência de poses">
        {anim.frames.map((f, i) => (
          <div key={i} className="rounded-lg bg-ink-850 p-1"><Figure id={exerciseId} anim={anim} pose={f} size={52} /></div>
        ))}
      </div>
    </div>
  );
}
