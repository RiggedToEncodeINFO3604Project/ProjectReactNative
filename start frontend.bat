@echo off
cd /d "%~dp0"

echo ============================================
echo   Starting Frontend Server
echo ============================================
echo.

if not exist "node_modules\expo\bin\cli" (
    echo Error: Frontend dependencies are missing.
    echo Run 'setup+update_dependances.bat' first.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\@expo\cli" (
    echo Error: Expo CLI dependency is missing from node_modules.
    echo Run 'npm install' or 'setup+update_dependances.bat' to repair the frontend install.
    echo.
    pause
    exit /b 1
)

echo Starting Expo development server...
echo.
npx expo start --clear
