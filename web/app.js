"use strict";
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="icon" type="image/svg+xml" href="favicon.svg">',
);
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="stylesheet" href="web/grid.css?v=23">',
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
  FC26_DATA,
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
  ratingGame = {},
  mysteryGame = {},
  hexGame = {},
  trumpsGame = {},
  xiDraft = {},
  online = {},
  computerTimer,
  ratingTimer,
  trumpsTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2500);
}

// ============================================================
// PROGRESSIVE-LIVE-VIEW-MANAGER
// Pages never remain blank while datasets are downloading.
// ============================================================

const progressiveLiveState = {

  career: {
    bootstrap: false,
    complete: false,
    loadedPlayers: 0,
    totalPlayers: 0,
    loadedChunks: 0,
    totalChunks: 0
  },

  fc26: {
    bootstrap: false,
    complete: false,
    loadedPlayers: 0,
    totalPlayers: 0,
    loadedChunks: 0,
    totalChunks: 0
  }

};


const progressiveCareerViews =
  new Set([
    "classicSetup",
    "classicGame",
    "countrySetup",
    "countryGame",
    "gridSetup",
    "grid",
    "twinSetup",
    "twinGame",
    "randomFiveSetup",
    "randomFiveGame",
    "hexSetup",
    "hexGame",
    "trumpsSetup",
    "trumpsGame",
    "compare",
    "catalog",
    "travelers",
    "onlineHostSettings"
  ]);


const progressiveFc26Views =
  new Set([
    "ratingSetup",
    "ratingGame",
    "mysterySetup",
    "mysteryGame",
    "xiDraftSetup",
    "xiDraft",
    "fcCatalog"
  ]);


const progressiveSetupViews =
  new Set([
    "classicSetup",
    "countrySetup",
    "gridSetup",
    "twinSetup",
    "randomFiveSetup",
    "hexSetup",
    "trumpsSetup",
    "ratingSetup",
    "mysterySetup",
    "xiDraftSetup",
    "onlineHostSettings"
  ]);


const progressiveFriendlyMessages = [
  "Kramponlar baglaniyor, birazdan sahadayiz.",
  "Scout ekibi son oyunculari getiriyor...",
  "Kulup kariyerleri hazirlaniyor, cok az kaldi.",
  "Soyunma odasindan son isimleri cagiriyoruz...",
  "Futbolcular sahaya cikiyor, bekledigine degecek.",
  "Veriler geliyor. Burada kal, oyun otomatik baslayacak.",
  "Son birkac pasi tamamliyoruz...",
  "Hakem dudugu calmak uzere."
];


let progressiveMessageIndex =
  0;


let progressiveMessageTimer =
  null;


let progressivePendingStart =
  null;


function progressiveRequirement(
  viewId
) {

  if (
    [
      "ratingSetup",
      "ratingGame",
      "mysterySetup",
      "mysteryGame",
      "fcCatalog",
      "xiDraftSetup",
      "xiDraftGame"
    ].includes(viewId)
  ) {
    return "fc26";
  }

  if (
    [
      "classicSetup",
      "countrySetup",
      "game",
      "grid",
      "twinSetup",
      "twinGame",
      "randomFiveSetup",
      "randomFiveGame",
      "hexSetup",
      "hexGame",
      "trumpsSetup",
      "trumpsGame",
      "catalog",
      "travelers",
      "compare",
      "onlineHostSettings"
    ].includes(viewId)
  ) {
    return "career";
  }

  return null;
}


function progressiveViewReady(
  viewId
) {

  const type =
    progressiveRequirement(
      viewId
    );

  if (!type) {
    return true;
  }

  const state =
    progressiveLiveState[type];


  /*
    Setup sayfaları metadata geldiği anda kullanılabilir.
  */

  if (
    progressiveSetupViews.has(viewId) ||
    viewId === "grid"
  ) {
    return (
      type === "career"
        ? state.bootstrap
        : true
    );
  }


  /*
    Listeleme ekranları ilk oyuncu chunk'ı ile açılır.
  */

  if (
    [
      "catalog",
      "travelers",
      "compare",
      "fcCatalog"
    ].includes(viewId)
  ) {
    return state.loadedPlayers > 0;
  }


  /*
    Turnuva 11 hem kariyer hem FC26 verisini kullanabilir.
  */

  if (
    viewId === "xiDraftGame"
  ) {
    return (
      progressiveLiveState.fc26.loadedPlayers >= 500 &&
      progressiveLiveState.career.loadedPlayers >= 700
    ) ||
    (
      progressiveLiveState.fc26.complete &&
      progressiveLiveState.career.complete
    );
  }


  /*
    FC26 oyunları ilk kullanılabilir havuz geldiğinde başlar.
  */

  if (
    [
      "ratingGame",
      "mysteryGame"
    ].includes(viewId)
  ) {
    return (
      state.loadedPlayers >= 400 ||
      state.complete
    );
  }


  /*
    Kariyer oyunları bütün 28 bin oyuncuyu beklemez.
    Yaklaşık 2-3 chunk yeterli olduğunda ilk deneme yapılır.
  */

  if (
    [
      "game",
      "twinGame",
      "randomFiveGame",
      "hexGame",
      "trumpsGame"
    ].includes(viewId)
  ) {
    return (
      state.loadedPlayers >= 1000 ||
      state.complete
    );
  }


  return state.bootstrap;
}


function progressivePercent(
  type
) {

  const state =
    progressiveLiveState[type];


  if (
    state.totalChunks > 0
  ) {

    return Math.min(
      100,
      Math.round(
        state.loadedChunks /
        state.totalChunks *
        100
      )
    );

  }


  return 0;

}



// ============================================================
// PARTIAL-RUNTIME-V3
// Games and lists use the players that have already arrived.
// ============================================================

let progressiveReplayBypass =
  false;

let progressiveReplayInFlight =
  false;

let progressivePendingStartMeta =
  null;

let progressiveRuntimeCareerCount =
  -1;

let progressiveRuntimeFc26Count =
  -1;


function progressiveHydrateRuntime(
  type,
  force = false
) {

  const loader =
    window.IkiFormaDataLoader;

  if (!loader) {
    return false;
  }


  if (
    type === "fc26"
  ) {

    const data =
      loader.state.fc26;

    if (!data) {
      return false;
    }

    const count =
      data.players?.length || 0;

    if (
      !force &&
      count === progressiveRuntimeFc26Count
    ) {
      return count > 0;
    }

    FC26_DATA =
      data;

    progressiveRuntimeFc26Count =
      count;

    return count > 0;

  }


  if (
    type === "career"
  ) {

    const data =
      loader.state.career;

    if (!data) {
      return false;
    }

    const count =
      data.players?.length || 0;

    if (
      !force &&
      count === progressiveRuntimeCareerCount
    ) {
      return count > 0;
    }


    DATA =
      data;

    clubs =
      Array.isArray(data.clubs)
        ? data.clubs
        : [];

    players =
      Array.isArray(data.players)
        ? data.players
        : [];


    clubMap =
      new Map(
        clubs.map(
          (club) => [
            club.id,
            club
          ]
        )
      );


    /*
      Build indexes only from currently available players.
      Rebuilt when another start/list action needs newer data.
    */

    indexes =
      IkiFormaCore.buildIndexes(
        DATA
      );


    clubPlayers =
      new Map();


    for (
      const club of clubs
    ) {
      clubPlayers.set(
        club.id,
        []
      );
    }


    for (
      const player of players
    ) {

      for (
        const id of player.clubIds || []
      ) {

        clubPlayers
          .get(id)
          ?.push(player);

      }

    }


    progressiveRuntimeCareerCount =
      count;


    /*
      Club metadata exists in bootstrap,
      so compare selectors can already work.
    */

    if (
      typeof renderCompareOptions ===
      "function"
    ) {

      renderCompareOptions();

    }


    return count > 0;

  }


  return false;

}


function progressiveStartRequirement(
  button
) {

  if (
    button.id ===
    "startXiDraft"
  ) {
    return "both";
  }


  if (
    [
      "startRatingGame",
      "startMysteryGame"
    ].includes(button.id)
  ) {
    return "fc26";
  }


  return "career";

}


function progressiveRequirementEnough(
  requirement
) {

  const careerReady =
    progressiveLiveState
      .career
      .loadedPlayers >= 1000 ||
    progressiveLiveState
      .career
      .complete;


  const fc26Ready =
    progressiveLiveState
      .fc26
      .loadedPlayers >= 400 ||
    progressiveLiveState
      .fc26
      .complete;


  if (
    requirement === "both"
  ) {
    return (
      progressiveLiveState
        .career
        .loadedPlayers >= 700 &&
      progressiveLiveState
        .fc26
        .loadedPlayers >= 500
    ) ||
    (
      progressiveLiveState
        .career
        .complete &&
      progressiveLiveState
        .fc26
        .complete
    );
  }


  return requirement === "fc26"
    ? fc26Ready
    : careerReady;

}


function progressiveHydrateRequirement(
  requirement
) {

  if (
    requirement === "career" ||
    requirement === "both"
  ) {
    progressiveHydrateRuntime(
      "career",
      true
    );
  }


  if (
    requirement === "fc26" ||
    requirement === "both"
  ) {
    progressiveHydrateRuntime(
      "fc26",
      true
    );
  }

}


function progressiveStartTarget(
  button
) {

  if (
    button.id === "startGrid"
  ) {
    return "grid";
  }

  if (
    button.id === "startTwin"
  ) {
    return "twinGame";
  }

  if (
    button.id === "startRandomFive"
  ) {
    return "randomFiveGame";
  }

  if (
    button.id === "startRatingGame"
  ) {
    return "ratingGame";
  }

  if (
    button.id === "startMysteryGame"
  ) {
    return "mysteryGame";
  }

  if (
    button.id === "startHexGame"
  ) {
    return "hexGame";
  }

  if (
    button.id === "startTrumpsGame"
  ) {
    return "trumpsGame";
  }

  if (
    button.id === "startXiDraft"
  ) {
    return "xiDraftGame";
  }


  /*
    Classic / Country setup use the shared game view.
  */

  if (
    button.classList.contains(
      "start"
    )
  ) {
    return "game";
  }


  return (
    button.closest(".view")?.id ||
    "home"
  );

}


function progressiveGameStarted(
  target
) {

  if (
    target === "grid"
  ) {
    return (
      document
        .getElementById(
          "gridGame"
        )
        ?.hidden === false
    );
  }


  const checks = {

    game:
      () =>
        Boolean(
          document
            .getElementById(
              "sideA"
            )
            ?.innerHTML
        ),

    twinGame:
      () =>
        Boolean(
          document
            .getElementById(
              "twinTarget"
            )
            ?.innerHTML
        ),

    randomFiveGame:
      () =>
        (
          document
            .getElementById(
              "randomFiveClubs"
            )
            ?.children
            ?.length || 0
        ) > 0,

    ratingGame:
      () =>
        (
          document
            .getElementById(
              "ratingChoices"
            )
            ?.children
            ?.length || 0
        ) > 0,

    mysteryGame:
      () =>
        (
          document
            .getElementById(
              "mysteryPhoto"
            )
            ?.children
            ?.length || 0
        ) > 0,

    hexGame:
      () =>
        (
          document
            .getElementById(
              "hexBoard"
            )
            ?.children
            ?.length || 0
        ) > 0,

    trumpsGame:
      () =>
        Boolean(
          document
            .getElementById(
              "trumpsCurrent"
            )
            ?.textContent
            ?.trim()
        ),

    xiDraftGame:
      () =>
        (
          document
            .getElementById(
              "xiCandidates"
            )
            ?.children
            ?.length || 0
        ) > 0 ||
        (
          document
            .getElementById(
              "xiSlots"
            )
            ?.children
            ?.length || 0
        ) > 0

  };


  return checks[target]
    ? checks[target]()
    : true;

}


function progressiveTryResumePendingStart() {

  if (
    !progressivePendingStart ||
    !progressivePendingStartMeta ||
    progressiveReplayInFlight
  ) {
    return;
  }


  const {
    requirement,
    target
  } =
    progressivePendingStartMeta;


  if (
    !progressiveRequirementEnough(
      requirement
    )
  ) {
    return;
  }


  const button =
    progressivePendingStart;


  progressiveHydrateRequirement(
    requirement
  );


  progressiveReplayInFlight =
    true;


  progressiveReplayBypass =
    true;


  try {

    button.click();

  }
  finally {

    progressiveReplayBypass =
      false;

  }


  setTimeout(
    () => {

      progressiveReplayInFlight =
        false;


      if (
        progressiveGameStarted(
          target
        )
      ) {

        progressivePendingStart =
          null;

        progressivePendingStartMeta =
          null;

        progressiveRemoveStatus(
          target
        );

        return;

      }


      /*
        The current partial data was not enough for the
        selected leagues/difficulty.

        Keep the game screen open and try again automatically
        when the next chunk arrives.
      */

      if (
        target !== "grid"
      ) {

        show(
          target,
          {
            history: false
          }
        );

      }


      progressiveShowStatus(
        target,
        true
      );

    },
    180
  );

}

function progressiveEnsureMessageTimer() {

  if (
    progressiveMessageTimer
  ) {

    return;

  }


  progressiveMessageTimer =
    setInterval(
      () => {

        progressiveMessageIndex =
          (
            progressiveMessageIndex +
            1
          ) %
          progressiveFriendlyMessages.length;


        document
          .querySelectorAll(
            ".progressive-wait-message"
          )
          .forEach(
            (element) => {

              element.textContent =
                progressiveFriendlyMessages[
                  progressiveMessageIndex
                ];

            }
          );

      },
      2400
    );

}


function progressiveRemoveStatus(
  viewId
) {

  document
    .getElementById(
      viewId
    )
    ?.querySelector(
      ".progressive-view-status"
    )
    ?.remove();

}


function progressiveShowStatus(
  viewId,
  force = false
) {

  const view =
    document.getElementById(
      viewId
    );


  if (!view) {

    return false;

  }


  const type =
    progressiveRequirement(
      viewId
    );


  if (!type) {

    return false;

  }


  if (
    !force &&
    progressiveViewReady(
      viewId
    )
  ) {

    progressiveRemoveStatus(
      viewId
    );

    return false;

  }


  let status =
    view.querySelector(
      ".progressive-view-status"
    );


  if (!status) {

    status =
      document.createElement(
        "section"
      );


    status.className =
      "progressive-view-status";


    status.innerHTML = `
      <div class="progressive-wait-card">
        <div class="progressive-ball" aria-hidden="true">âš½</div>

        <div>
          <strong>Hazirlaniyor...</strong>

          <p class="progressive-wait-message"></p>

          <div class="progressive-progress">
            <span></span>
          </div>

          <small class="progressive-wait-detail"></small>
        </div>
      </div>
    `;


    /*
      Do not replace an existing interface.
      Add the status panel to it.

      If the view is currently empty, this card itself becomes
      the visible interface instead of a blank page.
    */

    view.prepend(
      status
    );

  }


  const percent =
    progressivePercent(
      type
    );


  const state =
    progressiveLiveState[type];


  const message =
    status.querySelector(
      ".progressive-wait-message"
    );


  const bar =
    status.querySelector(
      ".progressive-progress span"
    );


  const detail =
    status.querySelector(
      ".progressive-wait-detail"
    );


  if (message) {

    message.textContent =
      progressiveFriendlyMessages[
        progressiveMessageIndex
      ];

  }


  if (bar) {

    bar.style.width =
      `${percent}%`;

  }


  if (detail) {

    if (
      state.totalPlayers
    ) {

      detail.textContent =
        `${state.loadedPlayers.toLocaleString("tr-TR")} / ` +
        `${state.totalPlayers.toLocaleString("tr-TR")} futbolcu ` +
        `hazir Â· %${percent}`;

    }
    else {

      detail.textContent =
        "Ilk veri paketi bekleniyor...";

    }

  }


  progressiveEnsureMessageTimer();


  return true;

}


