# CG CrossFit Evolution (artefato)

Versão simplificada, em um único arquivo, publicada como artefato do Claude:
https://claude.ai/artifact/9ycDAbCkawQJUZ6Jvm9F8m (privado).

- **Hoje**: mapa do corpo dos últimos 7 dias (14 se a semana estiver vazia), sugestão de foco, últimos treinos considerados e briefing (onde, tempo 20/30/45/60/livre, foco, como está).
- **Treino**: aula no formato CrossFit (aquecimento, força/skill, WOD em AMRAP/For Time/EMOM/intervalos, core, volta à calma), imagens por etapa de cada exercício com seta do movimento, cronômetro do WOD, trocar exercício, última carga usada.
- **Registro**: carga da série mais pesada, resultado do WOD (tempo ou voltas), kg por exercício, duração e esforço.
- **Histórico**: adicionar treino do box por foto (o Claude lê o print) ou digitando, com duração, resultado e pesos; os nomes reconhecidos alimentam o mapa. O gerador evita repetir os movimentos dos 2 últimos treinos.

Dados: banco do artefato (coleção `treinos`, leitura e escrita só do dono). Sem banco disponível, o app guarda no navegador.
Para alterar, edite `index.html` e republique no mesmo link.
