$desktop = [Environment]::GetFolderPath('Desktop')
Write-Host 'Waiting for APKs to be generated...'
while (!(Test-Path 'android\app\build\outputs\apk\parent\release\app-parent-release.apk')) {
    Start-Sleep -Seconds 5
}
while (!(Test-Path 'android\app\build\outputs\apk\child\release\app-child-release.apk')) {
    Start-Sleep -Seconds 5
}
Copy-Item 'android\app\build\outputs\apk\parent\release\app-parent-release.apk' -Destination '$desktop\StayKids_Parent_Production.apk' -Force
Copy-Item 'android\app\build\outputs\apk\child\release\app-child-release.apk' -Destination '$desktop\StayKids_Child_Production.apk' -Force
Write-Host 'Copied APKs to Desktop.'
