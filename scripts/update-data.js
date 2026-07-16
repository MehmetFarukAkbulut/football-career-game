'use strict';
const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const {normalizeText}=require('../src/shared/normalize');
const root=path.resolve(__dirname,'..'),file=process.env.IKI_FORMA_DB||path.join(root,'data','football.db');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchBatch(clubs){
  const values=clubs.map(c=>`wd:${c.wikidata_id}`).join(' ');
  const query=`SELECT DISTINCT ?player ?club ?playerLabel ?image WHERE { VALUES ?club { ${values} } ?player wdt:P54 ?club. OPTIONAL {?player wdt:P18 ?image} SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". } } LIMIT 3000`;
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),90000);
  try{const response=await fetch('https://query.wikidata.org/sparql',{method:'POST',headers:{Accept:'application/sparql-results+json','Content-Type':'application/x-www-form-urlencoded','User-Agent':'IkiForma/2.0 offline-data-builder'},body:`query=${encodeURIComponent(query)}`,signal:ctl.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return (await response.json()).results.bindings;}finally{clearTimeout(timer);}
}
async function main(){
  if(!fs.existsSync(file))throw new Error('Önce npm run data:build çalıştırın.');
  const db=new DatabaseSync(file),clubs=db.prepare('SELECT id,wikidata_id FROM clubs WHERE wikidata_id IS NOT NULL').all();
  console.log('Wikidata P54 açık veri güncellemesi indiriliyor (sabit QID eşlemesi kullanılır)…');
  const rows=[];
  try{for(let i=0;i<clubs.length;i+=7){const batch=await fetchBatch(clubs.slice(i,i+7));rows.push(...batch);console.log(`${Math.min(i+7,clubs.length)}/${clubs.length} kulüp alındı`);await wait(800);}}
  catch(e){console.error(`Güncelleme alınamadı; mevcut veritabanı korundu: ${e.message}`);db.close();process.exitCode=2;return;}
  const clubMap=new Map(clubs.map(c=>[c.wikidata_id,c.id])),find=db.prepare('SELECT id FROM players WHERE wikidata_id=?'),insert=db.prepare('INSERT INTO players(name,normalized_name,photo_url,wikidata_id) VALUES(?,?,?,?)'),link=db.prepare("INSERT OR IGNORE INTO player_clubs(player_id,club_id,data_source,confidence,verified_first_team) VALUES(?,?,'Wikidata P54',0.4,0)");
  db.exec('BEGIN');
  try{for(const row of rows){const q=row.player.value.split('/').pop(),cq=row.club.value.split('/').pop(),name=row.playerLabel?.value;if(!name||name===q||!clubMap.has(cq))continue;let id=find.get(q)?.id;if(!id)id=Number(insert.run(name,normalizeText(name),row.image?.value||null,q).lastInsertRowid);link.run(id,clubMap.get(cq));}db.prepare("INSERT OR REPLACE INTO data_sources(name,license,last_sync_at,source_url) VALUES('Wikidata P54','CC0 1.0',?,'https://www.wikidata.org/')").run(new Date().toISOString());db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES('updated_at',?)").run(new Date().toISOString());db.exec('COMMIT; PRAGMA optimize');}
  catch(e){db.exec('ROLLBACK');throw e;}
  console.log(`Güncelleme tamamlandı: ${rows.length} açık veri satırı işlendi.`);db.close();
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
