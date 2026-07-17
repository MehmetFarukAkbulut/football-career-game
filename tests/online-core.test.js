"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Core = require("../web/online-core");
function playingRoom() {
  let room = Core.createOnlineRoom({ code: "AB12CD", hostName: "Ali", settings: { mode: "clubs" }, now: 100 });
  room = Core.joinOnlineRoom(room, { playerName: "Ece", expectedVersion: room.stateVersion, now: 101 });
  room = Core.setOnlineReady(room, { playerIndex: 0, expectedVersion: room.stateVersion, now: 102 });
  room = Core.setOnlineReady(room, { playerIndex: 1, expectedVersion: room.stateVersion, now: 103 });
  room = Core.startOnlineGame(room, { playerIndex: 0, expectedVersion: room.stateVersion, now: 104 });
  return Core.publishOnlineQuestion(room, { playerIndex: 0, expectedVersion: room.stateVersion, now: 105, question: { questionId: "q1", optionPlayerIds: [10, 11, 12, 13], correctPlayerId: 10 } });
}
test("kısa oda kodu güvenli alfabe ile üretilir", () => assert.match(Core.generateRoomCode(Uint8Array.from([0, 1, 2, 3, 4, 5])), /^[A-HJ-NP-Z2-9]{6}$/));
test("oda koduyla ikinci oyuncu doğru odaya katılır", () => { const room = Core.createOnlineRoom({ code: "AB12CD", settings: {}, now: 0 }); const joined = Core.joinOnlineRoom(room, { playerName: "Ece", expectedVersion: 1, now: 1 }); assert.equal(joined.roomCode, "AB12CD"); assert.equal(joined.players[1].name, "Ece"); });
test("aktif olmayan oyuncu cevap veremez", () => { const room = playingRoom(); assert.throws(() => Core.submitOnlineAnswer(room, { playerIndex: 1, questionId: "q1", selectedPlayerId: 10, expectedVersion: room.stateVersion, now: 106 }), /NOT_YOUR_TURN/); });
test("yanlış cevapta sıra rakibe geçer", () => { const room = playingRoom(); const next = Core.submitOnlineAnswer(room, { playerIndex: 0, questionId: "q1", selectedPlayerId: 11, expectedVersion: room.stateVersion, now: 106 }); assert.equal(next.currentTurn, 1); assert.equal(next.answerResult, "wrong"); });
test("pas sırayı rakibe geçirir ve host tamamlanan oyunu bitirebilir", () => { const room = playingRoom(); const passed = Core.passOnlineTurn(room, { playerIndex: 0, questionId: "q1", expectedVersion: room.stateVersion, now: 106 }); assert.equal(passed.currentTurn, 1); const finished = Core.finishOnlineGame(passed, { playerIndex: 0, expectedVersion: passed.stateVersion, now: 107 }); assert.equal(finished.status, "finished"); });
test("aynı soru iki kez cevaplanamaz", () => { const room = playingRoom(); const answered = Core.submitOnlineAnswer(room, { playerIndex: 0, questionId: "q1", selectedPlayerId: 10, expectedVersion: room.stateVersion, now: 106 }); assert.throws(() => Core.submitOnlineAnswer(answered, { playerIndex: 0, questionId: "q1", selectedPlayerId: 10, expectedVersion: answered.stateVersion, now: 107 }), /QUESTION_ALREADY_ANSWERED/); });
test("güncel olmayan sürüm yeni state'i ezemez", () => { const room = playingRoom(); assert.throws(() => Core.setOnlineReady(room, { playerIndex: 0, expectedVersion: 1, now: 106 }), /STALE_STATE/); });
test("bağlantı sonrası güncel state yeniden alınabilir", () => { const room = playingRoom(); const offline = Core.updateConnection(room, { playerIndex: 1, connected: false, expectedVersion: room.stateVersion, now: 106 }); const back = Core.updateConnection(offline, { playerIndex: 1, connected: true, expectedVersion: offline.stateVersion, now: 107 }); assert.equal(back.players[1].connected, true); assert.equal(back.question.questionId, "q1"); });
test("süresi dolmuş oda kullanılamaz", () => { const room = Core.createOnlineRoom({ settings: {}, now: 0 }); assert.equal(Core.isRoomExpired(room, Core.ROOM_TTL_MS), true); assert.throws(() => Core.joinOnlineRoom(room, { expectedVersion: 1, now: Core.ROOM_TTL_MS }), /ROOM_EXPIRED/); });
