"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");

const webFile =
  path.join(root, "data", "web-data.json");

const cacheFile =
  path.join(
    root,
    "data",
    "wikidata-football-cache.json.gz"
  );

const overrideFile =
  path.join(
    root,
    "data",
    "player-stat-overrides.json"
  );

const MIN_BIRTH_YEAR =
  Number(
    process.env.FORMAX_MIN_BIRTH_YEAR ||
    1940
  );

function numberOrNull(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function positiveOrNull(value) {
  const number = numberOrNull(value);

  return (
    number !== null &&
    number > 0
  )
    ? number
    : null;
}

function playerId(player) {
  return String(
    player.transfermarktPlayerId ??
    player.playerId ??
    player.id ??
    ""
  );
}

function birthYear(player) {
  const value =
    String(player.birthDate || "");

  const match =
    value.match(/^(\d{4})/);

  return match
    ? Number(match[1])
    : null;
}

function arrayUnique(values) {
  return [
    ...new Set(
      (values || [])
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        )
        .map(
          (value) =>
            typeof value === "string"
              ? value.trim()
              : value
        )
    )
  ];
}

function dedupeTeams(teams) {
  const seen =
    new Set();

  const result =
    [];

  for (const team of teams || []) {
    const key = [
      team.wikidataTeamId || "",
      String(team.name || "")
        .toLocaleLowerCase("tr-TR")
        .trim(),
      team.startDate || "",
      team.endDate || "",
      team.nationalTeam
        ? "1"
        : "0"
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(team);
  }

  return result;
}

function dedupeCareers(careers) {
  const seen =
    new Set();

  const result =
    [];

  for (const career of careers || []) {
    const key = [
      career.clubId ?? "",
      career.startDate || "",
      career.endDate || "",
      career.firstTeam === false
        ? "0"
        : "1"
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(career);
  }

  return result;
}

function quality(player) {
  let score = 0;

  if (player.name) score += 20;
  if (player.birthDate) score += 10;
  if (player.photo || player.imageUrl) score += 4;
  if (positiveOrNull(player.appearances)) score += 10;
  if (positiveOrNull(player.goals)) score += 10;
  if (positiveOrNull(player.assists)) score += 5;
  if (positiveOrNull(player.nationalCaps)) score += 12;
  if (positiveOrNull(player.nationalGoals)) score += 12;
  if (Array.isArray(player.clubIds)) score += player.clubIds.length;
  if (Array.isArray(player.careers)) score += player.careers.length * 2;
  if (Array.isArray(player.teams)) score += player.teams.length * 2;
  if (player.statisticsComplete) score += 15;

  return score;
}

/*
 * AynÄ± oyuncu birkaÃ§ defa geldiyse union ile yapay bir oyuncu Ã¼retmiyoruz.
 * En yÃ¼ksek kaliteli ana kaydÄ± seÃ§iyoruz; yalnÄ±z ana kayÄ±tta boÅŸ olan
 * gÃ¼venli alanlarÄ± diÄŸer kayÄ±ttan tamamlÄ±yoruz.
 */
function mergeDuplicate(left, right) {
  const base =
    quality(right) > quality(left)
      ? { ...right }
      : { ...left };

  const fallback =
    base === right
      ? left
      : right;

  const scalarFields = [
    "name",
    "playerName",
    "normalized",
    "birthDate",
    "nationality",
    "nationalityCode",
    "photo",
    "imageUrl",
    "imageAsset",
    "height",
    "position",
    "appearances",
    "goals",
    "assists",
    "minutesPlayed",
    "yellowCards",
    "redCards",
    "nationalCaps",
    "nationalGoals",
    "nationalAssists",
    "marketValueInEur",
    "highestMarketValueInEur",
    "careerGoals",
    "careerGoalsSource",
    "careerGoalsAsOf",
    "statisticsComplete",
    "statisticsCoverage",
    "popularityScore",
    "popularityTier",
    "wikidataId",
    "wikidataModified",
    "wikidataRevision"
  ];

  for (const field of scalarFields) {
    if (
      base[field] === null ||
      base[field] === undefined ||
      base[field] === ""
    ) {
      base[field] =
        fallback[field];
    }
  }

  base.clubIds =
    arrayUnique(
      base.clubIds?.length
        ? base.clubIds
        : fallback.clubIds
    );

  base.careers =
    dedupeCareers(
      base.careers?.length
        ? base.careers
        : fallback.careers
    );

  base.teams =
    dedupeTeams(
      base.teams?.length
        ? base.teams
        : fallback.teams
    );

  base.honourIds =
    arrayUnique(
      base.honourIds?.length
        ? base.honourIds
        : fallback.honourIds
    );

  base.trophyIds =
    arrayUnique(
      base.trophyIds?.length
        ? base.trophyIds
        : fallback.trophyIds
    );

  base.awardIds =
    arrayUnique(
      base.awardIds?.length
        ? base.awardIds
        : fallback.awardIds
    );

  return base;
}

function loadCacheMap() {
  if (!fs.existsSync(cacheFile)) {
    return new Map();
  }

  const cache =
    JSON.parse(
      zlib
        .gunzipSync(
          fs.readFileSync(cacheFile)
        )
        .toString("utf8")
    );

  return new Map(
    (cache.players || [])
      .map(
        (player) => [
          playerId(player),
          player
        ]
      )
      .filter(
        ([id]) =>
          id
      )
  );
}

function applyNationalTeamData(
  player,
  cachePlayer
) {
  if (!cachePlayer) {
    return;
  }

  const caps =
    positiveOrNull(
      cachePlayer.nationalCaps
    );

  const goals =
    positiveOrNull(
      cachePlayer.nationalGoals
    );

  /*
   * Wikidata'dan dolu gelen milli takim sayilari bu alanlarda
   * otoritatif kabul edilir. Sifir/null eski dogru veriyi silmez.
   */
  if (caps !== null) {
    player.nationalCaps =
      caps;
  }

  if (goals !== null) {
    player.nationalGoals =
      goals;
  }
}

const data =
  JSON.parse(
    fs.readFileSync(
      webFile,
      "utf8"
    )
  );

const cacheMap =
  loadCacheMap();

const overrides =
  fs.existsSync(overrideFile)
    ? JSON.parse(
        fs.readFileSync(
          overrideFile,
          "utf8"
        )
      )
    : {
        players: []
      };

const overrideMap =
  new Map(
    (overrides.players || [])
      .map(
        (row) => [
          String(
            row.transfermarktPlayerId
          ),
          row
        ]
      )
  );

const before =
  (data.players || []).length;

const uniqueMap =
  new Map();

let duplicateRows = 0;
let removedByBirthYear = 0;
let nationalFromCache = 0;
let overridesApplied = 0;

for (const original of data.players || []) {
  const id =
    playerId(original);

  if (!id) {
    continue;
  }

  const year =
    birthYear(original);

  /*
   * 1940 ve sonrasi tutulur.
   * Dogum tarihi bilinmeyen oyuncu otomatik silinmez.
   * Pele (1940), Eusebio (1942), Cruyff (1947) gibi modern
   * futbol tarihinin temel isimleri korunur; 1900'lerin ilk
   * donemindeki dusuk kaliteli kayitlar elenir.
   */
  if (
    year !== null &&
    year < MIN_BIRTH_YEAR
  ) {
    removedByBirthYear++;
    continue;
  }

  const player = {
    ...original,
    id:
      Number(original.id ?? id),
    playerId:
      Number(original.playerId ?? id),
    transfermarktPlayerId:
      Number(
        original.transfermarktPlayerId ??
        id
      )
  };

  player.clubIds =
    arrayUnique(player.clubIds);

  player.careers =
    dedupeCareers(player.careers);

  player.teams =
    dedupeTeams(player.teams);

  const cached =
    cacheMap.get(id);

  const beforeCaps =
    Number(player.nationalCaps) || 0;

  const beforeGoals =
    Number(player.nationalGoals) || 0;

  applyNationalTeamData(
    player,
    cached
  );

  if (
    (Number(player.nationalCaps) || 0) !== beforeCaps ||
    (Number(player.nationalGoals) || 0) !== beforeGoals
  ) {
    nationalFromCache++;
  }

  const override =
    overrideMap.get(id);

  if (override) {
    for (
      const field of [
        "nationalCaps",
        "nationalGoals",
        "nationalAssists",
        "appearances",
        "goals",
        "assists",
        "careerGoals"
      ]
    ) {
      const value =
        numberOrNull(
          override[field]
        );

      if (value !== null) {
        player[field] =
          value;
      }
    }

    overridesApplied++;
  }

  const existing =
    uniqueMap.get(id);

  if (existing) {
    uniqueMap.set(
      id,
      mergeDuplicate(
        existing,
        player
      )
    );

    duplicateRows++;
  }
  else {
    uniqueMap.set(
      id,
      player
    );
  }
}

const players =
  [...uniqueMap.values()]
    .sort(
      (a, b) =>
        String(a.name || "")
          .localeCompare(
            String(b.name || ""),
            "tr"
          ) ||
        Number(a.id) -
          Number(b.id)
    );

data.players =
  players;

data.generatedAt =
  new Date().toISOString();

data.statistics = {
  ...(data.statistics || {}),

  playerDatasetNormalization: {
    normalizedAt:
      new Date().toISOString(),

    minimumBirthYear:
      MIN_BIRTH_YEAR,

    before,
    after:
      players.length,

    duplicateRowsRemoved:
      duplicateRows,

    removedByBirthYear,
    nationalTeamRowsUpdatedFromCache:
      nationalFromCache,

    manualOverridesApplied:
      overridesApplied
  }
};

fs.writeFileSync(
  webFile,
  JSON.stringify(data),
  "utf8"
);

const duplicateIds =
  players
    .map(playerId)
    .filter(
      (id, index, all) =>
        all.indexOf(id) !== index
    );

const burak =
  players.find(
    (player) =>
      Number(
        player.transfermarktPlayerId
      ) === 34987
  );

console.log({
  before,
  after:
    players.length,
  duplicateRowsRemoved:
    duplicateRows,
  remainingDuplicateIds:
    duplicateIds.length,
  removedByBirthYear,
  nationalTeamRowsUpdatedFromCache:
    nationalFromCache,
  manualOverridesApplied:
    overridesApplied,
  burakYilmaz:
    burak
      ? {
          id:
            burak.id,
          nationalCaps:
            burak.nationalCaps,
          nationalGoals:
            burak.nationalGoals
        }
      : null
});

if (duplicateIds.length) {
  throw new Error(
    `Tekrarlanan oyuncu ID kaldi: ${duplicateIds.length}`
  );
}

if (
  !burak ||
  Number(burak.nationalCaps) !== 77 ||
  Number(burak.nationalGoals) !== 31
) {
  throw new Error(
    "Burak Yilmaz milli takim verisi duzeltilemedi."
  );
}