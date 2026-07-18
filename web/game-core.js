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
  const nationalityPlayerIds = new Map();
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
    const nationality = playerNationalityCode(p);
    if (!nationalityPlayerIds.has(nationality)) nationalityPlayerIds.set(nationality, new Set());
    nationalityPlayerIds.get(nationality).add(+p.id);
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
    nationalityPlayerIds,
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
  // Milliyet secenek kartinda cevabi ele vermesin: tum secenekler hedef ulkeden.
  const wrong = shuffled(countryOnly, rng);
  if (!valid.length || wrong.length < optionCount - 1) return null;
  const correct = selectPlayerByDifficulty(valid, difficulty, rng);
  const question = {
    questionId: makeQuestionId(rng), mode: "country", countryCode: String(countryCode).toUpperCase(),
    clubId: +clubId, correctPlayerId: +correct.id,
    optionPlayerIds: shuffled([correct, ...wrong.slice(0, optionCount - 1)], rng).map((player) => +player.id),
  };
  return validateQuestionOptions(question, indexes, used).valid ? question : null;
}

const GRID_LEAGUE_IDS = Object.freeze(["GB1", "ES1", "IT1", "L1", "FR1", "TR1"]);

function playerMatchesCriterion(player, criterion, indexes) {
  if (!player || !criterion) return false;
  const career = indexes.playerClubIds.get(+player.id) || new Set();
  if (criterion.type === "club") return career.has(+criterion.id);
  if (criterion.type === "country")
    return playerNationalityCode(player) === String(criterion.code || criterion.id).toUpperCase();
  if (criterion.type === "league") {
    const leagueClubs = indexes.leagueClubIds.get(criterion.id) || new Set();
    return [...career].some((clubId) => leagueClubs.has(clubId));
  }
  return false;
}

function getPlayersForCriteria(first, second, indexes, used = new Set()) {
  const idsFor = (criterion) => {
    if (criterion.type === "club") return indexes.clubPlayerIds.get(+criterion.id) || new Set();
    if (criterion.type === "country") return indexes.nationalityPlayerIds.get(String(criterion.code || criterion.id).toUpperCase()) || new Set();
    const ids = new Set();
    for (const clubId of indexes.leagueClubIds.get(criterion.id) || [])
      for (const playerId of indexes.clubPlayerIds.get(clubId) || []) ids.add(playerId);
    return ids;
  };
  const left = idsFor(first), right = idsFor(second);
  return [...(left.size <= right.size ? left : right)]
    .filter((id) => !used.has(+id) && left.has(id) && right.has(id))
    .map((id) => indexes.playerById.get(+id)).filter(Boolean);
}

function getOneCriterionOnlyPlayers(first, second, indexes, used = new Set()) {
  return [...indexes.playerById.values()].filter((player) => {
    if (used.has(+player.id)) return false;
    return playerMatchesCriterion(player, first, indexes) !== playerMatchesCriterion(player, second, indexes);
  });
}

function getCountryCriterionDistractors(country, other, indexes, used = new Set()) {
  const countryCode = String(country.code || country.id).toUpperCase();
  return [...(indexes.nationalityPlayerIds.get(countryCode) || new Set())]
    .filter((id) => !used.has(+id))
    .map((id) => indexes.playerById.get(+id))
    .filter((player) => player && !playerMatchesCriterion(player, other, indexes));
}

function generateCriteriaMultipleChoiceQuestion({ first, second, indexes, used = new Set(), difficulty = "normal", optionCount = 4, rng = Math.random }) {
  const correctPool = getPlayersForCriteria(first, second, indexes, used);
  let wrongPool;
  const country = first.type === "country" ? first : second.type === "country" ? second : null;
  const other = country ? (first === country ? second : first) : null;
  if (country)
    wrongPool = getCountryCriterionDistractors(country, other, indexes, used);
  else wrongPool = getOneCriterionOnlyPlayers(first, second, indexes, used);
  if (!correctPool.length || wrongPool.length < optionCount - 1) return null;
  const correct = selectPlayerByDifficulty(correctPool, difficulty, rng);
  const options = shuffled([correct, ...shuffled(wrongPool, rng).slice(0, optionCount - 1)], rng);
  const correctCount = options.filter((player) => playerMatchesCriterion(player, first, indexes) && playerMatchesCriterion(player, second, indexes)).length;
  if (correctCount !== 1 || new Set(options.map((player) => +player.id)).size !== options.length) return null;
  return { questionId: makeQuestionId(rng), mode: "criteria", first, second, correctPlayerId: +correct.id, optionPlayerIds: options.map((player) => +player.id) };
}

