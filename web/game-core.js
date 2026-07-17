"use strict";

const DIFFICULTIES = {
  easy: { accuracy: 0.52, delay: [1800, 3500] },
  normal: { accuracy: 0.72, delay: [1000, 2400] },
  hard: { accuracy: 0.9, delay: [500, 1400] },
};

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winningLine(marks = []) {
  return (
    WINNING_LINES.find(([a, b, c]) => {
      const owner = marks[a]?.owner;
      return (
        owner !== undefined &&
        marks[b]?.owner === owner &&
        marks[c]?.owner === owner
      );
    }) || null
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .toLocaleLowerCase("tr-TR");
}
function cellKey(a, b) {
  return [+a, +b].sort((x, y) => x - y).join(":");
}

function buildIndexes(data) {
  const clubById = new Map(data.clubs.map((c) => [+c.id, c]));
  const playerById = new Map(data.players.map((p) => [+p.id, p]));
  const clubPlayerIds = new Map(data.clubs.map((c) => [+c.id, new Set()]));
  const playerClubIds = new Map();
  const leagueClubIds = new Map();
  const countryLeagueIds = new Map();
  for (const c of data.clubs) {
    const leagueId = c.leagueId || `${c.countryCode || c.country}:${c.league}`;
    if (!leagueClubIds.has(leagueId)) leagueClubIds.set(leagueId, new Set());
    leagueClubIds.get(leagueId).add(+c.id);
    const country = c.countryCode || c.country;
    if (!countryLeagueIds.has(country))
      countryLeagueIds.set(country, new Set());
    countryLeagueIds.get(country).add(leagueId);
  }
  for (const p of data.players) {
    const ids = new Set(p.clubIds.map(Number));
    playerClubIds.set(+p.id, ids);
    for (const id of ids) clubPlayerIds.get(id)?.add(+p.id);
  }
  const cellPlayers = new Map();
  const commonPlayerIds = (a, b) => {
    const key = cellKey(a, b);
    if (cellPlayers.has(key)) return cellPlayers.get(key);
    const left = clubPlayerIds.get(+a) || new Set(),
      right = clubPlayerIds.get(+b) || new Set();
    const result = new Set([...left].filter((id) => right.has(id)));
    cellPlayers.set(key, result);
    return result;
  };
  return {
    clubById,
    playerById,
    clubPlayerIds,
    playerClubIds,
    leagueClubIds,
    countryLeagueIds,
    cellPlayers,
    commonPlayerIds,
  };
}

function controlledWrongIds(rowId, colId, indexes, used = new Set()) {
  const row = indexes.clubPlayerIds.get(+rowId) || new Set(),
    col = indexes.clubPlayerIds.get(+colId) || new Set();
  const valid = indexes.commonPlayerIds(rowId, colId),
    out = [];
  for (const id of new Set([...row, ...col]))
    if (!valid.has(id) && !used.has(id)) out.push(id);
  return out;
}

function playerNationalityCode(player) {
  return String(
    player?.nationalityCode || player?.countryCode || player?.nationality?.code || "",
  ).toUpperCase();
}

function getValidPlayersForTwoClubs(clubAId, clubBId, indexes, used = new Set()) {
  return [...indexes.commonPlayerIds(clubAId, clubBId)]
    .filter((id) => !used.has(id) && indexes.playerById.has(id))
    .map((id) => indexes.playerById.get(id));
}

function getOneClubOnlyPlayers(clubAId, clubBId, indexes, used = new Set()) {
  const a = indexes.clubPlayerIds.get(+clubAId) || new Set();
  const b = indexes.clubPlayerIds.get(+clubBId) || new Set();
  return [...new Set([...a, ...b])]
    .filter((id) => a.has(id) !== b.has(id) && !used.has(id))
    .map((id) => indexes.playerById.get(id))
    .filter(Boolean);
}

function getValidPlayersForCountryClub(countryCode, clubId, indexes, used = new Set()) {
  const club = indexes.clubPlayerIds.get(+clubId) || new Set();
  const code = String(countryCode || "").toUpperCase();
  return [...club]
    .map((id) => indexes.playerById.get(id))
    .filter((player) => player && !used.has(+player.id) && playerNationalityCode(player) === code);
}

function getCountryOnlyDistractors(countryCode, clubId, indexes, used = new Set()) {
  const club = indexes.clubPlayerIds.get(+clubId) || new Set();
  const code = String(countryCode || "").toUpperCase();
  return [...indexes.playerById.values()].filter(
    (player) =>
      !used.has(+player.id) &&
      playerNationalityCode(player) === code &&
      !club.has(+player.id),
  );
}

function getClubOnlyDistractors(countryCode, clubId, indexes, used = new Set()) {
  const club = indexes.clubPlayerIds.get(+clubId) || new Set();
  const code = String(countryCode || "").toUpperCase();
  return [...club]
    .map((id) => indexes.playerById.get(id))
    .filter(
      (player) =>
        player &&
        !used.has(+player.id) &&
        playerNationalityCode(player) !== code,
    );
}

function shuffled(values, rng = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function optionRelation(question, player, indexes) {
  const clubs = indexes.playerClubIds.get(+player?.id) || new Set();
  if (question.mode === "clubs")
    return [clubs.has(+question.clubAId), clubs.has(+question.clubBId)];
  return [
    playerNationalityCode(player) === String(question.countryCode).toUpperCase(),
    clubs.has(+question.clubId),
  ];
}

function validateQuestionOptions(question, indexes, used = new Set()) {
  if (!question || !Array.isArray(question.optionPlayerIds))
    return { valid: false, reason: "OPTIONS_MISSING" };
  const ids = question.optionPlayerIds.map(Number);
  if (new Set(ids).size !== ids.length)
    return { valid: false, reason: "DUPLICATE_OPTION" };
  if (ids.some((id) => used.has(id)))
    return { valid: false, reason: "PLAYER_REUSED" };
  const players = ids.map((id) => indexes.playerById.get(id));
  if (players.some((player) => !player?.name || !(player.clubIds || []).length))
    return { valid: false, reason: "BROKEN_PLAYER_DATA" };
  const relations = players.map((player) => optionRelation(question, player, indexes));
  const correct = relations
    .map((conditions, index) => ({ conditions, id: ids[index] }))
    .filter(({ conditions }) => conditions[0] && conditions[1]);
  if (correct.length !== 1 || correct[0].id !== +question.correctPlayerId)
    return { valid: false, reason: "CORRECT_COUNT" };
  if (relations.some((conditions, index) => ids[index] !== +question.correctPlayerId && conditions.filter(Boolean).length !== 1))
    return { valid: false, reason: "INVALID_DISTRACTOR" };
  return { valid: true };
}

function playerDifficultyScore(player) {
  return Number(player?.popularityScore) || Math.min(100, Math.log10(1 + Number(player?.appearances || 0)) * 28);
}

function selectPlayerByDifficulty(players, difficulty = "normal", rng = Math.random) {
  if (!players?.length) return null;
  const sorted = [...players].sort((a, b) => playerDifficultyScore(b) - playerDifficultyScore(a));
  const portion = difficulty === "easy" ? 0.35 : difficulty === "hard" ? 1 : 0.7;
  const pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * portion)));
  return pool[Math.floor(rng() * pool.length)];
}

