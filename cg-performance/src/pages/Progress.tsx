import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BodyMap } from '../components/BodyMap';
import { Card, Chips, ConfidenceBadge, Empty, Page } from '../components/ui';
import { db } from '../db/db';
import { addAsset, upsertBodyComp } from '../db/repo';
import { EXERCISE_BY_ID } from '../domain/exercises';
import { summarizeWindow } from '../domain/stimulus';
import { CAPACITY_LABEL, PATTERN_LABEL, type Capacity, type Pattern } from '../domain/taxonomy';
import { useBodyComp, usePerformed, usePrescribedMap, useProfile } from '../lib/hooks';
import { addDays, formatDateBR, localDate, parseLocalDate } from '../lib/util';

const AXIS = { stroke: '#a29e96', fontSize: 11 };
const TIP = { contentStyle: { background: '#181d1f', border: '1px solid #2e383c', borderRadius: 12, color: '#ece9e4' } };

function weekStart(d: string) {
  const dt = parseLocalDate(d);
  const wd = (dt.getDay() + 6) % 7;
  return addDays(d, -wd);
}

export default function Progress() {
  const today = localDate();
  const [win, setWin] = useState<'7' | '14' | '30' | '90'>('14');
  const performed = usePerformed();
  const prescribedById = usePrescribedMap();
  const bodycomp = useBodyComp();
  const profile = useProfile();
  const checkins = useLiveQuery(() => db.checkins.orderBy('event_date').toArray(), []) ?? [];
  const summary = useMemo(() => summarizeWindow(performed, prescribedById, today, Number(win)), [performed, prescribedById, today, win]);
  const goal = profile?.goals.sessionsPerWeek ?? [3, 5];

  const weekly = useMemo(() => {
    const out: Array<{ week: string; sessions: number; minutes: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const ws = addDays(weekStart(today), -7 * i);
      const we = addDays(ws, 6);
      const inW = performed.filter((w) => w.status !== 'not_done' && w.event_date >= ws && w.event_date <= we);
      out.push({ week: formatDateBR(ws).slice(0, 5), sessions: inW.length, minutes: inW.reduce((a, w) => a + (w.durationMin ?? 0), 0) });
    }
    return out;
  }, [performed, today]);

  const patterns = (Object.entries(summary.patterns) as Array<[Pattern, number]>).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: PATTERN_LABEL[k], v: Math.round(v * 10) / 10 }));
  const caps = (Object.entries(summary.capacities) as Array<[Capacity, number]>).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: CAPACITY_LABEL[k], v: Math.round(v * 10) / 10 }));
  const rpeSeries = performed.filter((w) => w.rpe != null).slice().reverse().map((w) => ({ d: formatDateBR(w.event_date).slice(0, 5), rpe: w.rpe, breath: w.breath }));

  // Força: somente cargas informadas pelo atleta.
  const proven = useMemo(() => {
    const best = new Map<string, { kg: number; reps?: number; date: string }>();
    for (const w of performed) for (const it of w.items) {
      if (!it.loadKg || it.completed === false) continue;
      const b = best.get(it.exerciseId);
      if (!b || it.loadKg > b.kg) best.set(it.exerciseId, { kg: it.loadKg, reps: it.reps, date: w.event_date });
    }
    return [...best.entries()];
  }, [performed]);

  const cardio = useMemo(() => weekly.map((wk, i) => {
    const ws = addDays(weekStart(today), -7 * (11 - i));
    const we = addDays(ws, 6);
    let runM = 0; let bikeMin = 0;
    for (const w of performed) if (w.event_date >= ws && w.event_date <= we) for (const it of w.items) {
      if (it.exerciseId === 'run') runM += (it.distanceM ?? 0) + (it.durationSec ? it.durationSec / 0.33 : 0);
      if (it.exerciseId === 'bike') bikeMin += (it.durationSec ?? 0) / 60;
    }
    return { week: wk.week, run: Math.round(runM), bike: Math.round(bikeMin) };
  }), [weekly, performed, today]);

  const bc = bodycomp.map((m) => ({ d: formatDateBR(m.event_date), peso: m.weightKg, gordura: m.fatPct, musculo: m.musclePct, visceral: m.visceralLevel }));
  const [form, setForm] = useState({ date: today, weight: '', fat: '', muscle: '', visceral: '' });

  return (
    <Page title="Evolução" subtitle="Tendências com origem e confiança. Estimativas não são medidas clínicas.">
      <Chips options={(['7', '14', '30', '90'] as const).map((v) => ({ value: v, label: `${v} dias` }))} value={win} onChange={(v) => setWin(v as typeof win)} />
      <Card title="Mapa corporal — exposição estimada" right={<ConfidenceBadge value={summary.confidence} />}>
        {summary.sessions ? <BodyMap exposure={summary.muscles} /> : <Empty>Sem treinos realizados nesta janela.</Empty>}
        <details className="mt-2 text-xs text-bone-400"><summary>Como é calculado</summary>
          Para cada treino realizado: segundos de trabalho estimados por exercício × peso de contribuição de cada músculo (biblioteca) × fator de esforço (RPE/7). Treinos do box marcados como feitos sem detalhes usam a prescrição com confiança baixa. Mostra <b>exposição a estímulo</b> — não recuperação, inflamação ou hipertrofia.
        </details>
      </Card>

      <Card title="Sessões por semana (meta em destaque)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekly}><CartesianGrid stroke="#222a2d" vertical={false} /><XAxis dataKey="week" {...AXIS} /><YAxis allowDecimals={false} {...AXIS} width={24} />
            <ReferenceArea y1={goal[0]} y2={goal[1]} fill="#14a3a6" fillOpacity={0.12} /><Tooltip {...TIP} /><Bar dataKey="sessions" name="sessões" fill="#2fb3b0" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title={`Padrões de movimento — ${win} dias`}>
        {patterns.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={patterns} layout="vertical" margin={{ left: 20 }}><XAxis type="number" {...AXIS} /><YAxis type="category" dataKey="name" {...AXIS} width={120} /><Tooltip {...TIP} /><Bar dataKey="v" name="minutos-estímulo" fill="#5aa9e6" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        ) : <Empty>Sem dados.</Empty>}
        {caps.length > 0 && <p className="mt-2 text-xs text-bone-400">Capacidades mais trabalhadas: {caps.slice(0, 4).map((c) => c.name.toLowerCase()).join(', ')}.</p>}
      </Card>

      <Card title="Esforço e fôlego">
        {rpeSeries.length ? (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={rpeSeries}><CartesianGrid stroke="#222a2d" vertical={false} /><XAxis dataKey="d" {...AXIS} /><YAxis domain={[0, 10]} {...AXIS} width={24} /><Tooltip {...TIP} />
              <Line dataKey="rpe" name="RPE" stroke="#2fb3b0" strokeWidth={2} dot /><Line dataKey="breath" name="fôlego (1–5)" stroke="#e3a33b" strokeWidth={2} dot /></LineChart>
          </ResponsiveContainer>
        ) : <Empty>Registre RPE no check-out para ver a tendência.</Empty>}
      </Card>

      <Card title="Cardio (dados registrados)">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={cardio}><XAxis dataKey="week" {...AXIS} /><YAxis {...AXIS} width={34} /><Tooltip {...TIP} /><Bar dataKey="run" name="corrida (m)" fill="#2fb3b0" /><Bar dataKey="bike" name="bike (min)" fill="#5aa9e6" /></BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-bone-400">Sem VO2máx: só distâncias/tempos que você registrou.</p>
      </Card>

      <Card title="Força — cargas comprovadas">
        {proven.length ? proven.map(([id, b]) => <div key={id} className="flex justify-between border-b border-ink-700 py-1.5 text-sm last:border-0"><span>{EXERCISE_BY_ID[id]?.name_pt}</span><span>{b.kg} kg{b.reps ? ` × ${b.reps}` : ''} <span className="text-xs text-bone-400">({formatDateBR(b.date)})</span></span></div>)
          : <Empty>Nenhuma carga informada ainda. PRs só aparecem com cargas que você registrou — nunca a carga prescrita.</Empty>}
      </Card>

      <Card title="Composição corporal (bioimpedância doméstica)">
        {bc.length ? (
          <>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={bc}><CartesianGrid stroke="#222a2d" vertical={false} /><XAxis dataKey="d" {...AXIS} /><YAxis domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v: number) => String(Math.round(v))} {...AXIS} width={30} /><Tooltip {...TIP} />
                {profile?.goals.weightTarget && <ReferenceArea y1={profile.goals.weightTarget[0]} y2={profile.goals.weightTarget[1]} fill="#14a3a6" fillOpacity={0.1} />}
                <Line dataKey="peso" name="peso (kg)" stroke="#ece9e4" strokeWidth={2} dot /></LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={bc}><CartesianGrid stroke="#222a2d" vertical={false} /><XAxis dataKey="d" {...AXIS} /><YAxis {...AXIS} width={30} /><Tooltip {...TIP} />
                {profile?.goals.bodyFatTarget && <ReferenceArea y1={profile.goals.bodyFatTarget[0]} y2={profile.goals.bodyFatTarget[1]} fill="#e3a33b" fillOpacity={0.1} />}
                <Line dataKey="gordura" name="gordura %" stroke="#e3a33b" strokeWidth={2} dot /><Line dataKey="musculo" name="músculo % (balança)" stroke="#2fb3b0" strokeWidth={2} dot /><Line dataKey="visceral" name="visceral (nível)" stroke="#5aa9e6" strokeWidth={1.5} dot /></LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-bone-400">Valores de balança de bioimpedância oscilam com hidratação; olhe tendência de semanas, não um dia. “Músculo %” da balança não é medida clínica.</p>
          </>
        ) : <Empty>Sem medições. Importe o CSV da planilha em Importar ou registre abaixo.</Empty>}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <label><span className="label">Data</span><input className="input py-1.5" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label><span className="label">Peso kg</span><input className="input py-1.5" type="number" step={0.1} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></label>
          <label><span className="label">Gordura %</span><input className="input py-1.5" type="number" step={0.1} value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} /></label>
          <label><span className="label">Músculo %</span><input className="input py-1.5" type="number" step={0.1} value={form.muscle} onChange={(e) => setForm({ ...form, muscle: e.target.value })} /></label>
          <label><span className="label">Visceral</span><input className="input py-1.5" type="number" value={form.visceral} onChange={(e) => setForm({ ...form, visceral: e.target.value })} /></label>
          <label className="btn-secondary cursor-pointer self-end py-2 text-xs">Foto do visor<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await addAsset(f, f.name, 'scale_photo', `balança ${form.date}`); }} /></label>
        </div>
        <button className="btn-primary mt-2 w-full" disabled={!form.weight && !form.fat} onClick={async () => {
          const n = (s: string) => (s ? Number(s) : undefined);
          await upsertBodyComp([{ event_date: form.date, weightKg: n(form.weight), fatPct: n(form.fat), musclePct: n(form.muscle), visceralLevel: n(form.visceral) }], 'user_manual_entry', 'registro manual');
          setForm({ date: today, weight: '', fat: '', muscle: '', visceral: '' });
        }}>Salvar medição</button>
      </Card>

      <Card title="Recuperação (check-ins)">
        {checkins.length ? (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={checkins.map((c) => ({ d: formatDateBR(c.event_date).slice(0, 5), energia: c.energy, sono: c.sleep }))}><XAxis dataKey="d" {...AXIS} /><YAxis domain={[0, 10]} {...AXIS} width={24} /><Tooltip {...TIP} />
              <Line dataKey="energia" stroke="#2fb3b0" strokeWidth={2} /><Line dataKey="sono" stroke="#5aa9e6" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        ) : <Empty>Os check-ins do briefing aparecem aqui.</Empty>}
      </Card>
    </Page>
  );
}