function progressiveRefreshCurrentView() {

  const active =
    document.querySelector(
      ".view.active"
    );

  if (!active) {
    return;
  }


  const viewId =
    active.id;


  const type =
    progressiveRequirement(
      viewId
    );


  if (type) {
    progressiveHydrateRuntime(
      type
    );
  }


  if (
    !progressiveViewReady(
      viewId
    )
  ) {

    progressiveShowStatus(
      viewId
    );

    return;

  }


  progressiveRemoveStatus(
    viewId
  );


  if (
    viewId === "catalog"
  ) {

    progressiveHydrateRuntime(
      "career",
      true
    );

    renderCatalog(
      true
    );

  }


  if (
    viewId === "travelers"
  ) {

    progressiveHydrateRuntime(
      "career",
      true
    );

    renderTravelers();

  }


  if (
    viewId === "compare"
  ) {

    progressiveHydrateRuntime(
      "career",
      true
    );

    renderCompareOptions();

  }


  /*
    IMPORTANT:
    Do not call show(viewId) again here.

    The old implementation re-navigated the current page
    whenever data changed, causing mobile refresh-like behavior.
  */

}


window.addEventListener(
  "iki-forma-data-bootstrap",
  (event) => {

    const type =
      event.detail?.type;


    if (
      !progressiveLiveState[type]
    ) {

      return;

    }


    progressiveLiveState[type].bootstrap =
      true;


    progressiveLiveState[type].totalPlayers =
      event.detail?.manifest
        ?.totalPlayers || 0;


    progressiveLiveState[type].totalChunks =
      event.detail?.manifest
        ?.chunks
        ?.length || 0;


    setTimeout(
      progressiveRefreshCurrentView,
      0
    );

  }
);


window.addEventListener(
  "iki-forma-data-progress",
  (event) => {

    const type =
      event.detail?.type;


    if (
      !progressiveLiveState[type]
    ) {

      return;

    }


    Object.assign(
      progressiveLiveState[type],
      {

        bootstrap: true,

        loadedPlayers:
          event.detail.loadedPlayers || 0,

        totalPlayers:
          event.detail.totalPlayers || 0,

        loadedChunks:
          event.detail.loadedChunks || 0,

        totalChunks:
          event.detail.totalChunks || 0

      }
    );


    const active =
      document.querySelector(
        ".view.active"
      );


    if (active) {

      progressiveShowStatus(
        active.id
      );

    }


    /*
      FC26 catalog uses incoming chunks immediately.
    */

    if (
      type === "fc26" &&
      active?.id === "fcCatalog"
    ) {

      progressiveRefreshCurrentView();

    }

  }
);


window.addEventListener(
  "iki-forma-data-complete",
  (event) => {

    const type =
      event.detail?.type;


    if (
      !progressiveLiveState[type]
    ) {

      return;

    }


    progressiveLiveState[type].complete =
      true;


    progressiveLiveState[type].loadedPlayers =
      event.detail?.data
        ?.players
        ?.length || 0;


    progressiveLiveState[type].loadedChunks =
      progressiveLiveState[type]
        .totalChunks;


    progressiveRefreshCurrentView();

  }
);


window.addEventListener(
  "iki-forma-setup-shell-ready",
  () => {

    progressiveRefreshCurrentView();

  }
);


window.addEventListener(
  "iki-forma-ui-ready",
  () => {

    /*
      All original setup/index initialization has finished.
    */

    document
      .querySelectorAll(
        "[data-data-loading]"
      )
      .forEach(
        (button) => {

          button.disabled =
            false;

          delete button.dataset
            .dataLoading;

        }
      );


    progressiveRefreshCurrentView();


    /*
      If the user pressed Start while data was downloading,
      continue that exact action automatically.
    */

    if (
      progressivePendingStart
    ) {

      const button =
        progressivePendingStart;


      progressivePendingStart =
        null;


      setTimeout(
        () => {

          if (
            document.body.contains(
              button
            )
          ) {

            button.click();

          }

        },
        50
      );

    }

  }
);


/*
  PARTIAL-START-CAPTURE-V3

  Start button behavior:

  1. Game screen opens immediately.
  2. Friendly loading message appears there.
  3. Every arriving chunk triggers another readiness check.
  4. As soon as enough relevant data exists, the original
     start handler is replayed automatically.
*/

document.addEventListener(
  "click",
  (event) => {

    if (
      progressiveReplayBypass
    ) {
      return;
    }


    const button =
      event.target.closest(
        [
          ".view .start",
          "#startGrid",
          "#startTwin",
          "#startRandomFive",
          "#startRatingGame",
          "#startMysteryGame",
          "#startHexGame",
          "#startTrumpsGame",
          "#startXiDraft"
        ].join(",")
      );


    if (!button) {
      return;
    }


    const requirement =
      progressiveStartRequirement(
        button
      );


    /*
      Enough partial data already exists:
      hydrate globals and let the original handler execute now.
    */

    if (
      progressiveRequirementEnough(
        requirement
      )
    ) {

      progressiveHydrateRequirement(
        requirement
      );

      return;

    }


    event.preventDefault();

    event.stopImmediatePropagation();


    const target =
      progressiveStartTarget(
        button
      );


    progressivePendingStart =
      button;


    progressivePendingStartMeta = {
      requirement,
      target
    };


    /*
      Enter the actual game screen immediately.
    */

    if (
      target !== "grid"
    ) {

      show(
        target
      );

    }


    progressiveShowStatus(
      target,
      true
    );


    /*
      Maybe a chunk arrived between the click and this handler.
    */

    progressiveTryResumePendingStart();

  },
  true
);


/*
  Event-driven readiness.

  No 20-second polling loop and no manual restart:
  every arriving chunk instantly triggers a new check.
*/

window.addEventListener(
  "iki-forma-data-progress",
  () => {

    progressiveTryResumePendingStart();

    progressiveRefreshCurrentView();

  }
);


window.addEventListener(
  "iki-forma-data-complete",
  () => {

    progressiveTryResumePendingStart();

    progressiveRefreshCurrentView();

  }
);


let handlingPopState = false;
function show(id, options = {}) {

  clearInterval(timer);

  clearTimeout(ratingTimer);

  clearTimeout(trumpsTimer);

  if (
    id !== "grid"
  ) {
    clearTimeout(
      computerTimer
    );
  }


  $$(".view").forEach(
    (view) =>
      view.classList.toggle(
        "active",
        view.id === id
      )
  );


  scrollTo({
    top: 0,
    behavior:
      matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
        ? "auto"
        : "smooth",
  });


  const type =
    progressiveRequirement(
      id
    );


  if (
    type &&
    progressiveLiveState[type]
      .loadedPlayers > 0
  ) {

    progressiveHydrateRuntime(
      type
    );

  }


  const waiting =
    progressiveShowStatus(
      id
    );


  /*
    Never render an empty list just because the first chunk
    has not arrived yet.
  */

  if (
    id === "catalog" &&
    !waiting
  ) {

    progressiveHydrateRuntime(
      "career",
      true
    );

    renderCatalog(
      true
    );

  }


  if (
    id === "travelers" &&
    !waiting
  ) {

    progressiveHydrateRuntime(
      "career",
      true
    );

    renderTravelers();

  }


  if (
    id === "compare" &&
    !waiting
  ) {

    progressiveHydrateRuntime(
      "career",
      true
    );

    renderCompareOptions();

  }


  if (
    id === "grid" &&
    !waiting
  ) {

    progressiveHydrateRuntime(
      "career"
    );

    openGrid();

  }


  if (
    !handlingPopState &&
    options.history !== false &&
    history.state?.view !== id
  ) {

    history.pushState({ view: id }, "", `#${id}`);

  }

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
    if (event.target.matches?.(".rating-card-image img")) {
      const fallback = document.createElement("span");
      fallback.className = "avatar";
      fallback.textContent = event.target.parentElement.dataset.initials || "?";
      event.target.replaceWith(fallback);
    }
    if (event.target.matches?.(".mystery-photo img")) {
      const fallback = document.createElement("span");
      fallback.className = "mystery-silhouette";
      fallback.textContent = "?";
      event.target.replaceWith(fallback);
    }
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
  if (!root) return;
  const fieldset = root.querySelector(".league-options");
  if (!fieldset) return;
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
  ["classicSetup", "countrySetup", "grid", "twinSetup", "randomFiveSetup", "ratingSetup", "mysterySetup", "hexSetup", "trumpsSetup", "xiDraftSetup", "compare", "catalog", "travelers"]
    .forEach((view) => cards.get(view) && root.append(cards.get(view)));
}

function renderRatingRound() {
  if (ratingGame.round >= ratingGame.total) {
    $("#ratingRound").textContent = `Tur ${ratingGame.total}/${ratingGame.total}`;
    $("#ratingChoices").innerHTML = `<div class="rating-finish"><span>🏆</span><h2>Oyun bitti</h2><p>${ratingGame.total} düelloda ${ratingGame.score} doğru seçim yaptın.</p><button class="cta" data-view="ratingSetup">Tekrar oyna</button></div>`;
    $("#ratingMessage").textContent = "";
    return;
  }
  const pair = IkiFormaCore.generateRatingPair(ratingGame.pool, ratingGame.difficulty);
  if (!pair) {
    toast("Seçilen ligler ve zorluk için reyting çifti üretilemedi.");
    return show("ratingSetup");
  }
  ratingGame.pair = pair;
  ratingGame.round++;
  $("#ratingRound").textContent = `Tur ${ratingGame.round}/${ratingGame.total}`;
  $("#ratingScore").textContent = `Skor ${ratingGame.score}`;
  $("#ratingMessage").textContent = "Bir futbolcu seç.";
  $("#ratingChoices").innerHTML = pair.map((player) => `<button class="rating-player" data-rating-player="${player.eaId}" aria-label="${esc(player.name)} futbolcusunu seç"><span class="rating-card-image" data-initials="${esc(initials(player.name))}">${player.photoUrl ? `<img src="${esc(player.photoUrl)}" alt="${esc(player.name)} oyuncu fotoğrafı">` : `<span class="avatar">${esc(initials(player.name))}</span>`}</span><strong>${esc(player.name)}</strong><span>${esc(player.team || "Kulüp bilgisi yok")}</span><small>${esc(player.nation)} · ${esc([player.position, ...(player.alternativePositions || [])].join(" / "))}</small><b class="rating-value" hidden>${player.overall}</b></button>`).join("");
  $$("[data-rating-player]").forEach((button) => button.onclick = () => answerRating(+button.dataset.ratingPlayer));
}

function answerRating(selectedId) {
  if (ratingGame.answered) return;
  const result = IkiFormaCore.compareRatingPlayers(...ratingGame.pair, selectedId);
  if (!result) return;
  ratingGame.answered = true;
  ratingGame.score += result.isCorrect ? 1 : 0;
  $$("[data-rating-player]").forEach((button) => {
    button.disabled = true;
    button.querySelector(".rating-value").hidden = false;
    const id = +button.dataset.ratingPlayer;
    if (id === result.correctId) button.classList.add("correct");
    if (id === selectedId && !result.isCorrect) button.classList.add("wrong");
  });
  $("#ratingScore").textContent = `Skor ${ratingGame.score}`;
  $("#ratingMessage").textContent = result.isCorrect ? "✓ Doğru seçim!" : "✕ Yanlış seçim. Yüksek reytingli futbolcu işaretlendi.";
  ratingTimer = setTimeout(() => {
    ratingGame.answered = false;
    renderRatingRound();
  }, 1800);
}

function startRatingGame() {
  const selectedLeagues = new Set([...$$("#ratingLeagueOptions input:checked")].map((input) => input.value));
  const pool = FC26_DATA.players.filter((player) => !selectedLeagues.size || selectedLeagues.has(player.league));
  ratingGame = { total: +$("#ratingRounds").value, difficulty: $("#ratingDifficulty").value, round: 0, score: 0, answered: false, pool };
  show("ratingGame");
  renderRatingRound();
}

$("#startRatingGame").onclick = startRatingGame;

function setupFcLeagueSelector(selector) {
  const root = $(selector);
  if (!root) return;
  const priority = ["Premier League", "LALIGA EA SPORTS", "Serie A Enilive", "Ligue 1 McDonald's", "Bundesliga", "Trendyol Süper Lig"], priorityMeta = {
    "Premier League": ["GB", "İngiltere"], "LALIGA EA SPORTS": ["ES", "İspanya"], "Serie A Enilive": ["IT", "İtalya"], "Ligue 1 McDonald's": ["FR", "Fransa"], Bundesliga: ["DE", "Almanya"], "Trendyol Süper Lig": ["TR", "Türkiye"],
  };
  const careerLeagues = DATA.leagues || [], metadata = (name) => {
    if (priorityMeta[name]) return priorityMeta[name];
    const normalized = norm(name), match = careerLeagues.find((league) => norm(league.name) === normalized) || careerLeagues.find((league) => normalized.startsWith(norm(league.name)) || norm(league.name).startsWith(normalized));
    return match ? [match.countryCode, match.countryName] : ["", "FC 26 ligi"];
  };
  const leagues = [...new Set(FC26_DATA.players.map((player) => player.league).filter(Boolean))].sort((a, b) => {
    const rankA = priority.indexOf(a), rankB = priority.indexOf(b);
    if (rankA !== -1 || rankB !== -1) return (rankA === -1 ? priority.length : rankA) - (rankB === -1 ? priority.length : rankB);
    const [, countryA] = metadata(a), [, countryB] = metadata(b);
    return `${countryA}${a}`.localeCompare(`${countryB}${b}`, "tr");
  });
  const counts = new Map();
  for (const player of FC26_DATA.players) counts.set(player.league, (counts.get(player.league) || 0) + 1);
  root.insertAdjacentHTML("beforeend", `<div class="league-tools"><input type="search" placeholder="Lig veya ülke ara…" aria-label="FC 26 ligi veya ülkesi ara"><button type="button" class="secondary" data-fc-leagues="all">Tümünü seç</button><button type="button" class="secondary" data-fc-leagues="clear">Temizle</button></div><div class="league-list">${leagues.map((league) => { const [code, country] = metadata(league); return `<label data-search="${esc(norm(`${league} ${country}`))}"><input type="checkbox" value="${esc(league)}">${code ? `<img class="flag" src="${countryFlag(code)}" alt="" width="28" height="28" loading="lazy">` : `<span class="flag flag-fallback" aria-hidden="true">⚽</span>`}<span><b>${esc(league)}</b><small>${esc(country)} • ${counts.get(league).toLocaleString("tr-TR")} futbolcu</small></span></label>`; }).join("")}</div>`);
  const search = root.querySelector('input[type="search"]'), checks = () => [...root.querySelectorAll('.league-list input')], legendCount = root.querySelector("legend small"), update = () => { if (legendCount) legendCount.textContent = `${checks().filter((input) => input.checked).length} lig seçili • seçim yoksa tümü`; };
  search.oninput = () => root.querySelectorAll('.league-list label').forEach((label) => { label.hidden = !label.dataset.search.includes(norm(search.value)); });
  root.querySelector('[data-fc-leagues="all"]').onclick = () => { checks().filter((input) => !input.closest("label").hidden).forEach((input) => { input.checked = true; }); update(); };
  root.querySelector('[data-fc-leagues="clear"]').onclick = () => { checks().forEach((input) => { input.checked = false; }); update(); };
  checks().forEach((input) => { input.onchange = update; });
  update();
}

