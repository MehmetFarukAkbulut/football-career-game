'use strict';
const path=require('path');const {FootballDatabase}=require('../src/main/database');
const db=new FootballDatabase(process.env.IKI_FORMA_DB||path.join(__dirname,'..','data','football.db'));
const pairs=[['galatasaray','fenerbahce',2],['barcelona','bayern-munich',2],['barcelona','psg',2],['chelsea','arsenal',2],['inter','milan',2],['real-madrid','juventus',2]];
const clubs=db.listClubs();let failed=false;
for(const [a,b,min] of pairs){const ca=clubs.find(c=>c.slug===a),cb=clubs.find(c=>c.slug===b);const r=db.commonPlayers(ca.id,cb.id);console.log(`${ca.name} – ${cb.name}: ${r.count}`);if(r.count<min)failed=true;}
const status=db.status();console.log(status);db.close();if(failed)throw new Error('Minimum doğrulama eşleşmelerinden biri başarısız.');
