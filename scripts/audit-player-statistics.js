"use strict";
const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, ".."), dataDir = path.join(root, "data"),
  queueFile = path.join(dataDir, "players-needs-review.txt"),
  auditFile = path.join(dataDir, "player-stat-audit.json");
const limit = Math.max(1, +(process.argv.find((x) => x.startsWith("--limit=")) || "--limit=10").split("=")[1]);
const concurrency = Math.max(1, +(process.argv.find((x) => x.startsWith("--concurrency=")) || "--concurrency=1").split("=")[1]);
const existing = fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, "utf8")) : {};
const queue = fs.readFileSync(queueFile, "utf8").trim().split(/\r?\n/).slice(1)
  .map((line) => { const [id, name] = line.split("\t"); return { id: +id, name }; })
  .filter((player) => !existing[player.id]).slice(0, limit);
const headers = { Accept: "application/json", "Accept-Language": "en-US", "User-Agent": "IkiFormaDataAudit/1.0" };
async function audit(player) {
  const response = await fetch(`https://tmapi.transfermarkt.technology/player/${player.id}/performance-game`, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json(), games = payload?.data?.performance;
  if (!Array.isArray(games) || !games.length) throw new Error("Performans kaydi yok");
  const stats = { appearances: 0, goals: 0, assists: 0, minutesPlayed: 0 }, clubs = new Map();
  for (const game of games) {
    if (game.gameInformation?.isNationalGame || [11, 17, 19, 20].includes(game.gameInformation?.competitionTypeId)) continue;
    if (game.statistics?.generalStatistics?.participationState !== "played") continue;
    stats.appearances++;
    stats.goals += game.statistics.goalStatistics?.goalsScoredTotalOfficial ?? game.statistics.goalStatistics?.goalsScoredTotal ?? 0;
    stats.assists += game.statistics.goalStatistics?.assistsOfficial ?? game.statistics.goalStatistics?.assists ?? 0;
    stats.minutesPlayed += game.statistics.playingTimeStatistics?.playedMinutes || 0;
    const clubId = +game.clubsInformation?.club?.clubId;
    if (clubId) clubs.set(clubId, (clubs.get(clubId) || 0) + 1);
  }
  if (!stats.appearances || !clubs.size) throw new Error("Kulup kariyeri ayrıştırılamadı");
  return { id: player.id, name: player.name, verifiedAt: new Date().toISOString(), source: response.url,
    ...stats, clubIds: [...clubs.keys()], clubAppearances: Object.fromEntries(clubs), status: "verified" };
}
(async () => {
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const player = queue[cursor++];
      try { existing[player.id] = await audit(player); console.log("OK", player.id, player.name, existing[player.id].appearances, existing[player.id].goals); }
      catch (error) { existing[player.id] = { id: player.id, name: player.name, checkedAt: new Date().toISOString(), status: "error", reason: error.message }; console.error("ERR", player.id, player.name, error.message); }
      fs.writeFileSync(auditFile, JSON.stringify(existing, null, 2));
      await new Promise((resolve) => setTimeout(resolve, concurrency === 1 ? 750 : 100));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`Denetim kaydi: ${Object.keys(existing).length}; bu tur: ${queue.length}`);
})();
