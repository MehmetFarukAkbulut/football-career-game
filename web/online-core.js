"use strict";
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ROOM_PLAYERS = 5;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function secureRandomBytes(length) {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint8Array(length));
  throw new Error("SECURE_RANDOM_UNAVAILABLE");
}
function generateRoomCode(bytes = secureRandomBytes(6)) {
  return [...bytes].map((byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("").slice(0, 6);
}
function createOnlineRoom({ code, hostName = "Oyuncu 1", settings = {}, now = Date.now() }) {
  return { roomCode: code || generateRoomCode(), stateVersion: 1, status: "waiting", createdAt: now, expiresAt: now + ROOM_TTL_MS, matchNumber: 0, questionSequence: 0, settings: { ...settings, locked: false }, currentTurn: 0, scores: [0], totalScores: [0], usedPlayerIds: [], players: [{ name: hostName.trim() || "Oyuncu 1", ready: false, connected: true, host: true }], question: null, roundAnswers: {}, revealUntil: null, answerResult: null };
}
function assertMutable(state, expectedVersion, now = Date.now()) {
  if (!state) throw new Error("ROOM_NOT_FOUND");
  if (now >= state.expiresAt) throw new Error("ROOM_EXPIRED");
  if (+expectedVersion !== +state.stateVersion) throw new Error("STALE_STATE");
}
function advance(state, patch) { return { ...state, ...patch, stateVersion: state.stateVersion + 1 }; }
function matchIndexFor(state, playerIndex) { return state.matchPlayers?.findIndex((player) => +(player.roomSlot ?? -1) === +playerIndex) ?? playerIndex; }
function joinOnlineRoom(state, { playerName = "Oyuncu 2", expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status === "playing" || state.players.length >= MAX_ROOM_PLAYERS) throw new Error("ROOM_FULL");
  return advance(state, { players: [...state.players, { name: playerName.trim() || `Oyuncu ${state.players.length + 1}`, ready: false, connected: true, host: false }], scores: [...state.scores, 0], totalScores: [...(state.totalScores || state.scores), 0] });
}
function updateConnection(state, { playerIndex, connected, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (!state.players[playerIndex]) throw new Error("PLAYER_NOT_FOUND");
  const players = state.players.map((player, index) => index === playerIndex ? { ...player, connected: Boolean(connected), lastSeenAt: now } : player);
  return advance(state, { players });
}
function setOnlineReady(state, { playerIndex, ready = true, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (!['waiting', 'finished'].includes(state.status) || !state.players[playerIndex]) throw new Error("READY_NOT_ALLOWED");
  const players = state.players.map((player, index) => index === playerIndex ? { ...player, ready: Boolean(ready) } : player);
  return advance(state, { players });
}
function rekeyAfterRemoval(object = {}, removed) { return Object.fromEntries(Object.entries(object).filter(([key]) => +key !== removed).map(([key, value]) => [String(+key > removed ? +key - 1 : +key), value])); }
function leaveOnlineMatch(state, { playerIndex, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  const removed = matchIndexFor(state, playerIndex), roster = state.matchPlayers || [];
  if (state.status !== "playing" || removed < 0) throw new Error("NOT_IN_MATCH");
  const matchResults = { ...(state.matchResults || {}) };
  roster.forEach((player, index) => { matchResults[player.roomSlot] = state.scores[index] || 0; });
  const totalScores = state.players.map((_, index) => matchResults[index] ?? state.totalScores?.[index] ?? 0);
  if (playerIndex === 0 || roster.length - 1 < 2) return advance(state, { status: "finished", finishedAt: now, matchResults, totalScores, settings: { ...state.settings, lastModeState: state.modeState || null }, players: state.players.map((player) => ({ ...player, ready: false })) });
  const matchPlayers = roster.filter((_, index) => index !== removed), scores = state.scores.filter((_, index) => index !== removed);
  const currentTurn = state.currentTurn > removed ? state.currentTurn - 1 : state.currentTurn === removed ? removed % matchPlayers.length : state.currentTurn;
  let modeState = state.modeState ? structuredClone(state.modeState) : null;
  if (modeState?.value) {
    if (Array.isArray(modeState.value.scores)) modeState.value.scores.splice(removed, 1);
    if (modeState.kind === "randomFive") modeState.value.guessIds = rekeyAfterRemoval(modeState.value.guessIds, removed);
    if (modeState.kind === "twin" && modeState.value.guesses?.length > removed) modeState.value.guesses.splice(removed, 1);
    if (modeState.kind === "grid") {
      for (const key of ["players", "scores", "correct", "wrong"]) modeState.value[key]?.splice(removed, 1);
      modeState.value.currentTurn = currentTurn;
      modeState.value.grid?.marks?.forEach((mark, index, marks) => { if (!mark) return; if (mark.owner === removed) marks[index] = null; else if (mark.owner > removed) mark.owner--; });
    }
  }
  return advance(state, { matchPlayers, scores, matchResults, totalScores, currentTurn, modeState, roundAnswers: rekeyAfterRemoval(state.roundAnswers, removed) });
}
function startOnlineGame(state, { playerIndex, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (playerIndex !== 0) throw new Error("HOST_ONLY");
  const matchPlayers = state.players.map((player, roomSlot) => ({ ...player, roomSlot })).filter((player) => player.ready);
  if (!['waiting', 'finished'].includes(state.status) || matchPlayers.length < 2 || !state.players[0]?.ready) throw new Error("PLAYERS_NOT_READY");
  return advance(state, { status: "playing", matchPlayers, matchResults: {}, matchNumber: (state.matchNumber || 0) + 1, questionSequence: 0, scores: matchPlayers.map((player) => state.totalScores?.[player.roomSlot] || 0), settings: { ...state.settings, locked: true }, question: null, roundAnswers: {}, revealUntil: null, modeState: null });
}
function publishOnlineQuestion(state, { playerIndex, question, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (playerIndex !== 0) throw new Error("HOST_ONLY");
  if (state.status !== "playing" || !state.settings.locked) throw new Error("GAME_NOT_STARTED");
  if (state.question && !state.revealUntil) throw new Error("QUESTION_ACTIVE");
  return advance(state, { question: { ...question }, questionSequence: state.questionSequence + 1, roundAnswers: {}, revealUntil: null, answerResult: null });
}
function submitOnlineAnswer(state, { playerIndex, questionId, selectedPlayerId, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "playing" || !state.question) throw new Error("QUESTION_NOT_ACTIVE");
  const matchIndex = matchIndexFor(state, playerIndex);
  if (matchIndex < 0) throw new Error("NOT_IN_MATCH");
  if (state.roundAnswers && Object.hasOwn(state.roundAnswers, matchIndex)) throw new Error("QUESTION_ALREADY_ANSWERED");
  if (state.question.questionId !== questionId) throw new Error("STALE_QUESTION");
  if (state.question.optionPlayerIds?.length && !state.question.optionPlayerIds.map(Number).includes(+selectedPlayerId)) throw new Error("INVALID_OPTION");
  const correctIds = (state.question.validPlayerIds || [state.question.correctPlayerId]).map(Number);
  const correct = correctIds.includes(+selectedPlayerId), scores = [...state.scores], roundAnswers = { ...(state.roundAnswers || {}), [matchIndex]: { selectedPlayerId: +selectedPlayerId, result: correct ? "correct" : "wrong" } };
  if (correct) scores[matchIndex] += 1;
  const allAnswered = (state.matchPlayers || state.players).every((_, index) => Object.hasOwn(roundAnswers, index));
  return advance(state, { scores, roundAnswers, revealUntil: allAnswered ? now + 2000 : null, answerResult: allAnswered ? "revealed" : null });
}
function timeoutOnlineQuestion(state, { questionId, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "playing" || !state.question) throw new Error("QUESTION_NOT_ACTIVE");
  if (state.question.questionId !== questionId) throw new Error("STALE_QUESTION");
  if (state.revealUntil) return state;
  if (now < Number(state.question.deadlineAt || 0)) throw new Error("TIME_REMAINING");
  const roundAnswers = { ...(state.roundAnswers || {}) };
  (state.matchPlayers || state.players).forEach((_, index) => { if (!Object.hasOwn(roundAnswers, index)) roundAnswers[index] = { selectedPlayerId: null, result: "timeout" }; });
  return advance(state, { roundAnswers, revealUntil: now + 2000, answerResult: "revealed" });
}
function submitOnlineSpecialGuess(state, { playerIndex, kind, step, selectedPlayerId, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  const snapshot = state.modeState;
  if (state.status !== "playing" || snapshot?.kind !== kind) throw new Error("SPECIAL_GAME_NOT_ACTIVE");
  if (+snapshot.value.round !== +step) throw new Error("STALE_SPECIAL_STEP");
  const guessIds = { ...(snapshot.value.guessIds || {}) };
  const matchIndex = matchIndexFor(state, playerIndex);
  if (matchIndex < 0) throw new Error("NOT_IN_MATCH");
  if (Object.hasOwn(guessIds, matchIndex)) throw new Error("SPECIAL_GUESS_ALREADY_SUBMITTED");
  guessIds[matchIndex] = +selectedPlayerId;
  const allAnswered = (state.matchPlayers || state.players).every((_, index) => Object.hasOwn(guessIds, index));
  return advance(state, { modeState: { ...snapshot, value: { ...snapshot.value, guessIds, revealUntil: allAnswered ? now + 2000 : null } } });
}
function passOnlineTurn(state, { playerIndex, questionId, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "playing" || !state.question) throw new Error("QUESTION_NOT_ACTIVE");
  const matchIndex = matchIndexFor(state, playerIndex);
  if (matchIndex < 0 || state.currentTurn !== matchIndex) throw new Error("NOT_YOUR_TURN");
  if (state.answeredBy !== null || state.question.questionId !== questionId) throw new Error("QUESTION_ALREADY_ANSWERED");
  return advance(state, { answeredBy: matchIndex, selectedPlayerId: null, answerResult: "pass", currentTurn: (matchIndex + 1) % (state.matchPlayers || state.players).length });
}
function finishOnlineGame(state, { playerIndex, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (playerIndex !== 0) throw new Error("HOST_ONLY");
  if (state.status !== "playing" || (!state.revealUntil && !state.modeState?.value?.finished && state.modeState?.value?.status !== "finished")) throw new Error("FINISH_NOT_ALLOWED");
  const matchResults = { ...(state.matchResults || {}) }; (state.matchPlayers || []).forEach((player, index) => { matchResults[player.roomSlot] = state.scores[index] || 0; });
  const totalScores = state.players.map((_, index) => matchResults[index] ?? state.totalScores?.[index] ?? 0);
  return advance(state, { status: "finished", finishedAt: now, matchResults, totalScores, settings: { ...state.settings, lastModeState: state.modeState || null }, players: state.players.map((player) => ({ ...player, ready: false })) });
}
function configureOnlineMatch(state, { playerIndex, settings, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (playerIndex !== 0) throw new Error("HOST_ONLY");
  if (!['waiting', 'finished'].includes(state.status)) throw new Error("SETTINGS_LOCKED");
  return advance(state, { status: "waiting", settings: { ...settings, locked: false }, players: state.players.map((player) => ({ ...player, ready: false })), scores: [...(state.totalScores || state.scores)], question: null, roundAnswers: {}, revealUntil: null, modeState: null });
}
function syncOnlineModeState(state, { playerIndex, modeState, currentTurn, scores, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "playing") throw new Error("GAME_NOT_STARTED");
  const matchIndex = matchIndexFor(state, playerIndex);
  if (state.modeState && (matchIndex < 0 || state.currentTurn !== matchIndex)) throw new Error("NOT_YOUR_TURN");
  if (!state.modeState && playerIndex !== 0) throw new Error("HOST_ONLY");
  return advance(state, { modeState, currentTurn: Number(currentTurn) || 0, scores: Array.isArray(scores) ? scores : state.scores });
}
function isRoomExpired(state, now = Date.now()) { return !state || now >= state.expiresAt; }
const onlineApi = { ROOM_TTL_MS, MAX_ROOM_PLAYERS, generateRoomCode, createOnlineRoom, joinOnlineRoom, updateConnection, setOnlineReady, leaveOnlineMatch, startOnlineGame, publishOnlineQuestion, submitOnlineAnswer, timeoutOnlineQuestion, submitOnlineSpecialGuess, passOnlineTurn, finishOnlineGame, configureOnlineMatch, syncOnlineModeState, isRoomExpired };
if (typeof module !== "undefined") module.exports = onlineApi;
if (typeof window !== "undefined") window.IkiFormaOnlineCore = onlineApi;
