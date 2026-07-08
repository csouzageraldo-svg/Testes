# The Rever — Proposta de redesign do site (v8 → v9)

**Data:** 08/07/2026
**Base:** doc-mestre v8 (Notion, fonte única) + descrição do site v7 registrada no próprio doc-mestre (§15) e sua lista oficial de correções pendentes.
**Nota de método:** o acesso direto a therever.io não foi possível a partir deste ambiente (bloqueio de rede). O diagnóstico abaixo parte da descrição detalhada do site v7 no doc-mestre — incluindo a lista de "correções pendentes" já reconhecidas — e do desalinhamento entre o que o site diz hoje e o que o doc-mestre v8 já decidiu. Onde houver divergência com o site ao vivo, a régua é o doc-mestre.

---

## 1. Diagnóstico do site atual (v7)

### O que está forte

- **O slogan está resolvido.** "Receita recorrente não é assinatura. É método." é raro: curto, contraintuitivo e proprietário. Não se mexe.
- **A disciplina comercial é um diferencial visível.** Sem preço público, sem urgência, sem escassez fabricada, candidatura com qualificador de +R$10MM. Isso já separa o site de 95% da categoria — a maioria dos concorrentes grita.
- **Hero split (texto + vídeo 4:5)** é um formato correto para a categoria: presença humana sem virar "página de guru".
- **Logos separadas dos números** respeita a regra de ouro (número nunca atribuído a empresa em copy própria) — poucos sites têm esse rigor.
- **Base técnica leve** (HTML único, GSAP + ScrollTrigger) é um ativo, não um problema. Carrega rápido e não depende de stack pesada.

### O que está fraco

1. **A ordem narrativa está invertida.** O site v7 abre em resultados antes de instalar a dor. O próprio doc-mestre já decidiu a arquitetura "gancho → virada → prova" — o site ainda executa "prova → tese". Resultado prático: o visitante vê números impressionantes sem saber por que deveriam importar *para ele*. Autoridade sem tensão vira currículo.
2. **O quarteto está incompleto no site.** Os pilares ainda aparecem como tríade (Adicionar · Escalar · Reter). **Rentabilizar** é justamente o pilar que diferencia a The Rever da conversa genérica de "growth de assinatura" — é o que ninguém da categoria fala.
3. **O Council está subescrito.** O carro-chefe (maior LTV, 12 meses, R$25–40k) aparece como mais um card na lista. Um produto que carrega a marca precisa de peso visual e narrativo proporcional: hoje o site vende a porta de entrada e sussurra o destino.
4. **Resíduo de "AI-First".** Saturado no mercado e contrário à tese da própria marca (IA é engrenagem, não manchete). Toda menção vira "operada por IA", em corpo de texto, nunca em título.
5. **A candidatura não tem cerimônia.** Um formulário no fim da página trata o momento mais importante do funil como um rodapé. Para uma sala fechada, a candidatura é um rito — deve parecer um.

### Onde a narrativa pode ser melhor

- **A dor econômica central não está no topo.** "Vender ficou mais caro, e desperdiçar cliente ficou insustentável" é o gancho mais forte que a marca tem — fala com qualquer dono, de qualquer modelo, e valida o pilar editorial nº 1. Hoje ela não abre a conversa.
- **Falta a "terceira via" da cadeira executiva.** "Se sua empresa ainda não comporta um CRO, ela talvez já precise pensar como uma" é um ângulo que nenhum concorrente ocupa e que qualifica exatamente o ICP. Merece uma seção própria.
- **A distinção repetida ≠ recorrente não está explícita.** É o conceito que destrava a compreensão de todo o resto ("receita repetida depende de vender de novo; receita recorrente volta sozinha"). Um site que ensina essa distinção em 10 segundos já entregou valor — e posiciona a marca como quem tem método, não opinião.

### Onde o design pode evoluir

