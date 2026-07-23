"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  ROOT,
  ENTITY_BATCH,
  getEntities,
  loadGzipJson,
  saveGzipJson,
  sleep,
  normalizeText
} = require("./wikidata-football-core");

const cacheFile =
  path.join(ROOT, "data", "wikidata-football-cache.json.gz");

const catalogueFile =
  path.join(ROOT, "data", "wikidata-honours-catalog.json.gz");

const checkpointFile =
  path.join(ROOT, "data", "wikidata-honours-checkpoint.ndjson");

if (!fs.existsSync(cacheFile)) {
  throw new Error(`Cache bulunamadi: ${cacheFile}`);
}

const cache =
  loadGzipJson(cacheFile, {
    generatedAt: null,
    count: 0,
    players: [],
    invalidPlayers: []
  });

function appendCheckpoint(value) {
  fs.appendFileSync(
    checkpointFile,
    JSON.stringify(value) + "\n",
    "utf8"
  );
}

function loadCheckpoint() {
  if (!fs.existsSync(checkpointFile)) {
    return new Map();
  }

  const map = new Map();

  for (
    const line of fs
      .readFileSync(checkpointFile, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
  ) {
    const row = JSON.parse(line);

    map.set(
      String(row.transfermarktPlayerId),
      row
    );
  }

  return map;
}

function claimIds(entity, property) {
  return [
    ...new Set(
      (entity?.claims?.[property] || [])
        .map(
          (claim) =>
            claim?.mainsnak?.datavalue?.value?.id
        )
        .filter(Boolean)
    )
  ];
}

function entityLabel(entity) {
  return (
    entity?.labels?.tr?.value ||
    entity?.labels?.en?.value ||
    entity?.id ||
    null
  );
}

function entityImage(entity) {
  const filename =
    entity?.claims?.P18?.[0]
      ?.mainsnak?.datavalue?.value;

  if (!filename) {
    return null;
  }

  return (
    "https://commons.wikimedia.org/wiki/Special:FilePath/" +
    encodeURIComponent(filename)
  );
}

function classify(name) {
  const value = normalizeText(name);

  const trophyWords = [
    "world cup",
    "dunya kupasi",
    "european championship",
    "avrupa sampiyonasi",
    "champions league",
    "sampiyonlar ligi",
    "europa league",
    "uefa cup",
    "copa america",
    "africa cup of nations",
    "asian cup",
    "confederations cup",
    "club world cup",
    "intercontinental cup",
    "cup winner",
    "championship winner",
    "olympic gold"
  ];

  if (trophyWords.some((word) => value.includes(word))) {
    return "team_trophy";
  }

  const awardWords = [
    "ballon d or",
    "golden boot",
    "golden ball",
    "player of the year",
    "footballer of the year",
    "top scorer",
    "best player",
    "mvp",
    "yilin futbolcusu",
    "altin ayakkabi",
    "altin top"
  ];

  if (awardWords.some((word) => value.includes(word))) {
    return "individual_award";
  }

  return "honour";
}

const checkpoint = loadCheckpoint();

const playersByTmId =
  new Map(
    cache.players.map(
      (player) => [
        String(player.transfermarktPlayerId),
        player
      ]
    )
  );

const pending =
  cache.players.filter(
    (player) =>
      player.wikidataId &&
      !checkpoint.has(
        String(player.transfermarktPlayerId)
      )
  );

let processed = checkpoint.size;

async function main() {
  console.log(`Honours aday: ${cache.players.length}`);
  console.log(`Honours checkpoint: ${checkpoint.size}`);

  for (
    let index = 0;
    index < pending.length;
    index += ENTITY_BATCH
  ) {
    const batch =
      pending.slice(index, index + ENTITY_BATCH);

    const entities =
      await getEntities(
        batch.map((player) => player.wikidataId),
        "claims|labels|info"
      );

    for (const player of batch) {
      const entity =
        entities.get(player.wikidataId);

      const honourIds =
        claimIds(entity, "P166");

      const row = {
        transfermarktPlayerId:
          player.transfermarktPlayerId,

        wikidataId:
          player.wikidataId,

        honourIds,

        checkedAt:
          new Date().toISOString()
      };

      appendCheckpoint(row);

      checkpoint.set(
        String(player.transfermarktPlayerId),
        row
      );

      processed++;
    }

    console.log(
      `Honours player scan: ${processed}/${cache.players.length}`
    );

    await sleep(250);
  }

  const allHonourIds =
    [
      ...new Set(
        [...checkpoint.values()]
          .flatMap((row) => row.honourIds || [])
      )
    ];

  console.log(`Unique honour QID: ${allHonourIds.length}`);

  const catalogue = new Map();

  for (
    let index = 0;
    index < allHonourIds.length;
    index += ENTITY_BATCH
  ) {
    const batch =
      allHonourIds.slice(index, index + ENTITY_BATCH);

    const entities =
      await getEntities(
        batch,
        "claims|labels|info"
      );

    for (const qid of batch) {
      const entity = entities.get(qid);
      const name = entityLabel(entity);

      catalogue.set(
        qid,
        {
          id: qid,
          name,
          image: entityImage(entity),
          type: classify(name),
          wikidataModified:
            entity?.modified || null,
          wikidataRevision:
            entity?.lastrevid || null
        }
      );
    }

    console.log(
      `Honours catalogue: ${Math.min(index + ENTITY_BATCH, allHonourIds.length)}/${allHonourIds.length}`
    );

    await sleep(250);
  }

  for (const row of checkpoint.values()) {
    const player =
      playersByTmId.get(
        String(row.transfermarktPlayerId)
      );

    if (!player) {
      continue;
    }

    const ids = row.honourIds || [];

    player.honourIds = ids;

    player.trophyIds =
      ids.filter(
        (qid) =>
          catalogue.get(qid)?.type === "team_trophy"
      );

    player.awardIds =
      ids.filter(
        (qid) =>
          catalogue.get(qid)?.type === "individual_award"
      );
  }

  cache.generatedAt =
    new Date().toISOString();

  cache.count =
    cache.players.length;

  saveGzipJson(cacheFile, cache);

  saveGzipJson(
    catalogueFile,
    {
      generatedAt:
        new Date().toISOString(),

      count:
        catalogue.size,

      honours:
        [...catalogue.values()]
    }
  );

  console.log(`Player cache: ${cacheFile}`);
  console.log(`Global catalogue: ${catalogueFile}`);
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);