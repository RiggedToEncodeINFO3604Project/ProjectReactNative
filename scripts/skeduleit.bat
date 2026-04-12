@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0\.."
set "PROJECT_ROOT=%CD%"
set "SCRIPT_PATH=%~f0"

if /i "%~1"=="__run_frontend" goto :run_frontend
if /i "%~1"=="__run_frontend_clear" goto :run_frontend_clear
if /i "%~1"=="__run_scheduling" goto :run_scheduling
if /i "%~1"=="__run_messaging" goto :run_messaging
if /i "%~1"=="__run_rag" goto :run_rag
if /i "%~1"=="__run_snapshot" goto :run_snapshot
if /i "%~1"=="__setup_dependencies" goto :setup_dependencies
if /i "%~1"=="__update_dependencies" goto :update_dependencies
if /i "%~1"=="__build_apk_cloud" goto :build_apk_cloud
if /i "%~1"=="__build_apk_local" goto :build_apk_local

goto :main_menu

:main_menu
cls
echo ============================================
echo   SkeduleIt Control Center
echo ============================================
echo.
echo 1. Start Servers
echo 2. Database Management
echo 3. Setup Dependencies
echo 4. Update Dependencies
echo 5. Build APK
echo 0. Exit
echo.
set "MAIN_CHOICE="
set /p MAIN_CHOICE="Choose an option: "

if "%MAIN_CHOICE%"=="1" goto :menu_start_servers
if "%MAIN_CHOICE%"=="2" goto :menu_database
if "%MAIN_CHOICE%"=="3" goto :setup_dependencies_entry
if "%MAIN_CHOICE%"=="4" goto :update_dependencies_entry
if "%MAIN_CHOICE%"=="5" goto :menu_build_apk
if "%MAIN_CHOICE%"=="0" goto :eof

echo.
echo Invalid option.
pause
goto :main_menu

:menu_start_servers
cls
echo ============================================
echo   Start Servers
echo ============================================
echo.
echo 1. Start All Backend Servers + Frontend (with clear cache)
echo 2. Start All Backend Servers + Frontend
echo 3. Start Frontend
echo 4. Start All Backend Servers
echo 5. Start Scheduling Server
echo 6. Start Messaging Server
echo 7. Start RAG Server
echo 8. Start Snapshot Server
echo B. Back
echo.
set "SERVER_CHOICE="
set /p SERVER_CHOICE="Choose an option: "

if /i "%SERVER_CHOICE%"=="1" goto :start_all_backend_and_frontend_clear
if /i "%SERVER_CHOICE%"=="2" goto :start_all_backend_and_frontend
if /i "%SERVER_CHOICE%"=="3" goto :start_frontend_window_menu
if /i "%SERVER_CHOICE%"=="4" goto :start_all_backend_servers
if /i "%SERVER_CHOICE%"=="5" goto :start_scheduling_window
if /i "%SERVER_CHOICE%"=="6" goto :start_messaging_window
if /i "%SERVER_CHOICE%"=="7" goto :start_rag_window
if /i "%SERVER_CHOICE%"=="8" goto :start_snapshot_window
if /i "%SERVER_CHOICE%"=="B" goto :main_menu

echo.
echo Invalid option.
pause
goto :menu_start_servers

:menu_database
cls
echo ============================================
echo   Database Management
echo ============================================
echo.
echo 1. Destroy and Reconstruct Database
echo 2. Destroy Database
echo 3. Reconstruct Database
echo B. Back
echo.
set "DB_CHOICE="
set /p DB_CHOICE="Choose an option: "

if /i "%DB_CHOICE%"=="1" goto :destroy_and_reconstruct_database
if /i "%DB_CHOICE%"=="2" goto :destroy_database_only
if /i "%DB_CHOICE%"=="3" goto :reconstruct_database_only
if /i "%DB_CHOICE%"=="B" goto :main_menu

echo.
echo Invalid option.
pause
goto :menu_database

