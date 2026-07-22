"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const webFile = path.join(root, "data", "web-data.json");

const data =
  JSON.parse(
    fs.readFileSync(webFile, "utf8")
  );

let fixed = 0;

for (const player of data.players || []) {
  const id =
    player.transfermarktPlayerId ??
    player.playerId ??
    player.id ??
    "unknown";

  const fallback =
    `Oyuncu ${id}`;

  if (
    player.name === null ||
    player.name === undefined ||
    String(player.name).trim() === ""
  ) {
    player.name =
      player.playerName &&
      String(player.playerName).trim()
        ? String(player.playerName).trim()
        : fallback;

    fixed++;
  }

  if (
    player.playerName === null ||
    player.playerName === undefined ||
    String(player.playerName).trim() === ""
  ) {
    player.playerName =
      player.name;
  }

  if (
    player.normalized === null ||
    player.normalized === undefined ||
    String(player.normalized).trim() === ""
  ) {
    player.normalized =
      String(player.name)
        .toLocaleLowerCase("tr-TR")
        .replace(/Ä±/g, "i")
        .replace(/ÄŸ/g, "g")
        .replace(/Ã¼/g, "u")
        .replace(/ÅŸ/g, "s")
        .replace(/Ã¶/g, "o")
        .replace(/Ã§/g, "c")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
  }
}

fs.writeFileSync(
  webFile,
  JSON.stringify(data),
  "utf8"
);

console.log(
  `Null/bos oyuncu adi duzeltildi: ${fixed}`
);