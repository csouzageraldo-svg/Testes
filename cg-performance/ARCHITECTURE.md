# Arquitetura

## Stack e decisões

| Escolha | Motivo |
|---|---|
| **Vite + React 18 + TypeScript** | PWA estática, build rápido, sem SSR necessário (Next.js traria servidor sem ganho na Fase 1). |
| **Tailwind** | Tema escuro grafite/off-white com acento verde-petróleo/azul via tokens (`tailwind.config.js`). |
| **Dexie (IndexedDB)** | Local-first/offline: sessão do dia, timers e prints funcionam sem rede. Camada `src/db/repo.ts` isola persistência para trocar por Supabase/Postgres na Fase 2. |
| **Zod** | Valida planos gerados (`WorkoutPlan`), backups e blocos importados. |
| **Recharts** | Gráficos de evolução. |
| **Tesseract.js** | OCR no navegador (sem enviar prints a terceiros). |
| **Node `http` + tsx** (`server/`) | Backend mínimo para fontes oficiais (CORS impede ler crossfit.com do navegador) e para servir o build. Sem segredos no cliente. |
| **vite-plugin-pwa** | Manifest + service worker (precache do app). |

## Pastas

```
src/
  domain/      regras puras e testáveis
    taxonomy.ts      padrões, músculos, articulações, domínios, capacidades, foco, local
    exercises.ts     biblioteca (64) com metadados e sinônimos pt/en
    equipment.ts     tipos + inventário identificado nas fotos
    stimulus.ts      modelo de exposição (janelas 3/7/14/30/90, decaimento ~36 h)
    suggestion.ts    sugestão do dia + confiança
    safety.ts        triagem de sintomas/dor/prontidão (não sobrescrevível)
    generator.ts     motor A/B/C, substituições, simplificação, estimativa de duração
    wodParser.ts     extração de data/título/blocos/formato/movimentos de texto
    dedupe.ts        similaridade de título/movimentos e merge de fontes
    bodycomp.ts      parser do CSV da planilha
    exportSummary.ts resumo Markdown para assistentes
  db/          Dexie (db.ts), tipos de entidades (types.ts), operações (repo.ts)
  animation/   poses (keyframes por ângulos) + renderizador SVG
  pages/       telas; components/ UI compartilhada
  seed/        índice de WODs, fontes oficiais, loader do private-seed
server/        adaptador oficial + API + agendador
tests/         Vitest; e2e/ roteiro Playwright
```

## Entidades (spec §10)

Implementadas como tabelas Dexie: `profile` (AthleteProfile + Goals + UserPreferences + consentimentos), `equipment` (Equipment/EquipmentAvailability — disponibilidade do dia de hotel fica no briefing, sem tocar o inventário global), `prescribed` (PrescribedWorkout/WorkoutSource/WorkoutBlock), `planned` (PlannedWorkout com `recommended` e `edited` separados), `performed` (PerformedWorkout/ExerciseSet), `checkins` (RecoveryCheckin), `bodycomp`, `assets` (UploadedAsset com hash), `importJobs` (ImportJob/ReviewQueue), `officialWods`, `officialEvents`, `officialSources` (DataSource), `recommendations` (Recommendation/Explanation), `revisions` (RevisionHistory), `audit` (AuditEvent), `session` (execução ativa).
`Exercise`/`ExerciseVariant`/`ExerciseMedia` são estáticos em código (versionados com o app). `TrainingLoadEstimate`/`MuscleStimulusEstimate`/`PersonalRecord` são **derivados** em tempo real (não persistidos) para nunca ficarem desatualizados quando um treino é corrigido.

Campos comuns: `id, athlete_id, created_at, updated_at, event_date, source_type, source_ref, confidence, verified_by_user`. Datas de sistema em UTC ISO; `event_date` é a data local do evento.

## Motor de programação

1. **Segurança** (`safety.ts`): sintomas `urgent` (dor no peito, desmaio, palpitações, falta de ar anormal) e `stop` (febre, mal-estar sistêmico, vômitos, piora respiratória, tontura) → descanso; sintomas leves → máx. leve e sem saltos; sono/energia ≤3 → limite; dor ≥4 bloqueia exercícios com exigência articular acima do limite. Aplicado depois das escolhas do usuário.
2. **Sugestão** (`suggestion.ts`): compara a distribuição de estímulo (7 ou 14 dias) com a distribuição-alvo ponderada pelos objetivos (superiores 27%, cardio 27%, core 24%, pernas 22%), penaliza grupos exigidos nas últimas ~48 h, trata retomada (≥4 dias parado) e sequência longa (≥4 dias seguidos).
3. **Geração** (`generator.ts`): equipamento disponível por local (casa = só confirmados) → filtros (ambiente, segurança, evitar, teto sem supervisão) → orçamento de tempo por bloco → seleção por relevância ao foco − sobreposição recente + preferência + ruído determinístico (seed) com diversidade de padrões → prescrição por tempo de trabalho e densidade da intensidade → estimativa de duração → validação Zod.
4. **Cargas**: nunca inventadas. RPE por padrão; kg só para implemento com carga confirmada no inventário ou definida pelo atleta.
5. **Explicação**: textos gerados a partir das regras que dispararam (não por LLM).

A camada de LLM (linguagem natural/composição) ficou para a Fase 3, atrás de um provider configurável no backend, sempre validada pelo schema e pelas regras.

## Modelo de estímulo

`minutos-estímulo = segundos de trabalho × peso do músculo × fator de esforço (RPE/7, 0,4–1,4) / 60`. Treinos do box marcados como feitos sem detalhes usam a prescrição (30 reps padrão por movimento) com confiança 0,4. Execução parcial × 0,6. O mapa corporal mostra exposição relativa — sem "% recuperado".

## Segurança e privacidade

- Tudo local por padrão; backend não recebe dados pessoais.
- Exportações omitem dados sensíveis salvo opt-in.
- Texto importado é tratado como dado, nunca como instrução.
- Logs de auditoria só com ação/ids.
- `private-seed/` e `server/data/` estão no `.gitignore`.
