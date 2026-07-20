'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { FootballDatabase, AppError } = require('./src/main/database');
const { createLogger } = require('./src/main/logger');
const { createHandlers } = require('./src/main/service');

let mainWindow, database, logger;
const allowedChannels = new Set(['clubs:list','clubs:filters','players:search','players:travelers','players:filters','players:catalog','players:common','game:create-round','game:create-country-round','grid:create','data:status','data:update','cache:clear']);

function dbPath() {
  return app.isPackaged ? path.join(process.resourcesPath,'data','football.db') : path.join(__dirname,'data','football.db');
}
function safeResult(action) {
  try { return { ok:true, data:action() }; }
  catch (error) {
    logger.error('IPC işlemi başarısız',error);
    const known = error instanceof AppError;
    return { ok:false, error:{ code:known?error.code:'INTERNAL_ERROR', message:known?error.message:'İşlem tamamlanamadı. Uygulama günlüğünü kontrol edin.' } };
  }
}
function registerIpc() {
  const handlers = createHandlers(database);
  for (const channel of allowedChannels) ipcMain.handle(channel,(_event,payload)=>safeResult(()=>handlers[channel](payload)));
  ipcMain.handle('external:open',async(_event,value)=>{
    try { const url=new URL(value); if(url.protocol!=='https:') throw new AppError('INVALID_URL','Yalnızca güvenli bağlantılar açılabilir.'); await shell.openExternal(url.href); return {ok:true,data:true}; }
    catch(error){ logger.warn('Harici bağlantı reddedildi',{message:error.message}); return {ok:false,error:{code:'INVALID_URL',message:'Bağlantı açılamadı.'}}; }
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({width:1360,height:900,minWidth:760,minHeight:620,backgroundColor:'#07111f',show:false,
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==mainWindow.webContents.getURL())event.preventDefault();});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.loadFile(path.join(__dirname,'src','index.html'));
}

app.whenReady().then(()=>{
  const logBase=app.isPackaged?app.getPath('userData'):__dirname; logger=createLogger(logBase);
  logger.info('Uygulama başlatılıyor',{version:app.getVersion(),packaged:app.isPackaged});
  const file=dbPath(); if(!fs.existsSync(file)) throw new Error(`Veritabanı bulunamadı: ${file}`);
  database=new FootballDatabase(file); logger.info('Veritabanı açıldı',database.status());
  registerIpc(); createWindow(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{if(logger)logger.error('Başlatma hatası',error); app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{try{database?.close();}catch{}});

