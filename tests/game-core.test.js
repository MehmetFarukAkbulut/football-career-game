"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  buildIndexes,
  controlledWrongIds,
  createGridState,
  applyAttempt,
  chooseComputerMove,
  normalizeText,
} = require("../web/game-core");
const data = {
  clubs: [
    { id: 1, league: "A", country: "TR" },
    { id: 2, league: "A", country: "TR" },
    { id: 3, league: "B", country: "DE" },
  ],
  players: [
    { id: 10, name: "Uğur", clubIds: [1, 2], appearances: 2 },
    { id: 11, name: "Solo A", clubIds: [1], appearances: 9 },
    { id: 12, name: "Solo B", clubIds: [2], appearances: 1 },
    { id: 13, name: "Adaş", clubIds: [1] },
    { id: 14, name: "Adaş", clubIds: [2] },
  ],
};
test("indeks ortak oyuncuyu kimlikle bulur ve aynı adlı kişileri birleştirmez", () => {
  const x = buildIndexes(data);
  assert.deepEqual([...x.commonPlayerIds(1, 2)], [10]);
  assert.equal(x.playerById.get(13).name, x.playerById.get(14).name);
  assert.notEqual(13, 14);
});
test("kontrollü yanlış havuzu iki kulüpten biriyle ilişkili gerçek oyunculardan gelir", () => {
  assert.deepEqual(
    new Set(controlledWrongIds(1, 2, buildIndexes(data))),
    new Set([11, 12, 13, 14]),
  );
});
test("yanlış tahmin hücreyi doldurmadan sırayı değiştirir", () => {
  const state = createGridState({ mode: "duo" });
  state.grid = { marks: Array(9).fill(null) };
  const next = applyAttempt(state, {
    cellIndex: 0,
    playerId: 11,
    valid: false,
  });
  assert.equal(next.currentTurn, 1);
  assert.equal(next.grid.marks[0], null);
  assert.equal(next.wrong[0], 1);
});
test("doğru tahmin skor ve kullanılan kimlikleri günceller", () => {
  const state = createGridState();
  state.grid = { marks: Array(9).fill(null) };
  const next = applyAttempt(state, { cellIndex: 0, playerId: 10, valid: true });
  assert.equal(next.scores[0], 1);
  assert.deepEqual(next.usedPlayerIds, [10]);
  assert.equal(next.grid.marks[0].owner, 0);
});
test("kullanılan oyuncu tekrar kullanılamaz", () => {
  const state = createGridState();
  state.grid = { marks: Array(9).fill(null) };
  state.usedPlayerIds = [10];
  assert.throws(
    () => applyAttempt(state, { cellIndex: 1, playerId: 10, valid: true }),
    /PLAYER_USED/,
  );
});
test("yatay üçlü XOX çizgisi oyunu anında bitirir", () => {
  let state = createGridState({ mode: "duo" });
  state.grid = { marks: Array(9).fill(null) };
  for (const [cellIndex, playerId] of [
    [0, 20],
    [3, 21],
    [1, 22],
    [4, 23],
    [2, 24],
  ])
    state = applyAttempt(state, { cellIndex, playerId, valid: true });
  assert.equal(state.status, "finished");
  assert.equal(state.winner, 0);
  assert.deepEqual(state.winningLine, [0, 1, 2]);
});
test("çapraz üçlü XOX çizgisi kazananı belirler", () => {
  let state = createGridState({ mode: "duo" });
  state.grid = { marks: Array(9).fill(null) };
  for (const [cellIndex, playerId] of [
    [0, 30],
    [1, 31],
    [4, 32],
    [2, 33],
    [8, 34],
  ])
    state = applyAttempt(state, { cellIndex, playerId, valid: true });
  assert.equal(state.status, "finished");
  assert.equal(state.winner, 0);
  assert.deepEqual(state.winningLine, [0, 4, 8]);
});
test("bilgisayar deterministik RNG ile kontrollü doğru ve yanlış seçebilir", () => {
  const indexes = buildIndexes(data);
  assert.equal(
    chooseComputerMove({
      rowId: 1,
      colId: 2,
      difficulty: "hard",
      indexes,
      rng: () => 0,
    }).valid,
    true,
  );
  assert.equal(
    chooseComputerMove({
      rowId: 1,
      colId: 2,
      difficulty: "easy",
      indexes,
      rng: () => 0.99,
    }).valid,
    false,
  );
});
test("Türkçe ve Latin aksanları toleranslı normalize edilir", () => {
  assert.equal(normalizeText("Uğur Šøren"), "ugur soren");
});
