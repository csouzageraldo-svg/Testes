import type { PrivateProfileSeed } from './private';

/** Versão hospedada: nenhum dado pessoal embutido no bundle. O atleta importa pela interface. */
export const privateSeed = {
  profile: undefined as PrivateProfileSeed | undefined,
  bodyCompCsv: undefined as string | undefined,
  equipmentPhotos: [] as Array<{ name: string; url: string }>,
  wodPrints: [] as Array<{ name: string; url: string }>,
};
