#requires -Version 5.1
<#
.SYNOPSIS
    Register a Windows Scheduled Task that runs a routine.json via routine-run.mjs.

.DESCRIPTION
    Resolves paths, asks for confirmation, then calls Register-ScheduledTask
    with a daily trigger. Runs as the current user (no SYSTEM, no elevation).
    The routine runner enforces its own per-step safety grind — this script
    only wires the schedule.

.PARAMETER RoutinePath
    Path (absolute or relative to cwd) to a routine.v1 JSON file.

.PARAMETER TaskName
    Friendly name for the scheduled task. Use a "<repo>/<routine-id>" convention.

.PARAMETER DailyAt
    Time of day in HH:mm 24-hour format. Defaults to 07:00.

.PARAMETER NodeExe
    Path to node.exe. Defaults to whatever is on PATH.

.EXAMPLE
    .\install-example.ps1 -RoutinePath ..\routines\security-audit.routine.json `
                          -TaskName "ecc-browser/security-audit" `
                          -DailyAt "07:00"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $RoutinePath,
    [Parameter(Mandatory = $true)] [string] $TaskName,
    [string] $DailyAt = "07:00",
    [string] $NodeExe = "node.exe"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..")
$runner    = Join-Path $repoRoot "routine-run.mjs"
$routine   = Resolve-Path $RoutinePath

if (-not (Test-Path $runner)) {
    throw "routine-run.mjs not found at $runner. Did you copy the cron/ folder out of the repo?"
}
if (-not (Test-Path $routine)) {
    throw "Routine not found at $RoutinePath"
}

Write-Host "About to register a scheduled task:" -ForegroundColor Cyan
Write-Host "  Name      : $TaskName"
Write-Host "  Command   : `"$NodeExe`" `"$runner`" `"$routine`" --execute"
Write-Host "  Trigger   : Daily at $DailyAt"
Write-Host "  Run as    : $env:USERDOMAIN\$env:USERNAME (NOT SYSTEM)"
Write-Host ""

$confirm = Read-Host "Proceed? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Aborted; no changes made." -ForegroundColor Yellow
    exit 1
}

$action    = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$runner`" `"$routine`" --execute"
$trigger   = New-ScheduledTaskTrigger -Daily -At $DailyAt
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "ecc-browser routine: $routine"

Write-Host "Registered. Inspect via: Get-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor Green
Write-Host "Remove via:              Unregister-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor DarkGray
