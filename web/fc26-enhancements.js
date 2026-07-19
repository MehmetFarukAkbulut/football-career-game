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
    if (leagueLabel) {
      leagueLabel.hidden = true;
      leagueLabel.style.display = "none";
      leagueLabel.setAttribute("aria-hidden", "true");
    }
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
          <p>Overall ve ana FC 26 özelliklerini kart görünümünde ara ve filtrele. En yüksek overall otomatik olarak önce gösterilir.</p>
        </div>
        <b id="fc26CatalogCount" class="counter"></b>
      </div>
      <div class="fc26-catalog-toolbar">
        <input id="fc26Search" type="search" placeholder="Futbolcu ara…" aria-label="FC 26 futbolcusu ara">
        <select id="fc26League"><option value="">Tüm ligler</option></select>
        <select id="fc26Team"><option value="">Tüm takımlar</option></select>
        <select id="fc26Nation"><option value="">Tüm ülkeler</option></select>
        <select id="fc26Position"><option value="">Tüm mevkiler</option></select>
        <select id="fc26Gender"><option value="">Tüm cinsiyetler</option><option value="M">Erkek</option><option value="F">Kadın</option></select>
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
      "fc26Search", "fc26League", "fc26Team", "fc26Nation", "fc26Position", "fc26Gender",
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
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
    const gender = document.getElementById("fc26Gender")?.value || "";

    return fcPlayers
      .filter((player) => {
        if (
          query &&
          !norm(
            `${player.name} ${player.team} ${player.nation} ${player.league}`
          ).includes(query)
        ) {
          return false;
        }

        if (league && player.league !== league) return false;
        if (team && player.team !== team) return false;
        if (nation && player.nation !== nation) return false;

        if (
          position &&
          player.position !== position &&
          !(player.alternativePositions || []).includes(position)
        ) {
          return false;
        }

        if (gender && player.gender !== gender) return false;

        return true;
      })
      .sort(
        (a, b) =>
          Number(b.overall || 0) - Number(a.overall || 0) ||
          String(a.name).localeCompare(String(b.name), "tr")
      );
  }
  function renderFcCatalog() {
    const grid = document.getElementById("fc26CatalogGrid");
    if (!grid) return;

    const filtered = filteredFcPlayers();

    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / PAGE_SIZE)
    );

    fcCatalogPage = Math.min(
      fcCatalogPage,
      totalPages
    );

    const start =
      (fcCatalogPage - 1) * PAGE_SIZE;

    const page =
      filtered.slice(
        start,
        start + PAGE_SIZE
      );

    const count =
      document.getElementById("fc26CatalogCount");

    const pageLabel =
      document.getElementById("fc26Page");

    const previous =
      document.getElementById("fc26Prev");

    const next =
      document.getElementById("fc26Next");

    if (count) {
      count.textContent =
        `${filtered.length.toLocaleString("tr-TR")} futbolcu`;
    }

    if (pageLabel) {
      pageLabel.textContent =
        `${fcCatalogPage} / ${totalPages}`;
    }

    if (previous) {
      previous.disabled =
        fcCatalogPage <= 1;
    }

    if (next) {
      next.disabled =
        fcCatalogPage >= totalPages;
    }

    if (!page.length) {

      grid.innerHTML = `
        <div class="surface fc26-catalog-empty">
          <h3>Sonuç bulunamadı</h3>
          <p>Filtreleri deÄŸiÅŸtirerek tekrar deneyin.</p>
        </div>
      `;

      return;
    }

    grid.innerHTML =
      page
        .map((player) => {

          const positions =
            [
              player.position,
              ...(player.alternativePositions || [])
            ]
              .filter(Boolean)
              .join(" / ");

          const card =
            player.cardUrl
              ? `
                <img
                  src="${esc(player.cardUrl)}"
                  alt="${esc(player.name)} FC 26 kartı"
                  loading="lazy"
                >
              `
              : `
                <div class="fc26-card-missing">
                  <strong>${esc(player.name)}</strong>
                  <span>FC 26 kart görseli bulunamadı</span>
                </div>
              `;

          return `
            <article class="fc26-player-card">

              <div class="fc26-real-card">
                ${card}
              </div>

              <div class="fc26-card-info">

                <h3>
                  ${esc(player.name)}
                </h3>

                <p>
                  ${esc(player.nation || "Ãœlke bilinmiyor")}
                  ·
                  ${esc(positions || "Mevki bilinmiyor")}
                </p>

                <small>
                  ${esc(player.team || "Takım bilinmiyor")}
                  ·
                  ${esc(player.league || "Lig bilinmiyor")}
                </small>

              </div>

            </article>
          `;

        })
        .join("");
  }
  function patchDynamicNavigation() {
    document.addEventListener("click", (event) => {
      if (event.target.closest('[data-view="fcCatalog"]')) {
        queueMicrotask(renderFcCatalog);
      }
    });
  }

  async function init() {
    // CSS harici dosyadan yukleniyor; CSP nedeniyle injectStyles kullanilmiyor.
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


// ============================================================
// FINAL FC26 CATALOG UI PATCH
// ============================================================

(() => {

  "use strict";


  // ----------------------------------------------------------
  // METIN BOZULMALARINI TEMIZLE
  // ----------------------------------------------------------

  function cleanMojibake(value) {

    return String(value || "")
      .replace(/\u00C2\u00B7/g, "\u00B7")
      .replace(/\u00C3\u201A\u00C2\u00B7/g, "\u00B7")
      .replace(/\u00C2/g, "")
      .replace(/\u00E2\u20AC\u00A6/g, "\u2026")
      .replace(/\u00E2\u2020\u2019/g, "\u2192")
      .replace(/\u00E2\u2020\u0090/g, "\u2190")
      .replace(/\u00C3\u00A2\u00C2\u20AC\u00C2\u00A6/g, "\u2026");

  }


  function cleanCatalogText() {

    const catalog =
      document.getElementById(
        "fcCatalog"
      );

    if (!catalog) {
      return;
    }


    const walker =
      document.createTreeWalker(
        catalog,
        NodeFilter.SHOW_TEXT
      );


    const nodes = [];

    while (
      walker.nextNode()
    ) {
      nodes.push(
        walker.currentNode
      );
    }


    nodes.forEach(
      (node) => {

        const cleaned =
          cleanMojibake(
            node.nodeValue
          );

        if (
          cleaned !==
          node.nodeValue
        ) {

          node.nodeValue =
            cleaned;

        }

      }
    );

  }


  // ----------------------------------------------------------
  // ANA MENU
  // ----------------------------------------------------------

  function normalizeHomeMenu() {

    const root =
      document.querySelector(
        "#home .mode-grid"
      );

    if (!root) {
      return;
    }


    /*
      Gezgin Futbolcular tamamen kaldırılıyor.
    */

    [...root.children]
      .forEach(
        (card) => {

          const text =
            cleanMojibake(
              card.textContent
            )
              .replace(/\s+/g, " ")
              .trim();


          if (
            /Gezgin Futbolcu/i.test(text)
          ) {

            card.remove();

          }

        }
      );


    /*
      Ã–nceki clone yamalarının oluÅŸturduÄŸu
      sahte Futbolcu KataloÄŸu kartlarını kaldır.

      Gerçek katalog kartı data-view="catalog" taÅŸıyor.
    */

    [...root.children]
      .forEach(
        (card) => {

          const text =
            cleanMojibake(
              card.textContent
            )
              .replace(/\s+/g, " ")
              .trim();


          if (
            /Futbolcu KataloÄŸu/i.test(text) &&
            card.dataset.view !== "catalog" &&
            !card.hasAttribute(
              "data-real-fc26-catalog-card"
            )
          ) {

            card.remove();

          }

        }
      );


    /*
      Eski FC26 katalog kartı varsa yalnızca bir tane tut.
    */

    const oldFcCards =
      [...root.children]
        .filter(
          (card) => {

            const text =
              cleanMojibake(
                card.textContent
              );

            return (
              /FC 26 Futbolcu/i.test(text) ||
              card.hasAttribute(
                "data-fc26-catalog-menu"
              ) ||
              card.hasAttribute(
                "data-real-fc26-catalog-card"
              )
            );

          }
        );


    oldFcCards
      .slice(1)
      .forEach(
        (card) =>
          card.remove()
      );


    let fcCard =
      oldFcCards[0];


    /*
      Hiç yoksa clone kullanmadan sıfırdan oluÅŸtur.
    */

    if (!fcCard) {

      fcCard =
        document.createElement(
          "button"
        );

      fcCard.type =
        "button";

      fcCard.className =
        "mode-card fc26-catalog-home-card";

      fcCard.setAttribute(
        "data-real-fc26-catalog-card",
        "true"
      );

      fcCard.innerHTML = `
        <span class="icon">\uD83C\uDFAE</span>
        <span>
          <b>FC 26 Futbolcu Kartları</b>
          <small>
            EA SPORTS FC 26 kartlarını ara ve filtrele.
          </small>
        </span>
        <i>Göz at \u2192</i>
      `;

      root.appendChild(
        fcCard
      );

    }


    fcCard.setAttribute(
      "data-real-fc26-catalog-card",
      "true"
    );


    /*
      Eski clone attribute'larını temizle.
    */

    fcCard.removeAttribute(
      "data-fc26-catalog-menu"
    );

    fcCard.setAttribute("data-view", "fcCatalog");


    /*
      Listener çoÄŸalmasını engellemek için property kullan.
    */

    fcCard.onclick = null;

/*
      Araçlar son bölümde:
      Kulüp KarÅŸılaÅŸtır
      Futbolcu KataloÄŸu
      FC26 Katalog
    */

    const compare =
      root.querySelector(
        '[data-view="compare"]'
      );

    const catalog =
      root.querySelector(
        '[data-view="catalog"]'
      );


    if (compare) {
      root.appendChild(
        compare
      );
    }


    if (catalog) {
      root.appendChild(
        catalog
      );
    }


    root.appendChild(
      fcCard
    );

  }


  // ----------------------------------------------------------
  // LIG SIRALAMA
  // ----------------------------------------------------------

  function normLeague(value) {

    return String(value || "")
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .trim();

  }


  /*
    Bayraklar dosyaya gerçek emoji olarak yazılmıyor.
    Unicode escape kullanıldıÄŸı için encoding bozulamaz.
  */

  const FLAGS = {

    GB:
      "\uD83C\uDDEC\uD83C\uDDE7",

    ES:
      "\uD83C\uDDEA\uD83C\uDDF8",

    IT:
      "\uD83C\uDDEE\uD83C\uDDF9",

    DE:
      "\uD83C\uDDE9\uD83C\uDDEA",

    FR:
      "\uD83C\uDDEB\uD83C\uDDF7",

    TR:
      "\uD83C\uDDF9\uD83C\uDDF7",

    NL:
      "\uD83C\uDDF3\uD83C\uDDF1",

    PT:
      "\uD83C\uDDF5\uD83C\uDDF9",

    US:
      "\uD83C\uDDFA\uD83C\uDDF8",

    BE:
      "\uD83C\uDDE7\uD83C\uDDEA",

    SA:
      "\uD83C\uDDF8\uD83C\uDDE6",

    BR:
      "\uD83C\uDDE7\uD83C\uDDF7",

    AR:
      "\uD83C\uDDE6\uD83C\uDDF7",

    MX:
      "\uD83C\uDDF2\uD83C\uDDFD",

    JP:
      "\uD83C\uDDEF\uD83C\uDDF5",

    KR:
      "\uD83C\uDDF0\uD83C\uDDF7",

    AU:
      "\uD83C\uDDE6\uD83C\uDDFA"

  };


  /*
    Kesin ilk 6.
    Bundesliga 2 gibi ligler Bundesliga ile eÅŸleÅŸmez.
  */

  function topLeagueGroup(name) {

    const n =
      normLeague(name);


    if (
      n === "premier league"
    ) {
      return {
        rank: 0,
        flag: FLAGS.GB
      };
    }


    if (
      n === "laliga ea sports" ||
      n === "la liga" ||
      n === "laliga"
    ) {
      return {
        rank: 1,
        flag: FLAGS.ES
      };
    }


    if (
      n === "serie a enilive" ||
      n === "serie a"
    ) {
      return {
        rank: 2,
        flag: FLAGS.IT
      };
    }


    if (
      n === "bundesliga"
    ) {
      return {
        rank: 3,
        flag: FLAGS.DE
      };
    }


    if (
      n === "ligue 1 mcdonald s" ||
      n === "ligue 1"
    ) {
      return {
        rank: 4,
        flag: FLAGS.FR
      };
    }


    if (
      n === "trendyol super lig" ||
      n === "super lig"
    ) {
      return {
        rank: 5,
        flag: FLAGS.TR
      };
    }


    return null;

  }


  const OTHER_POPULAR = [

    {
      names: [
        "efl championship",
        "championship"
      ],
      rank: 100,
      flag: FLAGS.GB
    },

    {
      names: [
        "eredivisie"
      ],
      rank: 101,
      flag: FLAGS.NL
    },

    {
      names: [
        "liga portugal",
        "primeira liga"
      ],
      rank: 102,
      flag: FLAGS.PT
    },

    {
      names: [
        "major league soccer",
        "mls"
      ],
      rank: 103,
      flag: FLAGS.US
    },

    {
      names: [
        "belgian pro league",
        "pro league"
      ],
      rank: 104,
      flag: FLAGS.BE
    },

    {
      names: [
        "saudi pro league"
      ],
      rank: 105,
      flag: FLAGS.SA
    },

    {
      names: [
        "brasileirao",
        "brasileirao serie a"
      ],
      rank: 106,
      flag: FLAGS.BR
    },

    {
      names: [
        "liga profesional"
      ],
      rank: 107,
      flag: FLAGS.AR
    },

    {
      names: [
        "liga mx"
      ],
      rank: 108,
      flag: FLAGS.MX
    },

    {
      names: [
        "j1 league",
        "j1 ligi"
      ],
      rank: 109,
      flag: FLAGS.JP
    },

    {
      names: [
        "k league 1",
        "k ligi 1"
      ],
      rank: 110,
      flag: FLAGS.KR
    },

    {
      names: [
        "a league"
      ],
      rank: 111,
      flag: FLAGS.AU
    }

  ];


  function leagueMeta(name) {

    const top =
      topLeagueGroup(
        name
      );


    if (top) {
      return top;
    }


    const n =
      normLeague(name);


    const popular =
      OTHER_POPULAR.find(
        (entry) =>
          entry.names.includes(n)
      );


    if (popular) {

      return {
        rank:
          popular.rank,

        flag:
          popular.flag
      };

    }


    /*
      Bilinen ülke bayraÄŸını alt liglere de ver.
    */

    let flag =
      "\u26BD";


    if (
      n.includes("bundesliga") ||
      n === "3 liga"
    ) {
      flag = FLAGS.DE;
    }
    else if (
      n.includes("liga") &&
      n.includes("spain")
    ) {
      flag = FLAGS.ES;
    }
    else if (
      n.includes("efl") ||
      n.includes("barclays wsl")
    ) {
      flag = FLAGS.GB;
    }


    return {
      rank: 1000,
      flag
    };

  }


  function stripExistingFlag(text) {

    return cleanMojibake(
      text
    )
      /*
        Eski bozuk emoji byte dizilerini tamamen temizle.
      */
      
      /*
        SaÄŸlam emoji bayraÄŸı varsa da kaldırıp yeniden ekle.
      */
      .replace(
        /^\p{Regional_Indicator}{2}\s*/u,
        ""
      )
      .replace(
        /^\u26BD\s*/u,
        ""
      )
      .trim();

  }


  function reorderLeagueSelect(
    select
  ) {

    if (
      !select ||
      select.options.length < 2
    ) {
      return;
    }


    const selectedValue =
      select.value;


    const firstText =
      cleanMojibake(
        select.options[0].textContent
      );


    const rows =
      [...select.options]
        .slice(1)
        .map(
          (option) => {

            const name =
              option.dataset.cleanLeagueName ||
              stripExistingFlag(
                option.textContent
              );


            const meta =
              leagueMeta(
                name
              );


            return {

              value:
                option.value,

              name,

              rank:
                meta.rank,

              flag:
                meta.flag

            };

          }
        );


    /*
      Aynı value tekrarlarını engelle.
    */

    const unique =
      [];


    const seen =
      new Set();


    rows.forEach(
      (row) => {

        const key =
          `${row.value}::${normLeague(row.name)}`;


        if (
          seen.has(key)
        ) {
          return;
        }


        seen.add(key);

        unique.push(
          row
        );

      }
    );


    unique.sort(
      (a, b) => {

        if (
          a.rank !==
          b.rank
        ) {

          return (
            a.rank -
            b.rank
          );

        }


        return a.name
          .localeCompare(
            b.name,
            "tr"
          );

      }
    );


    select.innerHTML =
      "";


    const all =
      document.createElement(
        "option"
      );

    all.value =
      "";

    all.textContent =
      firstText ||
      "Tüm ligler";

    select.appendChild(
      all
    );


    unique.forEach(
      (row) => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          row.value;

        option.dataset.cleanLeagueName =
          row.name;

        option.textContent =
          `${row.flag} ${row.name}`;

        select.appendChild(
          option
        );

      }
    );


    if (
      [...select.options]
        .some(
          (option) =>
            option.value ===
            selectedValue
        )
    ) {

      select.value =
        selectedValue;

    }

  }


  function fixLeagueFilters() {

    reorderLeagueSelect(
      document.getElementById(
        "fc26League"
      )
    );


    reorderLeagueSelect(
      document.getElementById(
        "compareLeague"
      )
    );

  }


  // ----------------------------------------------------------
  // PAGINATION
  // ----------------------------------------------------------

  function parsePageInfo(
    text
  ) {

    const match =
      String(text || "")
        .match(
          /(\d+)\s*\/\s*(\d+)/
        );


    return match
      ? {
          current:
            Number(match[1]),

          total:
            Number(match[2])
        }
      : null;

  }


  function pageWindow(
    current,
    total
  ) {

    const pages =
      new Set([
        1,
        total
      ]);


    for (
      let i =
        Math.max(
          1,
          current - 2
        );
      i <=
        Math.min(
          total,
          current + 2
        );
      i++
    ) {

      pages.add(
        i
      );

    }


    if (
      current <= 4
    ) {

      for (
        let i = 1;
        i <=
          Math.min(
            5,
            total
          );
        i++
      ) {
        pages.add(i);
      }

    }


    return [
      ...pages
    ].sort(
      (a, b) =>
        a - b
    );

  }


  /*
    Bu fonksiyon mevcut Ã–nceki/Sonraki butonlarının click
    eventlerini kullanıyor ancak butonlar kullanıcıdan gizleniyor.
  */

  function goToPage(
    current,
    target,
    prev,
    next
  ) {

    if (
      current === target
    ) {
      return;
    }


    const button =
      target > current
        ? next
        : prev;


    const steps =
      Math.abs(
        target - current
      );


    for (
      let i = 0;
      i < steps;
      i++
    ) {

      if (
        button.disabled
      ) {
        break;
      }


      button.click();

    }


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  function enhancePager(
    prev,
    next,
    label,
    key
  ) {

    if (
      !prev ||
      !next ||
      !label
    ) {
      return;
    }


    const info =
      parsePageInfo(
        label.textContent
      );


    if (!info) {
      return;
    }


    const originalPager =
      prev.parentElement;


    if (!originalPager) {
      return;
    }


    /*
      Eski Ã–nceki / Sonraki ve 1 / 745 tamamen görünmez.
      Event listener'ları çalıÅŸmaya devam eder.
    */

    prev.classList.add(
      "legacy-pager-control"
    );

    next.classList.add(
      "legacy-pager-control"
    );

    label.classList.add(
      "legacy-pager-control"
    );


    let enhanced =
      originalPager.querySelector(
        `[data-final-pager="${key}"]`
      );


    if (!enhanced) {

      enhanced =
        document.createElement(
          "div"
        );

      enhanced.dataset.finalPager =
        key;

      enhanced.className =
        "final-pagination";

      originalPager.appendChild(
        enhanced
      );

    }


    const pages =
      pageWindow(
        info.current,
        info.total
      );


    let last =
      null;


    let buttons =
      "";


    pages.forEach(
      (page) => {

        if (
          last !== null &&
          page - last > 1
        ) {

          buttons +=
            '<span class="final-page-dots">\u2026</span>';

        }


        buttons += `
          <button
            type="button"
            data-final-page="${page}"
            class="${
              page === info.current
                ? "active"
                : ""
            }">
            ${page}
          </button>
        `;


        last =
          page;

      }
    );


    enhanced.innerHTML = `
      <div class="final-page-list">
        ${buttons}
      </div>

      <form class="final-page-jump">

        <label>
          Sayfaya git

          <input
            type="number"
            min="1"
            max="${info.total}"
            placeholder="1-${info.total}"
            inputmode="numeric"
          >
        </label>

        <button
          type="submit">
          Git \u2192
        </button>

      </form>
    `;


    enhanced
      .querySelectorAll(
        "[data-final-page]"
      )
      .forEach(
        (button) => {

          button.onclick =
            () => {

              goToPage(
                info.current,
                Number(
                  button.dataset.finalPage
                ),
                prev,
                next
              );

            };

        }
      );


    const form =
      enhanced.querySelector(
        ".final-page-jump"
      );


    form.onsubmit =
      (event) => {

        event.preventDefault();


        const input =
          form.querySelector(
            "input"
          );


        const target =
          Math.min(
            info.total,
            Math.max(
              1,
              Number(
                input.value
              ) || 1
            )
          );


        goToPage(
          info.current,
          target,
          prev,
          next
        );

      };

  }


  function fixPagination() {

    enhancePager(

      document.getElementById(
        "catalogPrev"
      ),

      document.getElementById(
        "catalogNext"
      ),

      document.getElementById(
        "catalogPage"
      ),

      "catalog"

    );


    enhancePager(

      document.getElementById(
        "fc26Prev"
      ),

      document.getElementById(
        "fc26Next"
      ),

      document.getElementById(
        "fc26Page"
      ),

      "fc26"

    );

  }


  // ----------------------------------------------------------
  // HEPSINI UYGULA
  // ----------------------------------------------------------

  function applyFinalFixes() {

    normalizeHomeMenu();

    fixLeagueFilters();

    fixPagination();

    cleanCatalogText();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      () => {

        setTimeout(
          applyFinalFixes,
          300
        );

      }
    );

  }
  else {

    setTimeout(
      applyFinalFixes,
      300
    );

  }


  /*
    Sonsuz observer döngüsünü engellemek için debounce.
  */

  let pending =
    false;


  const observer =
    new MutationObserver(
      () => {

        if (pending) {
          return;
        }


        pending =
          true;


        setTimeout(
          () => {

            pending =
              false;

            applyFinalFixes();

          },
          250
        );

      }
    );


  setTimeout(
    () => {

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

    },
    800
  );

})();





