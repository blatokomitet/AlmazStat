import assert from "node:assert/strict";
import test from "node:test";

import { createSportmonksProvider } from "../lib/sportmonks-provider.js";

function participant(id, name, location) {
  return {
    id,
    name,
    image_path: `https://img.test/${id}.png`,
    meta: { location },
  };
}

function score(participantId, goals, side) {
  return {
    participant_id: participantId,
    description: "CURRENT",
    score: { goals, participant: side },
  };
}

function fixture({
  id,
  date,
  homeId,
  homeName,
  awayId,
  awayName,
  homeGoals,
  awayGoals,
  state = "FINISHED",
}) {
  return {
    id,
    starting_at: date,
    participants: [
      participant(homeId, homeName, "home"),
      participant(awayId, awayName, "away"),
    ],
    scores: [score(homeId, homeGoals, "home"), score(awayId, awayGoals, "away")],
    state: { developer_name: state },
    league: { id: 8, name: "Test League" },
  };
}

async function withMockedTeamResponse(data, callback) {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = new URL(url);
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const provider = createSportmonksProvider({
      token: "test-token",
      baseUrl: "https://sportmonks.test/v3/football",
    });
    const result = await callback(provider);
    return { result, requestedUrl };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("teamRecentForm maps home and away W/D/L and sorts newest first", async () => {
  const teamId = 10;
  const latest = [
    fixture({
      id: 1,
      date: "2026-08-01 18:00:00",
      homeId: teamId,
      homeName: "Almaz",
      awayId: 20,
      awayName: "North",
      homeGoals: 2,
      awayGoals: 0,
    }),
    fixture({
      id: 3,
      date: "2026-08-03 18:00:00",
      homeId: 30,
      homeName: "South",
      awayId: teamId,
      awayName: "Almaz",
      homeGoals: 1,
      awayGoals: 1,
    }),
    fixture({
      id: 2,
      date: "2026-08-02 18:00:00",
      homeId: 40,
      homeName: "West",
      awayId: teamId,
      awayName: "Almaz",
      homeGoals: 3,
      awayGoals: 1,
    }),
  ];

  const { result, requestedUrl } = await withMockedTeamResponse(
    { id: teamId, name: "Almaz", latest },
    (provider) => provider.teamRecentForm(teamId),
  );

  assert.deepEqual(result.matches.map(({ fixtureId, result: matchResult }) => [fixtureId, matchResult]), [
    [3, "D"],
    [2, "L"],
    [1, "W"],
  ]);
  assert.equal(result.matches[0].side, "A");
  assert.equal(result.matches[0].opponent.name, "South");
  assert.equal(
    requestedUrl.searchParams.get("include"),
    "latest.participants;latest.scores;latest.state;latest.league",
  );
});

test("teamRecentForm respects the requested limit", async () => {
  const teamId = 10;
  const latest = Array.from({ length: 7 }, (_, index) =>
    fixture({
      id: index + 1,
      date: `2026-08-0${index + 1} 18:00:00`,
      homeId: teamId,
      homeName: "Almaz",
      awayId: 100 + index,
      awayName: `Opponent ${index}`,
      homeGoals: 1,
      awayGoals: 0,
    }),
  );

  const { result } = await withMockedTeamResponse(
    { id: teamId, name: "Almaz", latest },
    (provider) => provider.teamRecentForm(teamId, { limit: 3 }),
  );

  assert.deepEqual(result.matches.map((match) => match.fixtureId), [7, 6, 5]);
});

test("teamRecentForm excludes live and malformed fixtures", async () => {
  const teamId = 10;
  const valid = fixture({
    id: 1,
    date: "2026-08-01 18:00:00",
    homeId: teamId,
    homeName: "Almaz",
    awayId: 20,
    awayName: "North",
    homeGoals: 2,
    awayGoals: 0,
  });
  const live = fixture({
    id: 2,
    date: "2026-08-02 18:00:00",
    homeId: teamId,
    homeName: "Almaz",
    awayId: 30,
    awayName: "South",
    homeGoals: 1,
    awayGoals: 0,
    state: "INPLAY_2ND_HALF",
  });
  const unrelated = fixture({
    id: 3,
    date: "2026-08-03 18:00:00",
    homeId: 40,
    homeName: "West",
    awayId: 50,
    awayName: "East",
    homeGoals: 1,
    awayGoals: 0,
  });
  const missingScore = {
    ...fixture({
      id: 4,
      date: "2026-08-04 18:00:00",
      homeId: teamId,
      homeName: "Almaz",
      awayId: 60,
      awayName: "Central",
      homeGoals: 0,
      awayGoals: 0,
    }),
    scores: [],
  };

  const { result } = await withMockedTeamResponse(
    { id: teamId, name: "Almaz", latest: [live, unrelated, missingScore, valid] },
    (provider) => provider.teamRecentForm(teamId),
  );

  assert.deepEqual(result.matches.map((match) => match.fixtureId), [1]);
});

test("teamRecentForm returns an empty list for an empty upstream relation", async () => {
  const { result } = await withMockedTeamResponse(
    { id: 10, name: "Almaz", latest: null },
    (provider) => provider.teamRecentForm(10),
  );

  assert.deepEqual(result.matches, []);
});
