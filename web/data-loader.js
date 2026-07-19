(() => {

  "use strict";


  const CACHE_NAME =
    "iki-forma-data-chunks-v3";


  const state = {

    career:
      null,

    fc26:
      null,

    careerPromise:
      null,

    fc26Promise:
      null

  };


  function emit(
    name,
    detail
  ) {

    window.dispatchEvent(
      new CustomEvent(
        name,
        {
          detail
        }
      )
    );

  }


  function yieldThread() {

    return new Promise(
      (resolve) => {

        if (
          "requestIdleCallback" in window
        ) {

          requestIdleCallback(
            () => resolve(),
            {
              timeout: 60
            }
          );

        }
        else {

          setTimeout(
            resolve,
            0
          );

        }

      }
    );

  }


  async function cachedFetch(
    url
  ) {

    /*
      Cache Storage means subsequent visits can reuse
      downloaded data chunks without another full download.
    */

    if (
      "caches" in window
    ) {

      try {

        const cache =
          await caches.open(
            CACHE_NAME
          );


        const cached =
          await cache.match(
            url
          );


        if (cached) {

          return cached.clone();

        }


        const response =
          await fetch(
            url,
            {
              cache:
                "force-cache"
            }
          );


        if (!response.ok) {

          throw new Error(
            `HTTP ${response.status}: ${url}`
          );

        }


        await cache.put(
          url,
          response.clone()
        );


        return response;

      }
      catch (error) {

        console.warn(
          "Cache fallback:",
          url,
          error
        );

      }

    }


    return fetch(
      url,
      {
        cache:
          "force-cache"
      }
    );

  }


  async function json(
    url
  ) {

    const response =
      await cachedFetch(
        url
      );


    if (!response.ok) {

      throw new Error(
        `Data load failed: ${url}`
      );

    }


    return response.json();

  }


  async function loadDataset({

    bootstrapUrl,
    manifestUrl,
    type

  }) {

    /*
      Bootstrap contains leagues, clubs, version and
      other lightweight metadata, but no player array.
    */

    const [
      bootstrap,
      manifest
    ] =
      await Promise.all([

        json(
          bootstrapUrl
        ),

        json(
          manifestUrl
        )

      ]);


    bootstrap.players =
      [];

    // PROGRESSIVE-PARTIAL-STATE
    // Expose bootstrap immediately. The same players array
    // grows as new chunks arrive.
    state[type] =
      bootstrap;


    emit(
      "iki-forma-data-bootstrap",
      {
        type,
        manifest,
        data:
          bootstrap
      }
    );


    /*
      Download one chunk at a time for this dataset.

      Career and FC26 loaders run together, so maximum
      normal concurrency is roughly two chunk requests.

      This avoids saturating slow mobile connections with
      dozens of simultaneous requests.
    */

    for (
      let index = 0;
      index < manifest.chunks.length;
      index++
    ) {

      const entry =
        manifest.chunks[index];


      const chunk =
        await json(
          entry.url
        );


      bootstrap.players.push(
        ...chunk
      );


      emit(
        "iki-forma-data-progress",
        {

          type,

          loadedChunks:
            index + 1,

          totalChunks:
            manifest.chunks.length,

          loadedPlayers:
            bootstrap.players.length,

          totalPlayers:
            manifest.totalPlayers,
          data:
            bootstrap

        }
      );


      /*
        Let the browser paint and process touch input
        between JSON parsing jobs.
      */

      await yieldThread();

    }


    emit(
      "iki-forma-data-complete",
      {
        type,
        data:
          bootstrap
      }
    );


    return bootstrap;

  }


  function loadCareer() {

    if (
      !state.careerPromise
    ) {

      state.careerPromise =
        loadDataset({

          bootstrapUrl:
            "data/career-bootstrap.json",

          manifestUrl:
            "data/career-manifest.json",

          type:
            "career"

        }).then(
          (data) => {

            state.career =
              data;

            return data;

          }
        );

    }


    return state.careerPromise;

  }


  function loadFc26() {

    if (
      !state.fc26Promise
    ) {

      state.fc26Promise =
        loadDataset({

          bootstrapUrl:
            "data/fc26-bootstrap.json",

          manifestUrl:
            "data/fc26-manifest.json",

          type:
            "fc26"

        }).then(
          (data) => {

            state.fc26 =
              data;

            return data;

          }
        );

    }


    return state.fc26Promise;

  }


  function startBackground() {

    /*
      Start both without waiting for game navigation.

      They use separate sequential queues, giving at most
      around two concurrent large data requests.
    */

    const career =
      loadCareer();

    const fc26 =
      loadFc26();


    return {
      career,
      fc26
    };

  }


  window.IkiFormaDataLoader = {

    state,

    loadCareer,

    loadFc26,

    startBackground

  };

})();

