"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const sourceFile = path.join(dataDir, "web-data.json");
const outputRoot = path.join(dataDir, "game-index");

const data = JSON.parse(
  fs.readFileSync(sourceFile, "utf8")
);

fs.rmSync(outputRoot, {
  recursive: true,
  force: true
});

fs.mkdirSync(outputRoot, {
  recursive: true
});

const rows = (data.players || []).map((player) => ({
  i: Number(player.id),
  n: player.name || "",
  y: player.birthDate
    ? Number(String(player.birthDate).slice(0, 4))
    : null,
  c: player.nationalityCode || player.nationality || null,
  p: Array.isArray(player.position)
    ? player.position
    : (player.position ? [player.position] : []),
  k: (player.clubIds || []).map(Number),
  a: Number(player.appearances) || 0,
  g: Number(player.goals) || 0,
  s: Number(player.assists) || 0,
  nc: Number(player.nationalCaps) || 0,
  ng: Number(player.nationalGoals) || 0,
  cg: Number(player.careerGoals) || 0,
  po: Number(player.popularityScore) || 0,
  pt: player.popularityTier || null,
  t: player.trophyIds || [],
  w: player.awardIds || []
}));

const hash = crypto
  .createHash("sha256")
  .update(
    JSON.stringify({
      count: rows.length,
      first: rows[0]?.i || null,
      last: rows.at(-1)?.i || null
    })
  )
  .digest("hex")
  .slice(0, 12);

const chunkSize = 2500;
const chunks = [];

for (
  let start = 0;
  start < rows.length;
  start += chunkSize
) {
  const index = Math.floor(start / chunkSize);
  const filename =
    `game-${String(index).padStart(3, "0")}.json`;

  const chunk = rows.slice(
    start,
    start + chunkSize
  );

  fs.writeFileSync(
    path.join(outputRoot, filename),
    JSON.stringify(chunk)
  );

  chunks.push({
    url: `data/game-index/${filename}`,
    count: chunk.length
  });
}

const clubs = Object.fromEntries(
  (data.clubs || []).map((club) => [
    String(club.id ?? club.clubId),
    {
      n: club.name || club.clubName || "",
      c: club.countryCode || club.country || null,
      l: club.leagueId || club.league || null,
      o: club.logo || club.logoAsset || null
    }
  ])
);

fs.writeFileSync(
  path.join(outputRoot, "clubs.json"),
  JSON.stringify(clubs)
);

fs.writeFileSync(
  path.join(outputRoot, "manifest.json"),
  JSON.stringify({
    version: hash,
    generatedAt: new Date().toISOString(),
    totalPlayers: rows.length,
    chunkSize,
    chunks,
    fields: {
      i: "id",
      n: "name",
      y: "birthYear",
      c: "nationality",
      p: "positions",
      k: "clubIds",
      a: "appearances",
      g: "goals",
      s: "assists",
      nc: "nationalCaps",
      ng: "nationalGoals",
      cg: "careerGoals",
      po: "popularityScore",
      pt: "popularityTier",
      t: "trophyIds",
      w: "awardIds"
    }
  })
);

console.log({
  totalPlayers: rows.length,
  chunks: chunks.length,
  hash
});