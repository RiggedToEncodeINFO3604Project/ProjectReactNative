@echo off
cd /d "%~dp0"

echo ============================================
echo   Starting SkeduleIt Servers (Clear Cache)
echo ============================================
echo.

echo [1/3] Starting Backend Server...
cd backend
if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
 ) else (
    echo Warning: backend virtual environment not found.
    echo Run 'setup+update_dependances.bat' first.
    pause
    exit /b 1
)
start "Backend Server" cmd /k python main.py
cd ..
echo Backend server started!
echo.

echo [2/3] Starting RAG Server...
cd RAG-Server
if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
) else (
    echo Warning: RAG virtual environment not found.
    echo Run 'setup+update_dependances.bat' first.
    pause
    exit /b 1
)
start "RAG Server" cmd /k python main.py
cd ..
echo RAG server started!
echo.

echo [3/3] Starting Frontend Server (with cache clear)...
if not exist "node_modules\expo\bin\cli" (
    echo Error: Frontend dependencies are missing.
    echo Run 'setup+update_dependances.bat' first.
    pause
    exit /b 1
)
if not exist "node_modules\@expo\cli" (
    echo Error: Expo CLI dependency is missing from node_modules.
    echo Run 'npm install' or 'setup+update_dependances.bat' to repair the frontend install.
    pause
    exit /b 1
)
npx expo start --clear
