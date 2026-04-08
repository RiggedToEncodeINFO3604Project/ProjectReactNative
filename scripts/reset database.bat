@echo off
cd /d "%~dp0\.."

echo ============================================
echo   Reset Firebase Firestore Database
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
echo Deleting all documents from collections...
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

python reset_database.py

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   Database Reset Complete!
    echo ============================================
    echo.
    echo The database has been cleared.
    echo.
    set /p create="Would you like to recreate full test data? (Y/n): "
    
    if /i not "%create%"=="n" (
        echo.
        echo Recreating test users...
        python create_test_users.py
        if errorlevel 1 (
            echo.
            echo Test user recreation failed.
            echo.
            pause
            exit /b 1
        )
        echo.
        echo Recreating test collections...
        python create_test_bookings.py
        if errorlevel 1 (
            echo.
            echo Test data recreation failed.
            echo.
            pause
            exit /b 1
        )
        echo.
    )
) else (
    echo.
    echo ============================================
    echo   Database Reset Failed!
    echo ============================================
    echo.
    echo Could not connect to Firebase.
    echo Please check FIREBASE_CREDENTIALS in your .env file.
)

echo.
pause
