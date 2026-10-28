import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Card, Notice, Page } from '../components/ui';
import { db } from '../db/db';
import { addAsset, audit, baseFields, revise } from '../db/repo';
import type { EquipmentItem, UploadedAsset } from '../db/types';
import { EQUIPMENT_TYPES, SPACE_OBSERVATIONS, type EquipmentType } from '../domain/equipment';
import { useEquipment } from '../lib/hooks';
import { uid } from '../lib/util';

function Photo({ a }: { a: UploadedAsset }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { const u = URL.createObjectURL(a.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [a]);
  return url ? <a href={url} target="_blank" rel="noreferrer" className="shrink-0"><img src={url} alt={a.name} className="h-32 w-24 rounded-lg object-cover" /><div className="mt-0.5 text-center text-[10px] text-bone-400">{a.name}</div></a> : null;
}

export default function Equipment() {
  const items = useEquipment();
  const photos = useLiveQuery(() => db.assets.where('kind').equals('equipment_photo').toArray(), []) ?? [];
  const [newType, setNewType] = useState<EquipmentType>('kettlebell');
  const [newLabel, setNewLabel] = useState('');

  async function patch(it: EquipmentItem, p: Partial<EquipmentItem>) {
    const after = { ...it, ...p, updated_at: new Date().toISOString(), verified_by_user: p.confirmed ?? it.verified_by_user };
    await db.equipment.put(after);
    await revise('equipment', it.id, it, after, 'edição do inventário');
  }

  const confirmed = items.filter((i) => i.confirmed).length;
  return (
    <Page title="Equipamentos" subtitle={`${confirmed} de ${items.length} confirmados. O treino "Casa" usa apenas itens confirmados e disponíveis.`} back="/mais">
      <Notice>A lista abaixo foi <b>identificada nas fotos</b> do home gym e precisa da sua confirmação. Confirme quantidades e cargas só quando tiver certeza — sem carga confirmada, o app prescreve por RPE.</Notice>
      <Card title={`Fotos (${photos.length})`}>
        <div className="flex gap-2 overflow-x-auto pb-1">{photos.map((a) => <Photo key={a.id} a={a} />)}</div>
        <label className="btn-secondary mt-2 w-full cursor-pointer">+ Adicionar foto
          <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) await addAsset(f, f.name, 'equipment_photo', 'upload'); e.target.value = ''; }} />
        </label>
      </Card>

      {items.map((it) => (
        <section key={it.id} className={`card ${it.confirmed ? 'border-petrol-600/70' : ''}`} data-testid="equipment-item">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-bone-50">{it.label}</div>
              <div className="text-xs text-bone-400">{EQUIPMENT_TYPES[it.type]}{it.evidence ? ` · ${it.evidence}` : ''}{it.photoRefs.length ? ` · fotos ${it.photoRefs.join(', ')}` : ''}</div>
            </div>
            <button className={`chip shrink-0 ${it.confirmed ? 'chip-on' : ''}`} onClick={() => patch(it, { confirmed: !it.confirmed })} data-testid={`confirm-${it.key}`}>{it.confirmed ? '✓ confirmado' : 'confirmar'}</button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <label><span className="label">Qtd.</span><input className="input py-1.5" type="number" min={0} value={it.quantity ?? ''} onChange={(e) => patch(it, { quantity: e.target.value ? Number(e.target.value) : undefined })} /></label>
            <label><span className="label">Carga (kg)</span><input className="input py-1.5" type="number" min={0} step={0.5} value={it.loadKg ?? ''} onChange={(e) => patch(it, { loadKg: e.target.value ? Number(e.target.value) : undefined })} /></label>
            <label className="flex items-end gap-1 pb-2"><input type="checkbox" checked={it.available} onChange={(e) => patch(it, { available: e.target.checked })} /> disponível</label>
          </div>
          {it.loadNote && <p className="mt-1 text-xs text-warn">{it.loadNote}</p>}
          {it.safetyNote && <p className="mt-1 text-xs text-bone-300">🛡 {it.safetyNote}</p>}
        </section>
      ))}

      <Card title="Adicionar item">
        <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as EquipmentType)}>{(Object.keys(EQUIPMENT_TYPES) as EquipmentType[]).map((t) => <option key={t} value={t}>{EQUIPMENT_TYPES[t]}</option>)}</select>
        <input className="input mt-2" placeholder="Descrição (ex.: kettlebell 16 kg)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <button className="btn-primary mt-2 w-full" onClick={async () => {
          const key = `${newType}_${uid().slice(0, 6)}`;
          await db.equipment.add({ ...baseFields('user_manual_entry', 1, true), id: `eq_${key}`, key, type: newType, label: newLabel || EQUIPMENT_TYPES[newType], confirmed: true, available: true, photoRefs: [] });
          await audit('equipment.add', key); setNewLabel('');
        }}>Adicionar (confirmado)</button>
      </Card>

      <Card title="Espaço (observações das fotos — confirmar)">
        <ul className="space-y-1 text-sm text-bone-300">{SPACE_OBSERVATIONS.map((s, i) => <li key={i}>• {s}</li>)}</ul>
      </Card>
    </Page>
  );
}