function clubAllowedByDifficulty(club, difficulty) {
  const tier = club?.popularityTier || "standard";
  if (difficulty === "easy") return tier === "elite" || tier === "popular";
  if (difficulty === "normal") return tier !== "obscure";
  return true;
}

function selectClubByDifficulty(clubs, difficulty = "normal", rng = Math.random) {
  const pool = (clubs || []).filter((club) => clubAllowedByDifficulty(club, difficulty));
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

function makeQuestionId(rng) {
  return `q-${Date.now().toString(36)}-${Math.floor(rng() * 0x1000000).toString(36)}`;
}

function generateTwoClubMultipleChoiceQuestion({ clubAId, clubBId, indexes, used = new Set(), difficulty = "normal", optionCount = 4, rng = Math.random }) {
  const valid = getValidPlayersForTwoClubs(clubAId, clubBId, indexes, used);
  const wrong = getOneClubOnlyPlayers(clubAId, clubBId, indexes, used);
  if (!valid.length || wrong.length < optionCount - 1) return null;
  const correct = selectPlayerByDifficulty(valid, difficulty, rng);
  const distractors = shuffled(wrong, rng).slice(0, optionCount - 1);
  const question = {
    questionId: makeQuestionId(rng), mode: "clubs", clubAId: +clubAId,
    clubBId: +clubBId, correctPlayerId: +correct.id,
    optionPlayerIds: shuffled([correct, ...distractors], rng).map((player) => +player.id),
  };
  return validateQuestionOptions(question, indexes, used).valid ? question : null;
}

function generateCountryClubMultipleChoiceQuestion({ countryCode, clubId, indexes, used = new Set(), difficulty = "normal", optionCount = 4, rng = Math.random }) {
  const valid = getValidPlayersForCountryClub(countryCode, clubId, indexes, used);
  const countryOnly = getCountryOnlyDistractors(countryCode, clubId, indexes, used);
  const clubOnly = getClubOnlyDistractors(countryCode, clubId, indexes, used);
  const wrong = shuffled([...countryOnly, ...clubOnly], rng);
  if (!valid.length || wrong.length < optionCount - 1) return null;
  const correct = selectPlayerByDifficulty(valid, difficulty, rng);
  const question = {
    questionId: makeQuestionId(rng), mode: "country", countryCode: String(countryCode).toUpperCase(),
    clubId: +clubId, correctPlayerId: +correct.id,
    optionPlayerIds: shuffled([correct, ...wrong.slice(0, optionCount - 1)], rng).map((player) => +player.id),
  };
  return validateQuestionOptions(question, indexes, used).valid ? question : null;
}

function createGridState({
  mode = "computer",
  difficulty = "normal",
  names = [],
} = {}) {
  const second =
    mode === "computer" ? "Bilgisayar" : names[1]?.trim() || "Oyuncu 2";
  return {
    version: 1,
    mode,
    difficulty,
    currentTurn: 0,
    players: [
      { name: names[0]?.trim() || "Oyuncu 1", mark: "X" },
      { name: second, mark: "O", computer: mode === "computer" },
    ],
    scores: [0, 0],
    correct: [0, 0],
    wrong: [0, 0],
    grid: null,
    selectedCell: null,
    usedPlayerIds: [],
    attempts: {},
    history: [],
    status: "playing",
    thinking: false,
  };
}

function applyAttempt(state, { cellIndex, playerId, valid }) {
  if (state.status !== "playing" || state.thinking)
    throw new Error("GAME_LOCKED");
  const key = String(cellIndex),
    attempted = state.attempts[key] || [];
  if (attempted.includes(playerId)) throw new Error("ATTEMPT_REPEATED");
  const turn = state.currentTurn,
    next = {
      ...state,
      scores: [...state.scores],
      correct: [...state.correct],
      wrong: [...state.wrong],
      usedPlayerIds: [...state.usedPlayerIds],
      attempts: { ...state.attempts, [key]: [...attempted, playerId] },
      history: [...state.history],
      selectedCell: null,
    };
  if (valid) {
    next.scores[turn]++;
    next.correct[turn]++;
    next.grid = { ...state.grid, marks: [...state.grid.marks] };
    next.grid.marks[cellIndex] = { owner: turn, playerId };
  } else next.wrong[turn]++;
  next.history.push({ turn, cellIndex, playerId, valid });
  next.currentTurn = turn ? 0 : 1;
  const line = next.grid ? winningLine(next.grid.marks) : null;
  if (line) {
    next.status = "finished";
    next.winner = turn;
    next.winningLine = line;
  } else if (next.grid?.marks.every(Boolean)) {
    next.status = "finished";
    next.winner = null;
  }
  return next;
}

function chooseComputerMove({
  rowId,
  colId,
  difficulty = "normal",
  indexes,
  used = new Set(),
  rng = Math.random,
}) {
  const profile = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const valid = [...indexes.commonPlayerIds(rowId, colId)].filter(
    (id) => !used.has(id),
  );
  const wrong = controlledWrongIds(rowId, colId, indexes, used);
  const correct = valid.length && (!wrong.length || rng() < profile.accuracy),
    pool = correct ? valid : wrong;
  if (!pool.length) return null;
  const sorted = [...pool].sort(
    (a, b) =>
      (indexes.playerById.get(b)?.appearances || 0) -
      (indexes.playerById.get(a)?.appearances || 0),
  );
  const candidates =
    difficulty === "easy"
      ? sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 3)))
      : sorted;
  const id = candidates[Math.floor(rng() * candidates.length)];
  return {
    playerId: id,
    valid: correct,
    delay: Math.round(
      profile.delay[0] + rng() * (profile.delay[1] - profile.delay[0]),
    ),
  };
}

