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
          <h3>SonuÃ§ bulunamadÄ±</h3>
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
                  alt="${esc(player.name)} FC 26 kartÄ±"
                  loading="lazy"
                >
              `
              : `
                <div class="fc26-card-missing">
                  <strong>${esc(player.name)}</strong>
                  <span>FC 26 kart gÃ¶rseli bulunamadÄ±</span>
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
                  Â·
                  ${esc(positions || "Mevki bilinmiyor")}
                </p>

                <small>
                  ${esc(player.team || "TakÄ±m bilinmiyor")}
                  Â·
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
// FC26 KATALOG ANA MENU GIRISI
// ============================================================

function ensureFc26CatalogMenuCard() {

  // Katalog zaten ana menude varsa ikinci kez ekleme.
  if (document.querySelector("[data-fc26-catalog-menu]")) {
    return;
  }

  // Ana sayfadaki oyun/menu kartlarini bul.
  const cards = Array.from(
    document.querySelectorAll(
      ".game-card, .mode-card, [data-game], .home-card"
    )
  );

  if (!cards.length) {
    return;
  }

  // MÃ¼mkÃ¼nse Futbolcu KataloÄŸu kartÄ±nÄ± referans al.
  const reference =
    cards.find((card) =>
      /Futbolcu KataloÄŸu/i.test(card.textContent || "")
    ) ||
    cards[cards.length - 1];

  const card = reference.cloneNode(true);

  card.setAttribute(
    "data-fc26-catalog-menu",
    "true"
  );

  // Eski oyun/menu attribute'larini temizle.
  [
    "data-game",
    "data-mode",
    "data-view",
    "data-action"
  ].forEach((attr) => {
    card.removeAttribute(attr);
  });

  // Kart icerigini degistir.
  const title =
    card.querySelector(
      "h2, h3, h4, strong, .title, .card-title"
    );

  const description =
    card.querySelector(
      "p, .description, .card-description"
    );

  if (title) {
    title.textContent =
      "FC 26 Futbolcu KartlarÄ±";
  }

  if (description) {
    description.textContent =
      "GerÃ§ek FC 26 kartlarÄ±nÄ± gÃ¶rÃ¼ntÃ¼le, filtrele ve incele.";
  }

  // Emoji/icon varsa deÄŸiÅŸtir.
  const icon =
    card.querySelector(
      ".icon, .emoji, .game-icon, .mode-icon"
    );

  if (icon) {
    icon.textContent = "â­";
  }

  // Clone edilen eski click davranisini engellemek icin
  // yeni node ile tekrar klonla.
  const cleanCard =
    card.cloneNode(true);

  cleanCard.setAttribute(
    "data-fc26-catalog-menu",
    "true"
  );

  cleanCard.style.cursor =
    "pointer";

  cleanCard.addEventListener(
    "click",
    (event) => {

      event.preventDefault();
      event.stopPropagation();

      if (
        typeof window.openFc26Catalog ===
        "function"
      ) {

        window.openFc26Catalog();

        return;
      }

      // Mevcut katalog butonu varsa onu tetikle.
      const existingButton =
        document.querySelector(
          '[data-open-fc26-catalog]'
        );

      if (existingButton) {

        existingButton.click();

        return;
      }

      // fc26Catalog view mevcutsa doÄŸrudan aÃ§.
      const catalog =
        document.getElementById(
          "fc26Catalog"
        );

      if (catalog) {

        document
          .querySelectorAll(
            ".game-screen, .screen, .view"
          )
          .forEach((screen) => {

            if (screen !== catalog) {
              screen.hidden = true;
            }

          });

        catalog.hidden = false;

        catalog.style.display =
          "";

        window.scrollTo(
          0,
          0
        );

      }

    }
  );

  reference.parentElement.appendChild(
    cleanCard
  );

}


// DOM hazir oldugunda ekle.

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      setTimeout(
        ensureFc26CatalogMenuCard,
        500
      );

    }
  );

}
else {

  setTimeout(
    ensureFc26CatalogMenuCard,
    500
  );

}


// Ana menu yeniden render edilirse tekrar kontrol et.

