import assert from "node:assert/strict";
import test from "node:test";

import { loadMatchRecentForm } from "../lib/recent-form-service.js";

const centre = {
  home: { id: 10 },
  away: { id: 20 },
};

test("loadMatchRecentForm combines both team responses", async () => {
  const calls = [];
  const result = await loadMatchRecentForm({
    fixtureId: "1000",
    getMatchCentre: async () => centre,
    teamRecentForm: async (teamId, options) => {
      calls.push([teamId, options]);
      return { matches: [{ fixtureId: teamId }] };
    },
  });

  assert.deepEqual(calls, [
    [10, { limit: 5 }],
    [20, { limit: 5 }],
  ]);
  assert.deepEqual(result.form, {
    home: [{ fixtureId: 10 }],
    away: [{ fixtureId: 20 }],
  });
  assert.equal(result.source, true);
  assert.equal(result.dataState, "available");
  assert.deepEqual(result.failedSides, []);
});

test("loadMatchRecentForm preserves one successful side", async () => {
  const result = await loadMatchRecentForm({
    fixtureId: "1000",
    getMatchCentre: async () => centre,
    teamRecentForm: async (teamId) => {
      if (teamId === 20) throw new Error("temporary upstream failure");
      return { matches: [{ fixtureId: 1 }] };
    },
  });

  assert.deepEqual(result.form.home, [{ fixtureId: 1 }]);
  assert.deepEqual(result.form.away, []);
  assert.equal(result.source, false);
  assert.equal(result.dataState, "partial");
  assert.deepEqual(result.failedSides, ["away"]);
});

test("loadMatchRecentForm fails when neither side can be loaded", async () => {
  await assert.rejects(
    loadMatchRecentForm({
      fixtureId: "1000",
      getMatchCentre: async () => centre,
      teamRecentForm: async () => {
        throw new Error("upstream failure");
      },
    }),
    AggregateError,
  );
});

test("loadMatchRecentForm returns null when the fixture has no teams", async () => {
  const result = await loadMatchRecentForm({
    fixtureId: "missing",
    getMatchCentre: async () => null,
    teamRecentForm: async () => {
      throw new Error("must not be called");
    },
  });

  assert.equal(result, null);
});
