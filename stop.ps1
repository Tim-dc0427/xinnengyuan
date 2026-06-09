$ErrorActionPreference = 'Stop'
$killed = 0

Write-Host "Stopping Grid Platform..."

# Port 3000 (backend)
$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $procId = $c.OwningProcess
    Write-Host "  [STOP] Port 3000 - PID: $procId"
    try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        $killed++
    } catch {
        Write-Host "  [FAIL] $_"
    }
}

# Port 5173 (frontend)
$conns = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $procId = $c.OwningProcess
    Write-Host "  [STOP] Port 5173 - PID: $procId"
    try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        $killed++
    } catch {
        Write-Host "  [FAIL] $_"
    }
}

# GridPlatform cmd windows
Get-Process | Where-Object { $_.MainWindowTitle -eq "GridPlatform" } | ForEach-Object {
    Write-Host "  [STOP] GridPlatform window - PID: $($_.Id)"
    try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch {}
}

if ($killed -gt 0) {
    Write-Host "[DONE] Stopped $killed service(s)."
} else {
    Write-Host "[INFO] No running services detected."
}
