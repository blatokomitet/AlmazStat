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
