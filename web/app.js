"use strict";
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="icon" type="image/svg+xml" href="favicon.svg">',
);
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="stylesheet" href="web/grid.css?v=14">',
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
  twin = {},
  randomFive = {},
  online = {},
  computerTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2500);
}
let handlingPopState = false;
function show(id, options = {}) {
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
  if (!handlingPopState && options.history !== false && history.state?.view !== id)
    history.pushState({ view: id }, "", `#${id}`);
}
window.addEventListener("popstate", (event) => {
  handlingPopState = true;
  show(event.state?.view || "home", { history: false });
  handlingPopState = false;
});
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
    `<button class="back" data-view="home">← Ana sayfa</button><div class="surface classic-setup"><span class="kicker">OYUN AYARLARI</span><h2>${title}</h2><p>${description}</p><fieldset><legend>Oyun biçimi</legend><div class="segmented game-format"><label><input type="radio" name="${mode}Format" value="solo" checked><span>Tek oyunculu</span></label><label><input type="radio" name="${mode}Format" value="duo"><span>Aynı cihazda iki oyunculu</span></label><label><input type="radio" name="${mode}Format" value="online"><span>Online iki oyunculu</span></label><label><input type="radio" name="${mode}Format" value="computer"><span>Bilgisayara karşı</span></label></div></fieldset><div class="setup-grid"><label>Tur sayısı<select class="rounds"><option>3</option><option selected>5</option><option>10</option><option>15</option></select></label><label>Tur süresi<select class="seconds"><option>15</option><option selected>30</option><option>45</option></select></label><label>Zorluk<select class="difficulty"><option value="easy">Kolay</option><option value="normal" selected>Normal</option><option value="hard">Zor</option></select><small class="difficulty-help">Bilinen ve orta seviye kulüplerden dengeli sorular.</small></label><label>Cevap yöntemi<select class="answer-method"><option value="text" selected>Serbest metin</option><option value="multiple">Çoktan seçmeli</option></select><small>Çoktan seçmelide dört ilişkili seçenek gösterilir.</small></label><label>Oyuncu tekrar kullanımı<select class="repeat-players"><option value="no" selected>Her futbolcu bir kez</option><option value="yes">Tekrar kullanılabilir</option></select></label></div><fieldset class="league-options"><legend>Oyun ligleri <small>Seçim yapılmazsa tüm ligler kullanılır</small></legend>${leagues.map((league) => `<label><input type="checkbox" value="${esc(league)}"><span>${esc(league)}</span></label>`).join("")}</fieldset><button class="cta start">Oyunu başlat →</button></div>`;
  $(id).querySelector(".repeat-players")?.closest("label").remove();
  const difficulty = $(id).querySelector(".difficulty"), answer = $(id).querySelector(".answer-method"), help = $(id).querySelector(".difficulty-help");
  difficulty.onchange = () => {
    help.textContent = difficulty.value === "easy" ? "Tanınmış kulüpler, bilinen futbolcular ve daha ayırt edilebilir seçenekler." : difficulty.value === "hard" ? "Daha az bilinen kulüpler, eski kariyerler ve birbirine yakın seçenekler." : "Bilinen ve orta seviye kulüplerden dengeli sorular.";
    answer.value = difficulty.value === "easy" ? "multiple" : "text";
  };
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
      flag = document.createElement("img"),
      text = document.createElement("span"),
      name = document.createElement("b"),
      meta = document.createElement("small");
    input.type = "checkbox";
    input.value = league.id;
    flag.className = "flag";
    flag.src = countryFlag(league.countryCode);
    flag.alt = "";
    flag.width = 28;
    flag.height = 28;
    flag.loading = "lazy";
    flag.addEventListener("error", () => {
      const fallback = document.createElement("span");
      fallback.className = "flag flag-fallback";
      fallback.textContent = league.countryCode || "?";
      fallback.setAttribute("aria-hidden", "true");
      flag.replaceWith(fallback);
    });
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
    ? `web/assets/flags/${code.toLowerCase()}.svg`
    : "web/assets/flags/gb.svg";
}
function buildPairsForDifficulty(mode, difficulty, selectedLeagues) {
  const pairs = [],
    allowed = (c) =>
      !selectedLeagues.size ||
      selectedLeagues.has(c.leagueId || `${c.country}:${c.league}`);
  if (mode === "clubs") {
    const active = clubs.filter((c) => c.active && allowed(c) && IkiFormaCore.selectClubByDifficulty([c], difficulty, () => 0));
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
    for (const c of clubs.filter((x) => x.active && allowed(x) && IkiFormaCore.selectClubByDifficulty([x], difficulty, () => 0))) {
      const grouped = new Map();
      for (const p of clubPlayers.get(c.id) || []) {
        if (!p.nationalityCode) continue;
        if (!grouped.has(p.nationalityCode)) grouped.set(p.nationalityCode, []);
        grouped.get(p.nationalityCode).push(p);
      }
      for (const [countryCode, list] of grouped) {
        if (
          (difficulty === "easy" && list.length < 6) ||
          (difficulty === "normal" && list.length < 2) ||
          (difficulty === "hard" && list.length > 2)
        )
          continue;
        pairs.push({
          a: { name: list[0].nationality, league: "Vatandaşlık", country: "Ülke", countryCode },
          b: c,
          answers: list,
          key: `${countryCode}:${c.id}`,
        });
      }
    }
  }
  return pairs.sort(() => Math.random() - 0.5);
}
function organizeHomeMenu() {
  const root = $("#home .mode-grid");
  if (!root) return;
  const cards = new Map([...root.querySelectorAll("[data-view]")].map((card) => [card.dataset.view, card]));
  ["classicSetup", "countrySetup", "grid", "twinSetup", "randomFiveSetup", "compare", "catalog", "travelers"]
    .forEach((view) => cards.get(view) && root.append(cards.get(view)));
}
function buildPairs(mode, difficulty, selectedLeagues, count = Infinity) {
  const levels = difficulty === "hard" ? ["hard", "normal", "easy"] : difficulty === "normal" ? ["normal", "easy"] : ["easy"];
  const pools = Object.fromEntries(levels.map((level) => [level, buildPairsForDifficulty(mode, level, selectedLeagues)]));
  return IkiFormaCore.fillQuestionPoolByDifficulty(pools, difficulty, count);
}
function startGame(mode, screen) {
  const difficulty = screen.querySelector(".difficulty").value,
    selectedLeagues = new Set(
      [...screen.querySelectorAll(".league-options input:checked")].map(
        (x) => x.value,
      ),
    );
  const format = screen.querySelector(".game-format input:checked").value;
  if (format === "online" && typeof openOnlineLobby === "function") return openOnlineLobby(mode, screen);
  game = {
    mode,
    format,
    difficulty,
    answerMethod: screen.querySelector(".answer-method").value,
    round: 0,
    total: +screen.querySelector(".rounds").value,
    seconds: +screen.querySelector(".seconds").value,
    score: 0,
    scores: [0, 0],
    currentTurn: 0,
    playerNames: ["Oyuncu 1", format === "computer" ? "Bilgisayar" : "Oyuncu 2"],
    pairs: buildPairs(mode, difficulty, selectedLeagues, +screen.querySelector(".rounds").value),
    history: [],
  };
  if (!game.pairs.length)
    return toast("Seçilen ligler ve zorluk için uygun eşleşme bulunamadı.");
  if (game.pairs.length < game.total)
    toast(`Yalnızca ${game.pairs.length} geçerli ve tekrarsız soru üretilebildi.`);
  $("#score").textContent = 0;
  show("game");
  nextRound();
}
function nextRound() {
  clearInterval(timer);
  if (game.round >= game.total || !game.pairs.length) return finishGame();
  const current = game.pairs.shift();
  game.current = current;
  game.question = null;
  if (game.answerMethod === "multiple") {
    game.question = game.mode === "clubs"
      ? IkiFormaCore.generateTwoClubMultipleChoiceQuestion({ clubAId: current.a.id, clubBId: current.b.id, indexes, difficulty: game.difficulty })
      : IkiFormaCore.generateCountryClubMultipleChoiceQuestion({ countryCode: current.a.countryCode, clubId: current.b.id, indexes, difficulty: game.difficulty });
    if (!game.question) {
      console.debug("QUESTION_GENERATION_FAILED", { mode: game.mode, key: current.key });
      return game.pairs.length ? nextRound() : finishGame();
    }
  }
  game.round++;
  game.left = game.seconds;
  $("#gameRound").textContent = `Tur ${game.round}/${game.total}`;
  $("#gameContext").textContent = game.format === "solo" ? `${game.answerMethod === "multiple" ? "Çoktan seçmeli" : "Serbest metin"} · ${game.difficulty}` : `${game.playerNames[game.currentTurn]} · ${game.scores[0]}—${game.scores[1]}`;
  $("#sideA").innerHTML = side(current.a);
  $("#sideB").innerHTML = side(current.b);
  $("#answerInput").value = "";
  $("#answerSuggestions").innerHTML = "";
  $("#multipleChoiceOptions").innerHTML = "";
  $("#answerInput").closest(".answer-box").hidden = game.answerMethod === "multiple";
  $("#multipleChoiceOptions").hidden = game.answerMethod !== "multiple";
  $("#gameMessage").textContent = "Ortak futbolcuyu bul";
  tick();
  timer = setInterval(() => {
    game.left--;
    tick();
    if (game.left <= 0) endRound(null, "Süre doldu");
  }, 1000);
  if (game.answerMethod === "multiple") renderMultipleChoice();
  else $("#answerInput").focus();
  if (game.format === "computer" && game.currentTurn === 1) {
    $("#gameMessage").textContent = "Bilgisayar düşünüyor…";
    const accuracy = IkiFormaCore.DIFFICULTIES[game.difficulty].accuracy;
    computerTimer = setTimeout(() => {
      if (game.answerMethod === "multiple") {
        const options = game.question.optionPlayerIds, chosen = Math.random() < accuracy ? game.question.correctPlayerId : options.find((id) => id !== game.question.correctPlayerId);
        answerMultipleChoice(chosen);
      } else if (Math.random() < accuracy) endRound(game.current.answers[0], "");
      else endRound(null, "Bilgisayar yanlış cevapladı");
    }, 700);
  }
}

