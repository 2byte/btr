
' install_bun.vbs
' Downloads Bun runtime and places it in the specified directory.
' Usage: cscript install_bun.vbs [target_directory]
' If no argument is provided, defaults to %USERPROFILE%\.bun\bin

Option Explicit

Dim targetDir, bunUrl, bunZipPath, bunExePath, shell, fso, http, stream, objArgs

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

Set objArgs = WScript.Arguments

If objArgs.Count >= 1 Then
    targetDir = objArgs(0)
Else
    targetDir = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.bun\bin"
End If

' Normalize trailing slash
If Right(targetDir, 1) = "\" Then
    targetDir = Left(targetDir, Len(targetDir) - 1)
End If

' Create directory if it doesn't exist
If Not fso.FolderExists(targetDir) Then
    fso.CreateFolder(targetDir)
End If

' Bun latest release URL for Windows x64
bunUrl     = "https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip"
bunZipPath = targetDir & "\bun-windows-x64.zip"
bunExePath = targetDir & "\bun.exe"

WScript.Echo "Downloading Bun from: " & bunUrl
WScript.Echo "Target directory    : " & targetDir

' Download the zip
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.Open "GET", bunUrl, False
http.setRequestHeader "User-Agent", "Mozilla/5.0"
http.Send

If http.Status <> 200 Then
    WScript.Echo "ERROR: HTTP " & http.Status & " - failed to download Bun."
    WScript.Quit 1
End If

' Save zip to disk
Set stream = CreateObject("ADODB.Stream")
stream.Type = 1 ' Binary
stream.Open
stream.Write http.responseBody
stream.SaveToFile bunZipPath, 2 ' Overwrite
stream.Close

WScript.Echo "Download complete. Extracting..."

' Extract using Shell.Application
Dim shellApp, zipFolder, destFolder, zipItem
Set shellApp  = CreateObject("Shell.Application")
Set zipFolder = shellApp.NameSpace(bunZipPath)
Set destFolder = shellApp.NameSpace(targetDir)

' CopyHere flags: 4 = no progress dialog, 16 = yes to all, 1024 = no error UI
destFolder.CopyHere zipFolder.Items(), 4 + 16 + 1024

' Wait until bun.exe appears in the zip sub-folder, then move it up
Dim maxWait, waited, subFolder, subFolderPath
maxWait = 30
waited  = 0
subFolderPath = targetDir & "\bun-windows-x64"

Do While waited < maxWait
    WScript.Sleep 1000
    waited = waited + 1
    If fso.FolderExists(subFolderPath) Then
        If fso.FileExists(subFolderPath & "\bun.exe") Then
            Exit Do
        End If
    End If
Loop

If Not fso.FileExists(subFolderPath & "\bun.exe") Then
    WScript.Echo "ERROR: bun.exe not found after extraction."
    WScript.Quit 1
End If

' Move bun.exe to target dir (overwrite if exists)
If fso.FileExists(bunExePath) Then
    fso.DeleteFile bunExePath, True
End If
fso.MoveFile subFolderPath & "\bun.exe", bunExePath

' Cleanup
fso.DeleteFolder subFolderPath, True
fso.DeleteFile bunZipPath, True

WScript.Echo "Bun installed successfully: " & bunExePath
WScript.Echo ""
WScript.Echo "Add the following directory to your PATH if not already present:"
WScript.Echo "  " & targetDir
