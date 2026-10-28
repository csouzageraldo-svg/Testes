# Importação contínua de treinos

## Entradas suportadas (Fase 1)

| Entrada | Caminho | `source_type` |
|---|---|---|
| Prints/fotos (1 ou vários) | Importar → Escolher imagens → OCR → revisão | `image_ocr_reviewed` |
| Vários prints do mesmo treino | marcar "são do mesmo treino" (1 job) ou enviar separado (dedupe funde) | idem |
| Texto colado / `.txt` / `.md` | Importar → Colar texto → Interpretar | `user_manual_entry` |
| Formulário manual | Importar → Formulário em branco | `user_manual_entry` |
| CSV de composição corporal | Importar (arquivo `.csv`) ou `private-seed/` | `csv_import` |
| Backup JSON | Dados → Importar backup | `json_import` |
| Índice histórico do prompt | seed automático | `chat_summary_index` (confiança 0,35) |

PDF/XLSX e voz: Fase 2 (ver ROADMAP).

## Pipeline

1. **Arquivo original** salvo privado no IndexedDB (`assets`) com SHA-256, nome, tipo, tamanho, data; mesmo hash = duplicata ignorada.
2. **Extração**: Tesseract.js (`por+eng`) no navegador → texto bruto guardado no `ImportJob`.
3. **Parser** (`src/domain/wodParser.ts`):
   - datas: `dd/mm/aaaa`, `dd/mm` (ano inferido pela data de referência, evitando futuro > 7 dias), `aaaa-mm-dd`, "28 de setembro", "Sep 28, 2026";
   - título: linha curta majoritariamente alfabética, priorizando caixa alta/após a data e penalizando nome do box/app;
   - blocos: warm-up/aquecimento, skill/técnica, strength/força/LPO, WOD/metcon, acessórios/core, cool down/alongamento;
   - formato: AMRAP n, EMOM n, For Time, Tabata, n rounds, esquemas 21-15-9;
   - movimentos: dicionário de sinônimos pt/en da biblioteca (maior correspondência primeiro), reps, séries×reps, metros, calorias e carga prescrita (`43/30 kg`, `@60kg`, `75%`);
   - linhas com números e palavras não reconhecidas viram movimento `exerciseId: null` (confiança 0,2) para revisão.
4. **Revisão** (`WodEditor`): campos em `uncertainFields` destacados em âmbar (data ambígua, título de baixa confiança, bloco sem seção, movimento não reconhecido).
5. **Confirmação** (`confirmPrescribed`): procura duplicata **no mesmo dia** com título semelhante (Dice ≥ 0,75), movimentos em comum (Jaccard ≥ 0,5) ou combinação (0,5/0,3). Havendo, faz **merge**: une fontes (sem repetir hash), completa blocos, promove dados revisados sobre índice/OCR não revisado, registra `RevisionHistory`. Senão cria novo `PrescribedWorkout` com `performed_status = unknown`.
6. **Recalcular**: sugestão, mapa e gráficos são derivados por consultas reativas — atualizam imediatamente após qualquer criação/correção.

## Regras de qualidade

- Print de programação **nunca** vira treino realizado. Só "Realizei este treino" cria `PerformedWorkout` (`location: box`).
- Sem resultados informados: sessão conta com confiança 0,4, **sem cargas e sem PR**. Carga prescrita jamais é usada como resultado.
- Data de ingestão (`created_at`) ≠ data do treino (`event_date`).
- Edições são versionadas (`revisions`), originais preservados (`rawText`, `assets`).
- Reprocessamento em lote: "Reprocessar movimentos não reconhecidos" reaplica o dicionário atual a todos os WODs.
- Apagamento individual (WOD, registro) e total (Dados).

## Mapeamento de campos

| Campo | Origem | Observação |
|---|---|---|
| `event_date` | data detectada/revisada | obrigatória |
| `title` | título detectado/revisado | "WOD sem título" se vazio |
| `blocks[].kind/format/movements` | parser + revisão | `confidence` por movimento |
| `sources[]` | `{assetId, hash, source_type, label, added_at}` | uma por print/entrada |
| `performed_status` | `unknown` → `performed`/`skipped` | só por ação do atleta |
