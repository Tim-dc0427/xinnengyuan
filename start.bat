@echo off
cd /d "%~dp0"

if not exist "node_modules" (
    echo [ERROR] node_modules not found. Run: npm install
    pause
    exit /b 1
)

echo ============================================
echo   New Energy Grid Analysis Platform
echo ============================================

rem /D sets working directory, avoids nested quote in cmd /c
start "GridPlatform" /D "%CD%" cmd /c "npm run dev"

echo Waiting for Vite (10s)...
timeout /t 10 /nobreak
start http://localhost:5173

rem Minimize this launcher window
powershell -Command "$c=Add-Type -Name W -Namespace T -Member '[DllImport(\"kernel32.dll\")]public static extern IntPtr GetConsoleWindow();[DllImport(\"user32.dll\")]public static extern bool ShowWindow(IntPtr h, int n);' -PassThru;[T.W]::ShowWindow([T.W]::GetConsoleWindow(),6)"
