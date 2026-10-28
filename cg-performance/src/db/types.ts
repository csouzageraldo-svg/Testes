import type { EquipmentType } from '../domain/equipment';
import type { Briefing, PainEntry, PerformedItem, SourceType, WodBlockParsed, WorkoutPlan } from '../domain/schemas';
import type { Focus, Intensity, Location } from '../domain/taxonomy';

/** Campos comuns (spec §10). Datas em ISO UTC; `event_date` é a data local do evento (YYYY-MM-DD). */
export interface BaseEntity {
  id: string;
  athlete_id: string;
  created_at: string;
  updated_at: string;
  event_date?: string;
  source_type: SourceType;
  source_ref?: string;
  confidence: number;
  verified_by_user: boolean;
}

export interface Goals {
  bodyFatTarget?: [number, number];
  weightTarget?: [number, number];
  sessionsPerWeek: [number, number];
  /** Preferência declarada: priorizar core e superiores sem abandonar pernas/cardio. */
  emphasis: Array<'core' | 'upper' | 'cardio' | 'legs'>;
  text: string[];
}

export interface AthleteProfile extends BaseEntity {
  displayName: string;
  birthDate?: string;
  heightCm?: number;
  crossfitStart?: string;
  declaredFrequency?: number;
  goals: Goals;
  limitations: string[];
  preferredMovements: string[];
  avoidedMovements: string[];
  consents: { healthDataInExports: boolean; notifications: boolean; officialSync: boolean };
  spaceNotes: string[];
}

export interface EquipmentItem extends BaseEntity {
  key: string;
  type: EquipmentType;
  label: string;
  quantity?: number;
  loadKg?: number;
  loadNote?: string;
  /** Somente itens confirmados entram no gerador para "Casa". */
  confirmed: boolean;
  available: boolean;
  evidence?: string;
  photoRefs: string[];
  safetyNote?: string;
}

export interface WorkoutSourceRef {
  assetId?: string;
  hash?: string;
  source_type: SourceType;
  label: string;
  added_at: string;
}

export type PerformedStatus = 'unknown' | 'performed' | 'skipped';

/** Programação do box (prescrita). Nunca é resultado do atleta. */
export interface PrescribedWorkout extends BaseEntity {
  event_date: string;
  title: string;
  boxName?: string;
  blocks: WodBlockParsed[];
  rawText: string;
  sources: WorkoutSourceRef[];
  performed_status: PerformedStatus;
  performedId?: string;
  uncertainFields: string[];
}

export interface PlannedWorkout extends BaseEntity {
  event_date: string;
  briefing: Briefing;
  /** Treino recomendado pela IA (imutável). */
  recommended: WorkoutPlan;
  /** Versão editada pelo atleta (null = sem edição). */
  edited: WorkoutPlan | null;
  status: 'draft' | 'approved' | 'started' | 'done' | 'abandoned';
  performedId?: string;
}

export interface PerformedWorkout extends BaseEntity {
  event_date: string;
  title: string;
  plannedId?: string;
  prescribedId?: string;
  location?: Location | 'box' | 'other';
  focus?: Focus | string;
  intensity?: Intensity;
  status: 'completed' | 'partial' | 'not_done';
  durationMin?: number;
  items: PerformedItem[];
  rpe?: number;
  breath?: number;
  muscleFatigue?: number;
  pains: PainEntry[];
  recoveryNote?: string;
  hrAvg?: number;
  notes?: string;
  /** Snapshot do plano executado (cópia do final aprovado) para auditoria. */
  executedPlan?: WorkoutPlan;
}

export interface RecoveryCheckin extends BaseEntity {
  event_date: string;
  energy: number;
  sleep: number;
  symptoms: string[];
  pains: PainEntry[];
}

export interface BodyCompositionMeasurement extends BaseEntity {
  event_date: string;
  weightKg?: number;
  musclePct?: number;
  fatPct?: number;
  visceralLevel?: number;
  muscleKgEst?: number;
  fatKgEst?: number;
  bmi?: number;
  bmrKcal?: number;
  bodyAge?: number;
  device: string;
}

export interface UploadedAsset extends BaseEntity {
  hash: string;
  kind: 'wod_print' | 'equipment_photo' | 'scale_photo' | 'other';
  name: string;
  mime: string;
  size: number;
  blob: Blob;
}

export interface ImportJob extends BaseEntity {
  assetIds: string[];
  status: 'queued' | 'ocr' | 'review' | 'confirmed' | 'discarded' | 'error';
  ocrText: string;
  parsed?: unknown;
  resultWorkoutId?: string;
  mergedInto?: string;
  error?: string;
}

export interface OfficialWod extends BaseEntity {
  canonical_id: string;
  publication_date: string;
  title: string;
  text: string;
  source_url: string;
  last_checked_at: string;
  checksum: string;
  version: number;
  attribution: string;
  verification: 'synced' | 'manual' | 'stale';
  history: Array<{ checksum: string; text: string; seen_at: string }>;
}

export interface OfficialEvent extends BaseEntity {
  canonical_id: string;
  name: string;
  kind: string;
  start_date: string;
  end_date?: string;
  timezone: string;
  location?: string;
  division?: string;
  status: 'confirmed' | 'changed' | 'cancelled' | 'unverified';
  source_url: string;
  last_checked_at: string;
  checksum: string;
  version: number;
  history: Array<{ checksum: string; start_date: string; end_date?: string; seen_at: string; note?: string }>;
}

export interface OfficialSourceStatus {
  id: string;
  name: string;
  url: string;
  kind: 'methodology' | 'education' | 'wod' | 'movements' | 'games' | 'schedule' | 'competitions' | 'season';
  last_checked_at?: string;
  last_success_at?: string;
  last_error?: string;
  terms_status: string;
  sync_mode: 'auto' | 'link_only' | 'manual';
}

export interface RecommendationRecord extends BaseEntity {
  event_date: string;
  focus: Focus;
  intensity: Intensity;
  headline: string;
  reasons: string[];
  analysisConfidence: number;
}

export interface RevisionHistory {
  id: string;
  entity: string;
  entityId: string;
  at: string;
  reason: string;
  before: unknown;
  after: unknown;
}

export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  detail: string;
}

/** Estado da sessão em execução: persistido a cada mudança (resistente a fechar a aba). */
export interface ActiveSession {
  id: 'active';
  plannedId: string;
  plan: WorkoutPlan;
  startedAt: number;
  blockIndex: number;
  blockStartedAt: number | null;
  pausedAt: number | null;
  pausedTotalMs: number;
  roundsByBlock: Record<number, number>;
  doneItems: Record<string, boolean>;
  actuals: Record<string, { reps?: number; loadKg?: number; durationSec?: number; distanceM?: number; calories?: number }>;
  soundOn: boolean;
}

export interface KV {
  key: string;
  value: unknown;
}