- **De "dark premium genérico" para "sala de máquinas executiva".** A paleta e a tipografia do brand board estão corretas, mas dark + Space Grotesk + acento verde, sozinhos, hoje descrevem metade dos sites de venture capital. A diferenciação precisa vir do *comportamento* da página: motion com física de precisão, números que se comportam como instrumentação (JetBrains Mono trabalhando), e uma peça central interativa que só a The Rever poderia ter — o motor de receita.
- **Motion decorativo → motion conceitual.** Fade-in no scroll é ornamento. O motion certo *demonstra a tese*: engrenagens que acoplam, contadores que acumulam (receita que "volta sozinha"), um balde que vaza quando falta retenção. Cada animação deve ser um argumento.
- **O vídeo do hero compete com o texto.** Painel 4:5 com vídeo à direita é bom para presença humana, mas no primeiro dobra a atenção deve estar na dor. Proposta: presença humana desce para a seção de lastro; o hero ganha o objeto proprietário (motor 3D/canvas).

---

## 2. Proposta estratégica de narrativa

### Arquitetura-mestra: gancho → virada → prova → sala → rito

A página é uma conversa de qualificação em formato de scroll. Cada seção tem uma função única, uma tensão e uma transição. Ordem proposta:

| # | Seção | Função | Tensão do leitor | Resposta da marca |
|---|-------|--------|------------------|-------------------|
| 0 | **Nav** | Presença, não menu | — | Wordmark + "Candidatura" (único CTA persistente) |
| 1 | **Hero — a dor** | Espelho do sintoma | "Minha receita começa do zero todo mês." | "Receita recorrente não é assinatura. É método." |
| 2 | **Tese — a virada** | Reenquadrar o problema | "Mas meu negócio não é de assinatura…" | Frase de enquadramento + repetida ≠ recorrente |
| 3 | **Método — o motor** | Mostrar a engenharia | "Ok, mas como?" | Quarteto Adicionar · Escalar · Reter · Rentabilizar (peça interativa) |
| 4 | **Evidências — números** | Provar competência | "Quem garante que funciona?" | Resultados anônimos + matérias públicas |
| 5 | **Lastro — a trajetória** | Provar origem | "De onde vem esse método?" | Timeline 2002→2026 + logos + formação |
| 6 | **As salas — produtos** | Dar a porta certa | "Onde eu entro?" | Lab (porta) → Council (destino) → Advisor/Studio |
| 7 | **IA — a engrenagem** | Diferenciar sem manchete | "E a IA nisso tudo?" | "A IA faz o pesado. O método decide." |
| 8 | **Filtro — quem entra** | Qualificar (e atrair) | "Isso é pra mim?" | Piso +R$10MM como argumento, não barreira |
| 9 | **Candidatura — o rito** | Converter qualificado | "Como eu começo?" | Formulário-cerimônia, CTA soft |

### Racional das decisões

- **Dor antes de prova** (corrige a inversão do v7): o visitante precisa se reconhecer antes de ser impressionado. O número só tem peso depois que a dor tem nome.
- **Tese entre dor e método**: a frase de enquadramento ("Faturar mais, mais vezes e por mais tempo…") é a ponte que abre o público para além de SaaS/assinatura — sem ela, dono de clínica, agência ou indústria se auto-exclui no primeiro scroll.
- **Council com hierarquia de carro-chefe**: dentro da seção de salas, o Council ocupa o maior espaço visual e narrativo ("sala de direção executiva de 12 meses"), com o Lab claramente sinalizado como porta de entrada. Advisor e Studio aparecem menores, por desenho — escassez real comunicada por proporção, não por texto.
- **Filtro como seção, não como asterisco**: "+R$10MM" exibido com orgulho transforma exclusão em desejo. O filtro é o argumento.
- **Um único CTA na página inteira**: "Iniciar candidatura". Sem CTAs concorrentes, sem newsletter no meio do funil, sem "saiba mais". Quem não está pronto, sai; quem está, desce.

### CTAs

