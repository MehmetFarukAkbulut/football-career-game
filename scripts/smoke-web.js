"use strict";
const { app, BrowserWindow } = require("electron"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
let failed = false;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};
const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(req.url.split("?")[0]),
    relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, ""),
    file = path.resolve(root, relative);
  if (
    !file.startsWith(root) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    "Content-Type",
    types[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
app.whenReady().then(() =>
  server.listen(0, "127.0.0.1", async () => {
    const win = new BrowserWindow({
      show: false,
      width: 390,
      height: 844,
      webPreferences: { sandbox: true },
    });
    win.webContents.on("console-message", (_e, level, message) => {
      if (level >= 2) {
        failed = true;
        console.error(message);
      }
    });
    win.webContents.on("render-process-gone", () => {
      failed = true;
    });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const state = await win.webContents.executeJavaScript(
      `(async()=>{const base={title:document.title,home:document.querySelector('#home')?.classList.contains('active'),cards:document.querySelectorAll('.mode-card').length};document.querySelector('[data-view="grid"]').click();document.querySelector('#startGrid').click();await new Promise(r=>setTimeout(r,250));return {...base,gridVisible:!document.querySelector('#gridGame').hidden,cells:document.querySelectorAll('[data-cell]').length,turn:document.querySelector('#gridTurn').textContent}})()`,
    );
    console.log(JSON.stringify(state));
    if (
      !state.home ||
      state.cards < 6 ||
      !state.gridVisible ||
      state.cells !== 9 ||
      !state.turn
    )
      failed = true;
    win.destroy();
    server.close(() => app.exit(failed ? 1 : 0));
  }),
);
