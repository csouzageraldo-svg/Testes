import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, Notice, Page } from '../components/ui';
import { WodEditor, type WodDraft } from '../components/WodEditor';
import { db } from '../db/db';
import { addAsset, confirmPrescribed, createImportJob, updatePrescribed, upsertBodyComp } from '../db/repo';
import type { ImportJob } from '../db/types';
import { parseBodyCompCsv } from '../domain/bodycomp';
import { matchMovement, parseWodText, type ParsedWod } from '../domain/wodParser';
import { localDate, nowIso } from '../lib/util';

async function ocrImages(blobs: Blob[], onProgress: (p: number) => void): Promise<string> {
  // Tesseract.js roda no navegador (WASM). Na primeira vez baixa o motor e os idiomas (por+eng) da CDN.
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['por', 'eng'], 1, { logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress(m.progress); } });
  try {
    const texts: string[] = [];
    for (const b of blobs) texts.push((await worker.recognize(b)).data.text);
    return texts.join('\n');
  } finally {
    await worker.terminate();
  }
}

function draftFrom(p: ParsedWod): WodDraft {
  return { event_date: p.dateCandidates[0]?.iso ?? localDate(), title: p.title, blocks: p.blocks, uncertainFields: p.uncertainFields };
}

function JobCard({ job }: { job: ImportJob }) {
  const assets = useLiveQuery(() => db.assets.bulkGet(job.assetIds), [job.assetIds.join()]) ?? [];
  const [urls, setUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [draft, setDraft] = useState<WodDraft | null>(null);
  const [parsed, setParsed] = useState<ParsedWod | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const u = assets.filter(Boolean).map((a) => URL.createObjectURL(a!.blob));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [assets]);
  useEffect(() => {
    if (job.status === 'review' && job.ocrText && !draft) {
      const p = parseWodText(job.ocrText, localDate());
      setParsed(p);
      setDraft(draftFrom(p));
    }
  }, [job, draft]);

  async function runOcr() {
    setProgress(0);
    try {
      const text = await ocrImages(assets.filter(Boolean).map((a) => a!.blob), setProgress);
      await db.importJobs.update(job.id, { status: 'review', ocrText: text, updated_at: nowIso() });
    } catch (e) {
      await db.importJobs.update(job.id, { status: 'error', error: `OCR indisponível (${(e as Error).message}). Digite o treino manualmente abaixo.`, updated_at: nowIso() });
    } finally {
      setProgress(null);
    }
  }

  async function confirm() {
    if (!draft) return;
    const r = await confirmPrescribed({ ...draft, rawText: job.ocrText, source_type: 'image_ocr_reviewed', assetIds: job.assetIds, confidence: 0.9 }, job.id);
    setResult(r.merged ? `Mesclado com o treino existente de ${draft.event_date} (${r.reason}). Fontes vinculadas: ${r.workout.sources.length}.` : 'Novo treino prescrito criado.');
  }

  return (
    <Card title={`${job.assetIds.length} imagem(ns) · ${job.status === 'queued' ? 'aguardando leitura' : job.status === 'review' ? 'revisar' : job.status === 'error' ? 'erro' : job.status}`}>
      <div className="flex gap-2 overflow-x-auto">{urls.map((u) => <img key={u} src={u} alt="print" className="h-36 rounded-lg" />)}</div>
      {job.status === 'queued' && <button className="btn-primary mt-3 w-full" onClick={runOcr} disabled={progress != null} data-testid="run-ocr">{progress != null ? `Lendo… ${Math.round(progress * 100)}%` : 'Ler texto (OCR)'}</button>}
      {(job.status === 'queued' || job.status === 'error') && (
        <button className="btn-secondary mt-2 w-full" onClick={() => { setDraft({ event_date: localDate(), title: '', blocks: [{ kind: 'metcon', title: 'WOD', text: '', movements: [] }], uncertainFields: ['date', 'title'] }); void db.importJobs.update(job.id, { status: 'review' }); }}>Digitar manualmente</button>
      )}
      {job.error && <Notice tone="warn">{job.error}</Notice>}
      {draft && job.status === 'review' && (
        <div className="mt-3">
          {parsed && parsed.uncertainFields.length > 0 && <Notice tone="warn">Campos em âmbar foram lidos com baixa confiança — confira com a imagem.</Notice>}
          <div className="mt-2"><WodEditor draft={draft} onChange={setDraft} dateOptions={parsed?.dateCandidates.map((d) => d.iso)} /></div>
          {job.ocrText && <details className="mt-2 text-xs text-bone-400"><summary>Texto lido</summary><pre className="whitespace-pre-wrap">{job.ocrText}</pre></details>}
          <div className="mt-3 flex gap-2">
            <button className="btn-primary flex-1" onClick={confirm} data-testid="confirm-import">Confirmar e salvar</button>
            <button className="btn-secondary" onClick={() => db.importJobs.update(job.id, { status: 'discarded' })}>Descartar</button>
          </div>
        </div>
      )}
      {result && <Notice>{result}</Notice>}
    </Card>
  );
}

