import fs from "node:fs";

const providerPath = "lib/sportmonks-provider.js";
const serverPath = "server.js";

let provider = fs.readFileSync(providerPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

const providerAnchor = `export function normalizeSportmonksMatch(fixture) {`;
const h2hNormalizer = `function normalizeHeadToHeadFixture(fixture) {
  const homeParticipant = findParticipant(fixture, "home");
  const awayParticipant = findParticipant(fixture, "away");
  const home = normalizeTeam(homeParticipant);
  const away = normalizeTeam(awayParticipant);

  return {
    fixtureId: fixture?.id ?? null,
    date: normalizeDate(fixture?.starting_at),
    league: fixture?.league?.name ?? null,
    home: {
      id: home.id,
      name: home.name,
      logo: home.logo,
    },
    away: {
      id: away.id,
      name: away.name,
      logo: away.logo,
    },
    score: {
      home: participantScore(fixture, home.id) ?? currentScoreBySide(fixture, "home"),
      away: participantScore(fixture, away.id) ?? currentScoreBySide(fixture, "away"),
    },
  };
}

function isUsableHeadToHeadFixture(fixture) {
  return (
    fixture.fixtureId !== null &&
    fixture.home.id !== null &&
    fixture.away.id !== null &&
    fixture.score.home !== null &&
    fixture.score.away !== null
  );
}

`;

if (!provider.includes("function normalizeHeadToHeadFixture")) {
  if (!provider.includes(providerAnchor)) throw new Error("Provider normalizer anchor not found");
  provider = provider.replace(providerAnchor, h2hNormalizer + providerAnchor);
}

const fixtureMethodAnchor = `  async function fixtureById(fixtureId, { deep = false } = {}) {`;
const h2hMethod = `  async function headToHead(firstTeamId, secondTeamId, { limit = 5 } = {}) {
    const result = await request(
      \`/fixtures/head-to-head/\${encodeURIComponent(firstTeamId)}/\${encodeURIComponent(secondTeamId)}\`,
      {
        include: "participants;scores;state;league",
      },
    );

    const rows = Array.isArray(result.data) ? result.data : [];
    const matches = rows
      .map(normalizeHeadToHeadFixture)
      .filter(isUsableHeadToHeadFixture)
      .sort(
        (a, b) =>
          Number(b.date ? Date.parse(b.date) : 0) -
          Number(a.date ? Date.parse(a.date) : 0),
      )
      .slice(0, Math.max(1, Math.min(Number(limit) || 5, 20)));

    return {
      matches,
      meta: {
        provider: "sportmonks",
        pagination: result.pagination,
        rateLimit: result.rateLimit,
      },
    };
  }

`;

if (!provider.includes("async function headToHead(")) {
  if (!provider.includes(fixtureMethodAnchor)) throw new Error("Provider fixture method anchor not found");
  provider = provider.replace(fixtureMethodAnchor, h2hMethod + fixtureMethodAnchor);
}

const returnOld = `    fixtureById,
    teamRecentForm,
  };`;
const returnNew = `    fixtureById,
    teamRecentForm,
    headToHead,
  };`;
if (!provider.includes("    headToHead,\n")) {
  if (!provider.includes(returnOld)) throw new Error("Provider return block not found");
  provider = provider.replace(returnOld, returnNew);
}

const oldRoute = `app.get("/api/match/:fixture/h2h", async (request, response) => {
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

    const key = \`h2h:\${fixtureId}\`;
    let result = cachedValue(key);
    if (result === undefined) {
      const matches = await fetchApiFootball(
        "/fixtures/headtohead",
        { h2h: \`\${fixtureData.home.id}-\${fixtureData.away.id}\`, last: 5 },
        counter,
      );
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
      meta: { apiRequestCount: counter.count },
    });
  }
});`;

const newRoute = `app.get("/api/match/:fixture/h2h", async (request, response) => {
  const fixtureId = String(request.params.fixture || "").trim();

  if (!sportmonksToken) {
    return response.status(503).json({
      error: { code: "SPORTMONKS_NOT_CONFIGURED", message: "Sportmonks не настроен." },
    });
  }

  try {
    const key = \`sportmonks:h2h:\${fixtureId}\`;
    let result = cachedValue(key);

    if (result === undefined) {
      const centre = await getSportmonksMatchCentre(fixtureId);
      if (!centre?.home?.id || !centre?.away?.id) {
        return response.status(404).json({
          error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
        });
      }

      const h2hResult = await sportmonksProvider.headToHead(
        centre.home.id,
        centre.away.id,
        { limit: 5 },
      );
      const h2h = h2hResult?.matches || [];
      result = {
        h2h,
        source: h2h.length > 0,
        provider: "sportmonks",
      };
      setCachedValue(key, result, 6 * 60 * 60 * 1000);
    }

    return response.json({
      ...result,
      meta: { apiRequestCount: 2 },
    });
  } catch (error) {
    console.error("Sportmonks H2H request failed:", error?.message || error);
    return response.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить очные встречи." },
      provider: "sportmonks",
      meta: { apiRequestCount: 0 },
    });
  }
});`;

if (!server.includes('provider: "sportmonks",\n      meta: { apiRequestCount: 2 },')) {
  if (!server.includes(oldRoute)) throw new Error("Legacy H2H route not found");
  server = server.replace(oldRoute, newRoute);
}

fs.writeFileSync(providerPath, provider);
fs.writeFileSync(serverPath, server);
