# Changelog

## 0.1.0 — 2026-10-28 — Fase 1 (MVP funcional)

- PWA React/TS/Vite com tema escuro grafite + verde-petróleo; navegação Hoje/Treinar/Histórico/Evolução/Mais.
- Persistência local (Dexie) com entidades da spec, revisões e auditoria; seed a partir de `private-seed/` (gitignored).
- Briefing inteligente editável com check-in obrigatório de sintomas/dor.
- Motor de programação por regras: opções A/B/C, regerar com locks, segurança, explicações e trade-offs.
- Revisão editável, execução com timers persistentes, check-out.
- Importação contínua: OCR no navegador, parser de WOD, revisão de campos incertos, dedupe/merge com múltiplas fontes, reprocessamento.
- Biblioteca de 64 exercícios com animações SVG originais.
- Inventário do home gym identificado nas fotos com confirmação.
- Evolução: mapa corporal de exposição, sessões/semana, padrões, RPE/fôlego, cardio, cargas comprovadas, composição corporal, check-ins.
- Calendário com camadas.
- Fontes oficiais: backend com robots.txt, parsers, snapshots versionados, agendador; fallback manual; inspiração rotulada como não oficial.
- Exportação JSON/CSV/Markdown (sensíveis opt-in), importação de backup, apagar dados.
- Testes: 29 Vitest + roteiro E2E Playwright (21 verificações).
