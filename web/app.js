"use strict";
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="icon" type="image/svg+xml" href="favicon.svg">',
);
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="stylesheet" href="web/grid.css">',
);
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .toLowerCase(),
  initials = (s) =>
    String(s)
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase();
let DATA,
  clubs = [],
  players = [],
  clubMap,
  clubPlayers = new Map(),
  indexes,
  catalogPage = 1,
  game = {},
  timer,
  grid = {},
  computerTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2500);
}
function show(id) {
  clearInterval(timer);
  if (id !== "grid") clearTimeout(computerTimer);
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === id));
  scrollTo({
    top: 0,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  if (id === "catalog") renderCatalog(true);
  if (id === "travelers") renderTravelers();
  if (id === "grid") openGrid();
}
document.addEventListener(
  "error",
  (event) => {
    if (event.target.matches?.(".club-logo-wrap img"))
      event.target.parentElement.classList.add("asset-error");
  },
  true,
);
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) show(b.dataset.view);
});
function logo(c) {
  const source = c?.logoAsset || c?.logo;
  return source
    ? `<span class="club-logo-wrap"><img src="${esc(source)}" alt="${esc(c.name)} arması" width="64" height="64" loading="lazy"><span class="club-logo fallback">${esc(initials(c?.name || ""))}</span></span>`
    : `<span class="club-logo">${esc(initials(c?.name || ""))}</span>`;
}
function side(c) {
  return `${logo(c)}<div><h2>${esc(c.name)}</h2><p>${esc([c.league, c.country].filter(Boolean).join(" • "))}</p></div>`;
}
function person(p) {
  return p.photo
    ? `<img src="${esc(p.photo)}" alt="" loading="lazy">`
    : '<span class="avatar"></span>';
}
function namesForClubs(ids) {
  const set = ids.map((id) => clubPlayers.get(+id) || []);
  return (set[0] || []).filter((p) =>
    set.slice(1).every((list) => list.some((x) => x.id === p.id)),
  );
}
function setupScreen(id, title, description, mode) {
  const leagues = [
    ...new Set(clubs.map((c) => c.leagueId || `${c.country}:${c.league}`)),
  ].sort();
  $(id).innerHTML =
    `<button class="back" data-view="home">← Ana sayfa</button><div class="surface"><span class="kicker">OYUN AYARLARI</span><h2>${title}</h2><p>${description}</p><label>Tur sayısı<select class="rounds"><option>3</option><option selected>5</option><option>10</option><option>15</option></select></label><label>Tur süresi<select class="seconds"><option>15</option><option selected>30</option><option>45</option></select></label><label>Zorluk<select class="difficulty"><option value="normal">Normal</option><option value="easy">Kolay</option><option value="hard">Zor</option></select></label><fieldset class="league-options"><legend>Oyun ligleri <small>Seçim yapılmazsa tüm ligler kullanılır</small></legend>${leagues.map((league, i) => `<label><input type="checkbox" value="${esc(league)}"><span>${esc(league)}</span></label>`).join("")}</fieldset><button class="cta start">Oyunu başlat →</button></div>`;
  $(id).querySelector(".start").onclick = () => startGame(mode, $(id));
}
function enhanceLeagueSelector(root) {
  const fieldset = root.querySelector(".league-options");
  const leagues = DATA.leagues || [
    ...new Map(
      clubs.map((c) => [
        c.leagueId || `${c.country}:${c.league}`,
        {
          id: c.leagueId || `${c.country}:${c.league}`,
          name: c.league,
          countryName: c.countryName || c.country,
          countryCode: c.countryCode || "",
          level: 1,
        },
      ]),
    ).values(),
  ];
  fieldset.textContent = "";
  const legend = document.createElement("legend"),
    count = document.createElement("small");
  legend.append("Oyun ligleri ", count);
  fieldset.append(legend);
  const tools = document.createElement("div");
  tools.className = "league-tools";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Lig veya ülke ara…";
  search.setAttribute("aria-label", search.placeholder);
  const all = document.createElement("button"),
    clear = document.createElement("button");
  for (const [button, text] of [
    [all, "Tümünü seç"],
    [clear, "Temizle"],
  ]) {
    button.type = "button";
    button.className = "secondary";
    button.textContent = text;
    tools.append(button);
  }
  tools.prepend(search);
  fieldset.append(tools);
  const list = document.createElement("div");
  list.className = "league-list";
  fieldset.append(list);
  const popularLeagueIds = ["GB1", "ES1", "IT1", "FR1", "L1", "TR1"];
  const orderedLeagues = [...leagues].sort((a, b) => {
    const rankA = popularLeagueIds.indexOf(a.id),
      rankB = popularLeagueIds.indexOf(b.id);
    if (rankA !== -1 || rankB !== -1)
      return (
        (rankA === -1 ? popularLeagueIds.length : rankA) -
        (rankB === -1 ? popularLeagueIds.length : rankB)
      );
    return `${a.countryName}${a.name}`.localeCompare(
      `${b.countryName}${b.name}`,
      "tr",
    );
  });
  for (const league of orderedLeagues) {
    const label = document.createElement("label"),
      input = document.createElement("input"),
      flag = document.createElement("span"),
      text = document.createElement("span"),
      name = document.createElement("b"),
      meta = document.createElement("small");
    input.type = "checkbox";
    input.value = league.id;
    flag.className = "flag";
    flag.textContent = countryFlag(league.countryCode);
    flag.setAttribute("aria-hidden", "true");
    name.textContent = league.name;
    meta.textContent = `${league.countryName} • ${league.level || 1}. seviye`;
    text.append(name, meta);
    label.dataset.search = norm(`${league.name} ${league.countryName}`);
    label.append(input, flag, text);
    list.append(label);
  }
  const checks = () => [...list.querySelectorAll("input")],
    update = () => {
      count.textContent = `${checks().filter((x) => x.checked).length} lig seçili • seçim yoksa tümü`;
    };
  search.oninput = () =>
    list.querySelectorAll("label").forEach((label) => {
      label.hidden = !label.dataset.search.includes(norm(search.value));
    });
  all.onclick = () => {
    checks()
      .filter((x) => !x.closest("label").hidden)
      .forEach((x) => (x.checked = true));
    update();
  };
  clear.onclick = () => {
    checks().forEach((x) => (x.checked = false));
    update();
  };
  checks().forEach((x) => (x.onchange = update));
  update();
}
function countryFlag(code) {
  return /^[A-Z]{2}$/.test(code || "")
    ? String.fromCodePoint(...[...code].map((x) => 127397 + x.charCodeAt()))
    : "🏳️";
}
function buildPairs(mode, difficulty, selectedLeagues) {
  const pairs = [],
    allowed = (c) =>
      !selectedLeagues.size ||
      selectedLeagues.has(c.leagueId || `${c.country}:${c.league}`);
  if (mode === "clubs") {
    const active = clubs.filter((c) => c.active && allowed(c));
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const answers = namesForClubs([active[i].id, active[j].id]);
        if (
          answers.length &&
          (difficulty !== "easy" || answers.length >= 6) &&
          (difficulty !== "hard" || answers.length <= 3)
        )
          pairs.push({
            a: active[i],
            b: active[j],
            answers,
            key: `${active[i].id}:${active[j].id}`,
          });
      }
  } else {
    for (const c of clubs.filter((x) => x.active && allowed(x))) {
      const grouped = new Map();
      for (const p of clubPlayers.get(c.id) || []) {
        if (!p.nationality) continue;
        if (!grouped.has(p.nationality)) grouped.set(p.nationality, []);
        grouped.get(p.nationality).push(p);
      }
      for (const [nationality, list] of grouped) {
        if (
          (difficulty === "easy" && list.length < 6) ||
          (difficulty === "normal" && list.length < 2) ||
          (difficulty === "hard" && list.length > 2)
        )
          continue;
        pairs.push({
          a: { name: nationality, league: "Vatandaşlık", country: "Ülke" },
          b: c,
          answers: list,
          key: `${nationality}:${c.id}`,
        });
      }
    }
  }
  return pairs.sort(() => Math.random() - 0.5);
}
function startGame(mode, screen) {
  const difficulty = screen.querySelector(".difficulty").value,
    selectedLeagues = new Set(
      [...screen.querySelectorAll(".league-options input:checked")].map(
        (x) => x.value,
      ),
    );
  game = {
    mode,
    round: 0,
    total: +screen.querySelector(".rounds").value,
    seconds: +screen.querySelector(".seconds").value,
    score: 0,
    pairs: buildPairs(mode, difficulty, selectedLeagues),
    history: [],
  };
  if (!game.pairs.length)
    return toast("Seçilen ligler ve zorluk için uygun eşleşme bulunamadı.");
  $("#score").textContent = 0;
  show("game");
  nextRound();
}
function nextRound() {
  clearInterval(timer);
  if (game.round >= game.total || !game.pairs.length) return finishGame();
  const current = game.pairs.shift();
  game.current = current;
  game.round++;
  game.left = game.seconds;
  $("#gameRound").textContent = `Tur ${game.round}/${game.total}`;
  $("#sideA").innerHTML = side(current.a);
  $("#sideB").innerHTML = side(current.b);
  $("#answerInput").value = "";
  $("#answerSuggestions").innerHTML = "";
  $("#gameMessage").textContent = "Ortak futbolcuyu bul";
  tick();
  timer = setInterval(() => {
    game.left--;
    tick();
    if (game.left <= 0) endRound(null, "Süre doldu");
  }, 1000);
  $("#answerInput").focus();
}
function tick() {
  $("#timer").textContent = `${game.left} sn`;
  $("#timebar").style.width =
    `${Math.max(0, (game.left / game.seconds) * 100)}%`;
}
function endRound(player, result) {
  clearInterval(timer);
  if (player) {
    const points = Math.max(10, game.left * 3);
    game.score += points;
    $("#score").textContent = game.score;
    result = `Doğru: ${player.name} (+${points})`;
  }
  game.history.push({
    pair: `${game.current.a.name} — ${game.current.b.name}`,
    result,
    answers: game.current.answers
      .map((x) => x.name)
      .sort((a, b) => a.localeCompare(b, "tr")),
  });
  $("#gameMessage").textContent = result;
  setTimeout(nextRound, 750);
}
function finishGame() {
  $("#finalScore").textContent = `Toplam skor: ${game.score}`;
  $("#roundResults").innerHTML = game.history
    .map(
      (x, i) =>
        `<article><b>${i + 1}. ${esc(x.pair)}</b><small>${esc(x.result)}</small><small><strong>Tüm cevaplar (${x.answers.length}):</strong> ${esc(x.answers.join(" • "))}</small></article>`,
    )
    .join("");
  show("results");
}
$("#answerInput").oninput = (e) => {
  const q = norm(e.target.value);
  if (q.length < 2) return ($("#answerSuggestions").innerHTML = "");
  const hits = players.filter((p) => norm(p.name).includes(q)).slice(0, 10);
  $("#answerSuggestions").innerHTML = hits
    .map(
      (p) =>
        `<button data-id="${p.id}">${esc(p.name)} <small>• ${esc(p.nationality || "")}</small></button>`,
    )
    .join("");
  $$("#answerSuggestions button").forEach(
    (b) =>
      (b.onclick = () => {
        const p = players.find((x) => x.id === +b.dataset.id),
          valid = game.current.answers.some((x) => x.id === p.id);
        if (valid) endRound(p, "");
        else {
          $("#gameMessage").textContent =
            "Bu oyuncu eşleşme için geçerli değil.";
          $("#answerSuggestions").innerHTML = "";
        }
      }),
  );
};
$("#answerInput").onkeydown = (e) => {
  if (e.key === "Enter") {
    const p = game.current?.answers.find(
      (x) => norm(x.name) === norm(e.target.value),
    );
    if (p) endRound(p, "");
    else $("#gameMessage").textContent = "Listeden geçerli bir futbolcu seçin.";
  }
};
$("#pass").onclick = () => endRound(null, "Pas");
function playerRow(p, i, showStats = true) {
  const career = p.clubIds
      .map((id) => clubMap.get(id)?.name)
      .filter(Boolean)
      .sort()
      .join(" • "),
    clubStats = showStats
      ? `${p.goals || 0} gol • ${p.assists || 0} asist • `
      : "",
    national = p.nationalGoals
      ? `<small>Milli takım: ${p.nationalGoals} gol</small>`
      : "";
  return `<article class="player-row"><span class="rank">${i}</span><div class="person">${person(p)}<span><b>${esc(p.name)}</b><small>${esc(p.nationality || "Milliyet bilinmiyor")}${p.birthDate ? ` • ${p.birthDate.slice(0, 4)}` : ""}</small>${national}</span></div><div class="clubs">${esc(career)}</div><span class="badge">${clubStats}${p.clubIds.length} kulüp</span></article>`;
}
function renderCatalog(reset = false) {
  if (reset) catalogPage = 1;
  const q = norm($("#catalogSearch").value),
    club = +$("#catalogClub").value,
    nation = $("#catalogNationality").value,
    sort = $("#catalogSort").value;
  let list = players.filter(
    (p) =>
      (!q || norm(p.name).includes(q)) &&
      (!club || p.clubIds.includes(club)) &&
      (!nation || p.nationality === nation),
  );
  list.sort(
    sort === "name"
      ? (a, b) => a.name.localeCompare(b.name, "tr")
      : sort === "clubs"
        ? (a, b) =>
            b.clubIds.length - a.clubIds.length || b.appearances - a.appearances
        : sort === "birth"
          ? (a, b) => String(b.birthDate).localeCompare(String(a.birthDate))
          : (a, b) =>
              b.appearances - a.appearances ||
              b.clubIds.length - a.clubIds.length,
  );
  const pages = Math.max(1, Math.ceil(list.length / 100));
  catalogPage = Math.min(catalogPage, pages);
  const page = list.slice((catalogPage - 1) * 100, catalogPage * 100);
  $("#catalogCount").textContent =
    `${list.length.toLocaleString("tr-TR")} futbolcu`;
  $("#catalogList").innerHTML =
    page
      .map((p, i) => playerRow(p, (catalogPage - 1) * 100 + i + 1))
      .join("") || '<p class="message">Eşleşen futbolcu bulunamadı.</p>';
  $("#catalogPage").textContent = `${catalogPage} / ${pages}`;
  $("#catalogPrev").disabled = catalogPage === 1;
  $("#catalogNext").disabled = catalogPage === pages;
}
let searchTimer;
$("#catalogSearch").oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderCatalog(true), 180);
};
for (const id of ["catalogClub", "catalogNationality", "catalogSort"])
  $("#" + id).onchange = () => renderCatalog(true);
