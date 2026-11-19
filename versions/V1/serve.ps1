# TOUGE App — mini server statico locale (nessuna installazione richiesta)
# Uso:  powershell -ExecutionPolicy Bypass -File serve.ps1   →  http://localhost:5173
param([int]$Port = 5173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "TOUGE App in esecuzione su http://localhost:$Port  (Ctrl+C per fermare)"

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    $res = $ctx.Response
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.SendChunked = $true
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.Close()
    } catch {
      Write-Host "Errore richiesta: $_"
      try { $ctx.Response.Abort() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
