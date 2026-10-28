import { Link, useParams } from 'react-router-dom';
import { ExerciseAnimation } from '../animation/StickFigure';
import { Card, Page } from '../components/ui';
import { EQUIPMENT_TYPES } from '../domain/equipment';
import { EXERCISE_BY_ID, OFFICIAL_MOVEMENTS_URL } from '../domain/exercises';
import { CAPACITY_LABEL, ENERGY_LABEL, JOINT_LABEL, MODALITY_LABEL, MUSCLE_LABEL, PATTERN_LABEL, type Joint, type Muscle } from '../domain/taxonomy';

export default function ExerciseDetail() {
  const { id = '' } = useParams();
  const e = EXERCISE_BY_ID[id];
  if (!e) return <Page title="Exercício" back="/biblioteca"><p className="muted">Não encontrado.</p></Page>;
  const muscles = (Object.entries(e.muscles) as Array<[Muscle, number]>).sort((a, b) => b[1] - a[1]);
  return (
    <Page title={e.name_pt} subtitle={`${e.name_en} · ${MODALITY_LABEL[e.modality]}`} back="/biblioteca">
      <Card>
        <ExerciseAnimation exerciseId={e.id} size={240} />
        <p className="mt-2 text-center text-[11px] text-bone-400">Animação ilustrativa original do CG Performance (vista lateral). Não substitui orientação de coach.</p>
      </Card>
      <Card title="Para que serve"><p className="text-sm text-bone-200">{e.purpose}</p></Card>
      <Card title="Como fazer"><ol className="list-decimal space-y-1 pl-5 text-sm text-bone-200">{e.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol></Card>
      {e.errors.length > 0 && <Card title="Erros comuns"><ul className="space-y-1 text-sm text-bone-200">{e.errors.map((s, i) => <li key={i}>⚠ {s}</li>)}</ul></Card>}
      <Card title="Scaling">
        <div className="text-sm">
          <div className="text-bone-400">Mais fácil:</div>
          <div className="mb-2 flex flex-wrap gap-2">{e.easier.length ? e.easier.map((x) => <Link key={x} to={`/biblioteca/${x}`} className="chip" data-testid="scale-easier">{EXERCISE_BY_ID[x]?.name_pt}</Link>) : <span className="text-bone-400">reduza volume, amplitude ou carga</span>}</div>
          <div className="text-bone-400">Mais difícil:</div>
          <div className="flex flex-wrap gap-2">{e.harder.length ? e.harder.map((x) => <Link key={x} to={`/biblioteca/${x}`} className="chip">{EXERCISE_BY_ID[x]?.name_pt}</Link>) : <span className="text-bone-400">aumente volume, carga ou velocidade</span>}</div>
        </div>
      </Card>
      <Card title="Músculos (contribuição estimada)">
        {muscles.map(([m, w]) => (
          <div key={m} className="mb-1.5">
            <div className="flex justify-between text-xs text-bone-300"><span>{MUSCLE_LABEL[m]}</span><span>{Math.round(w * 100)}%</span></div>
            <div className="h-1.5 rounded-full bg-ink-700"><div className="h-1.5 rounded-full bg-petrol-500" style={{ width: `${w * 100}%` }} /></div>
          </div>
        ))}
      </Card>
      <Card title="Metadados">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-bone-400">Padrões</dt><dd>{e.patterns.map((p) => PATTERN_LABEL[p]).join(', ')}</dd>
          <dt className="text-bone-400">Capacidades</dt><dd>{e.capacities.map((c) => CAPACITY_LABEL[c]).join(', ')}</dd>
          <dt className="text-bone-400">Domínios</dt><dd>{e.domains.map((d) => ENERGY_LABEL[d]).join(', ')}</dd>
          <dt className="text-bone-400">Articulações</dt><dd>{(Object.keys(e.joints) as Joint[]).map((j) => JOINT_LABEL[j]).join(', ') || '—'}</dd>
          <dt className="text-bone-400">Complexidade</dt><dd>{e.complexity}/5</dd>
          <dt className="text-bone-400">Impacto / ruído</dt><dd>{e.impact} / {e.noise}</dd>
          <dt className="text-bone-400">Equipamento</dt><dd>{e.equipment.length ? e.equipment.map((alt) => alt.length ? alt.map((t) => EQUIPMENT_TYPES[t]).join(' + ') : 'peso corporal').join(' ou ') : 'peso corporal'}</dd>
          {e.unsupervisedMax && <><dt className="text-bone-400">Em casa sem supervisão</dt><dd>até intensidade {e.unsupervisedMax}</dd></>}
        </dl>
      </Card>
      <a className="btn-secondary w-full" href={OFFICIAL_MOVEMENTS_URL} target="_blank" rel="noreferrer">Referência oficial: biblioteca de movimentos CrossFit ↗</a>
      <p className="text-center text-[11px] text-bone-400">Link externo para consulta (busque por “{e.name_en}”). Vídeos oficiais não são incorporados nem copiados.</p>
    </Page>
  );
}
