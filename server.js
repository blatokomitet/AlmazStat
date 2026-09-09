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

  try {
    let apiRequestCount = 0;

    async function fetchApiFootball(pathname, parameters) {
      apiRequestCount += 1;
      const url = new URL(`${apiFootballBaseUrl}${pathname}`);
      for (const [key, value] of Object.entries(parameters)) {
        if (value !== null && value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }

      const upstreamResponse = await fetch(url, {
        headers: {
          "x-apisports-key": apiFootballKey,
        },
      });
      const payload = await upstreamResponse.json();

      if (
        !upstreamResponse.ok ||
        (payload.errors && Object.keys(payload.errors).length > 0)
      ) {
        const error = new Error("API-Football вернул ошибку.");
        error.status = upstreamResponse.status;
        throw error;
      }

      return payload;
    }

    const fixturePayload = await fetchApiFootball("/fixtures", { id: fixture });
    const match = fixturePayload.response && fixturePayload.response[0];

    if (!match) {
      return response.status(404).json({
        error: {
          code: "FIXTURE_NOT_FOUND",
          message: "Матч с указанным fixture ID не найден.",
        },
      });
    }

    const homeId = match.teams && match.teams.home && match.teams.home.id;
    const awayId = match.teams && match.teams.away && match.teams.away.id;
    const leagueId = match.league && match.league.id;
    const season = match.league && match.league.season;

    async function optionalRequest(pathname, parameters, fallback) {
      try {
        const payload = await fetchApiFootball(pathname, parameters);
        return payload.response || fallback;
      } catch {
        return fallback;
      }
    }

    const [
      predictionResponse,
      homeForm,
      awayForm,
      h2h,
      standingsResponse,
      odds,
    ] = await Promise.all([
      optionalRequest("/predictions", { fixture }, []),
      optionalRequest("/fixtures", { team: homeId, last: 5 }, []),
      optionalRequest("/fixtures", { team: awayId, last: 5 }, []),
      optionalRequest(
        "/fixtures/headtohead",
        { h2h: `${homeId}-${awayId}`, last: 5 },
        [],
      ),
      optionalRequest("/standings", { league: leagueId, season }, []),
      optionalRequest("/odds", { fixture }, []),
    ]);

    const standingGroups =
      standingsResponse[0] &&
      standingsResponse[0].league &&
      standingsResponse[0].league.standings;
    const standingRows = Array.isArray(standingGroups)
      ? standingGroups.flat()
      : [];
    const homeStanding =
      standingRows.find((row) => row.team && row.team.id === homeId) || null;
    const awayStanding =
      standingRows.find((row) => row.team && row.team.id === awayId) || null;
    const prediction = predictionResponse[0] || null;

    const availability = {
      fixture: true,
      prediction: Boolean(prediction),
      form: homeForm.length > 0 && awayForm.length > 0,
      h2h: h2h.length > 0,
      standings: Boolean(homeStanding && awayStanding),
      odds: odds.length > 0,
    };

    return response.json({
      response: [match],
      analytics: {
        prediction,
        form: {
          home: homeForm,
          away: awayForm,
        },
        h2h,
        standings: {
          home: homeStanding,
          away: awayStanding,
        },
        odds,
        availability,
        apiRequestCount,
      },
    });
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