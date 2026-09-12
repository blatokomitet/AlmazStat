import fs from "node:fs";

const providerPath = "lib/sportmonks-provider.js";
let provider = fs.readFileSync(providerPath, "utf8");

const helperMarker = "export function normalizeSportmonksMatch(fixture) {";
const helper = `
function participantScore(fixture, participantId) {
  const scores = Array.isArray(fixture?.scores) ? fixture.scores : [];
  const current = scores.find(
    (score) =>
      String(score?.description || "").toUpperCase() === "CURRENT" &&
      Number(score?.participant_id) === Number(participantId),
  );
  return current?.score?.goals ?? null;
}

function normalizeRecentFormFixture(fixture, teamId) {
  const homeParticipant = findParticipant(fixture, "home");
  const awayParticipant = findParticipant(fixture, "away");
  const home = normalizeTeam(homeParticipant);
  const away = normalizeTeam(awayParticipant);
  const isHome = Number(home.id) === Number(teamId);
  const isAway = Number(away.id) === Number(teamId);

  const homeGoals = participantScore(fixture, home.id) ?? currentScoreBySide(fixture, "home");
  const awayGoals = participantScore(fixture, away.id) ?? currentScoreBySide(fixture, "away");

  let result = null;
  if (isHome || isAway) {
    const teamGoals = isHome ? homeGoals : awayGoals;
    const opponentGoals = isHome ? awayGoals : homeGoals;
    if (teamGoals !== null && opponentGoals !== null) {
      result = teamGoals > opponentGoals ? "W" : teamGoals < opponentGoals ? "L" : "D";
    }
  }

  const opponent = isHome ? away : isAway ? home : null;
  return {
    fixtureId: fixture?.id ?? null,
    date: normalizeDate(fixture?.starting_at),
    opponent: opponent
      ? { id: opponent.id, name: opponent.name, logo: opponent.logo }
      : { id: null, name: null, logo: null },
    side: isHome ? "H" : isAway ? "A" : null,
    score: { home: homeGoals, away: awayGoals },
    result,
    league: fixture?.league?.name ?? null,
    leagueId: fixture?.league?.id ?? fixture?.league_id ?? null,
    state: stateToShort(fixture?.state),
    xg: Array.isArray(fixture?.xgfixture) ? fixture.xgfixture : [],
    statistics: Array.isArray(fixture?.statistics)
      ? fixture.statistics.map(normalizeStatistic)
      : [],
  };
}

`;

if (!provider.includes("function normalizeRecentFormFixture(")) {
  if (!provider.includes(helperMarker)) throw new Error("Provider helper anchor not found");
  provider = provider.replace(helperMarker, helper + helperMarker);
}

const fixtureAnchor = "  async function fixtureById(fixtureId, { deep = false } = {}) {";
const teamRecentMethod = `
  async function teamRecentForm(teamId, { limit = 5 } = {}) {
    const result = await request(\`/teams/\${encodeURIComponent(teamId)}\`, {
      include: [
        "latest.participants",
        "latest.scores",
        "latest.state",
        "latest.league",
      ].join(";"),
    });

    const team = result.data || null;
    const latest = Array.isArray(team?.latest) ? team.latest : [];
    const matches = latest
      .map((fixture) => normalizeRecentFormFixture(fixture, teamId))
      .filter((fixture) =>
        fixture.fixtureId !== null &&
        fixture.side !== null &&
        fixture.opponent.id !== null &&
        fixture.result !== null &&
        ["FT", "AET", "PEN"].includes(fixture.state),
      )
      .sort((a, b) => Number(b.date ? Date.parse(b.date) : 0) - Number(a.date ? Date.parse(a.date) : 0))
      .slice(0, Math.max(1, Math.min(Number(limit) || 5, 10)));

    return {
      team: team
        ? {
            id: team.id ?? Number(teamId),
            name: team.name ?? null,
            logo: team.image_path ?? null,
            lastPlayedAt: normalizeDate(team.last_played_at),
          }
        : { id: Number(teamId), name: null, logo: null, lastPlayedAt: null },
      matches,
      meta: { provider: "sportmonks", rateLimit: result.rateLimit },
    };
  }

`;

if (!provider.includes("async function teamRecentForm(")) {
  if (!provider.includes(fixtureAnchor)) throw new Error("Provider method anchor not found");
  provider = provider.replace(fixtureAnchor, teamRecentMethod + fixtureAnchor);
}

if (!provider.includes("    teamRecentForm,\n")) {
  const returnOld = "    fixturesByDate,\n    fixtureById,\n  };";
  const returnNew = "    fixturesByDate,\n    fixtureById,\n    teamRecentForm,\n  };";
  if (!provider.includes(returnOld)) throw new Error("Provider return anchor not found");
  provider = provider.replace(returnOld, returnNew);
}

fs.writeFileSync(providerPath, provider);

const serverPath = "server.js";
let server = fs.readFileSync(serverPath, "utf8");
const startMarker = 'app.get("/api/match/:fixture/form", async (request, response) => {';
const endMarker = 'app.get("/api/match/:fixture/h2h", async (request, response) => {';
const start = server.indexOf(startMarker);
const end = server.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) throw new Error("Form route anchors not found");

const formRoute = `app.get("/api/match/:fixture/form", async (request, response) => {
  const fixtureId = String(request.params.fixture || "").trim();

  if (!sportmonksToken) {
    return response.status(503).json({
      error: { code: "SPORTMONKS_NOT_CONFIGURED", message: "Sportmonks не настроен." },
    });
  }

  try {
    const key = \`sportmonks:form:\${fixtureId}\`;
    let result = cachedValue(key);

    if (result === undefined) {
      const centre = await getSportmonksMatchCentre(fixtureId);
      if (!centre?.home?.id || !centre?.away?.id) {
        return response.status(404).json({
          error: { code: "FIXTURE_NOT_FOUND", message: "Матч не найден." },
        });
      }

      const [homeRecent, awayRecent] = await Promise.all([
        sportmonksProvider.teamRecentForm(centre.home.id, { limit: 5 }),
        sportmonksProvider.teamRecentForm(centre.away.id, { limit: 5 }),
      ]);

      const form = {
        home: homeRecent?.matches || [],
        away: awayRecent?.matches || [],
      };
      result = {
        form,
        source: form.home.length > 0 && form.away.length > 0,
        provider: "sportmonks",
      };
      setCachedValue(key, result, 30 * 60 * 1000);
    }

    return response.json({ ...result, meta: { apiRequestCount: 3 } });
  } catch (error) {
    console.error("Sportmonks form request failed:", error?.message || error);
    return response.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Не удалось загрузить форму." },
      meta: { apiRequestCount: 0 },
    });
  }
});

`;

server = server.slice(0, start) + formRoute + server.slice(end);
fs.writeFileSync(serverPath, server);