:menu_build_apk
cls
echo ============================================
echo   Build APK
echo ============================================
echo.
echo 1. Build APK with Cloud EAS
echo 2. Build APK locally
echo B. Back
echo.
set "BUILD_CHOICE="
set /p BUILD_CHOICE="Choose an option: "

if /i "%BUILD_CHOICE%"=="1" goto :build_apk_cloud
if /i "%BUILD_CHOICE%"=="2" goto :build_apk_local
if /i "%BUILD_CHOICE%"=="B" goto :main_menu

echo.
echo Invalid option.
pause
goto :menu_build_apk

:start_all_backend_and_frontend_clear
call :start_all_backend_windows
if errorlevel 1 goto :menu_start_servers
echo [5/5] Starting frontend with cache clear...
echo.
call :start_frontend_window "__run_frontend_clear" "Frontend (Clear Cache)"
pause
goto :menu_start_servers

:start_all_backend_and_frontend
call :start_all_backend_windows
if errorlevel 1 goto :menu_start_servers
echo [5/5] Starting frontend...
echo.
call :start_frontend_window "__run_frontend" "Frontend"
pause
goto :menu_start_servers

:start_all_backend_servers
call :start_all_backend_windows
pause
goto :menu_start_servers

:start_all_backend_windows
call :ensure_service_ready "apps\scheduling-service" "Core scheduling service"
if errorlevel 1 exit /b 1

call :ensure_service_ready "apps\messaging-service" "Messaging service"
if errorlevel 1 exit /b 1

call :ensure_service_ready "apps\rag-service" "RAG service"
if errorlevel 1 exit /b 1

call :ensure_service_ready "apps\snapshot-service" "Snapshot service"
if errorlevel 1 exit /b 1

echo.
echo Launching backend services in separate windows...
echo [1/4] Starting Core Scheduling Service...
start "Core Scheduling Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_scheduling"
echo [2/4] Starting Messaging Service...
start "Messaging Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_messaging"
echo [3/4] Starting RAG Service...
start "RAG Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_rag"
echo [4/4] Starting Snapshot Service...
start "Snapshot Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_snapshot"
echo Backend services launched.
exit /b 0

:start_frontend_window_menu
call :start_frontend_window "__run_frontend" "Frontend"
pause
goto :menu_start_servers

:start_frontend_window
set "FRONTEND_ARG=%~1"
set "FRONTEND_TITLE=%~2"
if not defined FRONTEND_ARG set "FRONTEND_ARG=__run_frontend"
if not defined FRONTEND_TITLE set "FRONTEND_TITLE=Frontend"

call :ensure_frontend_ready
if errorlevel 1 exit /b 1

start "%FRONTEND_TITLE%" "%ComSpec%" /k ""%SCRIPT_PATH%" %FRONTEND_ARG%"
echo %FRONTEND_TITLE% launched in a separate window.
exit /b 0

:start_scheduling_window
call :ensure_service_ready "apps\scheduling-service" "Core scheduling service"
if errorlevel 1 goto :menu_start_servers
start "Core Scheduling Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_scheduling"
echo Core Scheduling Service launched in a separate window.
pause
goto :menu_start_servers

:start_messaging_window
call :ensure_service_ready "apps\messaging-service" "Messaging service"
if errorlevel 1 goto :menu_start_servers
start "Messaging Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_messaging"
echo Messaging Service launched in a separate window.
pause
goto :menu_start_servers

:start_rag_window
call :ensure_service_ready "apps\rag-service" "RAG service"
if errorlevel 1 goto :menu_start_servers
start "RAG Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_rag"
echo RAG Service launched in a separate window.
pause
goto :menu_start_servers

:start_snapshot_window
call :ensure_service_ready "apps\snapshot-service" "Snapshot service"
if errorlevel 1 goto :menu_start_servers
start "Snapshot Service" "%ComSpec%" /k ""%SCRIPT_PATH%" __run_snapshot"
echo Snapshot Service launched in a separate window.
pause
goto :menu_start_servers

:run_frontend
call :ensure_frontend_ready
if errorlevel 1 (
    pause
    exit /b 1
)

call :set_local_frontend_env

