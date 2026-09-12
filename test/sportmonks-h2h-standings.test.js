import assert from "node:assert/strict";
import test from "node:test";

import { createSportmonksProvider } from "../lib/sportmonks-provider.js";

function participant(id, name, location) {
  return { id, name, image_path: `https://img.test/${id}.png`, meta: { location } };
}

function fixture(id, date, homeGoals, awayGoals) {
  return {
    id,
    starting_at: date,
    participants: [participant(10, "Almaz", "home"), participant(20, "North", "away")],
    scores:
      homeGoals === null
        ? []
        : [
            { participant_id: 10, description: "CURRENT", score: { goals: homeGoals, participant: "home" } },
            { participant_id: 20, description: "CURRENT", score: { goals: awayGoals, participant: "away" } },
          ],
    state: { developer_name: homeGoals === null ? "NOT_STARTED" : "FINISHED" },
    league: { id: 8, name: "Test League" },
  };
}

async function withMockedResponse(data, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    return await callback(
      createSportmonksProvider({
        token: "test-token",
        baseUrl: "https://sportmonks.test/v3/football",
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("headToHead returns completed matches newest first and excludes scheduled rows", async () => {
  const result = await withMockedResponse(
    [
      fixture(1, "2026-01-01 12:00:00", 1, 0),
      fixture(3, "2026-03-01 12:00:00", null, null),
      fixture(2, "2026-02-01 12:00:00", 2, 2),
    ],
    (provider) => provider.headToHead(10, 20),
  );

  assert.deepEqual(result.matches.map((match) => match.fixtureId), [2, 1]);
  assert.deepEqual(result.matches[0].score, { home: 2, away: 2 });
});

test("standingsBySeason reads official Sportmonks type names and code fallbacks", async () => {
  const details = [
    { value: 4, type: { developer_name: "OVERALL_MATCHES", code: "overall-matches-played" } },
    { value: 3, type: { developer_name: "OVERALL_WINS", code: "overall-won" } },
    { value: 0, type: { developer_name: "OVERALL_DRAWS", code: "overall-draw" } },
    { value: 1, type: { developer_name: "OVERALL_LOST", code: "overall-lost" } },
    // The developer name is intentionally unfamiliar: normalization must also
    // inspect the documented code instead of stopping at the first field.
    { value: 10, type: { developer_name: "SCORED", code: "overall-goals-for" } },
    { value: 3, type: { developer_name: "OVERALL_CONCEDED", code: "overall-conceded" } },
    { value: 7, type: { developer_name: "OVERALL_GOAL_DIFFERENCE", code: "goal-difference" } },
  ];

  const result = await withMockedResponse(
    [
      {
        id: 1,
        position: 4,
        points: 9,
        participant_id: 10,
        participant: participant(10, "Almaz", "home"),
        details,
        form: [{ form: "W" }, { form: "L" }],
      },
    ],
    (provider) => provider.standingsBySeason(100),
  );

  assert.deepEqual(result.standings[0], {
    rank: 4,
    team: { id: 10, name: "Almaz", logo: "https://img.test/10.png" },
    played: 4,
    win: 3,
    draw: 0,
    lose: 1,
    goalsFor: 10,
    goalsAgainst: 3,
    goalDifference: 7,
    points: 9,
    form: [{ form: "W" }, { form: "L" }],
  });
  assert.equal(result.meta.includeMode, "rich");
});

test("teamById maps team profile and latest fixtures", async () => {
  const result = await withMockedResponse(
    {
      id: 83,
      name: "Team 83",
      short_code: "T83",
      image_path: "https://img.test/83.png",
      founded: 1908,
      country: { name: "Poland" },
      venue: { id: 7, name: "Main Stadium", city_name: "Warsaw" },
      activeSeasons: [{ id: 2026, name: "2026/2027", is_current: true, league_id: 8, league: { id: 8, name: "Top League" } }],
      latest: [fixture(5, "2026-09-01 18:00:00", 2, 1)],
    },
    (provider) => provider.teamById(83),
  );

  assert.equal(result.team.name, "Team 83");
  assert.equal(result.team.country, "Poland");
  assert.equal(result.team.venue.name, "Main Stadium");
  assert.deepEqual(result.fixtures.map((match) => match.fixtureId), [5]);
  assert.equal(result.competitions[0].seasons[0].id, 2026);
});

test("teamsSearch uses the Sportmonks search endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ data: [{ id: 19, name: "Arsenal", image_path: "https://img.test/19.png" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const provider = createSportmonksProvider({ token: "test-token", baseUrl: "https://sportmonks.test/v3/football" });
    const result = await provider.teamsSearch("Arsenal");
    assert.equal(result.teams[0].name, "Arsenal");
    assert.match(requestedUrl, /\/teams\/search\/Arsenal/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("leagueById maps current Sportmonks season IDs for downstream requests", async () => {
  const result = await withMockedResponse(
    {
      id: 8,
      name: "Premier League",
      short_code: "UK PL",
      image_path: "https://img.test/league.png",
      type: "league",
      country: { id: 462, name: "England" },
      currentSeason: { id: 28083, name: "2026/2027", is_current: true, starting_at: "2026-08-01" },
    },
    (provider) => provider.leagueById(8),
  );

  assert.equal(result.league.country.name, "England");
  assert.deepEqual(result.league.seasons[0], {
    id: 28083,
    year: 28083,
    name: "2026/2027",
    current: true,
    start: "2026-08-01Z",
    end: null,
  });
});

test("leagueById accepts Sportmonks lowercase currentseason relation", async () => {
  const result = await withMockedResponse(
    {
      id: 8,
      name: "Premier League",
      currentseason: {
        id: 28083,
        name: "2026/2027",
        is_current: true,
        starting_at: "2026-08-01",
      },
    },
    (provider) => provider.leagueById(8),
  );

  assert.equal(result.league.seasons.length, 1);
  assert.equal(result.league.seasons[0].id, 28083);
  assert.equal(result.league.seasons[0].current, true);
});

test("fixturesBySeason sends the Sportmonks season filter", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const provider = createSportmonksProvider({ token: "test-token", baseUrl: "https://sportmonks.test/v3/football" });
    await provider.fixturesBySeason(28083);
    assert.match(requestedUrl, /filters=fixtureSeasons%3A28083/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("oddsByFixture returns only 1X2 and total-goals markets", async () => {
  const result = await withMockedResponse(
    [
      { bookmaker_id: 2, bookmaker: { id: 2, name: "Bet Test" }, market: { name: "Match Winner" }, label: "Home", value: "1.75", probability: "54.2%" },
      { bookmaker_id: 2, bookmaker: { id: 2, name: "Bet Test" }, market: { name: "Goals Over/Under" }, label: "Over", total: "2.5", value: "1.91" },
      { bookmaker_id: 2, bookmaker: { id: 2, name: "Bet Test" }, market: { name: "Both Teams To Score" }, label: "Yes", value: "1.80" },
    ],
    (provider) => provider.oddsByFixture(123),
  );

  assert.deepEqual(result.odds.map((odd) => [odd.marketKind, odd.option, odd.odd]), [
    ["1x2", "1", "1.75"],
    ["totals", "Over 2.5", "1.91"],
  ]);
  assert.equal(result.meta.provider, "sportmonks");
});

test("fixtureById requests and maps xG plus detailed lineups for AI analysis", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ data: {
      ...fixture(19732704, "2026-09-12 16:00:00", 1, 0),
      xGFixture: [{ id: 1, participant_id: 10, data: { value: 1.42 }, type: { id: 5304, name: "Expected Goals", developer_name: "EXPECTED_GOALS" } }],
      lineups: [{ id: 2, team_id: 10, player_id: 99, player: { display_name: "Test Player" }, type: { developer_name: "LINEUP" }, details: [{ data: { value: 0.31 }, type: { name: "Player xG" } }] }],
    } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const provider = createSportmonksProvider({ token: "test-token", baseUrl: "https://sportmonks.test/v3/football" });
    const result = await provider.fixtureById(19732704, { deep: true });
    const include = new URL(requestedUrl).searchParams.get("include");
    assert.match(include, /xGFixture\.type/);
    assert.match(include, /lineups\.details\.type/);
    assert.equal(result.fixture.expectedGoals[0].value, 1.42);
    assert.equal(result.fixture.lineups.home.starters[0].details[0].value, 0.31);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("teamStatisticsBySeason uses the season filter and normalizes team totals", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  const detail = (developerName, value) => ({ value, type: { developer_name: developerName, name: developerName } });
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ data: [{
      id: 83,
      name: "Season Team",
      statistics: [{ id: 701, season_id: 26763, details: [
        detail("WIN", { all: { count: 10 }, home: { count: 6 }, away: { count: 4 } }),
        detail("DRAW", { all: { count: 3 }, home: { count: 1 }, away: { count: 2 } }),
        detail("LOST", { all: { count: 2 }, home: { count: 1 }, away: { count: 1 } }),
        detail("GOALS", { all: { count: 31 }, home: { count: 20 }, away: { count: 11 } }),
        detail("GOALS_CONCEDED", { all: { count: 12 }, home: { count: 5 }, away: { count: 7 } }),
      ] }],
    }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const provider = createSportmonksProvider({ token: "test-token", baseUrl: "https://sportmonks.test/v3/football" });
    const result = await provider.teamStatisticsBySeason(26763, 83);
    const url = new URL(requestedUrl);
    assert.equal(url.pathname, "/v3/football/teams/seasons/26763");
    assert.equal(url.searchParams.get("include"), "statistics.details.type");
    assert.equal(url.searchParams.get("filters"), "teamstatisticSeasons:26763");
    assert.deepEqual(result.statistics.played, { home: 8, away: 7, total: 15 });
    assert.deepEqual(result.statistics.goalsFor.total, { home: 20, away: 11, total: 31 });
    assert.equal(result.statistics.details.length, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
