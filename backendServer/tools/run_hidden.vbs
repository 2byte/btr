' ============================================
' Universal Hidden Command Runner 
' ============================================
' Usage:
'   1. Run with arguments: cscript //nologo run_hidden.vbs "bun.exe" "client.ts"
'   2. Edit CMD_EXECUTABLE and CMD_ARGS below and double-click
'   3. Run from another script: WshShell.Run "run_hidden.vbs arg1 arg2", 0, False
' ============================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' ============================================
' CONFIGURATION - Edit these values if running without arguments
' ============================================
CMD_EXECUTABLE = "bun.exe"
CMD_ARGS = "dist-clients\client.ts"
WORKING_DIRECTORY = scriptDir
LOG_ENABLED = True
LOG_DIRECTORY = scriptDir & "\logs"
LOG_PREFIX = "hidden_run"

' ============================================
' Command-line arguments override config
' ============================================
If WScript.Arguments.Count >= 1 Then
    CMD_EXECUTABLE = WScript.Arguments(0)
End If

If WScript.Arguments.Count >= 2 Then
    CMD_ARGS = WScript.Arguments(1)
End If

If WScript.Arguments.Count >= 3 Then
    WORKING_DIRECTORY = WScript.Arguments(2)
End If

' ============================================
' Resolve executable path (check if it's in script dir or system PATH)
' ============================================
executablePath = CMD_EXECUTABLE

' If not an absolute path, check in script directory first
If InStr(executablePath, ":\") = 0 And InStr(executablePath, "\\") <> 1 Then
    localExecPath = scriptDir & "\" & CMD_EXECUTABLE
    If fso.FileExists(localExecPath) Then
        executablePath = localExecPath
    End If
End If

' ============================================
' Create logs directory if enabled
' ============================================
If LOG_ENABLED Then
    If Not fso.FolderExists(LOG_DIRECTORY) Then
        fso.CreateFolder(LOG_DIRECTORY)
    End If
    
    ' Generate log file name with timestamp
    currentDate = Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2)
    currentTime = Right("0" & Hour(Now), 2) & "-" & Right("0" & Minute(Now), 2) & "-" & Right("0" & Second(Now), 2)
    logFile = LOG_DIRECTORY & "\" & LOG_PREFIX & "_" & currentDate & "_" & currentTime & ".log"
    
    ' Create log file with header
    Set logFH = fso.CreateTextFile(logFile, True)
    logFH.WriteLine("============================================")
    logFH.WriteLine("Hidden Command Runner - " & Now)
    logFH.WriteLine("============================================")
    logFH.WriteLine("Executable: " & executablePath)
    logFH.WriteLine("Arguments: " & CMD_ARGS)
    logFH.WriteLine("Working Dir: " & WORKING_DIRECTORY)
    logFH.WriteLine("============================================")
    logFH.WriteLine("")
    logFH.Close
    Set logFH = Nothing
End If

' ============================================
' Build command
' ============================================
fullCommand = Chr(34) & executablePath & Chr(34)
If Len(CMD_ARGS) > 0 Then
    fullCommand = fullCommand & " " & CMD_ARGS
End If

' Redirect output to log if enabled
If LOG_ENABLED Then
    fullCommand = "cmd.exe /c " & fullCommand & " >> " & Chr(34) & logFile & Chr(34) & " 2>&1"
End If

' ============================================
' Set working directory and run hidden
' ============================================
WshShell.CurrentDirectory = WORKING_DIRECTORY

' Run hidden (0 = hidden window, False = don't wait)
WshShell.Run fullCommand, 0, False

' Optional: Write success marker to log
If LOG_ENABLED Then
    WScript.Sleep(500)
    Set logFH = fso.OpenTextFile(logFile, 8, True) ' 8 = ForAppending
    logFH.WriteLine("")
    logFH.WriteLine("---- Process started successfully at " & Now & " ----")
    logFH.Close
    Set logFH = Nothing
End If

Set WshShell = Nothing
Set fso = Nothing
