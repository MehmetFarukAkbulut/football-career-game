const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.cwd();
const dataDir = path.join(root, "data");

const careerFile =
  path.join(dataDir, "web-data.json");

const fcFile =
  path.join(dataDir, "fc26-ratings.json");

const career =
  JSON.parse(
    fs.readFileSync(
      careerFile,
      "utf8"
    )
  );

const fc =
  JSON.parse(
    fs.readFileSync(
      fcFile,
      "utf8"
    )
  );


function hashData(value) {

  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        version: value.version,
        count: value.players?.length || 0,
        first: value.players?.[0]?.id ||
               value.players?.[0]?.eaId ||
               null,
        last:
          value.players?.[
            (value.players?.length || 1) - 1
          ]?.id ||
          value.players?.[
            (value.players?.length || 1) - 1
          ]?.eaId ||
          null
      })
    )
    .digest("hex")
    .slice(0, 12);

}


function buildChunks({
  source,
  prefix,
  bootstrapName,
  manifestName,
  chunkSize
}) {

  const players =
    Array.isArray(source.players)
      ? source.players
      : [];

  const hash =
    hashData(source);

  const chunkRoot =
    path.join(
      dataDir,
      "chunks",
      hash
    );

  fs.mkdirSync(
    chunkRoot,
    {
      recursive: true
    }
  );


  const chunks = [];


  for (
    let start = 0;
    start < players.length;
    start += chunkSize
  ) {

    const index =
      Math.floor(
        start / chunkSize
      );

    const filename =
      `${prefix}-${String(index).padStart(3, "0")}.json`;

    const relativePath =
      `data/chunks/${hash}/${filename}`;

    const chunk =
      players.slice(
        start,
        start + chunkSize
      );


    fs.writeFileSync(
      path.join(
        chunkRoot,
        filename
      ),
      JSON.stringify(chunk)
    );


    chunks.push({
      url: relativePath,
      count: chunk.length
    });

  }


  const bootstrap = {
    ...source,
    players: []
  };


  fs.writeFileSync(
    path.join(
      dataDir,
      bootstrapName
    ),
    JSON.stringify(
      bootstrap
    )
  );


  const manifest = {

    version:
      source.version || hash,

    hash,

    totalPlayers:
      players.length,

    chunkSize,

    chunks

  };


  fs.writeFileSync(
    path.join(
      dataDir,
      manifestName
    ),
    JSON.stringify(
      manifest
    )
  );


  return {
    prefix,
    totalPlayers:
      players.length,
    chunks:
      chunks.length,
    hash
  };

}


const careerResult =
  buildChunks({

    source:
      career,

    prefix:
      "career",

    bootstrapName:
      "career-bootstrap.json",

    manifestName:
      "career-manifest.json",

    /*
      Career player objects are larger.
      Keep individual JSON parse tasks small.
    */
    chunkSize:
      500

  });


const fcResult =
  buildChunks({

    source:
      fc,

    prefix:
      "fc26",

    bootstrapName:
      "fc26-bootstrap.json",

    manifestName:
      "fc26-manifest.json",

    chunkSize:
      750

  });


console.log(
  JSON.stringify(
    {
      career:
        careerResult,
      fc26:
        fcResult
    },
    null,
    2
  )
);
