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

/*
 * Bu sÄ±nÄ±rlar futbol rekoru Ã¼retmek iÃ§in kullanÄ±lmaz.
 * YalnÄ±zca aÃ§Ä±kÃ§a bozuk Wikidata qualifier deÄŸerlerini reddeder.
 *
 * Ã–rnek bozuk kayÄ±t:
 * 156 maÃ§ / 5603 gol
 *
 * Bir futbolcu bir maÃ§ta birden fazla gol atabilir. Bu nedenle
 * goals <= appearances ÅŸartÄ± uygulanmaz. Ancak 3 gol/maÃ§ Ã¼zeri
 * kariyer ortalamasÄ± ve 100+ toplam gol birlikte gÃ¶rÃ¼lÃ¼yorsa
 * veri gÃ¼venilmez kabul edilir.
 */
function validAppearances(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0 &&
    number <= 3000
  );
}

function validGoals(value, appearances) {
  const goals = Number(value);
  const apps = Number(appearances);

  if (
    !Number.isFinite(goals) ||
    goals < 0 ||
    goals > 1500
  ) {
    return false;
  }

  if (
    Number.isFinite(apps) &&
    apps > 0 &&
    goals > 100 &&
    goals > apps * 3
  ) {
    return false;
  }

  return true;
}

function sanitizeTeam(team, counters) {
  const originalApps =
    team.appearances;

  const originalGoals =
    team.goals;

  if (
    originalApps !== null &&
    originalApps !== undefined &&
    !validAppearances(originalApps)
  ) {
    team.appearances = null;
    counters.teamAppearances++;
  }

  if (
    originalGoals !== null &&
    originalGoals !== undefined &&
    !validGoals(
      originalGoals,
      team.appearances
    )
  ) {
    team.goals = null;
    counters.teamGoals++;
  }
}

function clubTotals(teams) {
  let appearances = 0;
  let goals = 0;
  let hasAppearances = false;
  let hasGoals = false;

  for (
    const team of
    (teams || []).filter(
      (item) =>
        !item.nationalTeam
    )
  ) {
    if (
      validAppearances(
        team.appearances
      )
    ) {
      appearances +=
        Number(team.appearances);

      hasAppearances = true;
    }

    if (
      validGoals(
        team.goals,
        team.appearances
      )
    ) {
      goals +=
        Number(team.goals);

      hasGoals = true;
    }
  }

  return {
    appearances:
      hasAppearances
        ? appearances
        : null,

    goals:
      hasGoals
        ? goals
        : null
  };
}

function nationalTotals(teams) {
  let caps = 0;
  let goals = 0;
  let hasCaps = false;
  let hasGoals = false;

  for (
    const team of
    (teams || []).filter(
      (item) =>
        item.nationalTeam
    )
  ) {
    if (
      validAppearances(
        team.appearances
      )
    ) {
      caps +=
        Number(team.appearances);

      hasCaps = true;
    }

    if (
      validGoals(
        team.goals,
        team.appearances
      )
    ) {
      goals +=
        Number(team.goals);

      hasGoals = true;
    }
  }

  return {
    caps:
      hasCaps
        ? caps
        : null,

    goals:
      hasGoals
        ? goals
        : null
  };
}

function sanitizePlayer(player, counters) {
  for (
    const team of
    player.teams || []
  ) {
    sanitizeTeam(
      team,
      counters
    );
  }

  const clubs =
    clubTotals(
      player.teams
    );

  const national =
    nationalTotals(
      player.teams
    );

  const suspiciousTotalGoals =
    !validGoals(
      player.totalGoals,
      player.totalAppearances
    );

  const suspiciousGoals =
    !validGoals(
      player.goals,
      player.appearances
    );

  const suspiciousNationalGoals =
    !validGoals(
      player.nationalGoals,
      player.nationalCaps
    );

  if (
    player.totalGoals !== null &&
    player.totalGoals !== undefined &&
    suspiciousTotalGoals
  ) {
    player.totalGoals =
      clubs.goals;

    counters.playerTotalGoals++;
  }

  if (
    player.goals !== null &&
    player.goals !== undefined &&
    suspiciousGoals
  ) {
    player.goals =
      clubs.goals;

    counters.playerGoals++;
  }

  if (
    player.totalAppearances !== null &&
    player.totalAppearances !== undefined &&
    !validAppearances(
      player.totalAppearances
    )
  ) {
    player.totalAppearances =
      clubs.appearances;

    counters.playerTotalAppearances++;
  }

  if (
    player.appearances !== null &&
    player.appearances !== undefined &&
    !validAppearances(
      player.appearances
    )
  ) {
    player.appearances =
      clubs.appearances;

    counters.playerAppearances++;
  }

  if (
    player.nationalGoals !== null &&
    player.nationalGoals !== undefined &&
    suspiciousNationalGoals
  ) {
    player.nationalGoals =
      national.goals;

    counters.nationalGoals++;
  }

  if (
    player.nationalCaps !== null &&
    player.nationalCaps !== undefined &&
    !validAppearances(
      player.nationalCaps
    )
  ) {
    player.nationalCaps =
      national.caps;

    counters.nationalCaps++;
  }

  /*
   * Override uygulanmadan Ã¶nce geÃ§ici careerGoals deÄŸeri de
   * bozuk olabilir. Sonraki enrich-career-statistics adÄ±mÄ±
   * gÃ¼venilir override'larÄ± tekrar uygulayacaktÄ±r.
   */
  if (
    player.careerGoals !== null &&
    player.careerGoals !== undefined &&
    !validGoals(
      player.careerGoals,
      (
        Number(player.appearances) || 0
      ) +
      (
        Number(player.nationalCaps) || 0
      )
    )
  ) {
    const clubGoals =
      validGoals(
        player.goals,
        player.appearances
      )
        ? Number(player.goals)
        : 0;

    const nationalGoals =
      validGoals(
        player.nationalGoals,
        player.nationalCaps
      )
        ? Number(player.nationalGoals)
        : 0;

    player.careerGoals =
      clubGoals +
      nationalGoals;

    counters.careerGoals++;
  }
}

function counters() {
  return {
    teamAppearances: 0,
    teamGoals: 0,
    playerTotalAppearances: 0,
    playerTotalGoals: 0,
    playerAppearances: 0,
    playerGoals: 0,
    nationalCaps: 0,
    nationalGoals: 0,
    careerGoals: 0
  };
}

function sanitizeCollection(players) {
  const result =
    counters();

  for (
    const player of players || []
  ) {
    sanitizePlayer(
      player,
      result
    );
  }

  return result;
}

const web =
  JSON.parse(
    fs.readFileSync(
      webFile,
      "utf8"
    )
  );

const webCounters =
  sanitizeCollection(
    web.players
  );

web.generatedAt =
  new Date().toISOString();

web.statistics = {
  ...(web.statistics || {}),

  wikidataStatisticSanitizer: {
    sanitizedAt:
      new Date().toISOString(),

    rules: {
      maximumAppearances:
        3000,

      maximumGoals:
        1500,

      rejectExtremeGoalRatio:
        "goals > 100 and goals > appearances * 3"
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

if (
  fs.existsSync(cacheFile)
) {
  const cache =
    JSON.parse(
      zlib
        .gunzipSync(
          fs.readFileSync(
            cacheFile
          )
        )
        .toString("utf8")
    );

  cacheCounters =
    sanitizeCollection(
      cache.players
    );

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