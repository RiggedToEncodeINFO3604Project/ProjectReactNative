@echo off
cd /d "%~dp0"

echo ============================================
echo   Reset MongoDB Database
echo ============================================
echo.

echo WARNING: This will delete ALL data in the database!
echo.
set /p confirm="Are you sure you want to continue? (y/N): "

if /i not "%confirm%"=="y" (
    echo.
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
echo Dropping database...
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

python reset_database.py

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   Database Reset Complete!
    echo ============================================
    echo.
    echo The database has been cleared.
    echo.
    set /p create="Would you like to recreate test users? (Y/n): "
    
    if /i not "%create%"=="n" (
        echo.
        echo Creating test users...
        python create_test_users.py
        echo.
        echo Test users created:
        echo   Customer: testc@test.com / 123
        echo   Provider: testp@test.com / 123
    )
) else (
    echo.
    echo Error: Failed to reset database.
    echo Make sure MongoDB is running.
)

echo.
pause
