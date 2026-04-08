@echo off
cd /d "%~dp0\.."

echo ============================================
echo   Creating Test Users
echo ============================================
echo.

cd apps\api

if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
) else (
    echo Error: Virtual environment not found.
    echo Run 'scripts\setup+update_dependances.bat' first.
    pause
    exit /b 1
)

echo.
echo Creating test accounts...
echo.
python create_test_users.py
if errorlevel 1 (
    echo.
    echo Test user creation failed.
    echo.
    pause
    exit /b 1
)

echo.
pause
