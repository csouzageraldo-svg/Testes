import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Chips, Page } from '../components/ui';
import { db } from '../db/db';
import { useBodyComp, usePerformed, usePlanned, usePrescribed } from '../lib/hooks';
import { addDays, formatDateBR, localDate } from '../lib/util';

type Layer = 'box' | 'planned' | 'performed' | 'rest' | 'official' | 'goals';
const LAYERS: Array<{ value: Layer; label: string; color: string }> = [
  { value: 'box', label: 'Box (prescrito)', color: '#a29e96' },
  { value: 'planned', label: 'Recomendado/planejado', color: '#5aa9e6' },
  { value: 'performed', label: 'Realizado', color: '#2fb3b0' },
  { value: 'rest', label: 'Descanso', color: '#6fd3cf' },
  { value: 'official', label: 'Eventos oficiais', color: '#e3a33b' },
  { value: 'goals', label: 'Medições/metas', color: '#ece9e4' },
];

interface Ev { date: string; layer: Layer; title: string; detail: string; link?: string }

export default function CalendarPage() {
  const [layers, setLayers] = useState<Layer[]>(['box', 'planned', 'performed', 'rest', 'official', 'goals']);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [sel, setSel] = useState<string>(localDate());
  const prescribed = usePrescribed();
  const performed = usePerformed();
  const planned = usePlanned();
  const bodycomp = useBodyComp();
  const official = useLiveQuery(() => db.officialEvents.toArray(), []) ?? [];

  const events = useMemo(() => {
    const ev: Ev[] = [];
    for (const w of prescribed) ev.push({ date: w.event_date, layer: 'box', title: w.title, detail: `programação do box · ${w.performed_status === 'unknown' ? 'execução não informada' : w.performed_status === 'performed' ? 'realizado' : 'não realizado'}`, link: `/historico/wod/${w.id}` });
    for (const w of performed) if (w.status !== 'not_done') ev.push({ date: w.event_date, layer: 'performed', title: w.title, detail: `realizado (${w.status === 'partial' ? 'parcial' : 'completo'}) · origem: ${w.source_type}` });
    for (const p of planned) {
      const plan = p.edited ?? p.recommended;
      if (plan.isRest || plan.focus === 'recovery') ev.push({ date: p.event_date, layer: 'rest', title: plan.title, detail: `descanso/recuperação · ${p.status}` });
      else if (p.status !== 'done') ev.push({ date: p.event_date, layer: 'planned', title: plan.title, detail: `recomendado pelo app · ${p.status === 'draft' ? 'não aprovado' : p.status}`, link: p.status === 'draft' || p.status === 'approved' ? `/revisar/${p.id}` : undefined });
    }
    for (const e of official) {
      const end = e.end_date ?? e.start_date;
      for (let d = e.start_date, i = 0; d <= end && i < 60; d = addDays(d, 1), i++) ev.push({ date: d, layer: 'official', title: e.name, detail: `${e.status} · checado ${new Date(e.last_checked_at).toLocaleDateString('pt-BR')} · ${e.source_url}` });
    }
    for (const m of bodycomp) ev.push({ date: m.event_date, layer: 'goals', title: 'Medição corporal', detail: `${m.weightKg ?? '—'} kg · ${m.fatPct ?? '—'}% gordura` });
    return ev.filter((e) => layers.includes(e.layer));
  }, [prescribed, performed, planned, official, bodycomp, layers]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const dayEvents = events.filter((e) => e.date === sel);
  const color = (l: Layer) => LAYERS.find((x) => x.value === l)!.color;

  return (
    <Page title="Calendário" subtitle="Camadas separadas: programação do box, plano, realizado, eventos oficiais." back="/mais">
      <Chips multi options={LAYERS.map((l) => ({ value: l.value, label: l.label }))} value={layers} onChange={(v) => setLayers(layers.includes(v) ? layers.filter((x) => x !== v) : [...layers, v])} />
      <Card title={first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} right={<div className="flex gap-1"><button className="btn-ghost" onClick={() => shift(-1)}>‹</button><button className="btn-ghost" onClick={() => shift(1)}>›</button></div>}>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-bone-400">{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <div key={i}>{d}</div>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => d ? (
            <button key={i} onClick={() => setSel(d)} className={`flex aspect-square flex-col items-center justify-start rounded-lg p-1 text-xs ${d === sel ? 'bg-petrol-600/30 ring-1 ring-petrol-500' : 'bg-ink-850'} ${d === localDate() ? 'font-bold text-petrol-300' : 'text-bone-200'}`}>
              {Number(d.slice(8))}
              <div className="mt-auto flex flex-wrap justify-center gap-0.5">{[...new Set(events.filter((e) => e.date === d).map((e) => e.layer))].map((l) => <span key={l} className="h-1.5 w-1.5 rounded-full" style={{ background: color(l) }} />)}</div>
            </button>
          ) : <div key={i} />)}
        </div>
      </Card>
      <Card title={formatDateBR(sel)}>
        {dayEvents.length ? dayEvents.map((e, i) => (
          <div key={i} className="flex items-start gap-2 border-b border-ink-700 py-2 last:border-0">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color(e.layer) }} />
            <div className="min-w-0 text-sm">{e.link ? <Link to={e.link} className="font-semibold text-bone-50 underline decoration-ink-600">{e.title}</Link> : <span className="font-semibold text-bone-50">{e.title}</span>}<div className="break-words text-xs text-bone-400">{e.detail}</div></div>
          </div>
        )) : <p className="text-sm muted">Nada neste dia.</p>}
      </Card>
    </Page>
  );
}
