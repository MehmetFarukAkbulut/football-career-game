"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  ROOT,
  empty,
  normalizeText,
  loadGzipJson
} = require("./wikidata-football-core");

const cacheFile =
  path.join(ROOT, "data", "wikidata-football-cache.json.gz");

const webFile =
  path.join(ROOT, "data", "web-data.json");

if (!fs.existsSync(webFile)) {
  throw new Error(`web-data.json bulunamadi: ${webFile}`);
}

const cache =
  loadGzipJson(cacheFile, { players: [] });

const data =
  JSON.parse(
    fs.readFileSync(webFile, "utf8")
  );

const players = data.players || [];
const clubs = data.clubs || [];

const byTmId =
  new Map(
    players.map(
      (player) => [
        String(
          player.transfermarktPlayerId ??
          player.id ??
          ""
        ),
        player
      ]
    )
  );

const clubByName = new Map();

for (const club of clubs) {
  for (
    const name of [
      club.name,
      club.clubName,
      club.shortName
    ].filter(Boolean)
  ) {
    const key = normalizeText(name);

    if (key && !clubByName.has(key)) {
      clubByName.set(key, club);
    }
  }
}

function clubIdOf(club) {
  return club.id ?? club.clubId ?? null;
}

function nonEmptyOverwrite(
  target,
  source,
  targetField,
  sourceField = targetField
) {
  const value = source?.[sourceField];

  if (!empty(value)) {
    target[targetField] =
      structuredClone(value);
  }
}

function positiveOverwrite(
  target,
  source,
  targetField,
  sourceField = targetField
) {
  const value =
    Number(source?.[sourceField]);

  if (
    Number.isFinite(value) &&
    value > 0
  ) {
    target[targetField] = value;
  }
}

function mappedClubTeams(source) {
  return (source.teams || [])
    .filter((team) => !team.nationalTeam)
    .map(
      (team) => {
        const club =
          clubByName.get(
            normalizeText(team.name)
          );

        if (!club) {
          return null;
        }

        return {
          team,
          clubId: clubIdOf(club)
        };
      }
    )
    .filter(
      (entry) =>
        entry &&
        entry.clubId !== null &&
        entry.clubId !== undefined
    );
}

function clubTotals(source) {
  const teams =
    (source.teams || [])
      .filter((team) => !team.nationalTeam);

  return {
    appearances:
      teams.reduce(
        (sum, team) =>
          sum +
          (
            Number.isFinite(team.appearances)
              ? team.appearances
              : 0
          ),
        0
      ),

    goals:
      teams.reduce(
        (sum, team) =>
          sum +
          (
            Number.isFinite(team.goals)
              ? team.goals
              : 0
          ),
        0
      )
  };
}

let updated = 0;
let added = 0;

