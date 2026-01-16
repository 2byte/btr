Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Path to ngrok.exe
ngrokPath = scriptDir & "\ngrok.exe"

' Path to Chrome
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

' Path to log file for script output
logFile = scriptDir & "\start_ngrok.log"
Set logFileObj = fso.CreateTextFile(logFile, True)

' Function to log both to console and file
Sub LogMessage(message)
    WScript.Echo message
    logFileObj.WriteLine message
End Sub

' Check if ngrok.exe exists
If Not fso.FileExists(ngrokPath) Then
    LogMessage "ERROR: ngrok.exe not found in folder: " & scriptDir
    logFileObj.Close
    WScript.Quit 1
End If

' Check if Chrome exists
If Not fso.FileExists(chromePath) Then
    LogMessage "ERROR: Chrome not found at: " & chromePath
    logFileObj.Close
    WScript.Quit 1
End If

' Set working directory
WshShell.CurrentDirectory = scriptDir

LogMessage "Step 1: Adding ngrok authtoken..."
LogMessage ""

' Add ngrok authtoken
authCommand = "cmd /c """ & ngrokPath & """ config add-authtoken 383Ti4w0diZIBeiivzHnc5zTXnk_6vnunB5rDNyZsABwjUTxp"
authReturn = WshShell.Run(authCommand, 0, True)

LogMessage "Authtoken added successfully"
LogMessage ""
LogMessage "Step 2: Starting Chrome in headless mode on port 9222..."
LogMessage ""

' Start Chrome headless with remote debugging
' Changed --remote-debugging-address=0.0.0.0 to accept external connections
' Added --disable-web-security to bypass Host header checks (needed for ngrok)
chromeCommand = """" & chromePath & """ --headless=new --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --remote-allow-origins=* --disable-web-security --user-data-dir=""C:\Temp\HiddenChrome"" --no-first-run --disable-gpu --window-size=1920,1080"
WshShell.Run chromeCommand, 0, False

' Wait for Chrome to start
WScript.Sleep 3000

LogMessage "Chrome started"
LogMessage ""
LogMessage "Opening tabs in Chrome..."
LogMessage ""

' Open google.com in new tab
Set objExec = WshShell.Exec("powershell -Command ""try { Invoke-RestMethod -Uri 'http://localhost:9222/json/new?https://google.com' -Method Get | Out-Null; Write-Host 'Opened google.com' } catch { Write-Host ('Error: ' + $_.Exception.Message) }""")
Do While Not objExec.StdOut.AtEndOfStream
    LogMessage objExec.StdOut.ReadLine()
Loop

WScript.Sleep 1000

' Open youtube.com in new tab
Set objExec = WshShell.Exec("powershell -Command ""try { Invoke-RestMethod -Uri 'http://localhost:9222/json/new?https://youtube.com' -Method Get | Out-Null; Write-Host 'Opened youtube.com' } catch { Write-Host ('Error: ' + $_.Exception.Message) }""")
Do While Not objExec.StdOut.AtEndOfStream
    LogMessage objExec.StdOut.ReadLine()
Loop

LogMessage ""
LogMessage "Step 3: Starting ngrok http 9222 with host-header rewrite..."
LogMessage ""

' Kill any existing ngrok processes first
WshShell.Run "taskkill /f /im ngrok.exe", 0, True
WScript.Sleep 1000

' Start ngrok with HTTP tunnel and host-header rewrite
' --host-header=rewrite tells ngrok to rewrite the Host header to match the upstream server
' WindowStyle: 0 = hidden window
' WaitOnReturn: False = don't wait (ngrok runs continuously)
command = """" & ngrokPath & """ http 9222 --host-header=rewrite"
LogMessage "Executing command: " & command
LogMessage ""
WshShell.Run command, 0, False

' Give time for ngrok to start
WScript.Sleep 3000

LogMessage "Ngrok started in background"
LogMessage ""
LogMessage "Waiting for ngrok to initialize..."
WScript.Sleep 8000

' Check if ngrok process is running
Set objExec = WshShell.Exec("tasklist /FI ""IMAGENAME eq ngrok.exe""")
tasklistOutput = objExec.StdOut.ReadAll()
If InStr(tasklistOutput, "ngrok.exe") = 0 Then
    LogMessage "ERROR: ngrok.exe process not found!"
    logFileObj.Close
    WScript.Quit 1
End If

LogMessage "Ngrok process is running"

' Try to get ngrok URL from API with retries
LogMessage ""
LogMessage "Getting ngrok tunnel URL from API..."
LogMessage ""

maxRetries = 5
retryCount = 0
success = False

Do While retryCount < maxRetries And Not success
    If retryCount > 0 Then
        LogMessage "Retry " & retryCount & "/" & maxRetries & "..."
        WScript.Sleep 2000
    End If
    
    ' Use PowerShell to get ngrok API data - display all tunnels
    Set objExec = WshShell.Exec("powershell -Command ""try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels'; if ($response.tunnels.Count -gt 0) { $response.tunnels | ForEach-Object { Write-Host ('Proto: ' + $_.proto); Write-Host ('URL: ' + $_.public_url); Write-Host '' }; exit 0 } else { Write-Host 'No tunnels found'; exit 1 } } catch { Write-Host ('API not ready yet'); exit 1 }""")
    
    Do While Not objExec.StdOut.AtEndOfStream
        line = objExec.StdOut.ReadLine()
        LogMessage line
        If InStr(line, "Proto:") > 0 Or InStr(line, "URL:") > 0 Then
            success = True
        End If
    Loop
    
    retryCount = retryCount + 1
Loop

If Not success Then
    LogMessage ""
    LogMessage "ERROR: Could not get tunnel URL from ngrok API"
    LogMessage "Try opening http://localhost:4040 in browser to see ngrok dashboard"
    logFileObj.Close
    WScript.Quit 1
End If

' Save URL to file - get first tunnel
urlFile = scriptDir & "\ngrok_url.txt"
Set objExec2 = WshShell.Exec("powershell -Command ""try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels'; if ($response.tunnels.Count -gt 0) { $tunnel = $response.tunnels[0]; $tunnel.public_url | Out-File -FilePath '" & urlFile & "' -Encoding UTF8 } } catch { }""")

Do While objExec2.Status = 0
    WScript.Sleep 100
Loop

LogMessage ""
LogMessage "URL saved to: " & urlFile
LogMessage ""
LogMessage "Ngrok is running in background. To stop, kill ngrok.exe process."

' Close log file
logFileObj.Close
