@echo off
chcp 65001 >nul
echo ============================================
echo Universal run_hidden.vbs - Usage Examples
echo ============================================
echo.
echo Select an example to run:
echo.
echo [1] Run Bun script (client.ts)
echo [2] Run Node.js script
echo [3] Run Python script
echo [4] Run PowerShell script
echo [5] Run batch file silently
echo [6] Custom command (you enter)
echo [7] Exit
echo.
set /p choice="Choose: "

if "%choice%"=="1" goto example1
if "%choice%"=="2" goto example2
if "%choice%"=="3" goto example3
if "%choice%"=="4" goto example4
if "%choice%"=="5" goto example5
if "%choice%"=="6" goto example6
if "%choice%"=="7" goto end

echo Invalid choice!
pause
exit /b 1

:example1
echo.
echo Running: bun.exe dist-clients\client.ts
echo.
run_hidden.vbs "bun.exe" "dist-clients\client.ts"
echo Started! Check logs folder.
pause
exit /b 0

:example2
echo.
set /p script="Enter Node.js script path: "
echo.
echo Running: node.exe %script%
echo.
run_hidden.vbs "node.exe" "%script%"
echo Started! Check logs folder.
pause
exit /b 0

:example3
echo.
set /p script="Enter Python script path: "
echo.
echo Running: python.exe %script%
echo.
run_hidden.vbs "python.exe" "%script%"
echo Started! Check logs folder.
pause
exit /b 0

:example4
echo.
set /p script="Enter PowerShell script path: "
echo.
echo Running: powershell.exe -File %script%
echo.
run_hidden.vbs "powershell.exe" "-File \"%script%\""
echo Started! Check logs folder.
pause
exit /b 0

:example5
echo.
set /p script="Enter batch file path: "
echo.
echo Running: cmd.exe /c %script%
echo.
run_hidden.vbs "cmd.exe" "/c \"%script%\""
echo Started! Check logs folder.
pause
exit /b 0

:example6
echo.
echo Enter command details:
set /p exe="Executable (e.g., bun.exe): "
set /p args="Arguments (e.g., script.ts): "
set /p workdir="Working directory (press Enter for current): "

if "%workdir%"=="" set workdir=%CD%

echo.
echo Will run: %exe% %args%
echo Working dir: %workdir%
echo.
set /p confirm="Continue? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Running...
echo.
run_hidden.vbs "%exe%" "%args%" "%workdir%"
echo Started! Check logs folder.
pause
exit /b 0

:end
echo Goodbye!
exit /b 0
