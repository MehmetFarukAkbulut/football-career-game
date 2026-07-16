'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { normalizeText } = require('../src/shared/normalize');
const root = path.resolve(__dirname,'..');
const dbFile = process.env.IKI_FORMA_DB || path.join(root,'data','football.db');
const clubs = JSON.parse(fs.readFileSync(path.join(root,'data','clubs.json'),'utf8'));
const careers = JSON.parse(fs.readFileSync(path.join(root,'data','seed-careers.json'),'utf8'));
fs.mkdirSync(path.dirname(dbFile),{recursive:true});
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
const db = new DatabaseSync(dbFile);
db.exec(fs.readFileSync(path.join(root,'data','schema.sql'),'utf8'));
const leagueInsert=db.prepare('INSERT OR IGNORE INTO leagues(name,country,tier,active) VALUES(?,?,1,1)');
const clubInsert=db.prepare('INSERT INTO clubs(slug,name,normalized_name,country,league,league_id,logo_url,wikidata_id,aliases_json,active_game_pool) VALUES(?,?,?,?,?,(SELECT id FROM leagues WHERE name=? AND country=?),?,?,?,1)');
const clubIds=new Map();
db.exec('BEGIN');
for(const c of clubs){leagueInsert.run(c.league,c.country);const aliases=(c.aliases||[]).map(normalizeText);const r=clubInsert.run(c.slug,c.name,normalizeText(c.name),c.country,c.league,c.league,c.country,c.logo||null,c.wikidataId,JSON.stringify(aliases));clubIds.set(c.slug,Number(r.lastInsertRowid));}
const playerInsert=db.prepare('INSERT INTO players(name,normalized_name) VALUES(?,?)');
const careerInsert=db.prepare("INSERT OR IGNORE INTO player_clubs(player_id,club_id,start_date,end_date,appearances,data_source,confidence,verified_first_team) VALUES(?,?,?,?,NULL,'curated-baseline',0.95,1)");
const playerIds=new Map();
for(const [name,slug,start,end] of careers){if(!playerIds.has(name)){const r=playerInsert.run(name,normalizeText(name));playerIds.set(name,Number(r.lastInsertRowid));}careerInsert.run(playerIds.get(name),clubIds.get(slug),start,end);}
db.prepare('INSERT INTO data_sources(name,license,last_sync_at,source_url) VALUES(?,?,?,?)').run('curated-baseline','Facts are not copyrightable; records manually verified against public career histories',new Date().toISOString(),'bundled');
db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('version','2.0-baseline');
db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('updated_at',new Date().toISOString());
db.exec('COMMIT; PRAGMA optimize;');
const counts={clubs:db.prepare('SELECT COUNT(*) n FROM clubs').get().n,players:db.prepare('SELECT COUNT(*) n FROM players').get().n,careers:db.prepare('SELECT COUNT(*) n FROM player_clubs').get().n};
db.close(); console.log(`Veritabanı oluşturuldu: ${dbFile}`); console.log(counts);