- **Persistente (nav):** `Candidatura` — discreto, contorno fino.
- **Hero:** `Iniciar candidatura` + secundário fantasma `Conhecer o método ↓` (âncora, não link).
- **Pós-evidências:** `Iniciar candidatura` (repetição única no meio da página).
- **Salas:** cada sala com `Candidatar ao Lab` / `Candidatar ao Council` — mesmo formulário, campo de interesse pré-selecionado.
- **Nunca:** "garanta sua vaga", contagem regressiva, preço, desconto, pop-up.

---

## 3. Proposta visual

### Direção de arte: **"Sala de máquinas"**

Uma sala de board com a parede aberta para a engenharia. Não é escritório de advocacia (frio demais), não é startup (colorido demais), não é palco (guru). É o lugar onde o motor é construído: superfícies escuras foscas, instrumentação precisa, uma única cor viva funcionando como indicador de status — o verde ●.

Três princípios:

1. **Precisão sobre espetáculo.** Nenhum glow, nenhum neon, nenhum gradiente colorido (banidos pelo brand board — e com razão). O impacto vem de tipografia grande, espaço negativo generoso e movimento com física de máquina: aceleração lenta, inércia, paradas exatas.
2. **Instrumentação como estética.** Números, eyebrows, labels e métricas sempre em JetBrains Mono, como leitura de painel: `NRR 105%+`, `2002—2026`, `BASE 4MM`. A página inteira deve parecer calibrada.
3. **O verde é um LED, não uma tinta.** Regra dos 5% respeitada à risca: o ponto do logo, o indicador ativo da engrenagem de IA, o estado de foco do formulário, o cursor do contador. Nunca em fundos, nunca em títulos inteiros.

### Paleta (do brand board — mantida)

| Papel | Cor | Uso |
|-------|-----|-----|
| Fundo-base | `#141414` | 80% da página |
| Fundo elevado | `#1B1B1A` (derivada) | Cards, painéis, formulário |
| Texto principal | `#F7F4EF` | Títulos e corpo sobre escuro |
| Texto secundário | `#8A8A8A` | Apoios, microcopy, labels |
| Areia | `#E8DFD0` | 1–2 seções claras de respiro (Lastro e/ou Filtro) para quebrar a monotonia do dark |
| Acento | `#168E7A` | ≤5%: indicadores, foco, o ponto ● |

A inversão pontual para areia (`#E8DFD0` com texto `#141414`) é a evolução mais barata e mais eficaz contra o "dark genérico": dá ritmo editorial de revista e destaca o dark de volta quando ele retorna.

### Tipografia

- **Space Grotesk** — títulos, em corpo grande (clamp 44→96px no hero), peso 500–700, tracking levemente negativo. Frases curtas quebradas em 2–3 linhas com quebra controlada.
- **JetBrains Mono** — eyebrows em caps com letter-spacing largo (`0.18em`), números, labels de timeline, microcopy de formulário.
- **Corpo** — Space Grotesk 400, 17–18px, largura máx. 62ch, entrelinha 1.65. Texto de leitura nunca em mono.

### Grid

- 12 colunas, máx. 1320px, margens laterais 6vw.
- Assimetria deliberada: texto dominante em 6–7 colunas à esquerda, objetos/instrumentos à direita — ecoa o hero split atual, mas com disciplina em todas as seções.
- Seções com respiro real: 140–180px de padding vertical. Site premium é site que não tem pressa.

### Fotos e vídeos

- Tratamento único: quase P&B com leve calor (dessaturação ~85%, temperatura +5), contraste alto, grão fino. Nada de stock corporativo.
- Vídeo do Carlos sai do hero e ancora a seção de **Lastro** — presença humana no momento em que a página fala de trajetória. Loop mudo, painel 4:5, com legenda em mono: `CARLOS GERALDO · 20 ANOS DE RECORRÊNCIA`.
- Fotos de bastidor (Drive 99_Assets) em cards pequenos na seção do Lab/Council — "sala de construção" real, não render.

### Logos e matérias

