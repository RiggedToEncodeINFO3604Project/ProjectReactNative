@echo off
setlocal

cd /d "%~dp0\.."

echo ============================================
echo   Building Android APK with EAS
echo ============================================
echo.

if not exist "apps\frontend\eas.json" (
    echo Error: apps\frontend\eas.json was not found.
    echo.
    pause
    exit /b 1
)

if not exist "apps\frontend\app.config.ts" (
    echo Error: apps\frontend\app.config.ts was not found.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\expo\bin\cli" (
    echo Error: Frontend dependencies are missing.
    echo Run 'scripts\setup+update_dependances.bat' or 'npm install' first.
    echo.
    pause
    exit /b 1
)

echo Using EAS profile: preview
echo Output type: APK
echo Working directory: apps\frontend
echo.
echo Note:
echo - You must be logged in to Expo/EAS.
echo - The project must already be initialized with EAS.
echo - EXPO_PUBLIC_EAS_PROJECT_ID must be configured for this app.
echo.

cd apps\frontend
call npx eas-cli build --platform android --profile preview %*

set EXIT_CODE=%ERRORLEVEL%
echo.

if not "%EXIT_CODE%"=="0" (
    echo Android APK build failed with exit code %EXIT_CODE%.
    pause
    exit /b %EXIT_CODE%
)

echo Android APK build started successfully.
pause
exit /b 0
