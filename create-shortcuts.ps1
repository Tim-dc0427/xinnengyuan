$desktop = [Environment]::GetFolderPath("Desktop")
$proj = "e:/xinnengyuan"
$ws = New-Object -ComObject WScript.Shell

# Delete old shortcuts
$old1 = Join-Path $desktop "新能源启动.lnk"
$old2 = Join-Path $desktop "新能源停止.lnk"
if (Test-Path $old1) { Remove-Item $old1 -Force }
if (Test-Path $old2) { Remove-Item $old2 -Force }

# Start shortcut
$s = $ws.CreateShortcut((Join-Path $desktop "新能源启动.lnk"))
$s.TargetPath = (Join-Path $proj "start.bat")
$s.WorkingDirectory = $proj
$s.IconLocation = "$env:SystemRoot/System32/imageres.dll,108"
$s.Save()

# Stop shortcut
$t = $ws.CreateShortcut((Join-Path $desktop "新能源停止.lnk"))
$t.TargetPath = (Join-Path $proj "stop.bat")
$t.WorkingDirectory = $proj
$t.IconLocation = "$env:SystemRoot/System32/imageres.dll,95"
$t.Save()

Write-Host "Shortcuts created on Desktop"