- **Logos de empresas** (TIM · Oi · SKY · Nextel · Wine · Cetrus · Sanar · +Pet): monocromáticas em `#8A8A8A`, altura fixa, em faixa própria na seção de Lastro — nunca coladas em números (regra de ouro).
- **Logos de formação** (MIT, MIT Sloan, USP, Singularity): linha separada, menor, sob o label `FORMAÇÃO`.
- **Matérias de imprensa**: "mesa de evidências" — cards horizontais com recorte do headline da matéria, veículo e ano em mono. Por serem fato público, *podem* atribuir números a empresas — é o único lugar do site onde número e marca se encontram, e isso deve ser dito no microcopy (`Fatos públicos. Fontes originais linkadas.`), transformando o rigor em prova de caráter.

### Motion

Física de máquina, não de brinquedo:

- **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)`, durações 0.8–1.2s. Sem bounce, sem elastic.
- **Reveals:** translateY 24px + fade, stagger de 80ms por elemento. Uma vez só — nada re-anima ao voltar.
- **Contadores:** números das evidências sobem no scroll com easing desacelerado (a curva de um medidor real), cursor verde piscando ao final.
- **Título do hero:** entrada linha a linha por clip-path (persiana), 100ms de stagger.
- **`prefers-reduced-motion`:** tudo estático, sem exceção.

### 3D / WebGL / Three.js

Sim — mas **uma** peça, com propósito, e com fallback. Ver seção 5. Regra dura: o 3D obedece ao brand board (sem glow, sem neon, materiais foscos, wireframe fino em `#8A8A8A`/`#F7F4EF`, acento verde apenas no nó de IA). Se o 3D parecer demo de Three.js, corta-se o 3D, não o brand board.

---

## 4. Proposta de home page (bloco a bloco)

### 4.1 Hero — a dor

- **Layout:** texto 7 colunas à esquerda; à direita, o **motor de recorrência** (objeto 3D/canvas, ver §5) girando lentamente.
- **Eyebrow (mono):** `DESENVOLVIMENTO EXECUTIVO · RECEITA RECORRENTE`
- **H1:** "Sua receita começa do zero todo mês?"
- **Virada (linha de marca, com o ●):** "Receita recorrente não é assinatura. **É método.**"
- **Apoio:** "Um ambiente fechado onde donos e executivos constroem um motor de receita que não recomeça do zero — com método, operação e 20 anos de lastro real."
- **CTAs:** `Iniciar candidatura` + `Conhecer o método ↓`
- **Rodapé do hero (mono, discreto):** `SALA FECHADA · ACESSO POR CANDIDATURA · +R$10MM`— o filtro já aparece na primeira dobra, como distinção.

### 4.2 Bloco de tese — a virada

- Fundo `#141414`, tipografia gigante, sem imagem. A frase É o design.
- **Statement:** "Faturar mais, mais vezes e por mais tempo para o mesmo cliente **não exige assinatura**. Exige estratégia, método e operação."
- **Par conceitual (duas colunas, mono nos labels):**
  - `RECEITA REPETIDA` — "Depende de vender de novo. Todo mês, a conta reinicia."
  - `RECEITA RECORRENTE` — "Volta sozinha. Todo mês, a base trabalha."
- **Fecho:** "Se vender ficou mais caro, desperdiçar cliente ficou insustentável."

### 4.3 Bloco do método — o motor (quarteto)

- A peça interativa central (ver §5): quatro engrenagens acopladas — **Adicionar · Escalar · Reter · Rentabilizar** — com uma quinta engrenagem menor, verde, quase escondida: `IA`.
- Hover/tap em cada engrenagem revela a definição de uma linha:
  - **Adicionar** — receita nova entrando pelo desenho certo de oferta.
  - **Escalar** — a receita que existe crescendo sem dobrar a folha.
  - **Reter** — o que já paga, continuando a pagar.
  - **Rentabilizar** — mais margem por cliente, sem aquisição nova.
