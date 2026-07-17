"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "data", "web-data.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR");

// Game-balance overrides: UEFA/EA signals are combined with enduring global and
// Turkish recognition. These are existing dataset records, never new clubs.
const eliteNames = new Set([
  "real madrid", "fc barcelona", "manchester united", "manchester city",
  "liverpool fc", "arsenal fc", "chelsea fc", "fc bayern munich", "bayern munich",
  "paris saint-germain", "juventus fc", "ac milan", "inter milan",
  "atletico de madrid",
].map(normalize));
const popularNames = new Set([
  "borussia dortmund", "tottenham hotspur", "ssc napoli", "as roma",
  "ss lazio", "ajax amsterdam", "psv eindhoven", "feyenoord rotterdam",
  "sl benfica", "fc porto", "sporting cp", "olympique marseille",
  "olympique lyon", "sevilla fc", "valencia cf", "bayer 04 leverkusen",
  "rb leipzig", "galatasaray", "fenerbahce", "besiktas jk",
  "besiktas jimnastik kulubu", "trabzonspor",
].map(normalize));
const topLeagueIds = new Set(["GB1", "ES1", "IT1", "L1", "FR1"]);
const knownLeagueIds = new Set(["TR1", "NL1", "PO1", "BE1", "GB2", "MLS1"]);

const playerCountByClub = new Map();
for (const player of data.players)
  for (const clubId of player.clubIds || [])
    playerCountByClub.set(+clubId, (playerCountByClub.get(+clubId) || 0) + 1);

for (const club of data.clubs) {
  const name = normalize(club.name);
  let score = club.active ? 30 : 8;
  if (topLeagueIds.has(club.leagueId)) score += 25;
  else if (knownLeagueIds.has(club.leagueId)) score += 16;
  if ((club.leagueLevel || 1) > 1) score -= 18;
  score += Math.min(18, Math.log2(1 + (playerCountByClub.get(+club.id) || 0)) * 2.5);
  if (popularNames.has(name)) score = Math.max(score, 76);
  if (eliteNames.has(name)) score = Math.max(score, 91);
  score = Math.max(0, Math.min(100, Math.round(score)));
  club.popularityScore = score;
  club.popularityTier = score >= 88 ? "elite" : score >= 68 ? "popular" : score >= 42 ? "standard" : "obscure";
  club.popularitySources = eliteNames.has(name) || popularNames.has(name)
    ? ["uefa-club-coefficients", "ea-sports-fc-ratings", "editorial-recognition", "dataset-coverage"]
    : ["league-level", "dataset-coverage"];
}

const clubById = new Map(data.clubs.map((club) => [+club.id, club]));
for (const player of data.players) {
  const appearances = Number(player.appearances) || 0;
  const goals = Number(player.careerGoals ?? player.goals) || 0;
  const caps = Number(player.nationalCaps) || 0;
  const value = Number(player.highestMarketValueInEur || player.marketValueInEur) || 0;
  const bestClub = Math.max(0, ...(player.clubIds || []).map((id) => clubById.get(+id)?.popularityScore || 0));
  const score = Math.max(0, Math.min(100, Math.round(
    Math.log10(1 + appearances) * 13 + Math.log10(1 + goals) * 7 +
    Math.log10(1 + caps) * 5 + Math.log10(1 + value / 100000) * 5 + bestClub * 0.22,
  )));
  player.popularityScore = score;
  player.popularityTier = score >= 82 ? "elite" : score >= 64 ? "popular" : score >= 40 ? "standard" : "obscure";
}

data.popularityModel = {
  version: 1,
  assessedAt: "2026-07-17",
  purpose: "Oyun zorluğu dengelemesi; bilimsel veya resmî bir popülerlik sıralaması değildir.",
  sources: ["UEFA club coefficients", "EA Sports FC ratings", "league level", "dataset career coverage", "editorial recognition"],
};

fs.writeFileSync(file, `${JSON.stringify(data)}\n`);
console.log(`Bilinirlik alanları eklendi: ${data.clubs.length} kulüp, ${data.players.length} futbolcu.`);
