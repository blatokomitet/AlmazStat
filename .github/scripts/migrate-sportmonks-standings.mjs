import fs from "node:fs";

const providerPath = "lib/sportmonks-provider.js";
const serverPath = "server.js";

let provider = fs.readFileSync(providerPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

if (!provider.includes("function normalizeSportmonksStanding(row)")) {
  const anchor = "export function normalizeSportmonksMatch(fixture) {";
  const helper = String.raw`
function normalizeStandingDetailKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function standingDetailValue(row, aliases) {
  const wanted = new Set(aliases.map(normalizeStandingDetailKey));
  const details = Array.isArray(row?.details) ? row.details : [];
  const detail = details.find((item) =>
    [item?.type?.developer_name, item?.type?.code, item?.type?.name]
      .map(normalizeStandingDetailKey)
      .some((key) => wanted.has(key)),
  );
  if (!detail) return null;
  return detail?.value ?? detail?.data?.value ?? null;
}

function normalizeSportmonksStanding(row) {
  if (!row) return null;
  const participant = row?.participant || {};
  return {
    rank: row?.position ?? null,
    team: {
      id: participant?.id ?? row?.participant_id ?? null,
      name: participant?.name ?? null,
      logo: participant?.image_path ?? null,
    },
    played: standingDetailValue(row, [
      "OVERALL_MATCHES",
      "OVERALL_MATCHES_PLAYED",
      "MATCHES_PLAYED",
      "PLAYED",
    ]),
    win: standingDetailValue(row, [
      "OVERALL_WON",
      "OVERALL_WINS",
      "WON",
      "WINS",
    ]),
    draw: standingDetailValue(row, [
      "OVERALL_DRAW",
      "OVERALL_DRAWS",
      "DRAW",
      "DRAWS",
    ]),
    lose: standingDetailValue(row, [
      "OVERALL_LOST",
      "OVERALL_LOSSES",
      "LOST",
      "LOSSES",
    ]),
    goalsFor: standingDetailValue(row, [
      "OVERALL_GOALS_FOR",
      "OVERALL_SCORED",
      "GOALS_FOR",
    ]),
    goalsAgainst: standingDetailValue(row, [
      "OVERALL_CONCEDED",
      "OVERALL_GOALS_AGAINST",
      "GOALS_AGAINST",
    ]),
    goalDifference: standingDetailValue(row, [
      "OVERALL_GOAL_DIFFERENCE",
      "GOAL_DIFFERENCE",
    ]),
    points: row?.points ?? null,
    form:
      row?.form ??
      standingDetailValue(row, ["FORM", "RECENT_FORM", "OVERALL_FORM"]),
  };
}

`;

  if (!provider.includes(anchor)) {
    throw new Error("Provider anchor for standings helper not found");
  }
  provider = provider.replace(anchor, helper + anchor);
}

if (!provider.includes("async function standingsBySeason(seasonId)")) {
  const anchor = "  async function fixtureById(fixtureId, { deep = false } = {}) {";
  const method = String.raw`
  async function standingsBySeason(seasonId) {
    const result = await request(
      "/standings/seasons/" + encodeURIComponent(seasonId),
      { include: "participant;details.type" },
    );

    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      standings: rows
        .map(normalizeSportmonksStanding)
        .filter((row) => row?.team?.id !== null),
      meta: {
        provider: "sportmonks",
        pagination: result.pagination,
        rateLimit: result.rateLimit,
      },
    };
  }

`;

  if (!provider.includes(anchor)) {
    throw new Error("Provider anchor for standings method not found");
  }
  provider = provider.replace(anchor, method + anchor);
}

if (!provider.includes("    standingsBySeason,")) {
  const anchor = "    headToHead,\n";
  if (!provider.includes(anchor)) {
    throw new Error("Provider return anchor for standings not found");
  }
  provider = provider.replace(anchor, anchor + "    standingsBySeason,\n");
}

const standingsStart = 'app.get("/api/match/:fixture/standings", async (request, response) => {';
const oddsStart = 'app.get("/api/match/:fixture/odds", async (request, response) => {';
const startIndex = server.indexOf(standingsStart);
const endIndex = server.indexOf(oddsStart, startIndex);

if (startIndex === -1 || endIndex === -1) {
  throw new Error("Could not find standings route boundaries");
}

const sportmonksStandingsRoute = String.raw`app.get("/api/match/:fixture/standings", async (request, response) => {
  const fixtureId = String(request.params.fixture || "").trim();

  if (sportmonksToken) {
    try {
      const key = "sportmonks:standings:" + fixtureId;
      let result = cachedValue(key);

      if (result === undefined) {
        const centre = await getSportmonksMatchCentre(fixtureId);
        const seasonId = centre?.league?.season;
        if (!centre?.home?.id || !centre?.away?.id || !seasonId) {
          return response.status(404).json({
            error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
          });
        }

        const table = await sportmonksProvider.standingsBySeason(seasonId);
        const rows = Array.isArray(table?.standings) ? table.standings : [];
        const home =
          rows.find((row) => Number(row?.team?.id) === Number(centre.home.id)) || null;
        const away =
          rows.find((row) => Number(row?.team?.id) === Number(centre.away.id)) || null;

        result = {
          standings: { home, away },
          season: seasonId,
          source: Boolean(home && away),
          provider: "sportmonks",
        };
        setCachedValue(key, result, 15 * 60 * 1000);
      }

      return response.json({
        ...result,
        meta: { apiRequestCount: 2 },
      });
    } catch (error) {
      console.error("Sportmonks standings request failed:", error?.message || error);
      if (!apiFootballKey) {
        return response.status(502).json({
          error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить таблицу." },
          provider: "sportmonks",
          meta: { apiRequestCount: 0 },
        });
      }
    }
  }

  if (!requireApiKey(response)) return;
  const counter = { count: 0 };

  try {
    const fixtureData = await getFixtureDetails(fixtureId, counter);
    if (!fixtureData) {
      return response.status(404).json({
        error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
      });
    }

    const key = "standings:" + fixtureData.league.id + ":" + fixtureData.league.season;
    let rows = cachedValue(key);
    if (rows === undefined) {
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
      provider: "api-football",
      meta: { apiRequestCount: counter.count },
    });
  } catch (error) {
    console.error("API-Football standings request failed:", error);
    return response.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить таблицу." },
      meta: { apiRequestCount: counter.count },
    });
  }
});

`;

server = server.slice(0, startIndex) + sportmonksStandingsRoute + server.slice(endIndex);

fs.writeFileSync(providerPath, provider);
fs.writeFileSync(serverPath, server);
