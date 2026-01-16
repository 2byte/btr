Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get script directory
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Paths to scripts
stopScript = scriptDir & "\stop.vbs"
startScript = scriptDir & "\start_hidden.vbs"

WScript.Echo "Restarting ngrok and Chrome..."
WScript.Echo ""

' Stop existing processes
WScript.Echo "Step 1: Stopping existing processes..."
returnCode = WshShell.Run("cscript //nologo """ & stopScript & """", 1, True)

' Wait a bit before starting
WScript.Sleep 2000

' Start again
WScript.Echo ""
WScript.Echo "Step 2: Starting processes..."
WshShell.Run "cscript //nologo """ & startScript & """", 1, False

WScript.Echo ""
WScript.Echo "Restart initiated. Check start_ngrok.log for startup details."
