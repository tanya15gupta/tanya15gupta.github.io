# Minimal static file server for testing this site locally.
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8080  (Ctrl+C in this window to stop)

param(
    [string]$Root = $PSScriptRoot,
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.map'  = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.eot'  = 'application/vnd.ms-fontobject'
    '.txt'  = 'text/plain; charset=utf-8'
}

$rootFull = (Resolve-Path $Root).Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
} catch {
    Write-Output "Could not listen on port $Port : $($_.Exception.Message)"
    Write-Output "Another program may be using it. Try a different port, e.g.:  .\serve.ps1 -Port 8090"
    exit 1
}

Write-Output "Serving $rootFull"
Write-Output "Open http://localhost:$Port/   (press Ctrl+C in this window to stop)"

if (-not $NoBrowser) {
    Start-Process "http://localhost:$Port/"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response

    try {
        $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
        $rel = $rel -replace '/', '\'
        $path = Join-Path $rootFull $rel

        if ((Test-Path $path) -and (Get-Item $path).PSIsContainer) {
            $path = Join-Path $path 'index.html'
        }

        $full = $null
        if (Test-Path $path) { $full = (Resolve-Path $path).Path }

        if ($full -and $full.StartsWith($rootFull)) {
            $ext = [System.IO.Path]::GetExtension($full).ToLower()
            $type = $mime[$ext]
            if (-not $type) { $type = 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($full)
            $res.ContentType = $type
            $res.ContentLength64 = $bytes.Length
            $res.StatusCode = 200
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Output "200 $($req.Url.AbsolutePath)"
        } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $res.StatusCode = 404
            $res.ContentType = 'text/plain; charset=utf-8'
            $res.ContentLength64 = $body.Length
            $res.OutputStream.Write($body, 0, $body.Length)
            Write-Output "404 $($req.Url.AbsolutePath)"
        }
    } catch {
        Write-Output "500 $($req.Url.AbsolutePath) - $($_.Exception.Message)"
        try { $res.StatusCode = 500 } catch {}
    } finally {
        try { $res.OutputStream.Close() } catch {}
    }
}
