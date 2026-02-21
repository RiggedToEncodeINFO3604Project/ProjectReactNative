@echo off
cd /d "%~dp0"

echo ============================================
echo   Starting Backend Server
echo ============================================
echo.

cd backend

if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
    echo Virtual environment activated.
) else (
    echo Warning: Virtual environment not found.
    echo Run 'first setup.bat' first.
    pause
    exit /b 1
)

echo.
echo Starting FastAPI server on http://localhost:8000
echo.
python main.py
