@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Create Desktop Shortcuts
echo   Project: %CD%
echo ============================================
echo.

del "%USERPROFILE%\Desktop\新能源启动.lnk" 2>nul
del "%USERPROFILE%\Desktop\新能源停止.lnk" 2>nul

REM Use %CD% which has correct native Windows path
REM Avoid inline Chinese in PowerShell - use Join-Path
echo Creating shortcuts...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop');$p=(Get-Location).Path;$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut([System.IO.Path]::Combine($d,'新能源启动.lnk'));$s.TargetPath=[System.IO.Path]::Combine($p,'start.bat');$s.WorkingDirectory=$p;$s.IconLocation=\"$env:SystemRoot\\System32\\imageres.dll,108\";$s.Save();$t=$w.CreateShortcut([System.IO.Path]::Combine($d,'新能源停止.lnk'));$t.TargetPath=[System.IO.Path]::Combine($p,'stop.bat');$t.WorkingDirectory=$p;$t.IconLocation=\"$env:SystemRoot\\System32\\imageres.dll,95\";$t.Save();Write-Host 'Done'"

echo.
echo Desktop shortcuts created.
echo   新能源启动.lnk - Launch platform
echo   新能源停止.lnk - Stop platform
echo.
pause
