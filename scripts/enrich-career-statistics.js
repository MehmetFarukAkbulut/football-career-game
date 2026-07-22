"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  readline = require("node:readline");
const root = path.resolve(__dirname, ".."),
  cache = path.join(root, "data", "import-cache"),
  webFile = path.join(root, "data", "web-data.json"),
  historyFile = path.join(cache, "player_performances_full.csv");

function csv(line) {
  const out = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { out.push(value); value = ""; }
    else value += char;
  }
  out.push(value);
  return out;
}
async function rows(file, zipped, onRow) {
  const input = zipped
    ? fs.createReadStream(file).pipe(zlib.createGunzip())
    : fs.createReadStream(file);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let header;
  for await (const line of rl) {
    const values = csv(line);
    if (!header) { header = values; continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = values[i];
    onRow(row);
  }
}
const empty = () => ({ appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 });
const slug = (value) => String(value || "club")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const add = (target, row) => {
  target.appearances += +row.appearances || +row.nb_on_pitch || 0;
  target.goals += +row.goals || 0;
  target.assists += +row.assists || 0;
  target.yellowCards += +row.yellowCards || +row.yellow_cards || 0;
  target.redCards += +row.redCards || (+row.second_yellow_cards || 0) + (+row.direct_red_cards || +row.red_cards || 0);
};
const mergeMax = (a, b) => ({
  appearances: Math.max(a.appearances, b.appearances),
  goals: Math.max(a.goals, b.goals),
  assists: Math.max(a.assists, b.assists),
  yellowCards: Math.max(a.yellowCards, b.yellowCards),
  redCards: Math.max(a.redCards, b.redCards),
});

async function main() {
  if (!fs.existsSync(historyFile)) throw new Error("Tam tarihsel performans dosyasi eksik");
  const data = JSON.parse(fs.readFileSync(webFile, "utf8")),
    wanted = new Set(data.players.map((p) => String(p.id))),
    historical = new Map(), currentHistory = new Map(),
    playerClubs = new Map(), teams = new Map();
  await rows(historyFile, false, (row) => {
    if (!wanted.has(row.player_id)) return;
    const clubId = +row.team_id;
    if (clubId) {
      const set = playerClubs.get(row.player_id) || new Set();
      set.add(clubId); playerClubs.set(row.player_id, set);
      if (!teams.has(clubId)) teams.set(clubId, {
        name: row.team_name || `Kulüp ${clubId}`,
        league: row.competition_name || "Lig bilgisi bilinmiyor",
        leagueId: row.competition_id || "UNKNOWN",
      });
    }
    const current = row.season_name === "25/26" || row.season_name === "2025" || row.season_name === "2026";
    const key = `${row.player_id}:${row.season_name}:${row.competition_id}:${row.team_id}`;
    const map = current ? currentHistory : historical;
    const stats = map.get(key) || empty(); add(stats, row); map.set(key, stats);
  });
  const games = new Map();
  await rows(path.join(cache, "games.csv.gz"), true, (row) => {
    if (+row.season >= 2025 && row.competition_type !== "national_team_competition")
      games.set(row.game_id, row);
  });
  const currentOpen = new Map();
  await rows(path.join(cache, "appearances.csv.gz"), true, (row) => {
    if (!wanted.has(row.player_id)) return;
    const game = games.get(row.game_id); if (!game) return;
    const clubId = +row.player_club_id;
    if (clubId) {
      const set = playerClubs.get(row.player_id) || new Set();
      set.add(clubId); playerClubs.set(row.player_id, set);
      if (!teams.has(clubId)) {
        const name = +game.home_club_id === clubId ? game.home_club_name : game.away_club_name;
        teams.set(clubId, { name: name || `Kulüp ${clubId}`, league: row.competition_id, leagueId: row.competition_id });
      }
    }
    const shortSeason = `${String(+game.season).slice(-2)}/${String(+game.season + 1).slice(-2)}`;
    const candidates = [
      `${row.player_id}:${shortSeason}:${row.competition_id}:${row.player_club_id}`,
      `${row.player_id}:${game.season}:${row.competition_id}:${row.player_club_id}`,
    ];
    const key = candidates.find((x) => currentHistory.has(x)) || candidates[0];
    const stats = currentOpen.get(key) || empty();
    add(stats, { appearances: 1, ...row }); currentOpen.set(key, stats);
  });
  const totals = new Map();
  for (const [key, stats] of historical) {
    const id = key.split(":", 1)[0], total = totals.get(id) || empty(); add(total, stats); totals.set(id, total);
  }
  const currentKeys = new Set([...currentHistory.keys(), ...currentOpen.keys()]);
  for (const key of currentKeys) {
    const stats = mergeMax(currentHistory.get(key) || empty(), currentOpen.get(key) || empty()),
      id = key.split(":", 1)[0], total = totals.get(id) || empty();
    add(total, stats); totals.set(id, total);
  }
  for (const player of data.players) {
    const stats = totals.get(String(player.id));
    if (!stats) {
      player.statisticsComplete = false;
      player.statisticsCoverage = "Weekly match dataset only; historical aggregate unavailable";
      continue;
    }
    Object.assign(player, stats, {
      statisticsComplete: true,
      statisticsCoverage: "Transfermarkt club career; current season reconciled",
    });
  }
  const auditFile = path.join(root, "data", "player-stat-audit.json");
  const audits = fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, "utf8")) : {};
  for (const player of data.players) {
    const audit = audits[player.id];
    if (!audit || audit.status !== "verified") continue;
    Object.assign(player, {
      appearances: audit.appearances, goals: audit.goals, assists: audit.assists,
      minutesPlayed: audit.minutesPlayed, statisticsComplete: true,
      statisticsCoverage: `Live Transfermarkt game audit ${audit.verifiedAt}`,
    });
    const ids = playerClubs.get(String(player.id)) || new Set();
    for (const clubId of audit.clubIds) ids.add(+clubId);
    playerClubs.set(String(player.id), ids);
  }
  const knownClubs = new Set(data.clubs.map((club) => +club.id));
  for (const [id, team] of teams) {
    if (knownClubs.has(id)) continue;
    data.clubs.push({
      id, clubId: id, slug: `${slug(team.name)}-${id}`,
      name: team.name, clubName: team.name,
      country: "Bilinmiyor", countryName: "Bilinmiyor", countryCode: "UN",
      league: team.league, leagueId: team.leagueId, leagueLevel: null,
      logo: `https://tmssl.akamaized.net/images/wappen/head/${id}.png`,
      logoAsset: `https://tmssl.akamaized.net/images/wappen/head/${id}.png`,
      logoSource: "transfermarkt-cdn", transfermarktClubId: id,
      transfermarktUrl: `https://www.transfermarkt.com/verein/startseite/verein/${id}`,
      active: false,
    });
    knownClubs.add(id);
  }
  for (const player of data.players) {
    const ids = playerClubs.get(String(player.id));
    if (!ids) continue;
    const merged = new Set([...(player.clubIds || []), ...ids]);
    player.clubIds = [...merged];
    const careerIds = new Set((player.careers || []).map((career) => +career.clubId));
    player.careers = player.careers || [];
    for (const clubId of ids) if (!careerIds.has(clubId)) player.careers.push({
      clubId, startDate: null, endDate: null, firstTeam: true,
    });
  }
  const goalOverrides = JSON.parse(fs.readFileSync(path.join(root, "data", "career-goal-overrides.json"), "utf8")),
    goalOverrideMap = new Map(goalOverrides.map((row) => [+row.playerId, row]));
  for (const player of data.players) {
    const override = goalOverrideMap.get(+player.id);
    player.careerGoals = override?.careerGoals ?? (player.goals || 0) + (player.nationalGoals || 0);
    player.careerGoalsSource = override?.source || "Club goals plus senior national-team goals";
    player.careerGoalsAsOf = override?.asOf || null;
  }
  data.version = 6;
  data.generatedAt = new Date().toISOString();
  data.statistics = {
    sourceUrl: "https://www.transfermarkt.com/",
    scope: "Club career totals by season, competition and club; current season reconciled with weekly match records",
    unavailableFields: ["nationalAssists", "completeCareerMinutes"],
  };
  fs.writeFileSync(webFile, JSON.stringify(data));
  const sorted = [...data.players].sort(
  (a, b) =>
    (Number(b.careerGoals) || 0) -
      (Number(a.careerGoals) || 0) ||
    String(a.name || a.playerName || "")
      .localeCompare(
        String(b.name || b.playerName || ""),
        "tr"
      )
);
  const header = "transfermarkt_id\tfutbolcu\tgol\tmac\tistatistik_durumu\tkulup_sayisi\taciklama";
  const line = (p) => [p.id, p.name, p.careerGoals, p.appearances,
    p.statisticsComplete ? "GUNCEL" : "EKSIK",
    p.clubIds.length, p.statisticsCoverage].join("\t");
  fs.writeFileSync(path.join(root, "data", "players-current.txt"),
    [header, ...sorted.filter((p) => p.statisticsComplete).map(line)].join("\n") + "\n");
  fs.writeFileSync(path.join(root, "data", "players-needs-review.txt"),
    [header, ...sorted.filter((p) => !p.statisticsComplete).map(line)].join("\n") + "\n");
  console.log(`Tam kariyer istatistikleri: ${totals.size} futbolcu`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