function onlineSettingsFromScreen(mode, screen) {
  return {
    gameType: mode,
    rounds: +screen.querySelector(".rounds").value,
    seconds: +screen.querySelector(".seconds").value,
    difficulty: screen.querySelector(".difficulty").value,
    answerMethod: screen.querySelector(".answer-method").value,
    optionCount: 4,
    repeatPlayers: true,
    leagueIds: [...screen.querySelectorAll(".league-options input:checked")].map((input) => input.value),
  };
}

function openOnlineLobby(mode, screen) {
  online = { settings: onlineSettingsFromScreen(mode, screen), state: null, service: null };
  $("#onlineEntry").hidden = false;
  $("#onlineRoomState").hidden = true;
  $("#onlineModeNotice").textContent = IkiFormaOnlineService.isLocal
    ? "Geliştirme mock'u etkin: yalnızca bu site adresindeki sekmeler arasında çalışır; internet oyunu değildir."
    : IkiFormaOnlineService.configured ? "Supabase Realtime ile iki farklı cihazdan bağlanabilirsiniz." : "Online servis henüz yapılandırılmadı. README'deki Supabase adımlarını uygulayın veya geliştirme için ?onlineMock=1 kullanın.";
  show("onlineLobby");
}
function openSpecialOnlineLobby(settings) {
  online = { settings: { ...settings, repeatPlayers: true }, state: null, service: null };
  $("#onlineEntry").hidden = false; $("#onlineRoomState").hidden = true;
  $("#onlineModeNotice").textContent = IkiFormaOnlineService.isLocal ? "Geliştirme mock'u etkin; gerçek internet oyunu değildir." : IkiFormaOnlineService.configured ? "Supabase Realtime ile iki farklı cihazdan bağlanabilirsiniz." : "Online servis yapılandırılmadı. README içindeki Supabase adımlarını uygulayın.";
  show("onlineLobby");
}

function saveOnlineSession() {
  sessionStorage.setItem("iki-forma-online-session", JSON.stringify({ code: online.state.roomCode, token: online.token, playerIndex: online.playerIndex }));
}

async function connectOnlineRoom(kind) {
  try {
    if (!IkiFormaOnlineService.configured) throw new Error("ONLINE_NOT_CONFIGURED");
    online.service ||= await IkiFormaOnlineService.createRoomService();
    const playerName = $("#onlinePlayerName").value.trim() || "Oyuncu";
    const result = kind === "create"
      ? await online.service.create({ code: IkiFormaOnlineCore.generateRoomCode(), playerName, settings: online.settings })
      : await online.service.join({ code: $("#onlineRoomCodeInput").value, playerName });
    Object.assign(online, result);
    saveOnlineSession();
    online.unsubscribe = online.service.subscribe(online.state.roomCode, refreshOnlineRoom, (status) => {
      $("#onlineConnection").textContent = status === "SUBSCRIBED" ? "● Bağlı" : status === "LOCAL_MOCK" ? "● Yerel mock" : "Bağlanıyor…";
    });
    renderOnlineLobby();
  } catch (error) {
    const messages = { ONLINE_NOT_CONFIGURED: "Online servis yapılandırılmamış.", ROOM_NOT_FOUND: "Oda bulunamadı.", ROOM_EXPIRED: "Bu odanın süresi dolmuş.", ROOM_FULL: "Oda dolu veya oyun başlamış." };
    $("#onlineModeNotice").textContent = messages[error.message] || `Bağlantı hatası: ${error.message}`;
  }
}

async function refreshOnlineRoom() {
  if (!online.service || !online.state) return;
  try {
    online.state = await online.service.get(online.state.roomCode, online.token);
    renderOnlineLobby();
  } catch (error) {
    $("#onlineLobbyMessage").textContent = error.message === "ROOM_EXPIRED" ? "Odanın süresi doldu." : "Bağlantı kesildi; yeniden bağlanılıyor…";
  }
}

async function restoreOnlineSession() {
  const saved = sessionStorage.getItem("iki-forma-online-session");
  if (!saved || !IkiFormaOnlineService.configured) return false;
  try {
    const session = JSON.parse(saved), service = await IkiFormaOnlineService.createRoomService();
    const state = await service.get(session.code, session.token);
    online = { state, settings: state.settings, service, token: session.token, playerIndex: session.playerIndex };
    online.unsubscribe = service.subscribe(state.roomCode, refreshOnlineRoom, (status) => { $("#onlineConnection").textContent = status === "SUBSCRIBED" ? "● Bağlı" : status === "LOCAL_MOCK" ? "● Yerel mock" : "Yeniden bağlanılıyor…"; });
    show("onlineLobby"); renderOnlineLobby();
    await mutateOnline({ type: "connection", connected: true });
    return true;
  } catch (error) {
    sessionStorage.removeItem("iki-forma-online-session");
    return false;
  }
}

function renderOnlineLobby() {
  const state = online.state;
  if (!state) return;
  $("#onlineEntry").hidden = true; $("#onlineRoomState").hidden = false;
  $("#onlineRoomCode").textContent = state.roomCode;
  $("#onlinePlayers").innerHTML = state.players.map((player, index) => player
    ? `<article class="online-player ${player.connected ? "is-connected" : ""}"><b>${esc(player.name)} ${player.host ? "👑" : ""}</b><small>Oyuncu ${index + 1} · ${player.connected ? "Bağlı" : "Yeniden bağlanıyor"}</small><span>${player.ready ? "✓ Hazır" : "Bekleniyor"}</span></article>`
    : `<article class="online-player"><b>Oyuncu 2</b><small>Rakip bekleniyor…</small></article>`).join("");
  $("#onlineTurn").textContent = state.players[state.currentTurn]?.name || "—";
  $("#onlineScore").textContent = `${state.scores[0]} — ${state.scores[1]}`;
  const me = state.players[online.playerIndex];
  $("#onlineReady").textContent = me?.ready ? "Hazır değilim" : "Hazırım";
  $("#onlineReady").hidden = state.status !== "waiting";
  $("#onlineStart").hidden = online.playerIndex !== 0 || state.status !== "waiting";
  $("#onlineStart").disabled = !state.players.every((player) => player?.ready);
  $("#onlineLobbyMessage").textContent = state.status === "playing" ? "Oyun başladı; soru hazırlanıyor…" : state.players[1] ? "İki oyuncu da hazır olduğunda oda sahibi oyunu başlatabilir." : "Oda kodunu arkadaşınızla paylaşın.";
  if (state.status === "playing" || state.status === "finished") handleOnlineState();
}

async function mutateOnline(action) {
  try {
    online.state = await online.service.mutate(online.state.roomCode, online.token, online.state.stateVersion, action);
    renderOnlineLobby();
    return online.state;
  } catch (error) {
    if (error.message.includes("STALE_STATE")) await refreshOnlineRoom();
    else $("#onlineLobbyMessage").textContent = `İşlem yapılamadı: ${error.message}`;
    return null;
  }
}

$("#createOnlineRoom").onclick = () => connectOnlineRoom("create");
$("#joinOnlineRoom").onclick = () => connectOnlineRoom("join");
$("#copyRoomCode").onclick = async () => { await navigator.clipboard.writeText(online.state.roomCode); toast("Oda kodu kopyalandı."); };
$("#onlineReady").onclick = () => mutateOnline({ type: "ready", ready: !online.state.players[online.playerIndex].ready });
$("#onlineStart").onclick = async () => {
  const state = await mutateOnline({ type: "start" });
  if (state) startOnlineMatch();
};

