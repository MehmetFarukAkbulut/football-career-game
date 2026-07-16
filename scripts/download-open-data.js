'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'data','import-cache');
const base='https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data';
const files=['clubs.csv.gz','players.csv.gz','appearances.csv.gz'];
fs.mkdirSync(dir,{recursive:true});
for(const file of files){const target=path.join(dir,file),result=spawnSync('curl.exe',['-L','--fail','--retry','5','--retry-delay','2','-C','-','-o',target,`${base}/${file}`],{stdio:'inherit'});if(result.status!==0)throw new Error(`${file} indirilemedi; mevcut veritabanı değiştirilmedi.`);}
const manifest={source:'https://github.com/dcaribou/transfermarkt-datasets',license:'CC0-1.0',downloadedAt:new Date().toISOString(),files:{}};
for(const file of files){const data=fs.readFileSync(path.join(dir,file));manifest.files[file]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
console.log('Açık veri dosyaları indirildi ve SHA-256 manifesti oluşturuldu.');
