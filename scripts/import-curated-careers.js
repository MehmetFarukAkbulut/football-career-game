'use strict';
const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const {normalizeText}=require('../src/shared/normalize');
const root=path.resolve(__dirname,'..'),file=process.env.IKI_FORMA_DB||path.join(root,'data','football.db');
const rows=JSON.parse(fs.readFileSync(path.join(root,'data','curated-careers.json'),'utf8')),db=new DatabaseSync(file);
const playerByExternal=db.prepare("SELECT id FROM players WHERE CAST(json_extract(external_ids_json,'$.transfermarkt') AS TEXT)=?");
const playersByName=db.prepare('SELECT id FROM players WHERE normalized_name=?');
const club=db.prepare('SELECT id FROM clubs WHERE slug=?');
const insertPlayer=db.prepare('INSERT INTO players(name,normalized_name,external_ids_json) VALUES(?,?,?)');
const insert=db.prepare("INSERT OR REPLACE INTO player_clubs(player_id,club_id,start_date,end_date,appearances,data_source,confidence,verified_first_team) VALUES(?,?,?,?,?,'curated-career-audit',0.98,1)");
db.exec('BEGIN IMMEDIATE');
try{
  for(const row of rows){
    let playerId=row.externalId?playerByExternal.get(String(row.externalId))?.id:null;
    if(!playerId&&!row.externalId){const matches=playersByName.all(normalizeText(row.player));if(matches.length>1)throw new Error(`Belirsiz oyuncu kimliği, kayıt iptal edildi: ${row.player}`);playerId=matches[0]?.id;}
    if(!playerId)playerId=Number(insertPlayer.run(row.player,normalizeText(row.player),JSON.stringify(row.externalId?{transfermarkt:String(row.externalId)}:{})).lastInsertRowid);
    const clubId=club.get(row.club)?.id;if(!clubId)throw new Error(`Kulüp bulunamadı: ${row.club}`);
    insert.run(playerId,clubId,row.start,row.end,row.appearances??null);
  }
  db.prepare("INSERT OR REPLACE INTO data_sources(name,license,last_sync_at,source_url) VALUES('curated-career-audit','Public career facts',?,'documented sources in README')").run(new Date().toISOString());
  db.exec('COMMIT; PRAGMA optimize');console.log(`${rows.length} denetlenmiş kariyer kaydı işlendi.`);
}catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
