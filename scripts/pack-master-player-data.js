"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "data", "web-data.json");
const target = path.join(root, "data", "master-player-data.json.gz");

if (!fs.existsSync(source)) {
  throw new Error(`Kaynak bulunamadi: ${source}`);
}

const raw = fs.readFileSync(source);
const parsed = JSON.parse(raw.toString("utf8"));

const payload = {
  format: "formax-master-v1",
  packedAt: new Date().toISOString(),
  sourceVersion: parsed.version ?? null,
  data: parsed
};

fs.writeFileSync(
  target,
  zlib.gzipSync(
    Buffer.from(JSON.stringify(payload), "utf8"),
    { level: 9 }
  )
);

const size = fs.statSync(target).size;

console.log({
  sourcePlayers: parsed.players?.length || 0,
  sourceBytes: raw.length,
  packedBytes: size,
  packedMB: Number((size / 1024 / 1024).toFixed(2))
});

if (size >= 95 * 1024 * 1024) {
  throw new Error(
    `master-player-data.json.gz GitHub sinirina yakin: ${(size / 1024 / 1024).toFixed(2)} MB`
  );
}