$("#catalogPrev").onclick = () => {
  catalogPage--;
  renderCatalog();
};
$("#catalogNext").onclick = () => {
  catalogPage++;
  renderCatalog();
};
function renderTravelers() {
  const q = norm($("#travelerSearch").value);
  const list = players
    .filter(
      (p) =>
        p.clubIds.length > 1 &&
        (!q ||
          norm(p.name).includes(q) ||
          p.clubIds.some((id) => norm(clubMap.get(id)?.name).includes(q))),
    )
    .sort(
      (a, b) =>
        b.clubIds.length - a.clubIds.length || b.appearances - a.appearances,
    )
    .slice(0, 250);
  $("#travelerList").innerHTML = list
    .map((p, i) => playerRow(p, i + 1, false))
    .join("");
}
$("#travelerSearch").oninput = renderTravelers;
function renderCompareOptions() {
  const country = $("#compareCountry").value,
    league = $("#compareLeague").value,
    filtered = clubs.filter(
      (c) =>
        (!country || c.country === country) && (!league || c.league === league),
    ),
    options = filtered
      .map(
        (c) =>
          `<option value="${c.id}">${esc(c.name)} • ${esc(c.league)}</option>`,
      )
      .join(""),
    oldA = $("#compareA").value,
    oldB = $("#compareB").value;
  $("#compareA").innerHTML = options;
  $("#compareB").innerHTML = options;
  if (filtered.some((c) => String(c.id) === oldA)) $("#compareA").value = oldA;
  if (filtered.some((c) => String(c.id) === oldB)) $("#compareB").value = oldB;
  else if (filtered.length > 1) $("#compareB").selectedIndex = 1;
}
function compare() {
  const a = +$("#compareA").value,
    b = +$("#compareB").value;
  if (!a || !b)
    return ($("#compareMessage").textContent =
      "Filtrelere uygun iki kulüp seçin.");
  if (a === b)
    return ($("#compareMessage").textContent = "İki farklı kulüp seçin.");
  const list = namesForClubs([a, b]);
  $("#compareMessage").textContent = `${list.length} ortak futbolcu`;
  $("#compareList").innerHTML =
    list
      .sort((x, y) => x.name.localeCompare(y.name, "tr"))
      .map((p, i) => playerRow(p, i + 1))
      .join("") || '<p class="message">Ortak futbolcu bulunamadı.</p>';
}
$("#compareButton").onclick = compare;
$("#compareCountry").onchange = () => {
  const country = $("#compareCountry").value,
    leagues = [
      ...new Set(
        clubs
          .filter((c) => !country || c.country === country)
          .map((c) => c.league),
      ),
    ].sort();
  $("#compareLeague").innerHTML =
    '<option value="">Tüm ligler</option>' +
    leagues.map((x) => `<option>${esc(x)}</option>`).join("");
  renderCompareOptions();
};
$("#compareLeague").onchange = renderCompareOptions;
function showGridSetup() {
  clearTimeout(computerTimer);
  setGridPlaying(false);
  $("#gridSetup").hidden = false;
  $("#gridGame").hidden = true;
  $("#gridResults").hidden = true;
  grid = {};
}
function openGrid() {
  try {
    const saved = JSON.parse(localStorage.getItem("iki-forma-grid"));
    const state = saved?.state,
      valid =
        saved?.dataVersion === DATA.version &&
        state?.status === "playing" &&
        state.grid?.rows?.every((c) => clubMap.has(c.id)) &&
        state.grid?.cols?.every((c) => clubMap.has(c.id));
    if (valid) {
      grid = { ...state, thinking: false };
      $("#gridSetup").hidden = true;
      $("#gridGame").hidden = false;
      $("#gridResults").hidden = true;
      setGridPlaying(true);
      renderGrid();
      announceTurn();
      return;
    }
  } catch {}
  localStorage.removeItem("iki-forma-grid");
  showGridSetup();
}
function resetGridSetup() {
  localStorage.removeItem("iki-forma-grid");
  showGridSetup();
}
function setGridPlaying(active) {
  const view = $("#grid");
  if (active) {
    view.classList.remove("grid-playing");
    window.scrollTo({ top: 0, behavior: "auto" });
    view.classList.add("grid-playing");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  } else view.classList.remove("grid-playing");
}
function generateGrid(selectedLeagues = new Set()) {
  const active = clubs.filter(
      (c) =>
        c.active && (!selectedLeagues.size || selectedLeagues.has(c.leagueId)),
    ),
    ids = new Set(active.map((c) => c.id)),
    near = new Map(active.map((c) => [c.id, new Set()]));
  for (const p of players) {
    const list = p.clubIds.filter((id) => ids.has(id));
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        near.get(list[i]).add(list[j]);
        near.get(list[j]).add(list[i]);
      }
  }
  const pool = active.filter((c) => near.get(c.id).size >= 6);
  for (let n = 0; n < 1500; n++) {
    const rows = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    if (rows.length < 3) break;
    const common = [...near.get(rows[0].id)].filter(
      (id) =>
        !rows.some((r) => r.id === id) &&
        near.get(rows[1].id).has(id) &&
        near.get(rows[2].id).has(id),
    );
    if (common.length >= 3)
      return {
        rows,
        cols: common
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((id) => clubMap.get(id)),
        marks: Array(9).fill(null),
      };
  }
  return null;
}
function startGridGame() {
  const selectedLeagues = new Set(
    [
      ...$("#gridSetup").querySelectorAll(".grid-league-options input:checked"),
    ].map((input) => input.value),
  );
  const board = generateGrid(selectedLeagues);
  if (!board)
    return toast("Geçerli bir ızgara üretilemedi. Lig seçimini genişletin.");
  grid = IkiFormaCore.createGridState({
    mode: $('input[name="gridMode"]:checked').value,
    difficulty: $("#gridDifficulty").value,
    names: [$("#gridNameOne").value, $("#gridNameTwo").value],
  });
  grid.grid = board;
  $("#gridSetup").hidden = true;
  $("#gridGame").hidden = false;
  $("#gridResults").hidden = true;
  setGridPlaying(true);
  renderGrid();
  announceTurn();
}
function renderGrid() {
  let html =
    '<div class="grid-head"></div>' +
    grid.grid.cols
      .map(
        (c) =>
          `<div class="grid-head" title="${esc(c.name)}">${logo(c)}<small>${esc(c.name)}</small><span>${esc(c.country || "")}</span></div>`,
      )
      .join("");
  grid.grid.rows.forEach((r, ri) => {
    html += `<div class="grid-head" title="${esc(r.name)}">${logo(r)}<small>${esc(r.name)}</small><span>${esc(r.country || "")}</span></div>`;
    grid.grid.cols.forEach((c, ci) => {
      const i = ri * 3 + ci,
        m = grid.grid.marks[i],
        p = m && indexes.playerById.get(m.playerId);
      html += `<button class="grid-cell ${m ? `owner-${m.owner}` : ""} ${grid.selectedCell === i ? "selected" : ""}" data-cell="${i}" role="gridcell" aria-label="${esc(r.name)} ve ${esc(c.name)}" ${m || grid.thinking ? "disabled" : ""}>${m ? `<b>${m.owner ? "O" : "X"}</b><small>${esc(p.name)}</small>` : "?"}</button>`;
    });
  });
  $("#gridBoard").innerHTML = html;
  $$("[data-cell]").forEach(
    (b) => (b.onclick = () => openGridEntry(+b.dataset.cell)),
  );
  renderGridStatus();
}
function renderGridStatus() {
  $("#gridTurn").innerHTML =
    `<strong>Sıra: ${esc(grid.players[grid.currentTurn].name)}</strong>${grid.thinking ? " <span>Bilgisayar düşünüyor…</span>" : ""}`;
  $("#gridScores").textContent =
    `${grid.players[0].name}: ${grid.scores[0]} • ${grid.players[1].name}: ${grid.scores[1]}`;
  $("#gridHistory").innerHTML = grid.history
    .slice(-6)
    .reverse()
    .map(
      (h) =>
        `<p><b>${esc(grid.players[h.turn].name)}</b>: ${esc(indexes.playerById.get(h.playerId)?.name || "")} — ${h.valid ? "Doğru" : "Yanlış"}</p>`,
    )
    .join("");
}
function openGridEntry(i) {
  if (grid.thinking || grid.players[grid.currentTurn].computer) return;
  grid.selectedCell = i;
  const r = grid.grid.rows[Math.floor(i / 3)],
    c = grid.grid.cols[i % 3];
  $("#gridPrompt").textContent = `${r.name} × ${c.name}`;
  $("#gridInput").value = "";
  $("#gridSuggestions").innerHTML = "";
  $("#gridEntry").hidden = false;
  renderGrid();
  $("#gridInput").focus();
}
function submitGridPlayer(player) {
  if (!player || grid.selectedCell == null) return;
  const i = grid.selectedCell,
    r = grid.grid.rows[Math.floor(i / 3)],
    c = grid.grid.cols[i % 3],
    valid = indexes.commonPlayerIds(r.id, c.id).has(player.id);
  try {
    grid = IkiFormaCore.applyAttempt(grid, {
      cellIndex: i,
      playerId: player.id,
      valid,
    });
    if (!hasGridMoves()) grid.status = "finished";
  } catch (e) {
    return ($("#gridMessage").textContent =
      {
        PLAYER_USED: "Bu futbolcu daha önce kullanıldı.",
        ATTEMPT_REPEATED: "Bu futbolcu bu hücrede zaten denendi.",
        GAME_LOCKED: "Hamlenin bitmesini bekleyin.",
      }[e.message] || "Hamle uygulanamadı.");
  }
  $("#gridEntry").hidden = true;
  $("#gridInput").value = "";
  $("#gridMessage").textContent = valid
    ? `${player.name}: Doğru!`
    : `${player.name} ortak oyuncu değil. Sıra değişti.`;
  saveGrid();
  renderGrid();
  grid.status === "finished" ? finishGrid() : announceTurn();
}
function hasGridMoves() {
  return grid.grid.marks.some((mark, i) => {
    if (mark) return false;
    const row = grid.grid.rows[Math.floor(i / 3)],
      col = grid.grid.cols[i % 3];
    return [...indexes.commonPlayerIds(row.id, col.id)].some(
      (id) => !grid.usedPlayerIds.includes(id),
    );
  });
}
function announceTurn() {
  renderGridStatus();
  if (grid.players[grid.currentTurn].computer) computerMove();
}
function computerMove() {
  grid = { ...grid, thinking: true };
  renderGrid();
  const open = grid.grid.marks
    .map((m, i) => (m ? null : i))
    .filter((i) => i !== null);
  if (!open.length) return finishGrid();
  const i = open[Math.floor(Math.random() * open.length)],
    r = grid.grid.rows[Math.floor(i / 3)],
    c = grid.grid.cols[i % 3],
    choice = IkiFormaCore.chooseComputerMove({
      rowId: r.id,
      colId: c.id,
      difficulty: grid.difficulty,
      indexes,
      used: new Set(grid.usedPlayerIds),
    });
  if (!choice) return finishGrid();
  computerTimer = setTimeout(() => {
    if (grid.status !== "playing") return;
    grid = { ...grid, thinking: false, selectedCell: i };
    submitGridPlayer(indexes.playerById.get(choice.playerId));
  }, choice.delay);
}
function finishGrid() {
  clearTimeout(computerTimer);
  grid = { ...grid, status: "finished", thinking: false };
  const winner =
    grid.scores[0] === grid.scores[1]
      ? "Berabere"
      : `${grid.players[grid.scores[0] > grid.scores[1] ? 0 : 1].name} kazandı`;
  $("#gridGame").hidden = true;
  $("#gridResults").hidden = false;
  setGridPlaying(true);
  $("#gridResults").innerHTML =
    `<span class="trophy">🏆</span><h2>${esc(winner)}</h2><p>${esc(grid.players[0].name)}: ${grid.scores[0]} • ${esc(grid.players[1].name)}: ${grid.scores[1]}</p><p>Doğru: ${grid.correct.join(" / ")} • Yanlış: ${grid.wrong.join(" / ")}</p><button id="gridAgain" class="cta">Yeni oyun</button>`;
  $("#gridAgain").onclick = showGridSetup;
  localStorage.removeItem("iki-forma-grid");
}
function saveGrid() {
  try {
    localStorage.setItem(
      "iki-forma-grid",
      JSON.stringify({ dataVersion: DATA.version, state: grid }),
    );
  } catch {}
}
$("#gridInput").oninput = (e) => {
  const q = norm(e.target.value);
  if (q.length < 2) return ($("#gridSuggestions").innerHTML = "");
  const hits = players.filter((p) => norm(p.name).includes(q)).slice(0, 12);
  $("#gridSuggestions").innerHTML =
    hits
      .map(
        (p) =>
          `<button role="option" data-grid-player="${p.id}">${esc(p.name)} <small>${esc(p.nationality || "")} • ${p.clubIds.length} kulüp</small></button>`,
      )
      .join("") || "<button disabled>Eşleşen futbolcu yok</button>";
  $$("[data-grid-player]").forEach(
    (b) =>
      (b.onclick = () =>
        submitGridPlayer(indexes.playerById.get(+b.dataset.gridPlayer))),
  );
};
function cancelGridEntry() {
  grid.selectedCell = null;
  $("#gridEntry").hidden = true;
  renderGrid();
}
$("#gridInput").onkeydown = (e) => {
  if (e.key === "Escape") cancelGridEntry();
  if (e.key === "Enter") {
    const p = players.find((x) => norm(x.name) === norm(e.target.value));
    if (p) submitGridPlayer(p);
  }
};
$("#gridCancel").onclick = cancelGridEntry;
$("#newGrid").onclick = resetGridSetup;
$("#startGrid").onclick = startGridGame;
$$('input[name="gridMode"]').forEach(
  (r) =>
    (r.onchange = () => {
      const duo = $('input[name="gridMode"]:checked').value === "duo";
      $("#gridNames").hidden = !duo;
      $("#gridDifficultyWrap").hidden = duo;
    }),
);
async function init() {
  try {
    const response = await fetch("data/web-data.json");
    if (!response.ok) throw new Error("Veri paketi bulunamadı");
    DATA = await response.json();
    clubs = DATA.clubs;
    players = DATA.players;
    clubMap = new Map(clubs.map((c) => [c.id, c]));
    indexes = IkiFormaCore.buildIndexes(DATA);
    for (const c of clubs) clubPlayers.set(c.id, []);
    for (const p of players)
      for (const id of p.clubIds) clubPlayers.get(id)?.push(p);
    $("#heroPlayers").textContent = players.length.toLocaleString("tr-TR");
    $(".hero .kicker").textContent =
      `${Math.floor(players.length / 1000)} BİN+ KARİYER • ÇEVRİMDIŞI VERİ`;
    $(".vs").textContent = "KARŞI";
    const options = clubs
      .map(
        (c) =>
          `<option value="${c.id}">${esc(c.name)} • ${esc(c.league)}</option>`,
      )
      .join("");
    $("#catalogClub").insertAdjacentHTML("beforeend", options);
    const countries = [
      ...new Set(clubs.map((c) => c.country).filter(Boolean)),
    ].sort();
    $("#compareCountry").insertAdjacentHTML(
      "beforeend",
      countries.map((x) => `<option>${esc(x)}</option>`).join(""),
    );
    const leagues = [
      ...new Set(clubs.map((c) => c.league).filter(Boolean)),
    ].sort();
    $("#compareLeague").insertAdjacentHTML(
      "beforeend",
      leagues.map((x) => `<option>${esc(x)}</option>`).join(""),
    );
    renderCompareOptions();
    const nations = [
      ...new Set(players.map((p) => p.nationality).filter(Boolean)),
    ].sort();
    $("#catalogNationality").insertAdjacentHTML(
      "beforeend",
      nations.map((n) => `<option>${esc(n)}</option>`).join(""),
    );
    setupScreen(
      "#classicSetup",
      "İki Forma",
      "İki kulüpte de A takım forması giymiş futbolcuyu bul.",
      "clubs",
    );
    setupScreen(
      "#countrySetup",
      "Ülke × Kulüp",
      "Gösterilen ülkenin vatandaşı olup kulüpte oynamış futbolcuyu bul. Milli maç şartı yoktur.",
      "country",
    );
    enhanceLeagueSelector($("#classicSetup"));
    enhanceLeagueSelector($("#countrySetup"));
    enhanceLeagueSelector($("#gridSetup"));
    const requested = location.hash.slice(1);
    show(
      document.getElementById(requested)?.classList.contains("view")
        ? requested
        : "home",
    );
  } catch (error) {
    $("#loadingText").textContent = `Site yüklenemedi: ${error.message}`;
  }
}
init();