function mysteryArrow(value) {
  return value === "equal" || value === "exact"
    ? "✓"
    : value === "up"
      ? "↑"
      : value === "down"
        ? "↓"
        : "✕";
}

function nextMysteryPlayer() {
  if (mysteryGame.round >= mysteryGame.rounds) {
    $("#mysteryPhoto").innerHTML = `<div class="mystery-finish">🏆</div>`;
    $("#mysteryName").textContent = `Oyun bitti · ${mysteryGame.score}/${mysteryGame.rounds}`;
    $("#mysteryInput").closest(".answer-box").hidden = true;
    $("#mysteryMessage").textContent = "Gizli futbolcular tamamlandı.";
    $("#mysteryNext").hidden = true;
    return;
  }
  const available = mysteryGame.targetPool.filter((player) => !mysteryGame.used.has(player.eaId));
  if (!available.length) return toast("Seçilen liglerde yeni futbolcu kalmadı.");
  mysteryGame.target = available[Math.floor(Math.random() * available.length)];
  mysteryGame.used.add(mysteryGame.target.eaId);
  mysteryGame.round++;
  mysteryGame.guesses = [];
  $("#mysteryRound").textContent = `Futbolcu ${mysteryGame.round}/${mysteryGame.rounds}`;
  $("#mysteryRemaining").textContent = `${mysteryGame.attempts} tahmin`;
  $("#mysteryLeague").textContent = mysteryGame.target.league;
  $("#mysteryPhoto").innerHTML = `<img src="${esc(mysteryGame.target.photoUrl)}" alt="Gizli futbolcu fotoğrafı">`;
  $("#mysteryPhoto").classList.remove("revealed");
  $("#mysteryPhoto").style.setProperty("--mystery-blur", "20px");
  $("#mysteryName").textContent = "?";
  $("#mysteryHistory").innerHTML = "";
  $("#mysteryMessage").textContent = "Futbolcu adını yazıp listeden seç.";
  $("#mysteryNext").hidden = true;
  $("#mysteryInput").closest(".answer-box").hidden = false;
  $("#mysteryInput").disabled = false;
  $("#mysteryInput").value = "";
  $("#mysterySuggestions").innerHTML = "";
}

function finishMysteryPlayer(correct) {
  const target = mysteryGame.target;

  $("#mysteryPhoto").classList.add("revealed");
  $("#mysteryName").textContent = target.name;

  $("#mysteryInput").disabled = true;
  $("#mysterySuggestions").innerHTML = "";

  if (correct) {
    mysteryGame.score++;

    $("#mysteryMessage").innerHTML =
      `<strong class="mystery-correct-answer">\u2713 Do\u011fru!</strong> ` +
      `${mysteryGame.guesses.length}. tahminde buldun.`;
  } else {
    $("#mysteryMessage").innerHTML = `
      <span class="mystery-loss-title">
        Tahmin hakk\u0131n bitti. Do\u011fru cevap:
        <strong>${esc(target.name)}</strong>
      </span>

      <span class="mystery-answer-details">
        <span><small>\u00dclke</small><b>${esc(target.nation || "Bilinmiyor")}</b></span>
        <span><small>Tak\u0131m</small><b>${esc(target.team || "Bilinmiyor")}</b></span>
        <span><small>Lig</small><b>${esc(target.league || "Bilinmiyor")}</b></span>
        <span><small>Mevki</small><b>${esc(target.position || "Bilinmiyor")}</b></span>
        <span><small>Ya\u015f</small><b>${esc(target.age ?? "\u2014")}</b></span>
        <span><small>OVR</small><b>${esc(target.overall ?? "\u2014")}</b></span>
      </span>
    `;
  }

  $("#mysteryNext").textContent =
    mysteryGame.round >= mysteryGame.rounds
      ? "Sonucu g\u00f6r \u2192"
      : "Sonraki futbolcu \u2192";

  $("#mysteryNext").hidden = false;
}

function submitMysteryGuess(player) {
  if (!player || $("#mysteryInput").disabled || mysteryGame.guesses.some((guess) => guess.eaId === player.eaId)) return;
  const result = IkiFormaCore.evaluateMysteryGuess(mysteryGame.target, player);
  mysteryGame.guesses.push(player);
  const cell = (value, label) => `<span class="mystery-clue ${value === "exact" || value === "equal" ? "exact" : "wrong"}" title="${esc(label)}"><small>${esc(label)}</small><strong>${mysteryArrow(value)}</strong></span>`;
  $("#mysteryHistory").insertAdjacentHTML("beforeend", `<article class="mystery-row"><b>${esc(player.name)}</b>${cell(result.nation, player.nation)}${cell(result.team, player.team)}${cell(result.position, player.position)}${cell(result.age, String(player.age))}${cell(result.overall, String(player.overall))}</article>`);
  const remaining = mysteryGame.attempts - mysteryGame.guesses.length;
  $("#mysteryRemaining").textContent = `${remaining} tahmin`;
  $("#mysteryPhoto").style.setProperty("--mystery-blur", `${Math.max(5, 20 - mysteryGame.guesses.length * 2)}px`);
  $("#mysteryInput").value = "";
  $("#mysterySuggestions").innerHTML = "";
  if (result.correct || remaining <= 0) finishMysteryPlayer(result.correct);
}

function startMysteryGame() {
  const selectedLeagues = new Set([...$$("#mysteryLeagueOptions input:checked")].map((input) => input.value));
  const hasRealMysteryPhoto = (player) => {
    const url = String(player?.photoUrl || "").trim();
    if (!url) return false;

    const normalized = url.toLowerCase();

    return !(
      normalized.includes("default.jpg") ||
      normalized.includes("default.png") ||
      normalized.includes("placeholder") ||
      normalized.includes("no-photo") ||
      normalized.includes("no_photo") ||
      normalized.includes("nophoto") ||
      normalized.includes("silhouette")
    );
  };

  const pool = FC26_DATA.players.filter(
    (player) =>
      hasRealMysteryPhoto(player) &&
      player.age &&
      (!selectedLeagues.size || selectedLeagues.has(player.league))
  );
  const rounds = +$("#mysteryRounds").value;
  const difficulty = $("#mysteryDifficulty").value;
  const targetPool = IkiFormaCore.mysteryPlayersByRatingDifficulty(pool, difficulty);
  if (targetPool.length < rounds) return toast("Seçilen liglerde bu zorluk seviyesi için yeterli futbolcu bulunamadı.");
  mysteryGame = { pool, targetPool, difficulty, rounds, attempts: +$("#mysteryAttempts").value, round: 0, score: 0, used: new Set(), guesses: [] };
  $("#mysteryDifficultyLabel").textContent = difficulty === "easy" ? "Kolay · yüksek reyting" : difficulty === "hard" ? "Zor · düşük reyting" : "Normal · orta reyting";
  show("mysteryGame");
  nextMysteryPlayer();
}

$("#startMysteryGame").onclick = startMysteryGame;
$("#mysteryNext").onclick = nextMysteryPlayer;
$("#mysteryInput").oninput = (event) => {
  const query = norm(event.target.value);
  if (query.length < 2) return ($("#mysterySuggestions").innerHTML = "");
  const guessed = new Set(mysteryGame.guesses.map((player) => player.eaId));
  const hits = mysteryGame.pool.filter((player) => !guessed.has(player.eaId) && norm(player.name).includes(query)).slice(0, 9);
  $("#mysterySuggestions").innerHTML = hits.map((player) => `<button type="button" data-mystery-player="${player.eaId}"><span><b>${esc(player.name)}</b><small>${esc(player.team)} · ${esc(player.league)}</small></span></button>`).join("");
  $$("[data-mystery-player]").forEach((button) => button.onclick = () => submitMysteryGuess(mysteryGame.pool.find((player) => player.eaId === +button.dataset.mysteryPlayer)));
};
$("#mysteryInput").onkeydown = (event) => {
  if (event.key !== "Enter") return;
  const exact = mysteryGame.pool.find((player) => norm(player.name) === norm(event.target.value));
  if (exact) submitMysteryGuess(exact);
};

function hexCriterionHtml(criterion) {
  if (criterion.type === "club") {
    const club = clubMap.get(+criterion.value);
    return `${logo(club)}<b>${esc(club?.name || criterion.label)}</b><small>Kulüp</small>`;
  }
  const icons = { league: "🏆", nation: "🌍", birthDecade: "🎂", appearances: "👕", goals: "⚽", clubs: "🧳", nationalCaps: "🌐" };
  return `<span class="hex-icon">${icons[criterion.type] || "⬢"}</span><b>${esc(criterion.label)}</b><small>${esc(criterion.meta || "Kariyer")}</small>`;
}

function buildHexCriteria(pool, difficulty, selectedLeagues) {
  const criteria = [], used = new Set(), add = (criterion) => {
    const key = `${criterion.type}:${criterion.value}`;
    if (!used.has(key) && pool.filter((player) => IkiFormaCore.playerMatchesHexCriterion(player, criterion, clubMap)).length >= 8) { used.add(key); criteria.push(criterion); }
  };
  const poolIds = new Set(pool.map((player) => player.id));
  const allowedClubIds = new Set(clubs.filter((club) => !selectedLeagues.size || selectedLeagues.has(club.leagueId || `${club.country}:${club.league}`)).map((club) => club.id));
  const clubCandidates = clubs.filter((club) => allowedClubIds.has(club.id) && (clubPlayers.get(club.id) || []).some((player) => poolIds.has(player.id))).sort((a, b) => difficulty === "hard" ? (a.popularityScore || 0) - (b.popularityScore || 0) : (b.popularityScore || 0) - (a.popularityScore || 0));
  clubCandidates.slice(0, 13).forEach((club) => add({ type: "club", value: club.id, label: club.name }));
  const leagueMap = new Map();
  for (const club of clubs.filter((club) => allowedClubIds.has(club.id))) leagueMap.set(club.leagueId || club.league, club.league);
  [...leagueMap].slice(0, 6).forEach(([value, label]) => add({ type: "league", value, label, meta: "Lig kariyeri" }));
  const nations = new Map();
  for (const player of pool) if (player.nationalityCode) nations.set(player.nationalityCode, { label: player.nationality, count: (nations.get(player.nationalityCode)?.count || 0) + 1 });
  [...nations.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6).forEach(([value, item]) => add({ type: "nation", value, label: item.label, meta: "Milliyet" }));
  for (const decade of [1970, 1980, 1990, 2000]) add({ type: "birthDecade", value: decade, label: `${decade}'lerde doğdu`, meta: "Doğum dönemi" });
  const thresholds = difficulty === "easy" ? [["appearances", 100, "100+ maç"], ["goals", 25, "25+ gol"], ["clubs", 3, "3+ kulüp"], ["nationalCaps", 10, "10+ milli maç"]] : difficulty === "hard" ? [["appearances", 400, "400+ maç"], ["goals", 150, "150+ gol"], ["clubs", 7, "7+ kulüp"], ["nationalCaps", 60, "60+ milli maç"]] : [["appearances", 250, "250+ maç"], ["goals", 75, "75+ gol"], ["clubs", 5, "5+ kulüp"], ["nationalCaps", 30, "30+ milli maç"]];
  thresholds.forEach(([type, value, label]) => add({ type, value, label, meta: "Kariyer eşiği" }));
  for (const club of clubCandidates.slice(13)) { if (criteria.length >= 25) break; add({ type: "club", value: club.id, label: club.name }); }
  return criteria.sort(() => Math.random() - .5).slice(0, 25);
}

function renderHexBoard() {
  $("#hexBoard").innerHTML = Array.from({ length: 5 }, (_, row) => `<div class="hex-row">${hexGame.cells.filter((cell) => cell.r === row).map((cell) => `<button class="hex-cell ${cell.claimed ? "claimed" : ""} ${hexGame.selected?.id === cell.id ? "selected" : ""}" data-hex-cell="${cell.id}" style="--heat:${Math.min(cell.heat, 4)}">${hexCriterionHtml(cell.criterion)}${cell.claimed ? `<i>${cell.heat}</i>` : ""}</button>`).join("")}</div>`).join("");
  $$("[data-hex-cell]").forEach((button) => button.onclick = () => selectHexCell(+button.dataset.hexCell));
  $("#hexScore").textContent = `Skor ${hexGame.score}`;
  $("#hexProgress").textContent = `${hexGame.cells.filter((cell) => cell.claimed).length}/${hexGame.cells.length} hücre`;
}

function selectHexCell(id) {
  const cell = hexGame.cells.find((item) => item.id === id);
  if (!cell || cell.claimed) return;
  hexGame.selected = cell;
  $("#hexPrompt").textContent = cell.criterion.label;
  $("#hexDescription").textContent = "Bu koşulu sağlayan bir futbolcu seç. Uyan komşular da komboya katılır.";
  $("#hexInput").disabled = false;
  $("#hexInput").value = "";
  $("#hexInput").focus();
  $("#hexMessage").textContent = "";
  renderHexBoard();
}

function submitHexPlayer(player) {
  const selected = hexGame.selected;
  if (!selected || !player || hexGame.used.has(player.id)) return;
  if (!IkiFormaCore.playerMatchesHexCriterion(player, selected.criterion, clubMap)) {
    $("#hexMessage").textContent = `${player.name}, “${selected.criterion.label}” koşulunu sağlamıyor.`;
    return;
  }
  const affected = [selected, ...IkiFormaCore.hexNeighbors(hexGame.cells, selected)].filter((cell) => IkiFormaCore.playerMatchesHexCriterion(player, cell.criterion, clubMap));
  const newCells = affected.filter((cell) => !cell.claimed), reheated = affected.filter((cell) => cell.claimed);
  newCells.forEach((cell) => { cell.claimed = true; cell.heat = 1; cell.playerId = player.id; });
  reheated.forEach((cell) => { cell.heat++; });
  const gained = IkiFormaCore.scoreHexMove(newCells.length, reheated.length);
  hexGame.score += gained;
  hexGame.used.add(player.id);
  hexGame.selected = null;
  $("#hexInput").disabled = true;
  $("#hexInput").value = "";
  $("#hexSuggestions").innerHTML = "";
  $("#hexMessage").textContent = `${player.name}: ${newCells.length} yeni hücre, ${reheated.length} ısıtma · +${gained} puan`;
  $("#hexLastMove").innerHTML = `<b>${esc(player.name)}</b><small>${newCells.map((cell) => esc(cell.criterion.label)).join(" · ")}</small>`;
  renderHexBoard();
  if (hexGame.cells.every((cell) => cell.claimed)) $("#hexPrompt").textContent = `Petek tamamlandı! Skor ${hexGame.score}`;
}

