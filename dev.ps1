# dev.ps1 — Reliable dev launcher for Electron + Vite on Windows
# Uses a PowerShell background job for Vite (finds node/npx correctly from PATH)
# then launches Electron directly via its binary.

$AppDir      = $PSScriptRoot
$ElectronExe = Join-Path $AppDir "node_modules\electron\dist\electron.exe"
$env:VITE_DEV_SERVER_URL = "http://localhost:5173"

# ─── Kill any leftover process on port 5173 from a previous session ──────────
$stale = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($stale) {
  $stale | ForEach-Object {
    Write-Host "  [cleanup] Killing leftover process on port 5173 (PID $($_.OwningProcess))" -ForegroundColor DarkYellow
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 600
}

# ─── Start Vite via a background job (inherits PATH so npx/node is found) ────
Write-Host "Starting Vite dev server..." -ForegroundColor Cyan
$viteJob = Start-Job -ScriptBlock {
  Set-Location $using:AppDir
  $env:VITE_DEV_SERVER_URL = "http://localhost:5173"
  & npx vite
}

# ─── Wait for Vite TCP port to open ─────────────────────────────────────────
Write-Host "Waiting for Vite to be ready on port 5173..." -ForegroundColor Yellow
$ready    = $false
$attempts = 0
while (-not $ready -and $attempts -lt 80) {
  Start-Sleep -Milliseconds 500
  $attempts++
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 5173)
    $tcp.Close()
    $ready = $true
  } catch {}
}

if (-not $ready) {
  Write-Host "ERROR: Vite did not start within 40 seconds." -ForegroundColor Red
  Stop-Job  $viteJob -ErrorAction SilentlyContinue
  Remove-Job $viteJob -ErrorAction SilentlyContinue
  exit 1
}

Write-Host "Vite is ready! Launching Electron..." -ForegroundColor Green
Start-Sleep -Milliseconds 600

# ─── Launch Electron (blocks until the window is closed) ────────────────────
# Using Start-Process -Wait is required for GUI apps in PowerShell,
# otherwise PowerShell continues immediately and kills Vite!
$electronProc = Start-Process -FilePath $ElectronExe -ArgumentList "`"$AppDir`"" -PassThru -Wait

# ─── Cleanup when Electron exits ─────────────────────────────────────────────
Write-Host "Electron closed. Stopping Vite..." -ForegroundColor Cyan
Stop-Job   $viteJob -ErrorAction SilentlyContinue
Remove-Job $viteJob -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Green
