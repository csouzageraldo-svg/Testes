<#
.SYNOPSIS
    Faz backup da memoria do ai-memory (wiki, banco e config.toml) num .tar.gz.

.DESCRIPTION
    Usa `ai-memory backup`. Mantem os N backups mais recentes e apaga os mais
    antigos. O backup NAO inclui os tokens de acesso, mas inclui o
    config.toml, que pode conter chaves de API se voce configurar um LLM:
    guarde os arquivos como dado sensivel.

    Com -Agendar, registra uma tarefa semanal no Agendador de Tarefas do
    Windows que roda este mesmo script (domingo, 12:00).

.PARAMETER Destino
    Pasta onde os backups sao gravados.

.PARAMETER Manter
    Quantos backups manter.

.PARAMETER Agendar
    Registra (ou atualiza) a tarefa semanal "ai-memory backup".

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\backup-ai-memory.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\backup-ai-memory.ps1 -Agendar
#>
[CmdletBinding()]
param(
    [string] $Destino = (Join-Path $env:USERPROFILE 'ai-memory-backups'),
    [ValidateRange(1, 1000)]
    [int] $Manter = 8,
    [switch] $Agendar
)

$ErrorActionPreference = 'Stop'

$Exe = Join-Path $env:LOCALAPPDATA 'Programs\ai-memory\ai-memory.exe'
if (-not (Test-Path $Exe)) {
    throw "ai-memory nao encontrado em $Exe. Rode instalar-surface.ps1 primeiro."
}

if ($Agendar) {
    $Script = $PSCommandPath
    $Acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Script`" -Destino `"$Destino`" -Manter $Manter"
    $Quando = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '12:00'
    $Config = New-ScheduledTaskSettingsSet -StartWhenAvailable
    Register-ScheduledTask -TaskName 'ai-memory backup' -Action $Acao -Trigger $Quando -Settings $Config -Force | Out-Null
    Write-Host "Tarefa 'ai-memory backup' agendada: domingos as 12:00 (ou assim que o Surface ligar, se estiver desligado)."
}

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$Arquivo = Join-Path $Destino ('ai-memory-{0:yyyy-MM-dd_HHmm}.tar.gz' -f (Get-Date))

& $Exe backup --to $Arquivo
if ($LASTEXITCODE -ne 0) {
    throw "ai-memory backup terminou com erro (codigo $LASTEXITCODE)."
}

Get-ChildItem -Path $Destino -Filter 'ai-memory-*.tar.gz' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Manter |
    Remove-Item

Write-Host "Backup salvo em $Arquivo"
