"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const webFile = path.join(root, "data", "web-data.json");
const cacheFile = path.join(root, "data", "wikidata-football-cache.json.gz");

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/Ä±/g, "i")
    .replace(/ÄŸ/g, "g")
    .replace(/Ã¼/g, "u")
    .replace(/ÅŸ/g, "s")
    .replace(/Ã¶/g, "o")
    .replace(/Ã§/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const allowed = [
  { countries: ["england", "ingiltere"], leagues: ["premier league", "english premier league"] },
  { countries: ["italy", "italya"], leagues: ["serie a"] },
  { countries: ["spain", "ispanya"], leagues: ["la liga", "laliga", "primera division"] },
  { countries: ["germany", "almanya"], leagues: ["bundesliga"] },
  { countries: ["france", "fransa"], leagues: ["ligue 1"] },
  { countries: ["england", "ingiltere"], leagues: ["efl championship", "championship"] },
  { countries: ["belgium", "belcika"], leagues: ["belgian pro league", "jupiler pro league", "pro league"] },
  { countries: ["portugal", "portekiz"], leagues: ["primeira liga", "liga portugal", "liga portugal betclic"] },
  { countries: ["brazil", "brezilya"], leagues: ["brasileirao", "serie a", "campeonato brasileiro serie a"] },
  { countries: ["netherlands", "hollanda"], leagues: ["eredivisie"] },
  { countries: ["argentina"], leagues: ["professional football league", "liga profesional", "primera division"] },
  { countries: ["usa", "united states", "canada", "amerika birlesik devletleri"], leagues: ["major league soccer", "mls"] },
  { countries: ["mexico", "meksika"], leagues: ["liga mx", "primera division"] },
  { countries: ["turkey", "turkiye"], leagues: ["super lig", "sÃ¼per lig"] }
];

function clubAllowed(club) {
  const country = normalize(
    club.countryName ||
    club.country ||
    club.domesticCompetitionCountry ||
    ""
  );

  const league = normalize(
    club.league ||
    club.leagueName ||
    club.domesticCompetitionName ||
    club.competitionName ||
    ""
  );

  return allowed.some((rule) => {
    const countryOk =
      rule.countries.some(
        (value) => country.includes(normalize(value))
      );

    const leagueOk =
      rule.leagues.some(
        (value) => league.includes(normalize(value))
      );

    return countryOk && leagueOk;
  });
}

const data = JSON.parse(
  fs.readFileSync(webFile, "utf8")
);

const clubs = data.clubs || [];
const allowedClubIds = new Set();
const clubNameToId = new Map();

for (const club of clubs) {
  const id = Number(club.id ?? club.clubId);
  const names = [
    club.name,
    club.clubName,
    club.shortName
  ].filter(Boolean);

  for (const name of names) {
    clubNameToId.set(normalize(name), id);
  }

  if (Number.isFinite(id) && clubAllowed(club)) {
    allowedClubIds.add(id);
  }
}

function playerAllowed(player) {
  if (
    (player.clubIds || [])
      .some((id) => allowedClubIds.has(Number(id)))
  ) {
    return true;
  }

  return (player.teams || [])
    .filter((team) => !team.nationalTeam)
    .some((team) => {
      const id = clubNameToId.get(normalize(team.name));
      return allowedClubIds.has(Number(id));
    });
}

const beforePlayers = data.players.length;
const keptPlayers = data.players.filter(playerAllowed);
const keptTmIds = new Set(
  keptPlayers.map(
    (player) =>
      String(
        player.transfermarktPlayerId ??
        player.id
      )
  )
);

data.players = keptPlayers;
data.generatedAt = new Date().toISOString();
data.statistics = {
  ...(data.statistics || {}),
  targetLeagueFilter: {
    filteredAt: new Date().toISOString(),
    beforePlayers,
    afterPlayers: keptPlayers.length,
    removedPlayers: beforePlayers - keptPlayers.length,
    allowedClubCount: allowedClubIds.size
  }
};

fs.writeFileSync(
  webFile,
  JSON.stringify(data),
  "utf8"
);

if (fs.existsSync(cacheFile)) {
  const cache = JSON.parse(
    zlib.gunzipSync(
      fs.readFileSync(cacheFile)
    ).toString("utf8")
  );

  const beforeCache =
    (cache.players || []).length;

  cache.players =
    (cache.players || [])
      .filter(
        (player) =>
          keptTmIds.has(
            String(player.transfermarktPlayerId)
          )
      );

  cache.invalidPlayers =
    cache.invalidPlayers || [];

  cache.count =
    cache.players.length;

  cache.generatedAt =
    new Date().toISOString();

  fs.writeFileSync(
    cacheFile,
    zlib.gzipSync(
      Buffer.from(
        JSON.stringify(cache),
        "utf8"
      ),
      { level: 9 }
    )
  );

  console.log({
    webBefore: beforePlayers,
    webAfter: keptPlayers.length,
    cacheBefore: beforeCache,
    cacheAfter: cache.players.length,
    allowedClubs: allowedClubIds.size
  });
}
else {
  console.log({
    webBefore: beforePlayers,
    webAfter: keptPlayers.length,
    allowedClubs: allowedClubIds.size
  });
}