# ai-memory no Surface: uma memória para todos os projetos

Configuração do [ai-memory](https://github.com/akitaonrails/ai-memory) (v3.4.4)
para que **Claude Code e Codex compartilhem uma única memória**, em todos os
projetos, no Surface (Windows).

| Arquivo | Para quê |
|---|---|
| [`instalar-surface.ps1`](instalar-surface.ps1) | Instala, configura Claude Code + Codex e verifica. Pode rodar de novo sem problema. |
| [`backup-ai-memory.ps1`](backup-ai-memory.ps1) | Backup da memória; com `-Agendar`, cria um backup semanal automático. |
| [`../.ai-memory.toml`](../.ai-memory.toml) | Exemplo por repositório: impede que `.env`, chaves e `secrets/` entrem na memória. |

## Arquitetura

```
Surface (Windows)
├── ai-memory (servidor local 127.0.0.1:49374, inicia sozinho no logon)
│     └── %LOCALAPPDATA%\ai-memory   ← memória persistente
│           ├── wiki\   páginas markdown, versionadas com git (fonte da verdade)
│           └── db\     índice SQLite (reconstruível a partir do wiki)
├── Claude Code ──┐  MCP (consulta) + hooks (registro automático) + skills
└── Codex ────────┘
```

- **Uma instância só.** Não há servidor externo, túnel nem nuvem.
- **Nenhuma chave de API.** Registro, busca e passagem de contexto funcionam
  sem chamar nenhum LLM.
- O servidor só aceita conexões do próprio Surface e exige token.

## Os 6 requisitos

| # | Requisito | Como fica atendido |
|---|---|---|
| 1 | Instância única no Surface, com armazenamento persistente | `ai-memory setup` cria **um** servidor por usuário, que inicia no logon. Os dados ficam em `%LOCALAPPDATA%\ai-memory` (wiki em markdown com histórico git + SQLite). |
| 2 | Integração global com Claude Code e Codex (MCP + hooks) | `setup --agent claude-code --agent codex` grava MCP, hooks e skills na configuração **do usuário** (`~\.claude`, `~\.codex`), então vale para qualquer pasta. O Codex lê o token da variável `AI_MEMORY_AUTH_TOKEN`, que o script define. |
| 3 | Memória individual por projeto, sem misturar contextos | Cada repositório vira um projeto separado automaticamente (pelo remote `origin` do git ou, sem ele, pelo nome da pasta). As consultas usam o projeto da pasta onde o agente está. |
| 4 | Perfil global de padrões e preferências | O **perfil entre projetos** já vem ligado. Toda sessão, em qualquer projeto, recebe um resumo de "suas escolhas de sempre". Ele aprende quando você diz "sempre…", "prefiro…" ou "em todos os meus projetos…". |
| 5 | Busca cruzada entre projetos, só quando pedida | Por padrão a busca fica no projeto atual. Para buscar em todos: `ai-memory search --global "termo"` ou peça ao agente "procure em todos os meus projetos por …". |
| 6 | Segurança e backup, sem guardar credenciais | O token fica num arquivo protegido e nunca é exibido. Um filtro remove credenciais óbvias antes de gravar. O `.ai-memory.toml` exclui arquivos sensíveis. O `backup-ai-memory.ps1` faz o backup. Detalhes em [Segurança](#segurança). |

## Instalação

**Opção A, script (recomendado).** Baixe esta pasta (ou o repositório) para o
Surface e, no PowerShell, dentro da pasta `ai-memory`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar-surface.ps1
```

**Opção B, comandos manuais.** É o mesmo que o script faz:

```powershell
irm https://github.com/akitaonrails/ai-memory/releases/latest/download/install.ps1 | iex
ai-memory setup --agent claude-code --agent codex
# o Codex lê o token desta variável:
[Environment]::SetEnvironmentVariable('AI_MEMORY_AUTH_TOKEN', (Get-Content -Raw "$env:LOCALAPPDATA\ai-memory\auth-tokens\default").Trim(), 'User')
```

Depois de qualquer uma das duas:

1. **Feche e reabra** o Claude Code, o Codex e o terminal, para que carreguem
   o MCP, os hooks e as variáveis novas.
2. Se o Codex pedir para **confiar nos hooks** do ai-memory, aceite.

> Se outra sessão do Claude já estiver instalando o ai-memory no Surface, não
> rode as duas ao mesmo tempo. Quando ela terminar, rodar o script de novo só
> confere e completa o que faltar, como a variável do Codex.

## Validação

```powershell
ai-memory status
ai-memory profile status
```

O esperado:

- `ai-memory status` mostra `auth: bearer token` e os contadores `sessions`
  e `observations`.
- `ai-memory profile status` mostra `Profile: on (global; single-user server)`.

Teste de ponta a ponta:

1. Abra o Claude Code dentro de um projeto, converse um pouco e saia.
2. Rode `ai-memory status` de novo. `sessions` e `observations` devem ter
   aumentado.
3. Abra o **Codex na mesma pasta** e pergunte: "O que você lembra deste
   projeto?". Ele deve responder com o que aconteceu na sessão do Claude Code.

Para ver a memória no navegador, abra <http://127.0.0.1:49374/web>. Quando
pedir login, use qualquer usuário e, como senha, o conteúdo de
`%LOCALAPPDATA%\ai-memory\auth-tokens\default`.

## Uso no dia a dia

| Você quer… | Diga ao agente (ou rode) |
|---|---|
| Uma preferência para **todos** os projetos | "Em todos os meus projetos: use pytest e mensagens de commit em inglês." |
| Uma regra **só deste** projeto | "Lembre: neste projeto o texto do Heygen tem limite de 1500 caracteres." |
| Ver o perfil aprendido | `ai-memory profile list` / `ai-memory profile review` |
| Apagar uma preferência do perfil | `ai-memory profile forget <caminho>` |
| Buscar em todos os projetos | `ai-memory search --global "timeout gemini"` |
| Trocar de agente no meio da tarefa | Saia do Claude Code e abra o Codex na mesma pasta. Ele recebe onde você parou, o que falhou e o que ficou pendente. |
| Tirar um projeto do perfil (ex.: cliente) | No `.ai-memory.toml` do projeto: `[profile]` com `contribute = false` |

A ordem de prioridade é: o que você diz na conversa, depois o `CLAUDE.md`/`AGENTS.md`
do repositório, depois a memória do projeto e, por último, o perfil global.

## Segurança

- **Token:** o `setup` gera um token guardado em arquivo que só o seu usuário
  lê. O Claude Code acessa por uma ponte local que lê esse arquivo. O Codex lê
  a variável de usuário `AI_MEMORY_AUTH_TOKEN`. O servidor só escuta em
  `127.0.0.1`.
- **Filtro de credenciais:** antes de gravar, o ai-memory remove credenciais
  óbvias (chaves de API, tokens). O próprio projeto avisa que esse filtro é de
  melhor esforço, não uma garantia. Por isso:
  - coloque um `.ai-memory.toml` em cada repositório com segredos, como o
    [deste repositório](../.ai-memory.toml), que já exclui `.env`, `.env.*`,
    `*.pem`, `*.key` e `secrets/`;
  - nunca peça ao agente para "lembrar" uma chave ou senha.
- **Projetos muito sensíveis:** é possível inverter a lógica e registrar
  apenas os repositórios marcados
  (`ai-memory install-hooks --agent claude-code --capture-mode allowlist --apply`).
- **Windows nativo** ainda aparece como "experimental" na tabela de suporte do
  ai-memory, enquanto o WSL2 é suportado por completo. Se algo falhar nos hooks,
  rode `ai-memory doctor` e me mande a saída.

## Backup

```powershell
# backup agora (vai para %USERPROFILE%\ai-memory-backups, mantém os 8 últimos)
powershell -NoProfile -ExecutionPolicy Bypass -File .\backup-ai-memory.ps1

# e também agenda um backup semanal (domingo, 12:00)
powershell -NoProfile -ExecutionPolicy Bypass -File .\backup-ai-memory.ps1 -Agendar
```

Se o agendamento der "Acesso negado", rode esse último comando num PowerShell
aberto como administrador.

O backup **não** inclui os tokens, mas inclui o `config.toml`, que pode ter
chaves de API se você configurar um LLM no futuro. Trate os arquivos `.tar.gz`
como dado sensível e evite pastas públicas ou compartilhadas.

## Manutenção

| Tarefa | Comando |
|---|---|
| Atualizar | `ai-memory upgrade` e depois rodar `instalar-surface.ps1` de novo |
| Diagnóstico | `ai-memory doctor` |
| Depois de trocar o token | Rodar `instalar-surface.ps1` de novo, para atualizar a variável `AI_MEMORY_AUTH_TOKEN` do Codex |
| Ligar outro agente (ex.: Cursor) | `.\instalar-surface.ps1 -Agentes claude-code,codex,cursor` |
| Remover a integração dos agentes | `ai-memory uninstall` (mostra o plano) e depois `ai-memory uninstall --apply` |

## Fora do escopo por enquanto

- **Conversas do ChatGPT e Google Drive:** o ai-memory não importa nada disso
  sozinho. Existe um importador opcional (`companions/ai-memory-importer`) que
  aceita conversas num JSON genérico, mas ele precisa ser compilado em Rust e
  exige converter o export do ChatGPT. Vale planejar isso à parte.
- **Acesso de outros aparelhos ou das sessões do Claude Code na nuvem:**
  exigiria expor o servidor com HTTPS (Cloudflare Tunnel, por exemplo). Com a
  instância única no Surface, isso não é necessário.
