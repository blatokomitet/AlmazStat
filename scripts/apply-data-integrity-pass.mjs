import fs from "node:fs";

const path = "server.js";
let source = fs.readFileSync(path, "utf8");

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing start marker for ${label}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`Missing end marker for ${label}`);
  source = source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(end);
}

const helperMarker = "function fixtureCacheTtl(statusShort) {";
if (!source.includes("function matchDataIntegrityState(")) {
  const helperIndex = source.indexOf(helperMarker);
  if (helperIndex === -1) throw new Error("Missing fixture cache helper marker");
  const helper = `function matchDataIntegrityState(upstreamCount, normalizedCount) {
  if (normalizedCount > 0) return "available";
  if (upstreamCount === 0) return "provider_empty";
  return "normalization_failed";
}

`;
  source = source.slice(0, helperIndex) + helper + source.slice(helperIndex);
}

const statisticsRoute = `app.get("/api/match/:fixture/statistics", async (request, response) => {
  if (!requireApiKey(response)) return;
  const fixtureId = String(request.params.fixture || "").trim();
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
        meta: apiMeta(counter),
      });
    }

    const key = \`statistics:\${fixtureId}\`;
    let result = cachedValue(key);
    let rateLimit = null;
    if (result === undefined) {
      const payload = await fetchApiFootballPayload(
        "/fixtures/statistics",
        { fixture: fixtureId },
        counter,
      );
      rateLimit = payload.rateLimit;
      const upstreamRows = Array.isArray(payload.response) ? payload.response : [];
      const statistics = normalizeFixtureStatistics(upstreamRows, fixtureData);
      const dataState = matchDataIntegrityState(
        upstreamRows.length,
        statistics.rows.length,
      );

      if (dataState === "normalization_failed") {
        console.error("Fixture statistics normalization failed", {
          fixtureId,
          upstreamCount: upstreamRows.length,
          normalizedCount: statistics.rows.length,
        });
        return response.status(502).json({
          error: {
            code: "NORMALIZATION_FAILED",
            message: "Не удалось обработать статистику матча.",
          },
          dataState,
          meta: {
            ...apiMeta(counter, rateLimit),
            upstreamCount: upstreamRows.length,
            normalizedCount: statistics.rows.length,
          },
        });
      }

      result = {
        statistics,
        source: dataState === "available",
        dataState,
      };
      setCachedValue(
        key,
        result,
        statisticsCacheTtl(fixtureData.fixture.status.short),
      );
    }

    return response.json({
      ...result,
      meta: apiMeta(counter, rateLimit),
    });
  } catch (error) {
    console.error("API-Football statistics request failed:", error);
    return response.status(502).json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Не удалось получить статистику.",
      },
      meta: apiMeta(counter),
    });
  }
});`;

const eventsRoute = `app.get("/api/match/:fixture/events", async (request, response) => {
  if (!requireApiKey(response)) return;
  const fixtureId = String(request.params.fixture || "").trim();
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
        meta: apiMeta(counter),
      });
    }

    const key = \`events:\${fixtureId}\`;
    let result = cachedValue(key);
    let rateLimit = null;
    if (result === undefined) {
      const payload = await fetchApiFootballPayload(
        "/fixtures/events",
        { fixture: fixtureId },
        counter,
      );
      rateLimit = payload.rateLimit;
      const upstreamRows = Array.isArray(payload.response) ? payload.response : [];
      const events = normalizeFixtureEvents(upstreamRows);
      const dataState = matchDataIntegrityState(upstreamRows.length, events.length);

      if (dataState === "normalization_failed") {
        console.error("Fixture events normalization failed", {
          fixtureId,
          upstreamCount: upstreamRows.length,
          normalizedCount: events.length,
        });
        return response.status(502).json({
          error: {
            code: "NORMALIZATION_FAILED",
            message: "Не удалось обработать события матча.",
          },
          dataState,
          meta: {
            ...apiMeta(counter, rateLimit),
            upstreamCount: upstreamRows.length,
            normalizedCount: events.length,
          },
        });
      }

      result = {
        events,
        status: fixtureData.fixture.status,
        source: dataState === "available",
        dataState,
      };
      setCachedValue(
        key,
        result,
        eventsCacheTtl(fixtureData.fixture.status.short),
      );
    }

    return response.json({
      ...result,
      meta: apiMeta(counter, rateLimit),
    });
  } catch (error) {
    console.error("API-Football events request failed:", error);
    return response.status(502).json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Не удалось получить события матча.",
      },
      meta: apiMeta(counter),
    });
  }
});`;

const lineupsRoute = `app.get("/api/match/:fixture/lineups", async (request, response) => {
  if (!requireApiKey(response)) return;
  const fixtureId = String(request.params.fixture || "").trim();
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
        meta: apiMeta(counter),
      });
    }

    const key = \`lineups:\${fixtureId}\`;
    let result = cachedValue(key);
    let rateLimit = null;
    if (result === undefined) {
      const payload = await fetchApiFootballPayload(
        "/fixtures/lineups",
        { fixture: fixtureId },
        counter,
      );
      rateLimit = payload.rateLimit;
      const upstreamRows = Array.isArray(payload.response) ? payload.response : [];
      const lineups = normalizeFixtureLineups(upstreamRows, fixtureData);
      const normalizedCount = Number(Boolean(lineups.home)) + Number(Boolean(lineups.away));
      const dataState = matchDataIntegrityState(upstreamRows.length, normalizedCount);

      if (dataState === "normalization_failed") {
        console.error("Fixture lineups normalization failed", {
          fixtureId,
          upstreamCount: upstreamRows.length,
          normalizedCount,
        });
        return response.status(502).json({
          error: {
            code: "NORMALIZATION_FAILED",
            message: "Не удалось обработать составы матча.",
          },
          dataState,
          meta: {
            ...apiMeta(counter, rateLimit),
            upstreamCount: upstreamRows.length,
            normalizedCount,
          },
        });
      }

      result = {
        lineups,
        status: fixtureData.fixture.status,
        source: dataState === "available",
        dataState,
      };
      setCachedValue(
        key,
        result,
        lineupsCacheTtl(fixtureData.fixture.status.short),
      );
    }

    return response.json({
      ...result,
      meta: apiMeta(counter, rateLimit),
    });
  } catch (error) {
    console.error("API-Football lineups request failed:", error);
    return response.status(502).json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Не удалось получить составы.",
      },
      meta: apiMeta(counter),
    });
  }
});`;

replaceBetween(
  'app.get("/api/match/:fixture/statistics",',
  'app.get("/api/match/:fixture/events",',
  statisticsRoute,
  "statistics route",
);
replaceBetween(
  'app.get("/api/match/:fixture/events",',
  'app.get("/api/match/:fixture/lineups",',
  eventsRoute,
  "events route",
);
replaceBetween(
  'app.get("/api/match/:fixture/lineups",',
  'app.get(\n  ["/", "/home",',
  lineupsRoute,
  "lineups route",
);

fs.writeFileSync(path, source);
console.log("Data integrity patch applied to server.js");
