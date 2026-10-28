import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Card, ConfidenceBadge, Empty, Notice, Page, Stat } from '../components/ui';
import { db } from '../db/db';
import { SYMPTOMS, type SymptomKey } from '../domain/schemas';
import { FOCUS_LABEL, INTENSITY_LABEL, placeLabel } from '../domain/taxonomy';
import { usePerformed, useProfile, useSuggestion, useTodayCheckin } from '../lib/hooks';
import { formatDateBR, localDate } from '../lib/util';

const GROUP_LABEL = { upper: 'Superiores', legs: 'Pernas', core: 'Core', cardio: 'Cardio' } as const;

export default function Today() {
  const today = localDate();
  const profile = useProfile();
  const s = useSuggestion(today);
  const performed = usePerformed();
  const checkin = useTodayCheckin(today);
  const nextEvent = useLiveQuery(() => db.officialEvents.where('start_date').aboveOrEqual(today).first(), [today]);
  const officialWod = useLiveQuery(() => db.officialWods.orderBy('publication_date').last(), []);
  const pendingImports = useLiveQuery(() => db.importJobs.where('status').anyOf('queued', 'review').count(), []) ?? 0;
  const goal = profile?.goals.sessionsPerWeek ?? [3, 5];
  const groups = s.windows.d14.groups;
  const total = Object.values(groups).reduce((a, b) => a + b, 0);
  const rawDate = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const sess = (n: number) => `${n} ${n === 1 ? 'sessão' : 'sessões'}`;

  return (
    <Page title={`Olá, ${profile?.displayName ?? 'atleta'}`} subtitle={dateLabel}>
      <Card title="Sugestão de hoje" right={<ConfidenceBadge value={s.confidence} />}>
        <p className="text-lg font-semibold text-bone-50" data-testid="suggestion-headline">{s.headline}</p>
        <ul className="mt-2 space-y-1 text-sm text-bone-300">
          {s.reasons.slice(0, 4).map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="badge bg-ink-700 text-bone-300">foco: {FOCUS_LABEL[s.focus]}</span>
          <span className="badge bg-ink-700 text-bone-300">intensidade: {INTENSITY_LABEL[s.intensity]}</span>
        </div>
        <Link to="/treinar" className="btn-primary mt-4 w-full text-base" data-testid="cta-build">Montar meu treino</Link>
        <p className="mt-2 text-center text-xs text-bone-400">Você pode aceitar ou mudar foco, tempo, local e intensidade no próximo passo.</p>
      </Card>

      {checkin ? (
        <Notice tone={checkin.symptoms.some((k) => (SYMPTOMS[k as SymptomKey]?.severity ?? 'caution') !== 'caution') ? 'danger' : 'info'}>
          Check-in de hoje: energia {checkin.energy}/10 · sono {checkin.sleep}/10
          {checkin.symptoms.length > 0 && <> · sintomas: {checkin.symptoms.map((k) => SYMPTOMS[k as SymptomKey]?.label ?? k).join(', ')}</>}
        </Notice>
      ) : (
        <Notice>Sem check-in hoje. Ele é feito no briefing, antes de gerar o treino — sintomas de dias anteriores não são presumidos.</Notice>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Últimos 7 dias" value={sess(s.windows.d7.sessions)} hint={`meta ${goal[0]}–${goal[1]}/semana`} />
        <Stat label="Desde o último treino" value={s.daysSinceLast == null ? '—' : s.daysSinceLast === 0 ? 'hoje' : `${s.daysSinceLast} dia(s)`} />
        <Stat label="14 dias" value={sess(s.windows.d14.sessions)} hint={s.windows.d14.avgRpe ? `RPE médio ${s.windows.d14.avgRpe.toFixed(1)}` : 'sem RPE registrado'} />
        <Stat label="30 dias" value={sess(s.windows.d30.sessions)} hint={`${Math.round(s.windows.d30.workMin)} min de trabalho estimado`} />
      </div>

      <Card title="Distribuição de estímulo — 14 dias">
        {total > 0 ? (
          <div className="space-y-2">
            {(Object.keys(GROUP_LABEL) as Array<keyof typeof GROUP_LABEL>).map((g) => (
              <div key={g}>
                <div className="flex justify-between text-xs text-bone-300"><span>{GROUP_LABEL[g]}</span><span>{Math.round((groups[g] / total) * 100)}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-ink-700"><div className="h-2 rounded-full bg-petrol-500" style={{ width: `${(groups[g] / total) * 100}%` }} /></div>
              </div>
            ))}
            <p className="pt-1 text-xs text-bone-400">Estimativa de exposição a partir dos treinos realizados registrados (não mede recuperação). <Link className="text-petrol-300" to="/evolucao">Ver mapa corporal</Link></p>
          </div>
        ) : <Empty>Registre um treino realizado para ver a distribuição.</Empty>}
      </Card>

      <Card title="Últimos treinos realizados" right={<Link to="/historico" className="text-sm text-petrol-300">ver tudo</Link>}>
        {performed.filter((w) => w.status !== 'not_done').slice(0, 3).map((w) => (
          <div key={w.id} className="flex items-center justify-between border-b border-ink-700 py-2 last:border-0">
            <div><div className="text-sm text-bone-50">{w.title}</div><div className="text-xs text-bone-400">{formatDateBR(w.event_date)} · {placeLabel(w.location)}</div></div>
            <span className="badge bg-ink-700 text-bone-300">{w.status === 'partial' ? 'parcial' : 'concluído'}{w.rpe != null ? ` · RPE ${w.rpe}` : ''}</span>
          </div>
        ))}
        {!performed.length && <Empty>Nenhum treino realizado registrado ainda. Prints do box contam como <b>programação</b> até você marcar “realizei”.</Empty>}
      </Card>

      {pendingImports > 0 && <Notice tone="warn">{pendingImports} print(s) aguardando revisão. <Link to="/importar" className="font-semibold text-petrol-300">Revisar</Link></Notice>}

      <Card title="CrossFit oficial" right={<Link to="/fontes" className="text-sm text-petrol-300">fontes</Link>}>
        <div className="space-y-2 text-sm">
          <div>WOD oficial: {officialWod ? <><b>{officialWod.title}</b> <span className="text-bone-400">({formatDateBR(officialWod.publication_date)} · {officialWod.verification === 'manual' ? 'inserido manualmente' : 'sincronizado'})</span></> : <span className="text-bone-400">não sincronizado</span>}</div>
          <div>Próximo evento: {nextEvent ? <><b>{nextEvent.name}</b> <span className="text-bone-400">({formatDateBR(nextEvent.start_date)} · {nextEvent.status})</span></> : <span className="text-bone-400">nenhum evento verificado</span>}</div>
        </div>
      </Card>
    </Page>
  );
}
