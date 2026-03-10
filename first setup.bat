@echo off
cd /d "%~dp0"

echo ============================================
echo   SkeduleIt - First Time Setup
echo ============================================
echo.

echo [1/5] Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Frontend npm install failed!
    pause
    exit /b 1
)
echo Frontend dependencies installed successfully!
echo.

echo [2/5] Setting up backend...
cd backend

echo Checking for Python virtual environment...
if not exist "venv" (
    echo Creating virtual environment with Python 3.11...
    py -3.11 -m venv venv
    if %errorlevel% neq 0 (
        echo Error: Failed to create virtual environment!
        echo Make sure Python 3.11 is installed.
        cd ..
        pause
        exit /b 1
    )
)

echo Activating virtual environment...
call venv\Scripts\activate
if %errorlevel% neq 0 (
    echo Error: Failed to activate virtual environment!
    cd ..
    pause
    exit /b 1
)

echo Installing backend dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Error: Backend pip install failed!
    cd ..
    pause
    exit /b 1
)
echo Backend dependencies installed successfully!
echo.

echo [3/5] Checking environment files...
cd ..
if not exist ".env" (
    echo Warning: .env file not found in root directory
    echo Please create .env with the following variables:
    echo   EXPO_PUBLIC_API_URL=http://localhost:8000
    echo   FIREBASE_CREDENTIALS=your-firebase-credentials-json-string
    echo   SECRET_KEY=your-secret-key
    echo   ALGORITHM=HS256
    echo   ACCESS_TOKEN_EXPIRE_MINUTES=30
) else (
    echo .env file exists
)
echo.

echo [4/5] Testing Firebase connection...
cd backend
call venv\Scripts\activate
python test_firebase_connection.py
if %errorlevel% neq 0 (
    echo.
    echo Warning: Could not connect to Firebase.
    echo Please check your FIREBASE_CREDENTIALS in .env file.
)
cd ..
echo.

echo [5/5] Setup complete!
echo.
echo ============================================
echo   Setup completed successfully!
echo ============================================
echo.
echo You can now run 'start server.bat' to start the application.
echo.
echo Test accounts:
echo   Customer: testc@test.com / 123
echo   Provider: testp@test.com / 123
echo.
pause
