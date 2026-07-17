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
  if (state.usedPlayerIds.includes(playerId)) throw new Error("PLAYER_USED");
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
    next.usedPlayerIds.push(playerId);
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

const api = {
  DIFFICULTIES,
  WINNING_LINES,
  winningLine,
  normalizeText,
  cellKey,
  buildIndexes,
  controlledWrongIds,
  createGridState,
  applyAttempt,
  chooseComputerMove,
};
if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.IkiFormaCore = api;