function startHexGame() {
  const selectedLeagues = new Set([...$$("#hexLeagueOptions input:checked")].map((input) => input.value));
  const allowedClubIds = new Set(clubs.filter((club) => !selectedLeagues.size || selectedLeagues.has(club.leagueId || `${club.country}:${club.league}`)).map((club) => club.id));
  const pool = players.filter((player) => player.clubIds.some((id) => allowedClubIds.has(id)));
  const criteria = buildHexCriteria(pool, $("#hexDifficulty").value, selectedLeagues);
  if (criteria.length < 19) return toast("Seçilen liglerde yeterli ve güvenilir kategori üretilemedi.");
  const cells = criteria.map((criterion, index) => { const r = Math.floor(index / 5), column = index % 5; return { id: index, q: column - Math.floor(r / 2), r, criterion, claimed: false, heat: 0 }; });
  hexGame = { pool, cells, score: 0, selected: null, used: new Set() };
  show("hexGame");
  $("#hexPrompt").textContent = "Bir altıgen seç";
  $("#hexDescription").textContent = "Seçtiğin koşulu sağlayan bir futbolcu yaz.";
  $("#hexInput").disabled = true;
  $("#hexMessage").textContent = "";
  $("#hexLastMove").innerHTML = "";
  renderHexBoard();
}

$("#startHexGame").onclick = startHexGame;
$("#newHexGame").onclick = startHexGame;
$("#hexInput").oninput = (event) => {
  const query = norm(event.target.value);
  if (query.length < 2) return ($("#hexSuggestions").innerHTML = "");
  const hits = hexGame.pool.filter((player) => !hexGame.used.has(player.id) && norm(player.name).includes(query)).slice(0, 10);
  $("#hexSuggestions").innerHTML = hits.map((player) => `<button type="button" data-hex-player="${player.id}">${person(player)}<span><b>${esc(player.name)}</b><small>${esc(player.nationality || "")} · ${new Set(player.clubIds).size} kulüp</small></span></button>`).join("");
  $$("[data-hex-player]").forEach((button) => button.onclick = () => submitHexPlayer(indexes.playerById.get(+button.dataset.hexPlayer)));
};
$("#hexInput").onkeydown = (event) => { if (event.key === "Enter") { const player = hexGame.pool.find((item) => norm(item.name) === norm(event.target.value)); if (player) submitHexPlayer(player); } };

function trumpClub(player) {
  const currentCareer = (player.careers || []).find((career) => !career.endDate) || (player.careers || [])[0];
  return clubMap.get(+currentCareer?.clubId) || clubMap.get(+(player.clubIds || [])[0]);
}

function renderTrumpCard(player, hidden = false, revealed = false) {
  const club = trumpClub(player);
  const concealed = hidden && !revealed;
  return `<div class="trump-player">${person(player)}<div><small>${esc(player.nationality || "")}</small><h2>${esc(player.name)}</h2><span>${esc(club?.name || "Kulüp bilgisi yok")}</span></div>${club ? logo(club) : ""}</div><div class="trump-metrics ${concealed ? "concealed" : ""}">${IkiFormaCore.TRUMP_METRICS.map((metric) => `<button type="button" ${concealed ? "" : `data-trump-metric="${metric.key}"`} ${concealed || revealed ? "disabled" : ""}><strong>${concealed ? "?" : IkiFormaCore.trumpMetricValue(player, metric.key).toLocaleString("tr-TR")}</strong><span>${metric.label}</span></button>`).join("")}</div>${concealed ? `<p class="trump-hidden-note">İstatistikler seçimden sonra açılır</p>` : ""}`;
}

function renderTrumpsRound() {
  const current = trumpsGame.pack[trumpsGame.index], next = trumpsGame.pack[trumpsGame.index + 1];
  $("#trumpsCurrent").innerHTML = renderTrumpCard(current);
  $("#trumpsNext").innerHTML = renderTrumpCard(next, true);
  $("#trumpsNext").classList.add("hidden-card");
  $("#trumpsProgress").textContent = `Kart ${trumpsGame.index + 1}/${trumpsGame.pack.length}`;
  $("#trumpsCards").textContent = `${trumpsGame.pack.length - trumpsGame.index - 1} rakip kart`;
  $("#trumpsMessage").textContent = "Açık karttan güçlü olduğunu düşündüğün metriği seç.";
  $("#trumpsYellow").textContent = `🟨 ${Math.min(trumpsGame.errors, 1)}`;
  $("#trumpsRed").textContent = `🟥 ${trumpsGame.errors >= 2 ? 1 : 0}`;
  $$("[data-trump-metric]").forEach((button) => button.onclick = () => playTrumpMetric(button.dataset.trumpMetric));
}

function finishTrumps(won) {
  $("#trumpsMessage").textContent = won ? `🏆 Paketin tamamını açtın! ${trumpsGame.pack.length} karta ulaştın.` : `🟥 İkinci hata: oyun bitti. ${trumpsGame.index + 1} kart ilerledin.`;
  $("#restartTrumps").hidden = false;
  $$("[data-trump-metric]").forEach((button) => { button.disabled = true; });
}

function playTrumpMetric(key) {
  if (trumpsGame.resolving) return;
  trumpsGame.resolving = true;
  const current = trumpsGame.pack[trumpsGame.index], next = trumpsGame.pack[trumpsGame.index + 1], comparison = IkiFormaCore.compareTrumpStat(current, next, key), metric = IkiFormaCore.TRUMP_METRICS.find((item) => item.key === key);
  $("#trumpsNext").innerHTML = renderTrumpCard(next, false, true);
  $("#trumpsNext").classList.remove("hidden-card");
  $$("[data-trump-metric]").forEach((button) => { button.disabled = true; if (button.dataset.trumpMetric === key) button.classList.add(comparison.correct ? "winner" : "loser"); });
  if (!comparison.correct) trumpsGame.errors++;
  $("#trumpsYellow").textContent = `🟨 ${Math.min(trumpsGame.errors, 1)}`;
  $("#trumpsRed").textContent = `🟥 ${trumpsGame.errors >= 2 ? 1 : 0}`;
  $("#trumpsMessage").textContent = comparison.correct ? `✓ ${metric.label}: ${comparison.currentValue.toLocaleString("tr-TR")} ≥ ${comparison.nextValue.toLocaleString("tr-TR")}` : `✕ ${metric.label}: ${comparison.currentValue.toLocaleString("tr-TR")} < ${comparison.nextValue.toLocaleString("tr-TR")}`;
  trumpsTimer = setTimeout(() => {
    if (trumpsGame.errors >= 2) return finishTrumps(false);
    trumpsGame.index++;
    if (trumpsGame.index >= trumpsGame.pack.length - 1) return finishTrumps(true);
    trumpsGame.resolving = false;
    renderTrumpsRound();
  }, 1900);
}

function startTrumpsGame() {
  const selectedLeagues = new Set([...$$("#trumpsLeagueOptions input:checked")].map((input) => input.value));
  const allowedClubIds = new Set(clubs.filter((club) => !selectedLeagues.size || selectedLeagues.has(club.leagueId || `${club.country}:${club.league}`)).map((club) => club.id));
  const pool = players.filter((player) => player.statisticsComplete && [player.appearances, player.goals, player.assists, player.nationalCaps].every((value) => value !== null && value !== undefined && Number.isFinite(Number(value))) && player.clubIds.some((id) => allowedClubIds.has(id)));
  const size = +$("#trumpsPackSize").value;
  if (pool.length < size) return toast("Seçilen liglerde paket için yeterli doğrulanmış futbolcu yok.");
  trumpsGame = { pack: [...pool].sort(() => Math.random() - .5).slice(0, size), index: 0, errors: 0, resolving: false };
  show("trumpsGame");
  $("#restartTrumps").hidden = true;
  renderTrumpsRound();
}

$("#startTrumpsGame").onclick = startTrumpsGame;
$("#restartTrumps").onclick = startTrumpsGame;

function xiAverage() {
  return xiDraft.selected.length ? xiDraft.selected.reduce((sum, player) => sum + player.overall, 0) / xiDraft.selected.length : 0;
}

function renderXiSlots() {
  $("#xiSlots").innerHTML = IkiFormaCore.XI_SLOTS.map((slot, index) => {
    const player = xiDraft.selected[index];
    return `<article class="xi-slot slot-${index} ${player ? "filled" : index === xiDraft.index ? "active" : ""}">${player ? `<img src="${esc(player.photoUrl)}" alt=""><b>${esc(player.name)}</b><span>${player.overall}</span>` : `<strong>${slot}</strong><small>${index === xiDraft.index ? "Seçiliyor" : "Boş"}</small>`}</article>`;
  }).join("");
  $("#xiDraftProgress").textContent = `${xiDraft.selected.length}/11 futbolcu`;
  $("#xiDraftAverage").textContent = xiDraft.selected.length ? `Ort. ${xiAverage().toFixed(1)}` : "Ort. —";
}

function xiTargetRating() {
  return xiDraft.difficulty === "easy" ? 86 : xiDraft.difficulty === "hard" ? 80 : 83;
}

function xiCandidateChoices(slot) {
  const used = new Set(xiDraft.selected.map((player) => player.eaId));
  const eligible = xiDraft.pool
    .filter((player) => !used.has(player.eaId) && IkiFormaCore.playerFitsXiSlot(player, slot))
    .sort((a, b) => Number(b.overall) - Number(a.overall));

  if (xiDraft.selectionMode === "luck") {
    return IkiFormaCore.generateXiLuckChoices(eligible, xiDraft.difficulty);
  }
  if (eligible.length < 3) return [];

  // Klasik seçimde her tur en az bir gerçekten güçlü aday garanti edilir.
  // Kolay: mevkinin en iyi oyuncusu doğrudan adaydır.
  // Normal: ilk 5'ten biri. Zor: ilk 12'den biri.
  const eliteWindow = xiDraft.difficulty === "easy" ? 1 : xiDraft.difficulty === "hard" ? 12 : 5;
  const elitePool = eligible.slice(0, Math.min(eliteWindow, eligible.length));
  const elite = elitePool[Math.floor(Math.random() * elitePool.length)] || eligible[0];
  const remaining = eligible.filter((player) => player.eaId !== elite.eaId);

  const target = xiTargetRating();
  const qualityPool = remaining.filter((player) => Number(player.overall) >= target - (xiDraft.difficulty === "easy" ? 5 : 8));
  const middleSource = qualityPool.length ? qualityPool : remaining.slice(0, Math.min(30, remaining.length));
  const second = middleSource[Math.floor(Math.random() * middleSource.length)];
  const thirdSource = remaining.filter((player) => player.eaId !== second?.eaId);
  const thirdStart = xiDraft.difficulty === "easy" ? 0 : xiDraft.difficulty === "normal" ? Math.floor(thirdSource.length * .2) : Math.floor(thirdSource.length * .35);
  const thirdPool = thirdSource.slice(Math.min(thirdStart, Math.max(0, thirdSource.length - 1)));
  const third = (thirdPool.length ? thirdPool : thirdSource)[Math.floor(Math.random() * Math.max(1, (thirdPool.length ? thirdPool : thirdSource).length))];

  return [elite, second, third].filter(Boolean).sort(() => Math.random() - .5);
}

function renderXiCandidates(revealed = false, selectedIndex = -1) {
  const luck = xiDraft.selectionMode === "luck";
  $("#xiCandidates").classList.toggle("luck-mode", luck);
  $("#xiCandidates").classList.toggle("revealed", revealed);
  $("#xiCandidates").innerHTML = xiDraft.currentChoices.map((player, index) => {
    if (luck && !revealed) {
      return `<button type="button" class="xi-luck-box" data-xi-choice="${index}" aria-label="${index + 1}. şans kutusunu aç"><span class="box-lid">?</span><b>${index + 1}. Kutu</b><small>Açmak için seç</small></button>`;
    }
    const selected = index === selectedIndex;
    const best = revealed && player.overall === Math.max(...xiDraft.currentChoices.map((item) => item.overall));
    return `<button type="button" data-xi-choice="${index}" class="${selected ? "selected" : ""} ${best ? "best" : ""}" ${revealed ? "disabled" : ""}><img src="${esc(player.photoUrl)}" alt="${esc(player.name)}"><span><b>${esc(player.name)}</b><small>${esc(player.team)} · ${esc([player.position, ...(player.alternativePositions || [])].join(" / "))}</small></span><strong class="xi-rating" ${revealed ? "" : "hidden"}>${player.overall}</strong>${selected && revealed ? `<em>Seçtin</em>` : best ? `<em>En yüksek</em>` : ""}</button>`;
  }).join("");
  if (!revealed) $$('[data-xi-choice]').forEach((button) => button.onclick = () => revealXiChoice(+button.dataset.xiChoice));
}

function renderXiLuckFirstReveal(choiceIndex) {
  const player = xiDraft.currentChoices[choiceIndex];
  if (!player) return;
  xiDraft.luckFirstChoice = choiceIndex;
  $("#xiCandidates").classList.add("luck-mode", "revealed");
  $("#xiCandidates").innerHTML = `
    <div class="xi-luck-decision">
      <div class="xi-luck-player-preview">
        <img src="${esc(player.photoUrl)}" alt="${esc(player.name)}">
        <div><b>${esc(player.name)}</b><small>${esc(player.team)} · ${esc([player.position, ...(player.alternativePositions || [])].join(" / "))}</small></div>
      </div>
      <p>Bu oyuncuyu kadroda tutmak ister misin? Reyting, kararından sonra gösterilecek.</p>
      <div class="xi-luck-actions">
        <button type="button" class="cta" id="xiLuckKeep">Kadromda kalsın</button>
        <button type="button" class="secondary" id="xiLuckSwap">Değiştir · kalan 4 kutu</button>
      </div>
    </div>`;
  $("#xiPickHelp").textContent = "İlk kutuyu açtın. Oyuncuyu tutabilir veya kalan dört kutudan birini seçebilirsin.";
  $("#xiLuckKeep").onclick = () => confirmXiChoice(choiceIndex);
  $("#xiLuckSwap").onclick = () => renderXiRemainingLuckBoxes(choiceIndex);
}

function renderXiRemainingLuckBoxes(firstChoiceIndex) {
  $("#xiCandidates").classList.remove("revealed");
  $("#xiCandidates").innerHTML = xiDraft.currentChoices.map((player, index) => {
    if (index === firstChoiceIndex) return "";
    return `<button type="button" class="xi-luck-box" data-xi-final-choice="${index}" aria-label="${index + 1}. kutuyu seç"><span class="box-lid">?</span><b>${index + 1}. Kutu</b><small>Son seçim</small></button>`;
  }).join("");
  $("#xiPickHelp").textContent = "Kalan dört kutudan birini seç. Bu ikinci seçim kesin olacak.";
  $$('[data-xi-final-choice]').forEach((button) => button.onclick = () => confirmXiChoice(+button.dataset.xiFinalChoice));
}

