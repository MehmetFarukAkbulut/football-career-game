"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "data", "import-cache");

const base =
  "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data";

const files = [
  "clubs.csv.gz",
  "players.csv.gz",
  "appearances.csv.gz",
  "games.csv.gz",
  "player_valuations.csv.gz",
  "transfers.csv.gz"
];

fs.mkdirSync(dir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validFile(file) {
  try {
    return fs.existsSync(file) && fs.statSync(file).size > 100;
  } catch {
    return false;
  }
}

async function downloadOnce(url, partFile) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    120000
  );

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "FormaX-Data-Updater/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error("Response body bulunamadi.");
    }

    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(partFile)
    );

    if (!validFile(partFile)) {
      throw new Error("Indirilen dosya gecersiz.");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadFile(file) {
  const url = `${base}/${file}`;
  const target = path.join(dir, file);
  const part = `${target}.part`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(
      `[${file}] guncelleme denemesi ${attempt}/3`
    );

    try {
      if (fs.existsSync(part)) {
        fs.unlinkSync(part);
      }

      await downloadOnce(url, part);

      if (fs.existsSync(target)) {
        const backup = `${target}.previous`;

        if (fs.existsSync(backup)) {
          fs.unlinkSync(backup);
        }

        fs.renameSync(target, backup);
      }

      fs.renameSync(part, target);

      console.log(
        `OK: ${file} guncellendi.`
      );

      return {
        file,
        updated: true
      };
    } catch (error) {
      console.warn(
        `WARNING: ${file}: ${error.message}`
      );

      try {
        if (fs.existsSync(part)) {
          fs.unlinkSync(part);
        }
      } catch {}

      if (attempt < 3) {
        await sleep(attempt * 3000);
      }
    }
  }

  if (validFile(target)) {
    console.warn(
      `CACHE: ${file} guncellenemedi. Mevcut dosya kullanilacak.`
    );

    return {
      file,
      updated: false,
      cached: true
    };
  }

  console.warn(
    `SKIP: ${file} bulunamadi ve indirilemedi.`
  );

  return {
    file,
    updated: false,
    cached: false
  };
}

async function main() {
  console.log(
    "FormaX veri guncelleme kontrolu basliyor..."
  );

  const results = [];

  for (const file of files) {
    results.push(
      await downloadFile(file)
    );
  }

  const updated =
    results.filter((item) => item.updated);

  const cached =
    results.filter(
      (item) => !item.updated && item.cached
    );

  const missing =
    results.filter(
      (item) => !item.updated && !item.cached
    );

  console.log("");
  console.log(
    `Yeni indirilen: ${updated.length}`
  );

  console.log(
    `Mevcut cache kullanilan: ${cached.length}`
  );

  console.log(
    `Eksik: ${missing.length}`
  );

  console.log("");

  if (missing.length > 0) {
    console.warn(
      "Bazi opsiyonel veri dosyalari eksik. Mevcut veriler korunarak devam edilebilir."
    );
  }

  /*
    Local development:
      Existing cache may be used when remote download is unavailable.

    CI / GitHub Actions:
      At least one fresh file must be downloaded.
      Otherwise the workflow must not create a fake "fresh data" commit.
  */

  if (
    process.env.CI === "true" &&
    updated.length === 0
  ) {
    throw new Error(
      "CI data refresh failed: no fresh dataset file could be downloaded."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});