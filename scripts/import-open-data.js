'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),readline=require('readline');
const {DatabaseSync}=require('node:sqlite');
const {normalizeText}=require('../src/shared/normalize');
const root=path.resolve(__dirname,'..'),cache=path.join(root,'data','import-cache');
const dbFile=process.env.IKI_FORMA_DB||path.join(root,'data','football.db');
const SOURCE='dcaribou/transfermarkt-datasets appearances';
const leagues={GB1:['Premier League','İngiltere'],ES1:['LaLiga','İspanya'],IT1:['Serie A','İtalya'],L1:['Bundesliga','Almanya'],FR1:['Ligue 1','Fransa'],TR1:['Süper Lig','Türkiye']};
// Only documented source-id mappings are allowed. Similar names never establish identity.
const canonicalClubOverrides={'5':'milan','36':'fenerbahce','46':'inter','114':'besiktas','131':'barcelona','141':'galatasaray','418':'real-madrid','449':'trabzonspor','583':'paris-saint-germain'};

function csv(line){const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(char===','&&!quoted){out.push(value);value='';}else value+=char;}out.push(value);return out;}
async function rows(name,onRow){const input=fs.createReadStream(path.join(cache,`${name}.csv.gz`)).pipe(zlib.createGunzip());const rl=readline.createInterface({input,crlfDelay:Infinity});let header;for await(const line of rl){const values=csv(line);if(!header){header=values;continue;}const row={};for(let i=0;i<header.length;i++)row[header[i]]=values[i];onRow(row);}}
function slug(value){return normalizeText(value).replace(/\s+/g,'-');}

