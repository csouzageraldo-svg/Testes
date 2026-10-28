import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chips, Page } from '../components/ui';
import { EXERCISES } from '../domain/exercises';
import { MODALITY_LABEL, PATTERN_LABEL, type Modality } from '../domain/taxonomy';
import { normalizeText } from '../lib/util';

export default function Library() {
  const [q, setQ] = useState('');
  const [mod, setMod] = useState<'all' | Modality>('all');
  const list = useMemo(() => {
    const n = normalizeText(q);
    return EXERCISES.filter((e) => (mod === 'all' || e.modality === mod) && (!n || normalizeText([e.name_pt, e.name_en, ...e.synonyms].join(' ')).includes(n)));
  }, [q, mod]);
  return (
    <Page title="Biblioteca de exercícios" subtitle={`${EXERCISES.length} movimentos com instruções, scaling e demonstração animada original.`} back="/mais">
      <input className="input" placeholder="Buscar (pt/en)…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="lib-search" />
      <Chips options={[{ value: 'all', label: 'Todos' }, ...(Object.keys(MODALITY_LABEL) as Modality[]).map((m) => ({ value: m, label: MODALITY_LABEL[m] }))]} value={mod} onChange={(v) => setMod(v as typeof mod)} />
      <div className="grid grid-cols-1 gap-2">
        {list.map((e) => (
          <Link key={e.id} to={`/biblioteca/${e.id}`} className="card-tight flex items-center justify-between">
            <div><div className="font-semibold text-bone-50">{e.name_pt}</div><div className="text-xs text-bone-400">{e.name_en} · {e.patterns.map((p) => PATTERN_LABEL[p]).slice(0, 2).join(', ')}</div></div>
            <span className="text-petrol-300">›</span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
