# =====================================================================
#  RAG Powered Knowledge System - shut down the app's own servers.
#
#  Stops whatever is listening on 8000 (backend) and 5173 (frontend).
#  PostgreSQL and Ollama are deliberately LEFT RUNNING: they are shared
#  Windows services / background apps, not part of this project.
# =====================================================================

$ErrorActionPreference = 'SilentlyContinue'

function Stop-Port([int]$Port, [string]$Label) {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host ("  {0,-10} (port {1}) was not running" -f $Label, $Port) -ForegroundColor DarkGray
        return
    }
    foreach ($c in $conns) {
        $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($p) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            Write-Host ("  {0,-10} (port {1}) stopped - {2} pid {3}" -f $Label, $Port, $p.ProcessName, $p.Id) -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "  Stopping the RAG app servers" -ForegroundColor Cyan
Write-Host ""
Stop-Port 5173 'Frontend'
Stop-Port 8000 'Backend'
Write-Host ""
Write-Host "  PostgreSQL and Ollama were left running." -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 2