const TWIN_METRICS = Object.freeze([
  { key: "appearances", label: "Kulüp maçı" },
  { key: "goals", label: "Kulüp golü" },
  { key: "assists", label: "Asist" },
  { key: "nationalGoals", label: "Milli takım golü" },
]);

function careerTwinRanking(target, pool, metric, excluded = new Set()) {
  const targetValue = Number(target?.[metric]);
  if (!Number.isFinite(targetValue)) return [];
  return pool
    .filter((player) => player?.id !== target.id && !excluded.has(player?.id) && Number.isFinite(Number(player?.[metric])))
    .map((player) => ({ player, value: Number(player[metric]), distance: Math.abs(Number(player[metric]) - targetValue) }))
    .sort((a, b) => a.distance - b.distance || (Number(b.player.appearances) || 0) - (Number(a.player.appearances) || 0) || String(a.player.name).localeCompare(String(b.player.name)));
}

function chooseTwinComputerGuess({ target, pool, metric, difficulty = "normal", excluded = new Set(), rng = Math.random }) {
  const ranking = careerTwinRanking(target, pool, metric, excluded);
  if (!ranking.length) return null;
  let start = 0, end = Math.min(3, ranking.length);
  if (difficulty === "normal") {
    start = Math.min(3, ranking.length - 1);
    end = Math.min(ranking.length, Math.max(start + 1, Math.ceil(ranking.length * 0.12)));
  } else if (difficulty === "easy") {
    start = Math.min(Math.floor(ranking.length * 0.15), ranking.length - 1);
    end = Math.min(ranking.length, Math.max(start + 1, Math.ceil(ranking.length * 0.45)));
  }
  return ranking[start + Math.floor(rng() * (end - start))];
}