function startOnlineMatch() {
  if (["grid", "twin", "randomFive"].includes(online.state.settings.gameType)) return startOnlineSpecialMatch();
  online.pairs = buildPairs(online.state.settings.gameType, online.state.settings.difficulty, new Set(online.state.settings.leagueIds || []));
  online.usedPlayerIds = new Set();
  show("game");
  if (online.playerIndex === 0) publishNextOnlineQuestion();
}
async function startOnlineSpecialMatch() {
  const settings = online.state.settings;
  if (online.playerIndex === 0 && !online.state.modeState) {
    let modeState;
    if (settings.gameType === "grid") modeState = { kind: "grid", value: settings.initialState };
    if (settings.gameType === "twin") modeState = { kind: "twin", value: settings.initialState };
    if (settings.gameType === "randomFive") modeState = { kind: "randomFive", value: settings.initialState };
    await mutateOnline({ type: "mode_state", modeState, currentTurn: 0, scores: [0, 0] });
  }
  handleOnlineSpecialState();
}
function handleOnlineSpecialState() {
  const snapshot = online.state?.modeState;
  if (!snapshot) return;
  if (snapshot.kind === "grid") {
    show("grid"); grid = snapshot.value; grid.mode = "online"; grid.online = true;
    grid.players = online.state.players.map((player, index) => ({ ...grid.players[index], name: player.name, computer: false }));
    $("#gridSetup").hidden = true; $("#gridGame").hidden = false; $("#gridResults").hidden = true; setGridPlaying(true); renderGrid(); announceTurn();
    if (grid.status === "finished") finishGrid();
  } else if (snapshot.kind === "twin") {
    hydrateOnlineTwin(snapshot.value); show("twinGame"); if (snapshot.value.finished) return renderOnlineSpecialFinished("twin"); renderTwinTurn(); if (twin.guesses.length === 2) renderTwinSnapshotReveal();
  } else if (snapshot.kind === "randomFive") {
    hydrateOnlineRandomFive(snapshot.value); show("randomFiveGame"); if (snapshot.value.finished) return renderOnlineSpecialFinished("randomFive"); renderRandomFiveRound(); if (randomFive.guesses.length === 2) renderRandomFiveSnapshotReveal();
  }
}
function renderOnlineSpecialFinished(kind) {
  const state = kind === "twin" ? twin : randomFive, winner = state.scores[0] === state.scores[1] ? "Berabere!" : `${state.names[state.scores[0] > state.scores[1] ? 0 : 1]} kazandı!`;
  const prompt = kind === "twin" ? $("#twinPrompt") : $("#randomFivePrompt"), turn = kind === "twin" ? $("#twinTurn") : $("#randomFiveTurn");
  prompt.textContent = `🏆 ${winner}`; turn.textContent = `${state.names[0]}: ${state.scores[0]} · ${state.names[1]}: ${state.scores[1]}`;
}
async function syncSpecialState(kind, value, currentTurn, scores) {
  online.state = await online.service.mutate(online.state.roomCode, online.token, online.state.stateVersion, { type: "mode_state", modeState: { kind, value }, currentTurn, scores });
}

async function publishNextOnlineQuestion() {
  if (online.playerIndex !== 0 || online.publishing) return;
  if (online.state.questionSequence >= online.state.settings.rounds) {
    online.publishing = true; await mutateOnline({ type: "finish" }); online.publishing = false; return;
  }
  online.pairs ||= buildPairs(online.state.settings.gameType, online.state.settings.difficulty, new Set(online.state.settings.leagueIds || []));
  online.usedPlayerIds = new Set(online.state.usedPlayerIds || []);
  let pair, question;
  for (let attempt = 0; attempt < 30 && online.pairs.length; attempt++) {
    pair = online.pairs.shift();
    if (online.state.settings.answerMethod === "multiple") {
      question = online.state.settings.gameType === "clubs"
        ? IkiFormaCore.generateTwoClubMultipleChoiceQuestion({ clubAId: pair.a.id, clubBId: pair.b.id, indexes, used: online.usedPlayerIds, difficulty: online.state.settings.difficulty })
        : IkiFormaCore.generateCountryClubMultipleChoiceQuestion({ countryCode: pair.a.countryCode, clubId: pair.b.id, indexes, used: online.usedPlayerIds, difficulty: online.state.settings.difficulty });
    } else {
      const validPlayerIds = pair.answers.map((player) => +player.id).filter((id) => !online.usedPlayerIds.has(id));
      if (validPlayerIds.length) question = { questionId: `q-${Date.now().toString(36)}-${online.state.questionSequence + 1}`, mode: online.state.settings.gameType, correctPlayerId: validPlayerIds[0], validPlayerIds, optionPlayerIds: [], clubAId: pair.a.id || null, clubBId: pair.b.id, clubId: pair.b.id, countryCode: pair.a.countryCode || null };
    }
    if (question) break;
    console.debug("ONLINE_QUESTION_RETRY", { attempt, key: pair?.key });
  }
  if (!question) return $("#gameMessage").textContent = "Yeterli ve doğrulanmış seçenek üretilemedi.";
  question.deadlineAt = Date.now() + online.state.settings.seconds * 1000;
  online.publishing = true;
  const state = await mutateOnline({ type: "question", question });
  online.publishing = false;
  if (state) handleOnlineState();
}

function handleOnlineState() {
  const state = online.state;
  if (!state) return;
  if (["grid", "twin", "randomFive"].includes(state.settings.gameType)) return handleOnlineSpecialState();
  if (state.status === "finished") {
    clearInterval(timer);
    const names = state.players.map((player) => player.name), winner = state.scores[0] === state.scores[1] ? "Berabere" : `${names[state.scores[0] > state.scores[1] ? 0 : 1]} kazandı`;
    $("#finalScore").textContent = `${winner} · ${state.scores[0]} — ${state.scores[1]}`;
    $("#roundResults").innerHTML = `<article><b>Oda ${esc(state.roomCode)}</b><small>Online oyun tamamlandı.</small></article>`;
    return show("results");
  }
  show("game");
  if (!state.question) return;
  const question = state.question, isCountry = state.settings.gameType === "country";
  game = {
    ...game, online: true, mode: state.settings.gameType, answerMethod: state.settings.answerMethod,
    question, current: {
      a: isCountry ? { name: players.find((player) => player.nationalityCode === question.countryCode)?.nationality || question.countryCode, league: "Vatandaşlık", country: "Ülke", countryCode: question.countryCode } : clubMap.get(+question.clubAId),
      b: clubMap.get(+(question.clubBId || question.clubId)),
      answers: (question.validPlayerIds || [question.correctPlayerId]).map((id) => indexes.playerById.get(+id)).filter(Boolean),
    },
  };
  $("#gameRound").textContent = `Online · Tur ${state.questionSequence}/${state.settings.rounds} · ${state.players[state.currentTurn].name}`;
  $("#gameContext").textContent = `${state.roomCode} · ${state.settings.answerMethod === "multiple" ? "Çoktan seçmeli" : "Serbest metin"} · ${state.scores[0]}—${state.scores[1]}`;
  $("#sideA").innerHTML = side(game.current.a); $("#sideB").innerHTML = side(game.current.b);
  $("#answerInput").closest(".answer-box").hidden = game.answerMethod === "multiple";
  $("#multipleChoiceOptions").hidden = game.answerMethod !== "multiple";
  $("#pass").disabled = state.currentTurn !== online.playerIndex || state.answeredBy !== null;
  if (game.answerMethod === "multiple") renderMultipleChoice(); else $("#answerInput").focus();
  if (state.answeredBy !== null) {
    const selected = indexes.playerById.get(+state.selectedPlayerId), correct = indexes.playerById.get(+question.correctPlayerId);
    $("#gameMessage").textContent = state.answerResult === "correct" ? `✓ Doğru: ${selected?.name}` : state.answerResult === "pass" ? "Pas geçildi; sıra rakipte." : `✕ Yanlış. Doğru cevap: ${correct?.name}`;
    if (game.answerMethod === "multiple") $("#multipleChoiceOptions").querySelectorAll("button").forEach((button) => { button.disabled = true; if (+button.dataset.playerId === +question.correctPlayerId) button.classList.add("is-correct"); if (+button.dataset.playerId === +state.selectedPlayerId && state.answerResult !== "correct") button.classList.add("is-wrong"); });
    if (online.playerIndex === 0 && online.advanceScheduledSeq !== state.questionSequence) {
      online.advanceScheduledSeq = state.questionSequence;
      setTimeout(() => { refreshOnlineRoom().then(publishNextOnlineQuestion); }, 1400);
    }
  } else {
    $("#gameMessage").textContent = state.currentTurn === online.playerIndex ? "Sıra sizde." : `${state.players[state.currentTurn].name} cevaplıyor…`;
  }
  clearInterval(timer);
  const updateOnlineTime = () => { const left = Math.max(0, Math.ceil((question.deadlineAt - Date.now()) / 1000)); $("#timer").textContent = `${left} sn`; $("#timebar").style.width = `${Math.min(100, left / state.settings.seconds * 100)}%`; if (!left) clearInterval(timer); };
  updateOnlineTime(); timer = setInterval(updateOnlineTime, 500);
}

