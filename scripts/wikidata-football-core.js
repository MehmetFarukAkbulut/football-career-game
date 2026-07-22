"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");

const API =
  "https://www.wikidata.org/w/api.php";

const USER_AGENT =
  process.env.WIKIDATA_USER_AGENT ||
  "FormaX-football-career-game/1.0";

const ENTITY_BATCH =
  Math.min(
    50,
    Math.max(
      1,
      Number(process.env.WIKIDATA_ENTITY_BATCH || 50)
    )
  );

const API_DELAY_MS =
  Math.max(
    100,
    Number(process.env.WIKIDATA_API_DELAY_MS || 500)
  );

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function empty(value) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (
      Array.isArray(value) &&
      value.length === 0
    )
  );
}

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function claimValue(claim) {
  return claim?.mainsnak?.datavalue?.value ?? null;
}

function entityIdFromClaim(claim) {
  const value = claimValue(claim);
  return value?.id || null;
}

function timeFromSnak(snak) {
  const value =
    snak?.datavalue?.value?.time;

  if (!value) return null;

  return String(value)
    .replace(/^\+/, "")
    .slice(0, 10);
}

function quantityFromSnak(snak) {
  const amount =
    snak?.datavalue?.value?.amount;

  if (amount === null || amount === undefined) {
    return null;
  }

  const number = Number(amount);

  return Number.isFinite(number)
    ? number
    : null;
}

function firstQuantityQualifier(statement, property) {
  return quantityFromSnak(
    statement?.qualifiers?.[property]?.[0]
  );
}

function firstTimeQualifier(statement, property) {
  return timeFromSnak(
    statement?.qualifiers?.[property]?.[0]
  );
}

function dateClaim(entity, property) {
  const value =
    claimValue(
      entity?.claims?.[property]?.[0]
    );

  if (!value?.time) {
    return null;
  }

  return String(value.time)
    .replace(/^\+/, "")
    .slice(0, 10);
}

function quantityClaim(entity, property) {
  const value =
    claimValue(
      entity?.claims?.[property]?.[0]
    );

  if (value?.amount === null ||
      value?.amount === undefined) {
    return null;
  }

  const number =
    Number(value.amount);

  return Number.isFinite(number)
    ? number
    : null;
}

function commonsImage(entity) {
  const filename =
    claimValue(
      entity?.claims?.P18?.[0]
    );

  if (!filename) {
    return null;
  }

  return (
    "https://commons.wikimedia.org/wiki/Special:FilePath/" +
    encodeURIComponent(filename)
  );
}

function tmIds(entity) {
  return new Set(
    (entity?.claims?.P2446 || [])
      .map((claim) => String(claimValue(claim) ?? "").trim())
      .filter(Boolean)
  );
}

function isFootballProfile(entity, expectedTmId) {
  if (!entity || entity.missing !== undefined) {
    return false;
  }

  const expected =
    String(expectedTmId || "").trim();

  if (
    expected &&
    !tmIds(entity).has(expected)
  ) {
    return false;
  }

  /*
   * P54 = member of sports team
   * P413 = position played on team
   *
   * Requiring one of these prevents a bare/incorrect
   * Transfermarkt-ID-only item from entering the football pool.
   * Former players who later became managers still remain valid.
   */
  return Boolean(
    entity.claims?.P54?.length ||
    entity.claims?.P413?.length
  );
}

function responseRetryDelay(response, attempt) {
  const retryAfter =
    Number(response.headers.get("retry-after"));

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }

  return Math.min(
    60000,
    3000 * Math.pow(2, attempt - 1)
  );
}

