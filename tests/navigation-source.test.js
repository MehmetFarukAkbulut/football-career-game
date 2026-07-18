"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "web", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "web", "grid.css"), "utf8");

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
