@echo off
cd /d "%~dp0\.."

echo ============================================
echo   Starting RAG Server
echo ============================================
echo.

cd apps\rag-server

if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
    echo Virtual environment activated.
) else (
    echo Warning: RAG virtual environment not found.
    echo Run 'scripts\setup+update_dependances.bat' first.
    pause
    exit /b 1
)

echo.
echo Starting RAG FastAPI server on http://localhost:8001
echo.
python main.py
