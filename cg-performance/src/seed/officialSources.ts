import type { OfficialSourceStatus } from '../db/types';

/** Fontes oficiais priorizadas (spec §7; URLs verificadas pelo usuário em 28/10/2026). */
export const OFFICIAL_SOURCES: OfficialSourceStatus[] = [
  { id: 'methodology', name: 'Metodologia CrossFit', url: 'https://www.crossfit.com/crossfit-methodology', kind: 'methodology', terms_status: 'Referência por link; conteúdo protegido — não copiado.', sync_mode: 'link_only' },
  { id: 'education', name: 'Recursos educacionais (Level 1/Level 2)', url: 'https://www.crossfit.com/education/resources', kind: 'education', terms_status: 'Referência por link; guias em PDF não são redistribuídos.', sync_mode: 'link_only' },
  { id: 'wod', name: 'WOD oficial e arquivo', url: 'https://www.crossfit.com/workout/', kind: 'wod', terms_status: 'Leitura automatizada pública respeitando robots.txt; armazenado apenas texto do WOD com atribuição e link.', sync_mode: 'auto' },
  { id: 'movements', name: 'Movimentos oficiais / demonstrações', url: 'https://www.crossfit.com/crossfit-movements', kind: 'movements', terms_status: 'Vídeos não incorporados nem copiados (sem licença); apenas link.', sync_mode: 'link_only' },
  { id: 'games', name: 'Portal CrossFit Games', url: 'https://games.crossfit.com/', kind: 'games', terms_status: 'Referência por link.', sync_mode: 'link_only' },
  { id: 'open_schedule', name: 'Calendário oficial do CrossFit Open', url: 'https://games.crossfit.com/open/schedule', kind: 'schedule', terms_status: 'Leitura automatizada pública respeitando robots.txt; datas com origem e checagem.', sync_mode: 'auto' },
  { id: 'competitions', name: 'Eventos licenciados oficiais', url: 'https://games.crossfit.com/competitions', kind: 'competitions', terms_status: 'Leitura automatizada pública respeitando robots.txt.', sync_mode: 'auto' },
  { id: 'season_2026', name: 'Temporada 2026 — datas e divisões (histórico)', url: 'https://games.crossfit.com/article/2026-crossfit-games-season-dates-and-details-division', kind: 'season', terms_status: 'Snapshot histórico; não usar para anunciar agenda futura.', sync_mode: 'link_only' },
];
