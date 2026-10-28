import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SourceType } from '../domain/schemas';

export function Page({ title, subtitle, back, actions, children }: { title: string; subtitle?: ReactNode; back?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-5 safe-bottom">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {back && <Link to={back} className="mb-1 inline-block text-sm text-petrol-300">‹ Voltar</Link>}
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="h3">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chips<T extends string>({ options, value, onChange, multi = false, testId }: {
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  value: T | T[];
  onChange: (v: T) => void;
  multi?: boolean;
  testId?: string;
}) {
  const isOn = (v: T) => (multi ? (value as T[]).includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((o) => (
        <button key={o.value} type="button" disabled={o.disabled} aria-pressed={isOn(o.value)} onClick={() => onChange(o.value)}
          className={`chip ${isOn(o.value) ? 'chip-on' : ''} disabled:opacity-40`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-ink-850 p-3">
      <div className="text-[11px] uppercase tracking-wider text-bone-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-bone-50">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-bone-400">{hint}</div>}
    </div>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.7 ? 'bg-petrol-500/20 text-petrol-300' : value >= 0.4 ? 'bg-warn/20 text-warn' : 'bg-danger/20 text-danger';
  return <span className={`badge ${tone}`} title="Confiança da análise: quantidade e qualidade dos dados recentes">confiança {pct}%</span>;
}

const SOURCE_LABEL: Record<SourceType, string> = {
  user_report: 'relato do atleta', user_manual_entry: 'entrada manual', image_ocr_reviewed: 'print revisado', image_ocr_unreviewed: 'OCR não revisado',
  chat_summary_index: 'índice (validar)', official_wod: 'oficial sincronizado', official_manual: 'oficial (manual)', generated_plan: 'gerado pelo app',
  csv_import: 'CSV importado', json_import: 'backup JSON', seed: 'semente',
};

export function SourceBadge({ source }: { source: SourceType }) {
  const tone = source === 'chat_summary_index' || source === 'image_ocr_unreviewed' ? 'bg-warn/15 text-warn' : 'bg-ink-700 text-bone-300';
  return <span className={`badge ${tone}`}>{SOURCE_LABEL[source] ?? source}</span>;
}

export function Slider({ label, value, onChange, min = 0, max = 10, testId, left, right }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; testId?: string; left?: string; right?: string }) {
  return (
    <label className="block">
      <span className="label flex justify-between"><span>{label}</span><span className="text-bone-100">{value}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" data-testid={testId} />
      {(left || right) && <span className="flex justify-between text-[11px] text-bone-400"><span>{left}</span><span>{right}</span></span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-ink-600 p-4 text-center text-sm text-bone-400">{children}</div>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  const cls = tone === 'danger' ? 'border-danger/60 bg-danger/10 text-bone-50' : tone === 'warn' ? 'border-warn/60 bg-warn/10 text-bone-50' : 'border-petrol-600/60 bg-petrol-600/10 text-bone-100';
  return <div role={tone === 'danger' ? 'alert' : undefined} className={`rounded-xl border p-3 text-sm ${cls}`}>{children}</div>;
}

/** Confirmação em dois toques (diálogos nativos de confirmação não aparecem em todos os ambientes). */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn-ghost text-danger' }: { label: string; confirmLabel: string; onConfirm: () => void | Promise<void>; className?: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button type="button" className={className} onClick={() => setArmed(true)}>{label}</button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="btn-danger px-3 py-2 text-sm" onClick={async () => { setArmed(false); await onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="btn-ghost" onClick={() => setArmed(false)}>Cancelar</button>
    </span>
  );
}