function scoreTwinGuesses(target, metric, first, second) {
  const targetValue = Number(target?.[metric]), firstDistance = Math.abs(Number(first?.[metric]) - targetValue), secondDistance = Math.abs(Number(second?.[metric]) - targetValue);
  return { targetValue, distances: [firstDistance, secondDistance], winner: firstDistance === secondDistance ? null : firstDistance < secondDistance ? 0 : 1 };
}

function randomFiveScore(player, clubIds) {
  const career = new Set((player?.clubIds || []).map(Number));
  return clubIds.reduce((score, id) => score + (career.has(Number(id)) ? 1 : 0), 0);
}

function randomFiveRanking(pool, clubIds, excluded = new Set()) {
  return pool
    .filter((player) => !excluded.has(player?.id))
    .map((player) => ({ player, score: randomFiveScore(player, clubIds) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (Number(b.player.appearances) || 0) - (Number(a.player.appearances) || 0));
}

function chooseRandomFiveComputer({ pool, clubIds, difficulty = "normal", excluded = new Set(), rng = Math.random }) {
  const ranking = randomFiveRanking(pool, clubIds, excluded);
  if (!ranking.length) return null;
  const best = ranking[0].score;
  let candidates = ranking.filter((entry) => entry.score === best);
  if (difficulty === "normal") candidates = ranking.filter((entry) => entry.score >= Math.max(1, best - 1));
  if (difficulty === "easy") candidates = ranking.filter((entry) => entry.score >= Math.max(1, best - 2));
  return candidates[Math.floor(rng() * candidates.length)];
}

const api = {
  DIFFICULTIES,
  WINNING_LINES,
  winningLine,
  normalizeText,
  cellKey,
  buildIndexes,
  controlledWrongIds,
  playerNationalityCode,
  getValidPlayersForTwoClubs,
  getOneClubOnlyPlayers,
  getValidPlayersForCountryClub,
  getCountryOnlyDistractors,
  getClubOnlyDistractors,
  validateQuestionOptions,
  optionRelation,
  selectClubByDifficulty,
  selectPlayerByDifficulty,
  generateTwoClubMultipleChoiceQuestion,
  generateCountryClubMultipleChoiceQuestion,
  createGridState,
  applyAttempt,
  chooseComputerMove,
  TWIN_METRICS,
  careerTwinRanking,
  chooseTwinComputerGuess,
  scoreTwinGuesses,
  randomFiveScore,
  randomFiveRanking,
  chooseRandomFiveComputer,
};
if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.IkiFormaCore = api;
