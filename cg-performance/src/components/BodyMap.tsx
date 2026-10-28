import type { MuscleMap } from '../domain/stimulus';
import { MUSCLE_LABEL, type Muscle } from '../domain/taxonomy';

type Shape = { m: Muscle; d: string };

// Silhuetas simplificadas (anterior/posterior), 120×260. Regiões aproximadas, apenas ilustrativas.
const E = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
const R = (x: number, y: number, w: number, h: number, r = 4) => `M${x + r},${y} h${w - 2 * r} q${r},0 ${r},${r} v${h - 2 * r} q0,${r} ${-r},${r} h${-(w - 2 * r)} q${-r},0 ${-r},${-r} v${-(h - 2 * r)} q0,${-r} ${r},${-r}z`;

const FRONT: Shape[] = [
  { m: 'delts', d: E(33, 52, 9, 8) }, { m: 'delts', d: E(87, 52, 9, 8) },
  { m: 'chest', d: R(39, 50, 20, 18, 6) }, { m: 'chest', d: R(61, 50, 20, 18, 6) },
  { m: 'biceps', d: E(28, 75, 6, 13) }, { m: 'biceps', d: E(92, 75, 6, 13) },
  { m: 'forearms', d: E(24, 104, 5, 14) }, { m: 'forearms', d: E(96, 104, 5, 14) },
  { m: 'core_ant', d: R(48, 70, 24, 42, 6) },
  { m: 'core_lat', d: R(39, 72, 8, 36, 4) }, { m: 'core_lat', d: R(73, 72, 8, 36, 4) },
  { m: 'hip_flexors', d: E(50, 120, 6, 6) }, { m: 'hip_flexors', d: E(70, 120, 6, 6) },
  { m: 'quads', d: E(47, 152, 10, 26) }, { m: 'quads', d: E(73, 152, 10, 26) },
  { m: 'adductors', d: E(57, 140, 3.5, 16) }, { m: 'adductors', d: E(63, 140, 3.5, 16) },
  { m: 'calves', d: E(47, 210, 6, 18) }, { m: 'calves', d: E(73, 210, 6, 18) },
];
const BACK: Shape[] = [
  { m: 'upper_back', d: R(42, 44, 36, 20, 8) },
  { m: 'delts', d: E(33, 52, 9, 8) }, { m: 'delts', d: E(87, 52, 9, 8) },
  { m: 'lats', d: 'M40,64 L58,66 L56,98 L44,92 Z' }, { m: 'lats', d: 'M80,64 L62,66 L64,98 L76,92 Z' },
  { m: 'triceps', d: E(28, 75, 6, 13) }, { m: 'triceps', d: E(92, 75, 6, 13) },
  { m: 'forearms', d: E(24, 104, 5, 14) }, { m: 'forearms', d: E(96, 104, 5, 14) },
  { m: 'lower_back', d: R(48, 98, 24, 16, 5) },
  { m: 'glutes', d: E(50, 126, 11, 11) }, { m: 'glutes', d: E(70, 126, 11, 11) },
  { m: 'hamstrings', d: E(48, 160, 9, 22) }, { m: 'hamstrings', d: E(72, 160, 9, 22) },
  { m: 'calves', d: E(47, 207, 7, 18) }, { m: 'calves', d: E(73, 207, 7, 18) },
];

const OUTLINE = 'M60,12 a12,12 0 1,1 -0.1,0 M48,36 h24 l20,10 l8,60 l-8,30 l-6,-28 l-4,-30 l0,60 l6,100 l-14,4 l-8,-90 l-4,0 l-8,90 l-14,-4 l6,-100 l0,-60 l-4,30 l-6,28 l-8,-30 l8,-60 z';

function color(v: number) {
  // 0 → grafite; 1 → verde-petróleo claro
  const a = 0.15 + 0.85 * v;
  return `rgba(47,179,176,${a.toFixed(2)})`;
}

export function BodyMap({ exposure, title }: { exposure: MuscleMap; title?: string }) {
  const max = Math.max(1e-6, ...Object.values(exposure));
  const norm = (m: Muscle) => exposure[m] / max;
  const top = (Object.keys(exposure) as Muscle[]).filter((m) => exposure[m] > 0).sort((a, b) => exposure[b] - exposure[a]);
  const fig = (shapes: Shape[], label: string) => (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 120 245" width="130" role="img" aria-label={`Mapa ${label}`}>
        <path d={OUTLINE} fill="#181d1f" stroke="#2e383c" strokeWidth="1.5" />
        {shapes.map((s, i) => <path key={i} d={s.d} fill={color(norm(s.m))} stroke="#0f1214" strokeWidth="0.8"><title>{MUSCLE_LABEL[s.m]}: {exposure[s.m].toFixed(1)}</title></path>)}
      </svg>
      <figcaption className="text-xs text-bone-400">{label}</figcaption>
    </figure>
  );
  return (
    <div data-testid="body-map">
      {title && <div className="h3 mb-2">{title}</div>}
      <div className="flex justify-center gap-4">{fig(FRONT, 'anterior')}{fig(BACK, 'posterior')}</div>
      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-bone-400">
        <span>menos</span><span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(47,179,176,.15), rgba(47,179,176,1))' }} /><span>mais exposição</span>
      </div>
      {top.length > 0 && <p className="mt-2 text-xs text-bone-300">Mais estimulados: {top.slice(0, 4).map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')}. Menos: {top.slice(-3).map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')}.</p>}
    </div>
  );
}
