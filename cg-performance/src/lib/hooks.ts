import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { ATHLETE_ID, db } from '../db/db';
import type { PrescribedWorkout } from '../db/types';
import { computeSuggestion } from '../domain/suggestion';
import { localDate } from './util';

export const useProfile = () => useLiveQuery(() => db.profile.get(ATHLETE_ID), []);
export const useEquipment = () => useLiveQuery(() => db.equipment.toArray(), []) ?? [];
export const usePerformed = () => useLiveQuery(() => db.performed.orderBy('event_date').reverse().toArray(), []) ?? [];
export const usePrescribed = () => useLiveQuery(() => db.prescribed.orderBy('event_date').reverse().toArray(), []) ?? [];
export const useBodyComp = () => useLiveQuery(() => db.bodycomp.orderBy('event_date').toArray(), []) ?? [];
export const usePlanned = () => useLiveQuery(() => db.planned.orderBy('event_date').reverse().toArray(), []) ?? [];
export const useTodayCheckin = (today = localDate()) =>
  useLiveQuery(() => db.checkins.where('event_date').equals(today).last(), [today]);

export function usePrescribedMap(): Map<string, PrescribedWorkout> {
  const pres = usePrescribed();
  return useMemo(() => new Map(pres.map((w) => [w.id, w])), [pres]);
}

/** Sugestão recalculada automaticamente sempre que treinos, prints ou check-in mudam (spec §6 passo 10). */
export function useSuggestion(today = localDate()) {
  const performed = usePerformed();
  const prescribedById = usePrescribedMap();
  const checkin = useTodayCheckin(today);
  return useMemo(() => computeSuggestion({ today, performed, prescribedById, checkin }), [today, performed, prescribedById, checkin]);
}