- **Microcopy sob a peça:** "Aquisição é só uma perna. Retenção decide o lucro."
- Arco do método em quatro fases (Diagnóstico → Arquitetura* → Implementação → Operação) em linha horizontal fina, mono. (*no site, nomear "Desenho" para poupar "arquitetura", conforme parcimônia do doc-mestre.)

### 4.4 Bloco de evidências — números e matérias

- **Título:** "Construído dentro de operações reais. Não em teoria."
- **Grid de contadores (anônimos, mono):**
  - `+4MM` — assinantes sob gestão em uma única operação
  - `100k → 400k` — assinantes em ciclo de crescimento
  - `R$300MM → R$1BI` — faturamento em operação liderada
  - `R$3,5BI` — valuation na venda
  - `20k → 30k` — vidas em 12 meses
  - `ZERO TECH → IA` — engrenagem central instalada em operação tradicional
- **Microcopy:** "Números de operações reais, apresentados sem atribuição. Detalhes em conversa."— o rigor vira charme.
- **Mesa de evidências:** cards das matérias públicas (estes sim, com veículo, marca e número — fato público), com link para a fonte original.
- **CTA (única repetição do meio da página):** `Iniciar candidatura`

### 4.5 Bloco de lastro — trajetória e autoridade

- Fundo **areia** `#E8DFD0` (respiro editorial).
- **Timeline horizontal interativa** 2002→2026: TIM (2→150 lojas) · Oi (B2B grandes contas) · SKY (retenção de base) · Nextel (migração de base, venda) · Wine (growth do maior clube de vinhos do mundo) · Cetrus/Sanar (CMO/CCO pós-fusão) · +Pet (CRO, reestruturação 360). *Sem números atribuídos — os cargos e escopos bastam.*
- **Vídeo/retrato do Carlos** em painel 4:5 ao lado do texto: "A The Rever não vende uma pessoa. Vende competência provada. Carlos Geraldo é a prova — não o produto."
- **Faixa de logos** (monocromáticas) + linha de **formação** (MIT Professional Education · MIT Sloan · MBA USP · Singularity).

### 4.6 Bloco das salas — produtos

- **Título:** "Quatro salas. Uma engenharia."
- **Hierarquia visual explícita:**
  - **The Rever Lab · Construindo Receita Recorrente** — card largo, marcado `PORTA DE ENTRADA` (mono). "Uma imersão de construção para destravar e acelerar o negócio com um método sólido de receita recorrente." Apoio: *"Independente do modelo de negócio ou serviço."* Entrega: proposta de valor, mercado, estratégia de 90 dias. Operada por IA no diagnóstico e na modelagem.
  - **The Rever Council** — o card dominante, marcado `CARRO-CHEFE`. "Sala de direção executiva de 12 meses. Leitura sênior do negócio, decisões orientadas, acompanhamento de execução — e IA como engrenagem de apoio entre os encontros. 12–15 cadeiras por turma."
  - **Advisor** — card menor: "Aconselhamento executivo 1:1. Seis cadeiras por ano — limite duro."
  - **Studio** — card menor: "Projetos in company: desenho, implantação e acompanhamento dentro da sua operação."
- **Linha de ascensão (mono, fina):** `LAB → COUNCIL → ADVISOR / STUDIO`
- Sem preço, sem data, sem "vagas abertas". Cada card: `Candidatar`.

### 4.7 Bloco de IA — a engrenagem

- Curto, uma dobra, propositalmente discreto (a discrição É a mensagem).
- **Título:** "A IA faz o pesado. O método decide."
- **Corpo:** "Dentro do motor, a IA é engrenagem: antecipa cancelamento antes do pedido, lê sinal de expansão na base, modela preço e recupera pagamento. Nunca é manchete. É o que trabalha enquanto o board dorme."
- Visual: a engrenagem verde do motor do hero, isolada, em close — mesmo objeto, novo ângulo (consistência do sistema).

### 4.8 Bloco de filtro — quem entra

