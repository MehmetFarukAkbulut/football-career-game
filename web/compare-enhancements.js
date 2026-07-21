"use strict";

/*
  FormaX club comparison picker.

  The country and league filters only change the available list.
  They never replace a club that has already been selected.
*/

(() => {
  const POPULAR_LEAGUE_IDS = [
    "GB1",
    "ES1",
    "IT1",
    "L1",
    "FR1",
    "TR1"
  ];

  const POPULAR_LEAGUE_NAMES = [
    "premier league",
    "laliga",
    "la liga",
    "serie a",
    "bundesliga",
    "ligue 1",
    "trendyol süper lig",
    "süper lig"
  ];

  const state = {
    country: "",
    league: "",
    selectedA: null,
    selectedB: null,
    ready: false
  };

  const clubListCache = {
    A: new Map(),
    B: new Map()
  };

  function clearClubListCache() {
    clubListCache.A.clear();
    clubListCache.B.clear();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .toLowerCase()
      .trim();
  }

  const COUNTRY_CODE_BY_NAME = new Map([
    ["almanya", "de"],
    ["germany", "de"],
    ["ingiltere", "gb"],
    ["england", "gb"],
    ["ispanya", "es"],
    ["spain", "es"],
    ["italya", "it"],
    ["italy", "it"],
    ["fransa", "fr"],
    ["france", "fr"],
    ["turkiye", "tr"],
    ["turkey", "tr"],
    ["portekiz", "pt"],
    ["portugal", "pt"],
    ["hollanda", "nl"],
    ["netherlands", "nl"],
    ["belcika", "be"],
    ["belgium", "be"],
    ["avusturya", "at"],
    ["austria", "at"],
    ["isvicre", "ch"],
    ["switzerland", "ch"],
    ["yunanistan", "gr"],
    ["greece", "gr"],
    ["danimarka", "dk"],
    ["denmark", "dk"],
    ["norvec", "no"],
    ["norway", "no"],
    ["isvec", "se"],
    ["sweden", "se"],
    ["polonya", "pl"],
    ["poland", "pl"],
    ["amerika", "us"],
    ["united states", "us"],
    ["usa", "us"],
    ["brezilya", "br"],
    ["brazil", "br"],
    ["arjantin", "ar"],
    ["argentina", "ar"],
    ["meksika", "mx"],
    ["mexico", "mx"],
    ["japonya", "jp"],
    ["japan", "jp"],
    ["south korea", "kr"],
    ["guney kore", "kr"]
  ]);

  function resolveCountryCode(club) {
    const direct =
      String(
        club.countryCode ||
        club.country_code ||
        club.countryIso2 ||
        club.iso2 ||
        ""
      )
        .trim()
        .toLowerCase();

    if (/^[a-z]{2}$/.test(direct)) {
      return direct;
    }

    return (
      COUNTRY_CODE_BY_NAME.get(
        normalize(
          club.country ||
          club.countryName ||
          ""
        )
      ) ||
      ""
    );
  }

  function flagImage(club) {
    const code =
      resolveCountryCode(club);

    const countryName =
      String(
        club.country ||
        club.countryName ||
        "Ülke bilinmiyor"
      );

    if (!code) {
      return `
        <span
          class="compare-club-flag compare-club-flag-fallback"
          title="${esc(countryName)}"
        >&#127760;</span>
      `;
    }

    return `
      <span
        class="compare-club-flag"
        title="${esc(countryName)}"
      >
        <img
          src="https://flagcdn.com/24x18/${code}.png"
          srcset="https://flagcdn.com/48x36/${code}.png 2x"
          width="24"
          height="18"
          loading="lazy"
          decoding="async"
          alt="${esc(countryName)}"
        >
      </span>
    `;
  }

  function clubFlag(club) {
    return flagImage(club);
  }

  function leagueRank(club) {
    const id = String(
      club.leagueId ||
      club.competitionId ||
      ""
    );

    const directRank =
      POPULAR_LEAGUE_IDS.indexOf(id);

    if (directRank !== -1) {
      return directRank;
    }

    const name =
      normalize(club.league);

    const nameRank =
      POPULAR_LEAGUE_NAMES.findIndex(
        (leagueName) =>
          name === normalize(leagueName)
      );

    if (nameRank !== -1) {
      /*
        Multiple name aliases map into the same six-league
        priority group. Keep them above all other leagues.
      */
      if (name.includes("premier")) return 0;
      if (name.includes("laliga") || name === "la liga") return 1;
      if (name.includes("serie a")) return 2;
      if (name === "bundesliga") return 3;
      if (name.includes("ligue 1")) return 4;
      if (name.includes("super lig") || name.includes("süper lig")) return 5;
    }

    return 100;
  }

  function sortedClubs(items) {
    return [...items].sort((a, b) => {
      const leagueDifference =
        leagueRank(a) - leagueRank(b);

      if (leagueDifference !== 0) {
        return leagueDifference;
      }

      const popularityDifference =
        Number(b.popularityScore || 0) -
        Number(a.popularityScore || 0);

      if (popularityDifference !== 0) {
        return popularityDifference;
      }

      return String(a.name || "")
        .localeCompare(
          String(b.name || ""),
          "tr"
        );
    });
  }

  function availableClubs(side, query = "") {
    const selectedOther =
      side === "A"
        ? state.selectedB
        : state.selectedA;

    const normalizedQuery =
      normalize(query);

    return sortedClubs(
      clubs.filter((club) => {
        /*
          Do not offer the same club on both sides.
        */
        if (
          selectedOther != null &&
          Number(club.id) === Number(selectedOther)
        ) {
          return false;
        }

        if (
          state.country &&
          String(club.country || "") !== state.country
        ) {
          return false;
        }

        if (
          state.league &&
          String(club.league || "") !== state.league
        ) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchable = normalize(
          [
            club.name,
            club.league,
            club.country,
            club.countryName
          ]
            .filter(Boolean)
            .join(" ")
        );

        return searchable.includes(
          normalizedQuery
        );
      })
    );
  }

  function clubById(id) {
    return clubs.find(
      (club) =>
        Number(club.id) === Number(id)
    );
  }

  function renderSelected(side) {
    const selectedId =
      side === "A"
        ? state.selectedA
        : state.selectedB;

    const button =
      byId(`comparePicker${side}Button`);

    const club =
      clubById(selectedId);

    if (!button) {
      return;
    }

    if (!club) {
      button.innerHTML = `
        <span class="compare-picker-placeholder">
          Kulüp seç
        </span>
        <span class="compare-picker-chevron">&#8964;</span>
      `;

      return;
    }

    button.innerHTML = `
      <span class="compare-picker-selected">
        ${clubFlag(club)}
        <span>
          <b>${esc(club.name)}</b>
          <small>
            ${esc(club.league || "")}
            ${club.country ? ` &middot; ${esc(club.country)}` : ""}
          </small>
        </span>
      </span>
      <span class="compare-picker-chevron">&#8964;</span>
    `;
  }

  function closeLists(exceptSide = "") {
    for (const side of ["A", "B"]) {
      if (side === exceptSide) {
        continue;
      }

      byId(`comparePicker${side}Panel`)
        ?.setAttribute("hidden", "");
    }
  }

  function clubListCacheKey(side, query = "") {
    return [
      state.country || "",
      state.league || "",
      normalize(query),
      side === "A"
        ? state.selectedB || ""
        : state.selectedA || ""
    ].join("|");
  }


  function buildClubListHtml(side, query = "") {
    const items =
      availableClubs(
        side,
        query
      );

    if (!items.length) {
      return `
        <p class="compare-picker-empty">
          Bu filtrelerde kulÃ¼p bulunamadÄ±.
        </p>
      `;
    }

    return items
      .map((club) => {
        const popular =
          leagueRank(club) < 100;

        return `
          <button
            type="button"
            class="compare-club-option ${popular ? "is-priority" : ""}"
            data-compare-side="${side}"
            data-compare-club="${club.id}"
          >
            ${clubFlag(club)}

            <span>
              <b>${esc(club.name)}</b>
              <small>
                ${esc(club.league || "Lig bilinmiyor")}
                ${club.country ? ` &middot; ${esc(club.country)}` : ""}
              </small>
            </span>

            ${
              popular
                ? '<em>&Ouml;ne &ccedil;&#305;kan lig</em>'
                : ""
            }
          </button>
        `;
      })
      .join("");
  }


  function bindClubListButtons(side) {
    const list =
      byId(`comparePicker${side}List`);

    if (!list) {
      return;
    }

    list
      .querySelectorAll(
        "[data-compare-club]"
      )
      .forEach((button) => {

        button.onclick = () => {

          const selectedId =
            Number(
              button.dataset.compareClub
            );

          if (side === "A") {
            state.selectedA = selectedId;
          }
          else {
            state.selectedB = selectedId;
          }

          clearClubListCache();

          renderSelected("A");
          renderSelected("B");

          byId(`comparePicker${side}Panel`)
            ?.setAttribute(
              "hidden",
              ""
            );

          const search =
            byId(`comparePicker${side}Search`);

          if (search) {
            search.value = "";
          }

          updateCompareButton();
        };
      });
  }


  function renderClubList(side) {
    const input =
      byId(`comparePicker${side}Search`);

    const list =
      byId(`comparePicker${side}List`);

    if (!list) {
      return;
    }

    const query =
      input?.value || "";

    const key =
      clubListCacheKey(
        side,
        query
      );

    let html =
      clubListCache[side]
        .get(key);

    if (!html) {
      html =
        buildClubListHtml(
          side,
          query
        );

      clubListCache[side]
        .set(
          key,
          html
        );
    }

    list.innerHTML =
      html;

    bindClubListButtons(side);
  }


  function warmClubLists() {
    if (
      !Array.isArray(clubs) ||
      !clubs.length
    ) {
      return;
    }

    for (const side of ["A", "B"]) {
      const key =
        clubListCacheKey(
          side,
          ""
        );

      if (
        clubListCache[side]
          .has(key)
      ) {
        continue;
      }

      const html =
        buildClubListHtml(
          side,
          ""
        );

      clubListCache[side]
        .set(
          key,
          html
        );
    }
  }

  function togglePanel(side) {
    const panel =
      byId(`comparePicker${side}Panel`);

    if (!panel) {
      return;
    }

    const willOpen =
      panel.hasAttribute("hidden");

    closeLists(
      willOpen
        ? side
        : ""
    );

    panel.toggleAttribute(
      "hidden",
      !willOpen
    );

    if (willOpen) {
      renderClubList(side);

      setTimeout(() => {
        byId(`comparePicker${side}Search`)
          ?.focus();
      }, 0);
    }
  }

  function updateCompareButton() {
    const button =
      byId("compareButton");

    if (!button) {
      return;
    }

    button.disabled =
      !state.selectedA ||
      !state.selectedB ||
      Number(state.selectedA) ===
        Number(state.selectedB);
  }

  function buildFilterOptions() {
    const country =
      byId("comparePickerCountry");

    const league =
      byId("comparePickerLeague");

    if (!country || !league) {
      return;
    }

    const countries = [
      ...new Set(
        clubs
          .map((club) => club.country)
          .filter(Boolean)
      )
    ].sort((a, b) =>
      String(a).localeCompare(
        String(b),
        "tr"
      )
    );

    const leagues = [
      ...new Set(
        clubs
          .map((club) => club.league)
          .filter(Boolean)
      )
    ].sort((a, b) => {
      const fakeA = {
        league: a
      };

      const fakeB = {
        league: b
      };

      const rankDifference =
        leagueRank(fakeA) -
        leagueRank(fakeB);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return String(a).localeCompare(
        String(b),
        "tr"
      );
    });

    country.innerHTML =
      '<option value="">Tüm ülkeler</option>' +
      countries
        .map(
          (value) =>
            `<option value="${esc(value)}">${esc(value)}</option>`
        )
        .join("");

    league.innerHTML =
      '<option value="">Tüm ligler</option>' +
      leagues
        .map(
          (value) =>
            `<option value="${esc(value)}">${esc(value)}</option>`
        )
        .join("");

    country.value = state.country;
    league.value = state.league;
  }

  function updateFilters() {
    state.country =
      byId("comparePickerCountry")?.value || "";

    state.league =
      byId("comparePickerLeague")?.value || "";

    /*
      Existing selections stay unchanged.
      Only cached available lists must be rebuilt.
    */
    clearClubListCache();

    warmClubLists();
  }

  function syncNativeSelectors() {
    const nativeA =
      byId("compareA");

    const nativeB =
      byId("compareB");

    if (!nativeA || !nativeB) {
      return false;
    }

    /*
      The original comparison handler still performs the actual
      common-player lookup. Feed our independent selections into
      the original selects immediately before it runs.
    */

    nativeA.value =
      String(state.selectedA || "");

    nativeB.value =
      String(state.selectedB || "");

    return (
      nativeA.value ===
        String(state.selectedA) &&
      nativeB.value ===
        String(state.selectedB)
    );
  }

  function createPickerMarkup() {
    const nativeFilters =
      document.querySelector(
        "#compare .compare-filters"
      );

    const nativeSelects =
      document.querySelector(
        "#compare .compare-selects"
      );

    if (
      !nativeFilters ||
      !nativeSelects
    ) {
      return false;
    }

    /*
      Keep original controls in DOM for the existing comparison
      code, but remove them from visual interaction.
    */
    nativeFilters.classList.add(
      "compare-native-controls"
    );

    nativeSelects.classList.add(
      "compare-native-controls"
    );

    if (
      byId("compareEnhancedControls")
    ) {
      return true;
    }

    const wrapper =
      document.createElement("div");

    wrapper.id =
      "compareEnhancedControls";

    wrapper.className =
      "compare-enhanced-controls";

    wrapper.innerHTML = `
      <div class="compare-enhanced-filters">

        <label>
          Ülke
          <select id="comparePickerCountry">
            <option value="">
              Tüm ülkeler
            </option>
          </select>
        </label>

        <label>
          Lig
          <select id="comparePickerLeague">
            <option value="">
              Tüm ligler
            </option>
          </select>
        </label>

      </div>

      <div class="compare-enhanced-pickers">

        ${pickerHtml(
          "A",
          "Birinci kulüp"
        )}

        <span class="compare-picker-versus">
          \↔
        </span>

        ${pickerHtml(
          "B",
          "İkinci kulüp"
        )}

      </div>
    `;

    nativeSelects.insertAdjacentElement(
      "afterend",
      wrapper
    );

    return true;
  }

  function pickerHtml(side, label) {
    return `
      <div class="compare-club-picker">

        <label>${label}</label>

        <button
          type="button"
          id="comparePicker${side}Button"
          class="compare-picker-button"
          aria-haspopup="listbox"
        ></button>

        <div
          id="comparePicker${side}Panel"
          class="compare-picker-panel"
          hidden
        >

          <input
            id="comparePicker${side}Search"
            type="search"
            autocomplete="off"
            placeholder="Kulüp adı, lig veya ülke ara…"
          >

          <div
            id="comparePicker${side}List"
            class="compare-picker-list"
            role="listbox"
          ></div>

        </div>

      </div>
    `;
  }


  function bindEvents() {
    for (const side of ["A", "B"]) {
      byId(`comparePicker${side}Button`)
        ?.addEventListener(
          "click",
          () => togglePanel(side)
        );

      byId(`comparePicker${side}Search`)
        ?.addEventListener(
          "input",
          () => renderClubList(side)
        );

      byId(`comparePicker${side}Search`)
        ?.addEventListener(
          "keydown",
          (event) => {
            if (event.key === "Escape") {
              byId(`comparePicker${side}Panel`)
                ?.setAttribute("hidden", "");
            }

            if (event.key === "Enter") {
              const first =
                byId(`comparePicker${side}List`)
                  ?.querySelector(
                    "[data-compare-club]"
                  );

              if (first) {
                event.preventDefault();
                first.click();
              }
            }
          }
        );
    }

    byId("comparePickerCountry")
      ?.addEventListener(
        "change",
        updateFilters
      );

    byId("comparePickerLeague")
      ?.addEventListener(
        "change",
        updateFilters
      );

    /*
      Capture phase runs before the original compareButton.onclick.
    */
    byId("compareButton")
      ?.addEventListener(
        "click",
        (event) => {
          if (
            !state.selectedA ||
            !state.selectedB
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();

            byId("compareMessage").textContent =
              "Karşılaştırmak için iki farklı kulüp seç.";
            return;
          }

          if (
            Number(state.selectedA) ===
            Number(state.selectedB)
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();

            byId("compareMessage").textContent =
              "Aynı kulüp iki kez seçilemez.";
            return;
          }

          if (!syncNativeSelectors()) {
            event.preventDefault();
            event.stopImmediatePropagation();

            byId("compareMessage").textContent =
              "Kulüp listesi hazırlanıyor. Birkaç saniye sonra tekrar dene.";
          }
        },
        true
      );

    document.addEventListener(
      "click",
      (event) => {
        if (
          !event.target.closest(
            ".compare-club-picker"
          )
        ) {
          closeLists();
        }
      }
    );
  }

  function preserveExistingSelections() {
    const nativeA =
      Number(
        byId("compareA")?.value || 0
      );

    const nativeB =
      Number(
        byId("compareB")?.value || 0
      );

    if (!state.selectedA && nativeA) {
      state.selectedA = nativeA;
    }

    if (
      !state.selectedB &&
      nativeB &&
      nativeB !== state.selectedA
    ) {
      state.selectedB = nativeB;
    }
  }


  function removeTravellerCards() {
    document
      .querySelectorAll(
        '.mode-card[data-view="travelers"]'
      )
      .forEach(
        (element) =>
          element.remove()
      );
  }
  function initialize() {
    removeTravellerCards();

removeTravellerCards();
    if (
      !Array.isArray(clubs) ||
      !clubs.length
    ) {
      return false;
    }

    if (!createPickerMarkup()) {
      return false;
    }

    preserveExistingSelections();
    buildFilterOptions();

    if (!state.ready) {
      bindEvents();
      state.ready = true;
    }

    renderSelected("A");
    renderSelected("B");
    updateCompareButton();

    /*
      Prepare default lists outside the user's click.
      This makes the first picker open immediately.
    */
    if (
      "requestIdleCallback" in window
    ) {
      requestIdleCallback(
        warmClubLists,
        {
          timeout: 800
        }
      );
    }
    else {
      setTimeout(
        warmClubLists,
        0
      );
    }

    return true;
  }
  /*
    Controlled initialization.

    A document-wide MutationObserver must not be used here because
    initialize() itself updates picker markup. Observing those updates
    would trigger initialize() again and create an endless DOM loop.
  */

  let initializationTimer = null;
  let initializationAttempts = 0;

  function scheduleInitialize() {
    if (initializationTimer) {
      clearTimeout(
        initializationTimer
      );
    }

    initializationTimer =
      setTimeout(() => {

        initializationTimer = null;

        initialize();

      }, 180);
  }

  function startInitializationRetry() {
    if (initialize()) {
      return;
    }

    initializationAttempts++;

    if (initializationAttempts >= 100) {
      console.warn(
        "[FormaX compare] Kulüp verileri zamanında hazırlanamadı."
      );
      return;
    }

    setTimeout(
      startInitializationRetry,
      Math.min(100 + initializationAttempts * 20, 1000)
    );
  }

  window.addEventListener(
    "iki-forma-data-bootstrap",
    scheduleInitialize
  );

  window.addEventListener(
    "iki-forma-data-progress",
    scheduleInitialize
  );

  window.addEventListener(
    "iki-forma-data-complete",
    scheduleInitialize
  );

  window.addEventListener(
    "iki-forma-ui-ready",
    scheduleInitialize
  );

  removeTravellerCards();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startInitializationRetry,
      { once: true }
    );
  }
  else {
    startInitializationRetry();
  }
})();
