import fs from "node:fs";

const path = "server.js";
let source = fs.readFileSync(path, "utf8");

function mustInclude(needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}`);
}

function replaceOnce(oldText, newText, label) {
  mustInclude(oldText, label);
  const first = source.indexOf(oldText);
  const second = source.indexOf(oldText, first + oldText.length);
  if (second !== -1) throw new Error(`Expected one ${label}`);
  source = source.replace(oldText, newText);
}

function replaceRoute(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not locate ${label}`);
  }
  source = source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(end);
}

replaceOnce(
  'import { fileURLToPath } from "node:url";\n',
  'import { fileURLToPath } from "node:url";\nimport { createSportmonksProvider } from "./lib/sportmonks-provider.js";\n',
  "Sportmonks import anchor",
);

replaceOnce(
  'const apiFootballKey = process.env.API_FOOTBALL_KEY;\nconst apiFootballBaseUrl = "https://v3.football.api-sports.io";\n',
  'const apiFootballKey = process.env.API_FOOTBALL_KEY;\nconst sportmonksToken = process.env.SPORTMONKS_API_TOKEN;\nconst apiFootballBaseUrl = "https://v3.football.api-sports.io";\nconst sportmonksProvider = createSportmonksProvider({ token: sportmonksToken });\n',
  "provider configuration anchor",
);

const matchesRoute = `app.get("/api/matches", async (request, response) => {
  const date = String(request.query.date || serverDate()).trim();

  if (!isValidDate(date)) {
    return response.status(400).json({
      error: {
        code: "INVALID_DATE",
        message: "Дата должна быть в формате YYYY-MM-DD.",
      },
    });
  }

  if (!sportmonksToken && !apiFootballKey) {
    return response.status(503).json({
      error: {
        code: "FOOTBALL_PROVIDER_NOT_CONFIGURED",
        message: "Источник футбольных данных не настроен.",
      },
    });
  }

  const counter = { count: 0 };
  try {
    const cacheKey = \`matches:\${date}:provider-v2\`;
    const cachedMatches = cachedValue(cacheKey);
    if (cachedMatches !== undefined) {
      return response.json({
        date,
        matches: cachedMatches.matches,
        provider: cachedMatches.provider,
        apiRequestCount: 0,
      });
    }

    if (sportmonksToken) {
      try {
        const result = await sportmonksProvider.fixturesByDate(date);
        const matches = Array.isArray(result.matches) ? result.matches : [];
        const hasLiveMatches = matches.some((match) =>
          ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"].includes(
            match.status?.short,
          ),
        );
        setCachedValue(
          cacheKey,
          { matches, provider: "sportmonks" },
          hasLiveMatches ? 60 * 1000 : 10 * 60 * 1000,
        );
        return response.json({
          date,
          matches,
          provider: "sportmonks",
          apiRequestCount: 1,
        });
      } catch (error) {
        console.error("Sportmonks matches request failed:", error?.message || error);
        if (!apiFootballKey) throw error;
      }
    }

    const payload = await fetchApiFootballPayload("/fixtures", { date }, counter);
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
      { matches, provider: "api-football" },
      hasLiveMatches ? 60 * 1000 : 10 * 60 * 1000,
    );

    return response.json({
      date,
      matches,
      provider: "api-football",
      apiRequestCount: counter.count,
    });
  } catch (error) {
    console.error("Football matches request failed:", error);
    return response.status(502).json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Не удалось загрузить матчи.",
      },
    });
  }
});`;

replaceRoute(
  'app.get("/api/matches", async (request, response) => {',
  'app.get("/api/match", async (request, response) => {',
  matchesRoute,
  "matches route",
);

const matchRoute = `app.get("/api/match", async (request, response) => {
  const fixture = String(request.query.fixture || "").trim();

  if (!fixture) {
    return response.status(400).json({
      error: {
        code: "MISSING_FIXTURE",
        message: "Необходимо передать fixture ID в query parameter.",
      },
    });
  }

  if (!sportmonksToken && !apiFootballKey) {
    return response.status(503).json({
      error: {
        code: "FOOTBALL_PROVIDER_NOT_CONFIGURED",
        message: "Источник футбольных данных не настроен.",
      },
    });
  }

  if (sportmonksToken) {
    try {
      const result = await sportmonksProvider.fixtureById(fixture);
      if (result?.fixture) {
        const sources = {
          fixture: true,
          prediction: false,
          statistics: "unknown",
          events: "unknown",
          lineups: "unknown",
          form: "unknown",
          h2h: "unknown",
          standings: "unknown",
          odds: "unknown",
        };
        return response.json({
          ...result.fixture,
          prediction: null,
          sources,
          risk: riskFromSources(sources),
          provider: "sportmonks",
          meta: { apiRequestCount: 1 },
        });
      }
    } catch (error) {
      console.error("Sportmonks fixture request failed:", error?.message || error);
      if (!apiFootballKey) {
        return response.status(502).json({
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: "Не удалось связаться со Sportmonks.",
          },
        });
      }
    }
  }

  if (!apiFootballKey) {
    return response.status(404).json({
      error: {
        code: "FIXTURE_NOT_FOUND",
        message: "Матч с указанным fixture ID не найден.",
      },
    });
  }

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

    const predictionKey = \`prediction:\${fixture}\`;
    let prediction = cachedValue(predictionKey);
    if (prediction === undefined) {
      let predictionLoaded = false;
      try {
        const predictionResponse = await fetchApiFootball(
          "/predictions",
          { fixture },
          counter,
        );
        prediction = normalizePrediction(predictionResponse[0]);
        predictionLoaded = true;
      } catch {
        prediction = null;
      }
      if (predictionLoaded) {
        setCachedValue(predictionKey, prediction, 30 * 60 * 1000);
      }
    }

    const sources = {
      fixture: true,
      prediction: Boolean(prediction),
      statistics: "unknown",
      events: "unknown",
      lineups: "unknown",
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
      provider: "api-football",
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
});`;

replaceRoute(
  'app.get("/api/match", async (request, response) => {',
  'app.get("/api/match/:fixture/form", async (request, response) => {',
  matchRoute,
  "match route",
);

fs.writeFileSync(path, source);
console.log("Sportmonks routes wired successfully.");
