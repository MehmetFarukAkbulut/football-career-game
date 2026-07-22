"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const bootstrapFile = path.join(dataDir, "career-bootstrap.json");
const manifestFile = path.join(dataDir, "career-manifest.json");
const outputFile = path.join(dataDir, "web-data.json");

if (
  !fs.existsSync(bootstrapFile) ||
  !fs.existsSync(manifestFile)
) {
  throw new Error("Career bootstrap/manifest bulunamadi.");
}

const bootstrap = JSON.parse(
  fs.readFileSync(bootstrapFile, "utf8")
);

const manifest = JSON.parse(
  fs.readFileSync(manifestFile, "utf8")
);

const players = [];

for (const entry of manifest.chunks || []) {
  const chunkFile = path.join(root, entry.url);

  if (!fs.existsSync(chunkFile)) {
    throw new Error(`Chunk eksik: ${entry.url}`);
  }

  const rows = JSON.parse(
    fs.readFileSync(chunkFile, "utf8")
  );

  if (!Array.isArray(rows)) {
    throw new Error(`Chunk dizi degil: ${entry.url}`);
  }

  players.push(...rows);
}

if (players.length !== manifest.totalPlayers) {
  throw new Error(
    `Oyuncu sayisi uyusmuyor: ${players.length} != ${manifest.totalPlayers}`
  );
}

const output = {
  ...bootstrap,
  version: manifest.version ?? bootstrap.version ?? null,
  generatedAt: new Date().toISOString(),
  players
};

fs.writeFileSync(
  outputFile,
  JSON.stringify(output),
  "utf8"
);

console.log({
  reconstructedPlayers: players.length,
  chunks: manifest.chunks?.length || 0
});