"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),file=path.join(root,"data","web-data.json");
const d=JSON.parse(fs.readFileSync(file,"utf8"));
const ints=["appearances","goals","assists","minutesPlayed","yellowCards","redCards","nationalCaps","nationalGoals"];
const money=["marketValueInEur","highestMarketValueInEur"];
for(const p of d.players||[]){
  for(const f of ints){const n=Number(p[f]);p[f]=Number.isFinite(n)&&n>=0?Math.trunc(n):0;}
  for(const f of money){const n=Number(p[f]);p[f]=Number.isFinite(n)&&n>=0?Math.trunc(n):0;}
  if(!Array.isArray(p.clubIds))p.clubIds=[];
  if(!Array.isArray(p.careers))p.careers=[];
  if(!Array.isArray(p.teams))p.teams=[];
  if(!Array.isArray(p.honourIds))p.honourIds=[];
  if(!Array.isArray(p.trophyIds))p.trophyIds=[];
  if(!Array.isArray(p.awardIds))p.awardIds=[];
  if(typeof p.statisticsComplete!=="boolean")p.statisticsComplete=false;
  if(!p.statisticsCoverage)p.statisticsCoverage="Wikidata profile; detailed match aggregate unavailable";
  if(!Number.isFinite(Number(p.careerGoals)))p.careerGoals=(p.goals||0)+(p.nationalGoals||0);
}
d.generatedAt=new Date().toISOString();
fs.writeFileSync(file,JSON.stringify(d),"utf8");
console.log(`Normalized players: ${d.players.length}`);