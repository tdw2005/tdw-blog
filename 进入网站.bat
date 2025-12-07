@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

start "Dev Server" cmd /c npm run dev

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $urls=@('http://localhost:3000/','http://localhost:3001/src/main.js'); while ($true) { $ok=$true; foreach ($u in $urls) { try { $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2 } catch { $ok=$false; break }; if ($r.StatusCode -ge 400) { $ok=$false; break } }; if ($ok) { break } ; Start-Sleep -Seconds 1 } }"

start "" http://localhost:3000/

endlocal
