"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const API_URL = "https://api.msmc.cc/api/eafc/players?game=fc26&update=2";
const OUTPUT = path.join(__dirname, "..", "data", "fc26-ratings.json");
const CAREER_DATA = path.join(__dirname, "..", "data", "web-data.json");

function normalizeName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sofifaPortrait(eaId) {
  const id = String(eaId).padStart(6, "0");
  return `https://cdn.sofifa.net/players/${id.slice(0, 3)}/${id.slice(3)}/26_120.png`;
}

async function main() {
  const response = await fetch(API_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`FC 26 API request failed: ${response.status}`);
  const source = await response.json();
  const rows = Array.isArray(source) ? source : source.players || source.data || [];
  const careerData = JSON.parse(await fs.readFile(CAREER_DATA, "utf8"));
  const careerByName = new Map();
  for (const player of careerData.players) {
    const key = normalizeName(player.name);
    if (!careerByName.has(key)) careerByName.set(key, []);
    careerByName.get(key).push(player);
  }
  let careerPhotoMatches = 0;
  const players = rows
    .map((row) => {
      const matches = careerByName.get(normalizeName(row.name)) || [];
      const careerPlayer = matches.length === 1 ? matches[0] : null;
      if (careerPlayer?.photo) careerPhotoMatches++;
      return {
        eaId: Number(row.id),
        name: String(row.name || "").trim(),
        gender: row.gender || "",
        age: Number(row.age) || null,
        overall: Number(row.ovr),
        position: row.position || "",
        alternativePositions: Array.isArray(row["alternative positions"])
          ? row["alternative positions"]
          : String(row["alternative positions"] || "").split(",").map((value) => value.trim()).filter(Boolean),
        nation: row.nation || "",
        league: row.league || "",
        team: row.team || "",
        photoUrl: careerPlayer?.photo || sofifaPortrait(row.id),
        photoSource: careerPlayer?.photo ? "career-data-transfermarkt" : "sofifa-ea-id",
        careerPlayerId: careerPlayer?.id || null,
        careerClubIds: careerPlayer?.clubIds || [],
        eaUrl: row.url || "",
      };
    })
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
      fallbackPortraitPattern: "https://cdn.sofifa.net/players/{EA_ID}/26_120.png",
    },
    photoCoverage: { careerDataMatches: careerPhotoMatches, eaIdPortraits: uniquePlayers.length - careerPhotoMatches },
    players: uniquePlayers,
  };
  await fs.writeFile(OUTPUT, `${JSON.stringify(payload)}\n`);
  console.log(`Wrote ${uniquePlayers.length.toLocaleString("en-US")} FC 26 players (${careerPhotoMatches.toLocaleString("en-US")} career photos, ${(uniquePlayers.length - careerPhotoMatches).toLocaleString("en-US")} EA-ID portraits) to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
