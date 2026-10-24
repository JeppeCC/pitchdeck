param(
  [int]$Port = 8080,
  [switch]$NoBrowser
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.yaml' = 'text/yaml; charset=utf-8'
  '.yml'  = 'text/yaml; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not listen on $prefix. Is something else using port $Port?" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host ""
Write-Host "  Serving $root" -ForegroundColor DarkGray
Write-Host "  Open    $prefix" -ForegroundColor Green
Write-Host "  Stop    Ctrl+C or close this window" -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser) { Start-Process $prefix }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/') -replace '/', '\'
    if ($rel -match '\.\.') { throw 'bad path' }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Container) {
      if (-not $req.Url.AbsolutePath.EndsWith('/')) {
        $res.StatusCode = 301
        $res.RedirectLocation = $req.Url.AbsolutePath + '/'
        $res.Close()
        continue
      }
      $path = Join-Path $path 'index.html'
    }
    if (Test-Path $path -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($path)
      $res.ContentType = $type
      $res.Headers['Cache-Control'] = 'no-store'
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("  200  " + $req.Url.AbsolutePath) -ForegroundColor DarkGray
    } else {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("Not found: " + $req.Url.AbsolutePath)
      $res.ContentType = 'text/plain; charset=utf-8'
      $res.OutputStream.Write($msg, 0, $msg.Length)
      Write-Host ("  404  " + $req.Url.AbsolutePath) -ForegroundColor Yellow
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
    Write-Host ("  500  " + $_.Exception.Message) -ForegroundColor Red
  } finally {
    try { $res.Close() } catch {}
  }
}
