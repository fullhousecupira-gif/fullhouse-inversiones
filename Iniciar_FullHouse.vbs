Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
indexPath = scriptDir & "\index.html"

edgePath1 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
edgePath2 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(edgePath1) Then
    WshShell.Run """" & edgePath1 & """ --app=""file:///" & indexPath & """ --allow-file-access-from-files --start-maximized", 0, False
ElseIf fso.FileExists(edgePath2) Then
    WshShell.Run """" & edgePath2 & """ --app=""file:///" & indexPath & """ --allow-file-access-from-files --start-maximized", 0, False
Else
    WshShell.Run """" & indexPath & """", 1, False
End If
