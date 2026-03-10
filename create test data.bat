@echo off
cd /d "%~dp0"

echo ============================================
echo   Creating Test Data
echo ============================================
echo.

cd backend

if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
) else (
    echo Error: Virtual environment not found.
    echo Run 'first setup.bat' first.
    pause
    exit /b 1
)

echo.
echo Creating test accounts...
echo.
python create_test_users.py

echo Creating test snapshot data...
echo.
python create_test_bookings.py

echo.
pause