for (const source of cache.players || []) {
  const tmId =
    Number(source.transfermarktPlayerId);

  if (!Number.isFinite(tmId)) {
    continue;
  }

  const key = String(tmId);
  let target = byTmId.get(key);

  const mapped = mappedClubTeams(source);
  const totals = clubTotals(source);

  if (!target) {
    target = {
      id: tmId,
      playerId: tmId,
      transfermarktPlayerId: tmId,

      transfermarktUrl:
        `https://www.transfermarkt.com/profil/spieler/${tmId}`,

      name:
        source.name || null,

      playerName:
        source.name || null,

      normalized:
        normalizeText(source.name),

      birthDate:
        source.birthDate || null,

      nationality:
        source.nationality?.[0] || null,

      nationalities:
        source.nationality || [],

      nationalityCode:
        null,

      photo:
        source.photo || null,

      imageUrl:
        source.photo || null,

      height:
        source.height ?? null,

      position:
        source.position || null,

      teams:
        source.teams || [],

      totalAppearances:
        source.totalAppearances > 0
          ? source.totalAppearances
          : null,

      totalGoals:
        source.totalGoals > 0
          ? source.totalGoals
          : null,

      nationalCaps:
        source.nationalCaps > 0
          ? source.nationalCaps
          : null,

      nationalGoals:
        source.nationalGoals > 0
          ? source.nationalGoals
          : null,

      nationalAssists:
        Number(source.nationalAssists) > 0
          ? Number(source.nationalAssists)
          : null,

      assists:
        Number(source.assists) > 0
          ? Number(source.assists)
          : null,

      appearances:
        totals.appearances > 0
          ? totals.appearances
          : null,

      goals:
        totals.goals > 0
          ? totals.goals
          : null,

      clubIds:
        mapped.map((entry) => entry.clubId),

      careers:
        mapped.map(
          (entry) => ({
            clubId: entry.clubId,
            startDate: entry.team.startDate,
            endDate: entry.team.endDate,
            firstTeam: true
          })
        ),

      honourIds:
        source.honourIds || [],

      trophyIds:
        source.trophyIds || [],

      awardIds:
        source.awardIds || [],

      statisticsComplete:
        false,

      statisticsCoverage:
        "Authoritative Wikidata profile",

      careerGoals:
        totals.goals > 0
          ? totals.goals
          : null,

      wikidataId:
        source.wikidataId,

      wikidataModified:
        source.wikidataModified,

      wikidataRevision:
        source.wikidataRevision
    };

    players.push(target);
    byTmId.set(key, target);
    added++;
    continue;
  }

  nonEmptyOverwrite(target, source, "name");

  if (!empty(source.name)) {
    target.playerName = source.name;
    target.normalized =
      normalizeText(source.name);
  }

  nonEmptyOverwrite(target, source, "birthDate");

  if (source.nationality?.length) {
    target.nationality =
      source.nationality[0];

    target.nationalities =
      structuredClone(source.nationality);
  }

  if (!empty(source.photo)) {
    target.photo = source.photo;
    target.imageUrl = source.photo;
  }

  nonEmptyOverwrite(target, source, "height");
  nonEmptyOverwrite(target, source, "position");

  /*
   * Replace, never union.
   */
  if (source.teams?.length) {
    target.teams =
      structuredClone(source.teams);
  }

  /*
   * Positive fresh values are authoritative,
   * even when lower than old values.
   * 0/null/empty never overwrite.
   */
  positiveOverwrite(
    target,
    source,
    "totalAppearances"
  );

  positiveOverwrite(
    target,
    source,
    "totalGoals"
  );

  positiveOverwrite(
    target,
    source,
    "nationalCaps"
  );

  positiveOverwrite(
    target,
    source,
    "nationalGoals"
  );

  positiveOverwrite(
    target,
    source,
    "nationalAssists"
  );

  positiveOverwrite(
    target,
    source,
    "assists"
  );

  if (totals.appearances > 0) {
    target.appearances =
      totals.appearances;
  }

  if (totals.goals > 0) {
    target.goals =
      totals.goals;

    target.careerGoals =
      totals.goals;
  }

  if (mapped.length) {
    target.clubIds =
      [
        ...new Set(
          mapped.map(
            (entry) =>
              entry.clubId
          )
        )
      ];

    target.careers =
      mapped.map(
        (entry) => ({
          clubId: entry.clubId,
          startDate: entry.team.startDate,
          endDate: entry.team.endDate,
          firstTeam: true
        })
      );
  }

  if (source.honourIds?.length) {
    target.honourIds =
      structuredClone(source.honourIds);
  }

  if (source.trophyIds?.length) {
    target.trophyIds =
      structuredClone(source.trophyIds);
  }

  if (source.awardIds?.length) {
    target.awardIds =
      structuredClone(source.awardIds);
  }

  target.wikidataId =
    source.wikidataId ||
    target.wikidataId;

  target.wikidataModified =
    source.wikidataModified ||
    target.wikidataModified;

  target.wikidataRevision =
    source.wikidataRevision ||
    target.wikidataRevision;

  updated++;
}

data.players = players;

data.statistics = {
  ...(data.statistics || {}),

  wikidataAuthoritativeMerge: {
    mergedAt:
      new Date().toISOString(),

    sourcePlayers:
      cache.players?.length || 0,

    updated,
    added,

    rules: {
      nonEmptyOverwrite: true,
      positiveStatsOverwrite: true,
      zeroDoesNotOverwrite: true,
      teamsReplaceNotUnion: true,
      sharedHonourImageCatalogue: true
    }
  }
};

fs.writeFileSync(
  webFile,
  JSON.stringify(data),
  "utf8"
);

console.log(
  `Authoritative Wikidata merge: updated=${updated} added=${added}`
);