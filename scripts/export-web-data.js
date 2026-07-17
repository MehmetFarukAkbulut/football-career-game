"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  readline = require("node:readline");
const countries = require("i18n-iso-countries");
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));
countries.registerLocale(require("i18n-iso-countries/langs/tr.json"));
const { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = path.join(root, "data", "import-cache");
function csv(line) {
  const out = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(value);
      value = "";
    } else value += char;
  }
  out.push(value);
  return out;
}
async function rows(name, onRow) {
  const rl = readline.createInterface({
    input: fs
      .createReadStream(path.join(cache, `${name}.csv.gz`))
      .pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  let header;
  for await (const line of rl) {
    const values = csv(line);
    if (!header) {
      header = values;
      continue;
    }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = values[i];
    onRow(row);
  }
}
const leagueNames = {
  GB1: ["Premier League", "England"],
  ES1: ["LaLiga", "Spain"],
  IT1: ["Serie A", "Italy"],
  L1: ["Bundesliga", "Germany"],
  FR1: ["Ligue 1", "France"],
  TR1: ["Süper Lig", "Turkey"],
  PO1: ["Liga Portugal", "Portugal"],
  NL1: ["Eredivisie", "Netherlands"],
  BE1: ["Pro League", "Belgium"],
  SC1: ["Premiership", "Scotland"],
  GR1: ["Super League", "Greece"],
  SA1: ["Suudi Pro Ligi", "Saudi Arabia"],
  BRA1: ["Série A", "Brazil"],
  ARG1: ["Profesyonel Lig", "Argentina"],
  MLS1: ["MLS", "United States"],
  UKR1: ["Premier Lig", "Ukraine"],
  RU1: ["Premier Lig", "Russia"],
  DK1: ["Superliga", "Denmark"],
  A1: ["Bundesliga", "Austria"],
  AUS1: ["A-League", "Australia"],
  C1: ["Süper Lig", "Switzerland"],
  COL1: ["Primera A", "Colombia"],
  JAP1: ["J1 Ligi", "Japan"],
  KR1: ["HNL", "Croatia"],
  MEX1: ["Liga MX", "Mexico"],
  NO1: ["Eliteserien", "Norway"],
  PL1: ["Ekstraklasa", "Poland"],
  RO1: ["Liga 1", "Romania"],
  RSK1: ["K Ligi 1", "South Korea"],
  SE1: ["Allsvenskan", "Sweden"],
  SER1: ["Sırbistan Süper Ligi", "Serbia"],
  TS1: ["Çekya Birinci Ligi", "Czech Republic"],
};
const countryAliases = {
  Turkey: "Türkiye",
  Türkiye: "Türkiye",
  England: "İngiltere",
  Scotland: "İskoçya",
  Wales: "Galler",
  "Northern Ireland": "Kuzey İrlanda",
  "Bosnia-Herzegovina": "Bosna-Hersek",
  "Cape Verde": "Yeşil Burun Adaları",
  "Chinese Taipei": "Tayvan",
  Curacao: "Curaçao",
  "DR Congo": "Kongo Demokratik Cumhuriyeti",
  "Korea, North": "Kuzey Kore",
  "Korea, South": "Güney Kore",
  "Saint-Martin": "Saint Martin",
};
const trCountry = (input) => {
  if (!input) return null;
  const value = String(input).trim();
  if (countryAliases[value]) return countryAliases[value];
  const code = countries.getAlpha2Code(value, "en");
  return code ? countries.getName(code, "tr") : value;
};
const countryCode = (input) =>
  ({ England: "GB", Scotland: "GB", Wales: "GB", "Northern Ireland": "GB" })[
    input
  ] || countries.getAlpha2Code(input, "en") || null;
async function main() {
  for (const name of ["clubs", "players", "appearances"])
    if (!fs.existsSync(path.join(cache, `${name}.csv.gz`)))
      throw new Error(`${name}.csv.gz bulunamadı`);
  const clubRows = [],
    maxSeason = {};
  await rows("clubs", (c) => {
    clubRows.push(c);
    maxSeason[c.domestic_competition_id] = Math.max(
      maxSeason[c.domestic_competition_id] || 0,
      +c.last_season || 0,
    );
  });
  const curatedClubs = JSON.parse(
    fs.readFileSync(path.join(root, "data", "clubs.json"), "utf8"),
  );
  const curatedBySlug = new Map(curatedClubs.map((club) => [club.slug, club]));
  const clubs = clubRows.map((c) => {
      const meta = leagueNames[c.domestic_competition_id] || [
        c.domestic_competition_id,
        c.domestic_competition_id,
      ];
      const code = countryCode(meta[1]);
      const curated = curatedBySlug.get(c.club_code);
      const fallbackLogo = `https://tmssl.akamaized.net/images/wappen/head/${+c.club_id}.png`;
      return {
        id: +c.club_id,
        clubId: +c.club_id,
        slug: c.club_code,
        name: c.name,
        clubName: c.name,
        country: trCountry(meta[1]),
        countryName: trCountry(meta[1]),
        countryCode: code,
        league: meta[0],
        leagueId: c.domestic_competition_id,
        leagueLevel: 1,
        logo: curated?.logo || fallbackLogo,
        logoAsset: curated?.logo || fallbackLogo,
        logoSource: curated?.logo ? "curated" : "transfermarkt-cdn",
        transfermarktClubId: +c.club_id,
        transfermarktUrl: c.url || null,
        active: +c.last_season === maxSeason[c.domestic_competition_id],
      };
    }),
    clubIds = new Set(clubs.map((c) => c.id));
  const profiles = new Map();
  await rows("players", (p) =>
    profiles.set(+p.player_id, {
      id: +p.player_id,
      playerId: +p.player_id,
      name: p.name,
      playerName: p.name,
      normalized: p.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
      birthDate: p.date_of_birth?.slice(0, 10) || null,
      nationality: trCountry(p.country_of_citizenship),
      nationalityCode: countryCode(p.country_of_citizenship),
      photo: p.image_url || null,
      imageUrl: p.image_url || null,
      imageAsset: null,
      transfermarktPlayerId: +p.player_id,
      transfermarktUrl: p.url || null,
      appearances: 0,
      goals: 0,
      assists: 0,
      minutesPlayed: 0,
      yellowCards: 0,
      redCards: 0,
      nationalCaps: +p.international_caps || 0,
      nationalGoals: +p.international_goals || 0,
      nationalAssists: null,
      marketValueInEur: p.market_value_in_eur && Number.isFinite(+p.market_value_in_eur)
        ? +p.market_value_in_eur
        : null,
      highestMarketValueInEur:
        p.highest_market_value_in_eur &&
        Number.isFinite(+p.highest_market_value_in_eur)
        ? +p.highest_market_value_in_eur
        : null,
      clubIds: [],
    }),
  );
  const careers = new Map();
  await rows("appearances", (a) => {
    const pid = +a.player_id,
      cid = +a.player_club_id;
    if (!profiles.has(pid) || !clubIds.has(cid)) return;
    const key = `${pid}:${cid}`,
      career = careers.get(key) || {
        appearances: 0,
        goals: 0,
        assists: 0,
        minutesPlayed: 0,
        yellowCards: 0,
        redCards: 0,
        startDate: null,
        endDate: null,
      };
    career.appearances++;
    career.goals += +a.goals || 0;
    career.assists += +a.assists || 0;
    career.minutesPlayed += +a.minutes_played || 0;
    career.yellowCards += +a.yellow_cards || 0;
    career.redCards += +a.red_cards || 0;
    const date = a.date?.slice(0, 10) || null;
    if (date && (!career.startDate || date < career.startDate))
      career.startDate = date;
    if (date && (!career.endDate || date > career.endDate))
      career.endDate = date;
    careers.set(key, career);
  });
  // Keep manually audited careers (for example Adebayor–Metz) by exact Transfermarkt IDs.
  const db = new DatabaseSync(path.join(root, "data", "football.db"), {
    readOnly: true,
  });
  for (const row of db
    .prepare(
      `SELECT json_extract(p.external_ids_json,'$.transfermarkt') playerId,json_extract(c.external_ids_json,'$.transfermarkt') clubId,COALESCE(pc.appearances,0) appearances FROM player_clubs pc JOIN players p ON p.id=pc.player_id JOIN clubs c ON c.id=pc.club_id WHERE pc.verified_first_team=1`,
    )
    .all()) {
    const pid = +row.playerId,
      cid = +row.clubId;
    if (pid && cid && profiles.has(pid) && clubIds.has(cid)) {
      const key = `${pid}:${cid}`,
        career = careers.get(key) || { appearances: 0, goals: 0, assists: 0 };
      career.appearances = Math.max(career.appearances, +row.appearances || 0);
      careers.set(key, career);
    }
  }
  db.close();
  const overrides = JSON.parse(
    fs.readFileSync(
      path.join(root, "data", "web-career-overrides.json"),
      "utf8",
    ),
  );
  for (const row of overrides) {
    if (!profiles.has(+row.playerId) || !clubIds.has(+row.clubId))
      throw new Error(
        `Geçersiz denetimli kariyer: ${row.player} — ${row.club}`,
      );
    careers.set(
      `${+row.playerId}:${+row.clubId}`,
      careers.get(`${+row.playerId}:${+row.clubId}`) || {
        appearances: 0,
        goals: 0,
        assists: 0,
      },
    );
  }
  for (const [key, stats] of careers) {
    const [pid, cid] = key.split(":").map(Number),
      p = profiles.get(pid);
    p.clubIds.push(cid);
    p.appearances += stats.appearances;
    p.goals += stats.goals;
    p.assists += stats.assists;
    p.minutesPlayed += stats.minutesPlayed || 0;
    p.yellowCards += stats.yellowCards || 0;
    p.redCards += stats.redCards || 0;
    if (!p.careers) p.careers = [];
    p.careers.push({
      clubId: cid,
      startDate: stats.startDate || null,
      endDate: stats.endDate || null,
      firstTeam: true,
    });
  }
  const players = [...profiles.values()]
    .filter((p) => p.clubIds.length)
    .map((p) => ({ ...p, clubIds: [...new Set(p.clubIds)] }));
  const leagues = Object.entries(leagueNames).map(([id, meta]) => ({
    id,
    name: meta[0],
    countryCode: countryCode(meta[1]),
    countryName: trCountry(meta[1]),
    flagAsset: null,
    level: 1,
    logoAsset: null,
  }));
  const payload = {
    version: 5,
    generatedAt: new Date().toISOString(),
    source: "dcaribou/transfermarkt-datasets (CC0-1.0)",
    statistics: {
      sourceUrl: "https://github.com/dcaribou/transfermarkt-datasets",
      scope: "Available first-team match appearances in the source dataset",
      unavailableFields: ["nationalAssists"],
    },
    leagues,
    clubs,
    players,
  };
  fs.writeFileSync(
    path.join(root, "data", "web-data.json"),
    JSON.stringify(payload),
  );
  console.log(
    `Web verisi: ${clubs.length} kulüp, ${players.length} oyuncu, ${(fs.statSync(path.join(root, "data", "web-data.json")).size / 1024 / 1024).toFixed(1)} MB`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
