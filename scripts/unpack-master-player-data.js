"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "data", "master-player-data.json.gz");
const target = path.join(root, "data", "web-data.json");

if (!fs.existsSync(source)) {
  throw new Error(`Master paket bulunamadi: ${source}`);
}

const payload = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(source)).toString("utf8")
);

if (
  payload.format !== "formax-master-v1" ||
  !payload.data ||
  !Array.isArray(payload.data.players)
) {
  throw new Error("Master paket formati gecersiz.");
}

fs.writeFileSync(
  target,
  JSON.stringify(payload.data),
  "utf8"
);

console.log({
  restoredPlayers: payload.data.players.length,
  target
});