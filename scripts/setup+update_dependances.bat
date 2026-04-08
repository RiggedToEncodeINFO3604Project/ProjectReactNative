@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0\.."

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

echo [1/8] Installing and validating frontend dependencies...
call npm install
if errorlevel 1 (
    echo Error: Frontend npm install failed.
    goto :fail
)
call :verify_frontend_install
if errorlevel 1 (
    echo Warning: Frontend dependency validation failed after npm install.
    echo Running a clean frontend reinstall...
    call :clean_reinstall_frontend
    if errorlevel 1 (
        echo Error: Frontend clean reinstall failed.
        goto :fail
    )
)
echo Frontend dependencies installed successfully.
echo.

echo [2/8] Applying npm audit fixes when available...
call npm audit fix
if errorlevel 1 (
    echo Warning: npm audit fix did not complete successfully.
    echo Continuing because audit fixes are not required for setup.
)
echo.

echo [3/8] Preparing backend virtual environment...
if not exist "apps\api" (
    echo Error: Backend folder was not found.
    goto :fail
)

pushd "apps\api" >nul

if not exist "requirements.txt" (
    echo Error: apps\api\requirements.txt was not found.
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

echo [4/8] Installing backend dependencies...
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

echo [5/8] Preparing RAG virtual environment...
popd >nul

if not exist "apps\rag-server" (
    echo Error: apps\rag-server folder was not found.
    goto :fail
)

pushd "apps\rag-server" >nul

if not exist "requirements.txt" (
    echo Error: apps\rag-server\requirements.txt was not found.
    popd >nul
    goto :fail
)

if not exist "venv\Scripts\python.exe" (
    call :find_python_for_venv
    if errorlevel 1 (
        popd >nul
        goto :fail
    )

    echo Creating RAG virtual environment...
    call !PYTHON_BOOTSTRAP! -m venv venv
    if errorlevel 1 (
        echo Error: Failed to create the RAG virtual environment.
        popd >nul
        goto :fail
    )
)

if not exist "venv\Scripts\python.exe" (
    echo Error: RAG virtual environment was not created correctly.
    popd >nul
    goto :fail
)
echo RAG virtual environment is ready.
echo.

echo [6/8] Installing RAG dependencies...
call "venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo Warning: RAG pip upgrade did not complete successfully.
)

call "venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo Error: RAG dependency installation failed.
    popd >nul
    goto :fail
)
echo RAG dependencies installed successfully.
echo.

echo [7/8] Checking environment file...
popd >nul
if not exist ".env" (
    echo Warning: .env file was not found in the project root.
    echo Create one with values similar to:
    echo   EXPO_PUBLIC_API_URL=http://localhost:8000
    echo   EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
    echo   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
    echo   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
    echo   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
    echo   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-firebase-sender-id
    echo   EXPO_PUBLIC_FIREBASE_APP_ID=your-firebase-web-app-id
    echo   EXPO_PUBLIC_FIREBASE_DATABASE_URL=your-firebase-database-url
    echo   FIREBASE_CREDENTIALS=your-firebase-credentials-json-string
    echo   GEMINI_API_KEY=your-gemini-api-key
    echo.
    echo Firebase Email/Password auth must also be enabled in the Firebase console.
) else (
    echo .env file exists.
)
echo.

echo [8/8] Testing Firebase connection when available...
pushd "apps\api" >nul
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
echo You can now run "scripts\start server.bat" to start the application.
echo.
echo Test accounts:
echo   Customer: testc@test.com / 123456
echo   Provider: testp@test.com / 123456
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

:verify_frontend_install
if not exist "package.json" (
    echo Error: package.json was not found in the project root.
    exit /b 1
)

if not exist "apps\frontend\package.json" (
    echo Error: apps\frontend\package.json was not found.
    exit /b 1
)

if not exist "node_modules\expo\bin\cli" (
    echo Error: Expo launcher was not installed.
    exit /b 1
)

call npx expo --version >nul 2>&1
if errorlevel 1 (
    echo Error: Local Expo CLI failed to start.
    exit /b 1
)

call node scripts\validate-frontend-install.js >nul
if errorlevel 1 (
    exit /b 1
)

exit /b 0

:clean_reinstall_frontend
if exist "node_modules" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force -LiteralPath 'node_modules'"
    if errorlevel 1 (
        echo Error: Failed to remove node_modules during frontend repair.
        exit /b 1
    )
)

call npm install
if errorlevel 1 (
    echo Error: npm install failed during frontend repair.
    exit /b 1
)

call :verify_frontend_install
if errorlevel 1 (
    echo Error: Frontend dependency validation still failed after clean reinstall.
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