- **Título:** "Não é para todo mundo. É por desenho."
- Três linhas-critério (mono + texto): `+R$10MM` de faturamento · modelo que gera (ou pode gerar) receita que volta · disposição de construir, não assistir.
- **Terceira via da cadeira executiva:** "Se sua empresa ainda não comporta um CRO, ela talvez já precise pensar como uma."
- Microcopy: "Quem ainda não passa pelo filtro entra em lista de requalificação — voltamos a conversar em 6–12 meses."

### 4.9 Bloco de candidatura — o rito

- Painel elevado, foco absoluto, sem distração (footer mínimo depois).
- **Título:** "A conversa é uma qualificação. Não um pitch."
- **Campos:** nome · e-mail · empresa · faturamento (select com faixas; +R$10MM como piso explícito) · o modelo hoje (transacional / misto / recorrente) · sala de interesse (Lab/Council/Advisor/Studio/não sei — "não sei" é resposta válida) · "qual é o balde furado hoje?" (texto livre).
- **CTA:** `Enviar candidatura`
- **Microcopy sob o botão:** "Sem turma aberta. Sem urgência. Respondemos toda candidatura qualificada em até 5 dias úteis."

---

## 5. Ideias de experiência 3D / interativa

Critério para todas: servir à tese, obedecer ao brand board (sem glow/neon), degradar com elegância (fallback canvas 2D/estático), e nunca custar mais de ~1.5s de carregamento no 4G.

### 5.1 ★ O Motor de Recorrência (recomendada — hero + fio condutor)

Quatro anéis/engrenagens de traço fino acoplados (Adicionar · Escalar · Reter · Rentabilizar), girando em velocidade de máquina pesada, com uma quinta engrenagem pequena e verde (IA) no miolo. Wireframe fosco `#8A8A8A`/`#F7F4EF` sobre `#141414`; profundidade por leve paralaxe ao mouse, não por iluminação dramática.

- **O truque narrativo:** o mesmo objeto reaparece pela página — completo no hero, explodido em 4 no bloco do método, em close na engrenagem verde no bloco de IA. Um objeto, três argumentos. É isso que transforma "site com 3D" em "experiência".
- **Interação:** hover em cada anel desacelera o conjunto e revela o label; se o usuário "remove" Reter (tap-and-hold), o motor visivelmente perde ritmo — a tese demonstrada em 2 segundos.
- **Tech:** Three.js com geometria própria (toros + dentes por instancing), ~60kb de cena; fallback canvas 2D (anéis em stroke) para mobile fraco; imagem estática para `prefers-reduced-motion`.

### 5.2 O Balde Furado (seção de tese — alternativa/complemento leve)

Visualização canvas 2D: partículas entram por cima (aquisição), vazam por baixo (churn). Um toggle `MÉTODO ON` fecha os furos e a base acumula — o contador de "base" dispara. Didático, barato (zero WebGL), brutalmente eficaz para a distinção repetida ≠ recorrente. Risco: virar infográfico fofo — mitigar com traço técnico e mono.

### 5.3 Mesa de Evidências (seção de evidências)

As matérias como cards físicos sobre uma superfície escura, em leve perspectiva; drag horizontal com inércia; ao focar, o card levanta 8px (sombra dura, sem glow) e revela veículo/ano/link. HTML+CSS 3D transforms — sem WebGL. Sensação de "dossiê sobre a mesa do board".

### 5.4 Timeline Executiva Interativa (seção de lastro)

Linha horizontal 2002→2026 com scroll-scrub: cada marco expande cargo/escopo; logos monocromáticas acendem (opacidade, não cor) conforme o ano passa. GSAP ScrollTrigger que já existe no stack dá conta.

### 5.5 A Operação Navegável (página interna futura — não na home)

O motor como objeto orbitável em página própria ("O Método"), onde cada engrenagem abre o detalhe das 4 fases. Candidata a fase 2 — na home seria peso demais.

