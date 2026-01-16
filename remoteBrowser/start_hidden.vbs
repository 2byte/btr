Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Path to main script
mainScript = scriptDir & "\start_ngrok.vbs"

' Run start_ngrok.vbs with cscript in hidden cmd window
' This avoids dialog boxes and writes output to log file only
' WindowStyle: 0 = hidden
command = "cmd /c cscript //nologo """ & mainScript & """"
WshShell.Run command, 0, False

WScript.Echo "Started ngrok and Chrome in background. Check start_ngrok.log for details."
