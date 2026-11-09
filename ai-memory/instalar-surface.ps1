<#
.SYNOPSIS
    Instala e configura o ai-memory no Surface (Windows) para Claude Code e Codex.

.DESCRIPTION
    Cria uma instancia unica do ai-memory neste computador:
      - servidor local em http://127.0.0.1:49374, que inicia sozinho no logon;
      - memoria persistente em %LOCALAPPDATA%\ai-memory (wiki em markdown
        versionado com git + indice SQLite);
      - Claude Code e Codex ligados globalmente (MCP + hooks + skills);
      - perfil entre projetos ligado (padrao para um unico usuario).

    Pode ser executado mais de uma vez: o que ja estiver feito nao e refeito.
    Nao precisa de administrador.

.PARAMETER Agentes
    Agentes a ligar. Aceita os valores de `ai-memory setup --agent`
    (claude-code, codex, cursor, gemini-cli, ...).

.PARAMETER Idioma
    Idioma das mensagens do ai-memory no terminal (pt-BR ou en).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar-surface.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar-surface.ps1 -Agentes claude-code,codex,cursor
#>
[CmdletBinding()]
param(
    [string[]] $Agentes = @('claude-code', 'codex'),
    [ValidateSet('pt-BR', 'en')]
    [string] $Idioma = 'pt-BR'
)

$ErrorActionPreference = 'Stop'

# Com `powershell -File`, "-Agentes a,b,c" chega como um texto unico "a,b,c".
$Agentes = @($Agentes | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($Agentes.Count -eq 0) { throw 'Informe ao menos um agente em -Agentes.' }

function Passo([string] $Texto) {
    Write-Host ''
    Write-Host "==> $Texto" -ForegroundColor Cyan
}

function Definir-VariavelUsuario([string] $Nome, [string] $Valor) {
    [Environment]::SetEnvironmentVariable($Nome, $Valor, 'User')
    Set-Item -Path "Env:$Nome" -Value $Valor
}

# O Windows PowerShell 5.1 pode usar TLS 1.0 por padrao; o GitHub exige 1.2.
if ($PSVersionTable.PSVersion.Major -lt 6) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

$Exe = Join-Path $env:LOCALAPPDATA 'Programs\ai-memory\ai-memory.exe'
$PastaDados = Join-Path $env:LOCALAPPDATA 'ai-memory'
$ArquivoToken = Join-Path $PastaDados 'auth-tokens\default'

# ---------------------------------------------------------------------------
# 1. Binario: instalador oficial (confere o SHA-256 do release antes de instalar)
# ---------------------------------------------------------------------------
Passo 'Instalando o ai-memory'
if (Test-Path $Exe) {
    Write-Host "Ja instalado em $Exe (para atualizar depois: ai-memory upgrade)."
} else {
    Invoke-RestMethod 'https://github.com/akitaonrails/ai-memory/releases/latest/download/install.ps1' | Invoke-Expression
    if (-not (Test-Path $Exe)) {
        throw "A instalacao terminou, mas $Exe nao foi encontrado."
    }
}

Definir-VariavelUsuario 'AI_MEMORY_LANGUAGE' $Idioma

# ---------------------------------------------------------------------------
# 2. setup: pasta de dados + token, inicio automatico no logon,
#    MCP + hooks + skills para cada agente, e uma autoverificacao.
# ---------------------------------------------------------------------------
Passo ("Configurando para: " + ($Agentes -join ', '))

# Com AI_MEMORY_AUTH_TOKEN definido, o setup gravaria o token direto na
# configuracao do Claude Code. Sem ele, o Claude Code usa a ponte local que
# le o token do arquivo protegido. Por isso a variavel sai desta janela
# antes do setup (a variavel de usuario continua intacta).
Remove-Item Env:AI_MEMORY_AUTH_TOKEN -ErrorAction SilentlyContinue

$ArgsSetup = @('setup', '--yes')
foreach ($Agente in $Agentes) { $ArgsSetup += @('--agent', $Agente) }
& $Exe @ArgsSetup
if ($LASTEXITCODE -ne 0) {
    throw "ai-memory setup terminou com erro (codigo $LASTEXITCODE). Veja as linhas 'problem:' acima e rode este script de novo depois de corrigir."
}

# ---------------------------------------------------------------------------
# 3. Codex: o MCP do Codex le o token da variavel AI_MEMORY_AUTH_TOKEN
#    (bearer_token_env_var). Sem ela, o Codex nao consegue consultar a memoria.
# ---------------------------------------------------------------------------
if ($Agentes -contains 'codex') {
    Passo 'Disponibilizando o token para o Codex'
    if (-not (Test-Path $ArquivoToken)) {
        throw "Token nao encontrado em $ArquivoToken."
    }
    $Token = (Get-Content -Raw $ArquivoToken).Trim()
    Definir-VariavelUsuario 'AI_MEMORY_AUTH_TOKEN' $Token
    Remove-Variable Token
    Write-Host 'Variavel de usuario AI_MEMORY_AUTH_TOKEN definida (o valor nao e exibido).'
}

# ---------------------------------------------------------------------------
# 4. Verificacao
# ---------------------------------------------------------------------------
Passo 'Verificando: ai-memory status'
& $Exe status

Passo 'Verificando: ai-memory profile status'
& $Exe profile status

Write-Host ''
Write-Host 'Pronto.' -ForegroundColor Green
Write-Host '  1. Feche TODAS as janelas do Claude Code, do Codex e do terminal e abra de novo'
Write-Host '     (elas precisam recarregar o MCP, os hooks e as variaveis de ambiente).'
Write-Host '  2. Se o Codex pedir para confiar nos hooks do ai-memory, aceite.'
Write-Host '  3. Dentro de um projeto, pergunte ao agente: "O que voce lembra deste projeto?"'
