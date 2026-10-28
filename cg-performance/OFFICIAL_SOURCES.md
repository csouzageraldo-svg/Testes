# Fontes oficiais CrossFit

App **não oficial e não afiliado**. Fontes priorizadas (URLs informadas e verificadas pelo usuário em 28/10/2026):

| Fonte | URL | Modo | Termos/licença adotados |
|---|---|---|---|
| Metodologia | https://www.crossfit.com/crossfit-methodology | link | conteúdo protegido, não copiado |
| Recursos educacionais (L1/L2) | https://www.crossfit.com/education/resources | link | PDFs não redistribuídos |
| WOD oficial/arquivo | https://www.crossfit.com/workout/ | **auto** | só o texto do WOD do dia, com atribuição, URL e checksum |
| Movimentos/demonstrações | https://www.crossfit.com/crossfit-movements | link | vídeos não incorporados (sem licença) |
| Portal Games | https://games.crossfit.com/ | link | — |
| Calendário do Open | https://games.crossfit.com/open/schedule | **auto** | apenas datas/nomes de eventos |
| Eventos licenciados | https://games.crossfit.com/competitions | **auto** | apenas datas/nomes de eventos |
| Temporada 2026 (histórico) | https://games.crossfit.com/article/2026-crossfit-games-season-dates-and-details-division | link | snapshot histórico, não usado para agenda futura |

## Como funciona (`server/`)

- `OfficialCrossFitSourceAdapter` (`server/officialAdapters.ts`):
  - `robotsAllows()` — lê `robots.txt` e respeita Allow/Disallow (curingas, regra mais específica). **Se o robots.txt não puder ser lido, não sincroniza** (postura conservadora).
  - `parseOfficialWod()` — tenta, nesta ordem: `__NEXT_DATA__` (procura o objeto com texto mais "WOD-like"), JSON-LD `Article`, texto visível de `<article>/<main>`. Data por campo de publicação, `<time datetime>` ou padrão AAMMDD do título. Retorna `null` se nada confiável — nunca inventa.
  - `parseSchedule()` — linhas com palavra de evento (Open, Quarterfinals, Semifinals, Games, Masters, Adaptive, Community Cup, "Workout 27.1"…) + data/intervalo. Ano explícito ⇒ `confirmed`; ano inferido pela página ⇒ `unverified`.
- `server/index.ts` — sem login, sem contornar paywall/anti-bot; User-Agent identificado; timeout 20 s.
  - Agendador: checa de hora em hora; **WOD a cada 6 h**, **eventos semanalmente**; "Sincronizar agora" força.
  - Snapshot em `server/data/official.json` (gitignored) com `last_checked_at`, `last_success_at`, `last_error`, `checksum`, `version`, `history`.
- Cliente (`src/lib/officialClient.ts`) copia para IndexedDB via `upsertOfficialWod/Event`: mesmo checksum ⇒ só atualiza `last_checked_at` (sem duplicata); checksum diferente ⇒ nova versão e o texto anterior vai para `history`; datas de evento alteradas ⇒ status `changed` com as datas anteriores visíveis.

## Fallback honesto

Se a API estiver fora, o robots.txt bloquear, a página mudar ou a rede falhar: cada fonte mostra **"não sincronizado"** com o motivo, e a tela oferece **registro manual** (texto do WOD + data + URL; evento + datas + URL). Manual entra como `official_manual`/`unverified` até uma sincronização confirmar.

## Estado nesta entrega

- **Não foi possível validar contra os sites reais**: o ambiente de desenvolvimento bloqueia `crossfit.com`/`games.crossfit.com` (proxy 403). Os parsers foram testados com **HTML sintético** (`tests/official.test.ts`). Na primeira execução em sua máquina, confira a tela Fontes oficiais: se aparecer "WOD não reconhecido na página", ajuste o parser com um HTML real salvo (e adicione-o como fixture).
- Termos de uso: não foram revisados juridicamente; o app guarda apenas o mínimo para uso pessoal, com atribuição e link. Revise os termos atuais antes de qualquer uso público.
- Notificações de novas publicações: consentimento existe no perfil; o envio push fica para a Fase 2.

## Distinções na interface

- **WOD oficial público** (selo "sincronizado"/"inserido manualmente") ≠ **WOD gerado para o atleta** ("Adaptação própria do CG Performance — não é a programação oficial").
- **Calendário competitivo** (camada "Eventos oficiais") ≠ **WOD diário** ≠ **calendário pessoal** (box, plano, realizado).
