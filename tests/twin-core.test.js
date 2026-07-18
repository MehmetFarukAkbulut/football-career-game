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

test("ikiz seçenekleri uzaklık dilimlerine yayılır ve bilgisayar aynı havuzu kullanır", () => {
  const { generateTwinOptions, chooseTwinComputerOption } = require("../web/game-core");
  const target = { id: 1, goals: 100 }, pool = [target, ...Array.from({ length: 40 }, (_, i) => ({ id: i + 2, name: `P${i}`, goals: i + 1, appearances: 50 }))];
  const options = generateTwinOptions({ target, pool, metric: "goals", rng: () => 0 });
  assert.equal(options.length, 4);
  assert.ok(new Set(options.map((x) => x.distance)).size >= 3);
  const hard = chooseTwinComputerOption({ options, difficulty: "hard", rng: () => 0 });
  assert.equal(hard.distance, Math.min(...options.map((x) => x.distance)));
  assert.ok(options.some((x) => x.player.id === hard.player.id));
});
