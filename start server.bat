@echo off
cd /d "%~dp0"

echo ============================================
echo   Starting SkeduleIt Servers
echo ============================================
echo.

echo [1/2] Starting Backend Server...
cd backend
if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
)
start "Backend Server" cmd /k python main.py
cd ..
echo Backend server started!
echo.

echo [2/2] Starting Frontend Server...
npx expo start
