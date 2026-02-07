Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Path to Chrome
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

' Path to log file for script output
logFile = scriptDir & "\start_chrome.log"
Set logFileObj = fso.CreateTextFile(logFile, True)

' Function to log both to console and file
Sub LogMessage(message)
    WScript.Echo message
    logFileObj.WriteLine message
End Sub

' Check if Chrome exists
If Not fso.FileExists(chromePath) Then
    LogMessage "ERROR: Chrome not found at: " & chromePath
    logFileObj.Close
    WScript.Quit 1
End If

' Set working directory
WshShell.CurrentDirectory = scriptDir

LogMessage "Starting Chrome in headless mode on port 9222..."
LogMessage ""

' Start Chrome headless with remote debugging
' Changed --remote-debugging-address=0.0.0.0 to accept external connections
' Added --disable-web-security to bypass Host header checks (needed for ngrok)
chromeCommand = """" & chromePath & """ --headless=new --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --remote-allow-origins=* --disable-web-security --user-data-dir=""C:\Temp\HiddenChrome"" --no-first-run --disable-gpu --window-size=1920,1080"
WshShell.Run chromeCommand, 0, False

' Close log file
logFileObj.Close
