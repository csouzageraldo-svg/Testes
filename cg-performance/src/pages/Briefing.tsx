import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Chips, ConfidenceBadge, Notice, Page, Slider } from '../components/ui';
import { PlanSummary } from '../components/PlanView';
import { db } from '../db/db';
import { baseFields } from '../db/repo';
import { EQUIPMENT_TYPES, HOTEL_GYM_CHECKLIST } from '../domain/equipment';
import { EXERCISES } from '../domain/exercises';
import { generate, type GenerateResult, type Inspiration } from '../domain/generator';
import { movementIdsOf, parseWodText } from '../domain/wodParser';
import { assessSafety } from '../domain/safety';
import { SYMPTOMS, type Briefing as BriefingT, type PainEntry, type WorkoutPlan } from '../domain/schemas';
import { FOCUS_LABEL, INTENSITY_LABEL, INTENSITY_ORDER, JOINT_LABEL, JOINTS, LOCATION_LABEL, type Focus, type Intensity, type Joint, type Location } from '../domain/taxonomy';
import { useEquipment, usePerformed, usePrescribedMap, useProfile, useSuggestion, useTodayCheckin } from '../lib/hooks';
import { localDate, uid } from '../lib/util';

const TIMES = [15, 20, 30, 45, 60];
const DRAFT_KEY = 'cg.briefing.draft';

function loadDraft(): Partial<BriefingT> | null {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null'); } catch { return null; }
}

