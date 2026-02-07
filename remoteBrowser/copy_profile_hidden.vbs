Option Explicit
'
' Silent VBS: stop Chrome if running and copy the Default profile
' Usage: double-click (runs hidden) or `wscript "copy_profile_hidden.vbs"`
'
Dim WshShell, fso, localAppData, src, destParent, dest
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
src = localAppData & "\Google\Chrome\User Data\Default"
destParent = "C:\Temp\HiddenChrome"
dest = destParent & "\Default"

' Kill chrome if running (ignore errors)
On Error Resume Next
WshShell.Run "taskkill /F /IM chrome.exe", 0, True
On Error Goto 0

' Ensure destination parent exists
If Not fso.FolderExists(destParent) Then
  On Error Resume Next
  fso.CreateFolder destParent
  On Error Goto 0
End If

' If source doesn't exist, exit with non-zero
If Not fso.FolderExists(src) Then
  WScript.Quit 2
End If

' Remove existing destination to make a fresh copy
If fso.FolderExists(dest) Then
  On Error Resume Next
  fso.DeleteFolder dest, True
  On Error Goto 0
End If

' Copy folder using FileSystemObject with retries (handles locked files more gracefully than robocopy)
Dim attempts, maxAttempts
maxAttempts = 3
For attempts = 1 To maxAttempts
  On Error Resume Next
  fso.CopyFolder src, dest, True
  If Err.Number = 0 Then
    Exit For
  Else
    Dim lastErrNum, lastErrDesc
    lastErrNum = Err.Number
    lastErrDesc = Err.Description
    Err.Clear
    If attempts < maxAttempts Then
      WScript.Sleep 2000
    Else
      ' Final failure: exit with code 3
      WScript.Quit 3
    End If
  End If
Next

' Success
WScript.Quit 0
