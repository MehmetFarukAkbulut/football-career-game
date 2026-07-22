"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}

function validateManifest(
  prefix,
  {
    requireClubs = false
  } = {}
) {
  const manifestFile =
    path.join(
      dataDir,
      `${prefix}-manifest.json`
    );

  const bootstrapFile =
    path.join(
      dataDir,
      `${prefix}-bootstrap.json`
    );

  if (!fs.existsSync(manifestFile)) {
    throw new Error(
      `Manifest eksik: ${prefix}`
    );
  }

  if (!fs.existsSync(bootstrapFile)) {
    throw new Error(
      `Bootstrap eksik: ${prefix}`
    );
  }

  const manifest =
    readJson(manifestFile);

  const bootstrap =
    readJson(bootstrapFile);

  let count = 0;

  for (
    const entry of
    manifest.chunks || []
  ) {
    const file =
      path.join(
        root,
        entry.url
      );

    if (!fs.existsSync(file)) {
      throw new Error(
        `Chunk eksik: ${entry.url}`
      );
    }

    const rows =
      readJson(file);

    if (!Array.isArray(rows)) {
      throw new Error(
        `Chunk dizi degil: ${entry.url}`
      );
    }

    if (
      Number.isFinite(
        Number(entry.count)
      ) &&
      rows.length !==
        Number(entry.count)
    ) {
      throw new Error(
        `Chunk count uyusmuyor: ` +
        `${entry.url} ${rows.length} != ${entry.count}`
      );
    }

    count += rows.length;
  }

  if (
    count !==
    Number(manifest.totalPlayers)
  ) {
    throw new Error(
      `${prefix} toplam uyusmuyor: ` +
      `${count} != ${manifest.totalPlayers}`
    );
  }

  /*
   * Career bootstrap kulup metadata'si tasir.
   * FC26 bootstrap ise rating odakli ayri bir paket oldugu icin
   * clubs alani bulundurmak zorunda degildir.
   */
  if (
    requireClubs &&
    !Array.isArray(bootstrap.clubs)
  ) {
    throw new Error(
      `${prefix} bootstrap clubs eksik.`
    );
  }

  return {
    prefix,
    players:
      count,

    chunks:
      manifest.chunks?.length || 0,

    clubs:
      Array.isArray(bootstrap.clubs)
        ? bootstrap.clubs.length
        : 0
  };
}

const career =
  validateManifest(
    "career",
    {
      requireClubs: true
    }
  );

const fc26 =
  validateManifest(
    "fc26",
    {
      requireClubs: false
    }
  );

const gameManifestFile =
  path.join(
    dataDir,
    "game-index",
    "manifest.json"
  );

if (!fs.existsSync(gameManifestFile)) {
  throw new Error(
    "Game index manifest eksik."
  );
}

const gameManifest =
  readJson(gameManifestFile);

let gameCount = 0;

for (
  const entry of
  gameManifest.chunks || []
) {
  const file =
    path.join(
      root,
      entry.url
    );

  if (!fs.existsSync(file)) {
    throw new Error(
      `Game index chunk eksik: ${entry.url}`
    );
  }

  const rows =
    readJson(file);

  if (!Array.isArray(rows)) {
    throw new Error(
      `Game index chunk dizi degil: ${entry.url}`
    );
  }

  if (
    Number.isFinite(
      Number(entry.count)
    ) &&
    rows.length !==
      Number(entry.count)
  ) {
    throw new Error(
      `Game index chunk count uyusmuyor: ` +
      `${entry.url} ${rows.length} != ${entry.count}`
    );
  }

  gameCount += rows.length;
}

if (
  gameCount !==
  Number(gameManifest.totalPlayers)
) {
  throw new Error(
    `Game index toplam uyusmuyor: ` +
    `${gameCount} != ${gameManifest.totalPlayers}`
  );
}

console.log({
  career,
  fc26,
  gameIndex: {
    players:
      gameCount,

    chunks:
      gameManifest.chunks?.length || 0
  }
});