function confirmXiChoice(choiceIndex) {
  if (xiDraft.resolving) return;
  const player = xiDraft.currentChoices[choiceIndex];
  if (!player) return;
  xiDraft.resolving = true;
  xiDraft.selected.push(player);
  renderXiSlots();
  renderXiCandidates(true, choiceIndex);
  const best = Math.max(...xiDraft.currentChoices.map((item) => item.overall));
  $("#xiPickHelp").textContent = player.overall === best
    ? `${player.name} seçildi · ${player.overall} overall · bu turun en yüksek reytingi.`
    : `${player.name} seçildi · ${player.overall} overall. Bu turun en yüksek seçeneği ${best} idi.`;
  $("#xiNextPick").textContent = xiDraft.index + 1 >= IkiFormaCore.XI_SLOTS.length ? "Turnuva sonucunu gör →" : "Sonraki mevki →";
  $("#xiNextPick").hidden = false;
}

function revealXiChoice(choiceIndex) {
  if (xiDraft.resolving) return;
  if (xiDraft.selectionMode === "luck" && xiDraft.currentChoices.length === 5 && xiDraft.luckFirstChoice === undefined) {
    renderXiLuckFirstReveal(choiceIndex);
    return;
  }
  confirmXiChoice(choiceIndex);
}

function advanceXiPick() {
  if (!xiDraft.resolving) return;
  xiDraft.index++;
  xiDraft.resolving = false;
  xiDraft.currentChoices = null;
  xiDraft.luckFirstChoice = undefined;
  $("#xiNextPick").hidden = true;
  renderXiPick();
}

function renderXiPick() {
  renderXiSlots();
  if (xiDraft.index >= IkiFormaCore.XI_SLOTS.length) return finishXiDraft();
  const slot = IkiFormaCore.XI_SLOTS[xiDraft.index], choices = xiCandidateChoices(slot), needed = xiDraft.selectionMode === "luck" ? 5 : 3;
  if (choices.length < needed) {
    toast(`${slot} mevkii için yeterli güncel oyuncu bulunamadı.`);
    return show("xiDraftSetup");
  }
  xiDraft.currentChoices = choices;
  $("#xiPickTitle").textContent = xiDraft.selectionMode === "luck" ? `${slot} için bir kutu aç` : `${slot} için futbolcu seç`;
  $("#xiPickHelp").textContent = xiDraft.selectionMode === "luck" ? "Bir kutu aç. İlk oyuncuyu reytingsiz gör; istersen tut, istersen kalan dört kutudan birini son kez seç." : "Futbolcuları kariyer bilgisine göre seç; reytingler seçimin ardından açılır.";
  renderXiCandidates();
}

function finishXiDraft() {
  const average = xiAverage(), simulation = IkiFormaCore.simulateXiTournament({ averageRating: average, difficulty: xiDraft.difficulty, tournament: xiDraft.tournament });
  $("#xiOutcome").textContent = simulation.outcome;
  $("#xiResultSummary").textContent = `${xiDraft.tournament === "worldCup" ? `${xiDraft.nation} · ` : ""}Takım overall ortalaması ${average.toFixed(1)} · ${simulation.matches} maçlık senaryo · ${xiDraft.difficulty === "easy" ? "Kolay" : xiDraft.difficulty === "hard" ? "Zor" : "Normal"} seviye`;
  const resultText = { win: "Galibiyet", draw: "Beraberlik", loss: "Mağlubiyet" };
  $("#xiTimeline").innerHTML = simulation.stages.map((item) => `<article class="${item.result}"><b>${esc(item.stage)}</b><span>${esc(resultText[item.result] || item.result)}</span></article>`).join("");
  show("xiTournamentResult");
}

function viableWorldCupNations(pool, optionCount) {
  const byNation = new Map();
  for (const player of pool) { if (!byNation.has(player.nation)) byNation.set(player.nation, []); byNation.get(player.nation).push(player); }
  return [...byNation].filter(([, nationPool]) => hasXiDraftCoverage(nationPool, optionCount)).map(([nation]) => nation).sort((a, b) => a.localeCompare(b, "tr"));
}

function hasXiDraftCoverage(pool, optionCount = 3) {
  const occurrences = IkiFormaCore.XI_SLOTS.reduce((counts, slot) => ({ ...counts, [slot]: (counts[slot] || 0) + 1 }), {});
  return Object.entries(occurrences).every(([slot, count]) => pool.filter((player) => IkiFormaCore.playerFitsXiSlot(player, slot)).length >= count + optionCount - 1);
}

function startXiDraft() {
  const tournament = $("#xiTournament").value, selectionMode = $("#xiSelectionMode").value, optionCount = selectionMode === "luck" ? 5 : 3, selectedLeagues = new Set([...$$("#xiLeagueOptions input:checked")].map((input) => input.value));
  const allowedClubs = clubs.filter((club) => !selectedLeagues.size || selectedLeagues.has(club.leagueId || `${club.country}:${club.league}`)), allowedClubIds = new Set(allowedClubs.map((club) => club.id)), allowedLeagueNames = new Set(allowedClubs.map((club) => club.league));
  let pool = FC26_DATA.players.filter((player) => player.gender === "M" && (!selectedLeagues.size || allowedLeagueNames.has(player.league) || (player.careerClubIds || []).some((id) => allowedClubIds.has(+id))));
  let nation = "";
  if (tournament === "worldCup") {
    const viable = viableWorldCupNations(pool, optionCount), requested = $("#xiNation").value;
    nation = requested && viable.includes(requested) ? requested : viable[Math.floor(Math.random() * viable.length)];
    if (!nation) return toast("Seçilen lig filtresiyle mevkilere uygun millî takım üretilemedi.");
    pool = pool.filter((player) => player.nation === nation);
  }
  if (!IkiFormaCore.XI_SLOTS.every((slot) => pool.filter((player) => IkiFormaCore.playerFitsXiSlot(player, slot)).length >= 3)) return toast("Bu filtreyle her mevki için üç güncel FC 26 adayı üretilemiyor.");
  if (!hasXiDraftCoverage(pool, optionCount)) return toast(`Bu filtreyle 4-3-3 kadrosunun her seçiminde ${optionCount} güncel FC 26 adayı üretilemiyor.`);
  xiDraft = { tournament, selectionMode, difficulty: $("#xiDifficulty").value, nation, pool, selected: [], index: 0, resolving: false, currentChoices: null, luckFirstChoice: undefined };
  show("xiDraftGame");
  renderXiPick();
}

$("#startXiDraft").onclick = startXiDraft;
$("#xiNextPick").onclick = advanceXiPick;
$("#xiTournament").onchange = () => { $("#xiNationWrap").hidden = $("#xiTournament").value !== "worldCup"; };
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

function openOnlineHub() {
  openSpecialOnlineLobby({ gameType: "clubs", rounds: 5, seconds: 30, difficulty: "normal", answerMethod: "multiple", optionCount: 4, repeatPlayers: true, leagueIds: [] });
}

function saveOnlineSession() {
  localStorage.setItem("iki-forma-online-session", JSON.stringify({ code: online.state.roomCode, token: online.token, playerIndex: online.playerIndex }));
}
function onlineGamePlayers(state = online.state) { return state?.status !== "waiting" && state?.matchPlayers?.length ? state.matchPlayers : state?.players || []; }
function onlineMatchIndex(state = online.state) {
  const list = onlineGamePlayers(state), found = list.findIndex((player) => +(player.roomSlot ?? -1) === +online.playerIndex);
  return found >= 0 ? found : state?.matchPlayers?.length ? -1 : online.playerIndex;
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
  const saved = localStorage.getItem("iki-forma-online-session");
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
    localStorage.removeItem("iki-forma-online-session");
    return false;
  }
}

