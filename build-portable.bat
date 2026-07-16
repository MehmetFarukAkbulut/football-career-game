@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
where node >nul 2>nul || goto :no_node
if not exist "node_modules\electron\package.json" call npm install
if errorlevel 1 goto :failed
call npm run data:verify || goto :tests_failed
call npm run build:portable || goto :build_failed
if not exist "dist\Iki-Forma.exe" goto :missing
echo.
echo Portable uygulama hazır: %CD%\dist\Iki-Forma.exe
exit /b 0
:no_node
echo HATA: Node.js bulunamadı.
goto :failed
:tests_failed
echo HATA: Veri doğrulaması veya testler başarısız; build iptal edildi.
goto :failed
:build_failed
echo HATA: Portable build başarısız oldu.
goto :failed
:missing
echo HATA: Build tamamlandı ancak dist\Iki-Forma.exe bulunamadı.
:failed
pause
exit /b 1
