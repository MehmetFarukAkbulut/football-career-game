'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {FootballDatabase}=require('../src/main/database');
const {normalizeText}=require('../src/shared/normalize');
const file=path.join(__dirname,'..','data','football.db');

test('aynı isimli Rômulo kariyerleri birbirine karışmaz',()=>{
  const db=new FootballDatabase(file);
  const rows=db.db.prepare("SELECT p.id,GROUP_CONCAT(c.name) clubs FROM players p JOIN player_clubs pc ON pc.player_id=p.id AND pc.verified_first_team=1 JOIN clubs c ON c.id=pc.club_id WHERE p.normalized_name='romulo' GROUP BY p.id").all();
  const italian=rows.find(p=>p.clubs.includes('Juventus')),goztepe=rows.find(p=>p.clubs.includes('Göztepe'));
  assert.ok(italian);assert.ok(goztepe);assert.notEqual(italian.id,goztepe.id);
  assert.ok(!italian.clubs.includes('Göztepe'));assert.ok(!goztepe.clubs.includes('Juventus'));
  const listed=db.travelers(250).filter(p=>normalizeText(p.name)==='romulo');
  assert.ok(listed.every(p=>!(p.clubs.includes('Juventus')&&p.clubs.includes('Göztepe'))));
  db.close();
});

test('futbolcu kataloğu milliyet filtresi, arama, sıralama ve sayfalama uygular',()=>{
  const db=new FootballDatabase(file),filters=db.playerFilters();
  assert.ok(filters.nationalities.length>20);
  const initial=db.playerCatalog({page:1});assert.equal(initial.players.length,100);for(let i=1;i<initial.players.length;i++)assert.ok(initial.players[i-1].appearances>=initial.players[i].appearances);
  const nationality=filters.nationalities.find(x=>x.count>10).nationality;
  const page=db.playerCatalog({nationality,sort:'clubs',page:1,pageSize:12});
  assert.equal(page.players.length,12);assert.ok(page.total>=12);assert.ok(page.players.every(p=>p.nationality===nationality));
  for(let i=1;i<page.players.length;i++)assert.ok(page.players[i-1].clubCount>=page.players[i].clubCount);
  const adebayor=db.playerCatalog({query:'Adebayor',pageSize:12});assert.ok(adebayor.players.some(p=>p.name==='Emmanuel Adebayor'));
  const metz=db.db.prepare("SELECT id FROM clubs WHERE slug='fc-metz'").get(),metzPlayers=db.playerCatalog({clubId:metz.id,pageSize:100});assert.ok(metzPlayers.players.some(p=>p.name==='Emmanuel Adebayor'));
  db.close();
});

test('ülke-kulüp oyunu yalnız cevaplı ve vatandaşlık temelli tur üretir',()=>{
  const db=new FootballDatabase(file),round=db.createCountryRound([],'normal');
  assert.ok(round.players.length>=2);assert.match(round.pairKey,/^country:/);
  assert.ok(round.players.every(p=>p.nationality===round.clubs[0].name));
  const career=db.db.prepare('SELECT COUNT(*) count FROM player_clubs WHERE player_id=? AND club_id=? AND verified_first_team=1').get(round.players[0].id,round.clubs[1].id);
  assert.equal(career.count,1);db.close();
});
