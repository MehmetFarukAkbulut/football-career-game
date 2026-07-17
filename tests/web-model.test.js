"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "web-data.json"), "utf8"),
);
test("web verisi lig ve ülke metadata alanlarını içerir", () => {
  assert.equal(data.version, 6);
  assert.ok(data.leagues.length >= 30);
  assert.ok(
    data.leagues.every(
      (l) => l.id && l.name && l.countryCode && l.countryName && l.level === 1,
    ),
  );
});
test("kulüp ve oyuncu kaynak kimlikleri geriye uyumlu alanlarla aynıdır", () => {
  assert.ok(
    data.clubs.every(
      (c) =>
        c.clubId === c.id &&
        c.countryCode &&
        c.leagueId &&
        c.transfermarktClubId === c.id,
    ),
  );
  assert.ok(
    data.players.every(
      (p) =>
        p.playerId === p.id &&
        p.transfermarktPlayerId === p.id &&
        Array.isArray(p.careers),
    ),
  );
});
test("tüm kulüpler lazy-load edilebilir arma URL'si ve fallback metadata'sı taşır",()=>{assert.ok(data.clubs.every(c=>/^https:\/\//.test(c.logoAsset)&&c.logoSource));});
