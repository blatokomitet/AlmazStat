import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT);
const apiFootballKey = process.env.API_FOOTBALL_KEY;
const apiFootballBaseUrl = "https://v3.football.api-sports.io";
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT environment variable must contain a valid port number.");
}

app.get("/api/match", async (request, response) => {
  const fixture = String(request.query.fixture || "").trim();

  if (!fixture) {
    return response.status(400).json({
      error: {
        code: "MISSING_FIXTURE",
        message: "Необходимо передать fixture ID в query parameter.",
      },
    });
  }

  if (!apiFootballKey) {
    return response.status(503).json({
      error: {
        code: "MISSING_API_KEY",
        message:
          "Сервис API-Football не настроен: добавьте API_FOOTBALL_KEY в environment variables.",
      },
    });
  }

  const url = new URL(`${apiFootballBaseUrl}/fixtures`);
  url.searchParams.set("id", fixture);

  try {
    const upstreamResponse = await fetch(url, {
      headers: {
        "x-apisports-key": apiFootballKey,
      },
    });
    const payload = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      return response.status(502).json({
        error: {
          code: "UPSTREAM_ERROR",
          message: `API-Football вернул HTTP ${upstreamResponse.status}.`,
          details: payload.errors || payload,
        },
      });
    }

    if (payload.errors && Object.keys(payload.errors).length > 0) {
      return response.status(502).json({
        error: {
          code: "UPSTREAM_ERROR",
          message: "API-Football вернул ошибку.",
          details: payload.errors,
        },
      });
    }

    return response.json(payload);
  } catch (error) {
    console.error("API-Football request failed:", error);
    return response.status(502).json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Не удалось связаться с API-Football.",
      },
    });
  }
});

app.use(express.static(currentDirectory));

app.listen(port, "0.0.0.0", () => {
  console.log(`AlmazStat server listening on port ${port}`);
});