export default function Briefing() {
  const today = localDate();
  const nav = useNavigate();
  const suggestion = useSuggestion(today);
  const equipment = useEquipment();
  const performed = usePerformed();
  const prescribedById = usePrescribedMap();
  const checkin = useTodayCheckin(today);
  const profile = useProfile();
  const [params] = useSearchParams();
  const inspireId = params.get('inspirar');
  const officialWod = useLiveQuery(() => (inspireId ? db.officialWods.get(inspireId) : undefined), [inspireId]);
  const inspiration: Inspiration | undefined = useMemo(() => (officialWod
    ? { officialId: officialWod.id, title: officialWod.title, exerciseIds: movementIdsOf(parseWodText(officialWod.text, today).blocks) }
    : undefined), [officialWod, today]);

  const [b, setB] = useState<BriefingT>(() => ({
    location: 'home', minutes: 30, focus: 'auto', intensity: 'moderate', energy: 7, sleep: 7, symptoms: [], pains: [],
    preferred: [], avoided: [], dayEquipment: [], canRunOutside: false, notes: '', locks: {}, seed: Math.floor(Math.random() * 1e6),
    ...loadDraft(),
  }));
  const [symptomsAnswered, setSymptomsAnswered] = useState(false);
  const [painAnswered, setPainAnswered] = useState(false);
  const [freeTime, setFreeTime] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...b, symptoms: [], pains: [] })); } catch { /* ignore */ } }, [b]);
  useEffect(() => {
    if (checkin) {
      setB((x) => ({ ...x, energy: checkin.energy, sleep: checkin.sleep, symptoms: checkin.symptoms, pains: checkin.pains }));
      setSymptomsAnswered(true);
      setPainAnswered(true);
    }
  }, [checkin]);
  useEffect(() => {
    if (profile) setB((x) => ({ ...x, preferred: x.preferred.length ? x.preferred : profile.preferredMovements, avoided: x.avoided.length ? x.avoided : profile.avoidedMovements }));
  }, [profile]);

  const set = <K extends keyof BriefingT>(k: K, v: BriefingT[K]) => { setB((x) => ({ ...x, [k]: v })); setResult(null); };
  const safety = useMemo(() => assessSafety({ symptoms: b.symptoms, pains: b.pains, energy: b.energy, sleep: b.sleep }), [b.symptoms, b.pains, b.energy, b.sleep]);
  const ready = symptomsAnswered && painAnswered;

  async function run(next: BriefingT = b) {
    setError(null);
    try {
      // Check-in do dia: dado datado, nunca presumido para datas futuras.
      const existing = await db.checkins.where('event_date').equals(today).last();
      const ck = { ...(existing ?? baseFields('user_report', 1, true, today)), event_date: today, energy: next.energy, sleep: next.sleep, symptoms: next.symptoms, pains: next.pains, updated_at: new Date().toISOString() };
      await db.checkins.put(ck);
      const r = generate(next, { today, equipment, performed, prescribedById, checkin: ck }, inspiration);
      setResult(r);
      await db.recommendations.put({
        ...baseFields('generated_plan', r.suggestion.confidence, false, today), id: uid('rec'), event_date: today, focus: r.suggestion.focus,
        intensity: r.suggestion.intensity, headline: r.suggestion.headline, reasons: r.suggestion.reasons, analysisConfidence: r.suggestion.confidence,
      });
      setTimeout(() => document.getElementById('options')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function choose(plan: WorkoutPlan) {
    const id = uid('planned');
    await db.planned.add({ ...baseFields('generated_plan', result?.suggestion.confidence ?? 0.5, false, today), id, event_date: today, briefing: b, recommended: plan, edited: null, status: 'draft' });
    nav(`/revisar/${id}`);
  }

  const regenerate = (patch: Partial<BriefingT> = {}) => {
    const next = { ...b, ...patch, seed: b.seed + 17 };
    setB(next);
    void run(next);
  };

  const exerciseOptions = EXERCISES.map((e) => ({ value: e.id, label: e.name_pt }));

  return (
    <Page title="Briefing do treino" subtitle="Comece pela sugestão e ajuste o que quiser antes de gerar." back="/">
      {inspiration && <Notice>Inspirado no WOD oficial <b>{inspiration.title}</b>: o resultado será uma adaptação própria do CG Performance (não é a programação oficial), com scaling para seus equipamentos e check-in de hoje.</Notice>}
      <Card title="Ponto de partida sugerido" right={<ConfidenceBadge value={suggestion.confidence} />}>
        <p className="font-semibold text-bone-50">{suggestion.headline}</p>
        <ul className="mt-1 space-y-1 text-sm text-bone-300">{suggestion.reasons.slice(0, 3).map((r, i) => <li key={i}>• {r}</li>)}</ul>
      </Card>

      <Card title="Local">
        <Chips testId="location" options={(Object.keys(LOCATION_LABEL) as Location[]).map((l) => ({ value: l, label: LOCATION_LABEL[l] }))} value={b.location} onChange={(v) => set('location', v)} />
        {b.location === 'home' && <p className="mt-2 text-xs text-bone-400">Usa somente equipamentos confirmados ({equipment.filter((e) => e.confirmed && e.available).length} de {equipment.length}). <Link to="/equipamentos" className="text-petrol-300">Gerenciar</Link></p>}
        {b.location === 'hotel_room' && <p className="mt-2 text-xs text-bone-400">Silencioso, sem saltos e em pouco espaço.</p>}
        {b.location === 'hotel_gym' && (
          <div className="mt-3">
            <span className="label">O que existe nesta academia hoje?</span>
            <Chips multi testId="hotel-equipment" options={HOTEL_GYM_CHECKLIST.map((t) => ({ value: t, label: EQUIPMENT_TYPES[t] }))} value={b.dayEquipment}
              onChange={(v) => set('dayEquipment', b.dayEquipment.includes(v) ? b.dayEquipment.filter((x) => x !== v) : [...b.dayEquipment, v])} />
            <p className="mt-2 text-xs text-bone-400">Vale só para hoje; o inventário de casa não muda.</p>
          </div>
        )}
        {b.location !== 'hotel_room' && (
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={b.canRunOutside} onChange={(e) => set('canRunOutside', e.target.checked)} /> Posso correr na rua hoje</label>
        )}
      </Card>

      <Card title="Tempo">
        <Chips testId="time" options={[...TIMES.map((t) => ({ value: String(t), label: `${t} min` })), { value: 'free', label: 'Livre' }]} value={freeTime ? 'free' : String(b.minutes)}
          onChange={(v) => { if (v === 'free') setFreeTime(true); else { setFreeTime(false); set('minutes', Number(v)); } }} />
        {freeTime && <input className="input mt-2" type="number" min={10} max={90} value={b.minutes} onChange={(e) => set('minutes', Math.min(90, Math.max(10, Number(e.target.value) || 30)))} aria-label="Minutos" />}
      </Card>

      <Card title="Foco">
        <Chips testId="focus" options={(Object.keys(FOCUS_LABEL) as Focus[]).map((f) => ({ value: f, label: f === 'auto' ? `Aceitar sugestão (${FOCUS_LABEL[suggestion.focus].toLowerCase()})` : FOCUS_LABEL[f] }))} value={b.focus} onChange={(v) => set('focus', v)} />
        <label className="mt-3 block">
          <span className="label">Preferir um movimento específico (opcional)</span>
          <select className="input" value={b.movementFocus ?? ''} onChange={(e) => set('movementFocus', e.target.value || undefined)} data-testid="movement-focus">
            <option value="">—</option>
            {exerciseOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </Card>

      <Card title="Prontidão e sintomas (check-in de hoje)">
        <div className="grid grid-cols-2 gap-4">
          <Slider label="Energia" value={b.energy} onChange={(v) => set('energy', v)} left="exausto" right="ótimo" testId="energy" />
          <Slider label="Sono" value={b.sleep} onChange={(v) => set('sleep', v)} left="péssimo" right="ótimo" testId="sleep" />
        </div>
        <div className="mt-4">
          <span className="label">Sintomas hoje</span>
          <Chips multi testId="symptoms" options={(Object.keys(SYMPTOMS) as Array<keyof typeof SYMPTOMS>).map((k) => ({ value: k, label: SYMPTOMS[k].label }))} value={b.symptoms}
            onChange={(v) => { setSymptomsAnswered(true); set('symptoms', b.symptoms.includes(v) ? b.symptoms.filter((x) => x !== v) : [...b.symptoms, v]); }} />
          <button type="button" className={`chip mt-2 ${symptomsAnswered && !b.symptoms.length ? 'chip-on' : ''}`} onClick={() => { setSymptomsAnswered(true); set('symptoms', []); }} data-testid="no-symptoms">Nenhum sintoma hoje</button>
        </div>
        <div className="mt-4">
          <span className="label">Dor agora</span>
          {b.pains.map((p, i) => (
            <div key={i} className="mb-2 rounded-xl bg-ink-850 p-3">
              <div className="flex items-center justify-between gap-2">
                <select className="input max-w-[50%]" value={p.joint} onChange={(e) => set('pains', b.pains.map((x, j) => (j === i ? { ...x, joint: e.target.value as Joint } : x)))}>
                  {JOINTS.map((j) => <option key={j} value={j}>{JOINT_LABEL[j]}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.acute} onChange={(e) => set('pains', b.pains.map((x, j) => (j === i ? { ...x, acute: e.target.checked } : x)))} /> aguda/súbita</label>
                <button className="btn-ghost" onClick={() => set('pains', b.pains.filter((_, j) => j !== i))}>remover</button>
              </div>
              <Slider label="Intensidade da dor" value={p.level} onChange={(v) => set('pains', b.pains.map((x, j) => (j === i ? { ...x, level: v } : x)))} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="chip" onClick={() => { setPainAnswered(true); set('pains', [...b.pains, { joint: 'shoulder', level: 3, acute: false } as PainEntry]); }}>+ Registrar dor</button>
            <button type="button" className={`chip ${painAnswered && !b.pains.length ? 'chip-on' : ''}`} onClick={() => { setPainAnswered(true); set('pains', []); }} data-testid="no-pain">Sem dor</button>
          </div>
        </div>
        {safety.messages.length > 0 && <div className="mt-4"><Notice tone={safety.level === 'urgent' || safety.level === 'stop' ? 'danger' : 'warn'}>{safety.messages.map((m, i) => <p key={i}>{m}</p>)}</Notice></div>}
      </Card>

      <Card title="Intensidade">
        <Chips testId="intensity" options={INTENSITY_ORDER.map((i) => ({ value: i, label: INTENSITY_LABEL[i] + (INTENSITY_ORDER.indexOf(i) > INTENSITY_ORDER.indexOf(safety.maxIntensity) ? ' (limitada hoje)' : '') }))} value={b.intensity} onChange={(v) => set('intensity', v as Intensity)} />
        {INTENSITY_ORDER.indexOf(b.intensity) > INTENSITY_ORDER.indexOf(safety.maxIntensity) && <p className="mt-2 text-xs text-warn">Pelo check-in, o treino será gerado com no máximo {INTENSITY_LABEL[safety.maxIntensity].toLowerCase()}.</p>}
      </Card>

      <Card title="Preferências (opcional)">
        <label className="block"><span className="label">Quero incluir</span>
          <select className="input" value="" onChange={(e) => e.target.value && set('preferred', [...new Set([...b.preferred, e.target.value])])}>
            <option value="">+ adicionar movimento</option>{exerciseOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></label>
        <div className="mt-2 flex flex-wrap gap-1">{b.preferred.map((id) => <button key={id} className="chip chip-on" onClick={() => set('preferred', b.preferred.filter((x) => x !== id))}>{EXERCISES.find((e) => e.id === id)?.name_pt} ✕</button>)}</div>
        <label className="mt-3 block"><span className="label">Quero evitar</span>
          <select className="input" value="" onChange={(e) => e.target.value && set('avoided', [...new Set([...b.avoided, e.target.value])])} data-testid="avoid">
            <option value="">+ adicionar movimento</option>{exerciseOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></label>
        <div className="mt-2 flex flex-wrap gap-1">{b.avoided.map((id) => <button key={id} className="chip border-danger/60 text-danger" onClick={() => set('avoided', b.avoided.filter((x) => x !== id))}>{EXERCISES.find((e) => e.id === id)?.name_pt} ✕</button>)}</div>
        <label className="mt-3 block"><span className="label">Observações</span><textarea className="input" rows={2} value={b.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: quero sair suado, mas sem pesar nos ombros" /></label>
      </Card>

      {!ready && <Notice tone="warn">Responda sintomas e dor de hoje para gerar — o app não presume seu estado.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      <button className="btn-primary w-full text-base" disabled={!ready} onClick={() => run()} data-testid="generate">Gerar opções de treino</button>

      {result && (
        <div id="options" className="flex flex-col gap-4" data-testid="options">
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary flex-1" onClick={() => regenerate()} data-testid="regenerate">↻ Regerar</button>
            <button className="btn-secondary flex-1" onClick={() => regenerate({ focus: 'auto', locks: {}, movementFocus: undefined })}>Usar sugestão original</button>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => regenerate({ minutes: Math.max(10, b.minutes - 5) })}>− 5 min</button>
            <button className="btn-secondary flex-1" onClick={() => regenerate({ minutes: Math.min(90, b.minutes + 5) })}>+ 5 min</button>
          </div>
          {result.options.map((p) => (
            <PlanSummary key={p.id} plan={p} onChoose={() => choose(p)} />
          ))}
        </div>
      )}
    </Page>
  );
}
