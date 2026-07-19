"use strict";

(() => {
  const STYLE_ID = "fc26-enhancements-style";
  const PAGE_SIZE = 24;
  let fcCatalogPage = 1;
  let fcPlayers = [];

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const norm = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .toLowerCase()
      .trim();

  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const stat = (player, ...keys) => {
    for (const key of keys) {
      const value = player?.[key];
      if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
        return Number(value);
      }
    }
    return 0;
  };

  function waitForData() {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        try {
          if (typeof FC26_DATA !== "undefined" && Array.isArray(FC26_DATA?.players) && FC26_DATA.players.length) {
            clearInterval(timer);
            resolve(FC26_DATA.players);
            return;
          }
        } catch {}
        if (Date.now() - started > 20000) {
          clearInterval(timer);
          resolve([]);
        }
      }, 100);
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Tüm futbolcu portrelerini kare kutuya sığdır: görüntüyü kırpmadan, oranını koruyarak. */
      .rating-card-image,
      .mystery-photo,
      #catalogList .player-list-photo,
      #catalogList .player-avatar,
      #catalogList img,
      #travelerList img,
      #compareList img,
      .player-suggestion > img,
      .choice-option > img,
      .trump-player > img,
      .xi-slot img,
      #xiCandidates img,
      .fc26-card-photo {
        aspect-ratio: 1 / 1 !important;
        overflow: hidden !important;
      }

      .rating-card-image img,
      .mystery-photo img,
      #catalogList img,
      #travelerList img,
      #compareList img,
      .player-suggestion > img,
      .choice-option > img,
      .trump-player > img,
      .xi-slot img,
      #xiCandidates img,
      .fc26-card-photo img {
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        object-fit: contain !important;
        object-position: center bottom !important;
      }

      .rating-card-image,
      .mystery-photo,
      .fc26-card-photo {
        background: linear-gradient(145deg, #173a58, #071525 74%);
      }

      /* Gizli futbolcunun ligi hedefin üstünde görünmez; artık tahmin ipucudur. */
      #mysteryLeague {
        display: none !important;
      }

      .mystery-head.mystery-head-with-league,
      .mystery-row.mystery-row-with-league {
        grid-template-columns: minmax(120px, 1.4fr) repeat(6, minmax(72px, 1fr)) !important;
      }

      @media (max-width: 760px) {
        .mystery-head.mystery-head-with-league,
        .mystery-row.mystery-row-with-league {
          grid-template-columns: minmax(108px, 1.4fr) repeat(6, minmax(62px, 1fr)) !important;
        }
      }

      /* FC 26 veri kataloğu */
      #fcCatalog {
        padding-bottom: 48px;
      }

      .fc26-catalog-toolbar {
        display: grid;
        grid-template-columns: minmax(220px, 1.5fr) repeat(4, minmax(150px, 1fr));
        gap: 10px;
        margin-bottom: 12px;
      }

      .fc26-stat-filters {
        display: grid;
        grid-template-columns: repeat(7, minmax(92px, 1fr));
        gap: 8px;
        margin-bottom: 18px;
      }

      .fc26-catalog-toolbar input,
      .fc26-catalog-toolbar select,
      .fc26-stat-filters input,
      .fc26-stat-filters select {
        width: 100%;
      }

      .fc26-catalog-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 16px;
      }

      .fc26-player-card {
        position: relative;
        min-width: 0;
        border: 1px solid #294b67;
        border-radius: 20px;
        padding: 14px;
        background:
          radial-gradient(circle at 50% 18%, rgba(79, 218, 174, .12), transparent 36%),
          linear-gradient(155deg, #173a58, #0b2136 52%, #071525);
        box-shadow: 0 14px 35px rgba(0, 0, 0, .18);
      }

      .fc26-card-top {
        display: grid;
        grid-template-columns: 66px 1fr;
        gap: 12px;
        align-items: start;
      }

      .fc26-overall {
        display: grid;
        place-items: center;
        min-height: 72px;
        border-radius: 14px;
        background: rgba(73, 229, 165, .12);
        border: 1px solid rgba(73, 229, 165, .35);
      }

      .fc26-overall strong {
        display: block;
        font-size: 30px;
        line-height: 1;
      }

      .fc26-overall small {
        color: var(--muted, #8fb1ca);
        font-size: 11px;
      }

      .fc26-card-photo {
        width: 100%;
        border-radius: 14px;
        border: 1px solid #315775;
        display: grid;
        place-items: center;
      }

      .fc26-card-photo .avatar {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        font-size: 32px;
        font-weight: 800;
      }

      .fc26-player-card h3 {
        margin: 12px 0 3px;
        font-size: 18px;
      }

      .fc26-player-card .fc26-meta {
        color: var(--muted, #8fb1ca);
        font-size: 12px;
        min-height: 34px;
      }

      .fc26-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 7px;
        margin-top: 12px;
      }

      .fc26-stats span {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        padding: 7px 8px;
        border-radius: 10px;
        background: rgba(4, 20, 35, .58);
        border: 1px solid #294b67;
        font-size: 12px;
      }

      .fc26-stats b {
        font-size: 14px;
      }

      .fc26-catalog-empty {
        grid-column: 1 / -1;
        padding: 36px;
        text-align: center;
      }

      .fc26-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        margin-top: 22px;
      }

      @media (max-width: 1050px) {
        .fc26-catalog-toolbar {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .fc26-stat-filters {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      @media (max-width: 620px) {
        .fc26-catalog-toolbar {
          grid-template-columns: 1fr;
        }
        .fc26-stat-filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .fc26-catalog-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .fc26-player-card {
          padding: 8px;
          border-radius: 14px;
        }
        .fc26-card-top {
          grid-template-columns: 48px 1fr;
          gap: 7px;
        }
        .fc26-overall {
          min-height: 54px;
        }
        .fc26-overall strong {
          font-size: 22px;
        }
        .fc26-player-card h3 {
          font-size: 14px;
        }
        .fc26-player-card .fc26-meta {
          font-size: 10px;
        }
        .fc26-stats {
          grid-template-columns: repeat(2, 1fr);
          gap: 4px;
        }
        .fc26-stats span {
          padding: 5px;
          font-size: 10px;
        }
        .fc26-stats b {
          font-size: 11px;
        }
      }
    `;
    document.head.append(style);
  }

  function patchMysteryUI() {
    const leagueLabel = document.getElementById("mysteryLeague");
    const history = document.getElementById("mysteryHistory");
    const head = document.querySelector(".mystery-head");
    if (!leagueLabel || !history || !head) return;

    const setupDescription = document.querySelector("#mysterySetup .mystery-setup > p");
    if (setupDescription) {
      setupDescription.textContent =
        "Bulanık fotoğraftaki futbolcuyu milliyet, takım, lig, mevki, yaş ve overall ipuçlarıyla bul.";
    }

    if (!head.dataset.leaguePatched) {
      const spans = [...head.children];
      const teamHeader = spans.find((item) => norm(item.textContent) === "takim");
      const leagueHeader = document.createElement("span");
      leagueHeader.textContent = "Lig";
      if (teamHeader?.nextSibling) head.insertBefore(leagueHeader, teamHeader.nextSibling);
      else head.append(leagueHeader);
      head.dataset.leaguePatched = "1";
      head.classList.add("mystery-head-with-league");
    }

    const patchRow = (row) => {
      if (!row || row.dataset.leaguePatched) return;
      const children = [...row.children];
      const name = children[0]?.textContent?.trim() || "";
      const team = children[2]?.querySelector("small")?.textContent?.trim() || "";
      const candidates = fcPlayers.filter((player) => norm(player.name) === norm(name));
      const guessed =
        candidates.find((player) => norm(player.team) === norm(team)) ||
        candidates[0];
      const targetLeague = leagueLabel.textContent.trim();

      const clue = document.createElement("span");
      const exact = Boolean(guessed?.league && targetLeague && guessed.league === targetLeague);
      clue.className = `mystery-clue ${exact ? "exact" : "wrong"}`;
      clue.title = guessed?.league || "Lig bilgisi yok";
      clue.innerHTML = `<small>${esc(guessed?.league || "Bilinmiyor")}</small><strong>${exact ? "✓" : "✕"}</strong>`;

      const teamCell = children[2];
      if (teamCell?.nextSibling) row.insertBefore(clue, teamCell.nextSibling);
      else row.append(clue);
      row.dataset.leaguePatched = "1";
      row.classList.add("mystery-row-with-league");
    };

    history.querySelectorAll(".mystery-row").forEach(patchRow);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.matches?.(".mystery-row")) patchRow(node);
          node.querySelectorAll?.(".mystery-row").forEach(patchRow);
        });
      }
    });
    observer.observe(history, { childList: true, subtree: true });
  }

  function addFcCatalogHomeCard() {
    const grid = document.querySelector("#home .mode-grid");
    if (!grid || grid.querySelector('[data-view="fcCatalog"]')) return;
    const card = document.createElement("button");
    card.className = "mode-card fc26-database-card";
    card.dataset.view = "fcCatalog";
    card.innerHTML =
      '<span class="icon">🎮</span><span><b>FC 26 Futbolcu Kartları</b><small>EA SPORTS FC 26 reytinglerini, ana özellikleri ve filtreleri incele.</small></span><i>Keşfet →</i>';

    const compareCard = grid.querySelector('[data-view="compare"]');
    if (compareCard) grid.insertBefore(card, compareCard);
    else grid.append(card);
  }

  function createOption(value, label = value) {
    return `<option value="${esc(value)}">${esc(label)}</option>`;
  }

  function buildFcCatalogSection() {
    if (document.getElementById("fcCatalog")) return;
    const main = document.querySelector("main");
    if (!main) return;

    const section = document.createElement("section");
    section.id = "fcCatalog";
    section.className = "view";
    section.innerHTML = `
      <div class="section-head">
        <div>
          <span class="kicker">EA SPORTS FC 26 VERİ KATALOĞU</span>
          <h2>FC 26 Futbolcu Kartları</h2>
          <p>Overall ve ana FC 26 özelliklerini özel kart görünümünde ara, filtrele ve sırala.</p>
        </div>
        <b id="fc26CatalogCount" class="counter"></b>
      </div>
      <div class="fc26-catalog-toolbar">
        <input id="fc26Search" type="search" placeholder="Futbolcu ara…" aria-label="FC 26 futbolcusu ara">
        <select id="fc26League"><option value="">Tüm ligler</option></select>
        <select id="fc26Team"><option value="">Tüm takımlar</option></select>
        <select id="fc26Nation"><option value="">Tüm ülkeler</option></select>
        <select id="fc26Position"><option value="">Tüm mevkiler</option></select>
      </div>
      <div class="fc26-stat-filters">
        <select id="fc26Sort">
          <option value="overall">OVR yüksekten düşüğe</option>
          <option value="pace">PAC yüksekten düşüğe</option>
          <option value="shooting">SHO yüksekten düşüğe</option>
          <option value="passing">PAS yüksekten düşüğe</option>
          <option value="dribbling">DRI yüksekten düşüğe</option>
          <option value="defending">DEF yüksekten düşüğe</option>
          <option value="physical">PHY yüksekten düşüğe</option>
          <option value="name">İsme göre</option>
        </select>
        <input id="fc26MinOvr" type="number" min="0" max="99" placeholder="Min OVR" aria-label="Minimum overall">
        <input id="fc26MinPac" type="number" min="0" max="99" placeholder="Min PAC" aria-label="Minimum pace">
        <input id="fc26MinSho" type="number" min="0" max="99" placeholder="Min SHO" aria-label="Minimum shooting">
        <input id="fc26MinPas" type="number" min="0" max="99" placeholder="Min PAS" aria-label="Minimum passing">
        <input id="fc26MinDri" type="number" min="0" max="99" placeholder="Min DRI" aria-label="Minimum dribbling">
        <input id="fc26MinDef" type="number" min="0" max="99" placeholder="Min DEF" aria-label="Minimum defending">
        <input id="fc26MinPhy" type="number" min="0" max="99" placeholder="Min PHY" aria-label="Minimum physical">
      </div>
      <div id="fc26CatalogGrid" class="fc26-catalog-grid"></div>
      <div class="fc26-pager">
        <button id="fc26Prev" type="button" class="secondary">← Önceki</button>
        <span id="fc26Page"></span>
        <button id="fc26Next" type="button" class="secondary">Sonraki →</button>
      </div>
    `;
    main.append(section);

    const unique = (key) =>
      [...new Set(fcPlayers.map((player) => player?.[key]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), "tr"));

    document.getElementById("fc26League").insertAdjacentHTML(
      "beforeend",
      unique("league").map((value) => createOption(value)).join("")
    );
    document.getElementById("fc26Team").insertAdjacentHTML(
      "beforeend",
      unique("team").map((value) => createOption(value)).join("")
    );
    document.getElementById("fc26Nation").insertAdjacentHTML(
      "beforeend",
      unique("nation").map((value) => createOption(value)).join("")
    );
    document.getElementById("fc26Position").insertAdjacentHTML(
      "beforeend",
      unique("position").map((value) => createOption(value)).join("")
    );

    [
      "fc26Search", "fc26League", "fc26Team", "fc26Nation", "fc26Position",
      "fc26Sort", "fc26MinOvr", "fc26MinPac", "fc26MinSho", "fc26MinPas",
      "fc26MinDri", "fc26MinDef", "fc26MinPhy",
    ].forEach((id) => {
      const element = document.getElementById(id);
      const eventName = element.tagName === "INPUT" ? "input" : "change";
      element.addEventListener(eventName, () => {
        fcCatalogPage = 1;
        renderFcCatalog();
      });
    });

    document.getElementById("fc26Prev").onclick = () => {
      if (fcCatalogPage > 1) {
        fcCatalogPage--;
        renderFcCatalog();
        scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    document.getElementById("fc26Next").onclick = () => {
      fcCatalogPage++;
      renderFcCatalog();
      scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase();
  }

  function playerStats(player) {
    return {
      overall: stat(player, "overall", "ovr"),
      pace: stat(player, "pace", "pac"),
      shooting: stat(player, "shooting", "sho"),
      passing: stat(player, "passing", "pas"),
      dribbling: stat(player, "dribbling", "dri"),
      defending: stat(player, "defending", "def"),
      physical: stat(player, "physical", "phy", "physicality"),
    };
  }

  function filteredFcPlayers() {
    const query = norm(document.getElementById("fc26Search")?.value);
    const league = document.getElementById("fc26League")?.value || "";
    const team = document.getElementById("fc26Team")?.value || "";
    const nation = document.getElementById("fc26Nation")?.value || "";
    const position = document.getElementById("fc26Position")?.value || "";
    const minimums = {
      overall: num(document.getElementById("fc26MinOvr")?.value),
      pace: num(document.getElementById("fc26MinPac")?.value),
      shooting: num(document.getElementById("fc26MinSho")?.value),
      passing: num(document.getElementById("fc26MinPas")?.value),
      dribbling: num(document.getElementById("fc26MinDri")?.value),
      defending: num(document.getElementById("fc26MinDef")?.value),
      physical: num(document.getElementById("fc26MinPhy")?.value),
    };

    return fcPlayers.filter((player) => {
      const stats = playerStats(player);
      if (query && !norm(`${player.name} ${player.team} ${player.nation} ${player.league}`).includes(query)) return false;
      if (league && player.league !== league) return false;
      if (team && player.team !== team) return false;
      if (nation && player.nation !== nation) return false;
      if (position && player.position !== position && !(player.alternativePositions || []).includes(position)) return false;
      return Object.entries(minimums).every(([key, min]) => stats[key] >= min);
    });
  }

  function renderFcCatalog() {
    const grid = document.getElementById("fc26CatalogGrid");
    if (!grid) return;

    const sortKey = document.getElementById("fc26Sort")?.value || "overall";
    const filtered = filteredFcPlayers().sort((a, b) => {
      if (sortKey === "name") return String(a.name).localeCompare(String(b.name), "tr");
      return playerStats(b)[sortKey] - playerStats(a)[sortKey] ||
        playerStats(b).overall - playerStats(a).overall ||
        String(a.name).localeCompare(String(b.name), "tr");
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    fcCatalogPage = Math.min(fcCatalogPage, totalPages);
    const start = (fcCatalogPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    document.getElementById("fc26CatalogCount").textContent =
      `${filtered.length.toLocaleString("tr-TR")} futbolcu`;
    document.getElementById("fc26Page").textContent =
      `${fcCatalogPage} / ${totalPages}`;
    document.getElementById("fc26Prev").disabled = fcCatalogPage <= 1;
    document.getElementById("fc26Next").disabled = fcCatalogPage >= totalPages;

    if (!page.length) {
      grid.innerHTML =
        '<div class="surface fc26-catalog-empty"><h3>Sonuç bulunamadı</h3><p>Filtreleri gevşeterek tekrar deneyin.</p></div>';
      return;
    }

    grid.innerHTML = page.map((player) => {
      const stats = playerStats(player);
      const positions = [player.position, ...(player.alternativePositions || [])].filter(Boolean).join(" / ");
      return `
        <article class="fc26-player-card">
          <div class="fc26-card-top">
            <div class="fc26-overall"><strong>${stats.overall || "—"}</strong><small>OVR</small></div>
            <div class="fc26-card-photo">
              ${player.photoUrl
                ? `<img src="${esc(player.photoUrl)}" alt="${esc(player.name)} fotoğrafı" loading="lazy">`
                : `<span class="avatar">${esc(initials(player.name))}</span>`}
            </div>
          </div>
          <h3>${esc(player.name)}</h3>
          <div class="fc26-meta">${esc(player.nation || "Milliyet bilinmiyor")} · ${esc(positions || "Mevki bilinmiyor")}<br>${esc(player.team || "Takım bilinmiyor")} · ${esc(player.league || "Lig bilinmiyor")}</div>
          <div class="fc26-stats">
            <span>PAC <b>${stats.pace || "—"}</b></span>
            <span>SHO <b>${stats.shooting || "—"}</b></span>
            <span>PAS <b>${stats.passing || "—"}</b></span>
            <span>DRI <b>${stats.dribbling || "—"}</b></span>
            <span>DEF <b>${stats.defending || "—"}</b></span>
            <span>PHY <b>${stats.physical || "—"}</b></span>
          </div>
        </article>
      `;
    }).join("");
  }

  function patchDynamicNavigation() {
    document.addEventListener("click", (event) => {
      if (event.target.closest('[data-view="fcCatalog"]')) {
        queueMicrotask(renderFcCatalog);
      }
    });
  }

  async function init() {
    injectStyles();
    fcPlayers = await waitForData();
    if (!fcPlayers.length) {
      console.warn("[FC26 enhancements] FC26_DATA yüklenemedi; FC kataloğu devre dışı.");
      return;
    }
    patchMysteryUI();
    addFcCatalogHomeCard();
    buildFcCatalogSection();
    patchDynamicNavigation();
    renderFcCatalog();
  }

  init().catch((error) => {
    console.error("[FC26 enhancements]", error);
  });
})();
