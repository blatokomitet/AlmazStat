export async function loadMatchRecentForm({
  fixtureId,
  getMatchCentre,
  teamRecentForm,
  limit = 5,
}) {
  const centre = await getMatchCentre(fixtureId);
  if (!centre?.home?.id || !centre?.away?.id) return null;

  const sides = ["home", "away"];
  const settled = await Promise.allSettled([
    teamRecentForm(centre.home.id, { limit }),
    teamRecentForm(centre.away.id, { limit }),
  ]);

  const form = { home: [], away: [] };
  const failedSides = [];

  settled.forEach((entry, index) => {
    const side = sides[index];
    if (entry.status === "fulfilled") {
      form[side] = Array.isArray(entry.value?.matches) ? entry.value.matches : [];
    } else {
      failedSides.push(side);
    }
  });

  if (failedSides.length === sides.length) {
    throw new AggregateError(
      settled.map((entry) => entry.reason),
      "Both Sportmonks recent-form requests failed.",
    );
  }

  const populatedSides = sides.filter((side) => form[side].length > 0);
  const dataState =
    populatedSides.length === sides.length
      ? "available"
      : populatedSides.length > 0
        ? "partial"
        : "provider_empty";

  return {
    form,
    source: dataState === "available",
    dataState,
    provider: "sportmonks",
    failedSides,
  };
}
