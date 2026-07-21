"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const currentFile = path.join(
  root,
  "data",
  "web-data.json"
);

const backupFile = path.join(
  root,
  "data",
  "web-data-before-refresh.json"
);

if (!fs.existsSync(currentFile)) {
  throw new Error(`Current data bulunamadı: ${currentFile}`);
}

if (!fs.existsSync(backupFile)) {
  throw new Error(`Refresh öncesi veri bulunamadı: ${backupFile}`);
}

const fresh = JSON.parse(
  fs.readFileSync(currentFile, "utf8")
);

const previous = JSON.parse(
  fs.readFileSync(backupFile, "utf8")
);

const previousById = new Map(
  (previous.players || []).map((player) => [
    String(player.id),
    player,
  ])
);

const isEmpty = (value) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (
    Array.isArray(value) &&
    value.length === 0
  );

const keepOldWhenFreshEmpty = (
  freshPlayer,
  oldPlayer,
  field
) => {
  if (
    isEmpty(freshPlayer[field]) &&
    !isEmpty(oldPlayer[field])
  ) {
    freshPlayer[field] =
      oldPlayer[field];
  }
};

const cumulativeFields = [
  "appearances",
  "goals",
  "assists",
  "careerGoals",
  "nationalCaps",
  "nationalGoals",
  "yellowCards",
  "redCards",
];

const maxCumulative = (
  freshPlayer,
  oldPlayer,
  field
) => {
  const freshValue =
    Number(freshPlayer[field]);

  const oldValue =
    Number(oldPlayer[field]);

  if (
    Number.isFinite(oldValue) &&
    (
      !Number.isFinite(freshValue) ||
      freshValue < oldValue
    )
  ) {
    freshPlayer[field] =
      oldPlayer[field];
  }
};

let protectedEmptyFields = 0;
let protectedStatistics = 0;

for (const player of fresh.players || []) {

  const oldPlayer =
    previousById.get(
      String(player.id)
    );

  if (!oldPlayer) {
    continue;
  }

  /*
   * Elle düzeltilmiş / mevcut dolu bilgiler,
   * yeni kaynak boş dönerse ASLA silinmez.
   */
  const protectedFields = [
    "nationality",
    "birthDate",
    "photoUrl",
  ];

  for (const field of protectedFields) {

    const before =
      player[field];

    keepOldWhenFreshEmpty(
      player,
      oldPlayer,
      field
    );

    if (
      before !== player[field]
    ) {
      protectedEmptyFields++;
    }
  }

  /*
   * Kariyer toplamları geriye gitmemeli.
   */
  for (
    const field of cumulativeFields
  ) {

    const before =
      player[field];

    maxCumulative(
      player,
      oldPlayer,
      field
    );

    if (
      before !== player[field]
    ) {
      protectedStatistics++;
    }
  }

  /*
   * Career/club geçmişi yeni dataset tarafından
   * tamamen boşaltılmışsa eskisini koru.
   */
  if (
    (!player.clubIds ||
      player.clubIds.length === 0) &&
    oldPlayer.clubIds?.length
  ) {
    player.clubIds =
      [...oldPlayer.clubIds];

    protectedEmptyFields++;
  }

  if (
    (!player.careers ||
      player.careers.length === 0) &&
    oldPlayer.careers?.length
  ) {
    player.careers =
      structuredClone(
        oldPlayer.careers
      );

    protectedEmptyFields++;
  }

  /*
   * currentSeasonStats:
   * yalnız AYNI sezon setiyse geriye gitmesine izin verme.
   */
  const freshCurrent =
    player.currentSeasonStats;

  const oldCurrent =
    oldPlayer.currentSeasonStats;

  if (
    freshCurrent &&
    oldCurrent
  ) {

    const freshSeasons =
      JSON.stringify(
        [...(freshCurrent.seasons || [])]
          .sort()
      );

    const oldSeasons =
      JSON.stringify(
        [...(oldCurrent.seasons || [])]
          .sort()
      );

    if (
      freshSeasons === oldSeasons
    ) {

      for (
        const field of [
          "appearances",
          "goals",
          "assists",
          "minutesPlayed",
          "yellowCards",
          "redCards",
        ]
      ) {

        const freshValue =
          Number(
            freshCurrent[field]
          );

        const oldValue =
          Number(
            oldCurrent[field]
          );

        if (
          Number.isFinite(oldValue) &&
          (
            !Number.isFinite(freshValue) ||
            freshValue < oldValue
          )
        ) {
          freshCurrent[field] =
            oldCurrent[field];

          protectedStatistics++;
        }
      }
    }
  }
}

fs.writeFileSync(
  currentFile,
  JSON.stringify(fresh),
  "utf8"
);

console.log(
  `Korunan boş/eski alan: ${protectedEmptyFields}`
);

console.log(
  `Geri gitmesi engellenen istatistik: ${protectedStatistics}`
);