function renderOnlineLobby() {
  const state = online.state;
  if (!state) return;
  if (state.status !== "playing") show("onlineLobby");
  $("#onlineEntry").hidden = true; $("#onlineRoomState").hidden = false;
  $("#onlineRoomCode").textContent = state.roomCode;
  const matchPlayers = onlineGamePlayers(state), readyCount = state.players.filter((player) => player.ready).length;
  $("#onlinePlayers").innerHTML = state.players.map((player, index) => `<article class="online-player ${player.connected ? "is-connected" : ""}"><b>${esc(player.name)} ${player.host ? "👑" : ""}</b><small>Oyuncu ${index + 1} · ${player.connected ? "Bağlı" : "Yeniden bağlanıyor"}</small><span>${state.status === "playing" ? (matchPlayers.some((active) => +(active.roomSlot ?? index) === index) ? "● Oyunda" : "○ Bu maçı izliyor") : player.ready ? "✓ Hazır" : "Bekleniyor"}</span></article>`).join("");
  $("#onlineTurn").textContent = state.status === "playing" ? `${Object.keys(state.roundAnswers || {}).length}/${matchPlayers.length} cevap` : `${readyCount} oyuncu hazır`;
  $("#onlineScore").textContent = state.status === "playing"
    ? matchPlayers.map((player, index) => `${player.name}: ${state.scores[index] || 0}`).join(" · ")
    : state.players.map((player, index) => `${player.name}: ${(state.totalScores || state.scores)[index] || 0}`).join(" · ");
  const me = state.players[online.playerIndex];
  $("#onlineReady").textContent = me?.ready ? "Hazır değilim" : "Hazırım";
  $("#onlineReady").hidden = !["waiting", "finished"].includes(state.status);
  $("#onlineStart").hidden = online.playerIndex !== 0 || !["waiting", "finished"].includes(state.status);
  $("#onlineStart").disabled = readyCount < 2 || !me?.ready;
  $("#onlineHostSettings").hidden = online.playerIndex !== 0 || !["waiting", "finished"].includes(state.status);
  if (online.playerIndex === 0 && state.settings) {
    $("#onlineGameType").value = state.settings.gameType || "clubs"; $("#onlineRounds").value = state.settings.rounds || 5;
    $("#onlineSeconds").value = state.settings.seconds || 30; $("#onlineDifficulty").value = state.settings.difficulty || "normal"; $("#onlineAnswerMethod").value = state.settings.answerMethod || "multiple";
    $("#onlineGridType").value = state.settings.gridType || "mixed"; updateOnlineGridTypeVisibility();
    if (!online.leagueSelectionDirty) {
      const selectedLeagues = new Set(state.settings.leagueIds || []);
      $$("#onlineHostSettings .league-options input[type=checkbox]").forEach((input) => { input.checked = selectedLeagues.has(input.value); input.onchange?.(); });
    }
  }
  const ranking = state.status === "finished"
    ? state.players.map((player, index) => ({ name: player.name, score: +((state.totalScores || state.scores)[index] || 0) }))
    : matchPlayers.map((player, index) => ({ name: player.name, score: state.scores[index] || 0 }));
  ranking.sort((a, b) => b.score - a.score);
  $("#onlineRanking").hidden = state.status !== "finished";
  $("#onlineRanking").innerHTML = state.status === "finished" ? `<h3>🏆 Oyun sıralaması</h3>${ranking.map((row, index) => `<p><b>${index + 1}. ${esc(row.name)}</b><span>${row.score} puan</span></p>`).join("")}` : "";
  $("#onlineLobbyMessage").textContent = state.status === "playing" ? "Oyun başladı; herkes kendi cevabını veriyor…" : state.status === "finished" ? "Oda açık. Oda sahibi aynı oyunu başlatabilir veya yeni oyun seçebilir; herkes yeniden hazır olmalıdır." : state.players.length > 1 ? "Tüm oyuncular hazır olduğunda oda sahibi oyunu başlatabilir." : "Oda kodunu arkadaşlarınızla paylaşın (en fazla 5 oyuncu).";
  if (state.status === "playing" && onlineMatchIndex(state) >= 0) handleOnlineState();
  else if (state.status === "playing") { show("onlineLobby"); $("#onlineLobbyMessage").textContent = "Bu maçta hazır olmadığınız için izleyicisiniz. Sonraki oyun için odada kalabilirsiniz."; }
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
async function returnToOnlineRoom(event) {
  if (!online.state || online.state.status !== "playing" || onlineMatchIndex() < 0) return;
  event?.preventDefault(); event?.stopPropagation();
  const state = await mutateOnline({ type: "leave_match" });
  if (state) { show("onlineLobby"); renderOnlineLobby(); }
}
$$('.online-room-return').forEach((button) => button.addEventListener("click", returnToOnlineRoom));

$("#createOnlineRoom").onclick = () => connectOnlineRoom("create");
$("#joinOnlineRoom").onclick = () => connectOnlineRoom("join");
$("#openOnlineHub").onclick = openOnlineHub;
$("#openOnlineHome").onclick = openOnlineHub;
$("#copyRoomCode").onclick = async () => { await navigator.clipboard.writeText(online.state.roomCode); toast("Oda kodu kopyalandı."); };
$("#onlineReady").onclick = () => mutateOnline({ type: "ready", ready: !online.state.players[online.playerIndex].ready });
function updateOnlineGridTypeVisibility() { $("#onlineGridTypeWrap").hidden = $("#onlineGameType").value !== "grid"; }
$("#onlineGameType").onchange = updateOnlineGridTypeVisibility;
$("#onlineApplySettings").onclick = async () => {
  const settings = { gameType: $("#onlineGameType").value, gridType: $("#onlineGridType").value, rounds: +$("#onlineRounds").value, seconds: +$("#onlineSeconds").value, difficulty: $("#onlineDifficulty").value, answerMethod: $("#onlineAnswerMethod").value, optionCount: 4, repeatPlayers: true, leagueIds: $$("#onlineHostSettings .league-options input:checked").map((input) => input.value) };
  settings.lastModeState = online.state.settings?.lastModeState || null;
  settings.randomFiveHistory = online.state.settings?.randomFiveHistory || [];
  const selectedLeagues = new Set(settings.leagueIds), allowedClubIds = new Set(clubs.filter((club) => !selectedLeagues.size || selectedLeagues.has(club.leagueId || `${club.country}:${club.league}`)).map((club) => club.id));
  if (settings.gameType === "grid") {
    const board = generateGrid(selectedLeagues, settings.gridType), initialState = IkiFormaCore.createGridState({ mode: "duo", difficulty: settings.difficulty, names: online.state.players.map((player) => player.name) });
    if (!board) return toast("Bu ayarlarla geçerli ızgara üretilemedi."); initialState.grid = board; initialState.answerMethod = settings.answerMethod; settings.initialState = initialState;
  }
  if (settings.gameType === "randomFive") {
    const allowedClubs = clubs.filter((club) => club.active !== false && allowedClubIds.has(club.id)), pool = players.filter((player) => player.clubIds.some((id) => allowedClubIds.has(id))), sets = Array.from({ length: settings.rounds }, () => buildRandomFiveSet(allowedClubs, pool));
    settings.initialState = { difficulty: settings.difficulty, answerMethod: settings.answerMethod, scores: online.state.players.map(() => 0), round: 0, guesses: [], guessIds: {}, revealUntil: null, setIds: sets.map((set) => set.map((club) => club.id)), choiceIds: buildRandomFiveChoiceIds(sets, pool, settings.difficulty) };
  }
  if (settings.gameType === "twin") {
    const pool = twinPool().filter((player) => player.clubIds.some((id) => allowedClubIds.has(id))), targets = pool.filter((player) => player.appearances >= 200 && player.goals >= 15).sort(() => Math.random() - .5).slice(0, settings.rounds);
    settings.initialState = { difficulty: settings.difficulty, answerMethod: settings.answerMethod, scores: online.state.players.map(() => 0), round: 0, rounds: settings.rounds, metric: 0, guesses: [], targetIds: targets.map((player) => player.id), choiceIds: buildTwinChoiceIds(targets, pool) };
  }
  online.leagueSelectionDirty = false;
  const state = await mutateOnline({ type: "configure", settings });
  if (state) online.settings = settings;
};
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
    const active = onlineGamePlayers(), activeScores = [...online.state.scores], value = buildFreshOnlineSpecialState(settings, active);
    if (!value) { toast("Bu oyun için yeni ve geçerli sorular üretilemedi."); return; }
    value.scores = [...activeScores];
    if (settings.gameType === "grid") { value.players = active.map((player, index) => ({ ...(value.players?.[index] || {}), name: player.name, computer: false })); value.scores = [...activeScores]; for (const key of ["correct", "wrong"]) value[key] = active.map(() => 0); }
    let modeState;
    if (settings.gameType === "grid") modeState = { kind: "grid", value };
    if (settings.gameType === "twin") modeState = { kind: "twin", value };
    if (settings.gameType === "randomFive") modeState = { kind: "randomFive", value };
    await mutateOnline({ type: "mode_state", modeState, currentTurn: 0, scores: activeScores });
  }
  handleOnlineSpecialState();
}
function buildFreshOnlineSpecialState(settings, active) {
  const selected = new Set(settings.leagueIds || []), allowedClubs = clubs.filter((club) => club.active !== false && (!selected.size || selected.has(club.leagueId || `${club.country}:${club.league}`))), clubIds = new Set(allowedClubs.map((club) => club.id));
  const previous = settings.lastModeState?.value || settings.initialState || {};
  for (let attempt = 0; attempt < 12; attempt++) {
    if (settings.gameType === "randomFive") {
      const pool = players.filter((player) => player.clubIds.some((id) => clubIds.has(id))), used = new Set((settings.randomFiveHistory || []).map((set) => randomFiveSetKey(set)));
      for (const set of previous.setIds || []) used.add(randomFiveSetKey(set));
      const sets = buildFreshRandomFiveSets(allowedClubs, pool, used, settings.rounds);
      if (!sets) continue;
      const setIds = sets.map((set) => set.map((club) => club.id));
      return { difficulty: settings.difficulty, answerMethod: settings.answerMethod, scores: active.map(() => 0), round: 0, guesses: [], guessIds: {}, revealUntil: null, setIds, choiceIds: buildRandomFiveChoiceIds(sets, pool, settings.difficulty) };
    }
    if (settings.gameType === "twin") {
      const pool = players.filter((player) => player.statisticsComplete && player.appearances >= 50 && player.clubIds.some((id) => clubIds.has(id)) && IkiFormaCore.TWIN_METRICS.every((metric) => Number.isFinite(Number(player[metric.key]))));
      const targets = shuffle(pool.filter((player) => player.appearances >= 200 && player.goals >= 15)).slice(0, settings.rounds);
      const targetIds = targets.map((player) => player.id);
      if (targets.length < settings.rounds || JSON.stringify(targetIds) === JSON.stringify(previous.targetIds)) continue;
      return { difficulty: settings.difficulty, answerMethod: settings.answerMethod, scores: active.map(() => 0), round: 0, rounds: settings.rounds, metric: 0, guesses: [], targetIds, choiceIds: buildTwinChoiceIds(targets, pool) };
    }
    if (settings.gameType === "grid") {
      const board = generateGrid(selected, settings.gridType || "mixed");
      const signature = (gridBoard) => JSON.stringify([...(gridBoard?.rows || []), ...(gridBoard?.cols || [])].map((criterion) => `${criterion.type}:${criterion.id}`));
      if (!board || signature(board) === signature(previous.grid)) continue;
      const state = IkiFormaCore.createGridState({ mode: "duo", difficulty: settings.difficulty, names: active.map((player) => player.name) });
      state.grid = board; state.answerMethod = settings.answerMethod; return state;
    }
  }
  return null;
}
function randomFiveSetKey(set) { return [...set].map(Number).sort((a, b) => a - b).join("-"); }
function buildFreshRandomFiveSets(allowedClubs, pool, used, roundCount = 5) {
  const sets = [];
  for (let round = 0; round < roundCount; round++) {
    let accepted = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = buildRandomFiveSet(allowedClubs, pool), key = randomFiveSetKey(candidate.map((club) => club.id));
      if (candidate.length === 5 && !used.has(key)) { accepted = candidate; used.add(key); break; }
    }
    if (!accepted) return null;
    sets.push(accepted);
  }
  return sets;
}
function handleOnlineSpecialState() {
  const snapshot = online.state?.modeState;
  if (!snapshot) return;
  if (snapshot.kind === "grid") {
    show("grid"); grid = snapshot.value; grid.mode = "online"; grid.online = true;
    grid.players = onlineGamePlayers().map((player, index) => ({ ...(grid.players[index] || {}), name: player.name, computer: false }));
    for (const key of ["scores", "correct", "wrong"]) grid[key] = onlineGamePlayers().map((_, index) => grid[key]?.[index] || 0);
    $("#gridSetup").hidden = true; $("#gridGame").hidden = false; $("#gridResults").hidden = true; setGridPlaying(true); renderGrid(); announceTurn();
    if (grid.status === "finished") finishGrid();
  } else if (snapshot.kind === "twin") {
    hydrateOnlineTwin(snapshot.value); show("twinGame"); if (snapshot.value.finished) return renderOnlineSpecialFinished("twin"); renderTwinTurn(); if (twin.guesses.length === onlineGamePlayers().length) renderTwinSnapshotReveal();
  } else if (snapshot.kind === "randomFive") {
    hydrateOnlineRandomFive(snapshot.value); show("randomFiveGame"); if (snapshot.value.finished) return renderOnlineSpecialFinished("randomFive"); renderRandomFiveRound(); if (randomFive.guesses.length === onlineGamePlayers().length) renderRandomFiveSnapshotReveal();
  }
}
function renderOnlineSpecialFinished(kind) {
  const state = kind === "twin" ? twin : randomFive, best = Math.max(...state.scores), leaders = state.names.filter((_, index) => state.scores[index] === best), winner = leaders.length > 1 ? "Berabere!" : `${leaders[0]} kazandı!`;
  const prompt = kind === "twin" ? $("#twinPrompt") : $("#randomFivePrompt"), turn = kind === "twin" ? $("#twinTurn") : $("#randomFiveTurn");
  prompt.textContent = `🏆 ${winner}`; turn.textContent = state.names.map((name, index) => `${name}: ${state.scores[index] || 0}`).join(" · ");
  if (online.playerIndex === 0 && !online.finishingSpecial) completeOnlineMatch();
}
async function completeOnlineMatch() {
  if (online.playerIndex !== 0 || online.finishingSpecial || online.state?.status === "finished") return;
  online.finishingSpecial = true;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      online.state = await online.service.mutate(online.state.roomCode, online.token, online.state.stateVersion, { type: "finish" });
      online.finishingSpecial = false;
      show("onlineLobby"); renderOnlineLobby();
      return;
    } catch (error) {
      await refreshOnlineRoom();
      if (online.state?.status === "finished") { online.finishingSpecial = false; show("onlineLobby"); renderOnlineLobby(); return; }
      if (!error.message.includes("STALE_STATE")) break;
    }
  }
  online.finishingSpecial = false;
  toast("Oyun sonucu açılamadı; oda durumu yeniden deneniyor.");
  setTimeout(() => { refreshOnlineRoom().then(() => { if (online.state?.status === "playing") completeOnlineMatch(); }); }, 700);
}
async function syncSpecialState(kind, value, currentTurn, scores) {
  const action = { type: "mode_state", modeState: { kind, value }, currentTurn, scores };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      online.state = await online.service.mutate(online.state.roomCode, online.token, online.state.stateVersion, action);
      return true;
    } catch (error) {
      if (!error.message.includes("STALE_STATE")) { toast(error.message.includes("NOT_YOUR_TURN") ? "Bu hamle zaten işlendi; güncel oyun getiriliyor." : `Oyun eşitlenemedi: ${error.message}`); await refreshOnlineRoom(); return false; }
      await refreshOnlineRoom();
      if (online.state.currentTurn !== onlineMatchIndex() && online.state.modeState) return false;
    }
  }
  toast("Bağlantı yenilendi; güncel oyun getirildi."); await refreshOnlineRoom(); return false;
}
async function submitOnlineSpecialGuess(kind, step, selectedPlayerId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      online.state = await online.service.mutate(online.state.roomCode, online.token, online.state.stateVersion, { type: "special_guess", kind, step, selectedPlayerId: +selectedPlayerId });
      return true;
    } catch (error) {
      if (!error.message.includes("STALE_STATE")) { await refreshOnlineRoom(); if (!error.message.includes("SPECIAL_GUESS_ALREADY_SUBMITTED")) toast(`Tahmin kaydedilemedi: ${error.message}`); return false; }
      await refreshOnlineRoom();
      if (online.state.modeState?.value?.guessIds?.[onlineMatchIndex()] != null) return true;
    }
  }
  return false;
}

async function publishNextOnlineQuestion() {
  if (online.playerIndex !== 0 || online.publishing) return;
  if (online.state.questionSequence >= online.state.settings.rounds) {
    online.publishing = true; await completeOnlineMatch(); online.publishing = false; return;
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
    show("onlineLobby");
    return renderOnlineLobby();
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
  const matchPlayers = onlineGamePlayers(state), matchIndex = onlineMatchIndex(state);
  $("#gameRound").textContent = `Online · Tur ${state.questionSequence}/${state.settings.rounds} · ${Object.keys(state.roundAnswers || {}).length}/${matchPlayers.length} cevap`;
  $("#gameContext").textContent = `${state.roomCode} · ${state.settings.answerMethod === "multiple" ? "Çoktan seçmeli" : "Serbest metin"} · ${matchPlayers.map((player, index) => `${player.name}: ${state.scores[index] || 0}`).join(" · ")}`;
  $("#sideA").innerHTML = side(game.current.a); $("#sideB").innerHTML = side(game.current.b);
  $("#answerInput").closest(".answer-box").hidden = game.answerMethod === "multiple";
  $("#multipleChoiceOptions").hidden = game.answerMethod !== "multiple";
  const myAnswer = state.roundAnswers?.[matchIndex];
  $("#pass").hidden = true;
  if (game.answerMethod === "multiple") renderMultipleChoice(); else $("#answerInput").focus();
  if (state.revealUntil) {
    const correct = indexes.playerById.get(+question.correctPlayerId);
    const choices = matchPlayers.map((player, index) => { const answer = state.roundAnswers?.[index], selected = indexes.playerById.get(+answer?.selectedPlayerId); return `${player.name}: ${selected?.name || "—"} ${answer?.result === "correct" ? "✓" : "✕"}`; }).join(" · ");
    $("#gameMessage").textContent = `Doğru cevap: ${correct?.name}. ${choices}`;
    if (game.answerMethod === "multiple") $("#multipleChoiceOptions")?.querySelectorAll("button").forEach((button) => { button.disabled = true; if (+button.dataset.playerId === +question.correctPlayerId) button.classList.add("is-correct"); if (+button.dataset.playerId === +myAnswer?.selectedPlayerId && myAnswer?.result !== "correct") button.classList.add("is-wrong"); });
    if (online.playerIndex === 0 && online.advanceScheduledSeq !== state.questionSequence) {
      online.advanceScheduledSeq = state.questionSequence;
      setTimeout(() => { refreshOnlineRoom().then(publishNextOnlineQuestion); }, Math.max(0, state.revealUntil - Date.now()));
    }
  } else if (myAnswer) {
    $("#gameMessage").textContent = `✓ Seçiminiz kaydedildi. Diğer oyuncular bekleniyor (${Object.keys(state.roundAnswers || {}).length}/${matchPlayers.length}).`;
    if (game.answerMethod === "multiple") $("#multipleChoiceOptions")?.querySelectorAll("button").forEach((button) => { button.disabled = true; if (+button.dataset.playerId === +myAnswer.selectedPlayerId) button.classList.add("is-selected"); });
  } else {
    $("#gameMessage").textContent = "Seçiminizi yapın; sonuç herkes cevapladıktan sonra gösterilecek.";
  }
  clearInterval(timer);
  const updateOnlineTime = () => { const left = Math.max(0, Math.ceil((question.deadlineAt - Date.now()) / 1000)); $("#timer").textContent = `${left} sn`; $("#timebar").style.width = `${Math.min(100, left / state.settings.seconds * 100)}%`; if (!left) { clearInterval(timer); requestOnlineQuestionTimeout(question.questionId, state.questionSequence); } };
  updateOnlineTime(); timer = setInterval(updateOnlineTime, 500);
}

async function requestOnlineQuestionTimeout(questionId, sequence) {
  if (!online.state?.question || online.state.revealUntil || online.timeoutRequestedSeq === sequence) return;
  online.timeoutRequestedSeq = sequence;
  try {
    online.state = await online.service.mutate(online.state.roomCode, online.token, online.state.stateVersion, { type: "timeout", questionId });
    handleOnlineState();
  } catch (error) {
    await refreshOnlineRoom();
    if (!online.state?.revealUntil && online.state?.question?.questionId === questionId) {
      online.timeoutRequestedSeq = null;
      if (error.message.includes("TIME_REMAINING") || error.message.includes("STALE_STATE")) setTimeout(() => requestOnlineQuestionTimeout(questionId, sequence), 400);
    }
  }
}

async function submitOnlinePlayer(playerId) {
  if (online.state.roundAnswers?.[onlineMatchIndex()]) return toast("Bu turdaki seçiminiz kaydedildi.");
  const questionId = online.state.question.questionId;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      online.state = await online.service.mutate(online.state.roomCode, online.token, online.state.stateVersion, { type: "answer", questionId, selectedPlayerId: +playerId });
      break;
    } catch (error) {
      if (!error.message.includes("STALE_STATE")) return toast(`Seçim kaydedilemedi: ${error.message}`);
      await refreshOnlineRoom();
      if (online.state.roundAnswers?.[onlineMatchIndex()]) break;
    }
  }
  handleOnlineState();
}

