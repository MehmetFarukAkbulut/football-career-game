'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),db=new DatabaseSync(path.join(root,'data','football.db'),{readOnly:true});
const clubs=db.prepare('SELECT id,slug,name,country,league,logo_url logo,active_game_pool active FROM clubs ORDER BY name').all();
const players=db.prepare(`SELECT p.id,p.name,p.normalized_name normalized,p.birth_date birthDate,p.nationality,p.photo_url photo,
  COALESCE(SUM(pc.appearances),0) appearances,GROUP_CONCAT(DISTINCT pc.club_id) clubIds
  FROM players p JOIN player_clubs pc ON pc.player_id=p.id AND pc.verified_first_team=1
  GROUP BY p.id,p.name,p.normalized_name,p.birth_date,p.nationality,p.photo_url`).all().map(p=>({...p,clubIds:p.clubIds.split(',').map(Number)}));
const payload={version:2,generatedAt:new Date().toISOString(),clubs,players};
fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data','web-data.json'),JSON.stringify(payload));
db.close();console.log(`Web verisi: ${clubs.length} kulüp, ${players.length} oyuncu, ${(fs.statSync(path.join(root,'data','web-data.json')).size/1024/1024).toFixed(1)} MB`);
