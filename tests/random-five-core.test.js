"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomFiveScore, randomFiveRanking, chooseRandomFiveComputer } = require("../web/game-core");

const clubs = [10, 20, 30, 40, 50];
const pool = [
  { id: 1, name: "Üçlü", clubIds: [10, 20, 30], appearances: 400 },
  { id: 2, name: "İkili", clubIds: [20, 40], appearances: 500 },
  { id: 3, name: "Tekli", clubIds: [50], appearances: 600 },
  { id: 4, name: "Yok", clubIds: [99], appearances: 700 },
];

test("rastgele beşler skoru ekrandaki farklı kulüp sayısıdır", () => {
  assert.equal(randomFiveScore(pool[0], clubs), 3);
  assert.equal(randomFiveScore(pool[3], clubs), 0);
});

test("rastgele beşler adayları skorlarına göre sıralanır", () => {
  assert.deepEqual(randomFiveRanking(pool, clubs).map((x) => x.player.id), [1, 2, 3]);
});

test("zor bilgisayar en yüksek skorlu futbolcuyu seçer", () => {
  assert.equal(chooseRandomFiveComputer({ pool, clubIds: clubs, difficulty: "hard", rng: () => 0 }).player.id, 1);
});