async function submitOnlinePlayer(playerId) {
  if (online.state.currentTurn !== online.playerIndex) return toast("Sıra rakibinizde.");
  await mutateOnline({ type: "answer", questionId: online.state.question.questionId, selectedPlayerId: +playerId });
  handleOnlineState();
}

function renderMultipleChoice() {
  const root = $("#multipleChoiceOptions");
  root.innerHTML = game.question.optionPlayerIds.map((id, index) => {
    const player = indexes.playerById.get(id), flag = countryFlag(player.nationalityCode);
    const meta = game.mode === "country" ? (player.birthDate ? `Doğum: ${esc(player.birthDate.slice(0, 4))}` : "Kariyer oyuncusu") : `<img src="${flag}" alt="" width="22" height="15"> ${esc(player.nationality || "Milliyet bilinmiyor")}`;
    return `<button class="choice-option" data-player-id="${id}" aria-label="${index + 1}. ${esc(player.name)}"><span class="choice-key">${index + 1}</span>${person(player)}<span><b>${esc(player.name)}</b><small>${meta}</small></span><i aria-hidden="true"></i></button>`;
  }).join("");
  root.querySelectorAll("button").forEach((button) => button.onclick = () => answerMultipleChoice(+button.dataset.playerId));
  root.onkeydown = (event) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...root.querySelectorAll("button:not(:disabled)")], current = buttons.indexOf(document.activeElement);
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    buttons[(current + direction + buttons.length) % buttons.length]?.focus();
  };
  root.querySelector("button")?.focus();
}

