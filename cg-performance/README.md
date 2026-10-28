# CG Performance

PWA mobile-first de treinador pessoal orientado à metodologia CrossFit. Fluxo principal: **Hoje → Briefing → Gerar → Revisar → Executar → Registrar**, com importação contínua de WODs do box, biblioteca com animações originais, mapa de estímulos, evolução, calendário e fontes oficiais CrossFit.

> App pessoal, **não oficial e não afiliado à CrossFit, LLC**. Não substitui avaliação médica, prescrição ou coach presencial.

## Rodar localmente

Requisitos: Node 20+ (testado com 22).

```bash
cd cg-performance
npm install
npm run dev          # PWA em http://localhost:5173 + API em :8787
```

Produção (um único processo serve a PWA e a API):

```bash
npm run build
npm start            # http://localhost:8787
```

Testes:

```bash
npm test             # unitários/integração (Vitest): motor, segurança, importação, dedupe, fontes oficiais
npm run typecheck
# E2E (Playwright, viewport mobile): com `npm run build`, `npm run dev:api` e `npx vite preview --port 4173` rodando
npx playwright install chromium   # só na primeira vez, se não tiver Playwright
npm run e2e                       # screenshots em e2e/out/
```

No Windows, basta dar dois cliques em `cg-performance\iniciar.bat` (instala, gera o build e abre em http://localhost:8787).

## Versão hospedada (abrir pelo link, sem instalar)

```bash
npx vite build --mode hosted --outDir dist-hosted
```

Gera uma build estática publicável em qualquer endereço (caminhos relativos, navegação em memória, sem service worker) e **sem nenhum dado do `private-seed/`**. Nessa versão: os dados ficam no navegador do aparelho; a sincronização oficial e o OCR de prints podem não funcionar (sem backend e com rede restrita), e as exportações aparecem na tela para copiar em vez de baixar.

## Dados privados (importante: o repositório é público)

Perfil, composição corporal, fotos da casa e prints **não são versionados**. Coloque-os em `cg-performance/private-seed/` (ignorada pelo git), seguindo `private-seed.example/`:

| Do pacote `CG Cross` | Para |
|---|---|
| `dados/historico_composicao_corporal_ate_2026-10-20.csv` | `private-seed/historico_composicao_corporal_ate_2026-10-20.csv` |
| `assets/equipamentos/*.jpg` | `private-seed/equipamentos/` |
| `assets/treinos_box/*.jpg` | `private-seed/treinos_box/` (entram na fila de OCR + revisão) |
| perfil (do prompt mestre §2) | `private-seed/profile.json` (modelo em `private-seed.example/profile.json`) |

Os arquivos são lidos na primeira abertura do app. Para reprocessar: **Mais → Dados → Apagar todos os dados locais** e recarregar. Alternativamente, envie tudo pela própria interface (Importar / Equipamentos / Evolução).

Medicação, exames e dados clínicos **não** são armazenados nem enviados a nenhum modelo.

## O que está funcionando (Fase 1)

- Tela **Hoje** com sugestão explicada, confiança da análise e indicadores 7/14/30 dias.
- **Briefing editável** obrigatório: local (casa, sem equipamento, academia de hotel com checklist do dia, quarto), tempo, foco (aceitar sugestão ou mudar), movimento preferido, intensidade, energia/sono, sintomas e dor **atuais** (geração bloqueada até responder), preferências/evitar.
- **Motor por regras** com 3 opções (A recomendada, B express, C recuperação ou descanso), regerar preservando escolhas, ±5 min, "usar sugestão original", explicação de sobreposição ("você trabalhou deltoides recentemente…"), segurança não desativável.
- **Revisão** com troca por exercício de estímulo semelhante, reps/séries/descanso/carga, versão mais simples, duração recalculada; recomendado e editado guardados separados.
- **Execução** com timers AMRAP/EMOM/For Time/Tabata/intervalos/descanso, bipes, wake lock, persistência por timestamps (fechar/reabrir continua).
- **Check-out** leve (status, RPE, fôlego, fadiga, dor, FC, notas), cargas só se informadas.
- **Importação contínua**: imagens (hash SHA-256, OCR Tesseract no navegador), texto/TXT, formulário manual, CSV de composição; revisão com campos incertos destacados; deduplicação/merge por data + título/movimentos preservando todas as fontes; histórico de revisões; reprocessamento em lote.
- **Histórico** prescrito × executado; "Realizei este treino" sem inventar resultados.
- **Biblioteca** com 64 exercícios, metadados (padrões, músculos, capacidades, domínios, articulações, impacto, ruído), instruções, erros, scaling e **animação SVG original** para todos.
- **Equipamentos**: inventário identificado nas 5 fotos, com confirmação item a item.
- **Evolução**: mapa corporal anterior/posterior de exposição estimada, sessões/semana vs meta, padrões, RPE/fôlego, cardio, cargas comprovadas, composição corporal com metas, check-ins.
- **Calendário** com camadas (box, recomendado, realizado, descanso, eventos oficiais, medições).
- **Fontes oficiais**: backend com adaptador (robots.txt, parsers heurísticos, snapshots versionados, agendador) + fallback manual honesto; "Inspirar treino no WOD oficial" rotulado como adaptação própria.
- **Exportação** JSON/CSV e resumo Markdown para ChatGPT/Claude, com dados sensíveis desligados por padrão; importação de backup; apagar tudo.

## Limitações conhecidas

- **Sem nuvem/autenticação** nesta fase: dados ficam no IndexedDB do aparelho. Para outro dispositivo, use exportar/importar JSON (critério 15 atendido só localmente — ver ROADMAP).
- **Sincronização oficial não validada contra o site real**: o ambiente de desenvolvimento bloqueia `crossfit.com`. Parsers testados com HTML sintético; se a estrutura real não for reconhecida, o app mostra "não sincronizado" e oferece registro manual (ver OFFICIAL_SOURCES.md).
- Os ~20 prints de WOD (`assets/treinos_box/`) **não foram recebidos** nesta sessão; os 11 WODs do índice entram como "índice (validar)" e são fundidos quando o print da mesma data for importado.
- OCR baixa motor/idiomas da CDN no primeiro uso (precisa de internet nessa vez).
- Timers em segundo plano: navegadores móveis podem suspender a aba; o tempo é recalculado pelo relógio ao voltar, mas bipes podem atrasar.

Mais detalhes: [ARCHITECTURE.md](ARCHITECTURE.md), [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md), [OFFICIAL_SOURCES.md](OFFICIAL_SOURCES.md), [EXPORT_FOR_CHATGPT.md](EXPORT_FOR_CHATGPT.md), [ROADMAP.md](ROADMAP.md), [CHANGELOG.md](CHANGELOG.md).
