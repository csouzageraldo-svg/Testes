/** Parser do CSV de composição corporal exportado da planilha (cabeçalho em pt-BR). */
export interface BodyCompRow {
  event_date: string;
  weightKg?: number; musclePct?: number; fatPct?: number; visceralLevel?: number;
  muscleKgEst?: number; fatKgEst?: number; bmi?: number; bmrKcal?: number; bodyAge?: number;
}

const COLS: Record<string, keyof BodyCompRow> = {
  data: 'event_date', date: 'event_date', peso_kg: 'weightKg', peso: 'weightKg', musculo_percent: 'musclePct',
  gordura_percent: 'fatPct', gordura_visceral_nivel: 'visceralLevel', peso_muscular_estimado_kg: 'muscleKgEst',
  peso_gordura_estimado_kg: 'fatKgEst', imc: 'bmi', metabolismo_reposo_kcal: 'bmrKcal', idade_corporal_anos: 'bodyAge',
};

function toIsoDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

export function parseBodyCompCsv(text: string): { rows: BodyCompRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], errors: ['Arquivo vazio'] };
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const errors: string[] = [];
  const rows: BodyCompRow[] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = line.split(sep);
    const row: Partial<BodyCompRow> = {};
    header.forEach((h, j) => {
      const key = COLS[h];
      const v = (cells[j] ?? '').trim();
      if (!key || v === '') return;
      if (key === 'event_date') {
        const d = toIsoDate(v);
        if (d) row.event_date = d; else errors.push(`Linha ${i + 2}: data inválida "${v}"`);
      } else {
        const n = Number(v.replace(',', '.'));
        if (Number.isFinite(n)) (row as Record<string, number>)[key] = n;
        else errors.push(`Linha ${i + 2}: valor inválido em ${h}`);
      }
    });
    if (row.event_date) rows.push(row as BodyCompRow);
  });
  return { rows, errors };
}
