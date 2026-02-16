@echo off
cd /d "%~dp0"

echo ============================================
echo   SkeduleIt - First Time Setup
echo ============================================
echo.

echo [1/4] Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Frontend npm install failed!
    pause
    exit /b 1
)
echo Frontend dependencies installed successfully!
echo.

echo [2/4] Setting up backend...
cd backend

echo Checking for Python virtual environment...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo Error: Failed to create virtual environment!
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

echo [3/4] Checking environment files...
cd ..
if not exist ".env" (
    echo Warning: .env file not found in root directory
    echo Please create .env with the following variables:
    echo   EXPO_PUBLIC_API_URL=http://localhost:8000
    echo   MONGODB_URL=mongodb://localhost:27017
    echo   DATABASE_NAME=scheduling_db
    echo   SECRET_KEY=your-secret-key
    echo   ALGORITHM=HS256
    echo   ACCESS_TOKEN_EXPIRE_MINUTES=30
) else (
    echo .env file exists
)
echo.

echo [4/4] Setup complete!
echo.
echo ============================================
echo   Setup completed successfully!
echo ============================================
echo.
echo You can now run 'start server.bat' to start the application.
echo.
pause
