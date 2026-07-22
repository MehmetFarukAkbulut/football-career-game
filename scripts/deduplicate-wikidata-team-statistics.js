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

function finitePositive(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number > 0
  );
}

function statKey(team) {
  if (
    !finitePositive(team.appearances) ||
    !finitePositive(team.goals)
  ) {
    return null;
  }

  return (
    `${Number(team.appearances)}:` +
    `${Number(team.goals)}`
  );
}

function sanitizePlayer(player, counters) {
  const clubTeams =
    (player.teams || [])
      .filter(
        (team) =>
          !team.nationalTeam
      );

  /*
   * Wikidata'da bazen oyuncunun toplam kariyer istatistigi
   * birden fazla kulup statement'ina aynen kopyalaniyor.
   *
   * Coutinho ornegi:
   * 457 mac / 370 gol degeri bes ayri kulube yazilmis.
   *
   * Ayni buyuk tuple en az 3 kez tekrar ediyorsa yalniz ilkini
   * sayiyoruz; diger statement'larin istatistiklerini null yapiyoruz.
   */
  const groups =
    new Map();

  for (const team of clubTeams) {
    const key = statKey(team);

    if (!key) {
      continue;
    }

    const list =
      groups.get(key) || [];

    list.push(team);
    groups.set(key, list);
  }

  for (const list of groups.values()) {
    const sample =
      list[0];

    const largeTuple =
      Number(sample.appearances) >= 50 ||
      Number(sample.goals) >= 25;

    if (
      list.length >= 3 &&
      largeTuple
    ) {
      for (
        let index = 1;
        index < list.length;
        index++
      ) {
        list[index].appearances = null;
        list[index].goals = null;
        counters.duplicateStatements++;
      }
    }
  }

  /*
   * Bazi kayitlarda mac sayisi qualifier'i "goals" olarak
   * okunuyor ve appearances tamamen bos kaliyor.
   *
   * Olivio ornegi:
   * bircok kulupte appearances=null, goals=79/141 vb.
   *
   * En az 3 boyle statement ve toplam 100+ "gol" varsa bunlar
   * gol olarak guvenilir kabul edilmez.
   */
  const noAppearanceGoalTeams =
    clubTeams.filter(
      (team) =>
        !finitePositive(team.appearances) &&
        finitePositive(team.goals)
    );

  const noAppearanceGoalSum =
    noAppearanceGoalTeams.reduce(
      (sum, team) =>
        sum + Number(team.goals),
      0
    );

  if (
    noAppearanceGoalTeams.length >= 3 &&
    noAppearanceGoalSum >= 100
  ) {
    for (
      const team of noAppearanceGoalTeams
    ) {
      team.goals = null;
      counters.goalsWithoutAppearances++;
    }
  }

  let clubAppearances = 0;
  let clubGoals = 0;
  let hasClubAppearances = false;
  let hasClubGoals = false;

  for (const team of clubTeams) {
    if (finitePositive(team.appearances)) {
      clubAppearances +=
        Number(team.appearances);

      hasClubAppearances = true;
    }

    if (finitePositive(team.goals)) {
      clubGoals +=
        Number(team.goals);

      hasClubGoals = true;
    }
  }

  const nationalTeams =
    (player.teams || [])
      .filter(
        (team) =>
          team.nationalTeam
      );

  let nationalCaps = 0;
  let nationalGoals = 0;
  let hasNationalCaps = false;
  let hasNationalGoals = false;

  for (const team of nationalTeams) {
    if (finitePositive(team.appearances)) {
      nationalCaps +=
        Number(team.appearances);

      hasNationalCaps = true;
    }

    if (finitePositive(team.goals)) {
      nationalGoals +=
        Number(team.goals);

      hasNationalGoals = true;
    }
  }

  if (hasClubAppearances) {
    player.appearances =
      clubAppearances;

    player.totalAppearances =
      clubAppearances +
      (
        hasNationalCaps
          ? nationalCaps
          : 0
      );
  }

  if (hasClubGoals) {
    player.goals =
      clubGoals;

    player.totalGoals =
      clubGoals +
      (
        hasNationalGoals
          ? nationalGoals
          : 0
      );
  }
  else {
    player.goals = 0;
    player.totalGoals =
      hasNationalGoals
        ? nationalGoals
        : 0;
  }

  if (hasNationalCaps) {
    player.nationalCaps =
      nationalCaps;
  }

  if (hasNationalGoals) {
    player.nationalGoals =
      nationalGoals;
  }

  player.careerGoals =
    (
      Number(player.goals) || 0
    ) +
    (
      Number(player.nationalGoals) || 0
    );
}

function sanitize(players) {
  const counters = {
    duplicateStatements: 0,
    goalsWithoutAppearances: 0
  };

  for (const player of players || []) {
    sanitizePlayer(
      player,
      counters
    );
  }

  return counters;
}

const web =
  JSON.parse(
    fs.readFileSync(
      webFile,
      "utf8"
    )
  );

const webCounters =
  sanitize(web.players);

web.generatedAt =
  new Date().toISOString();

web.statistics = {
  ...(web.statistics || {}),

  wikidataStatementDeduplication: {
    appliedAt:
      new Date().toISOString(),

    rules: {
      repeatedLargeTuple:
        "same appearances/goals pair repeated at least 3 times",

      goalsWithoutAppearances:
        "at least 3 statements and combined goals >= 100"
    },

    changes:
      webCounters
  }
};

fs.writeFileSync(
  webFile,
  JSON.stringify(web),
  "utf8"
);

let cacheCounters =
  null;

if (fs.existsSync(cacheFile)) {
  const cache =
    JSON.parse(
      zlib
        .gunzipSync(
          fs.readFileSync(cacheFile)
        )
        .toString("utf8")
    );

  cacheCounters =
    sanitize(cache.players);

  cache.generatedAt =
    new Date().toISOString();

  fs.writeFileSync(
    cacheFile,
    zlib.gzipSync(
      Buffer.from(
        JSON.stringify(cache),
        "utf8"
      ),
      {
        level: 9
      }
    )
  );
}

console.log(
  JSON.stringify(
    {
      web:
        webCounters,

      cache:
        cacheCounters
    },
    null,
    2
  )
);