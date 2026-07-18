"use strict";
const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, ".."), source = path.join(root, "data", "web-data.json");
const data = JSON.parse(fs.readFileSync(source, "utf8"));
const clubIds = new Set(data.clubs.map((club) => +club.id)), playerIds = new Set(), tmIds = new Set();
const counts = { players: data.players.length, clubs: data.clubs.length, errors: 0, warnings: 0 };
const issues = [];
function report(level, code, player, detail) { counts[level === "error" ? "errors" : "warnings"]++; if (issues.length < 500) issues.push({ level, code, playerId: player?.id ?? null, name: player?.name ?? null, detail }); }
for (const player of data.players) {
  const id = +player.id, tmId = +player.transfermarktPlayerId;
  if (!Number.isInteger(id) || id <= 0) report("error", "INVALID_PLAYER_ID", player);
  if (playerIds.has(id)) report("error", "DUPLICATE_PLAYER_ID", player); playerIds.add(id);
  if (!player.name?.trim()) report("error", "MISSING_NAME", player);
  if (!Number.isInteger(tmId) || tmId <= 0 || tmId !== id) report("error", "TRANSFERMARKT_ID_MISMATCH", player, player.transfermarktPlayerId);
  if (tmIds.has(tmId)) report("error", "DUPLICATE_TRANSFERMARKT_ID", player); tmIds.add(tmId);
  if (!/^https?:\/\//.test(player.transfermarktUrl || "")) report("warning", "MISSING_TRANSFERMARKT_URL", player);
  if (!player.nationality?.trim()) report("warning", "MISSING_NATIONALITY", player);
  if (!/^[A-Z]{2}$/.test(player.nationalityCode || "")) report("warning", "INVALID_NATIONALITY_CODE", player, player.nationalityCode);
  if (player.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(player.birthDate)) report("warning", "INVALID_BIRTH_DATE", player, player.birthDate);
  if (!/^https?:\/\//.test(player.photo || "")) report("warning", "MISSING_PHOTO", player);
  if (!Array.isArray(player.clubIds) || !player.clubIds.length) report("error", "MISSING_CAREER", player);
  if (new Set((player.clubIds || []).map(Number)).size !== (player.clubIds || []).length) report("error", "DUPLICATE_CLUB_CAREER", player);
  // Kaynak kulup katalog kesitinde olmayan tarihsel kariyerleri uyarida tut.
  for (const clubId of player.clubIds || []) if (!clubIds.has(+clubId)) report("warning", "HISTORIC_CLUB_NOT_IN_CATALOG", player, clubId);
  for (const career of player.careers || []) {
    if (!career.firstTeam) report("error", "NON_FIRST_TEAM_CAREER", player, career.clubId);
  }
  for (const field of ["appearances", "goals", "assists", "minutesPlayed", "yellowCards", "redCards", "nationalCaps", "nationalGoals"])
    if (!Number.isFinite(Number(player[field])) || Number(player[field]) < 0) report("warning", "INVALID_STAT", player, field);
}
const reportFile = path.join(root, "data", "player-data-audit.json");
fs.writeFileSync(reportFile, JSON.stringify({ auditedAt: new Date().toISOString(), sourceVersion: data.version, source: data.source, counts, issueLimit: 500, issues }, null, 2) + "\n");
console.log(`Denetim: ${counts.players} oyuncu, ${counts.clubs} kulüp, ${counts.errors} hata, ${counts.warnings} uyarı.`);
if (counts.errors) process.exitCode = 1;