const fc26CatalogMenuObserver =
  new MutationObserver(() => {

    const isHomeVisible =
      document.querySelector(
        ".game-card, .mode-card, [data-game], .home-card"
      );

    if (isHomeVisible) {

      ensureFc26CatalogMenuCard();

    }

  });


setTimeout(() => {

  if (document.body) {

    fc26CatalogMenuObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

  }

}, 1000);


// ============================================================
// MENU DUPLICATE CLEANUP
// ============================================================

function cleanupInvalidFc26MenuClones() {

  document
    .querySelectorAll("[data-fc26-catalog-menu]")
    .forEach((card) => {

      const text =
        (card.textContent || "")
          .replace(/\s+/g, " ")
          .trim();

      /*
        FC26 katalog kartÄ± oluÅŸturulurken yanlÄ±ÅŸlÄ±kla
        Turnuva 11 kartÄ± clone edilmiÅŸse kaldÄ±r.
      */
      if (
        /Turnuva 11/i.test(text) &&
        !/FC 26 Futbolcu Kart/i.test(text)
      ) {
        card.remove();
      }

    });
}


/*
  AynÄ± katalog kartÄ±ndan birden fazla oluÅŸmuÅŸsa
  yalnÄ±zca ilkini tut.
*/
function cleanupDuplicateFc26CatalogCards() {

  const cards = [
    ...document.querySelectorAll(
      "[data-fc26-catalog-menu]"
    )
  ].filter((card) =>
    /FC 26 Futbolcu Kart/i.test(
      card.textContent || ""
    )
  );

  cards
    .slice(1)
    .forEach((card) =>
      card.remove()
    );
}


function cleanupFc26HomeMenu() {

  cleanupInvalidFc26MenuClones();

  cleanupDuplicateFc26CatalogCards();

}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      setTimeout(
        cleanupFc26HomeMenu,
        700
      );

    }
  );

}
else {

  setTimeout(
    cleanupFc26HomeMenu,
    700
  );

}


/*
  Mevcut observer katalog kartÄ±nÄ± tekrar Ã¼retirse
  temizlik tekrar Ã§alÄ±ÅŸsÄ±n.
*/

setTimeout(() => {

  const observer =
    new MutationObserver(() => {

      cleanupFc26HomeMenu();

    });

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

}, 1000);


// ============================================================
// CATALOG PAGINATION AND LEAGUE PRIORITY PATCH
// ============================================================

