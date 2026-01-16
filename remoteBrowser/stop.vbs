Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Path to log file
logFile = scriptDir & "\stop.log"
Set logFileObj = fso.CreateTextFile(logFile, True)

' Function to log both to console and file
Sub LogMessage(message)
    WScript.Echo message
    logFileObj.WriteLine message
End Sub

LogMessage "Stopping ngrok and Chrome..."
LogMessage ""

' Kill ngrok process
LogMessage "Killing ngrok.exe..."
returnCode = WshShell.Run("taskkill /f /im ngrok.exe", 0, True)
If returnCode = 0 Then
    LogMessage "Ngrok stopped successfully"
Else
    LogMessage "Ngrok was not running or could not be stopped"
End If

LogMessage ""

' Kill Chrome process
LogMessage "Killing chrome.exe..."
returnCode = WshShell.Run("taskkill /f /im chrome.exe", 0, True)
If returnCode = 0 Then
    LogMessage "Chrome stopped successfully"
Else
    LogMessage "Chrome was not running or could not be stopped"
End If

LogMessage ""
LogMessage "Stop complete"

logFileObj.Close
