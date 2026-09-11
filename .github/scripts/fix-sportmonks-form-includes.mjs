import fs from "node:fs";

const providerPath = "lib/sportmonks-provider.js";
let provider = fs.readFileSync(providerPath, "utf8");

const oldBlock = `      include: [
        "latest.participants",
        "latest.scores",
        "latest.state",
        "latest.league",
        "latest.statistics.type",
        "latest.xGFixture.type",
      ].join(";"),`;

const newBlock = `      // Keep Recent Form deliberately lightweight. Team-by-ID supports the
      // latest fixture relation and up to three nested include levels; the
      // form card only needs participants, scores, state and league.
      include: [
        "latest.participants",
        "latest.scores",
        "latest.state",
        "latest.league",
      ].join(";"),`;

if (!provider.includes(oldBlock)) {
  throw new Error("Recent form include block not found");
}

provider = provider.replace(oldBlock, newBlock);
fs.writeFileSync(providerPath, provider);
