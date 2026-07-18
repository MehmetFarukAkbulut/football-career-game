"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const core = require("../web/game-core.js");

const clubs = new Map([
  [10, { id: 10, leagueId: "TR1", league: "Süper Lig" }],
  [20, { id: 20, leagueId: "GB1", league: "Premier League" }],
]);
const player = { id: 7, clubIds: [10, 20], nationalityCode: "TR", nationality: "Türkiye", birthDate: "1992-06-01", appearances: 320, goals: 90, nationalCaps: 44 };

test("Kariyer Peteği doğrulanmış kariyer kategorilerini değerlendirir", () => {
  assert.equal(core.playerMatchesHexCriterion(player, { type: "club", value: 10 }, clubs), true);
  assert.equal(core.playerMatchesHexCriterion(player, { type: "league", value: "GB1" }, clubs), true);
  assert.equal(core.playerMatchesHexCriterion(player, { type: "nation", value: "TR" }, clubs), true);
  assert.equal(core.playerMatchesHexCriterion(player, { type: "birthDecade", value: 1990 }, clubs), true);
  assert.equal(core.playerMatchesHexCriterion(player, { type: "appearances", value: 250 }, clubs), true);
  assert.equal(core.playerMatchesHexCriterion(player, { type: "goals", value: 100 }, clubs), false);
  assert.equal(core.playerMatchesHexCriterion(player, { type: "clubs", value: 2 }, clubs), true);
  assert.equal(core.playerMatchesHexCriterion(player, { type: "nationalCaps", value: 30 }, clubs), true);
});

test("altıgen komşuları ve kombinasyon skoru doğru hesaplanır", () => {
  const cells = [{ id: 0, q: 0, r: 0 }, { id: 1, q: 1, r: 0 }, { id: 2, q: 0, r: 1 }, { id: 3, q: 2, r: 0 }];
  assert.deepEqual(core.hexNeighbors(cells, cells[0]).map((cell) => cell.id).sort(), [1, 2]);
  assert.equal(core.scoreHexMove(1, 0), 1);
  assert.equal(core.scoreHexMove(3, 2), 8);
});

test("Kariyer Peteği menü, lig filtresi ve mobil petek düzenini içerir", async () => {
  const [html, source, css] = await Promise.all([
    fs.readFile(path.join(__dirname, "..", "index.html"), "utf8"),
    fs.readFile(path.join(__dirname, "..", "web", "app.js"), "utf8"),
    fs.readFile(path.join(__dirname, "..", "web", "grid.css"), "utf8"),
  ]);
  assert.match(html, /data-view="hexSetup"/);
  assert.match(html, /id="hexLeagueOptions"/);
  assert.match(source, /enhanceLeagueSelector\(\$\("#hexSetup"\)\)/);
  assert.match(source, /hexNeighbors/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.hex-cell \{ width: 68px; height: 79px/);
});
