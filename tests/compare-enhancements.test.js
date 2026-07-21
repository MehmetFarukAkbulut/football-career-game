"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("kulup karsilastirma bagimsiz aranabilir iki kulup secici kullanir", () => {
  const source = fs.readFileSync(
    path.join(root, "web", "compare-enhancements.js"),
    "utf8"
  );

  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );

  assert.match(
    html,
    /compare-enhancements\.js/
  );

  assert.match(
    html,
    /compare-enhancements\.css/
  );

  assert.match(
    source,
    /selectedA/
  );

  assert.match(
    source,
    /selectedB/
  );

  assert.match(
    source,
    /KulÃ¼p adÄ±, lig veya Ã¼lke ara/
  );

  assert.match(
    source,
    /POPULAR_LEAGUE_IDS/
  );

  assert.match(
    source,
    /GB1/
  );

  assert.match(
    source,
    /ES1/
  );

  assert.match(
    source,
    /IT1/
  );

  assert.match(
    source,
    /L1/
  );

  assert.match(
    source,
    /FR1/
  );

  assert.match(
    source,
    /TR1/
  );

  /*
    Filter changes must not clear previously selected clubs.
  */
  assert.doesNotMatch(
    source,
    /state\.selectedA\s*=\s*null[\s\S]*updateFilters/
  );

  assert.doesNotMatch(
    source,
    /state\.selectedB\s*=\s*null[\s\S]*updateFilters/
  );
});