' ============================================
' Stop Client
' ============================================
' Kills all running bun.exe processes running client.ts
' ============================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Log file
logsDir = scriptDir & "\logs"
If Not fso.FolderExists(logsDir) Then
    fso.CreateFolder(logsDir)
End If

currentDate = Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2)
logFile = logsDir & "\client_stop_" & currentDate & ".log"

' Function to write to log
Sub WriteLog(message)
    On Error Resume Next
    Set logFH = fso.OpenTextFile(logFile, 8, True) ' 8 = ForAppending
    logFH.WriteLine(Now & " - " & message)
    logFH.Close
    Set logFH = Nothing
End Sub

WriteLog "============================================"
WriteLog "Stopping client processes..."
WriteLog "============================================"

' Get list of processes
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'bun.exe'")

foundProcesses = False
killedCount = 0

' Check each bun.exe process for client.ts in command line
For Each objProcess In colProcesses
    commandLine = objProcess.CommandLine
    If Not IsNull(commandLine) Then
        If InStr(LCase(commandLine), "client.ts") > 0 Then
            foundProcesses = True
            processId = objProcess.ProcessId
            processName = objProcess.Name
            
            WriteLog "Found process: " & processName & " (PID: " & processId & ")"
            WriteLog "Command line: " & commandLine
            
            ' Kill the process
            result = objProcess.Terminate()
            If result = 0 Then
                WriteLog "Successfully killed PID " & processId
                killedCount = killedCount + 1
            Else
                WriteLog "Failed to kill PID " & processId & " (Error code: " & result & ")"
            End If
        End If
    End If
Next

If Not foundProcesses Then
    WriteLog "No client.ts processes found running"
Else
    WriteLog "Killed " & killedCount & " process(es)"
End If

WriteLog "============================================"
WriteLog "Stop operation completed"
WriteLog "============================================"

Set colProcesses = Nothing
Set objWMIService = Nothing
Set WshShell = Nothing
Set fso = Nothing
