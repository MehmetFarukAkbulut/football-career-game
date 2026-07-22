"use strict";

const path = require("node:path");

const {
  ROOT,
  ENTITY_BATCH,
  getEntities,
  resolveLabels,
  extractFootballPlayer,
  loadGzipJson,
  saveGzipJson,
  ageFromBirthDate,
  sleep,
  empty
} = require("./wikidata-football-core");

const cacheFile =
  path.join(ROOT, "data", "wikidata-football-cache.json.gz");

const cache =
  loadGzipJson(
    cacheFile,
    {
      generatedAt: null,
      count: 0,
      players: [],
      invalidPlayers: []
    }
  );

const mode =
  String(
    process.env.WIKIDATA_REFRESH_MODE ||
    "active"
  ).toLowerCase();

const maxPlayers =
  Number(
    process.env.WIKIDATA_REFRESH_MAX ||
    0
  );

function isActiveCandidate(player) {
  const age =
    ageFromBirthDate(player.birthDate);

  const openTeam =
    (player.teams || [])
      .some(
        (team) =>
          !team.endDate &&
          !team.nationalTeam
      );

  return (
    age !== null &&
    age <= 45 &&
    openTeam
  );
}

let targets =
  mode === "all"
    ? [...cache.players]
    : cache.players.filter(isActiveCandidate);

if (
  Number.isFinite(maxPlayers) &&
  maxPlayers > 0
) {
  targets =
    targets.slice(0, maxPlayers);
}

const byTmId =
  new Map(
    cache.players.map(
      (player) => [
        String(player.transfermarktPlayerId),
        player
      ]
    )
  );

const labelCache = new Map();

function positiveOverwrite(
  target,
  source,
  field
) {
  const value =
    Number(source?.[field]);

  if (
    Number.isFinite(value) &&
    value > 0
  ) {
    target[field] = value;
  }
}

let refreshed = 0;

async function main() {
  console.log(
    `Wikidata periodic mode=${mode} targets=${targets.length}`
  );

  for (
    let index = 0;
    index < targets.length;
    index += ENTITY_BATCH
  ) {
    const batch =
      targets.slice(index, index + ENTITY_BATCH);

    const entities =
      await getEntities(
        batch.map((item) => item.wikidataId),
        "claims|labels|info"
      );

    const refs = [];

    for (const item of batch) {
      const entity =
        entities.get(item.wikidataId);

      for (
        const property of [
          "P27",
          "P413",
          "P54"
        ]
      ) {
        for (
          const claim of
          entity?.claims?.[property] || []
        ) {
          const qid =
            claim?.mainsnak?.datavalue?.value?.id;

          if (qid) {
            refs.push(qid);
          }
        }
      }
    }

    await resolveLabels(refs, labelCache);

    for (const item of batch) {
      const fresh =
        extractFootballPlayer(
          entities.get(item.wikidataId),
          item.transfermarktPlayerId,
          labelCache
        );

      if (!fresh) {
        continue;
      }

      const old =
        byTmId.get(
          String(item.transfermarktPlayerId)
        );

      if (fresh.teams?.length) {
        old.teams =
          structuredClone(fresh.teams);
      }

      positiveOverwrite(
        old,
        fresh,
        "totalAppearances"
      );

      positiveOverwrite(
        old,
        fresh,
        "totalGoals"
      );

      positiveOverwrite(
        old,
        fresh,
        "nationalCaps"
      );

      positiveOverwrite(
        old,
        fresh,
        "nationalGoals"
      );

      if (fresh.honourIds?.length) {
        old.honourIds =
          structuredClone(fresh.honourIds);
      }

      if (!empty(fresh.name)) {
        old.name = fresh.name;
      }

      if (!empty(fresh.birthDate)) {
        old.birthDate = fresh.birthDate;
      }

      if (fresh.nationality?.length) {
        old.nationality =
          structuredClone(fresh.nationality);
      }

      if (!empty(fresh.photo)) {
        old.photo = fresh.photo;
      }

      if (!empty(fresh.height)) {
        old.height = fresh.height;
      }

      if (fresh.position?.length) {
        old.position =
          structuredClone(fresh.position);
      }

      old.wikidataModified =
        fresh.wikidataModified ||
        old.wikidataModified;

      old.wikidataRevision =
        fresh.wikidataRevision ||
        old.wikidataRevision;

      old.refreshedAt =
        new Date().toISOString();

      refreshed++;
    }

    console.log(
      `Periodic refresh: ${Math.min(index + ENTITY_BATCH, targets.length)}/${targets.length}`
    );

    await sleep(250);
  }

  cache.generatedAt =
    new Date().toISOString();

  cache.count =
    cache.players.length;

  saveGzipJson(cacheFile, cache);

  console.log(
    `Periodic Wikidata update tamamlandi. Refreshed=${refreshed}`
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);