# Componentes — The Rever v9.1

Cada arquivo `.html` desta pasta é um componente **independente e funcional**: abra no navegador (duplo clique) para ver, e copie os blocos marcados para o seu site.

## Os componentes

| Arquivo | Seção da home | Tem JS próprio? |
|---|---|---|
| `01-hero-motor.html` | Hero + motor de recorrência (canvas) | Sim — animação do motor |
| `02-grafico-valor-acumula.html` | Tese + gráfico repetida vs recorrente | Não (animação via CSS) |
| `03-contadores-evidencias.html` | Números de evidência com contadores | Sim — contagem no scroll |
| `04-pilha-materias.html` | "O mesmo Executivo…" + card O Globo | Não |
| `05-faixa-logos.html` | Faixas de logos (operações + formação) | Não |
| `06-fundador-timeline.html` | Fundador + timeline vertical 2025→2002 | Não |
| `07-salas.html` | Foto de ambiente + Lab/Council/Advisor/Studio | Não |
| `08-engrenagem-ia.html` | Engrenagem verde de IA (canvas) | Sim — animação da engrenagem |
| `09-candidatura.html` | Formulário-rito de candidatura | Sim — confirmação de envio |

## Como levar para o seu site

Cada arquivo tem 4 partes, todas marcadas com comentários:

1. **`BASE THE REVER`** (dentro do `<style>`) — tokens de cor, tipografia, botões e sistema de reveal. **Copie UMA vez só** para o CSS global do site. É idêntica em todos os arquivos.
2. **`CSS DO COMPONENTE`** — o estilo específico daquele bloco. Copie junto com o markup.
3. **`MARKUP DO COMPONENTE`** — o HTML entre os comentários `══`. Cole onde a seção deve aparecer.
4. **Scripts** — o script de *reveal on scroll* é único (copie uma vez, ou troque pelo seu GSAP ScrollTrigger: basta adicionar a classe `.in` aos elementos `.rv` quando entrarem na viewport). Os scripts específicos (motor, contadores, engrenagem, formulário) acompanham seus componentes.

As fontes vêm do Google Fonts (`Space Grotesk` + `JetBrains Mono`) via `<link>` no `<head>` — já incluído em cada arquivo. O protótipo completo (`../prototipo/index.html`) usa as mesmas fontes embutidas em base64, se preferir não depender de CDN.

## Assets reais a substituir (comentários `PRODUÇÃO:` no código)

- **Logos** (`05`): trocar os wordmarks recriados por `<img>` com os PNGs oficiais de `the-rever-design-system/logos/png`.
- **Matéria** (`04`): substituir o card recriado pelo screenshot real da matéria (pasta Matérias do Drive), mantendo `.stack`/`.back`.
- **Retrato do fundador** (`06`): entra como background de `.founder-bg` (instrução no CSS).
- **Foto de imersão** (`07`): entra como background de `.ambiente` (instrução no CSS).
- **Formulário** (`09`): apontar o envio para seu backend/serviço no listener de `submit`.

## Regras que o código já respeita

- Verde `#168E7A` só como acento (~5%); sem gradiente colorido, sem stock, sem ícone decorativo.
- Números nunca atribuídos a empresas — exceto na matéria de imprensa (fato público).
- CTAs soft, sem urgência, sem preço.
- `prefers-reduced-motion` desliga todas as animações.