### Recomendação de pacote

**5.1 + 5.3 + 5.4 na home** (um WebGL, dois CSS/canvas). 5.2 como peça de campanha/social ou easter egg na página do método. 5.5 em fase 2. Orçamento de performance: LCP < 2.0s, motor carrega *depois* do texto do hero (o H1 nunca espera o 3D).

---

## 6. Copy sugerida (pronta para uso)

Toda a copy abaixo passa no checklist do doc-mestre: sem vocabulário proibido, sem número atribuído a empresa, CTA soft, IA como engrenagem.

### Hero
> **DESENVOLVIMENTO EXECUTIVO · RECEITA RECORRENTE**
>
> # Sua receita começa do zero todo mês?
>
> Receita recorrente não é assinatura. **É método.**
>
> Um ambiente fechado onde donos e executivos constroem um motor de receita que não recomeça do zero — com método, operação e 20 anos de lastro real.
>
> [ Iniciar candidatura ]   [ Conhecer o método ↓ ]
>
> `SALA FECHADA · ACESSO POR CANDIDATURA · +R$10MM`

### Tese
> Faturar mais, mais vezes e por mais tempo para o mesmo cliente **não exige assinatura.** Exige estratégia, método e operação.
>
> `RECEITA REPETIDA` — depende de vender de novo. Todo mês, a conta reinicia.
> `RECEITA RECORRENTE` — volta sozinha. Todo mês, a base trabalha.
>
> Se vender ficou mais caro, desperdiçar cliente ficou insustentável.

### Método
> ## O motor tem quatro engrenagens.
> **Adicionar** receita nova. **Escalar** a que existe. **Reter** o que já paga. **Rentabilizar** a base.
>
> Aquisição é só uma perna. Retenção decide o lucro.
>
> `DIAGNÓSTICO → DESENHO → IMPLEMENTAÇÃO → OPERAÇÃO`

### Evidências
> ## Construído dentro de operações reais. Não em teoria.
> `+4MM` assinantes sob gestão · `100k → 400k` assinantes · `R$300MM → R$1BI` de faturamento · `R$3,5BI` de valuation na venda · `20k → 30k` vidas em 12 meses · `ZERO TECH → IA` como engrenagem central
>
> *Números de operações reais, sem atribuição. Detalhes em conversa.*
>
> **Na imprensa** — fatos públicos, fontes originais linkadas.

### Lastro
> ## Vinte anos dentro das salas onde a recorrência foi inventada.
> Por décadas, a competência de construir receita que volta ficou trancada em telecom, TV por assinatura e clubes de base instalada. A The Rever existe para abrir essas salas.
>
> Carlos Geraldo é a prova — não o produto.
>
> `2002 TIM · 2011 OI · 2013 SKY · 2014 NEXTEL · 2018 WINE · 2024 CETRUS/SANAR · 2025 +PET`
> `FORMAÇÃO — MIT PROFESSIONAL EDUCATION · MIT SLOAN · MBA USP · SINGULARITY UNIVERSITY`

### Salas
> ## Quatro salas. Uma engenharia.
>
> **The Rever Lab · Construindo Receita Recorrente** — `PORTA DE ENTRADA`
> Uma imersão de construção para destravar e acelerar o negócio com método sólido de receita recorrente. Você sai com proposta de valor, leitura de mercado e estratégia de 90 dias.
> *Independente do modelo de negócio ou serviço.*
>
> **The Rever Council** — `CARRO-CHEFE`
> Sala de direção executiva de 12 meses. Leitura sênior do negócio, decisões orientadas e acompanhamento de execução — com IA como engrenagem de apoio entre os encontros. 12–15 cadeiras por turma.
>
> **Advisor** — Aconselhamento executivo 1:1. Seis cadeiras por ano. Limite duro.
>
> **Studio** — Projetos in company: desenho, implantação e acompanhamento dentro da sua operação.
>
> `LAB → COUNCIL → ADVISOR / STUDIO`

