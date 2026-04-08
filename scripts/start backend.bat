@echo off
cd /d "%~dp0\.."

echo ============================================
echo   Starting Backend Server
echo ============================================
echo.

cd apps\api

if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
    echo Virtual environment activated.
) else (
    echo Warning: Virtual environment not found.
    echo Run 'scripts\setup+update_dependances.bat' first.
    pause
    exit /b 1
)

echo.
echo Starting FastAPI server on http://localhost:8000
echo Make sure your .env includes FIREBASE_CREDENTIALS and the Firebase web config values.
echo.
python main.py
