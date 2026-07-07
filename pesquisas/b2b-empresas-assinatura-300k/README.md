# Lista de empresas para prospecção B2B — plano/assinatura mensal, porte estimado ≥ R$300k/mês

## O que é isto

`empresas.csv` contém **101 empresas brasileiras reais** que vendem algum tipo de plano/assinatura
mensal (visível no site ou redes sociais) e que, segundo evidências públicas coletadas via busca na
web, provavelmente faturam **pelo menos ~R$300.000/mês**. O objetivo é servir de ponto de partida
para prospecção B2B: buscar sócios, diretores e demais decisores dessas empresas no LinkedIn.

Segmentos cobertos (6 frentes de pesquisa, ~16-19 empresas cada):

- Academias / estúdios fitness (redes e franquias)
- Clínicas de estética / odontológicas / harmonização facial
- EdTech e escolas (idiomas, música, cursos preparatórios)
- Agências de marketing digital / tráfego pago / consultorias
- SaaS B2B com pricing público
- Clubes de assinatura (livros, vinho, beleza, pet, alimentação, carros)

## Aviso importante sobre os dados

**Não existe uma base pública confiável de faturamento de empresas privadas brasileiras.** Nenhuma
das cifras de "faturamento" na coluna `evidencia_porte` deve ser tratada como número oficial e
auditado — são estimativas com base em fontes secundárias (reportagens de imprensa de
negócios, releases de rodadas de investimento, dados de franquias/unidades, avaliações de
aquisição, número de assinantes divulgado pela própria empresa).

Cada linha tem uma coluna `nivel_confianca`:

- **Alta**: existe fonte jornalística/institucional específica citando faturamento, receita ou
  valor de aquisição/aporte compatível com ≥ R$300k/mês, cruzada com pelo menos uma fonte adicional.
- **Média / Média-Alta**: escala evidente (muitas unidades, headcount grande, rodada de investimento
  relevante) mas sem número de faturamento direto e recente.
- **Baixa / Baixa-média**: presença e porte sugerem escala, mas a evidência é indireta, antiga ou
  vem de uma fonte única (ex.: apenas o próprio site da empresa). Empresas nesse nível merecem
  checagem adicional antes de priorizar no funil de prospecção.

Recomendação: **priorize as linhas "Alta" e "Média-Alta" primeiro** — são ~37 empresas com evidência
mais sólida. As demais são bons candidatos, mas exigem uma checagem rápida antes de investir tempo
de prospecção (ex.: conferir headcount atual no LinkedIn da empresa, ver se o número de unidades
segue igual, etc.).

## Colunas do CSV

| Coluna | Descrição |
|---|---|
| `nome_empresa` | Nome comercial da empresa/rede |
| `setor` | Uma das 6 frentes de pesquisa |
| `segmento_especifico` | Descrição mais granular do negócio |
| `site_rede_social` | Site ou perfil onde o plano é divulgado |
| `evidencia_plano` | Preço/nome do plano encontrado e onde |
| `evidencia_porte` | Racional/fonte usada para estimar que o faturamento é compatível com ≥R$300k/mês |
| `nivel_confianca` | Alta / Média / Baixa (ver acima) |
| `fontes` | URLs (sem `https://`, para facilitar cópia) usadas como evidência |
| `cargo_alvo_linkedin` | Sugestão de cargos a buscar no LinkedIn para aquela empresa, dado o objetivo de prospecção de vendas B2B |

## Como usar para prospecção no LinkedIn

Para cada empresa, busque no LinkedIn (Sales Navigator facilita bastante) por:

1. **Empresas menores/regionais (uma unidade, uma marca própria)**: buscar diretamente
   "CEO", "Sócio-fundador" ou "Diretor(a)" + nome da empresa.
2. **Redes de franquia**: o decisor de maior alavancagem costuma ser o **franqueador (matriz)** —
   Diretor de Expansão, Diretor Comercial ou CEO da rede, não o franqueado individual (que tem
   porte bem menor que R$300k/mês). A coluna `cargo_alvo_linkedin` já reflete essa diferença.
3. **SaaS/scale-ups**: além de CEO/fundador, o CRO (Chief Revenue Officer) ou Head de Marketing
   costuma ser o ponto de entrada mais acessível.

## Limitações conhecidas

- Cobertura enviesada para empresas com presença de mídia/imprensa — negócios igualmente grandes
  mas discretos (sem cobertura jornalística) tendem a ficar de fora.
- Threshold de R$300k/mês (~R$3,6 milhões/ano) é compatível com boa parte da lista com folga
  (ex.: redes nacionais de academia, SaaS com rodadas de dezenas de milhões), mas para as linhas
  de confiança "Baixa" isso não está confirmado — pode haver empresas abaixo do piso.
- Nenhuma empresa foi contatada ou verificada diretamente; todos os dados vêm de fontes públicas
  já existentes na internet, coletadas em julho de 2026.