async function main(){
  for(const file of ['clubs','players','appearances'])if(!fs.existsSync(path.join(cache,`${file}.csv.gz`)))throw new Error(`${file}.csv.gz eksik. README'deki açık veri indirme adımını uygulayın.`);
  const sourceClubs=[];await rows('clubs',row=>{if(leagues[row.domestic_competition_id])sourceClubs.push(row);});
  const clubExternalIds=new Set(sourceClubs.map(c=>c.club_id)),careerMap=new Map(),neededPlayers=new Set();let appearanceRows=0;
  await rows('appearances',row=>{if(!clubExternalIds.has(row.player_club_id))return;const key=`${row.player_id}:${row.player_club_id}`;const current=careerMap.get(key)||{playerExternalId:row.player_id,clubExternalId:row.player_club_id,start:row.date,end:row.date,appearances:0};if(row.date<current.start)current.start=row.date;if(row.date>current.end)current.end=row.date;current.appearances++;careerMap.set(key,current);neededPlayers.add(row.player_id);appearanceRows++;});
  const sourcePlayers=new Map();await rows('players',row=>sourcePlayers.set(row.player_id,row));
  const db=new DatabaseSync(dbFile);db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
  try{
    const leagueInsert=db.prepare('INSERT OR IGNORE INTO leagues(name,country,tier,active) VALUES(?,?,1,1)');
    const addClub=db.prepare("INSERT INTO clubs(slug,name,normalized_name,country,league,league_id,aliases_json,external_ids_json,active_game_pool) VALUES(?,?,?,?,?,(SELECT id FROM leagues WHERE name=? AND country=?),'[]',?,?)");
    const updateClub=db.prepare("UPDATE clubs SET country=?,league=?,league_id=(SELECT id FROM leagues WHERE name=? AND country=?),external_ids_json=json_set(external_ids_json,'$.transfermarkt',?),active_game_pool=? WHERE id=?");
    const maxSeason={};for(const c of sourceClubs)maxSeason[c.domestic_competition_id]=Math.max(maxSeason[c.domestic_competition_id]||0,Number(c.last_season)||0);
    const clubIds=new Map(),skippedClubs=[];
    for(const c of sourceClubs){
      const [league,country]=leagues[c.domestic_competition_id];leagueInsert.run(league,country);
      const clubSlug=c.club_code||slug(c.name),normalized=normalizeText(c.name),override=canonicalClubOverrides[c.club_id],active=Number(c.last_season)===maxSeason[c.domestic_competition_id]?1:0;
      const existing=db.prepare('SELECT id,slug,name,normalized_name,aliases_json,external_ids_json FROM clubs').all();
      const externalMatch=existing.find(x=>String(JSON.parse(x.external_ids_json||'{}').transfermarkt)===String(c.club_id));
      const overrideMatch=override&&existing.find(x=>x.slug===override);
      const exactMatches=existing.filter(x=>x.slug===clubSlug||x.normalized_name===normalized||JSON.parse(x.aliases_json||'[]').map(normalizeText).includes(normalized));
      let id=externalMatch?.id||overrideMatch?.id;
      if(!id&&exactMatches.length===1)id=exactMatches[0].id;
      if(!id&&exactMatches.length>1){skippedClubs.push(`${c.club_id}:${c.name} (birden fazla kesin aday)`);continue;}
      if(id)updateClub.run(country,league,league,country,c.club_id,active,id);
      else id=Number(addClub.run(clubSlug,c.name,normalized,country,league,league,country,JSON.stringify({transfermarkt:c.club_id}),active).lastInsertRowid);
      clubIds.set(c.club_id,id);
    }
    const addPlayer=db.prepare("INSERT INTO players(name,normalized_name,birth_date,nationality,photo_url,external_ids_json) VALUES(?,?,?,?,?,?)");
    const updatePlayer=db.prepare("UPDATE players SET birth_date=COALESCE(birth_date,?),nationality=COALESCE(nationality,?),photo_url=COALESCE(photo_url,?),external_ids_json=json_set(external_ids_json,'$.transfermarkt',?) WHERE id=?");
    const existingPlayers=db.prepare('SELECT id,normalized_name,external_ids_json FROM players').all(),nameCandidates=new Map(),byExternal=new Map();for(const p of existingPlayers){const external=JSON.parse(p.external_ids_json||'{}').transfermarkt;if(external)byExternal.set(String(external),p.id);else{nameCandidates.set(p.normalized_name,[...(nameCandidates.get(p.normalized_name)||[]),p.id]);}}
    const playerIds=new Map();for(const [externalId,p] of sourcePlayers){const normalized=normalizeText(p.name),externalKey=String(externalId),exact=nameCandidates.get(normalized)||[];let id=byExternal.get(externalKey);if(!id&&exact.length===1){id=exact[0];nameCandidates.delete(normalized);}if(id)updatePlayer.run(p.date_of_birth?.slice(0,10)||null,p.country_of_citizenship||null,p.image_url||null,externalId,id);else id=Number(addPlayer.run(p.name,normalized,p.date_of_birth?.slice(0,10)||null,p.country_of_citizenship||null,p.image_url||null,JSON.stringify({transfermarkt:externalId})).lastInsertRowid);byExternal.set(externalKey,id);playerIds.set(externalId,id);}
    db.prepare(`DELETE FROM player_clubs WHERE data_source=?`).run(SOURCE);
    const addCareer=db.prepare('INSERT OR REPLACE INTO player_clubs(player_id,club_id,start_date,end_date,appearances,data_source,confidence,verified_first_team) VALUES(?,?,?,?,?,?,1,1)');let careers=0;
    for(const career of careerMap.values()){const playerId=playerIds.get(career.playerExternalId),clubId=clubIds.get(career.clubExternalId);if(!playerId||!clubId)continue;addCareer.run(playerId,clubId,career.start,career.end,career.appearances,SOURCE);careers++;}
    db.prepare('INSERT OR REPLACE INTO data_sources(name,license,last_sync_at,source_url) VALUES(?,?,?,?)').run(SOURCE,'CC0 1.0',new Date().toISOString(),'https://github.com/dcaribou/transfermarkt-datasets');
    db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES('updated_at',?)").run(new Date().toISOString());
    db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES('version',?)").run('2.1-open-appearances');
    db.exec('COMMIT; PRAGMA optimize');console.log({clubs:clubIds.size,players:playerIds.size,careers,appearanceRows,skippedClubs});
  }catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
