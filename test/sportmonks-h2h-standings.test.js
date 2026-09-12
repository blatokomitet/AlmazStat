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
