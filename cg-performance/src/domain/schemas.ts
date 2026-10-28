import { z } from 'zod';

// Schemas Zod: validam saídas do motor, importações e backups (spec §10).

export const SourceType = z.enum([
  'user_report', 'user_manual_entry', 'image_ocr_reviewed', 'image_ocr_unreviewed', 'chat_summary_index',
  'official_wod', 'official_manual', 'generated_plan', 'csv_import', 'json_import', 'seed',
]);
export type SourceType = z.infer<typeof SourceType>;

export const LoadSpec = z.object({
  kind: z.enum(['rpe', 'kg', 'bodyweight', 'percent_1rm']),
  value: z.number().optional(),
  /** Origem da carga em kg: só "confirmed" pode aparecer como número. */
  note: z.string().optional(),
});
export type LoadSpec = z.infer<typeof LoadSpec>;

export const PlanItem = z.object({
  exerciseId: z.string(),
  reps: z.number().int().positive().optional(),
  durationSec: z.number().int().positive().optional(),
  distanceM: z.number().int().positive().optional(),
  calories: z.number().int().positive().optional(),
  sets: z.number().int().positive().optional(),
  restSec: z.number().int().nonnegative().optional(),
  load: LoadSpec,
  notes: z.string().optional(),
  locked: z.boolean().optional(),
});
export type PlanItem = z.infer<typeof PlanItem>;

export const BlockFormat = z.enum(['sets', 'amrap', 'emom', 'for_time', 'intervals', 'tabata', 'flow']);
export type BlockFormat = z.infer<typeof BlockFormat>;

export const PlanBlock = z.object({
  kind: z.enum(['warmup', 'skill', 'strength', 'metcon', 'accessory', 'cooldown']),
  title: z.string(),
  format: BlockFormat,
  /** AMRAP/EMOM/flow: duração do bloco; for_time: time cap. */
  timeCapMin: z.number().positive().optional(),
  rounds: z.number().int().positive().optional(),
  workSec: z.number().int().positive().optional(),
  restSec: z.number().int().nonnegative().optional(),
  items: z.array(PlanItem).min(1),
  estimatedMin: z.number().nonnegative(),
  notes: z.string().optional(),
});
export type PlanBlock = z.infer<typeof PlanBlock>;

export const WorkoutPlan = z.object({
  id: z.string(),
  option: z.enum(['A', 'B', 'C']),
  label: z.string(),
  title: z.string(),
  focus: z.string(),
  location: z.enum(['home', 'no_equipment', 'hotel_gym', 'hotel_room']),
  intensity: z.enum(['recovery', 'light', 'moderate', 'high']),
  targetMin: z.number().positive(),
  estimatedMin: z.number().positive(),
  blocks: z.array(PlanBlock).min(1),
  rationale: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  safetyNotes: z.array(z.string()),
  isRest: z.boolean().default(false),
  /** Adaptação de WOD oficial: nunca é a programação oficial. */
  inspiredByOfficialId: z.string().optional(),
  seed: z.number().int(),
  generatedAt: z.string(),
});
export type WorkoutPlan = z.infer<typeof WorkoutPlan>;

export const PainEntry = z.object({
  joint: z.enum(['shoulder', 'elbow', 'wrist', 'lumbar', 'hip', 'knee', 'ankle']),
  level: z.number().min(0).max(10),
  acute: z.boolean().default(false),
});
export type PainEntry = z.infer<typeof PainEntry>;

export const SYMPTOMS = {
  fever: { label: 'Febre', severity: 'stop' },
  systemic: { label: 'Mal-estar geral / dor no corpo', severity: 'stop' },
  chest_pain: { label: 'Dor ou aperto no peito', severity: 'urgent' },
  fainting: { label: 'Desmaio ou quase desmaio', severity: 'urgent' },
  palpitations: { label: 'Palpitações relevantes', severity: 'urgent' },
  abnormal_breath: { label: 'Falta de ar anormal (em repouso ou desproporcional)', severity: 'urgent' },
  vomiting: { label: 'Vômitos / desidratação', severity: 'stop' },
  resp_worsening: { label: 'Sintomas respiratórios piorando', severity: 'stop' },
  sore_throat: { label: 'Garganta irritada', severity: 'caution' },
  runny_nose: { label: 'Coriza / nariz entupido', severity: 'caution' },
  phlegm: { label: 'Catarro sem febre', severity: 'caution' },
  low_appetite: { label: 'Pouco apetite / pouca comida hoje', severity: 'caution' },
  fatigue: { label: 'Cansaço fora do comum', severity: 'caution' },
  dizziness: { label: 'Tontura leve', severity: 'stop' },
} as const;
export type SymptomKey = keyof typeof SYMPTOMS;

export const Briefing = z.object({
  location: z.enum(['home', 'no_equipment', 'hotel_gym', 'hotel_room']),
  minutes: z.number().int().min(10).max(90),
  focus: z.enum(['auto', 'core', 'upper', 'legs', 'strength', 'cardio', 'full_body', 'mobility', 'recovery', 'technique']),
  movementFocus: z.string().optional(),
  intensity: z.enum(['recovery', 'light', 'moderate', 'high']),
  energy: z.number().min(0).max(10),
  sleep: z.number().min(0).max(10),
  symptoms: z.array(z.string()),
  pains: z.array(PainEntry),
  preferred: z.array(z.string()),
  avoided: z.array(z.string()),
  /** Equipamentos marcados disponíveis HOJE (academia de hotel); não altera o inventário global. */
  dayEquipment: z.array(z.string()),
  canRunOutside: z.boolean(),
  notes: z.string(),
  /** Escolhas manuais preservadas ao regerar: chave = slot (ex.: "metcon:0"). */
  locks: z.record(z.string(), z.string()),
  seed: z.number().int(),
});
export type Briefing = z.infer<typeof Briefing>;

export const PerformedItem = z.object({
  exerciseId: z.string(),
  reps: z.number().optional(),
  sets: z.number().optional(),
  durationSec: z.number().optional(),
  distanceM: z.number().optional(),
  calories: z.number().optional(),
  /** Carga REAL informada pelo atleta. Nunca copiar da prescrição. */
  loadKg: z.number().optional(),
  completed: z.boolean().default(true),
});
export type PerformedItem = z.infer<typeof PerformedItem>;

export const WodBlockParsed = z.object({
  kind: z.enum(['warmup', 'skill', 'strength', 'metcon', 'accessory', 'cooldown', 'unknown']),
  title: z.string(),
  format: z.string().optional(),
  text: z.string(),
  movements: z.array(z.object({
    exerciseId: z.string().nullable(),
    raw: z.string(),
    reps: z.number().optional(),
    loadText: z.string().optional(),
    distanceM: z.number().optional(),
    calories: z.number().optional(),
    confidence: z.number().min(0).max(1),
  })),
});
export type WodBlockParsed = z.infer<typeof WodBlockParsed>;

export const BackupFile = z.object({
  app: z.literal('cg-performance'),
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.any())),
});
export type BackupFile = z.infer<typeof BackupFile>;
