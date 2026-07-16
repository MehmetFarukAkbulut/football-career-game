'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('web verisinde Cristiano Ronaldo kariyerinin beş A takım kulübü bulunur',()=>{const root=path.join(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data','web-data.json'),'utf8')),player=data.players.find(p=>p.id===8198),names=player.clubIds.map(id=>data.clubs.find(c=>c.id===id)?.name);for(const club of ['Sporting CP','Manchester United','Real Madrid','Juventus FC','Al-Nassr Football Club'])assert.ok(names.includes(club),club);});