(() => {

  const PATCH_MARKER =
    "CATALOG PAGINATION AND LEAGUE PRIORITY PATCH";


  // ----------------------------------------------------------
  // GEZGIN FUTBOLCULARI ANA MENUDEN KALDIR
  // ----------------------------------------------------------

  function removeTravelersFeature() {

    /*
      Ana menudeki orijinal veya onceki yamalarla olusmus
      tum Gezgin Futbolcular kartlarini kaldir.
    */

    document
      .querySelectorAll(
        '#home [data-view="travelers"], ' +
        '#home [data-fc26-catalog-menu], ' +
        '#home .mode-card, ' +
        '#home button'
      )
      .forEach((card) => {

        const text =
          (card.textContent || "")
            .replace(/\s+/g, " ")
            .trim();

        if (
          /Gezgin Futbolcu/i.test(text)
        ) {

          card.remove();

        }

      });


    /*
      Gezgin Futbolcular sayfasini DOM'da tutuyoruz.
      app.js eski event referanslari nedeniyle elementin tamamen
      silinmesi hata uretebilir. Kullanici tarafindan erisilemez.
    */

    const travelers =
      document.getElementById(
        "travelers"
      );

    if (travelers) {

      travelers.hidden = true;

      travelers.classList.remove(
        "active"
      );

      travelers.style.display =
        "none";

    }

  }


  // ----------------------------------------------------------
  // LIG ONCELIGI
  // ----------------------------------------------------------

  const LEAGUE_PRIORITY = [

    // 5 buyuk + Turkiye
    "Premier League",
    "LALIGA EA SPORTS",
    "LaLiga",
    "Serie A Enilive",
    "Serie A",
    "Bundesliga",
    "Ligue 1 McDonald's",
    "Ligue 1",
    "Trendyol SÃ¼per Lig",
    "SÃ¼per Lig",

    // Diger bilinen ligler
    "EFL Championship",
    "Eredivisie",
    "Liga Portugal",
    "Primeira Liga",
    "MLS",
    "Major League Soccer",
    "BrasileirÃ£o",
    "SÃ©rie A",
    "Liga Profesional",
    "Profesyonel Lig",
    "Belgian Pro League",
    "Pro League",
    "Scottish Premiership",
    "Superliga",
    "Allsvenskan",
    "Eliteserien",
    "A-League",
    "J1 League",
    "J1 Ligi",
    "K League 1",
    "K Ligi 1"

  ];


  function normalizeLeagueName(value) {

    return String(value || "")
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLocaleLowerCase("tr")
      .trim();

  }


  const PRIORITY_MAP =
    new Map(
      LEAGUE_PRIORITY.map(
        (name, index) => [
          normalizeLeagueName(name),
          index
        ]
      )
    );


  function leagueFlag(name) {

    const n =
      normalizeLeagueName(name);


    if (
      n.includes("premier league") ||
      n.includes("championship") ||
      n.includes("league one") ||
      n.includes("league two")
    ) {
      return "ğŸ‡¬ğŸ‡§";
    }


    if (
      n.includes("laliga") ||
      n === "la liga" ||
      n.includes("segunda")
    ) {
      return "ğŸ‡ªğŸ‡¸";
    }


    if (
      n.includes("serie a") ||
      n.includes("serie b") ||
      n.includes("calcio")
    ) {
      return "ğŸ‡®ğŸ‡¹";
    }


    if (
      n === "bundesliga" ||
      n.includes("bundesliga 2") ||
      n.includes("2. bundesliga") ||
      n.includes("3. liga")
    ) {
      return "ğŸ‡©ğŸ‡ª";
    }


    if (
      n.includes("ligue 1") ||
      n.includes("ligue 2")
    ) {
      return "ğŸ‡«ğŸ‡·";
    }


    if (
      n.includes("super lig") ||
      n.includes("sÃ¼per lig") ||
      n.includes("1. lig")
    ) {
      return "ğŸ‡¹ğŸ‡·";
    }


    if (
      n.includes("eredivisie")
    ) {
      return "ğŸ‡³ğŸ‡±";
    }


    if (
      n.includes("liga portugal") ||
      n.includes("primeira liga")
    ) {
      return "ğŸ‡µğŸ‡¹";
    }


    if (
      n === "mls" ||
      n.includes("major league soccer")
    ) {
      return "ğŸ‡ºğŸ‡¸";
    }


    if (
      n.includes("brasile") ||
      n.includes("sÃ©rie a")
    ) {
      return "ğŸ‡§ğŸ‡·";
    }


    if (
      n.includes("profesyonel lig") ||
      n.includes("liga profesional")
    ) {
      return "ğŸ‡¦ğŸ‡·";
    }


    if (
      n.includes("pro league") &&
      !n.includes("saudi")
    ) {
      return "ğŸ‡§ğŸ‡ª";
    }


    if (
      n.includes("saudi")
    ) {
      return "ğŸ‡¸ğŸ‡¦";
    }


    if (
      n.includes("superliga") ||
      n.includes("superligaen")
    ) {
      return "ğŸ‡©ğŸ‡°";
    }


    if (
      n.includes("allsvenskan")
    ) {
      return "ğŸ‡¸ğŸ‡ª";
    }


    if (
      n.includes("eliteserien")
    ) {
      return "ğŸ‡³ğŸ‡´";
    }


    if (
      n.includes("a-league")
    ) {
      return "ğŸ‡¦ğŸ‡º";
    }


    if (
      n.includes("j1")
    ) {
      return "ğŸ‡¯ğŸ‡µ";
    }


    if (
      n.includes("k league") ||
      n.includes("k ligi")
    ) {
      return "ğŸ‡°ğŸ‡·";
    }


    if (
      n.includes("Äesk") ||
      n.includes("ceska")
    ) {
      return "ğŸ‡¨ğŸ‡¿";
    }


    return "âš½";

  }


  function priorityIndex(name) {

    const normalized =
      normalizeLeagueName(name);


    if (
      PRIORITY_MAP.has(normalized)
    ) {

      return PRIORITY_MAP.get(
        normalized
      );

    }


    /*
      Isim tam eslesmese bile
      ana ligleri yukarida tut.
    */

    for (
      let i = 0;
      i < LEAGUE_PRIORITY.length;
      i++
    ) {

      const candidate =
        normalizeLeagueName(
          LEAGUE_PRIORITY[i]
        );

      if (
        normalized.includes(candidate) ||
        candidate.includes(normalized)
      ) {

        return i;

      }

    }


    return 9999;

  }


  function reorderLeagueSelect(
    select
  ) {

    if (
      !select ||
      !select.options ||
      select.options.length <= 1
    ) {
      return;
    }


    /*
      Orijinal option degerlerini koru.
      Sadece gorunen text ve siralama degisir.
    */

    const first =
      select.options[0];


    const currentValue =
      select.value;


    const options =
      [...select.options]
        .slice(1)
        .map((option) => ({

          value:
            option.value,

          originalText:
            option.dataset.originalLeagueText ||
            option.textContent
              .replace(
                /^[^\p{L}\p{N}]+/u,
                ""
              )
              .trim()

        }));


    options.sort(
      (a, b) => {

        const pa =
          priorityIndex(
            a.originalText
          );

        const pb =
          priorityIndex(
            b.originalText
          );


        if (pa !== pb) {

          return pa - pb;

        }


        return a.originalText
          .localeCompare(
            b.originalText,
            "tr"
          );

      }
    );


    select.innerHTML = "";


    if (first) {

      const all =
        document.createElement(
          "option"
        );

      all.value =
        first.value || "";

      all.textContent =
        first.textContent ||
        "TÃ¼m ligler";

      select.appendChild(
        all
      );

    }


    options.forEach(
      (item) => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          item.value;

        option.dataset.originalLeagueText =
          item.originalText;

        option.textContent =
          `${leagueFlag(item.originalText)} ${item.originalText}`;

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
            currentValue
        )
    ) {

      select.value =
        currentValue;

    }

  }


  function reorderAllRelevantLeagues() {

    /*
      Kullanici tarafindan belirtilen iki alan.
    */

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
  // SAYFA NUMARALI PAGINATION
  // ----------------------------------------------------------

  function parsePageInfo(
    text
  ) {

    const match =
      String(text || "")
        .match(
          /(\d+)\s*\/\s*(\d+)/
        );


    if (!match) {

      return null;

    }


    return {

      current:
        Number(match[1]),

      total:
        Number(match[2])

    };

  }


  function pageWindow(
    current,
    total
  ) {

    const values =
      new Set([
        1,
        total
      ]);


    for (
      let page =
        Math.max(
          1,
          current - 2
        );
      page <=
        Math.min(
          total,
          current + 2
        );
      page++
    ) {

      values.add(
        page
      );

    }


    if (
      current <= 4
    ) {

      for (
        let page = 1;
        page <=
          Math.min(
            5,
            total
          );
        page++
      ) {

        values.add(
          page
        );

      }

    }


    if (
      current >= total - 3
    ) {

      for (
        let page =
          Math.max(
            1,
            total - 4
          );
        page <= total;
        page++
      ) {

        values.add(
          page
        );

      }

    }


    return [
      ...values
    ].sort(
      (a, b) =>
        a - b
    );

  }


  function clickToPage(
    current,
    target,
    prevButton,
    nextButton
  ) {

    if (
      target === current
    ) {

      return;

    }


    const button =
      target > current
        ? nextButton
        : prevButton;


    const count =
      Math.abs(
        target - current
      );


    if (!button) {

      return;

    }


    /*
      Mevcut katalog kodlarina dokunmadan
      var olan onceki/sonraki aksiyonlarini kullan.
    */

    for (
      let i = 0;
      i < count;
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


  function enhancePager({
    root,
    pageLabel,
    prevButton,
    nextButton,
    key
  }) {

    if (
      !root ||
      !pageLabel ||
      !prevButton ||
      !nextButton
    ) {

      return;

    }


    const info =
      parsePageInfo(
        pageLabel.textContent
      );


    if (!info) {

      return;

    }


    let enhanced =
      root.querySelector(
        `[data-enhanced-pager="${key}"]`
      );


    if (!enhanced) {

      enhanced =
        document.createElement(
          "div"
        );

      enhanced.className =
        "enhanced-pagination";

      enhanced.dataset.enhancedPager =
        key;


      /*
        Mevcut pager altina ekle.
      */

      root.appendChild(
        enhanced
      );

    }


    const pages =
      pageWindow(
        info.current,
        info.total
      );


    let html =
      '<div class="enhanced-page-numbers">';


    let previousPage =
      null;


    pages.forEach(
      (page) => {

        if (
          previousPage !== null &&
          page - previousPage > 1
        ) {

          html +=
            '<span class="page-ellipsis">â€¦</span>';

        }


        html += `
          <button
            type="button"
            class="page-number ${
              page === info.current
                ? "active"
                : ""
            }"
            data-page-target="${page}">
            ${page}
          </button>
        `;


        previousPage =
          page;

      }
    );


    html +=
      `</div>

       <form class="page-jump">
         <label>
           Sayfaya git
           <input
             type="number"
             min="1"
             max="${info.total}"
             value="${info.current}"
             inputmode="numeric"
           >
         </label>

         <button
           type="submit">
           Git â†’
         </button>
       </form>`;


    enhanced.innerHTML =
      html;


    enhanced
      .querySelectorAll(
        "[data-page-target]"
      )
      .forEach(
        (button) => {

          button.onclick =
            () => {

              clickToPage(
                info.current,
                Number(
                  button.dataset.pageTarget
                ),
                prevButton,
                nextButton
              );

            };

        }
      );


    const form =
      enhanced.querySelector(
        ".page-jump"
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


        clickToPage(
          info.current,
          target,
          prevButton,
          nextButton
        );

      };

  }


  function enhanceAllPagers() {

    /*
      Normal futbolcu katalogu
    */

    const catalogPager =
      document.getElementById(
        "catalogPrev"
      )?.parentElement;


    enhancePager({

      root:
        catalogPager,

      pageLabel:
        document.getElementById(
          "catalogPage"
        ),

      prevButton:
        document.getElementById(
          "catalogPrev"
        ),

      nextButton:
        document.getElementById(
          "catalogNext"
        ),

      key:
        "career-catalog"

    });


    /*
      FC26 katalog
    */

    const fcPager =
      document.getElementById(
        "fc26Prev"
      )?.parentElement;


    enhancePager({

      root:
        fcPager,

      pageLabel:
        document.getElementById(
          "fc26Page"
        ),

      prevButton:
        document.getElementById(
          "fc26Prev"
        ),

      nextButton:
        document.getElementById(
          "fc26Next"
        ),

      key:
        "fc26-catalog"

    });

  }


  // ----------------------------------------------------------
  // BASLAT
  // ----------------------------------------------------------

  function applyCatalogUiFixes() {

    removeTravelersFeature();

    reorderAllRelevantLeagues();

    enhanceAllPagers();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      () => {

        setTimeout(
          applyCatalogUiFixes,
          400
        );

      }
    );

  }
  else {

    setTimeout(
      applyCatalogUiFixes,
      400
    );

  }


  /*
    app.js bazi ekranlari sonradan render ediyor.
    Bu nedenle degisiklikleri observer ile koru.
  */

  let scheduled =
    false;


  const observer =
    new MutationObserver(
      () => {

        if (scheduled) {

          return;

        }


        scheduled =
          true;


        setTimeout(
          () => {

            scheduled =
              false;

            applyCatalogUiFixes();

          },
          150
        );

      }
    );


  setTimeout(
    () => {

      if (
        document.body
      ) {

        observer.observe(
          document.body,
          {
            childList: true,
            subtree: true
          }
        );

      }

    },
    800
  );

})();

