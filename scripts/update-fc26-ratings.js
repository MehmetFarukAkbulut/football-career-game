"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const API_URL = "https://api.msmc.cc/api/eafc/players?game=fc26&update=2";
const OUTPUT = path.join(__dirname, "..", "data", "fc26-ratings.json");

async function main() {
  const response = await fetch(API_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`FC 26 API request failed: ${response.status}`);
  const source = await response.json();
  const rows = Array.isArray(source) ? source : source.players || source.data || [];
  const players = rows
    .map((row) => ({
      eaId: Number(row.id),
      name: String(row.name || "").trim(),
      gender: row.gender || "",
      overall: Number(row.ovr),
      position: row.position || "",
      alternativePositions: Array.isArray(row["alternative positions"])
        ? row["alternative positions"]
        : String(row["alternative positions"] || "").split(",").map((value) => value.trim()).filter(Boolean),
      nation: row.nation || "",
      league: row.league || "",
      team: row.team || "",
      cardUrl: row.card || "",
      eaUrl: row.url || "",
    }))
    .filter((player) => player.eaId && player.name && Number.isFinite(player.overall) && player.position)
    .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, "en"));
  const seen = new Set();
  const uniquePlayers = players.filter((player) => !seen.has(player.eaId) && seen.add(player.eaId));
  const payload = {
    version: "fc26-update-2",
    generatedAt: new Date().toISOString(),
    source: {
      officialRatingsUrl: "https://careers.ea.com/games/ea-sports-fc/ratings",
      apiDocumentationUrl: "https://api.msmc.cc/eafc/",
      apiUrl: API_URL,
    },
    players: uniquePlayers,
  };
  await fs.writeFile(OUTPUT, `${JSON.stringify(payload)}\n`);
  console.log(`Wrote ${uniquePlayers.length.toLocaleString("en-US")} FC 26 players to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
