@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
where node >nul 2>nul || goto :no_node
if not exist "node_modules\electron\package.json" (
  echo Bağımlılıklar kuruluyor...
  call npm install || goto :install_error
)
if not exist "data\football.db" (
  echo Yerel veritabanı oluşturuluyor...
  call npm run data:build || goto :data_error
)
call npm start
if errorlevel 1 goto :start_error
exit /b 0
:no_node
echo HATA: Node.js bulunamadı. Node.js LTS kurup yeniden deneyin.
goto :failed
:install_error
echo HATA: npm install başarısız oldu.
goto :failed
:data_error
echo HATA: Yerel veritabanı oluşturulamadı.
goto :failed
:start_error
echo HATA: Uygulama %errorlevel% koduyla kapandı. logs\app.log dosyasını kontrol edin.
:failed
pause
exit /b 1
