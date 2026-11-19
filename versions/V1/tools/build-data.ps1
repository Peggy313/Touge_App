# TOUGE App — prepara i dati offline per la versione pubblicata (Artifact):
#  - data/routes.json : tracciati stradali reali calcolati con OSRM per ogni strada
#  - data/europe.json : confini/coste (Natural Earth via world-atlas, TopoJSON 50m)
#  - css/leaflet.css  : foglio di stile di Leaflet (i CSS esterni sono bloccati nell'Artifact)
# Uso: powershell -ExecutionPolicy Bypass -File tools\build-data.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
New-Item -ItemType Directory -Force (Join-Path $root 'data') | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false

Invoke-WebRequest 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' -OutFile (Join-Path $root 'css\leaflet.css') -UseBasicParsing
Invoke-WebRequest 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json' -OutFile (Join-Path $root 'data\europe.json') -UseBasicParsing
Write-Host 'leaflet.css + europe.json scaricati'

$src = [IO.File]::ReadAllText((Join-Path $root 'js\data.js'))
$rx = [regex]"id: '([^']+)'[\s\S]*?(noRouting: true,[\s\S]*?)?wp: (\[\[.*?\]\]),"
$out = [ordered]@{}
foreach ($m in $rx.Matches($src)) {
  $id = $m.Groups[1].Value
  $wp = $m.Groups[3].Value | ConvertFrom-Json
  if ($m.Groups[2].Success) { $out[$id] = @($wp); Write-Host "$id : waypoint (no routing)"; continue }
  $pts = ($wp | ForEach-Object { "$($_[1]),$($_[0])" }) -join ';'
  try {
    $res = Invoke-RestMethod "https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson" -UseBasicParsing
    $coords = $res.routes[0].geometry.coordinates
    # decimazione: tieni un punto ogni ~35 m circa
    $kept = New-Object System.Collections.ArrayList
    $last = $null
    foreach ($c in $coords) {
      $lat = [math]::Round([double]$c[1], 5); $lng = [math]::Round([double]$c[0], 5)
      if ($last -eq $null -or [math]::Abs($lat - $last[0]) + [math]::Abs($lng - $last[1]) -gt 0.0004) { [void]$kept.Add(@($lat, $lng)); $last = @($lat, $lng) }
    }
    $lc = $coords[$coords.Count - 1]; [void]$kept.Add(@([math]::Round([double]$lc[1], 5), [math]::Round([double]$lc[0], 5)))
    $out[$id] = $kept
    Write-Host "$id : $($kept.Count) punti"
  } catch {
    $out[$id] = @($wp); Write-Host "$id : ERRORE routing, uso waypoint"
  }
  Start-Sleep -Milliseconds 400
}
[IO.File]::WriteAllText((Join-Path $root 'data\routes.json'), ($out | ConvertTo-Json -Depth 5 -Compress), $utf8)
Write-Host "routes.json scritto ($($out.Count) strade)"
