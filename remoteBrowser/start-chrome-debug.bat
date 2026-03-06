@echo off
REM Запуск Chrome с remote debugging на порту 9222
REM Использует профиль по умолчанию (с cookies, историей, расширениями)

echo Starting Chrome with remote debugging on port 9222...
echo.

REM Путь к Chrome (измените если нужно)
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"

REM Путь к профилю пользователя (по умолчанию)
set USER_DATA_DIR=%LOCALAPPDATA%\Google\Chrome\User Data

REM Запуск Chrome с remote debugging
start "" %CHROME_PATH% --remote-debugging-port=9222 --user-data-dir="%USER_DATA_DIR%"

echo.
echo Chrome started with remote debugging enabled!
echo.
echo You can now connect to it using:
echo   bun connect-existing.ts
echo.
echo Or check browser info:
echo   bun connect-existing.ts info
echo.

timeout /t 3
