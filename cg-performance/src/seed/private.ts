/**
 * Dados pessoais do atleta (perfil, composição corporal, fotos) ficam em `private-seed/`,
 * pasta IGNORADA pelo git porque o repositório é público. Se a pasta existir localmente,
 * o app usa os arquivos como semente na primeira abertura; senão, mostra o onboarding.
 * Formato: ver `private-seed.example/`.
 */
import type { PerformedItem } from '../domain/schemas';

export interface PrivateProfileSeed {
  displayName: string;
  birthDate?: string;
  heightCm?: number;
  crossfitStart?: string;
  declaredFrequency?: number;
  goals?: { bodyFatTarget?: [number, number]; weightTarget?: [number, number]; sessionsPerWeek?: [number, number]; text?: string[] };
  limitations?: string[];
  personalLog?: Array<{ date: string; title: string; items: PerformedItem[]; rpe?: number; notes?: string; location?: string }>;
}

const jsonFiles = import.meta.glob('/private-seed/profile.json', { eager: true, import: 'default' }) as Record<string, PrivateProfileSeed>;
const csvFiles = import.meta.glob('/private-seed/*.csv', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const equipmentPhotos = import.meta.glob('/private-seed/equipamentos/*.{jpg,jpeg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const wodPrints = import.meta.glob('/private-seed/treinos_box/*.{jpg,jpeg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const baseName = (p: string) => p.split('/').pop() ?? p;

export const privateSeed = {
  profile: Object.values(jsonFiles)[0] as PrivateProfileSeed | undefined,
  bodyCompCsv: Object.entries(csvFiles).find(([k]) => /composicao|body/i.test(k))?.[1],
  equipmentPhotos: Object.entries(equipmentPhotos).map(([k, url]) => ({ name: baseName(k), url })),
  wodPrints: Object.entries(wodPrints).map(([k, url]) => ({ name: baseName(k), url })),
};
