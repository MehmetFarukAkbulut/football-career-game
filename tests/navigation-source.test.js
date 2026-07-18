"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "web", "app.js"), "utf8");

test("uygulama içi gezinme history state ve popstate kullanır", () => {
  assert.match(source, /history\.pushState\(\{ view: id \}/);
  assert.match(source, /addEventListener\("popstate"/);
  assert.match(source, /show\(event\.state\?\.view \|\| "home"/);
});
