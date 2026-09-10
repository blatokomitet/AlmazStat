import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT);
const apiFootballKey = process.env.API_FOOTBALL_KEY;
const apiFootballBaseUrl = "https://v3.football.api-sports.io";
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataCache = new Map();

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT environment variable must contain a valid port number.");
}

function serverDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeMatch(match) {
  return {
    fixtureId: match.fixture?.id ?? null,
    date: match.fixture?.date ?? null,
    timestamp: match.fixture?.timestamp ?? null,
    status: {
      short: match.fixture?.status?.short ?? null,
      long: match.fixture?.status?.long ?? null,
      elapsed: match.fixture?.status?.elapsed ?? null,
    },
    league: {
      id: match.league?.id ?? null,
      name: match.league?.name ?? null,
      country: match.league?.country ?? null,
      logo: match.league?.logo ?? null,
    },
    home: {
      id: match.teams?.home?.id ?? null,
      name: match.teams?.home?.name ?? null,
      logo: match.teams?.home?.logo ?? null,
    },
    away: {
      id: match.teams?.away?.id ?? null,
      name: match.teams?.away?.name ?? null,
      logo: match.teams?.away?.logo ?? null,
    },
    goals: {
      home: match.goals?.home ?? null,
      away: match.goals?.away ?? null,
    },
  };
}

function formResult(match, teamId) {
  const isHome = match.teams?.home?.id === teamId;
  const isAway = match.teams?.away?.id === teamId;
  const homeGoals = match.goals?.home;
  const awayGoals = match.goals?.away;
  if (
    (!isHome && !isAway) ||
    homeGoals === null ||
    homeGoals === undefined ||
    awayGoals === null ||
    awayGoals === undefined
  ) {
    return null;
  }
  const teamGoals = isHome ? homeGoals : awayGoals;
  const opponentGoals = isHome ? awayGoals : homeGoals;
  if (teamGoals > opponentGoals) return "W";
  if (teamGoals < opponentGoals) return "L";
  return "D";
}

function normalizeFormMatch(match, teamId) {
  const isHome = match.teams?.home?.id === teamId;
  const opponent = isHome ? match.teams?.away : match.teams?.home;
  return {
    fixtureId: match.fixture?.id ?? null,
    date: match.fixture?.date ?? null,
    opponent: {
      id: opponent?.id ?? null,
      name: opponent?.name ?? null,
      logo: opponent?.logo ?? null,
    },
    side: isHome ? "H" : "A",
    score: {
      home: match.goals?.home ?? null,
      away: match.goals?.away ?? null,
    },
    result: formResult(match, teamId),
    league: match.league?.name ?? null,
  };
}

function normalizeH2hMatch(match) {
  return {
    fixtureId: match.fixture?.id ?? null,
    date: match.fixture?.date ?? null,
    league: match.league?.name ?? null,
    home: {
      id: match.teams?.home?.id ?? null,
      name: match.teams?.home?.name ?? null,
      logo: match.teams?.home?.logo ?? null,
    },
    away: {
      id: match.teams?.away?.id ?? null,
      name: match.teams?.away?.name ?? null,
      logo: match.teams?.away?.logo ?? null,
    },
    score: {
      home: match.goals?.home ?? null,
      away: match.goals?.away ?? null,
    },
  };
}

function normalizeStanding(row) {
  if (!row) return null;
  return {
    rank: row.rank ?? null,
    team: {
      id: row.team?.id ?? null,
      name: row.team?.name ?? null,
      logo: row.team?.logo ?? null,
    },
    played: row.all?.played ?? null,
    win: row.all?.win ?? null,
    draw: row.all?.draw ?? null,
    lose: row.all?.lose ?? null,
    goalsFor: row.all?.goals?.for ?? null,
    goalsAgainst: row.all?.goals?.against ?? null,
    goalDifference: row.goalsDiff ?? null,
    points: row.points ?? null,
    form: row.form ?? null,
  };
}

