"use strict";

const fs =
  require(
    "node:fs"
  );

const path =
  require(
    "node:path"
  );

const zlib =
  require(
    "node:zlib"
  );

const readline =
  require(
    "node:readline"
  );


const root =
  path.resolve(
    __dirname,
    ".."
  );


const dataDir =
  path.join(
    root,
    "data"
  );


const cacheDir =
  path.join(
    dataDir,
    "import-cache"
  );


const webFile =
  path.join(
    dataDir,
    "web-data.json"
  );


function parseCsvLine(
  line
) {

  const values =
    [];

  let value =
    "";

  let quoted =
    false;


  for (
    let index = 0;
    index < line.length;
    index++
  ) {

    const char =
      line[index];


    if (
      char === '"'
    ) {

      if (
        quoted &&
        line[index + 1] === '"'
      ) {

        value += '"';

        index++;

      }
      else {

        quoted =
          !quoted;

      }

      continue;

    }


    if (
      char === "," &&
      !quoted
    ) {

      values.push(
        value
      );

      value =
        "";

      continue;

    }


    value +=
      char;

  }


  values.push(
    value
  );


  return values;

}


async function readGzipCsv(
  file,
  onRow
) {

  if (
    !fs.existsSync(
      file
    )
  ) {

    throw new Error(
      `Missing data file: ${file}`
    );

  }


  const stream =
    fs
      .createReadStream(
        file
      )
      .pipe(
        zlib.createGunzip()
      );


  const lines =
    readline.createInterface({

      input:
        stream,

      crlfDelay:
        Infinity

    });


  let headers =
    null;


  for await (
    const line of lines
  ) {

    const values =
      parseCsvLine(
        line
      );


    if (
      !headers
    ) {

      headers =
        values;

      continue;

    }


    const row =
      {};


    for (
      let index = 0;
      index < headers.length;
      index++
    ) {

      row[
        headers[index]
      ] =
        values[index];

    }


    onRow(
      row
    );

  }

}


function number(
  value
) {

  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;

}


