@echo off
chcp 65001 >nul
echo ============================================
echo Client Autostart Removal
echo ============================================
echo.

set "TASK_NAME_CLIENT=BrowserTracker Client"
set "TASK_NAME_WATCHDOG=BrowserTracker Watchdog"

echo Checking for scheduled tasks...
echo.

schtasks /query /tn "%TASK_NAME_CLIENT%" >nul 2>&1
set CLIENT_EXISTS=%errorlevel%

schtasks /query /tn "%TASK_NAME_WATCHDOG%" >nul 2>&1
set WATCHDOG_EXISTS=%errorlevel%

if %CLIENT_EXISTS%==0 (
    echo [Found] %TASK_NAME_CLIENT%
) else (
    echo [Not found] %TASK_NAME_CLIENT%
)

if %WATCHDOG_EXISTS%==0 (
    echo [Found] %TASK_NAME_WATCHDOG%
) else (
    echo [Not found] %TASK_NAME_WATCHDOG%
)

if %CLIENT_EXISTS% neq 0 if %WATCHDOG_EXISTS% neq 0 (
    echo.
    echo No autostart tasks found!
    pause
    exit /b 0
)

echo.
set /p confirm="Remove these tasks? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.

if %CLIENT_EXISTS%==0 (
    echo Removing %TASK_NAME_CLIENT%...
    schtasks /delete /tn "%TASK_NAME_CLIENT%" /f
    if errorlevel 1 (
        echo ERROR: Failed to remove client task!
    ) else (
        echo SUCCESS: Client task removed
    )
)

if %WATCHDOG_EXISTS%==0 (
    echo Removing %TASK_NAME_WATCHDOG%...
    schtasks /delete /tn "%TASK_NAME_WATCHDOG%" /f
    if errorlevel 1 (
        echo ERROR: Failed to remove watchdog task!
    ) else (
        echo SUCCESS: Watchdog task removed
    )
)

echo.
echo Done!
pause
