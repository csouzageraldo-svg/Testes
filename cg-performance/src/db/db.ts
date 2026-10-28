import Dexie, { type Table } from 'dexie';
import type {
  ActiveSession, AthleteProfile, AuditEvent, BodyCompositionMeasurement, EquipmentItem, ImportJob, KV,
  OfficialEvent, OfficialSourceStatus, OfficialWod, PerformedWorkout, PlannedWorkout, PrescribedWorkout,
  RecommendationRecord, RecoveryCheckin, RevisionHistory, UploadedAsset,
} from './types';

export const ATHLETE_ID = 'me';
export const SCHEMA_VERSION = 1;

export class CGDatabase extends Dexie {
  profile!: Table<AthleteProfile, string>;
  equipment!: Table<EquipmentItem, string>;
  prescribed!: Table<PrescribedWorkout, string>;
  planned!: Table<PlannedWorkout, string>;
  performed!: Table<PerformedWorkout, string>;
  checkins!: Table<RecoveryCheckin, string>;
  bodycomp!: Table<BodyCompositionMeasurement, string>;
  assets!: Table<UploadedAsset, string>;
  importJobs!: Table<ImportJob, string>;
  officialWods!: Table<OfficialWod, string>;
  officialEvents!: Table<OfficialEvent, string>;
  officialSources!: Table<OfficialSourceStatus, string>;
  recommendations!: Table<RecommendationRecord, string>;
  revisions!: Table<RevisionHistory, string>;
  audit!: Table<AuditEvent, string>;
  session!: Table<ActiveSession, string>;
  kv!: Table<KV, string>;

  constructor(name = 'cg-performance') {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      profile: 'id',
      equipment: 'id, &key, type, confirmed',
      prescribed: 'id, event_date, title, performed_status',
      planned: 'id, event_date, status',
      performed: 'id, event_date, plannedId, prescribedId, status',
      checkins: 'id, event_date',
      bodycomp: 'id, &event_date',
      assets: 'id, &hash, kind',
      importJobs: 'id, status, created_at',
      officialWods: 'id, &canonical_id, publication_date',
      officialEvents: 'id, &canonical_id, start_date',
      officialSources: 'id',
      recommendations: 'id, event_date',
      revisions: 'id, entityId, at',
      audit: 'id, at',
      session: 'id',
      kv: 'key',
    });
  }
}

export const db = new CGDatabase();

export const DATA_TABLES = [
  'profile', 'equipment', 'prescribed', 'planned', 'performed', 'checkins', 'bodycomp', 'importJobs',
  'officialWods', 'officialEvents', 'officialSources', 'recommendations', 'revisions', 'audit',
] as const;
