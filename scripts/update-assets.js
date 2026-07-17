"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  manifestPath = path.join(root, "data", "club-assets.json"),
  output = path.join(root, "assets", "clubs"),
  cache = path.join(root, "cache", "assets");
const dryRun = process.argv.includes("--dry-run"),
  delay = Number(process.env.ASSET_DELAY_MS || 750);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.mkdirSync(cache, { recursive: true });
  if (!dryRun) fs.mkdirSync(output, { recursive: true });
  const failures = [];
  for (const item of manifest) {
    if (!item.sourceUrl || !item.license || !item.file) {
      failures.push({
        id: item.clubId,
        reason: "sourceUrl, license veya file eksik",
      });
      continue;
    }
    const target = path.join(output, path.basename(item.file)),
      cached = path.join(cache, path.basename(item.file));
    if (fs.existsSync(target)) {
      console.log(`Var: ${item.file}`);
      continue;
    }
    if (dryRun) {
      console.log(`Dry-run: ${item.sourceUrl} -> ${item.file}`);
      continue;
    }
    try {
      let bytes;
      if (fs.existsSync(cached)) bytes = fs.readFileSync(cached);
      else {
        const response = await fetch(item.sourceUrl, {
          headers: { "User-Agent": "IkiFormaAssetUpdater/1.0" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(cached, bytes);
        await wait(delay);
      }
      fs.copyFileSync(cached, target);
      console.log(
        `Yazıldı: ${item.file} ${crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12)}`,
      );
    } catch (error) {
      failures.push({
        id: item.clubId,
        url: item.sourceUrl,
        reason: error.message,
      });
    }
  }
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
