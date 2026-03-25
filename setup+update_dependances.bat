@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

rem Require elevation for a consistent environment on Windows.
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo Requesting administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0' -Verb RunAs"
    if not "%errorlevel%"=="0" (
        echo Error: Administrator privileges are required to continue.
        pause
        exit /b 1
    )
    exit /b
)

echo ============================================
echo   SkeduleIt - Setup Dependencies
echo ============================================
echo.

call :require_command npm "Node.js and npm"
if errorlevel 1 goto :fail

echo [1/6] Installing frontend dependencies...
call npm install
if errorlevel 1 (
    echo Error: Frontend npm install failed.
    goto :fail
)
echo Frontend dependencies installed successfully.
echo.

echo [2/6] Applying npm audit fixes when available...
call npm audit fix
if errorlevel 1 (
    echo Warning: npm audit fix did not complete successfully.
    echo Continuing because audit fixes are not required for setup.
)
echo.

echo [3/6] Preparing backend virtual environment...
if not exist "backend" (
    echo Error: Backend folder was not found.
    goto :fail
)

pushd "backend" >nul

if not exist "requirements.txt" (
    echo Error: backend\requirements.txt was not found.
    popd >nul
    goto :fail
)

if not exist "venv\Scripts\python.exe" (
    call :find_python_for_venv
    if errorlevel 1 (
        popd >nul
        goto :fail
    )

    echo Creating virtual environment...
    call !PYTHON_BOOTSTRAP! -m venv venv
    if errorlevel 1 (
        echo Error: Failed to create the Python virtual environment.
        popd >nul
        goto :fail
    )
)

if not exist "venv\Scripts\python.exe" (
    echo Error: Virtual environment was not created correctly.
    popd >nul
    goto :fail
)
echo Backend virtual environment is ready.
echo.

echo [4/6] Installing backend dependencies...
call "venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo Warning: pip upgrade did not complete successfully.
)

call "venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo Error: Backend dependency installation failed.
    popd >nul
    goto :fail
)
echo Backend dependencies installed successfully.
echo.

echo [5/6] Checking environment file...
popd >nul
if not exist ".env" (
    echo Warning: .env file was not found in the project root.
    echo Create one with values similar to:
    echo   EXPO_PUBLIC_API_URL=http://localhost:8000
    echo   FIREBASE_CREDENTIALS=your-firebase-credentials-json-string
    echo   SECRET_KEY=your-secret-key
    echo   ALGORITHM=HS256
    echo   ACCESS_TOKEN_EXPIRE_MINUTES=30
) else (
    echo .env file exists.
)
echo.

echo [6/6] Testing Firebase connection when available...
pushd "backend" >nul
if exist "test_firebase_connection.py" (
    call "venv\Scripts\python.exe" test_firebase_connection.py
    if errorlevel 1 (
        echo.
        echo Warning: Firebase connection test failed.
        echo Check the FIREBASE_CREDENTIALS value in your .env file.
    ) else (
        echo Firebase connection test passed.
    )
) else (
    echo Skipping Firebase test because test_firebase_connection.py was not found.
)
popd >nul
echo.

echo ============================================
echo   Setup completed successfully
echo ============================================
echo.
echo You can now run "start server.bat" to start the application.
echo.
echo Test accounts:
echo   Customer: testc@test.com / 123
echo   Provider: testp@test.com / 123
echo.
pause
exit /b 0

:require_command
where %~1 >nul 2>&1
if errorlevel 1 (
    echo Error: %~2 was not found in PATH.
    exit /b 1
)
exit /b 0

:find_python_for_venv
set "PYTHON_BOOTSTRAP="

py -3.11 -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_BOOTSTRAP=py -3.11"
    exit /b 0
)

py -3 -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_BOOTSTRAP=py -3"
    exit /b 0
)

py -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_BOOTSTRAP=py"
    exit /b 0
)

python -c "import sys" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_BOOTSTRAP=python"
    exit /b 0
)

echo Error: Python was not found.
echo Install Python 3, preferably 3.11 or newer, and ensure the launcher or python.exe is available.
exit /b 1

:fail
echo.
echo Setup did not complete successfully.
pause
exit /b 1
