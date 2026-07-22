(() => {

  "use strict";


  const CACHE_NAME =
    "formax-data-89062d31c0a2";


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

    /*
      Parsing chunks must not freeze touch/scroll input,
      but required data should also not wait for long idle periods.
    */

    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          0
        )
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


        /*
          Do not block first render while writing to persistent cache.
          Cache the clone in background.
        */
        cache.put(
          url,
          response.clone()
        ).catch(
          (error) =>
            console.warn(
              "Background cache write failed:",
              url,
              error
            )
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


    /*
      Expose the exact bootstrap object immediately.
      Its players array grows in place as chunks arrive.
    */

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


    const entries =
      manifest.chunks || [];


    let loadedChunks =
      0;


    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null;


    const effectiveType =
      connection?.effectiveType ||
      "";


    /*
      Adaptive concurrency:
      save-data / 2G : 1
      3G             : 2
      4G / desktop   : 3

      Career and FC26 still run together, so the browser
      normally sees a maximum of about 2-6 active chunk
      requests instead of dozens at once.
    */

    const concurrency =
      connection?.saveData
        ? 1
        : effectiveType.includes("2g")
          ? 1
          : effectiveType === "3g"
            ? 2
            : 3;


    async function loadChunk(
      index
    ) {

      const entry =
        entries[index];


      const chunk =
        await json(
          entry.url
        );


      if (
        Array.isArray(chunk)
      ) {

        bootstrap.players.push(
          ...chunk
        );

      }


      loadedChunks++;


      emit(
        "iki-forma-data-progress",
        {

          type,

          loadedChunks,

          totalChunks:
            entries.length,

          loadedPlayers:
            bootstrap.players.length,

          totalPlayers:
            manifest.totalPlayers,

          data:
            bootstrap

        }
      );


      /*
        Give rendering and touch input a chance between
        parsing tasks.
      */

      await yieldThread();

    }


    /*
      Always prioritize chunk zero.

      The first FC26 page and the first useful career
      player pool become available as early as possible.
    */

    if (
      entries.length > 0
    ) {

      await loadChunk(
        0
      );

    }


    /*
      Remaining chunks are fetched by a small worker pool.
    */

    let nextIndex =
      1;


    async function worker() {

      while (true) {

        const index =
          nextIndex++;


        if (
          index >= entries.length
        ) {

          return;

        }


        await loadChunk(
          index
        );

      }

    }


    const workerCount =
      Math.min(
        concurrency,
        Math.max(
          0,
          entries.length - 1
        )
      );


    if (
      workerCount > 0
    ) {

      await Promise.all(

        Array.from(
          {
            length:
              workerCount
          },
          () =>
            worker()
        )

      );

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



