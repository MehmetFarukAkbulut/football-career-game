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
  assert.match(source, /state\.roundAnswers\?\.\[matchIndex\]/);
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
  assert.match(source, /Object\.keys\(randomFive\.guessIds \|\| \{\}\)\.length !== onlineGamePlayers\(\)\.length/);
});

test("online özel oyun bitince oda sonuç lobisine güvenilir biçimde taşınır", () => {
  assert.match(source, /async function completeOnlineMatch\(\)/);
  assert.match(source, /if \(synced\) await completeOnlineMatch\(\)/);
  assert.match(source, /show\("onlineLobby"\); renderOnlineLobby\(\)/);
});

test("oyun bitince katılan oyuncu da hazır olabileceği lobiye taşınır", () => {
  assert.match(source, /if \(state\.status !== "playing"\) show\("onlineLobby"\)/);
  assert.match(source, /\$\("#onlineReady"\)\.hidden = !\["waiting", "finished"\]\.includes\(state\.status\)/);
});

test("online maç yalnız hazır oyuncuları kullanır ve lobi eylemleri görünür kalır", () => {
  assert.match(source, /function onlineGamePlayers/);
  assert.match(source, /readyCount < 2 \|\| !me\?\.ready/);
  assert.match(choiceStyles, /\.online-actions\{position:sticky/);
});

test("online oyuncu maçı bırakıp puanlarıyla odaya dönebilir", () => {
  assert.match(source, /type: "leave_match"/);
  assert.match(source, /online-room-return/);
  assert.match(source, /online\.specialAdvanceKey = null/);
});

test("online oda puanları oyunlar arasında birikmeye devam eder", () => {
  assert.match(source, /state\.totalScores \|\| state\.scores/);
  assert.match(source, /activeScores = \[\.\.\.online\.state\.scores\]/);
});

test("online özel oyunlar her maçta önceki paketten farklı sorular üretir", () => {
  assert.match(source, /function buildFreshOnlineSpecialState/);
  assert.match(source, /settings\.lastModeState\?\.value \|\| settings\.initialState/);
  assert.match(source, /settings\.randomFiveHistory/);
  assert.match(source, /function buildFreshRandomFiveSets/);
  assert.match(source, /function randomFiveSetKey/);
  assert.match(source, /signature\(board\) === signature\(previous\.grid\)/);
});

test("Rastgele Beşler online set sayısı oda ayarındaki tur değerini korur", () => {
  assert.doesNotMatch(source, /settings\.rounds = 5/);
  assert.match(source, /length: settings\.rounds/);
  assert.match(source, /buildFreshRandomFiveSets\(allowedClubs, pool, used, settings\.rounds\)/);
  assert.match(source, /randomFive\.round < randomFive\.sets\.length/);
  assert.match(source, /finished: randomFive\.round >= randomFive\.sets\.length/);
});

test("online oda sahibi lig filtresini ayarlara ve tüm oyun havuzlarına uygular", () => {
  assert.match(source, /#onlineHostSettings \.league-options input:checked/);
  assert.match(source, /generateGrid\(selectedLeagues, settings\.gridType\)/);
  assert.match(source, /allowedClubIds\.has\(club\.id\)/);
  assert.match(source, /twinPool\(\)\.filter/);
  assert.match(source, /enhanceLeagueSelector\(\$\("#onlineHostSettings"\)\)/);
});

test("online oda sahibi ızgara tipini seçer ve ortak state ile sonraki ızgaralarda korur", () => {
  assert.match(source, /gridType: \$\("#onlineGridType"\)\.value/);
  assert.match(source, /state\.settings\.gridType \|\| "mixed"/);
  assert.match(source, /generateGrid\(selected, settings\.gridType \|\| "mixed"\)/);
  assert.match(source, /updateOnlineGridTypeVisibility/);
});

test("ülke kriterli ızgara seçenekleri doğum yılını gösterir", () => {
  assert.match(source, /showBirthYear: hasCountryCriterion/);
  assert.match(source, /player\.birthDate\.slice\(0, 4\)/);
  assert.match(source, /Doğum yılı bilinmiyor/);
});

test("ızgara çoktan seçmeli seçenekleri aynı sıra ve hücrede sabit kalır", () => {
  assert.match(source, /const questionKey = `\$\{i\}:\$\{grid\.currentTurn\}:\$\{grid\.history\.length\}`/);
  assert.match(source, /grid\.choiceQuestions\[questionKey\] \|\|/);
  assert.match(source, /seededGridQuestionRng\(`\$\{grid\.questionSeed \|\| 0\}:\$\{questionKey\}`\)/);
  assert.match(source, /grid\.choiceQuestions\[questionKey\] = grid\.question/);
});

test("online oda masaüstünde dar setup sütununa sıkışmadan tam genişliği kullanır", () => {
  assert.match(styles, /\.setup \.surface\.online-lobby/);
  assert.match(styles, /grid-template-columns:minmax\(300px,.8fr\) minmax\(0,1.2fr\)/);
  assert.match(styles, /\.online-host-settings \.online-league-options \{ grid-column:2/);
  assert.match(styles, /max-height:none/);
});

test("ana menüde tüm oyun kartları taşmadan gerçek satırlara dağıtılır", () => {
  assert.match(styles, /grid-template-rows: repeat\(4, minmax\(82px, 1fr\)\)/);
  assert.match(styles, /grid-auto-rows: minmax\(82px, 1fr\)/);
  assert.match(styles, /#home \.mode-card i \{ display: none; \}/);
  assert.match(styles, /#home \.mode-card > span:nth-child\(2\) \{ min-width: 0/);
});
