"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { careerTwinRanking, chooseTwinComputerGuess, scoreTwinGuesses } = require("../web/game-core");

test("kariyer ikizi adayları hedef değere yakınlığa göre sıralanır", () => {
  const target = { id: 1, appearances: 465, goals: 43 };
  const pool = [target, { id: 2, name: "Yakın", appearances: 470, goals: 45 }, { id: 3, name: "Uzak", appearances: 600, goals: 80 }];
  assert.deepEqual(careerTwinRanking(target, pool, "goals").map((x) => x.player.id), [2, 3]);
});

test("zor bilgisayar kolay bilgisayardan daha yakın tahmin yapar", () => {
  const target = { id: 1, appearances: 100 };
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: i + 2, name: `P${i}`, appearances: 101 + i }));
  const hard = chooseTwinComputerGuess({ target, pool, metric: "appearances", difficulty: "hard", rng: () => 0 });
  const easy = chooseTwinComputerGuess({ target, pool, metric: "appearances", difficulty: "easy", rng: () => 0 });
  assert.ok(hard.distance < easy.distance);
});

test("kariyer ikizinde hedefe daha yakın tahmin puanı kazanır", () => {
  const result = scoreTwinGuesses({ goals: 43 }, "goals", { goals: 41 }, { goals: 50 });
  assert.equal(result.winner, 0);
  assert.deepEqual(result.distances, [2, 7]);
});
