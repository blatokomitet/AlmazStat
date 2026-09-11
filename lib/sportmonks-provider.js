const DEFAULT_BASE_URL = "https://api.sportmonks.com/v3/football";

function requireToken(token) {
  if (!token) {
    const error = new Error("SPORTMONKS_API_TOKEN is missing.");
    error.code = "SPORTMONKS_TOKEN_MISSING";
    throw error;
  }
}

function toTimestamp(value) {
  if (!value) return null;
  const normalized = String(value).includes("T")
    ? String(value)
    : `${String(value).replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const stringValue = String(value);
  return stringValue.includes("T") ? stringValue : `${stringValue.replace(" ", "T")}Z`;
}

function stateToShort(state) {
  const raw = String(
    state?.developer_name || state?.short_name || state?.name || "",
  )
    .trim()
    .toUpperCase();

  if (!raw) return null;
  if (/(FINISHED|FULL.?TIME|FT)/.test(raw)) return "FT";
  if (/(HALF.?TIME|HT)/.test(raw)) return "HT";
  if (/(1ST.?HALF|FIRST.?HALF|INPLAY.?1)/.test(raw)) return "1H";
  if (/(2ND.?HALF|SECOND.?HALF|INPLAY.?2)/.test(raw)) return "2H";
  if (/(EXTRA.?TIME)/.test(raw)) return "ET";
  if (/(PENALT)/.test(raw)) return "P";
  if (/(POSTPON)/.test(raw)) return "PST";
  if (/(CANCEL)/.test(raw)) return "CANC";
  if (/(SUSPEND|INTERRUPT)/.test(raw)) return "SUSP";
  if (/(LIVE|INPLAY|IN.?PLAY)/.test(raw)) return "LIVE";
  if (/(NOT.?STARTED|SCHEDULED|NS)/.test(raw)) return "NS";
  return raw.slice(0, 12);
}

function participantLocation(participant) {
  return String(participant?.meta?.location || "").toLowerCase();
}

function findParticipant(fixture, location) {
  const participants = Array.isArray(fixture?.participants)
    ? fixture.participants
    : [];
  return (
    participants.find((participant) => participantLocation(participant) === location) ||
    null
  );
}

function currentScoreBySide(fixture, side) {
  const scores = Array.isArray(fixture?.scores) ? fixture.scores : [];
  const preferred = scores.find(
    (score) =>
      String(score?.description || "").toUpperCase() === "CURRENT" &&
      String(score?.score?.participant || "").toLowerCase() === side,
  );
  if (preferred?.score?.goals !== undefined) return preferred.score.goals;

  const fallback = [...scores]
    .reverse()
    .find(
      (score) =>
        String(score?.score?.participant || "").toLowerCase() === side &&
        score?.score?.goals !== undefined,
    );
  return fallback?.score?.goals ?? null;
}

function normalizeTeam(participant) {
  if (!participant) {
    return { id: null, name: null, logo: null, winner: null };
  }
  return {
    id: participant.id ?? null,
    name: participant.name ?? null,
    logo: participant.image_path ?? null,
    winner:
      participant?.meta?.winner === undefined ? null : Boolean(participant.meta.winner),
  };
}

function normalizeLeague(fixture) {
  const league = fixture?.league || {};
  return {
    id: league.id ?? fixture?.league_id ?? null,
    name: league.name ?? null,
    country: league.country?.name ?? null,
    logo: league.image_path ?? null,
    season: fixture?.season_id ?? null,
    round: fixture?.round?.name ?? fixture?.round_id ?? null,
  };
}

export function normalizeSportmonksMatch(fixture) {
  const homeParticipant = findParticipant(fixture, "home");
  const awayParticipant = findParticipant(fixture, "away");
  const statusShort = stateToShort(fixture?.state);

  return {
    fixtureId: fixture?.id ?? null,
    date: normalizeDate(fixture?.starting_at),
    timestamp:
      fixture?.starting_at_timestamp ?? toTimestamp(fixture?.starting_at),
    status: {
      short: statusShort,
      long:
        fixture?.state?.name ?? fixture?.state?.developer_name ?? statusShort,
      elapsed:
        fixture?.periods?.find?.((period) => period?.ticking)?.minutes ?? null,
    },
    league: normalizeLeague(fixture),
    home: normalizeTeam(homeParticipant),
    away: normalizeTeam(awayParticipant),
    goals: {
      home: currentScoreBySide(fixture, "home"),
      away: currentScoreBySide(fixture, "away"),
    },
    provider: "sportmonks",
  };
}

export function normalizeSportmonksFixtureDetails(fixture) {
  const normalized = normalizeSportmonksMatch(fixture);
  return {
    fixture: {
      id: normalized.fixtureId,
      date: normalized.date,
      timestamp: normalized.timestamp,
      status: normalized.status,
      venue: fixture?.venue?.name ?? null,
    },
    league: normalized.league,
    home: normalized.home,
    away: normalized.away,
    score: normalized.goals,
    provider: "sportmonks",
  };
}

export function createSportmonksProvider({
  token = process.env.SPORTMONKS_API_TOKEN,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = 12000,
} = {}) {
  const inflight = new Map();

  async function request(pathname, parameters = {}) {
    requireToken(token);
    const url = new URL(`${baseUrl}${pathname}`);
    url.searchParams.set("api_token", token);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const safeKey = `${url.origin}${url.pathname}?${[...url.searchParams.entries()]
      .filter(([key]) => key !== "api_token")
      .map(([key, value]) => `${key}=${value}`)
      .join("&")}`;

    if (inflight.has(safeKey)) return inflight.get(safeKey);

    const pending = (async () => {
      const upstreamResponse = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json" },
      });
      let payload;
      try {
        payload = await upstreamResponse.json();
      } catch {
        payload = null;
      }

      if (!upstreamResponse.ok) {
        const message =
          payload?.message ||
          payload?.error ||
          `Sportmonks returned HTTP ${upstreamResponse.status}.`;
        const error = new Error(String(message));
        error.code = "SPORTMONKS_UPSTREAM_ERROR";
        error.status = upstreamResponse.status;
        throw error;
      }

      return {
        data: payload?.data ?? null,
        pagination: payload?.pagination ?? null,
        subscription: payload?.subscription ?? null,
        rateLimit: {
          remaining:
            upstreamResponse.headers.get("x-ratelimit-remaining") ?? null,
          limit: upstreamResponse.headers.get("x-ratelimit-limit") ?? null,
        },
      };
    })().finally(() => inflight.delete(safeKey));

    inflight.set(safeKey, pending);
    return pending;
  }

  async function fixturesByDate(date) {
    const result = await request(`/fixtures/date/${encodeURIComponent(date)}`, {
      include: "participants;scores;state;league",
    });
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      matches: rows
        .map(normalizeSportmonksMatch)
        .filter((match) => match.fixtureId !== null),
      meta: {
        provider: "sportmonks",
        pagination: result.pagination,
        rateLimit: result.rateLimit,
      },
    };
  }

  async function fixtureById(fixtureId, { deep = false } = {}) {
    const include = deep
      ? "participants;scores;state;league;venue;events;statistics.type;lineups"
      : "participants;scores;state;league;venue";
    const result = await request(`/fixtures/${encodeURIComponent(fixtureId)}`, {
      include,
    });
    if (!result.data) return null;
    return {
      fixture: normalizeSportmonksFixtureDetails(result.data),
      raw: deep ? result.data : undefined,
      meta: {
        provider: "sportmonks",
        rateLimit: result.rateLimit,
      },
    };
  }

  return {
    name: "sportmonks",
    request,
    fixturesByDate,
    fixtureById,
  };
}