export default function Import() {
  const jobs = useLiveQuery(() => db.importJobs.where('status').anyOf('queued', 'review', 'error').toArray(), []) ?? [];
  const [sameWod, setSameWod] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [textDraft, setTextDraft] = useState<WodDraft | null>(null);
  const [textResult, setTextResult] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const ids: string[] = [];
    let dups = 0;
    for (const f of Array.from(files)) {
      if (f.type.startsWith('image/')) {
        const { asset, duplicate } = await addAsset(f, f.name, 'wod_print', 'upload');
        if (duplicate) dups++; else ids.push(asset.id);
      } else if (/\.(txt|md)$/i.test(f.name)) {
        setText(await f.text());
      } else if (/\.csv$/i.test(f.name)) {
        const { rows, errors } = parseBodyCompCsv(await f.text());
        if (rows.length) { await upsertBodyComp(rows, 'csv_import', f.name); setMsg(`${rows.length} medição(ões) de composição corporal importadas.${errors.length ? ` ${errors.length} linha(s) ignoradas.` : ''}`); }
        else setMsg('CSV sem colunas reconhecidas (esperado: data, peso_kg, gordura_percent…).');
      }
    }
    if (sameWod && ids.length) await createImportJob(ids);
    else for (const id of ids) await createImportJob([id]);
    if (ids.length || dups) setMsg(`${ids.length} imagem(ns) na fila${dups ? `; ${dups} já existiam (mesmo arquivo) e foram ignoradas` : ''}.`);
  }

  async function reprocess() {
    // Reprocessamento em lote: tenta reconhecer movimentos ainda não identificados com o dicionário atual.
    let fixed = 0;
    for (const w of await db.prescribed.toArray()) {
      let changed = false;
      const blocks = w.blocks.map((b) => ({ ...b, movements: b.movements.map((m) => {
        if (m.exerciseId) return m;
        const mm = matchMovement(m.raw);
        if (!mm) return m;
        changed = true; fixed++;
        return { ...m, exerciseId: mm.id, confidence: 0.6 };
      }) }));
      if (changed) await updatePrescribed(w.id, { blocks }, 'reprocessamento em lote');
    }
    setMsg(`Reprocessamento concluído: ${fixed} movimento(s) reconhecido(s).`);
  }

  return (
    <Page title="Importar treinos" subtitle="Prints, fotos do quadro, texto ou entrada manual. Programação do box ≠ treino realizado." back="/historico">
      <Card title="Prints / fotos">
        <label className="btn-primary w-full cursor-pointer">
          Escolher imagens
          <input type="file" accept="image/*,.txt,.md,.csv" multiple className="hidden" onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} data-testid="file-input" />
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={sameWod} onChange={(e) => setSameWod(e.target.checked)} /> As imagens selecionadas são do mesmo treino</label>
        <p className="mt-2 text-xs text-bone-400">Arquivos ficam privados neste dispositivo (IndexedDB), com hash SHA-256 para detectar duplicatas. A leitura (OCR) roda no navegador; na primeira vez baixa o motor da CDN.</p>
        {msg && <div className="mt-2"><Notice>{msg}</Notice></div>}
      </Card>
      {jobs.length > 0 ? jobs.map((j) => <JobCard key={j.id} job={j} />) : <Empty>Nenhum print aguardando revisão.</Empty>}

      <Card title="Colar texto / entrada manual">
        <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ex.:\n28/10 — Bugs Bunny\nWOD\nAMRAP 15\n10 pull-ups\n15 toes-to-bar\n400m run'} data-testid="paste-text" />
        <div className="mt-2 flex gap-2">
          <button className="btn-secondary flex-1" disabled={!text.trim()} onClick={() => { const p = parseWodText(text, localDate()); setTextDraft(draftFrom(p)); setTextResult(null); }} data-testid="parse-text">Interpretar texto</button>
          <button className="btn-secondary flex-1" onClick={() => { setTextDraft({ event_date: localDate(), title: '', blocks: [{ kind: 'metcon', title: 'WOD', text: '', movements: [] }], uncertainFields: [] }); setTextResult(null); }}>Formulário em branco</button>
        </div>
        {textDraft && (
          <div className="mt-3">
            <WodEditor draft={textDraft} onChange={setTextDraft} />
            <button className="btn-primary mt-3 w-full" data-testid="confirm-text" onClick={async () => {
              const r = await confirmPrescribed({ ...textDraft, rawText: text, source_type: 'user_manual_entry', assetIds: [], confidence: 0.9 });
              setTextResult(r.merged ? `Mesclado com treino existente (${r.reason}).` : 'Treino prescrito criado.');
              setTextDraft(null); setText('');
            }}>Salvar treino prescrito</button>
          </div>
        )}
        {textResult && <div className="mt-2"><Notice>{textResult} <Link to="/historico" className="text-petrol-300">ver histórico</Link></Notice></div>}
      </Card>

      <Card title="Manutenção">
        <button className="btn-secondary w-full" onClick={reprocess}>Reprocessar movimentos não reconhecidos</button>
        <p className="mt-2 text-xs text-bone-400">Composição corporal: envie o CSV da planilha acima. Backup completo (JSON): <Link to="/dados" className="text-petrol-300">Dados & exportação</Link>.</p>
      </Card>
    </Page>
  );
}
