' ============================================
' Start Client Hidden
' ============================================
' Starts the WebSocket client in hidden mode
' Uses bun.exe to run client.ts from dist-clients folder
' ============================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory (backendServer)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check for bun.exe in several locations
bunPath = ""
possiblePaths = Array( _
    scriptDir & "\node_modules\.bin\bun.exe", _
    scriptDir & "\..\serverVideoCapture\runtime\bun.exe", _
    "C:\Program Files\Bun\bun.exe", _
    "bun.exe" _
)

For Each path In possiblePaths
    If fso.FileExists(path) Or InStr(path, "bun.exe") = Len(path) - 6 Then
        bunPath = path
        Exit For
    End If
Next

If bunPath = "" Then
    bunPath = "bun"
End If

' Client script path
clientScript = scriptDir & "\dist-clients\client.ts"

' Check if client.ts exists
If Not fso.FileExists(clientScript) Then
    MsgBox "Error: client.ts not found at " & clientScript, 16, "Client Start Error"
    WScript.Quit 1
End If

' Create logs directory
logsDir = scriptDir & "\logs"
If Not fso.FolderExists(logsDir) Then
    fso.CreateFolder(logsDir)
End If

' Generate log file name
currentDate = Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2)
logFile = logsDir & "\client_" & currentDate & ".log"

' Build command with log redirection
command = "cmd.exe /c " & Chr(34) & bunPath & Chr(34) & " " & Chr(34) & clientScript & Chr(34) & " >> " & Chr(34) & logFile & Chr(34) & " 2>&1"

' Set working directory
WshShell.CurrentDirectory = scriptDir

' Run hidden (0 = hidden, False = don't wait)
WshShell.Run command, 0, False

' Write start marker to log
WScript.Sleep(500)
Set logFH = fso.OpenTextFile(logFile, 8, True) ' 8 = ForAppending
logFH.WriteLine("")
logFH.WriteLine("============================================")
logFH.WriteLine("Client started at " & Now)
logFH.WriteLine("Command: " & bunPath & " " & clientScript)
logFH.WriteLine("============================================")
logFH.WriteLine("")
logFH.Close
Set logFH = Nothing

Set WshShell = Nothing
Set fso = Nothing
