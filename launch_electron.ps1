$AppDir = "d:\Users\samue\OneDrive - Texas Tech University\Research\PhD\0-7147\Tasks\Task 6\New Data\service-life-analysis\app"
$ElectronExe = Join-Path $AppDir "node_modules\electron\dist\electron.exe"
$env:VITE_DEV_SERVER_URL = "http://localhost:5173"
Start-Process -FilePath $ElectronExe -ArgumentList "`"$AppDir`""
