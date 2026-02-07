```
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
--headless=new ^
--remote-debugging-port=9222 ^
--remote-debugging-address=0 ^
--remote-allow-origins=* ^
--user-data-dir="C:\Temp\HiddenChrome" ^
--no-first-run ^
--disable-gpu ^
--window-size=1920,1080
```

Kill

```
taskkill /f /im chrome.exe
```
```cmd
C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9222 --remote-debugging-address=0 --remote-allow-origins=* --user-data-dir="C:\Temp\HiddenChrome" --no-first-run --disable-gpu --window-size=1920,1080
```

# Доступ извне
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --remote-allow-origins=* --user-data-dir="C:\Temp\HiddenChrome" --no-first-run --disable-gpu --window-size=1920,1080
```

# Проброс порта 9222 на 9223
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=9222 connectaddress=127.0.0.1 connectport=9223

# Просмотр всех правил
netsh interface portproxy show all

# Открыть порт в брандмауэре
New-NetFirewallRule -DisplayName "Chrome Debug Port" -Direction Inbound -LocalPort 9222 -Protocol TCP -Action Allow