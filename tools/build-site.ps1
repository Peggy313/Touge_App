# TOUGE App — prepara la cartella "site" da caricare su GitHub Pages.
# Uso: powershell -ExecutionPolicy Bypass -File tools\build-site.ps1
# Poi trascina TUTTO il contenuto di "site" nel repository GitHub (Add file → Upload files).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$out = Join-Path $root 'site'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null

foreach ($item in 'index.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons') {
  Copy-Item (Join-Path $root $item) -Destination $out -Recurse -Force
}
# dati: solo i tracciati (la mappa vettoriale europe.json serve solo alla versione Artifact)
New-Item -ItemType Directory -Force (Join-Path $out 'data') | Out-Null
Copy-Item (Join-Path $root 'data\routes.json') -Destination (Join-Path $out 'data') -Force
Remove-Item (Join-Path $out 'css\leaflet.css') -ErrorAction SilentlyContinue
# GitHub Pages: servi i file così come sono (niente Jekyll)
New-Item -ItemType File -Force (Join-Path $out '.nojekyll') | Out-Null

$files = Get-ChildItem $out -Recurse -File -Force
Write-Host ("Cartella pronta: {0}  ({1} file, {2:N0} KB)" -f $out, $files.Count, (($files | Measure-Object Length -Sum).Sum / 1KB))
