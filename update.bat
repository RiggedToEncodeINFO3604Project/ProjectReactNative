@echo off
cd /d "%~dp0"

echo ============================================
echo   SkeduleIt - Update Dependencies
echo ============================================
echo.

echo [1/2] Updating frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Frontend npm install failed!
    pause
    exit /b 1
)
echo Frontend dependencies updated!

echo Running npm audit fix to address vulnerabilities...
call npm audit fix
echo.

echo [2/2] Updating backend dependencies...
cd backend
if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo Error: Backend pip install failed!
        cd ..
        pause
        exit /b 1
    )
    echo Backend dependencies updated!
) else (
    echo Warning: Virtual environment not found. Run 'first setup.bat' first.
)
cd ..
echo.

echo ============================================
echo   Update completed successfully!
echo ============================================
echo.
pause