function fillQuestionPoolByDifficulty(pools, requestedDifficulty, count) {
  const order = requestedDifficulty === "hard" ? ["hard", "normal", "easy"] : requestedDifficulty === "normal" ? ["normal", "easy"] : ["easy"];
  const result = [], seen = new Set();
  for (const difficulty of order) {
    for (const item of pools[difficulty] || []) {
      const key = item.key || item.questionId || JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key); result.push({ ...item, sourceDifficulty: difficulty });
      if (result.length >= count) return result;
    }
  }
  return result;
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
    choiceQuestions: {},
    questionSeed: Math.floor(Math.random() * 0x100000000),
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
  next.currentTurn = (turn + 1) % Math.max(2, state.players?.length || 2);
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

function generateRandomFiveOptions({ pool, clubIds, difficulty = "normal", excluded = new Set(), rng = Math.random }) {
  const entries = pool.filter((p) => !excluded.has(+p.id)).map((player) => ({ player, score: randomFiveScore(player, clubIds) }));
  const best = Math.max(...entries.map((entry) => entry.score));
  if (!Number.isFinite(best) || best < 1) return null;
  const take = (predicate, used) => shuffled(entries.filter((entry) => predicate(entry) && !used.has(+entry.player.id)), rng)[0];
  const used = new Set(), chosen = [];
  const add = (entry) => { if (entry) { used.add(+entry.player.id); chosen.push(entry); } };
  add(take((entry) => entry.score === best, used));
  if (difficulty === "normal") {
    add(take((entry) => entry.score === 1, used));
    add(take((entry) => entry.score === 0, used));
    add(take((entry) => entry.score === 0, used));
  } else if (difficulty === "easy") {
    add(take((entry) => entry.score >= 2 && entry.score < best, used));
    add(take((entry) => entry.score <= 1, used));
    add(take((entry) => entry.score <= 1, used));
  } else {
    for (let gap = 1; chosen.length < 4 && gap <= best; gap++)
      while (chosen.length < 4) { const entry = take((item) => item.score === best - gap, used); if (!entry) break; add(entry); }
  }
  for (const entry of shuffled(entries, rng)) { if (chosen.length >= 4) break; if (!used.has(+entry.player.id) && entry.score < best) add(entry); }
  if (chosen.length !== 4 || chosen.slice(1).some((entry) => entry.score === best)) return null;
  return shuffled(chosen, rng);
}

function generateTwinOptions({ target, pool, metric, excluded = new Set(), rng = Math.random }) {
  const ranking = careerTwinRanking(target, pool, metric, excluded).filter((entry) => entry.distance > 0);
  if (ranking.length < 4) return null;
  const ranges = [[0, .12], [.2, .45], [.5, .75], [.8, 1]], chosen = [], usedDistances = new Set();
  for (const [start, end] of ranges) {
    const from = Math.min(ranking.length - 1, Math.floor(ranking.length * start));
    const to = Math.max(from + 1, Math.ceil(ranking.length * end));
    let candidates = ranking.slice(from, to).filter((entry) => !chosen.some((x) => x.player.id === entry.player.id) && !usedDistances.has(entry.distance));
    if (!candidates.length) candidates = ranking.slice(from, to).filter((entry) => !chosen.some((x) => x.player.id === entry.player.id));
    const entry = candidates[Math.floor(rng() * candidates.length)];
    if (!entry) return null;
    chosen.push(entry); usedDistances.add(entry.distance);
  }
  return shuffled(chosen, rng);
}