function normalizeOdds(oddsResponse) {
  const rows = [];
  const preferredMarkets = new Set([
    "match winner",
    "goals over/under",
    "both teams score",
    "double chance",
  ]);
  for (const fixtureOdds of oddsResponse || []) {
    for (const bookmaker of fixtureOdds.bookmakers || []) {
      for (const market of bookmaker.bets || []) {
        for (const option of market.values || []) {
          rows.push({
            bookmaker: bookmaker.name ?? null,
            market: market.name ?? null,
            option: option.value ?? null,
            odd: option.odd ?? null,
          });
        }
      }
    }
  }
  const preferred = rows.filter((row) =>
    preferredMarkets.has(String(row.market || "").toLowerCase()),
  );
  return (preferred.length ? preferred : rows).slice(0, 24);
}

function normalizePrediction(prediction) {
  const data = prediction?.predictions;
  if (!data) return null;
  return {
    winner: data.winner?.name ?? null,
    winnerComment: data.winner?.comment ?? null,
    advice: data.advice ?? null,
    percent: {
      home: data.percent?.home ?? null,
      draw: data.percent?.draw ?? null,
      away: data.percent?.away ?? null,
    },
    goals: {
      home: data.goals?.home ?? null,
      away: data.goals?.away ?? null,
    },
    underOver: data.under_over ?? null,
  };
}

function riskFromSources(sources) {
  const totalSources = 6;
  const knownValues = Object.values(sources).filter(
    (value) => value === true || value === false,
  );
  const availableSources = knownValues.filter(Boolean).length;
  const knownSources = knownValues.length;
  const score =
    knownSources === 0
      ? 0
      : Math.round(((knownSources - availableSources) / knownSources) * 100);
  return {
    score,
    level:
      score <= 33
        ? "LOW DATA RISK"
        : score <= 66
          ? "MEDIUM DATA RISK"
          : "HIGH DATA RISK",
    availableSources,
    totalSources,
    knownSources,
  };
}

function fixtureCacheTtl(statusShort) {
  if (["FT", "AET", "PEN"].includes(statusShort)) {
    return 24 * 60 * 60 * 1000;
  }
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(statusShort)) {
    return 5 * 60 * 1000;
  }
  return 30 * 60 * 1000;
}

function cachedValue(key) {
  const entry = dataCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    dataCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedValue(key, value, ttl) {
  dataCache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
  return value;
}

async function fetchApiFootball(pathname, parameters, counter) {
  counter.count += 1;
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
    throw new Error("API-Football вернул ошибку.");
  }
  return payload.response || [];
}

function normalizeFixtureDetails(match) {
  return {
    fixture: {
      id: match.fixture?.id ?? null,
      date: match.fixture?.date ?? null,
      timestamp: match.fixture?.timestamp ?? null,
      status: {
        short: match.fixture?.status?.short ?? null,
        long: match.fixture?.status?.long ?? null,
        elapsed: match.fixture?.status?.elapsed ?? null,
      },
      venue: match.fixture?.venue?.name ?? null,
    },
    league: {
      id: match.league?.id ?? null,
      name: match.league?.name ?? null,
      country: match.league?.country ?? null,
      logo: match.league?.logo ?? null,
      season: match.league?.season ?? null,
      round: match.league?.round ?? null,
    },
    home: {
      id: match.teams?.home?.id ?? null,
      name: match.teams?.home?.name ?? null,
      logo: match.teams?.home?.logo ?? null,
      winner: match.teams?.home?.winner ?? null,
    },
    away: {
      id: match.teams?.away?.id ?? null,
      name: match.teams?.away?.name ?? null,
      logo: match.teams?.away?.logo ?? null,
      winner: match.teams?.away?.winner ?? null,
    },
    score: {
      home: match.goals?.home ?? null,
      away: match.goals?.away ?? null,
    },
  };
}

