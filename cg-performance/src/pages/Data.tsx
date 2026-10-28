import { useEffect, useState } from 'react';
import { Card, ConfirmButton, Notice, Page } from '../components/ui';
import { ATHLETE_ID, db } from '../db/db';
import { audit, exportBackup, importBackup, revise, toCSV, wipeAll } from '../db/repo';
import type { AthleteProfile } from '../db/types';
import { buildChatSummary } from '../domain/exportSummary';
import { useProfile } from '../lib/hooks';
import { downloadText as saveFile, localDate } from '../lib/util';

const HOSTED = !!import.meta.env.VITE_HOSTED;

export default function Data() {
  const profile = useProfile();
  const [p, setP] = useState<AthleteProfile | null>(null);
  const [sensitive, setSensitive] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [exported, setExported] = useState<Array<{ name: string; text: string }>>([]);
  // Na versão hospedada downloads são bloqueados: o conteúdo aparece abaixo para copiar.
  const downloadText = (name: string, text: string, mime?: string) => {
    if (HOSTED) setExported((x) => [...x.filter((e) => e.name !== name), { name, text }]);
    else saveFile(name, text, mime);
  };
  useEffect(() => { if (profile && !p) { setP(profile); setSensitive(profile.consents.healthDataInExports); } }, [profile, p]);

  async function saveProfile() {
    if (!p || !profile) return;
    await db.profile.put({ ...p, updated_at: new Date().toISOString(), verified_by_user: true });
    await revise('profile', ATHLETE_ID, profile, p, 'edição do perfil');
    setMsg('Perfil salvo.');
  }

  async function exportCSVs() {
    const d = localDate();
    const performed = await db.performed.toArray();
    downloadText(`cg-historico-realizado-${d}.csv`, toCSV(performed.map((w) => ({ ...w, items: w.items.map((i) => `${i.exerciseId}:${i.reps ?? ''}x${i.sets ?? 1}${i.loadKg ? `@${i.loadKg}kg` : ''}`).join('|'), pains: sensitive ? w.pains : undefined, notes: sensitive ? w.notes : undefined })), ['event_date', 'title', 'status', 'location', 'focus', 'intensity', 'durationMin', 'rpe', 'breath', 'items', 'source_type', 'confidence', 'prescribedId', 'plannedId', 'notes', 'pains']), 'text/csv');
    const pres = await db.prescribed.toArray();
    downloadText(`cg-box-prescrito-${d}.csv`, toCSV(pres.map((w) => ({ ...w, movements: w.blocks.flatMap((b) => b.movements.map((m) => m.exerciseId ?? m.raw)).join('|'), sources: w.sources.length })), ['event_date', 'title', 'performed_status', 'movements', 'source_type', 'confidence', 'verified_by_user', 'sources']), 'text/csv');
    if (sensitive) downloadText(`cg-composicao-corporal-${d}.csv`, toCSV((await db.bodycomp.toArray()) as never[], ['event_date', 'weightKg', 'fatPct', 'musclePct', 'visceralLevel', 'muscleKgEst', 'fatKgEst', 'bmi', 'bmrKcal', 'bodyAge', 'device', 'source_ref']), 'text/csv');
    downloadText(`cg-equipamentos-${d}.csv`, toCSV((await db.equipment.toArray()) as never[], ['key', 'type', 'label', 'quantity', 'loadKg', 'confirmed', 'available', 'evidence']), 'text/csv');
    downloadText(`cg-recomendacoes-${d}.csv`, toCSV((await db.recommendations.toArray()).map((r) => ({ ...r, reasons: r.reasons.join(' | ') })), ['event_date', 'focus', 'intensity', 'headline', 'reasons', 'analysisConfidence']), 'text/csv');
    downloadText(`cg-preferencias-${d}.csv`, toCSV([{ ...(await db.profile.get(ATHLETE_ID)), goals: JSON.stringify(profile?.goals), birthDate: sensitive ? profile?.birthDate : undefined, limitations: sensitive ? profile?.limitations : undefined }] as never[], ['displayName', 'heightCm', 'crossfitStart', 'goals', 'preferredMovements', 'avoidedMovements', 'birthDate', 'limitations']), 'text/csv');
    await audit('export.csv', `sensíveis=${sensitive}`);
  }

  async function exportChat() {
    const md = buildChatSummary({
      today: localDate(), profile: await db.profile.get(ATHLETE_ID), performed: await db.performed.toArray(), prescribed: await db.prescribed.toArray(),
      bodycomp: await db.bodycomp.orderBy('event_date').toArray(), equipment: await db.equipment.toArray(), recommendations: await db.recommendations.orderBy('event_date').toArray(), includeSensitive: sensitive,
    });
    downloadText(`cg-resumo-para-chatgpt-${localDate()}.md`, md, 'text/markdown');
    try { await navigator.clipboard.writeText(md); setMsg('Resumo baixado e copiado para a área de transferência.'); } catch { setMsg('Resumo baixado.'); }
    await audit('export.chat', `sensíveis=${sensitive}`);
  }

  return (
    <Page title="Dados & privacidade" subtitle="Dados ficam neste dispositivo (IndexedDB). Exporte backups com frequência." back="/mais">
      {msg && <Notice>{msg}</Notice>}
      {p && (
        <Card title="Perfil">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="col-span-2"><span className="label">Nome de exibição</span><input className="input" value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} /></label>
            <label><span className="label">Nascimento</span><input className="input" type="date" value={p.birthDate ?? ''} onChange={(e) => setP({ ...p, birthDate: e.target.value || undefined })} /></label>
            <label><span className="label">Altura (cm)</span><input className="input" type="number" value={p.heightCm ?? ''} onChange={(e) => setP({ ...p, heightCm: e.target.value ? Number(e.target.value) : undefined })} /></label>
            <label><span className="label">Início CrossFit</span><input className="input" type="date" value={p.crossfitStart ?? ''} onChange={(e) => setP({ ...p, crossfitStart: e.target.value || undefined })} /></label>
            <label><span className="label">Meta sessões/semana</span><input className="input" value={p.goals.sessionsPerWeek.join('-')} onChange={(e) => { const [a, b] = e.target.value.split('-').map(Number); if (a && b) setP({ ...p, goals: { ...p.goals, sessionsPerWeek: [a, b] } }); }} /></label>
            <label><span className="label">Gordura-alvo %</span><input className="input" placeholder="15-18" defaultValue={p.goals.bodyFatTarget?.join('-') ?? ''} onBlur={(e) => { const [a, b] = e.target.value.split('-').map(Number); setP({ ...p, goals: { ...p.goals, bodyFatTarget: a && b ? [a, b] : undefined } }); }} /></label>
            <label><span className="label">Peso-alvo kg</span><input className="input" placeholder="80-85" defaultValue={p.goals.weightTarget?.join('-') ?? ''} onBlur={(e) => { const [a, b] = e.target.value.split('-').map(Number); setP({ ...p, goals: { ...p.goals, weightTarget: a && b ? [a, b] : undefined } }); }} /></label>
          </div>
          <label className="mt-2 block"><span className="label">Objetivos (um por linha)</span><textarea className="input" rows={4} value={p.goals.text.join('\n')} onChange={(e) => setP({ ...p, goals: { ...p.goals, text: e.target.value.split('\n') } })} /></label>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={p.consents.notifications} onChange={(e) => setP({ ...p, consents: { ...p.consents, notifications: e.target.checked } })} /> Notificar novas publicações oficiais (quando suportado)</label>
          <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={p.consents.healthDataInExports} onChange={(e) => { setP({ ...p, consents: { ...p.consents, healthDataInExports: e.target.checked } }); setSensitive(e.target.checked); }} /> Incluir dados de saúde nas exportações</label>
          <button className="btn-primary mt-3 w-full" onClick={saveProfile}>Salvar perfil</button>
        </Card>
      )}
      <Card title="Exportar">
        <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} data-testid="sensitive" /> Incluir dados sensíveis (dores, sintomas, notas, composição corporal, nascimento)</label>
        <div className="grid grid-cols-1 gap-2">
          <button className="btn-secondary" data-testid="export-json" onClick={async () => { const b = await exportBackup({ includeSensitive: sensitive }); downloadText(`cg-performance-backup-${localDate()}.json`, JSON.stringify(b, null, 2)); }}>Backup completo (JSON)</button>
          <button className="btn-secondary" data-testid="export-csv" onClick={exportCSVs}>Planilhas (CSV): histórico, box, composição, equipamentos, recomendações, preferências</button>
          <button className="btn-secondary" data-testid="export-chat" onClick={exportChat}>Resumo para ChatGPT/Claude (Markdown)</button>
        </div>
      </Card>
      {exported.length > 0 && (
        <Card title="Conteúdo exportado" right={<button className="btn-ghost" onClick={() => setExported([])}>fechar</button>}>
          <p className="mb-2 text-xs text-bone-400">Nesta versão no navegador o download direto é bloqueado. Copie o conteúdo e salve num arquivo com o nome indicado.</p>
          {exported.map((e) => (
            <div key={e.name} className="mb-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs"><span className="break-all text-bone-300">{e.name}</span>
                <button className="btn-secondary px-3 py-1.5 text-xs" onClick={async (ev) => { try { await navigator.clipboard.writeText(e.text); setMsg(`${e.name} copiado.`); } catch { const ta = (ev.currentTarget.parentElement?.nextElementSibling as HTMLTextAreaElement | null); ta?.select(); setMsg('Selecionei o texto: use Copiar do seu aparelho.'); } }}>Copiar</button></div>
              <textarea className="input font-mono text-[11px]" rows={6} readOnly value={e.text} />
            </div>
          ))}
        </Card>
      )}
      <Card title="Restaurar / outro dispositivo">
        <p className="mb-2 text-xs text-bone-400">Sem conta na nuvem nesta versão: para usar em outro aparelho, exporte o JSON aqui e importe lá. (Sincronização autenticada está no ROADMAP.)</p>
        <label className="btn-secondary w-full cursor-pointer">Importar backup JSON
          <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const c = await importBackup(JSON.parse(await f.text())); setMsg(`Backup importado: ${JSON.stringify(c)}`); } catch (err) { setMsg(`Arquivo inválido: ${(err as Error).message}`); } e.target.value = ''; }} />
        </label>
      </Card>
      <Card title="Apagar">
        <ConfirmButton className="btn-danger w-full" label="Apagar todos os dados locais" confirmLabel="Confirmar: apagar tudo (não tem volta)" onConfirm={async () => { await wipeAll(); location.reload(); }} />
      </Card>
    </Page>
  );
}