echo.
echo Starting frontend with local service URLs:
echo   Scheduling: %EXPO_PUBLIC_SCHEDULING_URL%
echo   Messaging:  %EXPO_PUBLIC_MESSAGING_URL%
echo   RAG:        %EXPO_PUBLIC_RAG_URL%
echo   Snapshot:   %EXPO_PUBLIC_SNAPSHOT_URL%
echo.
call npm run frontend
exit /b %errorlevel%

:run_frontend_clear
call :ensure_frontend_ready
if errorlevel 1 (
    pause
    exit /b 1
)

call :set_local_frontend_env

echo.
echo Starting frontend with cache clear and local service URLs...
echo.
call npm run frontend:clear
exit /b %errorlevel%

:setup_dependencies_entry
call :ensure_admin_for_action "setup_dependencies" "__setup_dependencies" "setup dependencies"
goto :main_menu

:update_dependencies_entry
call :ensure_admin_for_action "update_dependencies" "__update_dependencies" "update dependencies"
goto :main_menu

:run_scheduling
call :run_service "apps\scheduling-service" "Core Scheduling Service" "8000"
goto :eof

:run_messaging
call :run_service "apps\messaging-service" "Messaging Service" "8002"
goto :eof

:run_rag
call :run_service "apps\rag-service" "RAG Service" "8001"
goto :eof

:run_snapshot
call :run_service "apps\snapshot-service" "Snapshot Service" "8003"
goto :eof

:run_service
set "SERVICE_PATH=%~1"
set "SERVICE_NAME=%~2"
set "SERVICE_PORT=%~3"

cd /d "%PROJECT_ROOT%\%SERVICE_PATH%"
if not exist "venv\Scripts\python.exe" (
    echo Error: %SERVICE_NAME% virtual environment was not found.
    echo Run setup first from this menu.
    pause
    exit /b 1
)

call :validate_python_executable "venv\Scripts\python.exe"
if errorlevel 1 (
    echo Error: %SERVICE_NAME% virtual environment is invalid.
    echo Run setup first from this menu to rebuild it.
    pause
    exit /b 1
)

echo ============================================
echo   %SERVICE_NAME%
echo ============================================
echo.
echo Starting on http://localhost:%SERVICE_PORT%
if "%SERVICE_PORT%"=="8002" (
    echo WebSocket endpoint: ws://localhost:8002/ws
)
echo.
set "PORT=%SERVICE_PORT%"
"venv\Scripts\python.exe" main.py
exit /b %errorlevel%

:destroy_and_reconstruct_database
call :confirm_action "This will destroy the database and rebuild the test data. Continue"
if errorlevel 1 goto :menu_database

call :run_database_tool "reset_database.py" "Destroying database"
if errorlevel 1 goto :database_operation_failed

call :run_database_tool "create_test_users.py" "Recreating test users"
if errorlevel 1 goto :database_operation_failed

call :run_database_tool "create_test_bookings.py" "Recreating test data"
if errorlevel 1 goto :database_operation_failed

echo.
echo Database destroy and reconstruct completed successfully.
pause
goto :menu_database

:destroy_database_only
call :confirm_action "This will permanently destroy all database data. Continue"
if errorlevel 1 goto :menu_database

call :run_database_tool "reset_database.py" "Destroying database"
if errorlevel 1 goto :database_operation_failed

echo.
echo Database destroyed successfully.
pause
goto :menu_database

:reconstruct_database_only
call :confirm_action "This will recreate the test data without clearing first. Continue"
if errorlevel 1 goto :menu_database

call :run_database_tool "create_test_users.py" "Creating test users"
if errorlevel 1 goto :database_operation_failed

call :run_database_tool "create_test_bookings.py" "Creating test data"
if errorlevel 1 goto :database_operation_failed

echo.
echo Database reconstruction completed successfully.
pause
goto :menu_database

:database_operation_failed
echo.
echo Database operation failed.
pause
goto :menu_database

:run_database_tool
set "TOOL_SCRIPT=%~1"
set "TOOL_LABEL=%~2"