async function getFixtureDetails(fixtureId, counter) {
  const key = `fixture:${fixtureId}`;
  const cached = cachedValue(key);
  if (cached !== undefined) return cached;
  const matches = await fetchApiFootball("/fixtures", { id: fixtureId }, counter);
  if (!matches[0]) return null;
  const normalized = normalizeFixtureDetails(matches[0]);
  return setCachedValue(
    key,
    normalized,
    fixtureCacheTtl(normalized.fixture.status.short),
  );
}

function requireApiKey(response) {
  if (apiFootballKey) return true;
  response.status(503).json({
    error: {
      code: "MISSING_API_KEY",
      message:
        "Сервис API-Football не настроен: добавьте API_FOOTBALL_KEY в environment variables.",
    },
  });
  return false;
}

app.get("/health", (_request, response) => {
  return response.json({
    status: "ok",
    service: "almazstat",
  });
});

app.get("/api/matches", async (request, response) => {
  const date = String(request.query.date || serverDate()).trim();

  if (!isValidDate(date)) {
    return response.status(400).json({
      error: {
        code: "INVALID_DATE",
        message: "Дата должна быть в формате YYYY-MM-DD.",
      },
    });
  }

  if (!requireApiKey(response)) return;

  try {
    const cacheKey = `matches:${date}`;
    const cachedMatches = cachedValue(cacheKey);
    if (cachedMatches !== undefined) {
      return response.json({
        date,
        matches: cachedMatches,
        apiRequestCount: 0,
      });
    }

    const url = new URL(`${apiFootballBaseUrl}/fixtures`);
    url.searchParams.set("date", date);

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
      throw new Error("API-Football вернул ошибку.");
    }

    const matches = Array.isArray(payload.response)
      ? payload.response
          .map(normalizeMatch)
          .filter((match) => match.fixtureId !== null)
      : [];
    const hasLiveMatches = matches.some((match) =>
      ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"].includes(
        match.status.short,
      ),
    );
    setCachedValue(
      cacheKey,
      matches,
      hasLiveMatches ? 60 * 1000 : 10 * 60 * 1000,
    );

    return response.json({
      date,
      matches,
      apiRequestCount: 1,
    });
  } catch (error) {
    console.error("API-Football matches request failed:", error);
    return response.status(502).json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Не удалось загрузить матчи.",
      },
    });
  }
});

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

  if (!requireApiKey(response)) return;

  try {
    const counter = { count: 0 };
    const fixtureData = await getFixtureDetails(fixture, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: {
          code: "FIXTURE_NOT_FOUND",
          message: "Матч с указанным fixture ID не найден.",
        },
      });
    }

    const predictionKey = `prediction:${fixture}`;
    let prediction = cachedValue(predictionKey);
    if (prediction === undefined) {
      try {
        const predictionResponse = await fetchApiFootball(
          "/predictions",
          { fixture },
          counter,
        );
        prediction = normalizePrediction(predictionResponse[0]);
      } catch {
        prediction = null;
      }
      setCachedValue(predictionKey, prediction, 30 * 60 * 1000);
    }

    const sources = {
      fixture: true,
      prediction: Boolean(prediction),
      form: "unknown",
      h2h: "unknown",
      standings: "unknown",
      odds: "unknown",
    };

    return response.json({
      ...fixtureData,
      prediction,
      sources,
      risk: riskFromSources(sources),
      meta: {
        apiRequestCount: counter.count,
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

app.get("/api/match/:fixture/form", async (request, response) => {
  if (!requireApiKey(response)) return;
  const fixtureId = String(request.params.fixture || "").trim();
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
      });
    }

    const key = `form:${fixtureId}`;
    let result = cachedValue(key);
    if (result === undefined) {
      const safeFixtures = async (team) => {
        try {
          return await fetchApiFootball(
            "/fixtures",
            { team, last: 5 },
            counter,
          );
        } catch {
          return [];
        }
      };
      const [homeMatches, awayMatches] = await Promise.all([
        safeFixtures(fixtureData.home.id),
        safeFixtures(fixtureData.away.id),
      ]);
      const form = {
        home: homeMatches
          .slice(0, 5)
          .map((match) => normalizeFormMatch(match, fixtureData.home.id)),
        away: awayMatches
          .slice(0, 5)
          .map((match) => normalizeFormMatch(match, fixtureData.away.id)),
      };
      result = {
        form,
        source: form.home.length > 0 && form.away.length > 0,
      };
      setCachedValue(key, result, 30 * 60 * 1000);
    }

    return response.json({
      ...result,
      meta: { apiRequestCount: counter.count },
    });
  } catch (error) {
    console.error("API-Football form request failed:", error);
    return response.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить форму." },
    });
  }
});

