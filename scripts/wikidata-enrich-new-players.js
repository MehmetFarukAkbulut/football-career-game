"use strict";
const fs=require("node:fs"),path=require("node:path");
const {ROOT,ENTITY_BATCH,getEntities,resolveLabels,extractFootballPlayer,loadGzipJson,saveGzipJson,sleep}=require("./wikidata-football-core");
const input=path.join(ROOT,"data","historical-missing-players.json");
const cacheFile=path.join(ROOT,"data","wikidata-football-cache.json.gz");
const cp=path.join(ROOT,"data","wikidata-new-player-checkpoint.ndjson");
const source=JSON.parse(fs.readFileSync(input,"utf8"));
const cache=loadGzipJson(cacheFile,{players:[],invalidPlayers:[]});
const loadCp=()=>fs.existsSync(cp)?fs.readFileSync(cp,"utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse):[];
const rows=loadCp();
const known=new Set([...(cache.players||[]),...(cache.invalidPlayers||[]),...rows].map(x=>String(x.transfermarktPlayerId)));
const pending=(source.players||[]).filter(x=>x.wikidataId&&x.transfermarktPlayerId&&!known.has(String(x.transfermarktPlayerId)));
const labels=new Map();
(async()=>{
 console.log(`New candidates: ${pending.length}`);
 for(let i=0;i<pending.length;i+=ENTITY_BATCH){
  const batch=pending.slice(i,i+ENTITY_BATCH),entities=await getEntities(batch.map(x=>x.wikidataId),"claims|labels|info"),refs=[];
  for(const x of batch){const e=entities.get(x.wikidataId);for(const prop of ["P27","P413","P54"])for(const c of e?.claims?.[prop]||[]){const q=c?.mainsnak?.datavalue?.value?.id;if(q)refs.push(q);}}
  await resolveLabels(refs,labels);
  for(const x of batch){const v=extractFootballPlayer(entities.get(x.wikidataId),x.transfermarktPlayerId,labels)||{wikidataId:x.wikidataId,transfermarktPlayerId:x.transfermarktPlayerId,invalid:true,checkedAt:new Date().toISOString()};fs.appendFileSync(cp,JSON.stringify(v)+"\n","utf8");}
  console.log(`New enrich: ${Math.min(i+ENTITY_BATCH,pending.length)}/${pending.length}`);await sleep(250);
 }
 const all=loadCp(),pids=new Set((cache.players||[]).map(x=>String(x.transfermarktPlayerId))),iids=new Set((cache.invalidPlayers||[]).map(x=>String(x.transfermarktPlayerId)));
 for(const x of all){const id=String(x.transfermarktPlayerId);if(x.invalid){if(!iids.has(id)){cache.invalidPlayers.push(x);iids.add(id);}}else if(!pids.has(id)){cache.players.push(x);pids.add(id);}}
 cache.generatedAt=new Date().toISOString();cache.count=cache.players.length;cache.invalidCount=cache.invalidPlayers.length;saveGzipJson(cacheFile,cache);fs.rmSync(cp,{force:true});
 console.log(`Cache players=${cache.count} invalid=${cache.invalidCount}`);
})().catch(e=>{console.error(e);process.exitCode=1;});