call :resolve_api_tools_python
if errorlevel 1 exit /b 1

if not exist "%PROJECT_ROOT%\apps\api\%TOOL_SCRIPT%" (
    echo Error: apps\api\%TOOL_SCRIPT% was not found.
    exit /b 1
)

echo.
echo %TOOL_LABEL%...
pushd "%PROJECT_ROOT%\apps\api" >nul
call "%API_TOOLS_PYTHON%" "%TOOL_SCRIPT%"
set "TOOL_RESULT=%errorlevel%"
popd >nul
exit /b %TOOL_RESULT%

:setup_dependencies
cls
echo ============================================
echo   Setup Dependencies
echo ============================================
echo.

call :require_command npm "Node.js and npm"
if errorlevel 1 goto :setup_failed

echo [1/7] Installing frontend dependencies...
call npm install
if errorlevel 1 goto :setup_failed

echo [2/7] Validating frontend install...
call :verify_frontend_install
if errorlevel 1 goto :setup_failed

echo [3/7] Setting up Core Scheduling Service...
call :prepare_python_service "apps\scheduling-service" "Core scheduling service" "install"
if errorlevel 1 goto :setup_failed

echo [4/7] Setting up Messaging Service...
call :prepare_python_service "apps\messaging-service" "Messaging service" "install"
if errorlevel 1 goto :setup_failed

echo [5/7] Setting up Snapshot Service...
call :prepare_python_service "apps\snapshot-service" "Snapshot service" "install"
if errorlevel 1 goto :setup_failed

echo [6/7] Setting up RAG Service...
call :prepare_python_service "apps\rag-service" "RAG service" "install"
if errorlevel 1 goto :setup_failed

echo [7/7] Setting up Database Tools...
call :prepare_python_service "apps\api" "Database tools" "install"
if errorlevel 1 goto :setup_failed

echo.
echo Setup completed successfully.
pause
goto :main_menu

:setup_failed
echo.
echo Setup did not complete successfully.
pause
goto :main_menu

:update_dependencies
cls
echo ============================================
echo   Update Dependencies
echo ============================================
echo.

call :require_command npm "Node.js and npm"
if errorlevel 1 goto :update_failed

echo [1/8] Updating frontend dependencies...
call npm update
if errorlevel 1 goto :update_failed

echo [2/8] Applying npm audit fixes...
call npm audit fix
if errorlevel 1 (
    echo Warning: npm audit fix did not complete successfully.
)

echo [3/8] Validating frontend install...
call :verify_frontend_install
if errorlevel 1 goto :update_failed

echo [4/8] Updating Core Scheduling Service...
call :prepare_python_service "apps\scheduling-service" "Core scheduling service" "upgrade"
if errorlevel 1 goto :update_failed

echo [5/8] Updating Messaging Service...
call :prepare_python_service "apps\messaging-service" "Messaging service" "upgrade"
if errorlevel 1 goto :update_failed

echo [6/8] Updating Snapshot Service...
call :prepare_python_service "apps\snapshot-service" "Snapshot service" "upgrade"
if errorlevel 1 goto :update_failed

echo [7/8] Updating RAG Service...
call :prepare_python_service "apps\rag-service" "RAG service" "upgrade"
if errorlevel 1 goto :update_failed

echo [8/8] Updating Database Tools...
call :prepare_python_service "apps\api" "Database tools" "upgrade"
if errorlevel 1 goto :update_failed

echo.
echo Dependency update completed successfully.
pause
goto :main_menu

:update_failed
echo.
echo Dependency update did not complete successfully.
pause
goto :main_menu

:ensure_admin_for_action
net session >nul 2>&1
if "%errorlevel%"=="0" (
    goto :%~1
)

echo.
echo Administrator privileges are required to %~3.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%SCRIPT_PATH%' -ArgumentList '%~2' -WorkingDirectory '%PROJECT_ROOT%' -Verb RunAs"
if errorlevel 1 (
    echo Failed to relaunch with administrator privileges.
    pause
)
exit /b 0

