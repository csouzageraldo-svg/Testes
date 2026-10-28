# Roadmap

## Fase 1 — entregue (v0.1.0)
Ver README "O que está funcionando". Critérios de aceite (spec §12):

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Mudar foco core → superiores, explicar sobreposição | ✅ | `tests/generator.test.ts`, E2E |
| 2 | Casa só com equipamento confirmado; altera carga/tempo | ✅ | unit + E2E |
| 3 | Quarto: silencioso, pouco espaço, scaling | ✅ | unit + E2E |
| 4 | Dois prints do mesmo WOD → um prescrito, duas fontes | ✅ | `tests/import.test.ts`, E2E (texto) |
| 5 | Novos WODs semanas depois recalculam sem perder dados | ✅ | `tests/import.test.ts` |
| 6 | Print sem resultado não conta nem gera PR | ✅ | unit + E2E |
| 7 | 30 min vs express 15 min diferentes e plausíveis | ✅ | unit (90 combinações) + E2E |
| 8 | Demonstração real ou fallback útil; scaling | ✅ | 64 animações SVG + E2E |
| 9 | EMOM/descanso; progresso salvo ao fechar/reabrir | ✅ | E2E (reload) |
| 10 | Check-out registra e atualiza gráficos | ✅ | E2E |
| 11 | Sintomas sistêmicos/falta de ar → sem WOD intenso | ✅ | unit + E2E |
| 12 | WOD oficial com fonte/data ou erro honesto + manual | ⚠️ parcial | fallback validado; parser só com HTML sintético |
| 13 | Evento oficial futuro confirmado com origem e checagem | ⚠️ parcial | pipeline pronto e testado; sem acesso ao site real nesta sessão |
| 14 | Exportar JSON/CSV para ChatGPT | ✅ | E2E |
| 15 | Dados após reabrir **e em outro dispositivo com login** | ⚠️ parcial | local ✅; multi-dispositivo só via backup JSON |

## Fase 2 — aprendizado com novos dados
- Backend com auth + Postgres/Supabase (storage privado de imagens, RLS por atleta) e sincronização offline-first.
- Validar parsers oficiais com HTML real e adicionar fixtures; push de novas publicações (com consentimento).
- OCR/visão com modelo multimodal opcional no backend (provider configurável), mantendo revisão humana; PDF/XLSX.
- Progressão por movimento (carga/volume) baseada em histórico comparável; deload automático sugerido.
- Benchmarks (Girls/Hero) comparáveis por mesmo scaling.
- Importação de foto do visor da balança com leitura assistida.

## Fase 3 — animações e treinador conversacional
- Animações com mais articulações (vista frontal para pull-apart, prancha lateral), mídia licenciada.
- Chat treinador com memória estruturada citando treino e fonte, validado por schema/regras.

## Fase 4 — integrações
- Google Sheets OAuth (planilha de composição), wearables (FC, sono), calendários, apps de box quando permitido.

## Lacunas / testes pendentes
- Prints reais do box (não recebidos nesta sessão) — validar OCR e ajustar dicionário.
- Teste em iOS Safari (wake lock/áudio) e instalação PWA em Android.
- Revisão jurídica dos termos de uso das fontes oficiais.
- Ícones PNG para PWA (hoje SVG).
