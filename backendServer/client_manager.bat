@echo off
chcp 65001 >nul
echo ============================================
echo Client Management Utility
echo ============================================
echo.

:menu
echo [1] Start Client (hidden)
echo [2] Start Client (visible console)
echo [3] Stop Client
echo [4] View Logs
echo [5] Clear Logs
echo [6] Check if running
echo [7] Exit
echo.
set /p choice="Choose option: "

if "%choice%"=="1" goto start_hidden
if "%choice%"=="2" goto start_visible
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto view_logs
if "%choice%"=="5" goto clear_logs
if "%choice%"=="6" goto check_running
if "%choice%"=="7" goto end

echo Invalid choice!
goto menu

:start_hidden
echo.
echo Starting client in hidden mode...
start_client_hidden.vbs
timeout /t 2 >nul
echo Client started! Check logs folder for output.
echo.
goto menu

:start_visible
echo.
echo Starting client in visible console...
echo Press Ctrl+C to stop
echo.
if exist "node_modules\.bin\bun.exe" (
    node_modules\.bin\bun.exe dist-clients\client.ts
) else if exist "..\serverVideoCapture\runtime\bun.exe" (
    ..\serverVideoCapture\runtime\bun.exe dist-clients\client.ts
) else (
    bun dist-clients\client.ts
)
echo.
goto menu

:stop
echo.
echo Stopping client...
stop_client.vbs
timeout /t 2 >nul
echo Client stopped!
echo.
goto menu

:view_logs
echo.
if not exist "logs\" (
    echo No logs directory found!
    goto menu
)
echo Recent log files:
echo.
dir /b /o-d logs\client_*.log 2>nul
if errorlevel 1 (
    echo No log files found!
    goto menu
)
echo.
set /p logfile="Enter log filename to view (or press Enter to view latest): "
if "%logfile%"=="" (
    for /f "delims=" %%f in ('dir /b /o-d logs\client_*.log 2^>nul') do (
        set logfile=%%f
        goto show_log
    )
)
:show_log
if exist "logs\%logfile%" (
    echo.
    echo ============================================
    echo Showing: %logfile%
    echo ============================================
    type "logs\%logfile%"
) else (
    echo Log file not found: %logfile%
)
echo.
pause
goto menu

:clear_logs
echo.
set /p confirm="Delete all log files? (yes/no): "
if /i "%confirm%"=="yes" (
    del /q logs\*.log 2>nul
    echo Logs cleared!
) else (
    echo Cancelled.
)
echo.
goto menu

:check_running
echo.
echo Checking for running client processes...
echo.
tasklist | findstr /i "bun.exe" >nul
if errorlevel 1 (
    echo No bun.exe processes found.
) else (
    echo Found bun.exe processes:
    wmic process where "name='bun.exe'" get ProcessId,CommandLine 2>nul
)
echo.
pause
goto menu

:end
echo.
echo Goodbye!
timeout /t 1 >nul
exit /b 0