async function main() {

  const data =
    JSON.parse(
      fs.readFileSync(
        webFile,
        "utf8"
      )
    );


  const wantedPlayers =
    new Set(
      data.players.map(
        (player) =>
          String(
            player.id
          )
      )
    );


  /*
    GAME MAP

    Determine the most recent season available
    independently for each competition.

    This works for:
      European 2025/26
      MLS 2026
      Brazil 2026
      etc.
  */

  const games =
    new Map();


  const latestSeason =
    new Map();


  await readGzipCsv(

    path.join(
      cacheDir,
      "games.csv.gz"
    ),

    (row) => {

      const gameId =
        String(
          row.game_id ||
          ""
        );


      const competitionId =
        String(
          row.competition_id ||
          "UNKNOWN"
        );


      const season =
        number(
          row.season
        );


      if (
        !gameId
      ) {

        return;

      }


      games.set(
        gameId,
        {

          competitionId,

          season,

          date:
            row.date ||
            null

        }
      );


      const previous =
        latestSeason.get(
          competitionId
        );


      if (
        previous === undefined ||
        season > previous
      ) {

        latestSeason.set(
          competitionId,
          season
        );

      }

    }

  );


  const statistics =
    new Map();


  await readGzipCsv(

    path.join(
      cacheDir,
      "appearances.csv.gz"
    ),

    (row) => {

      const playerId =
        String(
          row.player_id ||
          ""
        );


      if (
        !wantedPlayers.has(
          playerId
        )
      ) {

        return;

      }


      const game =
        games.get(
          String(
            row.game_id ||
            ""
          )
        );


      if (
        !game
      ) {

        return;

      }


      if (
        latestSeason.get(
          game.competitionId
        ) !==
        game.season
      ) {

        return;

      }


      let stats =
        statistics.get(
          playerId
        );


      if (
        !stats
      ) {

        stats = {

          appearances:
            0,

          goals:
            0,

          assists:
            0,

          minutesPlayed:
            0,

          yellowCards:
            0,

          redCards:
            0,

          competitions:
            new Set(),

          seasons:
            new Set()

        };


        statistics.set(
          playerId,
          stats
        );

      }


      stats.appearances +=
        1;


      stats.goals +=
        number(
          row.goals
        );


      stats.assists +=
        number(
          row.assists
        );


      stats.minutesPlayed +=
        number(
          row.minutes_played ||
          row.minutes
        );


      stats.yellowCards +=
        number(
          row.yellow_cards
        );


      stats.redCards +=
        number(
          row.red_cards
        );


      stats.competitions.add(
        game.competitionId
      );


      stats.seasons.add(
        game.season
      );

    }

  );


  /*
    Latest market values.
  */

  const valuations =
    new Map();


    const valuationFile =
    path.join(
      cacheDir,
      "player_valuations.csv.gz"
    );

  if (
    fs.existsSync(
      valuationFile
    )
  ) {
await readGzipCsv(

    path.join(
      cacheDir,
      "player_valuations.csv.gz"
    ),

    (row) => {

      const playerId =
        String(
          row.player_id ||
          ""
        );


      if (
        !wantedPlayers.has(
          playerId
        )
      ) {

        return;

      }


      const date =
        row.date ||
        "";


      const previous =
        valuations.get(
          playerId
        );


      if (
        !previous ||
        date >
          previous.date
      ) {

        valuations.set(
          playerId,
          {

            date,

            marketValueEur:
              number(
                row.market_value_in_eur
              )

          }
        );

      }

    }

  );
  }
  else {

    console.warn(
      "WARNING: player_valuations.csv.gz bulunamadi. Mevcut piyasa degerleri korunacak."
    );

  }



  const updatedAt =
    new Date()
      .toISOString();

  const sourceFiles = [
    "players.csv.gz",
    "games.csv.gz",
    "appearances.csv.gz"
  ]
    .map((name) =>
      path.join(
        cacheDir,
        name
      )
    )
    .filter((file) =>
      fs.existsSync(file)
    );

  const sourceDataAsOf =
    sourceFiles.length > 0
      ? new Date(
          Math.max(
            ...sourceFiles.map(
              (file) =>
                fs.statSync(file).mtimeMs
            )
          )
        ).toISOString()
      : null;


  let updatedPlayers =
    0;


  for (
    const player of data.players
  ) {

    const id =
      String(
        player.id
      );


    const stats =
      statistics.get(
        id
      );


    if (
      stats
    ) {

      player.currentSeasonStats = {

        appearances:
          stats.appearances,

        goals:
          stats.goals,

        assists:
          stats.assists,

        minutesPlayed:
          stats.minutesPlayed,

        yellowCards:
          stats.yellowCards,

        redCards:
          stats.redCards,

        competitions:
          [
            ...stats.competitions
          ],

        seasons:
          [
            ...stats.seasons
          ],

        updatedAt,

        sourceDataAsOf

      };


      updatedPlayers++;

    }


    const valuation =
      valuations.get(
        id
      );


    if (
      valuation
    ) {

      player.marketValueEur =
        valuation.marketValueEur;


      player.marketValueAsOf =
        valuation.date;

    }


    player.statisticsAsOf =
      updatedAt;

  }


  data.generatedAt =
    updatedAt;


  data.statistics =
    {

      ...(data.statistics || {}),

      currentSeasonSource:
        "dcaribou/transfermarkt-datasets",

      currentSeasonUpdatedAt:
        updatedAt,

        sourceDataAsOf,

      currentSeasonPlayers:
        updatedPlayers,

      refreshPolicy:
        "Weekly full dataset refresh",

      freshness:
        "Latest published open dataset snapshot"

    };


  fs.writeFileSync(

    webFile,

    JSON.stringify(
      data
    )

  );


  console.log("");
  console.log(
    "FormaX current player statistics refreshed."
  );

  console.log(
    `Players updated: ${updatedPlayers}`
  );

  console.log(
    `As of: ${updatedAt}`
  );

}


main().catch(
  (error) => {

    console.error(
      error
    );

    process.exitCode =
      1;

  }
);