async function requestJson(url, attempt = 1) {
  let response;

  try {
    response = await fetch(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT
        }
      }
    );
  }
  catch (error) {
    if (attempt >= 6) {
      throw error;
    }

    await sleep(
      Math.min(
        60000,
        3000 * Math.pow(2, attempt - 1)
      )
    );

    return requestJson(url, attempt + 1);
  }

  if (!response.ok) {
    if (
      [429, 500, 502, 503, 504].includes(response.status) &&
      attempt < 6
    ) {
      await sleep(
        responseRetryDelay(response, attempt)
      );

      return requestJson(url, attempt + 1);
    }

    throw new Error(
      `Wikidata HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

async function getEntities(ids, props = "claims|labels") {
  const clean =
    [...new Set(ids.filter(Boolean))];

  const output =
    new Map();

  for (
    let index = 0;
    index < clean.length;
    index += ENTITY_BATCH
  ) {
    const batch =
      clean.slice(
        index,
        index + ENTITY_BATCH
      );

    const url =
      API +
      "?action=wbgetentities" +
      "&format=json" +
      "&formatversion=2" +
      "&props=" +
      encodeURIComponent(props) +
      "&languages=tr|en" +
      "&languagefallback=1" +
      "&ids=" +
      encodeURIComponent(batch.join("|"));

    const body =
      await requestJson(url);

    for (
      const [qid, entity] of
      Object.entries(body.entities || {})
    ) {
      output.set(qid, entity);
    }

    await sleep(API_DELAY_MS);
  }

  return output;
}

function labelFromEntity(entity) {
  return (
    entity?.labels?.tr?.value ||
    entity?.labels?.en?.value ||
    null
  );
}

async function resolveLabels(qids, cache = new Map()) {
  const missing =
    [...new Set(qids.filter(Boolean))]
      .filter((qid) => !cache.has(qid));

  if (!missing.length) {
    return cache;
  }

  const entities =
    await getEntities(
      missing,
      "labels"
    );

  for (
    const qid of missing
  ) {
    const entity =
      entities.get(qid);

    cache.set(
      qid,
      labelFromEntity(entity) || qid
    );
  }

  return cache;
}

function isNationalTeamName(name) {
  const value =
    normalizeText(name);

  if (!value) {
    return false;
  }

  if (
    /\bu\s?1[56789]\b/.test(value) ||
    /\bu\s?2[013]\b/.test(value) ||
    /\bolympic\b/.test(value) ||
    /\bolimpik\b/.test(value) ||
    /\byouth\b/.test(value) ||
    /\bgenc\b/.test(value)
  ) {
    return false;
  }

  return (
    value.includes("national football team") ||
    value.includes("national team") ||
    value.includes("milli futbol takimi") ||
    value.includes("milli takim")
  );
}

function extractFootballPlayer(
  entity,
  expectedTmId,
  labels
) {
  if (
    !isFootballProfile(
      entity,
      expectedTmId
    )
  ) {
    return null;
  }

  const name =
    labelFromEntity(entity);

  const nationalityIds =
    (entity.claims?.P27 || [])
      .map(entityIdFromClaim)
      .filter(Boolean);

  const positionIds =
    (entity.claims?.P413 || [])
      .map(entityIdFromClaim)
      .filter(Boolean);

  const honourIds =
    [...new Set(
      (entity.claims?.P166 || [])
        .map(entityIdFromClaim)
        .filter(Boolean)
    )];

  const teamStatements =
    entity.claims?.P54 || [];

  const teams =
    teamStatements
      .map((statement) => {
        const teamQid =
          entityIdFromClaim(statement);

        if (!teamQid) {
          return null;
        }

        const teamName =
          labels.get(teamQid) ||
          teamQid;

        return {
          wikidataTeamId:
            teamQid,

          name:
            teamName,

          startDate:
            firstTimeQualifier(
              statement,
              "P580"
            ),

          endDate:
            firstTimeQualifier(
              statement,
              "P582"
            ),

          appearances:
            firstQuantityQualifier(
              statement,
              "P1350"
            ),

          goals:
            firstQuantityQualifier(
              statement,
              "P1351"
            ),

          nationalTeam:
            isNationalTeamName(
              teamName
            )
        };
      })
      .filter(Boolean);

  const totalAppearances =
    teams.reduce(
      (sum, team) =>
        sum +
        (
          Number.isFinite(team.appearances)
            ? team.appearances
            : 0
        ),
      0
    );

  const totalGoals =
    teams.reduce(
      (sum, team) =>
        sum +
        (
          Number.isFinite(team.goals)
            ? team.goals
            : 0
        ),
      0
    );

  const seniorNationalTeams =
    teams.filter(
      (team) =>
        team.nationalTeam
    );

  let nationalCaps = null;
  let nationalGoals = null;

  for (
    const team of seniorNationalTeams
  ) {
    if (
      Number.isFinite(team.appearances) &&
      (
        nationalCaps === null ||
        team.appearances > nationalCaps
      )
    ) {
      nationalCaps =
        team.appearances;

      nationalGoals =
        Number.isFinite(team.goals)
          ? team.goals
          : nationalGoals;
    }
    else if (
      Number.isFinite(team.goals) &&
      (
        nationalGoals === null ||
        team.goals > nationalGoals
      )
    ) {
      nationalGoals =
        team.goals;
    }
  }

  const height =
    quantityClaim(
      entity,
      "P2048"
    );

  return {
    wikidataId:
      entity.id,

    transfermarktPlayerId:
      Number(expectedTmId),

    name:
      name || null,

    birthDate:
      dateClaim(
        entity,
        "P569"
      ),

    nationality:
      nationalityIds
        .map(
          (qid) =>
            labels.get(qid) ||
            qid
        )
        .filter(Boolean),

    photo:
      commonsImage(entity),

    height,

    position:
      positionIds
        .map(
          (qid) =>
            labels.get(qid) ||
            qid
        )
        .filter(Boolean),

    teams,

    totalAppearances,
    totalGoals,
    nationalCaps,
    nationalGoals,

    honourIds,

    wikidataModified:
      entity.modified || null,

    wikidataRevision:
      entity.lastrevid || null,

    refreshedAt:
      new Date().toISOString()
  };
}

function maxCumulative(oldValue, freshValue) {
  const oldNumber =
    Number(oldValue);

  const freshNumber =
    Number(freshValue);

  if (!Number.isFinite(freshNumber)) {
    return oldValue;
  }

  if (
    Number.isFinite(oldNumber) &&
    oldNumber > freshNumber
  ) {
    return oldValue;
  }

  return freshNumber;
}

function mergeNonEmpty(target, source, field) {
  if (
    !empty(source?.[field])
  ) {
    target[field] =
      structuredClone(
        source[field]
      );
  }
}

function loadGzipJson(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }

  return JSON.parse(
    zlib
      .gunzipSync(
        fs.readFileSync(file)
      )
      .toString("utf8")
  );
}

function saveGzipJson(file, value) {
  const json =
    Buffer.from(
      JSON.stringify(value),
      "utf8"
    );

  const gzip =
    zlib.gzipSync(
      json,
      { level: 9 }
    );

  const tmp =
    `${file}.tmp`;

  fs.writeFileSync(
    tmp,
    gzip
  );

  fs.renameSync(
    tmp,
    file
  );
}

function appendNdjson(file, value) {
  fs.appendFileSync(
    file,
    JSON.stringify(value) + "\n",
    "utf8"
  );
}

function loadNdjson(file) {
  if (!fs.existsSync(file)) {
    return [];
  }

  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function ageFromBirthDate(birthDate) {
  if (!birthDate) {
    return null;
  }

  const date =
    new Date(birthDate);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const now =
    new Date();

  let age =
    now.getUTCFullYear() -
    date.getUTCFullYear();

  const month =
    now.getUTCMonth() -
    date.getUTCMonth();

  if (
    month < 0 ||
    (
      month === 0 &&
      now.getUTCDate() <
      date.getUTCDate()
    )
  ) {
    age--;
  }

  return age;
}

module.exports = {
  ROOT,
  ENTITY_BATCH,
  API_DELAY_MS,
  empty,
  normalizeText,
  entityIdFromClaim,
  getEntities,
  resolveLabels,
  extractFootballPlayer,
  maxCumulative,
  mergeNonEmpty,
  loadGzipJson,
  saveGzipJson,
  appendNdjson,
  loadNdjson,
  ageFromBirthDate,
  isNationalTeamName,
  sleep
};