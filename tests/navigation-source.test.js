"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "web", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "web", "grid.css"), "utf8");
const choiceStyles = fs.readFileSync(path.join(__dirname, "..", "web", "multiple-choice.css"), "utf8");

test("uygulama içi gezinme history state ve popstate kullanır", () => {
  assert.match(source, /history\.pushState\(\{ view: id \}/);
  assert.match(source, /addEventListener\("popstate"/);
  assert.match(source, /show\(event\.state\?\.view \|\| "home"/);
});

test("rastgele beşlerde sıfır puanlı çoktan seçmeli cevap tur tahmini olarak kabul edilir", () => {
  const submit = source.slice(source.indexOf("async function submitRandomFiveGuess"), source.indexOf("function revealRandomFiveRound"));
  assert.doesNotMatch(submit, /randomFiveScore\(player, ids\)\) return toast/);
  assert.match(submit, /randomFive\.guesses\.push\(player\)/);
});

test("mobil beşli kulüp şeridi yatay kaydırma olmadan beş eşit sütundur", () => {
  assert.match(styles, /\.random-five-clubs \{ width: 100%; grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[^}]*overflow: visible/);
});

test("altı öncelikli lig kendine özgü rozet metadata'sı taşır", () => {
  for (const leagueId of ["GB1", "ES1", "IT1", "L1", "FR1", "TR1"])
    assert.match(source, new RegExp(`${leagueId}: \\{ code:`));
});

test("ana menü doğrudan online oda katılımı sunar", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="openOnlineHome"/);
  assert.match(source, /\$\("#openOnlineHome"\)\.onclick = openOnlineHub/);
});

test("online cevap sonucu tüm oyuncular cevaplamadan açılmaz", () => {
  assert.match(source, /state\.roundAnswers\?\.\[online\.playerIndex\]/);
  assert.match(source, /state\.revealUntil/);
  assert.match(source, /Diğer oyuncular bekleniyor/);
});

test("online özel oyunlarda çift ilerleme ve çift gönderim kilitlidir", () => {
  assert.match(source, /online\.specialSubmitting/);
  assert.match(source, /online\.specialAdvancing/);
  assert.match(source, /const sharedIds = randomFive\.online/);
  assert.match(source, /const sharedIds = twin\.online/);
});

test("online lobby gizlenen giriş formunu gerçekten kaldırır", () => {
  assert.match(choiceStyles, /\.online-entry\[hidden\][^{]*\{display:none!important\}/);
});

test("online sayaç sıfırda backend timeout işlemini tetikler", () => {
  assert.match(source, /requestOnlineQuestionTimeout\(question\.questionId, state\.questionSequence\)/);
  assert.match(source, /type: "timeout", questionId/);
});

test("Rastgele Beşler online tahminleri oyuncu bazlı ve eşzamanlı gönderir", () => {
  assert.match(source, /submitOnlineSpecialGuess\("randomFive", randomFive\.round, player\.id\)/);
  assert.match(source, /Diğer oyuncular bekleniyor/);
  assert.match(source, /Object\.keys\(randomFive\.guessIds \|\| \{\}\)\.length !== online\.state\.players\.length/);
});