function chooseTwinComputerOption({ options, difficulty = "normal", rng = Math.random }) {
  if (!options?.length) return null;
  const sorted = [...options].sort((a, b) => a.distance - b.distance);
  const weights = difficulty === "hard" ? [7, 2, 1, .5] : difficulty === "easy" ? [1, 2, 3, 4] : [4, 3, 2, 1];
  const total = weights.slice(0, sorted.length).reduce((sum, value) => sum + value, 0);
  let roll = rng() * total;
  for (let i = 0; i < sorted.length; i++) { roll -= weights[i]; if (roll <= 0) return sorted[i]; }
  return sorted.at(-1);
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

function ratingPairGapRange(difficulty = "normal") {
  if (difficulty === "easy") return [5, Infinity];
  if (difficulty === "hard") return [1, 2];
  return [2, 5];
}

function generateRatingPair(players, difficulty = "normal", rng = Math.random) {
  const valid = (players || []).filter((player) => Number.isFinite(+player.overall));
  const [minimum, maximum] = ratingPairGapRange(difficulty);
  for (let attempt = 0; attempt < 250; attempt++) {
    const left = valid[Math.floor(rng() * valid.length)];
    const candidates = valid.filter((right) => right.eaId !== left?.eaId && Math.abs(+right.overall - +left.overall) >= minimum && Math.abs(+right.overall - +left.overall) <= maximum);
    const right = candidates[Math.floor(rng() * candidates.length)];
    if (left && right) return rng() < .5 ? [left, right] : [right, left];
  }
  return null;
}

function compareRatingPlayers(left, right, selectedId) {
  if (!left || !right || +left.overall === +right.overall) return null;
  const correctId = +left.overall > +right.overall ? +left.eaId : +right.eaId;
  return { correctId, isCorrect: +selectedId === correctId };
}

function evaluateMysteryGuess(target, guess) {
  if (!target || !guess) return null;
  const direction = (targetValue, guessValue) => +targetValue === +guessValue ? "equal" : +targetValue > +guessValue ? "up" : "down";
  const targetPositions = new Set([target.position, ...(target.alternativePositions || [])]);
  const guessPositions = [guess.position, ...(guess.alternativePositions || [])];
  return {
    correct: +target.eaId === +guess.eaId,
    nation: target.nation === guess.nation ? "exact" : "wrong",
    team: target.team === guess.team ? "exact" : "wrong",
    position: guessPositions.some((position) => targetPositions.has(position)) ? "exact" : "wrong",
    age: direction(target.age, guess.age),
    overall: direction(target.overall, guess.overall),
  };
}

function playerMatchesHexCriterion(player, criterion, clubById = new Map()) {
  if (!player || !criterion) return false;
  if (criterion.type === "club") return (player.clubIds || []).includes(+criterion.value);
  if (criterion.type === "league") return (player.clubIds || []).some((id) => {
    const club = clubById.get(+id);
    return club?.leagueId === criterion.value || club?.league === criterion.value;
  });
  if (criterion.type === "nation") return player.nationalityCode === criterion.value || player.nationality === criterion.value;
  if (criterion.type === "birthDecade") return Number(String(player.birthDate || "").slice(0, 4)) >= +criterion.value && Number(String(player.birthDate || "").slice(0, 4)) < +criterion.value + 10;
  if (criterion.type === "appearances") return +player.appearances >= +criterion.value;
  if (criterion.type === "goals") return +player.goals >= +criterion.value;
  if (criterion.type === "clubs") return new Set(player.clubIds || []).size >= +criterion.value;
  if (criterion.type === "nationalCaps") return +player.nationalCaps >= +criterion.value;
  return false;
}

function hexNeighbors(cells, target) {
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  return directions.map(([dq, dr]) => cells.find((cell) => cell.q === target.q + dq && cell.r === target.r + dr)).filter(Boolean);
}

function scoreHexMove(newCells, reheatedCells = 0) {
  return (+newCells * (+newCells + 1)) / 2 + +reheatedCells;
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
  GRID_LEAGUE_IDS,
  playerMatchesCriterion,
  getPlayersForCriteria,
  getOneCriterionOnlyPlayers,
  getCountryCriterionDistractors,
  generateCriteriaMultipleChoiceQuestion,
  fillQuestionPoolByDifficulty,
  createGridState,
  applyAttempt,
  chooseComputerMove,
  TWIN_METRICS,
  careerTwinRanking,
  chooseTwinComputerGuess,
  scoreTwinGuesses,
  randomFiveScore,
  randomFiveRanking,
  generateRandomFiveOptions,
  generateTwinOptions,
  chooseTwinComputerOption,
  chooseRandomFiveComputer,
  ratingPairGapRange,
  generateRatingPair,
  compareRatingPlayers,
  evaluateMysteryGuess,
  playerMatchesHexCriterion,
  hexNeighbors,
  scoreHexMove,
};
if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.IkiFormaCore = api;
