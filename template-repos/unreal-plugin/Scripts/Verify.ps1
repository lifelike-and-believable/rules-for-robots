# Builds the plugin with RunUAT BuildPlugin for one engine version, fails on compiler
# warnings (FAB-004), runs its automation tests in a content-only host project, and gates on
# index.json rather than the editor's exit code (UE-007). Used by CI and by agents locally.
#
#   ./Scripts/Verify.ps1 -EngineVersion 5.6 -PluginDir Plugins/MyPlugin -PluginName MyPlugin -TestFilter MyPlugin
param(
  [Parameter(Mandatory = $true)][string]$EngineVersion,
  [string]$EngineRoot = '',
  [Parameter(Mandatory = $true)][string]$PluginDir,
  [Parameter(Mandatory = $true)][string]$PluginName,
  [Parameter(Mandatory = $true)][string]$TestFilter,
  [string]$ReportReader = '',
  [string]$WorkDir = (Join-Path $env:TEMP "verify-$EngineVersion")
)
$ErrorActionPreference = 'Stop'

if (-not $EngineRoot) { $EngineRoot = "C:\Program Files\Epic Games\UE_$EngineVersion" }
$runUat = Join-Path $EngineRoot 'Engine\Build\BatchFiles\RunUAT.bat'
if (-not (Test-Path $runUat)) { throw "Unreal Engine $EngineVersion not found at $EngineRoot" }

if (Test-Path $WorkDir) { Remove-Item -Recurse -Force $WorkDir }
New-Item -ItemType Directory -Path "$WorkDir\src" | Out-Null
Copy-Item -Recurse $PluginDir "$WorkDir\src\$PluginName"
$descriptor = "$WorkDir\src\$PluginName\$PluginName.uplugin"
(Get-Content $descriptor -Raw) -replace '"EngineVersion"\s*:\s*"[^"]*"', ('"EngineVersion": "' + $EngineVersion + '.0"') | Set-Content $descriptor -Encoding utf8

$log = "$WorkDir\buildplugin.log"
& $runUat BuildPlugin "-Plugin=$descriptor" "-Package=$WorkDir\pkg\$PluginName" -Rocket 2>&1 | Tee-Object -FilePath $log
if ($LASTEXITCODE -ne 0) { throw "BuildPlugin failed with exit code $LASTEXITCODE" }
# Count only warnings in the plugin's own source (FAB-004). Engine headers emit deprecation
# warnings (C4996) that the plugin cannot fix.
$pluginSrc = [regex]::Escape("\$PluginName\Source\")
$all = Select-String -Path $log -Pattern ': warning [A-Z]+\d+|warning CS\d+'
$warnings = $all | Where-Object { $_.Line -match $pluginSrc }
Write-Host "Compiler warnings: $($all.Count) total, $($warnings.Count) in plugin source"
if ($warnings) { $warnings | ForEach-Object { Write-Host $_.Line }; throw "$($warnings.Count) compiler warning(s); Fab requires none (FAB-004)" }

$hostDir = "$WorkDir\host"
New-Item -ItemType Directory -Path "$hostDir\Plugins" -Force | Out-Null
Copy-Item -Recurse "$WorkDir\pkg\$PluginName" "$hostDir\Plugins\$PluginName"
"{ `"FileVersion`": 3, `"EngineAssociation`": `"`", `"Plugins`": [ { `"Name`": `"$PluginName`", `"Enabled`": true } ] }" | Set-Content "$hostDir\Host.uproject" -Encoding utf8

$report = "$WorkDir\report"
& (Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe') "$hostDir\Host.uproject" "-ExecCmds=Automation RunTests $TestFilter;Quit" -unattended -nullrhi -nosound -nopause "-ReportExportPath=$report" "-abslog=$WorkDir\editor.log" | Out-Null
Select-String -Path "$WorkDir\editor.log" -Pattern 'TEST COMPLETE' | ForEach-Object { Write-Host $_.Line }

if ($ReportReader) {
  node $ReportReader $report
  if ($LASTEXITCODE -ne 0) { throw 'Automation tests failed, were skipped, or none ran' }
} else {
  $index = Get-Content "$report\index.json" -Raw | ConvertFrom-Json
  Write-Host "succeeded=$($index.succeeded) failed=$($index.failed) notRun=$($index.notRun)"
  if ($index.failed -gt 0 -or $index.notRun -gt 0 -or ($index.succeeded + $index.succeededWithWarnings) -eq 0) { throw 'Automation tests failed, were skipped, or none ran' }
}
Write-Host "UE $EngineVersion OK"
