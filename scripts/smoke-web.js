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
      width: 1365,
      height: 768,
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
    await win.loadURL(process.env.SMOKE_URL || `http://127.0.0.1:${server.address().port}/`);
    await win.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const started = Date.now();

        const check = () => {
          if (
            window.IKI_FORMA_DATA_READY === true &&
            window.IKI_FORMA_FC26_READY === true &&
            document.querySelector(".league-list")
          ) {
            resolve(true);
            return;
          }

          if (Date.now() - started > 60000) {
            reject(
              new Error(
                "Smoke timeout: progressive datasets were not ready within 60 seconds"
              )
            );
            return;
          }

          setTimeout(check, 100);
        };

        check();
      })
    `);
    const desktop = await win.webContents.executeJavaScript(
      `(async()=>{const base={title:document.title,home:document.querySelector('#home')?.classList.contains('active'),cards:document.querySelectorAll('.mode-card').length};document.querySelector('[data-view="classicSetup"]').click();const list=document.querySelector('.league-list'),field=document.querySelector('.league-options'),surface=document.querySelector('.setup.active .surface');const setup={leagueFlags:document.querySelectorAll('.league-list .flag').length,popularOrder:[...list.querySelectorAll('input[type="checkbox"]')].slice(0,6).map(x=>x.value),pageOverflow:document.documentElement.scrollHeight-innerHeight,bodyOverflow:getComputedStyle(document.body).overflowY,listScroll:list.scrollHeight>list.clientHeight,outerOverflow:getComputedStyle(field).overflow,cardBottom:surface.getBoundingClientRect().bottom};document.querySelector('#classicSetup .difficulty').value='easy';document.querySelector('#classicSetup .answer-method').value='multiple';document.querySelector('#classicSetup .start').click();await new Promise(r=>setTimeout(r,300));const multipleChoiceOptions=document.querySelectorAll('#multipleChoiceOptions .choice-option').length,multipleChoiceUnique=new Set([...document.querySelectorAll('#multipleChoiceOptions .choice-option')].map(x=>x.dataset.playerId)).size;document.querySelector('[data-view="grid"]').click();const gameModes=document.querySelectorAll('input[name="gridMode"]').length,gridChecks=[...document.querySelectorAll('.grid-league-options input[type="checkbox"]')],gridLeagueCount=gridChecks.length,gridPopularOrder=gridChecks.slice(0,6).map(x=>x.value);gridChecks.slice(0,6).forEach(x=>x.checked=true);scrollTo(0,document.documentElement.scrollHeight);document.querySelector('#startGrid').click();await new Promise(r=>setTimeout(r,250));const board=document.querySelector('#gridBoard'),game=document.querySelector('#gridGame'),rect=board.getBoundingClientRect();const gridState={gameModes,gridLeagueCount,gridPopularOrder,gridVisible:!game.hidden,cells:document.querySelectorAll('[data-cell]').length,crests:document.querySelectorAll('.grid-head img').length,turn:document.querySelector('#gridTurn').textContent,gameScrollY:scrollY,gameOverflow:getComputedStyle(document.body).overflowY,gameDisplay:getComputedStyle(game).display,gameTop:game.getBoundingClientRect().top,gameHeaderHidden:getComputedStyle(document.querySelector('#grid>.section-head')).display==='none',boardTop:rect.top,boardHeight:rect.height,boardBottom:rect.bottom,viewportHeight:innerHeight};document.querySelector('[data-view="randomFiveSetup"]').click();const randomLeagueCount=document.querySelectorAll('.random-five-league-options input[type="checkbox"]').length;document.querySelector('#startRandomFive').click();await new Promise(r=>setTimeout(r,250));const randomFiveVisible=document.querySelector('#randomFiveGame').classList.contains('active'),randomFiveClubs=document.querySelectorAll('#randomFiveClubs article').length;return {...base,...setup,...gridState,multipleChoiceOptions,multipleChoiceUnique,randomLeagueCount,randomFiveVisible,randomFiveClubs}})()`,
    );
    win.setSize(390, 844);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mobile = await win.webContents.executeJavaScript(
      `(()=>{document.querySelector('[data-view="classicSetup"]').click();const list=document.querySelector('.league-list');return{listOverflow:getComputedStyle(list).overflowY,listFits:list.scrollHeight===list.clientHeight,bodyOverflow:getComputedStyle(document.body).overflowY}})()`,
    );
    const state = { ...desktop, mobile };
    console.log(JSON.stringify(state));
    if (
      !state.home ||
      state.cards < 6 ||
      !state.gridVisible ||
      state.cells !== 9 ||
      state.gameModes !== 2 ||
      state.gridLeagueCount < 30 ||
      state.randomLeagueCount < 30 ||
      !state.randomFiveVisible ||
      state.randomFiveClubs !== 5 ||
      state.multipleChoiceOptions !== 4 ||
      state.multipleChoiceUnique !== 4 ||
      state.popularOrder.join(",") !== "GB1,ES1,IT1,FR1,L1,TR1" ||
      state.gridPopularOrder.join(",") !== "GB1,ES1,IT1,FR1,L1,TR1" ||
      state.leagueFlags < 30 ||
      (state.pageOverflow > 2 && state.bodyOverflow !== "hidden") ||
      !state.listScroll ||
      state.outerOverflow !== "visible" ||
      state.cardBottom > 768 ||
      !state.mobile.listFits ||
      state.mobile.listOverflow === "auto" ||
      state.crests !== 6 ||
      state.gameScrollY !== 0 ||
      state.gameOverflow !== "hidden" ||
      !state.gameHeaderHidden ||
      state.boardBottom > 768 ||
      !state.turn
    )
      failed = true;
    win.destroy();
    server.close(() => app.exit(failed ? 1 : 0));
  }),
);