:prepare_python_service
set "SERVICE_PATH=%~1"
set "SERVICE_NAME=%~2"
set "SERVICE_MODE=%~3"

if not exist "%PROJECT_ROOT%\%SERVICE_PATH%\requirements.txt" (
    echo Error: %SERVICE_PATH%\requirements.txt was not found.
    exit /b 1
)

pushd "%PROJECT_ROOT%\%SERVICE_PATH%" >nul

if exist "venv\Scripts\python.exe" (
    call :validate_python_executable "venv\Scripts\python.exe"
    if errorlevel 1 (
        echo Existing virtual environment for %SERVICE_NAME% is invalid. Rebuilding it...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force -LiteralPath 'venv'"
        if errorlevel 1 (
            echo Error: Failed to remove the invalid virtual environment for %SERVICE_NAME%.
            popd >nul
            exit /b 1
        )
    )
)

if not exist "venv\Scripts\python.exe" (
    call :find_python_for_venv
    if errorlevel 1 (
        popd >nul
        exit /b 1
    )

    echo Creating virtual environment for %SERVICE_NAME%...
    call !PYTHON_BOOTSTRAP! -m venv venv
    if errorlevel 1 (
        echo Error: Failed to create the virtual environment for %SERVICE_NAME%.
        popd >nul
        exit /b 1
    )
)

echo.
echo Preparing %SERVICE_NAME%...
call "venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo Warning: pip upgrade did not complete successfully for %SERVICE_NAME%.
)

if /i "%SERVICE_MODE%"=="upgrade" (
    call "venv\Scripts\python.exe" -m pip install --upgrade -r requirements.txt
) else (
    call "venv\Scripts\python.exe" -m pip install -r requirements.txt
)
if errorlevel 1 (
    echo Error: requirements.txt installation failed for %SERVICE_NAME%.
    popd >nul
    exit /b 1
)

if exist "requirements-test.txt" (
    if /i "%SERVICE_MODE%"=="upgrade" (
        call "venv\Scripts\python.exe" -m pip install --upgrade -r requirements-test.txt
    ) else (
        call "venv\Scripts\python.exe" -m pip install -r requirements-test.txt
    )
    if errorlevel 1 (
        echo Error: requirements-test.txt installation failed for %SERVICE_NAME%.
        popd >nul
        exit /b 1
    )
)

popd >nul
exit /b 0

:build_apk_cloud
cls
echo ============================================
echo   Build APK with Cloud EAS
echo ============================================
echo.

call :ensure_frontend_ready
if errorlevel 1 (
    pause
    goto :main_menu
)

if not exist "%PROJECT_ROOT%\apps\frontend\eas.json" (
    echo Error: apps\frontend\eas.json was not found.
    pause
    goto :main_menu
)

echo This will trigger a cloud build using the preview profile.
echo Make sure you are logged in to Expo/EAS.
echo.
pushd "%PROJECT_ROOT%\apps\frontend" >nul
call npx eas-cli build --platform android --profile preview
set "BUILD_RESULT=%errorlevel%"
popd >nul

if not "%BUILD_RESULT%"=="0" (
    echo.
    echo Cloud APK build failed.
    pause
    goto :main_menu
)

echo.
echo Cloud APK build started successfully.
pause
goto :main_menu

:build_apk_local
cls
echo ============================================
echo   Build APK Locally
echo ============================================
echo.

call :ensure_frontend_ready
if errorlevel 1 (
    pause
    goto :main_menu
)

if not exist "%PROJECT_ROOT%\apps\frontend\eas.json" (
    echo Error: apps\frontend\eas.json was not found.
    pause
    goto :main_menu
)

echo This will run a local EAS Android build using the preview profile.
echo Make sure Android Studio, the SDK, Java, and EAS local build prerequisites are installed.
echo.
pushd "%PROJECT_ROOT%\apps\frontend" >nul
call npx eas-cli build --platform android --profile preview --local
set "BUILD_RESULT=%errorlevel%"
popd >nul

if not "%BUILD_RESULT%"=="0" (
    echo.
    echo Local APK build failed.
    pause
    goto :main_menu
)

