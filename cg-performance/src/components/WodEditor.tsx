import { EXERCISES } from '../domain/exercises';
import type { WodBlockParsed } from '../domain/schemas';

export interface WodDraft {
  event_date: string;
  title: string;
  blocks: WodBlockParsed[];
  uncertainFields: string[];
}

const KIND_LABEL: Record<WodBlockParsed['kind'], string> = {
  warmup: 'Aquecimento', skill: 'Skill/técnica', strength: 'Força', metcon: 'WOD/metcon', accessory: 'Acessórios', cooldown: 'Volta à calma', unknown: 'Sem seção (revisar)',
};

/** Tela de revisão/correção: campos incertos ficam destacados em âmbar. */
export function WodEditor({ draft, onChange, dateOptions = [] }: { draft: WodDraft; onChange: (d: WodDraft) => void; dateOptions?: string[] }) {
  const unc = new Set(draft.uncertainFields);
  const resolve = (field: string) => draft.uncertainFields.filter((f) => f !== field);
  const setBlock = (i: number, patch: Partial<WodBlockParsed>) =>
    onChange({ ...draft, blocks: draft.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)), uncertainFields: patch.kind ? resolve(`blocks.${i}.kind`) : draft.uncertainFields });
  const setMove = (i: number, k: number, patch: Partial<WodBlockParsed['movements'][number]>) =>
    onChange({
      ...draft,
      blocks: draft.blocks.map((b, j) => (j !== i ? b : { ...b, movements: b.movements.map((m, l) => (l === k ? { ...m, ...patch, confidence: 1 } : m)) })),
      uncertainFields: resolve(`blocks.${i}.movements.${k}`),
    });

  return (
    <div className="flex flex-col gap-3" data-testid="wod-editor">
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Data do treino</span>
          <input className={`input ${unc.has('date') ? 'warn-field' : ''}`} type="date" value={draft.event_date} onChange={(e) => onChange({ ...draft, event_date: e.target.value, uncertainFields: resolve('date') })} data-testid="wod-date" />
          {dateOptions.length > 1 && <span className="text-[11px] text-bone-400">Detectadas: {dateOptions.join(', ')}</span>}
        </label>
        <label><span className="label">Título</span>
          <input className={`input ${unc.has('title') ? 'warn-field' : ''}`} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value, uncertainFields: resolve('title') })} data-testid="wod-title" />
        </label>
      </div>
      {draft.blocks.map((b, i) => (
        <div key={i} className="rounded-xl bg-ink-850 p-3">
          <div className="flex gap-2">
            <select className={`input ${unc.has(`blocks.${i}.kind`) ? 'warn-field' : ''}`} value={b.kind} onChange={(e) => setBlock(i, { kind: e.target.value as WodBlockParsed['kind'] })}>
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="input" placeholder="formato (AMRAP 12, For Time…)" value={b.format ?? ''} onChange={(e) => setBlock(i, { format: e.target.value })} />
            <button className="btn-ghost" onClick={() => onChange({ ...draft, blocks: draft.blocks.filter((_, j) => j !== i) })} aria-label="Remover bloco">✕</button>
          </div>
          <div className="mt-2 space-y-2">
            {b.movements.map((m, k) => (
              <div key={k} className={`grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 ${unc.has(`blocks.${i}.movements.${k}`) ? 'border-warn bg-warn/5' : 'border-ink-700'}`}>
                <select className="input py-1.5 text-sm" value={m.exerciseId ?? ''} onChange={(e) => setMove(i, k, { exerciseId: e.target.value || null })} data-testid="movement-select">
                  <option value="">— não reconhecido —</option>
                  {EXERCISES.map((e) => <option key={e.id} value={e.id}>{e.name_pt}</option>)}
                </select>
                <input className="input w-20 py-1.5 text-sm" type="number" placeholder="reps" value={m.reps ?? ''} onChange={(e) => setMove(i, k, { reps: e.target.value ? Number(e.target.value) : undefined })} />
                <div className="col-span-2 flex items-center gap-2 text-xs text-bone-400">
                  <span className="truncate">texto: “{m.raw}”</span>
                  <input className="input ml-auto w-32 py-1 text-xs" placeholder="carga prescrita" value={m.loadText ?? ''} onChange={(e) => setMove(i, k, { loadText: e.target.value || undefined })} />
                  <button className="btn-ghost" onClick={() => setBlock(i, { movements: b.movements.filter((_, l) => l !== k) })}>✕</button>
                </div>
              </div>
            ))}
            <button className="chip" onClick={() => setBlock(i, { movements: [...b.movements, { exerciseId: null, raw: '(adicionado manualmente)', confidence: 1 }] })}>+ movimento</button>
          </div>
        </div>
      ))}
      <button className="chip self-start" onClick={() => onChange({ ...draft, blocks: [...draft.blocks, { kind: 'metcon', title: 'WOD', text: '', movements: [] }] })}>+ bloco</button>
      <p className="text-xs text-bone-400">Cargas aqui são <b>prescritas pelo box</b>, nunca resultados seus.</p>
    </div>
  );
}