app.get("/api/match/:fixture/h2h", async (request, response) => {
  if (!requireApiKey(response)) return;
  const fixtureId = String(request.params.fixture || "").trim();
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
      });
    }

    const key = `h2h:${fixtureId}`;
    let result = cachedValue(key);
    if (result === undefined) {
      let matches = [];
      try {
        matches = await fetchApiFootball(
          "/fixtures/headtohead",
          { h2h: `${fixtureData.home.id}-${fixtureData.away.id}`, last: 5 },
          counter,
        );
      } catch {
        matches = [];
      }
      const h2h = matches.slice(0, 5).map(normalizeH2hMatch);
      result = { h2h, source: h2h.length > 0 };
      setCachedValue(key, result, 6 * 60 * 60 * 1000);
    }

    return response.json({
      ...result,
      meta: { apiRequestCount: counter.count },
    });
  } catch (error) {
    console.error("API-Football H2H request failed:", error);
    return response.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить очные встречи." },
    });
  }
});

app.get("/api/match/:fixture/standings", async (request, response) => {
  if (!requireApiKey(response)) return;
  const fixtureId = String(request.params.fixture || "").trim();
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
      });
    }

    const key = `standings:${fixtureData.league.id}:${fixtureData.league.season}`;
    let rows = cachedValue(key);
    if (rows === undefined) {
      try {
        const standingsResponse = await fetchApiFootball(
          "/standings",
          {
            league: fixtureData.league.id,
            season: fixtureData.league.season,
          },
          counter,
        );
        const groups = standingsResponse[0]?.league?.standings;
        rows = Array.isArray(groups)
          ? groups.flat().map(normalizeStanding)
          : [];
      } catch {
        rows = [];
      }
      setCachedValue(key, rows, 15 * 60 * 1000);
    }

    const home =
      rows.find((row) => row?.team?.id === fixtureData.home.id) || null;
    const away =
      rows.find((row) => row?.team?.id === fixtureData.away.id) || null;
    return response.json({
      standings: { home, away },
      season: fixtureData.league.season,
      source: Boolean(home && away),
      meta: { apiRequestCount: counter.count },
    });
  } catch (error) {
    console.error("API-Football standings request failed:", error);
    return response.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить таблицу." },
    });
  }
});

app.get("/api/match/:fixture/odds", async (request, response) => {
  if (!requireApiKey(response)) return;
  const fixtureId = String(request.params.fixture || "").trim();
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
      });
    }

    const key = `odds:${fixtureId}`;
    let result = cachedValue(key);
    if (result === undefined) {
      let oddsResponse = [];
      try {
        oddsResponse = await fetchApiFootball(
          "/odds",
          { fixture: fixtureId },
          counter,
        );
      } catch {
        oddsResponse = [];
      }
      const odds = normalizeOdds(oddsResponse);
      result = { odds, source: odds.length > 0 };
      const finished = ["FT", "AET", "PEN"].includes(
        fixtureData.fixture.status.short,
      );
      setCachedValue(
        key,
        result,
        finished ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000,
      );
    }

    return response.json({
      ...result,
      meta: { apiRequestCount: counter.count },
    });
  } catch (error) {
    console.error("API-Football odds request failed:", error);
    return response.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить коэффициенты." },
    });
  }
});

app.use(express.static(currentDirectory));

app.listen(port, "0.0.0.0", () => {
  console.log(`AlmazStat server listening on port ${port}`);
});