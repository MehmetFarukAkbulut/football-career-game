"use strict";
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function secureRandomBytes(length) {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint8Array(length));
  throw new Error("SECURE_RANDOM_UNAVAILABLE");
}
function generateRoomCode(bytes = secureRandomBytes(6)) {
  return [...bytes].map((byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("").slice(0, 6);
}
function createOnlineRoom({ code, hostName = "Oyuncu 1", settings, now = Date.now() }) {
  return { roomCode: code || generateRoomCode(), stateVersion: 1, status: "waiting", createdAt: now, expiresAt: now + ROOM_TTL_MS, questionSequence: 0, settings: { ...settings, locked: false }, currentTurn: 0, scores: [0, 0], usedPlayerIds: [], players: [{ name: hostName.trim() || "Oyuncu 1", ready: false, connected: true, host: true }, null], question: null, answeredBy: null, selectedPlayerId: null, answerResult: null };
}
function assertMutable(state, expectedVersion, now = Date.now()) {
  if (!state) throw new Error("ROOM_NOT_FOUND");
  if (now >= state.expiresAt) throw new Error("ROOM_EXPIRED");
  if (+expectedVersion !== +state.stateVersion) throw new Error("STALE_STATE");
}
function advance(state, patch) { return { ...state, ...patch, stateVersion: state.stateVersion + 1 }; }
function joinOnlineRoom(state, { playerName = "Oyuncu 2", expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "waiting" || state.players[1]) throw new Error("ROOM_FULL");
  return advance(state, { players: [state.players[0], { name: playerName.trim() || "Oyuncu 2", ready: false, connected: true, host: false }] });
}
function updateConnection(state, { playerIndex, connected, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (!state.players[playerIndex]) throw new Error("PLAYER_NOT_FOUND");
  const players = state.players.map((player, index) => index === playerIndex ? { ...player, connected: Boolean(connected), lastSeenAt: now } : player);
  return advance(state, { players });
}
function setOnlineReady(state, { playerIndex, ready = true, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "waiting" || !state.players[playerIndex]) throw new Error("READY_NOT_ALLOWED");
  const players = state.players.map((player, index) => index === playerIndex ? { ...player, ready: Boolean(ready) } : player);
  return advance(state, { players });
}
function startOnlineGame(state, { playerIndex, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (playerIndex !== 0) throw new Error("HOST_ONLY");
  if (state.status !== "waiting" || !state.players.every((player) => player?.ready)) throw new Error("PLAYERS_NOT_READY");
  return advance(state, { status: "playing", settings: { ...state.settings, locked: true } });
}
function publishOnlineQuestion(state, { playerIndex, question, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (playerIndex !== 0) throw new Error("HOST_ONLY");
  if (state.status !== "playing" || !state.settings.locked) throw new Error("GAME_NOT_STARTED");
  if (state.question && state.answeredBy === null) throw new Error("QUESTION_ACTIVE");
  return advance(state, { question: { ...question }, questionSequence: state.questionSequence + 1, answeredBy: null, selectedPlayerId: null, answerResult: null });
}
function submitOnlineAnswer(state, { playerIndex, questionId, selectedPlayerId, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "playing" || !state.question) throw new Error("QUESTION_NOT_ACTIVE");
  if (state.currentTurn !== playerIndex) throw new Error("NOT_YOUR_TURN");
  if (state.answeredBy !== null) throw new Error("QUESTION_ALREADY_ANSWERED");
  if (state.question.questionId !== questionId) throw new Error("STALE_QUESTION");
  if (state.question.optionPlayerIds?.length && !state.question.optionPlayerIds.map(Number).includes(+selectedPlayerId)) throw new Error("INVALID_OPTION");
  if (!state.settings.repeatPlayers && state.usedPlayerIds.includes(+selectedPlayerId)) throw new Error("PLAYER_USED");
  const correctIds = (state.question.validPlayerIds || [state.question.correctPlayerId]).map(Number);
  const correct = correctIds.includes(+selectedPlayerId), scores = [...state.scores];
  if (correct) scores[playerIndex] += 1;
  const usedPlayerIds = state.settings.repeatPlayers ? state.usedPlayerIds : [...state.usedPlayerIds, +selectedPlayerId];
  return advance(state, { scores, usedPlayerIds, answeredBy: playerIndex, selectedPlayerId: +selectedPlayerId, answerResult: correct ? "correct" : "wrong", currentTurn: correct ? playerIndex : playerIndex ? 0 : 1 });
}
function passOnlineTurn(state, { playerIndex, questionId, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (state.status !== "playing" || !state.question) throw new Error("QUESTION_NOT_ACTIVE");
  if (state.currentTurn !== playerIndex) throw new Error("NOT_YOUR_TURN");
  if (state.answeredBy !== null || state.question.questionId !== questionId) throw new Error("QUESTION_ALREADY_ANSWERED");
  return advance(state, { answeredBy: playerIndex, selectedPlayerId: null, answerResult: "pass", currentTurn: playerIndex ? 0 : 1 });
}
function finishOnlineGame(state, { playerIndex, expectedVersion, now = Date.now() }) {
  assertMutable(state, expectedVersion, now);
  if (playerIndex !== 0) throw new Error("HOST_ONLY");
  if (state.status !== "playing" || state.answeredBy === null) throw new Error("FINISH_NOT_ALLOWED");
  return advance(state, { status: "finished", finishedAt: now });
}
function isRoomExpired(state, now = Date.now()) { return !state || now >= state.expiresAt; }
const onlineApi = { ROOM_TTL_MS, generateRoomCode, createOnlineRoom, joinOnlineRoom, updateConnection, setOnlineReady, startOnlineGame, publishOnlineQuestion, submitOnlineAnswer, passOnlineTurn, finishOnlineGame, isRoomExpired };
if (typeof module !== "undefined") module.exports = onlineApi;
if (typeof window !== "undefined") window.IkiFormaOnlineCore = onlineApi;
