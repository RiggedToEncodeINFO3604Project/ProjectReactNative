@echo off
cd /d "%~dp0\.."

echo ============================================
echo   Clear Messaging Data
echo ============================================
echo.

echo WARNING: This will delete ALL conversations and messages!
echo User accounts and bookings will NOT be affected.
echo.
set /p confirm="Are you sure you want to continue? (y/N): "

if /i not "%confirm%"=="y" (
    echo.
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
echo Deleting messaging data...
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

python clear_messages.py

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   Messaging Data Cleared!
    echo ============================================
    echo.
    echo All conversations and messages have been deleted.
    echo User data and bookings are preserved.
) else (
    echo.
    echo ============================================
    echo   Operation Failed!
    echo ============================================
    echo.
    echo Could not connect to Firebase.
    echo Please check FIREBASE_CREDENTIALS in your .env file.
)

echo.
pause