function renderMultipleChoice() {
  const root = $("#multipleChoiceOptions");
  if (!root) return;
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
  $("#multipleChoiceOptions")?.querySelectorAll("button").forEach((button) => {
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
  const hits = players
    .filter((p) => norm(p.name).includes(q))
    .slice(0, 10);
  $("#answerSuggestions").innerHTML = hits
    .map(
      (p) =>
        `<button class="player-suggestion" data-id="${p.id}">${person(p)}<span><b>${esc(p.name)}</b><small>${esc(p.nationality || "")}</small></span></button>`,
    )
    .join("");
  $$("#answerSuggestions button").forEach(
    (b) =>
      (b.onclick = () => {
        const p = players.find((x) => x.id === +b.dataset.id);

        if (!p) return;

        if (game.online) {
          submitOnlinePlayer(p.id);
        } else {
          endRound(p, "");
        }
      }),
  );
};
$("#answerInput").onkeydown = (e) => {
  if (e.key === "Enter") {
    const p = players.find(
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
  const gridSetup = $("#gridSetup");
  if (!gridSetup) return;
  const selectedLeagues = new Set(
    [
      ...gridSetup.querySelectorAll(".grid-league-options input:checked"),
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
      html += `<button class="grid-cell ${m ? `owner-${m.owner}` : ""} ${grid.selectedCell === i ? "selected" : ""} ${winning}" data-cell="${i}" role="gridcell" aria-label="${esc(r.name)} ve ${esc(c.name)}" ${m || grid.thinking ? "disabled" : ""}>${m ? `<b>${m.owner + 1}</b><small>${esc(p.name)}</small>` : "?"}</button>`;
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
  $("#gridScores").textContent = grid.players.map((player, index) => `${player.name}: ${grid.scores[index] || 0}`).join(" • ");
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
  if (grid.online && online.state.currentTurn !== onlineMatchIndex()) return toast("Sıra rakibinizde.");
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
    const questionKey = `${i}:${grid.currentTurn}:${grid.history.length}`;
    grid.choiceQuestions ||= {};
    grid.question = grid.choiceQuestions[questionKey] || IkiFormaCore.generateCriteriaMultipleChoiceQuestion({ first: r, second: c, indexes, difficulty: grid.difficulty, rng: seededGridQuestionRng(`${grid.questionSeed || 0}:${questionKey}`) });
    if (!grid.question) { $("#gridEntry").hidden = true; return toast("Bu hücre için dört geçerli seçenek üretilemedi."); }
    grid.choiceQuestions[questionKey] = grid.question;
    const hasCountryCriterion = r.type === "country" || c.type === "country";
    renderPlayerChoices($("#gridChoices"), grid.question.optionPlayerIds.map((id) => indexes.playerById.get(id)), submitGridPlayer, { showBirthYear: hasCountryCriterion });
  } else $("#gridInput").focus();
}
function seededGridQuestionRng(seedText) {
  let state = 2166136261;
  for (const character of seedText) { state ^= character.charCodeAt(0); state = Math.imul(state, 16777619); }
  return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}
async function submitGridPlayer(player) {
  if (!player || grid.selectedCell == null) return;
  if (grid.online && online.specialSubmitting) return;
  if (grid.online) online.specialSubmitting = true;
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
    if (grid.online) online.specialSubmitting = false;
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
    const synced = await syncSpecialState("grid", grid, grid.currentTurn, grid.scores);
    online.specialSubmitting = false; if (!synced) return handleOnlineSpecialState();
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
      : grid.scores.filter((score) => score === Math.max(...grid.scores)).length > 1 ? null : grid.scores.indexOf(Math.max(...grid.scores)),
    winner =
      winnerIndex === null
        ? "Berabere"
        : `${grid.players[winnerIndex].name} kazandı`,
    outcome = hasLineWinner
      ? `<p><strong>${esc(grid.players[winnerIndex].name)}</strong> üçlü çizgiyi tamamladı.</p>`
      : "<p>Geçerli hamleler tamamlandı; sonuç skora göre belirlendi.</p>";
  $("#gridGame").hidden = true;
  $("#gridResults").hidden = false;
  setGridPlaying(true);
  $("#gridResults").innerHTML =
    `<span class="trophy">🏆</span><h2>${esc(winner)}</h2>${outcome}<p>${grid.players.map((player, index) => `${esc(player.name)}: ${grid.scores[index] || 0}`).join(" • ")}</p><p>Doğru: ${grid.correct.join(" / ")} • Yanlış: ${grid.wrong.join(" / ")}</p><button id="gridAgain" class="cta">Odaya dön</button>`;
  $("#gridAgain").onclick = grid.online ? () => show("onlineLobby") : showGridSetup;
  if (grid.online && online.playerIndex === 0 && !online.finishingSpecial) completeOnlineMatch();
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
  const selected = new Set([...(root?.querySelectorAll(".league-options input:checked") || [])].map((input) => input.value)),
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
function renderPlayerChoices(root, choices, callback, { showBirthYear = false } = {}) {
  if (!root) return;
  root.classList.add("inline-choices");
  root.innerHTML = choices.map((player, index) => { const meta = showBirthYear ? (player.birthDate ? `Doğum: ${esc(player.birthDate.slice(0, 4))}` : "Doğum yılı bilinmiyor") : esc(player.nationality || ""); return `<button class="player-suggestion" data-choice="${player.id}"><span class="choice-key">${index + 1}</span>${person(player)}<span><b>${esc(player.name)}</b><small>${meta}</small></span></button>`; }).join("");
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
function buildRandomFiveChoiceIds(sets, pool, difficulty) {
  return sets.map((set) => IkiFormaCore.generateRandomFiveOptions({ pool, clubIds: set.map((club) => club.id), difficulty })?.map((entry) => entry.player.id) || []);
}
function buildTwinChoiceIds(targets, pool) {
  return targets.map((target) => IkiFormaCore.TWIN_METRICS.map((metric) => IkiFormaCore.generateTwinOptions({ target, pool, metric: metric.key })?.map((entry) => entry.player.id) || []));
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
    const initialState = { difficulty: randomFive.difficulty, answerMethod: randomFive.answerMethod, scores: [0, 0], round: 0, guesses: [], guessIds: {}, revealUntil: null, setIds: randomFive.sets.map((set) => set.map((club) => club.id)), choiceIds: buildRandomFiveChoiceIds(randomFive.sets, pool, randomFive.difficulty) };
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
  $("#randomFiveRound").textContent = `Set ${randomFive.round + 1}/${randomFive.sets.length}`;
  $("#randomFiveScore").innerHTML = randomFive.names.map((name, index) => `<b>${esc(name)} ${randomFive.scores[index] || 0}</b>`).join("<span>·</span>");
  $("#randomFiveClubs").innerHTML = set.map((club) => `<article>${logo(club)}<b>${esc(club.name)}</b><small>${esc(club.league || "")}</small></article>`).join("");
  $("#randomFivePrompt").textContent = "Bu beşlinin kaçında oynayan bir futbolcu bulabilirsin?";
  $("#randomFiveTurn").textContent = `${randomFive.names[0]} tahminini girsin.`;
  const onlineGuesses = randomFive.guessIds || {}, onlineGuessCount = Object.keys(onlineGuesses).length;
  const matchIndex = randomFive.online ? onlineMatchIndex() : 0, matchCount = randomFive.online ? onlineGamePlayers().length : randomFive.names.length;
  if (randomFive.online) $("#randomFiveTurn").textContent = onlineGuesses[matchIndex] != null ? `Tahmininiz kaydedildi. Diğer oyuncular bekleniyor (${onlineGuessCount}/${matchCount}).` : `Tahmininizi yapın (${onlineGuessCount}/${matchCount} cevap).`;
  $("#randomFiveInput").value = "";
  const canPlay = !randomFive.online || (onlineGuesses[matchIndex] == null && !randomFive.revealUntil);
  $("#randomFiveInput").disabled = !canPlay;
  $("#randomFiveInput").hidden = randomFive.answerMethod === "multiple";
  $("#randomFiveGame .random-five-answer").hidden = false;
  $("#randomFiveSuggestions").innerHTML = "";
  $("#randomFiveSuggestions").classList.toggle("inline-choices", randomFive.answerMethod === "multiple");
  if (randomFive.answerMethod === "multiple") {
    const sharedIds = randomFive.online ? randomFive.choiceIds?.[randomFive.round] : null;
    randomFive.choiceEntries = sharedIds?.length === 4 ? sharedIds.map((id) => ({ player: indexes.playerById.get(+id), score: IkiFormaCore.randomFiveScore(indexes.playerById.get(+id), set.map((club) => club.id)) })) : IkiFormaCore.generateRandomFiveOptions({ pool: randomFive.pool, clubIds: set.map((club) => club.id), difficulty: randomFive.difficulty });
    if (!randomFive.choiceEntries) return toast("Bu set için dört kaliteli seçenek üretilemedi.");
    renderPlayerChoices($("#randomFiveSuggestions"), randomFive.choiceEntries.map((entry) => entry.player), submitRandomFiveGuess);
    if (!canPlay) $("#randomFiveSuggestions")?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  }
  $("#randomFiveReveal").hidden = true;
  $("#randomFiveNext").hidden = true;
  if (canPlay) $("#randomFiveInput").focus();
}
async function submitRandomFiveGuess(player) {
  if (!player) return;
  if (randomFive.online && online.specialSubmitting) return;
  if (randomFive.online && randomFive.guessIds?.[onlineMatchIndex()] != null) return toast("Tahmininiz kaydedildi; diğer oyuncular bekleniyor.");
  if (randomFive.online) {
    online.specialSubmitting = true;
    const saved = await submitOnlineSpecialGuess("randomFive", randomFive.round, player.id);
    online.specialSubmitting = false;
    if (saved) handleOnlineSpecialState();
    return;
  }
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
}
function revealRandomFiveRound() {
  const ids = randomFive.sets[randomFive.round].map((club) => club.id),
    points = randomFive.guesses.map((player) => IkiFormaCore.randomFiveScore(player, ids));
  randomFive.scores = randomFive.scores.map((score, index) => score + points[index]);
  $("#randomFiveInput").disabled = true;
  $("#randomFiveTurn").textContent = points[0] === points[1] ? `Bu set ${points[0]}-${points[1]} berabere.` : `${randomFive.names[points[0] > points[1] ? 0 : 1]} sette daha çok kulüp buldu.`;
  $("#randomFiveReveal").innerHTML = randomFive.guesses.map((player, index) => `<article class="${points[index] === Math.max(...points) ? "winner" : ""}">${person(player)}<div><small>${esc(randomFive.names[index])}</small><b>${esc(player.name)}</b><span>${points[index]} kulüp · +${points[index]} puan</span></div></article>`).join("");
  $("#randomFiveReveal").hidden = false;
  $("#randomFiveNext").textContent = randomFive.round === randomFive.sets.length - 1 ? "Sonucu gör →" : "Sonraki set →";
  $("#randomFiveNext").hidden = randomFive.online;
  $("#randomFiveScore").innerHTML = randomFive.names.map((name, index) => `<b>${esc(name)} ${randomFive.scores[index] || 0}</b>`).join("<span>·</span>");
}
async function nextRandomFiveRound() {
  if (randomFive.online && online.playerIndex !== 0) return toast("Sonraki seti oda sahibi açar.");
  if (randomFive.online && online.specialAdvancing) return;
  if (randomFive.online) online.specialAdvancing = true;
  const previousRound = randomFive.round;
  if (randomFive.online) {
    if (!randomFive.revealUntil || Object.keys(randomFive.guessIds || {}).length !== onlineGamePlayers().length) { online.specialAdvancing = false; return; }
    const clubIds = randomFive.sets[randomFive.round].map((club) => club.id);
    const guesses = onlineGamePlayers().map((_, index) => indexes.playerById.get(+randomFive.guessIds[index]));
    randomFive.scores = randomFive.scores.map((score, index) => score + IkiFormaCore.randomFiveScore(guesses[index], clubIds));
    randomFive.guessIds = {}; randomFive.revealUntil = null; randomFive.guesses = [];
  }
  randomFive.round++;
  if (randomFive.round < randomFive.sets.length) { randomFive.guesses = []; if (randomFive.online) { const synced = await syncSpecialState("randomFive", serializeOnlineRandomFive(), 0, randomFive.scores); online.specialAdvancing = false; if (!synced || online.state.modeState?.value?.round !== previousRound + 1) { online.specialAdvanceKey = null; setTimeout(handleOnlineSpecialState, 500); return; } } return renderRandomFiveRound(); }
  const best = Math.max(...randomFive.scores), leaders = randomFive.names.filter((_, index) => randomFive.scores[index] === best), winner = leaders.length > 1 ? "Berabere!" : `${leaders[0]} kazandı!`;
  $("#randomFiveClubs").innerHTML = "";
  $("#randomFivePrompt").textContent = `🏆 ${winner}`;
  $("#randomFiveTurn").textContent = randomFive.names.map((name, index) => `${name}: ${randomFive.scores[index] || 0}`).join(" · ");
  $("#randomFiveGame .random-five-answer").hidden = true;
  $("#randomFiveReveal").innerHTML = '<button class="cta" data-view="randomFiveSetup">Yeniden oyna</button>';
  $("#randomFiveReveal").hidden = false;
  $("#randomFiveNext").hidden = true;
  if (randomFive.online) {
    const synced = await syncSpecialState("randomFive", serializeOnlineRandomFive(), 0, randomFive.scores);
    online.specialAdvancing = false;
    if (synced) await completeOnlineMatch();
  }
}
function renderRandomFiveSnapshotReveal() {
  const ids = randomFive.sets[randomFive.round].map((club) => club.id), points = randomFive.guesses.map((player) => IkiFormaCore.randomFiveScore(player, ids));
  $("#randomFiveReveal").innerHTML = randomFive.guesses.map((player, index) => `<article class="${points[index] === Math.max(...points) ? "winner" : ""}">${person(player)}<div><small>${esc(randomFive.names[index])}</small><b>${esc(player.name)}</b><span>${points[index]} kulüp</span></div></article>`).join("");
  $("#randomFiveReveal").hidden = false; $("#randomFiveNext").hidden = true; $("#randomFiveInput").disabled = true;
  const key = `random-${randomFive.round}`; if (online.playerIndex === 0 && online.specialAdvanceKey !== key) { online.specialAdvanceKey = key; setTimeout(nextRandomFiveRound, 2000); }
}
function serializeOnlineRandomFive() { return { difficulty: randomFive.difficulty, answerMethod: randomFive.answerMethod, scores: randomFive.scores, round: randomFive.round, guesses: randomFive.guesses.map((player) => player.id), guessIds: randomFive.guessIds || {}, revealUntil: randomFive.revealUntil || null, setIds: randomFive.sets.map((set) => set.map((club) => club.id)), choiceIds: randomFive.choiceIds, finished: randomFive.round >= randomFive.sets.length }; }
function hydrateOnlineRandomFive(value) {
  const selected = new Set(online.state.settings.leagueIds || []), clubIds = new Set(clubs.filter((club) => !selected.size || selected.has(club.leagueId)).map((club) => club.id));
  const active = onlineGamePlayers(), guessIds = value.guessIds || {}, orderedGuesses = active.map((_, index) => indexes.playerById.get(+guessIds[index])).filter(Boolean);
  randomFive = { ...value, guessIds, scores: active.map((_, index) => value.scores[index] || 0), online: true, mode: "online", names: active.map((player) => player.name), pool: players.filter((player) => player.clubIds.some((id) => clubIds.has(id))), sets: value.setIds.map((set) => set.map((id) => clubMap.get(+id))), guesses: orderedGuesses, used: active.map(() => new Set()) };
}
$("#randomFiveInput").oninput = (event) => {
  const q = norm(event.target.value), ids = randomFive.sets?.[randomFive.round]?.map((club) => club.id) || [];
  if (q.length < 2) return ($("#randomFiveSuggestions").innerHTML = "");
  const hits = players
    .filter((player) => norm(player.name).includes(q))
    .slice(0, 10);
  $("#randomFiveSuggestions").innerHTML = hits.map((player) => `<button class="player-suggestion" data-random-five-player="${player.id}">${person(player)}<span><b>${esc(player.name)}</b><small>${esc(player.nationality || "")}</small></span></button>`).join("") || "<button disabled>Eşleşen futbolcu yok</button>";
  $$('[data-random-five-player]').forEach((button) => button.onclick = () => submitRandomFiveGuess(indexes.playerById.get(+button.dataset.randomFivePlayer)));
};
$("#randomFiveInput").onkeydown = (event) => { if (event.key === "Enter") { const player = players.find((item) => norm(item.name) === norm(event.target.value)); if (player) submitRandomFiveGuess(player); else toast("Listeden geçerli bir futbolcu seç."); } };
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
    const initialState = { difficulty: twin.difficulty, answerMethod: twin.answerMethod, scores: [0, 0], round: 0, rounds: twin.rounds, metric: 0, guesses: [], targetIds: twin.targets.map((player) => player.id), choiceIds: buildTwinChoiceIds(twin.targets, pool) };
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
  $("#twinScore").innerHTML = twin.names.map((name, index) => `<b>${esc(name)} ${twin.scores[index] || 0}</b>`).join("<span>·</span>");
  $("#twinTarget").innerHTML = `${person(target)}<div><span class="kicker">HEDEF FUTBOLCU</span><h2>${esc(target.name)}</h2><p>${esc(target.nationality || "")}</p></div><div class="twin-metrics">${IkiFormaCore.TWIN_METRICS.map((m, i) => `<div class="${i === twin.metric ? "active" : ""}"><small>${esc(m.label)}</small><b>${Number(target[m.key]).toLocaleString("tr-TR")}</b></div>`).join("")}</div>`;
  $("#twinMetricStep").textContent = `METRİK ${twin.metric + 1}/4`;
  $("#twinPrompt").textContent = `${metric.label} değerine en yakın futbolcu kim?`;
  $("#twinTurn").textContent = `${twin.names[0]} tahminini girsin.`;
  if (twin.online) $("#twinTurn").textContent = `${twin.names[online.state.currentTurn]} tahminini girsin.`;
  $("#twinInput").value = "";
  const canPlay = !twin.online || online.state.currentTurn === onlineMatchIndex();
  $("#twinInput").disabled = !canPlay;
  $("#twinInput").hidden = twin.answerMethod === "multiple";
  $("#twinGame .twin-answer").hidden = false;
  if (canPlay) $("#twinInput").focus();
  $("#twinSuggestions").innerHTML = "";
  $("#twinSuggestions").classList.toggle("inline-choices", twin.answerMethod === "multiple");
  if (twin.answerMethod === "multiple") {
    const sharedIds = twin.online ? twin.choiceIds?.[twin.round]?.[twin.metric] : null;
    twin.choiceEntries = sharedIds?.length === 4 ? sharedIds.map((id) => { const player = indexes.playerById.get(+id); return { player, distance: Math.abs(Number(player?.[metric.key]) - Number(target[metric.key])) }; }) : IkiFormaCore.generateTwinOptions({ target, pool: twin.pool, metric: metric.key });
    if (!twin.choiceEntries) return toast("Bu metrik için dengeli seçenek üretilemedi.");
    renderPlayerChoices($("#twinSuggestions"), twin.choiceEntries.map((entry) => entry.player), submitTwinGuess);
    if (!canPlay) $("#twinSuggestions")?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  }
  $("#twinMessage").textContent = "";
  $("#twinReveal").hidden = true;
  $("#twinNext").hidden = true;
}
async function submitTwinGuess(player) {
  if (!player || player.id === twin.targets[twin.round].id) return toast("Hedef futbolcu tahmin edilemez.");
  if (twin.online && online.specialSubmitting) return;
  if (twin.online && online.state.currentTurn !== onlineMatchIndex()) return toast("Sıra rakibinizde.");
  if (twin.online) online.specialSubmitting = true;
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
  if (twin.online && twin.guesses.length < onlineGamePlayers().length) {
    const synced = await syncSpecialState("twin", serializeOnlineTwin(), (online.state.currentTurn + 1) % onlineGamePlayers().length, twin.scores);
    online.specialSubmitting = false; if (!synced) return;
    return handleOnlineSpecialState();
  }
  if (twin.mode === "computer" && twin.guesses.length === 1) {
    const guess = twin.answerMethod === "multiple"
      ? IkiFormaCore.chooseTwinComputerOption({ options: twin.choiceEntries, difficulty: twin.difficulty })
      : IkiFormaCore.chooseTwinComputerGuess({ target: twin.targets[twin.round], pool: twin.pool, metric: IkiFormaCore.TWIN_METRICS[twin.metric].key, difficulty: twin.difficulty });
    if (guess) twin.guesses.push(guess.player);
  }
  revealTwinMetric();
  if (twin.online) { await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores); online.specialSubmitting = false; }
}
function revealTwinMetric() {
  const target = twin.targets[twin.round], metric = IkiFormaCore.TWIN_METRICS[twin.metric], distances = twin.guesses.map((player) => Math.abs(Number(player[metric.key]) - Number(target[metric.key]))), minimum = Math.min(...distances), winners = distances.map((distance, index) => distance === minimum ? index : -1).filter((index) => index >= 0);
  winners.forEach((index) => twin.scores[index]++);
  $("#twinInput").disabled = true;
  $("#twinTurn").textContent = winners.length > 1 ? "Eşit yakınlık: en yakın oyuncular puan aldı." : `${twin.names[winners[0]]} bu metriği kazandı!`;
  $("#twinReveal").innerHTML = twin.guesses.map((p, i) => `<article class="${winners.includes(i) ? "winner" : ""}">${person(p)}<div><small>${esc(twin.names[i])}</small><b>${esc(p.name)}</b><span>${Number(p[metric.key]).toLocaleString("tr-TR")} · fark ${distances[i].toLocaleString("tr-TR")}</span></div></article>`).join("");
  $("#twinReveal").hidden = false;
  $("#twinNext").textContent = twin.metric === 3 ? (twin.round + 1 === twin.rounds ? "Sonucu gör →" : "Sonraki futbolcu →") : "Sonraki metrik →";
  $("#twinNext").hidden = twin.online;
  $("#twinScore").innerHTML = twin.names.map((name, index) => `<b>${esc(name)} ${twin.scores[index] || 0}</b>`).join("<span>·</span>");
}
async function nextTwinStep() {
  if (twin.online && online.playerIndex !== 0) return toast("Sonraki adımı oda sahibi açar.");
  if (twin.online && online.specialAdvancing) return;
  if (twin.online) online.specialAdvancing = true;
  if (twin.metric < 3) { twin.metric++; twin.guesses = []; if (twin.online) { const synced = await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores); online.specialAdvancing = false; if (!synced) { online.specialAdvanceKey = null; setTimeout(handleOnlineSpecialState, 500); return; } } return renderTwinTurn(); }
  twin.round++;
  if (twin.round < twin.rounds) { beginTwinRound(); if (twin.online) { const synced = await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores); online.specialAdvancing = false; if (!synced) { online.specialAdvanceKey = null; setTimeout(handleOnlineSpecialState, 500); return; } } return; }
  const best = Math.max(...twin.scores), leaders = twin.names.filter((_, index) => twin.scores[index] === best), winner = leaders.length > 1 ? "Berabere!" : `${leaders[0]} kazandı!`;
  $("#twinTarget").innerHTML = "";
  $("#twinMetricStep").textContent = "OYUN TAMAMLANDI";
  $("#twinPrompt").textContent = `🏆 ${winner}`;
  $("#twinTurn").textContent = twin.names.map((name, index) => `${name}: ${twin.scores[index] || 0}`).join(" · ");
  $("#twinGame .twin-answer").hidden = true;
  $("#twinReveal").innerHTML = '<button class="cta" data-view="twinSetup">Yeniden oyna</button>';
  $("#twinReveal").hidden = false;
  $("#twinNext").hidden = true;
  if (twin.online) {
    const synced = await syncSpecialState("twin", serializeOnlineTwin(), 0, twin.scores);
    online.specialAdvancing = false;
    if (synced) await completeOnlineMatch();
  }
}
function renderTwinSnapshotReveal() {
  const target = twin.targets[twin.round], metric = IkiFormaCore.TWIN_METRICS[twin.metric], distances = twin.guesses.map((player) => Math.abs(Number(player[metric.key]) - Number(target[metric.key]))), minimum = Math.min(...distances);
  $("#twinReveal").innerHTML = twin.guesses.map((player, index) => `<article class="${distances[index] === minimum ? "winner" : ""}">${person(player)}<div><small>${esc(twin.names[index])}</small><b>${esc(player.name)}</b><span>${Number(player[metric.key]).toLocaleString("tr-TR")} · fark ${distances[index].toLocaleString("tr-TR")}</span></div></article>`).join("");
  $("#twinReveal").hidden = false; $("#twinNext").hidden = true; $("#twinInput").disabled = true;
  const key = `twin-${twin.round}-${twin.metric}`; if (online.playerIndex === 0 && online.specialAdvanceKey !== key) { online.specialAdvanceKey = key; setTimeout(nextTwinStep, 2000); }
}
function serializeOnlineTwin() { return { difficulty: twin.difficulty, answerMethod: twin.answerMethod, scores: twin.scores, round: twin.round, rounds: twin.rounds, metric: twin.metric, guesses: twin.guesses.map((player) => player.id), targetIds: twin.targets.map((player) => player.id), choiceIds: twin.choiceIds, finished: twin.round >= twin.rounds }; }
function hydrateOnlineTwin(value) {
  const selected = new Set(online.state.settings.leagueIds || []), clubIds = new Set(clubs.filter((club) => !selected.size || selected.has(club.leagueId)).map((club) => club.id));
  const pool = players.filter((player) => player.statisticsComplete && player.appearances >= 50 && player.clubIds.some((id) => clubIds.has(id)) && IkiFormaCore.TWIN_METRICS.every((metric) => Number.isFinite(Number(player[metric.key]))));
  const active = onlineGamePlayers();
  twin = { ...value, scores: active.map((_, index) => value.scores[index] || 0), online: true, mode: "online", names: active.map((player) => player.name), pool, targets: value.targetIds.map((id) => indexes.playerById.get(+id)), guesses: value.guesses.map((id) => indexes.playerById.get(+id)).filter(Boolean), used: active.map(() => new Set()) };
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

// PROGRESSIVE-SETUP-SHELL
let progressiveSetupReady = false;

function setDataDependentControls(loading) {
  const selector = [
    ".view.setup .cta",
    ".view.setup .start",
    "#startGrid",
    "#startTwin",
    "#startRandomFive",
    "#startRatingGame",
    "#startMysteryGame",
    "#startHexGame",
    "#startTrumpsGame",
    "#startXiDraft"
  ].join(",");

  document.querySelectorAll(selector).forEach((button) => {
    button.disabled = false;

    if (loading) {
      button.dataset.dataLoading = "1";
      button.title = "Futbolcu verileri arka planda hazirlaniyor";
    } else {
      delete button.dataset.dataLoading;
      button.removeAttribute("title");
    }
  });
}

function bootstrapSetupShell(data) {
  if (
    progressiveSetupReady ||
    !data
  ) {
    return;
  }

  DATA = data;
  clubs = Array.isArray(data.clubs)
    ? data.clubs
    : [];

  players = [];

  setupScreen(
    "#classicSetup",
    "FormaX",
    "Iki kulupte de A takim formasi giymis futbolcuyu bul.",
    "clubs",
  );

  setupScreen(
    "#countrySetup",
    "Ulke x Kulup",
    "Gosterilen ulkenin vatandasi olup kulupte oynamis futbolcuyu bul.",
    "country",
  );

  [
    "#classicSetup",
    "#countrySetup",
    "#gridSetup",
    "#twinSetup",
    "#randomFiveSetup",
    "#hexSetup",
    "#trumpsSetup",
    "#xiDraftSetup",
    "#onlineHostSettings"
  ].forEach((selector) => {
    enhanceLeagueSelector(
      document.querySelector(selector)
    );
  });

  organizeHomeMenu();

  setDataDependentControls(true);

  progressiveSetupReady = true;

  window.dispatchEvent(
    new CustomEvent(
      "iki-forma-setup-shell-ready"
    )
  );
}

async function init() {

  /*
    Show the application shell immediately.
    Large football datasets continue loading in background.
  */

  window.IKI_FORMA_DATA_READY = false;
  window.IKI_FORMA_FC26_READY = false;

  document.body.classList.add(
    "background-data-loading"
  );

  history.replaceState(
    { view: "home" },
    "",
    "#home"
  );

  show(
    "home",
    { history: false }
  );

  try {

    const loader = window.IkiFormaDataLoader;

    if (!loader) {
      throw new Error("Progressive data loader bulunamadi");
    }

    const background = loader.startBackground();

    // WAIT-CAREER-BOOTSTRAP
    // Only the lightweight metadata package is required
    // before setup pages and league filters become usable.
    const careerBootstrap =
      loader.state.career ||
      await new Promise((resolve) => {

        const handler = (event) => {

          if (
            event.detail?.type !== "career"
          ) {
            return;
          }

          window.removeEventListener(
            "iki-forma-data-bootstrap",
            handler
          );

          resolve(
            event.detail.data
          );

        };

        window.addEventListener(
          "iki-forma-data-bootstrap",
          handler
        );

      });

    bootstrapSetupShell(
      careerBootstrap
    );

    [DATA, FC26_DATA] = await Promise.all([
      background.career,
      background.fc26,
    ]);

    window.IKI_FORMA_DATA_READY = true;
    window.IKI_FORMA_FC26_READY = true;

    window.dispatchEvent(
      new CustomEvent("iki-forma-data-ready")
    );
    setupFcLeagueSelector("#ratingLeagueOptions");
    setupFcLeagueSelector("#mysteryLeagueOptions");
    const fcNations = [...new Set(FC26_DATA.players.filter((player) => player.gender === "M").map((player) => player.nation).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    $("#xiNation").insertAdjacentHTML("beforeend", fcNations.map((nation) => `<option value="${esc(nation)}">${esc(nation)}</option>`).join(""));
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
      "FormaX",
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
    enhanceLeagueSelector($("#hexSetup"));
    enhanceLeagueSelector($("#trumpsSetup"));
    enhanceLeagueSelector($("#xiDraftSetup"));
    enhanceLeagueSelector($("#onlineHostSettings"));
    $("#onlineHostSettings .league-options").addEventListener("change", () => { online.leagueSelectionDirty = true; });
    organizeHomeMenu();
    if (await restoreOnlineSession()) return;
    document.body.classList.remove(
      "background-data-loading"
    );

    document.body.classList.add(
      "background-data-ready"
    );

    // FINAL-PROGRESSIVE-CONTROLS-READY
    setDataDependentControls(false);

    window.dispatchEvent(
      new CustomEvent("iki-forma-ui-ready")
    );
  } catch (error) {
    $("#loadingText").textContent = `Site yüklenemedi: ${error.message}`;
  }
}
init();

















