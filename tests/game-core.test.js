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
  getValidPlayersForTwoClubs,
  getOneClubOnlyPlayers,
  getValidPlayersForCountryClub,
  getCountryOnlyDistractors,
  getClubOnlyDistractors,
  generateTwoClubMultipleChoiceQuestion,
  generateCountryClubMultipleChoiceQuestion,
  validateQuestionOptions,
  selectClubByDifficulty,
} = require("../web/game-core");
const data = {
  clubs: [
    { id: 1, league: "A", country: "TR" },
    { id: 2, league: "A", country: "TR" },
    { id: 3, league: "B", country: "DE" },
  ],
  players: [
    { id: 10, name: "Uğur", clubIds: [1, 2], appearances: 2, nationalityCode: "TR" },
    { id: 11, name: "Solo A", clubIds: [1], appearances: 9, nationalityCode: "TR" },
    { id: 12, name: "Solo B", clubIds: [2], appearances: 1, nationalityCode: "DE" },
    { id: 13, name: "Adaş", clubIds: [1], nationalityCode: "FR" },
    { id: 14, name: "Adaş", clubIds: [2], nationalityCode: "IT" },
    { id: 15, name: "Diğer Türk", clubIds: [3], appearances: 5, nationalityCode: "TR" },
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
test("iki forma havuzları ortak ve yalnızca tek kulüplü oyuncuları ayırır", () => {
  const indexes = buildIndexes(data);
  assert.deepEqual(getValidPlayersForTwoClubs(1, 2, indexes).map((p) => p.id), [10]);
  assert.deepEqual(new Set(getOneClubOnlyPlayers(1, 2, indexes).map((p) => p.id)), new Set([11, 12, 13, 14]));
});
test("ülke forma havuzları iki koşul, ülke-only ve kulüp-only olarak ayrılır", () => {
  const indexes = buildIndexes(data);
  assert.deepEqual(getValidPlayersForCountryClub("TR", 1, indexes).map((p) => p.id), [10, 11]);
  assert.deepEqual(getCountryOnlyDistractors("TR", 1, indexes).map((p) => p.id), [15]);
  assert.deepEqual(new Set(getClubOnlyDistractors("TR", 1, indexes).map((p) => p.id)), new Set([13]));
});
test("iki forma çoktan seçmeli sorusu tek doğru ve üç kontrollü yanlış üretir", () => {
  const indexes = buildIndexes(data);
  const question = generateTwoClubMultipleChoiceQuestion({ clubAId: 1, clubBId: 2, indexes, rng: () => 0 });
  assert.equal(question.optionPlayerIds.length, 4);
  assert.deepEqual(validateQuestionOptions(question, indexes), { valid: true });
  assert.equal(question.correctPlayerId, 10);
});
test("ülke forma çoktan seçmeli sorusu ilgisiz oyuncuyu kabul etmez", () => {
  const countryData = { ...data, players: [...data.players, { id: 16, name: "Kulüp Alman", clubIds: [1], nationalityCode: "DE" }, { id: 17, name: "Kulüp İtalyan", clubIds: [1], nationalityCode: "IT" }] };
  const indexes = buildIndexes(countryData);
  const question = generateCountryClubMultipleChoiceQuestion({ countryCode: "TR", clubId: 1, indexes, optionCount: 2, rng: () => 0 });
  assert.deepEqual(validateQuestionOptions(question, indexes), { valid: true });
  assert.ok(!question.optionPlayerIds.includes(12));
});
test("doğrulama duplicate seçenekleri ve aynı isimli farklı ID'leri doğru ele alır", () => {
  const indexes = buildIndexes(data);
  const duplicate = { mode: "clubs", clubAId: 1, clubBId: 2, correctPlayerId: 10, optionPlayerIds: [10, 11, 12, 12] };
  assert.equal(validateQuestionOptions(duplicate, indexes).reason, "DUPLICATE_OPTION");
  const valid = { ...duplicate, optionPlayerIds: [10, 11, 13, 14] };
  assert.deepEqual(validateQuestionOptions(valid, indexes), { valid: true });
});
test("kolay havuz obscure kulüpleri dışarıda bırakır, zor havuz geniştir", () => {
  const sample = [{ id: 1, popularityTier: "elite" }, { id: 2, popularityTier: "obscure" }];
  assert.equal(selectClubByDifficulty(sample, "easy", () => 0.99).id, 1);
  assert.equal(selectClubByDifficulty(sample, "hard", () => 0.99).id, 2);
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
test("doğru tahmin skoru günceller ve oyuncuyu tekrar kullanılabilir bırakır", () => {
  const state = createGridState();
  state.grid = { marks: Array(9).fill(null) };
  const next = applyAttempt(state, { cellIndex: 0, playerId: 10, valid: true });
  assert.equal(next.scores[0], 1);
  assert.deepEqual(next.usedPlayerIds, []);
  assert.equal(next.grid.marks[0].owner, 0);
});
test("kullanılan oyuncu farklı hücrede tekrar kullanılabilir", () => {
  const state = createGridState();
  state.grid = { marks: Array(9).fill(null) };
  state.usedPlayerIds = [10];
  const next = applyAttempt(state, { cellIndex: 1, playerId: 10, valid: true });
  assert.equal(next.grid.marks[1].playerId, 10);
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

test("ülke-kulüp seçeneklerinin tamamı hedef ülke vatandaşıdır", () => {
  const core = require("../web/game-core"), indexes = buildIndexes({ ...data, players: [...data.players,
    { id: 16, name: "Türk 3", clubIds: [3], nationalityCode: "TR" },
    { id: 17, name: "Türk 4", clubIds: [3], nationalityCode: "TR" },
  ] });
  const question = core.generateCountryClubMultipleChoiceQuestion({ countryCode: "TR", clubId: 1, indexes, rng: () => 0 });
  assert.ok(question);
  assert.ok(question.optionPlayerIds.every((id) => core.playerNationalityCode(indexes.playerById.get(id)) === "TR"));
});

test("zorluk havuzu zor-normal-kolay sırasıyla tekrarsız tamamlanır", () => {
  const { fillQuestionPoolByDifficulty } = require("../web/game-core");
  const pools = { hard: [{ key: "h" }], normal: [{ key: "h" }, { key: "n" }], easy: [{ key: "e" }] };
  assert.deepEqual(fillQuestionPoolByDifficulty(pools, "hard", 3).map((x) => x.key), ["h", "n", "e"]);
  assert.deepEqual(fillQuestionPoolByDifficulty(pools, "normal", 2).map((x) => x.key), ["h", "n"]);
});

test("ızgara kulüp, lig, ülke ve karışık kriter kesişimlerini doğrular", () => {
  const core = require("../web/game-core"), indexes = buildIndexes(data);
  indexes.leagueClubIds.set("GB1", new Set([1]));
  const club1 = { type: "club", id: 1 }, club2 = { type: "club", id: 2 }, league = { type: "league", id: "GB1" }, country = { type: "country", code: "TR" };
  assert.deepEqual(core.getPlayersForCriteria(club1, club2, indexes).map((p) => p.id), [10]);
  assert.deepEqual(core.getPlayersForCriteria(league, club2, indexes).map((p) => p.id), [10]);
  assert.deepEqual(new Set(core.getPlayersForCriteria(country, club1, indexes).map((p) => p.id)), new Set([10, 11]));
  assert.ok(core.generateCriteriaMultipleChoiceQuestion({ first: club1, second: club2, indexes, rng: () => 0 }));
});