echo.
echo Local APK build completed successfully.
pause
goto :main_menu

:ensure_frontend_ready
if not exist "%PROJECT_ROOT%\node_modules\expo\bin\cli" (
    echo Error: Frontend dependencies are missing.
    echo Run setup first from this menu.
    exit /b 1
)

if not exist "%PROJECT_ROOT%\node_modules\@expo\cli" (
    echo Error: Expo CLI dependency is missing from node_modules.
    echo Run setup or update dependencies first from this menu.
    exit /b 1
)

exit /b 0

:set_local_frontend_env
set "EXPO_PUBLIC_FRONTEND_URL=http://localhost:8081"
set "EXPO_PUBLIC_API_URL=http://localhost:8000"
set "EXPO_PUBLIC_SCHEDULING_URL=http://localhost:8000"
set "EXPO_PUBLIC_MESSAGING_URL=http://localhost:8002"
set "EXPO_PUBLIC_RAG_URL=http://localhost:8001"
set "EXPO_PUBLIC_SNAPSHOT_URL=http://localhost:8003"
exit /b 0

:ensure_service_ready
if not exist "%PROJECT_ROOT%\%~1\venv\Scripts\python.exe" (
    echo Error: %~2 virtual environment was not found.
    echo Run setup first from this menu.
    exit /b 1
)

call :validate_python_executable "%PROJECT_ROOT%\%~1\venv\Scripts\python.exe"
if errorlevel 1 (
    echo Error: %~2 virtual environment is invalid.
    echo Run setup first from this menu to rebuild it.
    exit /b 1
)
exit /b 0

:resolve_api_tools_python
set "API_TOOLS_PYTHON="

if exist "%PROJECT_ROOT%\apps\api\venv\Scripts\python.exe" (
    call :validate_python_executable "%PROJECT_ROOT%\apps\api\venv\Scripts\python.exe"
    if not errorlevel 1 (
        set "API_TOOLS_PYTHON=%PROJECT_ROOT%\apps\api\venv\Scripts\python.exe"
    )
)

if not defined API_TOOLS_PYTHON if exist "%PROJECT_ROOT%\apps\scheduling-service\venv\Scripts\python.exe" (
    call :validate_python_executable "%PROJECT_ROOT%\apps\scheduling-service\venv\Scripts\python.exe"
    if not errorlevel 1 (
        set "API_TOOLS_PYTHON=%PROJECT_ROOT%\apps\scheduling-service\venv\Scripts\python.exe"
    )
)

if not defined API_TOOLS_PYTHON (
    echo Error: No Python environment was found for database tools.
    echo Run setup first from this menu.
    exit /b 1
)

exit /b 0

:require_command
where %~1 >nul 2>&1
if errorlevel 1 (
    echo Error: %~2 was not found in PATH.
    exit /b 1
)
exit /b 0

:verify_frontend_install
if not exist "%PROJECT_ROOT%\package.json" (
    echo Error: package.json was not found in the project root.
    exit /b 1
)

if not exist "%PROJECT_ROOT%\apps\frontend\package.json" (
    echo Error: apps\frontend\package.json was not found.
    exit /b 1
)

if not exist "%PROJECT_ROOT%\node_modules\expo\bin\cli" (
    echo Error: Expo launcher was not installed.
    exit /b 1
)

call npx expo --version >nul 2>&1
if errorlevel 1 (
    echo Error: Local Expo CLI failed to start.
    exit /b 1
)

call node scripts\validate-frontend-install.js >nul
if errorlevel 1 exit /b 1

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
exit /b 1

:validate_python_executable
if not exist "%~1" exit /b 1
"%~1" -c "import sys" >nul 2>&1
exit /b %errorlevel%

:confirm_action
set "ACTION_PROMPT=%~1"
echo.
set "CONFIRM_VALUE="
set /p CONFIRM_VALUE="%ACTION_PROMPT% (y/N): "
if /i "%CONFIRM_VALUE%"=="y" exit /b 0
echo Operation cancelled.
pause
exit /b 1
