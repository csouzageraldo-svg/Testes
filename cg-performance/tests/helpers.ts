import type { EquipmentItem, PerformedWorkout } from '../src/db/types';
import { PHOTO_INVENTORY } from '../src/domain/equipment';
import type { Briefing } from '../src/domain/schemas';

export const TODAY = '2026-10-28';

export function briefing(over: Partial<Briefing> = {}): Briefing {
  return {
    location: 'home', minutes: 30, focus: 'auto', intensity: 'moderate', energy: 7, sleep: 7, symptoms: [], pains: [],
    preferred: [], avoided: [], dayEquipment: [], canRunOutside: false, notes: '', locks: {}, seed: 42, ...over,
  };
}

export function inventory(confirmedKeys: string[] | 'all' | 'none' = 'none'): EquipmentItem[] {
  return PHOTO_INVENTORY.map((s) => ({
    id: `eq_${s.key}`, athlete_id: 'me', created_at: '', updated_at: '', source_type: 'seed', confidence: 0.6, verified_by_user: false,
    key: s.key, type: s.type, label: s.label, quantity: s.quantity, loadKg: s.loadKg, loadNote: s.loadNote,
    confirmed: confirmedKeys === 'all' || (Array.isArray(confirmedKeys) && confirmedKeys.includes(s.key)),
    available: true, evidence: s.evidence, photoRefs: s.photoRefs, safetyNote: s.safetyNote,
  }));
}

export function performed(date: string, items: PerformedWorkout['items'], rpe = 8, extra: Partial<PerformedWorkout> = {}): PerformedWorkout {
  return {
    id: `pw_${date}_${Math.random().toString(36).slice(2, 6)}`, athlete_id: 'me', created_at: '', updated_at: '', event_date: date,
    source_type: 'user_report', confidence: 0.8, verified_by_user: true, title: 'teste', status: 'completed', items, rpe, pains: [], ...extra,
  };
}
