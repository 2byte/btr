' ============================================
' Client Watchdog - Auto-restart on crash
' ============================================
' Monitors client.ts process and restarts it if it crashes
' Can be run manually or scheduled to run at startup
' ============================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Configuration
CHECK_INTERVAL_SECONDS = 30  ' How often to check if process is running
MAX_RESTARTS_PER_HOUR = 10   ' Prevent restart loop
RESTART_DELAY_SECONDS = 5    ' Wait before restarting

' Initialize counters
restartCount = 0
lastRestartTime = Now
isFirstRun = True

' Log file
logsDir = scriptDir & "\logs"
If Not fso.FolderExists(logsDir) Then
    fso.CreateFolder(logsDir)
End If

currentDate = Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2)
logFile = logsDir & "\watchdog_" & currentDate & ".log"

' Write to log with timestamp
Sub WriteLog(message)
    On Error Resume Next
    Set logFH = fso.OpenTextFile(logFile, 8, True) ' 8 = ForAppending
    logFH.WriteLine(Now & " - " & message)
    logFH.Close
    Set logFH = Nothing
End Sub

WriteLog "============================================"
WriteLog "Watchdog started"
WriteLog "Check interval: " & CHECK_INTERVAL_SECONDS & " seconds"
WriteLog "Max restarts per hour: " & MAX_RESTARTS_PER_HOUR
WriteLog "============================================"

' Main monitoring loop
Do While True
    ' Reset restart counter every hour
    If DateDiff("h", lastRestartTime, Now) >= 1 Then
        restartCount = 0
        lastRestartTime = Now
        WriteLog "Restart counter reset"
    End If
    
    ' Check if client process is running
    isRunning = False
    Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
    Set colProcesses = objWMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'bun.exe'")
    
    For Each objProcess In colProcesses
        commandLine = objProcess.CommandLine
        If Not IsNull(commandLine) Then
            If InStr(LCase(commandLine), "client.ts") > 0 Then
                isRunning = True
                If isFirstRun Then
                    WriteLog "Client process found running (PID: " & objProcess.ProcessId & ")"
                    isFirstRun = False
                End If
                Exit For
            End If
        End If
    Next
    
    Set colProcesses = Nothing
    Set objWMIService = Nothing
    
    ' If not running, restart
    If Not isRunning Then
        If restartCount >= MAX_RESTARTS_PER_HOUR Then
            WriteLog "ERROR: Maximum restart limit reached (" & MAX_RESTARTS_PER_HOUR & "/hour)"
            WriteLog "Stopping watchdog to prevent restart loop"
            WriteLog "Please check client logs and fix the issue"
            WScript.Quit 1
        End If
        
        WriteLog "WARNING: Client process not found!"
        WriteLog "Waiting " & RESTART_DELAY_SECONDS & " seconds before restart..."
        WScript.Sleep(RESTART_DELAY_SECONDS * 1000)
        
        WriteLog "Restarting client... (attempt " & (restartCount + 1) & "/" & MAX_RESTARTS_PER_HOUR & ")"
        
        ' Use start_client_hidden.vbs to restart
        startScript = scriptDir & "\start_client_hidden.vbs"
        If fso.FileExists(startScript) Then
            WshShell.Run "wscript.exe " & Chr(34) & startScript & Chr(34), 0, False
            restartCount = restartCount + 1
            WriteLog "Client restarted successfully"
        Else
            WriteLog "ERROR: start_client_hidden.vbs not found at " & startScript
            WScript.Quit 1
        End If
    End If
    
    ' Wait before next check
    WScript.Sleep(CHECK_INTERVAL_SECONDS * 1000)
Loop

' Cleanup (never reached in normal operation)
Set WshShell = Nothing
Set fso = Nothing
