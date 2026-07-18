"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const core = require("../web/game-core.js");

test("Kariyer Kozları beş doğrulanmış kariyer metriğini kullanır", () => {
  assert.deepEqual(core.TRUMP_METRICS.map((metric) => metric.key), ["appearances", "goals", "assists", "nationalCaps", "clubCount"]);
  const player = { clubIds: [1, 2, 2], appearances: 300 };
  assert.equal(core.trumpMetricValue(player, "clubCount"), 2);
  assert.equal(core.trumpMetricValue(player, "appearances"), 300);
});

test("eşit veya yüksek koz kazanır, düşük koz kaybeder", () => {
  assert.equal(core.compareTrumpStat({ goals: 50 }, { goals: 50 }, "goals").correct, true);
  assert.equal(core.compareTrumpStat({ goals: 51 }, { goals: 50 }, "goals").correct, true);
  assert.equal(core.compareTrumpStat({ goals: 49 }, { goals: 50 }, "goals").correct, false);
});

test("Kariyer Kozları menü, paket ve lig filtresi akışını içerir", async () => {
  const [html, source, css] = await Promise.all([
    fs.readFile(path.join(__dirname, "..", "index.html"), "utf8"),
    fs.readFile(path.join(__dirname, "..", "web", "app.js"), "utf8"),
    fs.readFile(path.join(__dirname, "..", "web", "grid.css"), "utf8"),
  ]);
  assert.match(html, /data-view="trumpsSetup"/);
  assert.match(html, /id="trumpsLeagueOptions"/);
  assert.match(source, /enhanceLeagueSelector\(\$\("#trumpsSetup"\)\)/);
  assert.match(source, /trumpsGame\.errors >= 2/);
  assert.match(css, /\.trumps-table/);
});
