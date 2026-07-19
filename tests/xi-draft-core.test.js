"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const core = require("../web/game-core.js");

test("4-3-3 draftı ana ve alternatif mevkileri kabul eder", () => {
  assert.equal(core.XI_SLOTS.length, 11);
  assert.equal(core.playerFitsXiSlot({ position: "LWB", alternativePositions: [] }, "LB"), true);
  assert.equal(core.playerFitsXiSlot({ position: "CAM", alternativePositions: [] }, "CM"), true);
  assert.equal(core.playerFitsXiSlot({ position: "ST", alternativePositions: ["RW"] }, "RW"), true);
  assert.equal(core.playerFitsXiSlot({ position: "GK", alternativePositions: [] }, "ST"), false);
});

test("şans kutusu zorluğa göre yüksek, orta ve düşük reyting dağılımı kullanır", () => {
  assert.deepEqual(core.xiLuckTierCounts("easy"), { high: 2, middle: 2, low: 1 });
  assert.deepEqual(core.xiLuckTierCounts("normal"), { high: 1, middle: 2, low: 2 });
  assert.deepEqual(core.xiLuckTierCounts("hard"), { high: 1, middle: 1, low: 3 });
  const players = Array.from({ length: 50 }, (_, index) => ({ eaId: index + 1, overall: 99 - index }));
  for (const difficulty of ["easy", "normal", "hard"]) {
    const choices = core.generateXiLuckChoices(players, difficulty, () => .1);
    assert.equal(choices.length, 5);
    assert.equal(new Set(choices.map((player) => player.eaId)).size, 5);
    const expected = core.xiLuckTierCounts(difficulty);
    assert.equal(choices.filter((player) => player.eaId <= 10).length, expected.high);
    assert.equal(choices.filter((player) => player.eaId > 10 && player.eaId <= 34).length, expected.middle);
    assert.equal(choices.filter((player) => player.eaId > 34).length, expected.low);
  }
});

test("Şampiyonlar Ligi senaryosu 8 lig maçı ve gerçek eleme turlarını kullanır", () => {
  const result = core.simulateXiTournament({ averageRating: 99, tournament: "ucl", rng: () => 0 });
  assert.equal(result.stages.filter((stage) => stage.stage.startsWith("Lig maçı")).length, 8);
  assert.match(result.outcome, /şampiyonu/i);
  assert.equal(result.matches, 15);
  assert.ok(result.stages.some((stage) => stage.stage === "Final"));
});

test("2026 Dünya Kupası senaryosu 3 grup ve Son 32 dahil en fazla 8 maçtır", () => {
  const result = core.simulateXiTournament({ averageRating: 99, tournament: "worldCup", rng: () => 0 });
  assert.equal(result.stages.filter((stage) => stage.stage.startsWith("Grup maçı")).length, 3);
  assert.ok(result.stages.some((stage) => stage.stage === "Son 32"));
  assert.equal(result.matches, 8);
  assert.match(result.outcome, /şampiyonu/i);
});

test("zorluk rakip reytingini değiştirerek başarı olasılığını etkiler", () => {
  assert.ok(core.tournamentWinChance(84, 80) > core.tournamentWinChance(84, 86));
  const earlyExit = core.simulateXiTournament({ averageRating: 60, tournament: "ucl", difficulty: "hard", rng: () => .99 });
  assert.match(earlyExit.outcome, /Lig etabını/);
  assert.equal(earlyExit.matches, 8);
});

test("Turnuva 11'i menü, lig filtresi, güncel rating ve kariyer eşleşmesini kullanır", async () => {
  const [html, app, updateScript] = await Promise.all([
    fs.readFile(path.join(__dirname, "..", "index.html"), "utf8"),
    fs.readFile(path.join(__dirname, "..", "web", "app.js"), "utf8"),
    fs.readFile(path.join(__dirname, "..", "scripts", "update-fc26-ratings.js"), "utf8"),
  ]);
  assert.match(html, /data-view="xiDraftSetup"/);
  assert.match(html, /id="xiLeagueOptions"/);
  assert.match(html, /id="xiSelectionMode"/);
  assert.match(html, /id="xiNextPick"/);
  assert.match(app, /careerClubIds/);
  assert.match(app, /player\.gender === "M"/);
  assert.match(app, /enhanceLeagueSelector\(\$\("#xiDraftSetup"\)\)/);
  assert.match(updateScript, /careerPlayerId/);
  assert.match(updateScript, /careerClubIds/);
  assert.match(app, /selectionMode === "luck"/);
  assert.match(app, /Kadromda kalsın|Kutuyu değiştir|kalan dört kutu/i);
  assert.match(app, /class="xi-rating" \$\{revealed \? "" : "hidden"\}/);
});