function answerMultipleChoice(playerId) {
  if (game.online) return submitOnlinePlayer(playerId);
  if (game.answerLocked) return;
  game.answerLocked = true;
  clearInterval(timer);
  const correctId = game.question.correctPlayerId, selected = indexes.playerById.get(playerId), correct = indexes.playerById.get(correctId), isCorrect = playerId === correctId;
  $("#multipleChoiceOptions").querySelectorAll("button").forEach((button) => {
    button.disabled = true;
    if (+button.dataset.playerId === correctId) { button.classList.add("is-correct"); button.querySelector("i").textContent = "✓ Doğru"; }
    else if (+button.dataset.playerId === playerId) { button.classList.add("is-wrong"); button.querySelector("i").textContent = "✕ Yanlış"; }
  });
  const relation = IkiFormaCore.optionRelation ? IkiFormaCore.optionRelation(game.question, selected, indexes) : [];
  const explanation = isCorrect
    ? game.mode === "clubs" ? `${correct.name}, iki kulübün de A takımında oynadı.` : `${correct.name}, ${game.current.a.name} vatandaşı ve ${game.current.b.name} A takımında oynadı.`
    : game.mode === "clubs" ? `${selected.name}, gösterilen kulüplerden yalnızca birinde oynadı.` : `${selected.name}, ülke ve kulüp koşullarından yalnızca birini sağlıyor.`;
  $("#gameMessage").textContent = `${isCorrect ? "✓ Doğru" : "✕ Yanlış"}. ${explanation}`;
  setTimeout(() => { game.answerLocked = false; endRound(isCorrect ? correct : null, isCorrect ? "" : `Yanlış: ${selected.name}`); }, 1200);
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
    game.scores[game.currentTurn] += points;
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
  $("#finalScore").textContent = game.format === "duo" || game.format === "computer"
    ? `${game.playerNames[0]} ${game.scores[0]} — ${game.scores[1]} ${game.playerNames[1]}`
    : `Toplam skor: ${game.score}`;
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
  const hits = (game.current?.answers || []).filter((p) => norm(p.name).includes(q)).slice(0, 10);
  $("#answerSuggestions").innerHTML = hits
    .map(
      (p) =>
        `<button class="player-suggestion" data-id="${p.id}">${person(p)}<span><b>${esc(p.name)}</b><small>${esc(p.nationality || "")}</small></span></button>`,
    )
    .join("");
  $$("#answerSuggestions button").forEach(
    (b) =>
      (b.onclick = () => {
        const p = players.find((x) => x.id === +b.dataset.id),
          valid = game.current.answers.some((x) => x.id === p.id);
        if (game.online) submitOnlinePlayer(p.id);
        else if (valid) endRound(p, "");
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
    if (p && game.online) submitOnlinePlayer(p.id);
    else if (p) endRound(p, "");
    else $("#gameMessage").textContent = "Listeden geçerli bir futbolcu seçin.";
  }
};
$("#pass").onclick = async () => {
  if (game.online) {
    await mutateOnline({ type: "pass", questionId: online.state.question.questionId });
    return handleOnlineState();
  } else if (game.format === "duo" || game.format === "computer") game.currentTurn = game.currentTurn ? 0 : 1;
  endRound(null, "Pas");
};
function playerRow(p, i, showStats = true) {
  const career = p.clubIds
      .map((id) => clubMap.get(id)?.name)
      .filter(Boolean)
      .sort()
      .join(" • "),
    clubStats = showStats
      ? `${p.careerGoals ?? (p.goals || 0) + (p.nationalGoals || 0)} toplam gol • ${p.assists || 0} asist • `
      : "",
    national = `<small>Milli: ${p.nationalCaps || 0} maç • ${p.nationalGoals || 0} gol • asist: kaynakta yok</small>`,
    marketValue = Number.isFinite(p.marketValueInEur)
      ? new Intl.NumberFormat("tr-TR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
          notation: "compact",
        }).format(p.marketValueInEur)
      : "Piyasa değeri yok",
    coverage = p.statisticsComplete ? "Tam kulüp kariyeri" : "Sınırlı tarihsel kapsam",
    stats = showStats
      ? `<small class="player-stats">${p.appearances || 0} maç • ${p.goals || 0} kulüp golü • ${p.careerGoals ?? (p.goals || 0) + (p.nationalGoals || 0)} toplam gol • ${p.assists || 0} asist • ${p.yellowCards || 0} sarı • ${p.redCards || 0} kırmızı • ${esc(marketValue)} • ${coverage}</small>`
      : "";
  return `<article class="player-row"><span class="rank">${i}</span><div class="person">${person(p)}<span><b>${esc(p.name)}</b><small>${esc(p.nationality || "Milliyet bilinmiyor")}${p.birthDate ? ` • ${p.birthDate.slice(0, 4)}` : ""}</small>${national}</span></div><div class="clubs">${esc(career)}${stats}</div><span class="badge">${clubStats}${p.clubIds.length} kulüp</span></article>`;
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
        : sort === "goals"
          ? (a, b) =>
              (b.careerGoals ?? b.goals + (b.nationalGoals || 0)) -
                (a.careerGoals ?? a.goals + (a.nationalGoals || 0)) ||
              b.appearances - a.appearances
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
        state.grid?.rows?.every((c) => c.type ? ["club", "league", "country"].includes(c.type) : clubMap.has(c.id)) &&
        state.grid?.cols?.every((c) => c.type ? ["club", "league", "country"].includes(c.type) : clubMap.has(c.id));
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
function criterionClub(club) { return { type: "club", id: club.id, name: club.name, country: club.country, logoAsset: club.logoAsset, logo: club.logo }; }
const GRID_LEAGUE_BADGES = Object.freeze({
  GB1: { code: "PL", colors: ["#5b1b75", "#25d9b4"] },
  ES1: { code: "LL", colors: ["#e43d30", "#f5c542"] },
  IT1: { code: "SA", colors: ["#1266c5", "#ffffff"] },
  L1: { code: "BL", colors: ["#d71920", "#ffffff"] },
  FR1: { code: "L1", colors: ["#182a64", "#d7ff3f"] },
  TR1: { code: "SL", colors: ["#e21f2f", "#ffffff"] },
});
function leagueBadge(criterion) {
  const badge = GRID_LEAGUE_BADGES[criterion.id] || { code: "LİG", colors: ["#315b7c", "#ffffff"] };
  return `<span class="league-badge" style="--league-color:${badge.colors[0]};--league-ink:${badge.colors[1]}" aria-hidden="true"><i>⚽</i><b>${badge.code}</b></span>`;
}
function gridCriterionPools(selectedLeagues) {
  const active = clubs.filter((club) => club.active && (!selectedLeagues.size || selectedLeagues.has(club.leagueId)));
  const clubCriteria = active
    .filter((club) => (clubPlayers.get(+club.id) || []).length >= 4)
    .sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0))
    .slice(0, 350).map(criterionClub);
  const leagueCriteria = (DATA.leagues || []).filter((league) => IkiFormaCore.GRID_LEAGUE_IDS.includes(league.id)).map((league) => ({ type: "league", id: league.id, name: league.name, country: league.countryName }));
  const countries = new Map();
  for (const player of players) if (player.nationalityCode && !countries.has(player.nationalityCode)) countries.set(player.nationalityCode, { type: "country", id: player.nationalityCode, code: player.nationalityCode, name: player.nationality, country: "Ülke" });
  const countryCriteria = [...countries.values()]
    .filter((criterion) => (indexes.nationalityPlayerIds.get(criterion.code) || new Set()).size >= 30)
    .sort((a, b) => (indexes.nationalityPlayerIds.get(b.code)?.size || 0) - (indexes.nationalityPlayerIds.get(a.code)?.size || 0))
    .slice(0, 45);
  return { clubCriteria, leagueCriteria, countryCriteria };
}
function generateGrid(selectedLeagues = new Set(), type = "club") {
  const pools = gridCriterionPools(selectedLeagues), shuffled = (list) => [...list].sort(() => Math.random() - .5);
  for (let attempt = 0; attempt < 250; attempt++) {
    let rowPool, colPool;
    if (type === "leagueClub") [rowPool, colPool] = [pools.leagueCriteria, pools.clubCriteria];
    else if (type === "countryClub") [rowPool, colPool] = [pools.countryCriteria, pools.clubCriteria];
    else if (type === "mixed") [rowPool, colPool] = [[...pools.clubCriteria, ...pools.leagueCriteria, ...pools.countryCriteria], [...pools.clubCriteria, ...pools.leagueCriteria, ...pools.countryCriteria]];
    else [rowPool, colPool] = [pools.clubCriteria, pools.clubCriteria];
    const rows = shuffled(rowPool).slice(0, 3);
    if (rows.length < 3) continue;
    const eligible = colPool.filter((criterion) =>
      !rows.some((row) => row.type === criterion.type && row.id === criterion.id) &&
      rows.every((row) => IkiFormaCore.getPlayersForCriteria(row, criterion, indexes).length));
    const cols = shuffled(eligible).slice(0, 3);
    if (cols.length === 3) return { rows, cols, marks: Array(9).fill(null), type };
  }
  return null;
}
function startGridGame() {
  const selectedLeagues = new Set(
    [
      ...$("#gridSetup").querySelectorAll(".grid-league-options input:checked"),
    ].map((input) => input.value),
  );
  const board = generateGrid(selectedLeagues, $("#gridType").value);
  if (!board)
    return toast("Geçerli bir ızgara üretilemedi. Lig seçimini genişletin.");
  grid = IkiFormaCore.createGridState({
    mode: $('input[name="gridMode"]:checked').value,
    difficulty: $("#gridDifficulty").value,
    names: [$("#gridNameOne").value, $("#gridNameTwo").value],
  });
  grid.grid = board;
  grid.answerMethod = $("#gridAnswerMethod").value;
  if (grid.mode === "online") {
    grid.mode = "duo"; grid.players[1].computer = false;
    return openSpecialOnlineLobby({ gameType: "grid", difficulty: grid.difficulty, leagueIds: [...selectedLeagues], initialState: grid });
  }
  $("#gridSetup").hidden = true;
  $("#gridGame").hidden = false;
  $("#gridResults").hidden = true;
  setGridPlaying(true);
  renderGrid();
  announceTurn();
}
function renderGrid() {
  const criterionHead = (criterion) => criterion.type === "country"
    ? `<img class="flag" src="${countryFlag(criterion.code)}" alt=""><small>${esc(criterion.name)}</small><span>Ülke</span>`
    : criterion.type === "league" ? `${leagueBadge(criterion)}<small>${esc(criterion.name)}</small><span>${esc(criterion.country || "Lig")}</span>`
    : `${logo(criterion)}<small>${esc(criterion.name)}</small><span>${esc(criterion.country || "")}</span>`;
  let html =
    '<div class="grid-head"></div>' +
    grid.grid.cols
      .map(
        (c) =>
          `<div class="grid-head" title="${esc(c.name)}">${criterionHead(c)}</div>`,
      )
      .join("");
  grid.grid.rows.forEach((r, ri) => {
    html += `<div class="grid-head" title="${esc(r.name)}">${criterionHead(r)}</div>`;
    grid.grid.cols.forEach((c, ci) => {
      const i = ri * 3 + ci,
        m = grid.grid.marks[i],
        p = m && indexes.playerById.get(m.playerId),
        winning = grid.winningLine?.includes(i) ? "winning" : "";
      html += `<button class="grid-cell ${m ? `owner-${m.owner}` : ""} ${grid.selectedCell === i ? "selected" : ""} ${winning}" data-cell="${i}" role="gridcell" aria-label="${esc(r.name)} ve ${esc(c.name)}" ${m || grid.thinking ? "disabled" : ""}>${m ? `<b>${m.owner ? "O" : "X"}</b><small>${esc(p.name)}</small>` : "?"}</button>`;
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
  if (grid.online && online.state.currentTurn !== online.playerIndex) return toast("Sıra rakibinizde.");
  grid.selectedCell = i;
  const r = grid.grid.rows[Math.floor(i / 3)],
    c = grid.grid.cols[i % 3];
  $("#gridPrompt").textContent = `${r.name} × ${c.name}`;
  $("#gridInput").value = "";
  $("#gridSuggestions").innerHTML = "";
  $("#gridInput").hidden = grid.answerMethod === "multiple";
  $("#gridChoices").hidden = grid.answerMethod !== "multiple";
  $("#gridChoices").innerHTML = "";
  $("#gridEntry").hidden = false;
  renderGrid();
  if (grid.answerMethod === "multiple") {
    grid.question = IkiFormaCore.generateCriteriaMultipleChoiceQuestion({ first: r, second: c, indexes, difficulty: grid.difficulty });
    if (!grid.question) { $("#gridEntry").hidden = true; return toast("Bu hücre için dört geçerli seçenek üretilemedi."); }
    renderPlayerChoices($("#gridChoices"), grid.question.optionPlayerIds.map((id) => indexes.playerById.get(id)), submitGridPlayer);
  } else $("#gridInput").focus();
}
async function submitGridPlayer(player) {
  if (!player || grid.selectedCell == null) return;
  const i = grid.selectedCell,
    r = grid.grid.rows[Math.floor(i / 3)],
    c = grid.grid.cols[i % 3],
    valid = IkiFormaCore.playerMatchesCriterion(player, r, indexes) && IkiFormaCore.playerMatchesCriterion(player, c, indexes);
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
  if (grid.online) {
    await syncSpecialState("grid", grid, grid.currentTurn, grid.scores);
    online.state.modeState.value = grid;
  } else saveGrid();
  renderGrid();
  grid.status === "finished" ? finishGrid() : announceTurn();
}
function hasGridMoves() {
  return grid.grid.marks.some((mark, i) => {
    if (mark) return false;
    const row = grid.grid.rows[Math.floor(i / 3)],
      col = grid.grid.cols[i % 3];
    return IkiFormaCore.getPlayersForCriteria(row, col, indexes).length > 0;
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
    validPlayers = IkiFormaCore.getPlayersForCriteria(r, c, indexes),
    wrongPlayers = IkiFormaCore.getOneCriterionOnlyPlayers(r, c, indexes),
    accuracy = IkiFormaCore.DIFFICULTIES[grid.difficulty].accuracy,
    correct = validPlayers.length && (!wrongPlayers.length || Math.random() < accuracy),
    choicePool = correct ? validPlayers : wrongPlayers,
    picked = choicePool[Math.floor(Math.random() * choicePool.length)],
    choice = picked ? { playerId: picked.id, valid: correct, delay: 650 } : null;
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
  const hasLineWinner = Number.isInteger(grid.winner),
    winnerIndex = hasLineWinner
      ? grid.winner
      : grid.scores[0] === grid.scores[1]
        ? null
        : grid.scores[0] > grid.scores[1]
          ? 0
          : 1,
    winner =
      winnerIndex === null
        ? "Berabere"
        : `${grid.players[winnerIndex].name} kazandı`,
    outcome = hasLineWinner
      ? `<p><strong>${esc(grid.players[winnerIndex ? 0 : 1].name)} kaybetti.</strong> Üçlü XOX çizgisi tamamlandı.</p>`
      : "<p>Geçerli hamleler tamamlandı; sonuç skora göre belirlendi.</p>";
  $("#gridGame").hidden = true;
  $("#gridResults").hidden = false;
  setGridPlaying(true);
  $("#gridResults").innerHTML =
    `<span class="trophy">🏆</span><h2>${esc(winner)}</h2>${outcome}<p>${esc(grid.players[0].name)}: ${grid.scores[0]} • ${esc(grid.players[1].name)}: ${grid.scores[1]}</p><p>Doğru: ${grid.correct.join(" / ")} • Yanlış: ${grid.wrong.join(" / ")}</p><button id="gridAgain" class="cta">Yeni oyun</button>`;
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
          `<button class="player-suggestion" role="option" data-grid-player="${p.id}">${person(p)}<span><b>${esc(p.name)}</b><small>${esc(p.nationality || "")} • ${p.clubIds.length} kulüp</small></span></button>`,
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

function selectedLeagueContext(root) {
  const selected = new Set([...root.querySelectorAll(".league-options input:checked")].map((input) => input.value)),
    allowedClubs = clubs.filter((club) => !selected.size || selected.has(club.leagueId || `${club.country}:${club.league}`)),
    clubIds = new Set(allowedClubs.map((club) => club.id));
  return { selected, allowedClubs, clubIds };
}
function twinPool(root = $("#twinSetup")) {
  const { clubIds } = selectedLeagueContext(root);
  return players.filter(
    (p) =>
      p.statisticsComplete &&
      p.appearances >= 50 &&
      p.clubIds.some((id) => clubIds.has(id)) &&
      IkiFormaCore.TWIN_METRICS.every((metric) =>
        Number.isFinite(Number(p[metric.key])),
      ),
  );
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function renderPlayerChoices(root, choices, callback) {
  root.classList.add("inline-choices");
  root.innerHTML = choices.map((player, index) => `<button class="player-suggestion" data-choice="${player.id}"><span class="choice-key">${index + 1}</span>${person(player)}<span><b>${esc(player.name)}</b><small>${esc(player.nationality || "")}</small></span></button>`).join("");
  root.querySelectorAll("[data-choice]").forEach((button) => button.onclick = () => callback(indexes.playerById.get(+button.dataset.choice)));
}
function buildRandomFiveSet(allowedClubs, pool) {
  const availableIds = new Set(allowedClubs.map((club) => club.id)),
    anchors = pool.filter((player) => player.clubIds.filter((id) => availableIds.has(id)).length >= 2),
    anchor = anchors[Math.floor(Math.random() * anchors.length)],
    linked = shuffle((anchor?.clubIds || []).filter((id) => availableIds.has(id))).slice(0, 2 + Math.floor(Math.random() * 3)),
    chosen = new Set(linked);
  for (const club of shuffle(allowedClubs)) {
    if (chosen.size >= 5) break;
    chosen.add(club.id);
  }
  return [...chosen].slice(0, 5).map((id) => clubMap.get(id));
}
function startRandomFiveGame() {
  const mode = $('input[name="randomFiveMode"]:checked').value,
    context = selectedLeagueContext($("#randomFiveSetup")),
    allowedClubs = context.allowedClubs.filter((club) => club.active !== false),
    pool = players.filter((player) => player.clubIds.some((id) => context.clubIds.has(id)));
  if (allowedClubs.length < 5) return toast("Bu lig seçiminde en az beş kulüp gerekli.");
  randomFive = {
    mode,
    answerMethod: $("#randomFiveAnswerMethod").value,
    difficulty: $("#randomFiveDifficulty").value,
    names: [$("#randomFiveNameOne").value.trim() || "Oyuncu 1", mode === "duo" ? $("#randomFiveNameTwo").value.trim() || "Oyuncu 2" : "Bilgisayar"],
    scores: [0, 0], round: 0, guesses: [], used: [new Set(), new Set()], pool,
    sets: Array.from({ length: 5 }, () => buildRandomFiveSet(allowedClubs, pool)),
  };
  if (mode === "online") {
    const initialState = { difficulty: randomFive.difficulty, answerMethod: randomFive.answerMethod, scores: [0, 0], round: 0, guesses: [], setIds: randomFive.sets.map((set) => set.map((club) => club.id)) };
    return openSpecialOnlineLobby({ gameType: "randomFive", difficulty: randomFive.difficulty, answerMethod: randomFive.answerMethod, rounds: 5, leagueIds: [...context.selected], initialState });
  }
  if (randomFive.sets.some((set) => set.length < 5)) return toast("Beşli kulüp seti oluşturulamadı.");
  show("randomFiveGame");
  renderRandomFiveRound();
}
function renderRandomFiveRound() {
  clearTimeout(randomFive.nextTimer);
  const set = randomFive.sets[randomFive.round];
  if (!randomFive.online) randomFive.guesses = [];
  $("#randomFiveRound").textContent = `Set ${randomFive.round + 1}/5`;
  $("#randomFiveScore").innerHTML = `<b>${esc(randomFive.names[0])} ${randomFive.scores[0]}</b><span>—</span><b>${randomFive.scores[1]} ${esc(randomFive.names[1])}</b>`;
  $("#randomFiveClubs").innerHTML = set.map((club) => `<article>${logo(club)}<b>${esc(club.name)}</b><small>${esc(club.league || "")}</small></article>`).join("");
  $("#randomFivePrompt").textContent = "Bu beşlinin kaçında oynayan bir futbolcu bulabilirsin?";
  $("#randomFiveTurn").textContent = `${randomFive.names[0]} tahminini girsin.`;
  if (randomFive.online) $("#randomFiveTurn").textContent = `${randomFive.names[online.state.currentTurn]} tahminini girsin.`;
  $("#randomFiveInput").value = "";
  $("#randomFiveInput").disabled = false;
  $("#randomFiveInput").hidden = randomFive.answerMethod === "multiple";
  $("#randomFiveGame .random-five-answer").hidden = false;
  $("#randomFiveSuggestions").innerHTML = "";
  $("#randomFiveSuggestions").classList.toggle("inline-choices", randomFive.answerMethod === "multiple");
  if (randomFive.answerMethod === "multiple") {
    randomFive.choiceEntries = IkiFormaCore.generateRandomFiveOptions({ pool: randomFive.pool, clubIds: set.map((club) => club.id), difficulty: randomFive.difficulty });
    if (!randomFive.choiceEntries) return toast("Bu set için dört kaliteli seçenek üretilemedi.");
    renderPlayerChoices($("#randomFiveSuggestions"), randomFive.choiceEntries.map((entry) => entry.player), submitRandomFiveGuess);
  }
  $("#randomFiveReveal").hidden = true;
  $("#randomFiveNext").hidden = true;
  $("#randomFiveInput").focus();
}
async function submitRandomFiveGuess(player) {
  if (!player) return;
  if (randomFive.online && online.state.currentTurn !== online.playerIndex) return toast("Sıra rakibinizde.");
  const ids = randomFive.sets[randomFive.round].map((club) => club.id);
  randomFive.guesses.push(player);
  $("#randomFiveInput").value = "";
  $("#randomFiveSuggestions").innerHTML = "";
  if (randomFive.mode === "duo" && randomFive.guesses.length === 1) {
    $("#randomFiveTurn").textContent = `${randomFive.names[1]} tahminini girsin. İlk tahmin gizlendi.`;
    if (randomFive.answerMethod === "multiple")
      renderPlayerChoices($("#randomFiveSuggestions"), randomFive.choiceEntries.map((entry) => entry.player), submitRandomFiveGuess);
    return $("#randomFiveInput").focus();
  }
  if (randomFive.online && randomFive.guesses.length === 1) {
    await syncSpecialState("randomFive", serializeOnlineRandomFive(), 1, randomFive.scores);
    return handleOnlineSpecialState();
  }
  if (randomFive.mode === "computer" && randomFive.guesses.length === 1) {
    let guess;
    if (randomFive.answerMethod === "multiple") {
      const ranked = [...randomFive.choiceEntries].sort((a, b) => b.score - a.score);
      const pick = randomFive.difficulty === "hard" ? 0 : randomFive.difficulty === "easy" ? Math.min(ranked.length - 1, 2 + Math.floor(Math.random() * 2)) : Math.floor(Math.random() * Math.min(2, ranked.length));
      guess = ranked[pick];
    } else guess = IkiFormaCore.chooseRandomFiveComputer({ pool: randomFive.pool, clubIds: ids, difficulty: randomFive.difficulty });
    if (guess) randomFive.guesses.push(guess.player);
  }
  revealRandomFiveRound();
  if (randomFive.mode === "computer" && IkiFormaCore.randomFiveScore(randomFive.guesses[0], ids) === 0) {
    $("#randomFiveTurn").textContent = `${randomFive.names[0]} 0 puan aldı. Sonraki sete geçiliyor…`;
    const answeredRound = randomFive.round;
    randomFive.nextTimer = setTimeout(() => {
      if (randomFive.round === answeredRound && !$("#randomFiveNext").hidden) nextRandomFiveRound();
    }, 1600);
  }
  if (randomFive.online) await syncSpecialState("randomFive", serializeOnlineRandomFive(), 0, randomFive.scores);
}
function revealRandomFiveRound() {
  const ids = randomFive.sets[randomFive.round].map((club) => club.id),
    points = randomFive.guesses.map((player) => IkiFormaCore.randomFiveScore(player, ids));
  randomFive.scores = randomFive.scores.map((score, index) => score + points[index]);
  $("#randomFiveInput").disabled = true;
  $("#randomFiveTurn").textContent = points[0] === points[1] ? `Bu set ${points[0]}-${points[1]} berabere.` : `${randomFive.names[points[0] > points[1] ? 0 : 1]} sette daha çok kulüp buldu.`;
  $("#randomFiveReveal").innerHTML = randomFive.guesses.map((player, index) => `<article class="${points[index] === Math.max(...points) ? "winner" : ""}">${person(player)}<div><small>${esc(randomFive.names[index])}</small><b>${esc(player.name)}</b><span>${points[index]} kulüp · +${points[index]} puan</span></div></article>`).join("");
  $("#randomFiveReveal").hidden = false;
  $("#randomFiveNext").textContent = randomFive.round === 4 ? "Sonucu gör →" : "Sonraki set →";
  $("#randomFiveNext").hidden = false;
  $("#randomFiveScore").innerHTML = `<b>${esc(randomFive.names[0])} ${randomFive.scores[0]}</b><span>—</span><b>${randomFive.scores[1]} ${esc(randomFive.names[1])}</b>`;
}
async function nextRandomFiveRound() {
  if (randomFive.online && online.playerIndex !== 0) return toast("Sonraki seti oda sahibi açar.");
  randomFive.round++;
  if (randomFive.round < 5) { randomFive.guesses = []; if (randomFive.online) await syncSpecialState("randomFive", serializeOnlineRandomFive(), 0, randomFive.scores); return renderRandomFiveRound(); }
  const winner = randomFive.scores[0] === randomFive.scores[1] ? "Berabere!" : `${randomFive.names[randomFive.scores[0] > randomFive.scores[1] ? 0 : 1]} kazandı!`;
  $("#randomFiveClubs").innerHTML = "";
  $("#randomFivePrompt").textContent = `🏆 ${winner}`;
  $("#randomFiveTurn").textContent = `${randomFive.names[0]}: ${randomFive.scores[0]} · ${randomFive.names[1]}: ${randomFive.scores[1]}`;
  $("#randomFiveGame .random-five-answer").hidden = true;
  $("#randomFiveReveal").innerHTML = '<button class="cta" data-view="randomFiveSetup">Yeniden oyna</button>';
  $("#randomFiveReveal").hidden = false;
  $("#randomFiveNext").hidden = true;
  if (randomFive.online) await syncSpecialState("randomFive", serializeOnlineRandomFive(), 0, randomFive.scores);
}
function renderRandomFiveSnapshotReveal() {
  const ids = randomFive.sets[randomFive.round].map((club) => club.id), points = randomFive.guesses.map((player) => IkiFormaCore.randomFiveScore(player, ids));
  $("#randomFiveReveal").innerHTML = randomFive.guesses.map((player, index) => `<article class="${points[index] === Math.max(...points) ? "winner" : ""}">${person(player)}<div><small>${esc(randomFive.names[index])}</small><b>${esc(player.name)}</b><span>${points[index]} kulüp</span></div></article>`).join("");
  $("#randomFiveReveal").hidden = false; $("#randomFiveNext").hidden = online.playerIndex !== 0; $("#randomFiveInput").disabled = true;
}
function serializeOnlineRandomFive() { return { difficulty: randomFive.difficulty, answerMethod: randomFive.answerMethod, scores: randomFive.scores, round: randomFive.round, guesses: randomFive.guesses.map((player) => player.id), setIds: randomFive.sets.map((set) => set.map((club) => club.id)), finished: randomFive.round >= 5 }; }
function hydrateOnlineRandomFive(value) {
  const selected = new Set(online.state.settings.leagueIds || []), clubIds = new Set(clubs.filter((club) => !selected.size || selected.has(club.leagueId)).map((club) => club.id));
  randomFive = { ...value, online: true, mode: "online", names: online.state.players.map((player) => player.name), pool: players.filter((player) => player.clubIds.some((id) => clubIds.has(id))), sets: value.setIds.map((set) => set.map((id) => clubMap.get(+id))), guesses: value.guesses.map((id) => indexes.playerById.get(+id)).filter(Boolean), used: [new Set(), new Set()] };
}
$("#randomFiveInput").oninput = (event) => {
  const q = norm(event.target.value), ids = randomFive.sets?.[randomFive.round]?.map((club) => club.id) || [];
  if (q.length < 2) return ($("#randomFiveSuggestions").innerHTML = "");
  const hits = (randomFive.pool || []).filter((player) => IkiFormaCore.randomFiveScore(player, ids) > 0 && norm(player.name).includes(q)).slice(0, 10);
  $("#randomFiveSuggestions").innerHTML = hits.map((player) => `<button class="player-suggestion" data-random-five-player="${player.id}">${person(player)}<span><b>${esc(player.name)}</b><small>${esc(player.nationality || "")}</small></span></button>`).join("") || "<button disabled>Eşleşen geçerli futbolcu yok</button>";
  $$('[data-random-five-player]').forEach((button) => button.onclick = () => submitRandomFiveGuess(indexes.playerById.get(+button.dataset.randomFivePlayer)));
};
$("#randomFiveInput").onkeydown = (event) => { if (event.key === "Enter") { const ids = randomFive.sets?.[randomFive.round]?.map((club) => club.id) || [], player = (randomFive.pool || []).find((item) => norm(item.name) === norm(event.target.value) && IkiFormaCore.randomFiveScore(item, ids) > 0); if (player) submitRandomFiveGuess(player); else toast("Gösterilen kulüplerden en az birinde oynamış bir futbolcu seç."); } };
$("#randomFiveNext").onclick = nextRandomFiveRound;
$("#startRandomFive").onclick = startRandomFiveGame;
$$('input[name="randomFiveMode"]').forEach((radio) => radio.onchange = () => { const duo = $('input[name="randomFiveMode"]:checked').value === "duo"; $("#randomFiveDifficultyWrap").hidden = duo; $("#randomFiveNameTwoWrap").hidden = !duo; });
function startTwinGame() {
  const mode = $('input[name="twinMode"]:checked').value,
    pool = twinPool(),
    targets = pool.filter((p) => p.appearances >= 200 && p.goals >= 15);
  if (targets.length < 2) return toast("Yeterli doğrulanmış kariyer bulunamadı.");
  twin = {
    mode,
    answerMethod: $("#twinAnswerMethod").value,
    difficulty: $("#twinDifficulty").value,
    names: [$("#twinNameOne").value.trim() || "Oyuncu 1", mode === "duo" ? $("#twinNameTwo").value.trim() || "Oyuncu 2" : "Bilgisayar"],
    scores: [0, 0],
    round: 0,
    rounds: +$("#twinRounds").value,
    metric: 0,
    guesses: [],
    used: [new Set(), new Set()],
    pool,
    targets: [...targets].sort(() => Math.random() - 0.5).slice(0, +$("#twinRounds").value),
  };
  if (mode === "online") {
    const initialState = { difficulty: twin.difficulty, answerMethod: twin.answerMethod, scores: [0, 0], round: 0, rounds: twin.rounds, metric: 0, guesses: [], targetIds: twin.targets.map((player) => player.id) };
    return openSpecialOnlineLobby({ gameType: "twin", difficulty: twin.difficulty, answerMethod: twin.answerMethod, rounds: twin.rounds, leagueIds: [...selectedLeagueContext($("#twinSetup")).selected], initialState });
  }
  show("twinGame");
  beginTwinRound();
}
function beginTwinRound() {
  twin.metric = 0;
  twin.guesses = [];
  twin.used = [new Set(), new Set()];
  renderTwinTurn();
}
function renderTwinTurn() {
  const target = twin.targets[twin.round], metric = IkiFormaCore.TWIN_METRICS[twin.metric];
  $("#twinRound").textContent = `Futbolcu ${twin.round + 1}/${twin.rounds}`;
  $("#twinScore").innerHTML = `<b>${esc(twin.names[0])} ${twin.scores[0]}</b><span>—</span><b>${twin.scores[1]} ${esc(twin.names[1])}</b>`;
  $("#twinTarget").innerHTML = `${person(target)}<div><span class="kicker">HEDEF FUTBOLCU</span><h2>${esc(target.name)}</h2><p>${esc(target.nationality || "")}</p></div><div class="twin-metrics">${IkiFormaCore.TWIN_METRICS.map((m, i) => `<div class="${i === twin.metric ? "active" : ""}"><small>${esc(m.label)}</small><b>${Number(target[m.key]).toLocaleString("tr-TR")}</b></div>`).join("")}</div>`;
  $("#twinMetricStep").textContent = `METRİK ${twin.metric + 1}/4`;
  $("#twinPrompt").textContent = `${metric.label} değerine en yakın futbolcu kim?`;
  $("#twinTurn").textContent = `${twin.names[0]} tahminini girsin.`;
  if (twin.online) $("#twinTurn").textContent = `${twin.names[online.state.currentTurn]} tahminini girsin.`;
  $("#twinInput").value = "";
  $("#twinInput").disabled = false;
  $("#twinInput").hidden = twin.answerMethod === "multiple";
  $("#twinGame .twin-answer").hidden = false;
  $("#twinInput").focus();
  $("#twinSuggestions").innerHTML = "";
  $("#twinSuggestions").classList.toggle("inline-choices", twin.answerMethod === "multiple");
  if (twin.answerMethod === "multiple") {
    twin.choiceEntries = IkiFormaCore.generateTwinOptions({ target, pool: twin.pool, metric: metric.key });
    if (!twin.choiceEntries) return toast("Bu metrik için dengeli seçenek üretilemedi.");
    renderPlayerChoices($("#twinSuggestions"), twin.choiceEntries.map((entry) => entry.player), submitTwinGuess);
  }
  $("#twinMessage").textContent = "";
  $("#twinReveal").hidden = true;
  $("#twinNext").hidden = true;
}
async function submitTwinGuess(player) {
  if (!player || player.id === twin.targets[twin.round].id) return toast("Hedef futbolcu tahmin edilemez.");
  if (twin.online && online.state.currentTurn !== online.playerIndex) return toast("Sıra rakibinizde.");
  twin.guesses.push(player);
  $("#twinInput").value = "";
  $("#twinSuggestions").innerHTML = "";
  if (twin.mode === "duo" && twin.guesses.length === 1) {
    $("#twinTurn").textContent = `${twin.names[1]} tahminini girsin. İlk tahmin gizlendi.`;
    if (twin.answerMethod === "multiple")
      renderPlayerChoices($("#twinSuggestions"), twin.choiceEntries.map((entry) => entry.player), submitTwinGuess);
    $("#twinInput").focus();
    return;
  }
  if (twin.online && twin.guesses.length === 1) {
    await syncSpecialState("twin", serializeOnlineTwin(), 1, twin.scores);
    return handleOnlineSpecialState();
  }
  if (twin.mode === "computer" && twin.guesses.length === 1) {
    const guess = twin.answerMethod === "multiple"
      ? IkiFormaCore.chooseTwinComputerOption({ options: twin.choiceEntries, difficulty: twin.difficulty })
      : IkiFormaCore.chooseTwinComputerGuess({ target: twin.targets[twin.round], pool: twin.pool, metric: IkiFormaCore.TWIN_METRICS[twin.metric].key, difficulty: twin.difficulty });
    if (guess) twin.guesses.push(guess.player);
  }
  revealTwinMetric();
  if (twin.online) await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores);
}
function revealTwinMetric() {
  const target = twin.targets[twin.round], metric = IkiFormaCore.TWIN_METRICS[twin.metric], result = IkiFormaCore.scoreTwinGuesses(target, metric.key, twin.guesses[0], twin.guesses[1]);
  if (result.winner === null) twin.scores = twin.scores.map((x) => x + 1);
  else twin.scores[result.winner]++;
  $("#twinInput").disabled = true;
  $("#twinTurn").textContent = result.winner === null ? "Eşit yakınlık: iki taraf da puan aldı." : `${twin.names[result.winner]} bu metriği kazandı!`;
  $("#twinReveal").innerHTML = twin.guesses.map((p, i) => `<article class="${result.winner === null || result.winner === i ? "winner" : ""}">${person(p)}<div><small>${esc(twin.names[i])}</small><b>${esc(p.name)}</b><span>${Number(p[metric.key]).toLocaleString("tr-TR")} · fark ${result.distances[i].toLocaleString("tr-TR")}</span></div></article>`).join("");
  $("#twinReveal").hidden = false;
  $("#twinNext").textContent = twin.metric === 3 ? (twin.round + 1 === twin.rounds ? "Sonucu gör →" : "Sonraki futbolcu →") : "Sonraki metrik →";
  $("#twinNext").hidden = false;
  $("#twinScore").innerHTML = `<b>${esc(twin.names[0])} ${twin.scores[0]}</b><span>—</span><b>${twin.scores[1]} ${esc(twin.names[1])}</b>`;
}
async function nextTwinStep() {
  if (twin.online && online.playerIndex !== 0) return toast("Sonraki adımı oda sahibi açar.");
  if (twin.metric < 3) { twin.metric++; twin.guesses = []; if (twin.online) await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores); return renderTwinTurn(); }
  twin.round++;
  if (twin.round < twin.rounds) { beginTwinRound(); if (twin.online) await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores); return; }
  const winner = twin.scores[0] === twin.scores[1] ? "Berabere!" : `${twin.names[twin.scores[0] > twin.scores[1] ? 0 : 1]} kazandı!`;
  $("#twinTarget").innerHTML = "";
  $("#twinMetricStep").textContent = "OYUN TAMAMLANDI";
  $("#twinPrompt").textContent = `🏆 ${winner}`;
  $("#twinTurn").textContent = `${twin.names[0]}: ${twin.scores[0]} · ${twin.names[1]}: ${twin.scores[1]}`;
  $("#twinGame .twin-answer").hidden = true;
  $("#twinReveal").innerHTML = '<button class="cta" data-view="twinSetup">Yeniden oyna</button>';
  $("#twinReveal").hidden = false;
  $("#twinNext").hidden = true;
  if (twin.online) await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores);
}
function renderTwinSnapshotReveal() {
  const target = twin.targets[twin.round], metric = IkiFormaCore.TWIN_METRICS[twin.metric], result = IkiFormaCore.scoreTwinGuesses(target, metric.key, twin.guesses[0], twin.guesses[1]);
  $("#twinReveal").innerHTML = twin.guesses.map((player, index) => `<article class="${result.winner === null || result.winner === index ? "winner" : ""}">${person(player)}<div><small>${esc(twin.names[index])}</small><b>${esc(player.name)}</b><span>${Number(player[metric.key]).toLocaleString("tr-TR")} · fark ${result.distances[index].toLocaleString("tr-TR")}</span></div></article>`).join("");
  $("#twinReveal").hidden = false; $("#twinNext").hidden = online.playerIndex !== 0; $("#twinInput").disabled = true;
}
function serializeOnlineTwin() { return { difficulty: twin.difficulty, answerMethod: twin.answerMethod, scores: twin.scores, round: twin.round, rounds: twin.rounds, metric: twin.metric, guesses: twin.guesses.map((player) => player.id), targetIds: twin.targets.map((player) => player.id), finished: twin.round >= twin.rounds }; }
function hydrateOnlineTwin(value) {
  const selected = new Set(online.state.settings.leagueIds || []), clubIds = new Set(clubs.filter((club) => !selected.size || selected.has(club.leagueId)).map((club) => club.id));
  const pool = players.filter((player) => player.statisticsComplete && player.appearances >= 50 && player.clubIds.some((id) => clubIds.has(id)) && IkiFormaCore.TWIN_METRICS.every((metric) => Number.isFinite(Number(player[metric.key]))));
  twin = { ...value, online: true, mode: "online", names: online.state.players.map((player) => player.name), pool, targets: value.targetIds.map((id) => indexes.playerById.get(+id)), guesses: value.guesses.map((id) => indexes.playerById.get(+id)).filter(Boolean), used: [new Set(), new Set()] };
}
$("#twinInput").oninput = (event) => {
  const q = norm(event.target.value);
  if (q.length < 2) return ($("#twinSuggestions").innerHTML = "");
  const hits = (twin.pool || []).filter((p) => p.id !== twin.targets?.[twin.round]?.id && norm(p.name).includes(q)).slice(0, 10);
  $("#twinSuggestions").innerHTML = hits.map((p) => `<button class="player-suggestion" data-twin-player="${p.id}">${person(p)}<span><b>${esc(p.name)}</b><small>${esc(p.nationality || "")}</small></span></button>`).join("") || "<button disabled>Eşleşen futbolcu yok</button>";
  $$('[data-twin-player]').forEach((button) => button.onclick = () => submitTwinGuess(indexes.playerById.get(+button.dataset.twinPlayer)));
};
$("#twinInput").onkeydown = (event) => { if (event.key === "Enter") { const p = (twin.pool || []).find((x) => norm(x.name) === norm(event.target.value)); if (p) submitTwinGuess(p); } };
$("#twinNext").onclick = nextTwinStep;
$("#startTwin").onclick = startTwinGame;
$$('input[name="twinMode"]').forEach((radio) => radio.onchange = () => { const duo = $('input[name="twinMode"]:checked').value === "duo"; $("#twinDifficultyWrap").hidden = duo; $("#twinNameTwoWrap").hidden = !duo; });
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
    enhanceLeagueSelector($("#twinSetup"));
    enhanceLeagueSelector($("#randomFiveSetup"));
    organizeHomeMenu();
    if (await restoreOnlineSession()) return;
    const requested = location.hash.slice(1);
    history.replaceState({ view: "home" }, "", "#home");
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
