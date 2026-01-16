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