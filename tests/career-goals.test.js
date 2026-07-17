"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("IFFHS toplam kariyer golü düzeltmeleri veri paketinde korunur", () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "web-data.json"), "utf8"));
  const expected = new Map([[8198, 976], [28003, 919], [38253, 697], [44352, 606], [3455, 561], [18922, 523], [132098, 511]]);
  for (const [id, goals] of expected) assert.equal(data.players.find((player) => player.id === id)?.careerGoals, goals, String(id));
  assert.equal([...data.players].sort((a, b) => b.careerGoals - a.careerGoals)[0].id, 8198);
});
