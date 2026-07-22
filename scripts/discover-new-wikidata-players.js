"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  ROOT,
  sleep
} = require("./wikidata-football-core");

const indexFile =
  path.join(ROOT, "data", "historical-player-index.json");

const missingFile =
  path.join(ROOT, "data", "historical-missing-players.json");

const webFile =
  path.join(ROOT, "data", "web-data.json");

const endpoint =
  "https://query.wikidata.org/sparql";

const pageSize =
  Math.min(
    500,
    Math.max(
      50,
      Number(
        process.env.WIKIDATA_NEW_PAGE_SIZE ||
        500
      )
    )
  );

function load(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }

  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}

function atomicWrite(file, value) {
  const tmp = `${file}.tmp`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(value, null, 2),
    "utf8"
  );

  fs.renameSync(tmp, file);
}

async function queryRows(cursor, attempt = 1) {
  const query = `
SELECT ?item ?tmid ?itemLabel ?birthDate ?countryLabel WHERE {
  ?item wdt:P2446 ?tmid.

  BIND(xsd:integer(?tmid) AS ?tmNumber)
  FILTER(?tmNumber > ${cursor})

  OPTIONAL {
    ?item wdt:P569 ?birthDate.
  }

  OPTIONAL {
    ?item wdt:P27 ?country.
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "tr,en".
  }
}
ORDER BY xsd:integer(?tmid)
LIMIT ${pageSize}
`;

  try {
    const response =
      await fetch(
        endpoint +
        "?format=json&query=" +
        encodeURIComponent(query),
        {
          headers: {
            Accept:
              "application/sparql-results+json",

            "User-Agent":
              process.env.WIKIDATA_USER_AGENT ||
              "FormaX-football-career-game/1.0"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `Wikidata HTTP ${response.status}: ${response.statusText}`
      );
    }

    const body = await response.json();

    return body.results?.bindings || [];
  }
  catch (error) {
    if (attempt >= 6) {
      throw error;
    }

    const wait =
      Math.min(
        60000,
        3000 * Math.pow(2, attempt - 1)
      );

    console.warn(
      `Incremental discovery retry ${attempt}/6: ${error.message}`
    );

    await sleep(wait);

    return queryRows(cursor, attempt + 1);
  }
}

async function main() {
  const index =
    load(
      indexFile,
      {
        generatedAt: null,
        count: 0,
        players: []
      }
    );

  const missing =
    load(
      missingFile,
      {
        generatedAt: null,
        count: 0,
        players: []
      }
    );

  const web =
    load(
      webFile,
      {
        players: []
      }
    );

  const indexIds =
    new Set(
      (index.players || [])
        .map(
          (player) =>
            String(player.transfermarktPlayerId)
        )
    );

  const webIds =
    new Set(
      (web.players || [])
        .map(
          (player) =>
            String(
              player.transfermarktPlayerId ??
              player.id ??
              ""
            )
        )
    );

  const missingIds =
    new Set(
      (missing.players || [])
        .map(
          (player) =>
            String(player.transfermarktPlayerId)
        )
    );

  let cursor =
    Math.max(
      0,
      ...(index.players || [])
        .map(
          (player) =>
            Number(player.transfermarktPlayerId)
        )
        .filter(Number.isFinite)
    );

  let addedIndex = 0;
  let addedMissing = 0;

  console.log(
    `Incremental discovery cursor: ${cursor}`
  );

  while (true) {
    const rows =
      await queryRows(cursor);

    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      const tmId =
        Number(row.tmid?.value);

      const qid =
        row.item?.value
          ?.split("/")
          .pop();

      if (
        !Number.isFinite(tmId) ||
        !qid
      ) {
        continue;
      }

      const player = {
        wikidataId: qid,
        transfermarktPlayerId: tmId,
        name:
          row.itemLabel?.value ||
          null,
        birthDate:
          row.birthDate?.value
            ?.slice(0, 10) ||
          null,
        country:
          row.countryLabel?.value ||
          null
      };

      const key = String(tmId);

      if (!indexIds.has(key)) {
        index.players.push(player);
        indexIds.add(key);
        addedIndex++;
      }

      if (
        !webIds.has(key) &&
        !missingIds.has(key)
      ) {
        missing.players.push(player);
        missingIds.add(key);
        addedMissing++;
      }

      if (tmId > cursor) {
        cursor = tmId;
      }
    }

    index.generatedAt =
      new Date().toISOString();

    index.count =
      index.players.length;

    missing.generatedAt =
      new Date().toISOString();

    missing.count =
      missing.players.length;

    atomicWrite(indexFile, index);
    atomicWrite(missingFile, missing);

    console.log(
      `New discovery cursor=${cursor} addedIndex=${addedIndex} addedMissing=${addedMissing}`
    );

    if (rows.length < pageSize) {
      break;
    }

    await sleep(
      Number(
        process.env.WIKIDATA_API_DELAY_MS ||
        800
      )
    );
  }

  console.log(
    `Incremental discovery complete. New index=${addedIndex}; new missing=${addedMissing}`
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);