### IA
> ## A IA faz o pesado. O método decide.
> Dentro do motor, a IA é engrenagem: antecipa cancelamento antes do pedido, lê sinal de expansão na base, modela preço e recupera pagamento. Nunca é manchete.

### Filtro
> ## Não é para todo mundo. É por desenho.
> `+R$10MM` de faturamento anual · modelo que gera — ou pode gerar — receita que volta · disposição de construir, não assistir.
>
> Se sua empresa ainda não comporta um CRO, ela talvez já precise pensar como uma.

### Candidatura
> ## A conversa é uma qualificação. Não um pitch.
> [formulário]
> [ Enviar candidatura ]
> *Sem turma aberta. Sem urgência. Respondemos toda candidatura qualificada em até 5 dias úteis.*

### Microcopy do sistema
- Placeholder do campo de dor: `Onde o balde está furado hoje?`
- Estado de envio: `Candidatura recebida. Falamos em até 5 dias úteis.`
- Footer: `The REVER● — REVenue forEVER. Construímos junto. Tijolo por tijolo.`
- 404 (bônus): `Esta página cancelou. Acontece quando não há retenção.`

---

## 7. Recomendações finais

### Manter
- Slogan, wordmark com ●, paleta e tipografia do brand board (fonte de verdade).
- Disciplina comercial: sem preço, sem urgência, candidatura com filtro.
- Stack leve (HTML + GSAP); Three.js entra como módulo isolado, não como framework.
- Logos separadas de números; matérias como único ponto de atribuição pública.

### Mudar
- Ordem narrativa: dor → virada → método → prova → salas → rito (corrige a inversão do v7).
- Tríade → **quarteto** em toda a página (Rentabilizar é diferenciação, não detalhe).
- Council reescrito e re-hierarquizado como carro-chefe visível.
- "AI-First" → "operada por IA", sempre em corpo de texto.
- Vídeo humano do hero → seção de lastro; hero recebe o motor (objeto proprietário).
- Candidatura de formulário-rodapé → rito com cerimônia.

### Remover
- Qualquer resíduo de "arquitetura" como muleta (preferir método, operação, motor; "Desenho" como nome da fase 2).
- CTAs concorrentes e links que dispersem o funil único.
- Ícones decorativos, gradientes, stock — qualquer coisa que o brand board já baniu e eventualmente sobreviva no v7.

### Testar (quando houver tráfego para significância)
1. **Hero A/B:** dor-first ("Sua receita começa do zero todo mês?") vs slogan-first ("Receita recorrente não é assinatura. É método.") — hipótese: dor-first ganha em candidaturas qualificadas.
2. **Filtro na primeira dobra** (`+R$10MM` no hero) vs apenas na seção de filtro — hipótese: exibir cedo aumenta qualidade e reduz volume; medir taxa de qualificação, não taxa de envio.
3. **Motor interativo vs estático** no mobile — se o engajamento não pagar o custo de performance, mobile recebe a versão estática sem culpa.
4. **Posição da mesa de evidências:** antes vs depois do lastro.

### Métricas que importam
Não sessão nem scroll: **candidaturas qualificadas / semana**, taxa de passagem no piso, % de candidaturas com campo de dor preenchido com substância, e origem (IG/LinkedIn/direto). O site é uma máquina de qualificação — medi-lo como landing page seria repetir o erro da categoria.

---

## Anexo — Protótipo

`prototipo/index.html` — protótipo navegável da home proposta (seções 4.1–4.9), com:
- paleta, tipografia (fontes embutidas) e grid da proposta;
- motor de recorrência em canvas 2D (a versão Three.js do §5.1 substituiria este placeholder mantendo a mesma coreografia);
- contadores de evidência, timeline de lastro, hierarquia de salas e formulário-rito;
- motion com física de precisão e respeito a `prefers-reduced-motion`.

É uma prova de direção, não um build final: fotos, vídeos, logos e matérias entram dos assets do Drive na fase de produção.
