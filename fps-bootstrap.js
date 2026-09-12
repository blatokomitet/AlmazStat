import fs from "node:fs";

if (!process.env.PORT) process.env.PORT = "11097";

if (!process.env.SPORTMONKS_API_TOKEN) {
  const tokenFile = "/home/container/.sportmonks-token";
  if (fs.existsSync(tokenFile)) {
    const token = fs.readFileSync(tokenFile, "utf8").trim();
    if (token) process.env.SPORTMONKS_API_TOKEN = token;
  }
}

await import("./server.js");
