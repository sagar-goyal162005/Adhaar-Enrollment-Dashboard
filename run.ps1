$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root '.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
  Write-Host "Missing Python venv at $python" -ForegroundColor Red
  Write-Host "Create it first: python -m venv .venv" -ForegroundColor Yellow
  exit 1
}

try { node -v | Out-Null } catch {
  Write-Host "Node.js is not available on PATH. Install Node.js LTS." -ForegroundColor Red
  exit 1
}

try { npm -v | Out-Null } catch {
  Write-Host "npm is not available on PATH. Install Node.js (includes npm)." -ForegroundColor Red
  exit 1
}

Write-Host "Starting backend (FastAPI) on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process -WorkingDirectory $root -FilePath $python -ArgumentList @(
  '-m','uvicorn','backend.main:app',
  '--reload','--host','127.0.0.1','--port','8000'
) | Out-Null

Write-Host "Starting frontend (Vite) on http://127.0.0.1:5173 ..." -ForegroundColor Cyan
Start-Process -WorkingDirectory (Join-Path $root 'uidai-dashboard') -FilePath 'npm' -ArgumentList @(
  'run','dev','--','--host','127.0.0.1','--port','5173'
) | Out-Null

Write-Host "" 
Write-Host "Open: http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "Backend health: http://127.0.0.1:8000" -ForegroundColor Green
