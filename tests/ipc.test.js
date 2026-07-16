'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('yeni katalog ve ülke oyunu IPC kanalları ana sürece kayıtlıdır',()=>{
  const main=fs.readFileSync(path.join(__dirname,'..','main.js'),'utf8');
  for(const channel of ['players:filters','players:catalog','game:create-country-round'])assert.match(main,new RegExp(`['"]${channel}['"]`));
});
