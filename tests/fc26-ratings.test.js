"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../data/fc26-ratings.json");
const core = require("../web/game-core.js");

test("FC 26 paketi güncel update 2 oyuncularını ve mevkileri içerir", () => {
  assert.equal(data.version, "fc26-update-2");
  assert.ok(data.players.length >= 17000);
  assert.equal(new Set(data.players.map((player) => player.eaId)).size, data.players.length);
  assert.ok(data.players.every((player) => player.name && player.position && player.league && Number.isInteger(player.overall)));
  assert.ok(data.players.every((player) => Array.isArray(player.alternativePositions)));
  assert.equal(data.players.filter((player) => player.cardUrl).length, data.players.length);
});

test("reyting oyunu lig filtresi kullanır ve cevaptan sonra otomatik ilerler", async () => {
  const source = await require("node:fs/promises").readFile(require("node:path").join(__dirname, "..", "web", "app.js"), "utf8");
  const html = await require("node:fs/promises").readFile(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="ratingLeagueOptions"/);
  assert.doesNotMatch(html, /id="ratingNext"/);
  assert.match(source, /selectedLeagues\.has\(player\.league\)/);
  assert.match(source, /ratingTimer = setTimeout\([\s\S]*renderRatingRound\(\);[\s\S]*1800\)/);
});

test("reyting cevabını açan kart alanı yerine kırpılmış portre gösterilir", async () => {
  const css = await require("node:fs/promises").readFile(require("node:path").join(__dirname, "..", "web", "grid.css"), "utf8");
  assert.match(css, /\.rating-card-image \{[^}]*overflow: hidden/);
  assert.match(css, /\.rating-card-image img \{[^}]*object-position:/);
});

test("bilinen FC 26 oyuncularının reyting ve mevki verileri bulunur", () => {
  const salah = data.players.find((player) => player.eaId === 209331);
  assert.deepEqual({ overall: salah.overall, position: salah.position }, { overall: 91, position: "RM" });
  assert.ok(salah.alternativePositions.includes("RW"));
});

test("reyting düellosu zorluğa uygun ve eşit olmayan çift üretir", () => {
  for (const [difficulty, minimum, maximum] of [["easy", 5, Infinity], ["normal", 2, 5], ["hard", 1, 2]]) {
    const pair = core.generateRatingPair(data.players, difficulty, () => .42);
    assert.ok(pair);
    const gap = Math.abs(pair[0].overall - pair[1].overall);
    assert.ok(gap >= minimum && gap <= maximum, `${difficulty}: ${gap}`);
    const result = core.compareRatingPlayers(pair[0], pair[1], pair[0].overall > pair[1].overall ? pair[0].eaId : pair[1].eaId);
    assert.equal(result.isCorrect, true);
  }
});

test("reyting oyunu ana menüde keşif araçlarından önce yer alır", async () => {
  const source = await require("node:fs/promises").readFile(require("node:path").join(__dirname, "..", "web", "app.js"), "utf8");
  const order = source.match(/\["classicSetup", "countrySetup"[^\n]+/)[0];
  assert.ok(order.indexOf('"ratingSetup"') < order.indexOf('"compare"'));
});
