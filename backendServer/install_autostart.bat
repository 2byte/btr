@echo off
chcp 65001 >nul
echo ============================================
echo Client Autostart Setup
echo ============================================
echo.
echo This script will create a scheduled task to run
echo the client automatically at system startup.
echo.

set /p mode="Choose mode: [1] Client only [2] Watchdog (recommended): "

if "%mode%"=="1" (
    set TASK_NAME=BrowserTracker Client
    set SCRIPT_NAME=start_client_hidden.vbs
    echo Installing: Client startup
) else if "%mode%"=="2" (
    set TASK_NAME=BrowserTracker Watchdog
    set SCRIPT_NAME=watchdog_client.vbs
    echo Installing: Watchdog (auto-restart on crash)
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
set SCRIPT_DIR=%~dp0
set SCRIPT_PATH=%SCRIPT_DIR%%SCRIPT_NAME%

if not exist "%SCRIPT_PATH%" (
    echo ERROR: Script not found: %SCRIPT_PATH%
    pause
    exit /b 1
)

echo Task will be created with:
echo - Task Name: %TASK_NAME%
echo - Script: %SCRIPT_NAME%
echo - Path: %SCRIPT_PATH%
echo.

set /p confirm="Continue? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Creating scheduled task...

schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "wscript.exe \"%SCRIPT_PATH%\"" ^
    /sc onlogon ^
    /rl highest ^
    /f

if errorlevel 1 (
    echo.
    echo ERROR: Failed to create scheduled task!
    echo Make sure you run this script as Administrator.
    pause
    exit /b 1
)

echo.
echo ============================================
echo SUCCESS: Task created successfully!
echo ============================================
echo.
echo Task name: %TASK_NAME%
echo Trigger: At user logon
echo.
echo To verify the task:
echo   schtasks /query /tn "%TASK_NAME%"
echo.
echo To test the task now:
echo   schtasks /run /tn "%TASK_NAME%"
echo.
echo To delete the task:
echo   schtasks /delete /tn "%TASK_NAME%" /f
echo.
pause

set /p runnow="Run task now to test? (yes/no): "
if /i "%runnow%"=="yes" (
    echo.
    echo Running task...
    schtasks /run /tn "%TASK_NAME%"
    timeout /t 2 >nul
    echo.
    echo Check logs folder to verify it's working.
)

echo.
echo Done!
pause
