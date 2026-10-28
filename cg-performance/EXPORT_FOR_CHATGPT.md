# Exportar para ChatGPT / Claude

**Mais → Dados & privacidade → Resumo para ChatGPT/Claude** baixa um `.md` e copia o conteúdo para a área de transferência. Função: `buildChatSummary` em `src/domain/exportSummary.ts`.

## Conteúdo

1. Perfil não sensível (nome de exibição, início no CrossFit, altura, objetivos, meta de frequência).
2. Últimos 30 dias: sessões, minutos de trabalho estimados, RPE médio, confiança, distribuição superiores/pernas/core/cardio, músculos mais/menos expostos, padrões dominantes.
3. Treinos realizados (30 dias) com status, RPE, duração, origem e itens (cargas apenas quando informadas).
4. Programação do box (45 dias) com status de execução e fonte — deixando claro que programação ≠ execução.
5. Equipamentos confirmados.
6. Últimas recomendações do app com confiança.

## Privacidade

Por padrão **omite**: sintomas, dores, notas livres, data de nascimento, metas de peso/gordura e composição corporal. Só inclui se você marcar "Incluir dados sensíveis" (ou ativar o consentimento no perfil). Medicação e dados clínicos nunca são armazenados pelo app.

## Exportações estruturadas

- **Backup JSON** (todas as tabelas + metadados dos arquivos, sem binários) — reimportável em outro aparelho.
- **CSVs**: histórico realizado, box prescrito, composição corporal (só com dados sensíveis), equipamentos, recomendações, preferências.

## Sugestão de uso

Cole o Markdown e peça, por exemplo: "Analise minha distribuição de estímulos e sugira ajustes para as próximas 2 semanas mantendo 3–5 sessões". Traga de volta as decisões para o app ajustando foco/preferências no briefing.
