"use strict";
const { spawn } = require("node:child_process"),
  path = require("node:path"),
  electron = require("electron"),
  env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(__dirname, "smoke-web.js")], {
  cwd: path.resolve(__dirname, ".."),
  env,
  stdio: "inherit",
});
child.on("exit", (code) => (process.exitCode = code ?? 1));
