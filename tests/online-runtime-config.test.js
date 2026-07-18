"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = fs.readFileSync(path.join(__dirname, "..", "web", "runtime-config.js"), "utf8");

test("GitHub Pages online modu production Supabase public ayarını kullanır", () => {
  assert.match(config, /supabaseUrl: "https:\/\/[a-z]+\.supabase\.co"/);
  assert.match(config, /supabasePublishableKey: "sb_publishable_/);
  assert.match(config, /onlineMode: "production"/);
});

test("tarayıcı yapılandırmasında gizli Supabase anahtarı bulunmaz", () => {
  assert.doesNotMatch(config, /service_role|sb_secret_/i);
});
