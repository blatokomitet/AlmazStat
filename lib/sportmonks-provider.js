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

function scoreByDescription(fixture, description, side) {
  const scores = Array.isArray(fixture?.scores) ? fixture.scores : [];
  return (
    scores.find(
      (score) =>
        String(score?.description || "").toUpperCase() === description &&
        String(score?.score?.participant || "").toLowerCase() === side,
    )?.score?.goals ?? null
  );
}

function normalizeTeam(participant) {
  if (!participant) {
    return {
      id: null,
      name: null,
      shortCode: null,
      logo: null,
      winner: null,
      tablePosition: null,
    };
  }
  return {
    id: participant.id ?? null,
    name: participant.name ?? null,
    shortCode: participant.short_code ?? null,
    logo: participant.image_path ?? null,
    winner:
      participant?.meta?.winner === undefined ? null : Boolean(participant.meta.winner),
    tablePosition: participant?.meta?.position ?? null,
  };
}

function normalizeLeague(fixture) {
  const league = fixture?.league || {};
  return {
    id: league.id ?? fixture?.league_id ?? null,
    name: league.name ?? null,
    shortCode: league.short_code ?? null,
    country: league.country?.name ?? null,
    logo: league.image_path ?? null,
    season: fixture?.season_id ?? null,
    round: fixture?.round?.name ?? fixture?.round_id ?? null,
  };
}

function normalizeVenue(venue) {
  if (!venue) return null;
  return {
    id: venue.id ?? null,
    name: venue.name ?? null,
    address: venue.address ?? null,
    city: venue.city_name ?? venue.city?.name ?? null,
    capacity: venue.capacity ?? null,
    surface: venue.surface ?? null,
    image: venue.image_path ?? null,
    latitude: venue.latitude ?? null,
    longitude: venue.longitude ?? null,
  };
}

function normalizeSportmonksTeam(team) {
  if (!team) return null;
  return {
    id: team.id ?? null,
    name: team.name ?? null,
    code: team.short_code ?? null,
    shortCode: team.short_code ?? null,
    logo: team.image_path ?? null,
    country: team.country?.name ?? null,
    countryId: team.country_id ?? null,
    founded: team.founded ?? null,
    gender: team.gender ?? null,
    type: team.type ?? null,
    lastPlayedAt: normalizeDate(team.last_played_at),
    venue: normalizeVenue(team.venue),
  };
}

function normalizeSportmonksLeagueEntity(league) {
  if (!league) return null;
  const seasonRows = Array.isArray(league.seasons)
    ? league.seasons
    : league.currentSeason
      ? [league.currentSeason]
      : league.current_season
        ? [league.current_season]
        : [];
  return {
    id: league.id ?? null,
    name: league.name ?? null,
    shortCode: league.short_code ?? null,
    logo: league.image_path ?? null,
    type: league.type ?? null,
    country: league.country
      ? { id: league.country.id ?? league.country_id ?? null, name: league.country.name ?? null, flag: league.country.image_path ?? null }
      : { id: league.country_id ?? null, name: null, flag: null },
    seasons: seasonRows.map((season) => ({
      id: season.id ?? null,
      year: season.id ?? null,
      name: season.name ?? (season.starting_at ? String(season.starting_at).slice(0, 4) : null),
      current: Boolean(season.is_current),
      start: normalizeDate(season.starting_at),
      end: normalizeDate(season.ending_at),
    })),
  };
}

function teamCompetitions(team) {
  const seasons = team?.activeSeasons || team?.active_seasons || team?.activeseasons || [];
  const groups = new Map();
  for (const season of Array.isArray(seasons) ? seasons : []) {
    const league = season?.league || {};
    const leagueId = league.id ?? season?.league_id ?? null;
    if (!leagueId) continue;
    if (!groups.has(String(leagueId))) {
      groups.set(String(leagueId), {
        id: leagueId,
        name: league.name ?? null,
        logo: league.image_path ?? null,
        seasons: [],
      });
    }
    groups.get(String(leagueId)).seasons.push({
      id: season.id ?? null,
      year: season.id ?? null,
      name: season.name ?? (season.starting_at ? String(season.starting_at).slice(0, 4) : null),
      current: Boolean(season.is_current),
    });
  }
  return [...groups.values()];
}

function normalizeWeather(report) {
  if (!report) return null;
  return {
    temperature: report?.temperature?.current ?? report?.current?.temp ?? null,
    feelsLike: report?.feels_like?.current ?? report?.current?.feels_like ?? null,
    windSpeed: report?.wind?.speed ?? report?.current?.wind ?? null,
    windDirection: report?.wind?.direction ?? report?.current?.direction ?? null,
    humidity: report?.humidity ?? report?.current?.humidity ?? null,
    pressure: report?.pressure ?? report?.current?.pressure ?? null,
    clouds: report?.clouds ?? report?.current?.clouds ?? null,
    description: report?.description ?? report?.current?.description ?? null,
    icon: report?.icon ?? null,
    metric: report?.metric ?? null,
    type: report?.type ?? null,
  };
}

function normalizeEvent(event) {
  return {
    id: event?.id ?? null,
    teamId: event?.participant_id ?? null,
    minute: event?.minute ?? null,
    extraMinute: event?.extra_minute ?? null,
    result: event?.result ?? null,
    info: event?.info ?? null,
    addition: event?.addition ?? null,
    injured: event?.injured ?? null,
    rescinded: event?.rescinded ?? null,
    type: {
      id: event?.type?.id ?? event?.type_id ?? null,
      name: event?.type?.name ?? null,
      code: event?.type?.code ?? null,
      developerName: event?.type?.developer_name ?? null,
    },
    player: event?.player
      ? {
          id: event.player.id ?? event.player_id ?? null,
          name: event.player.display_name ?? event.player_name ?? null,
          image: event.player.image_path ?? null,
          positionId: event.player.position_id ?? null,
          detailedPositionId: event.player.detailed_position_id ?? null,
        }
      : event?.player_id || event?.player_name
        ? {
            id: event?.player_id ?? null,
            name: event?.player_name ?? null,
            image: null,
            positionId: null,
            detailedPositionId: null,
          }
        : null,
    relatedPlayer:
      event?.related_player_id || event?.related_player_name
        ? {
            id: event?.related_player_id ?? null,
            name: event?.related_player_name ?? null,
          }
        : null,
    period: event?.period
      ? {
          id: event.period.id ?? null,
          description: event.period.description ?? null,
          sortOrder: event.period.sort_order ?? null,
        }
      : null,
  };
}

function normalizeStatistic(row) {
  return {
    id: row?.id ?? null,
    teamId: row?.participant_id ?? null,
    location: row?.location ?? null,
    value: row?.data?.value ?? null,
    type: {
      id: row?.type?.id ?? row?.type_id ?? null,
      name: row?.type?.name ?? null,
      code: row?.type?.code ?? null,
      developerName: row?.type?.developer_name ?? null,
      group: row?.type?.stat_group ?? null,
    },
  };
}

function normalizePlayerDetail(detail) {
  return {
    id: detail?.id ?? null,
    value: detail?.data?.value ?? null,
    type: {
      id: detail?.type?.id ?? detail?.type_id ?? null,
      name: detail?.type?.name ?? null,
      code: detail?.type?.code ?? null,
      developerName: detail?.type?.developer_name ?? null,
      group: detail?.type?.stat_group ?? null,
    },
  };
}

function normalizeLineupEntry(entry) {
  return {
    id: entry?.id ?? null,
    teamId: entry?.team_id ?? null,
    playerId: entry?.player_id ?? null,
    playerName: entry?.player?.display_name ?? entry?.player_name ?? null,
    playerImage: entry?.player?.image_path ?? null,
    jerseyNumber: entry?.jersey_number ?? null,
    positionId: entry?.position_id ?? entry?.player?.position_id ?? null,
    detailedPositionId: entry?.player?.detailed_position_id ?? null,
    formationField: entry?.formation_field ?? null,
    formationPosition: entry?.formation_position ?? null,
    role:
      entry?.type?.developer_name ??
      (Number(entry?.type_id) === 11 ? "LINEUP" : Number(entry?.type_id) === 12 ? "BENCH" : null),
    details: Array.isArray(entry?.details)
      ? entry.details.map(normalizePlayerDetail)
      : [],
  };
}

function lineupTeam(lineups, teamId) {
  const rows = lineups.filter((entry) => Number(entry.teamId) === Number(teamId));
  return {
    starters: rows
      .filter((entry) => entry.role === "LINEUP")
      .sort(
        (a, b) =>
          Number(a.formationPosition ?? 999) - Number(b.formationPosition ?? 999),
      ),
    bench: rows
      .filter((entry) => entry.role === "BENCH")
      .sort((a, b) => Number(a.jerseyNumber ?? 999) - Number(b.jerseyNumber ?? 999)),
  };
}

function normalizeSideline(row) {
  const sideline = row?.sideline || {};
  const player = sideline?.player || {};
  const type = sideline?.type || {};
  return {
    id: row?.id ?? null,
    teamId: row?.participant_id ?? sideline?.team_id ?? null,
    category: sideline?.category ?? null,
    startDate: sideline?.start_date ?? null,
    endDate: sideline?.end_date ?? null,
    gamesMissed: sideline?.games_missed ?? null,
    completed: sideline?.completed ?? null,
    player: {
      id: player?.id ?? row?.player_id ?? null,
      name: player?.display_name ?? player?.name ?? null,
      image: player?.image_path ?? null,
      positionId: player?.position_id ?? null,
    },
    reason: {
      id: type?.id ?? row?.type_id ?? null,
      name: type?.name ?? null,
      code: type?.code ?? null,
      developerName: type?.developer_name ?? null,
    },
  };
}


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

function isUsableRecentFormFixture(fixture) {
  return (
    fixture.fixtureId !== null &&
    fixture.side !== null &&
    fixture.opponent.id !== null &&
    fixture.result !== null &&
    ["FT", "AET", "PEN"].includes(fixture.state)
  );
}

function normalizeHeadToHeadFixture(fixture) {
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

export function normalizeSportmonksMatchCentre(fixture) {
  const base = normalizeSportmonksFixtureDetails(fixture);
  const rawLineups = Array.isArray(fixture?.lineups)
    ? fixture.lineups.map(normalizeLineupEntry)
    : [];
  const events = Array.isArray(fixture?.events)
    ? fixture.events.map(normalizeEvent).filter((event) => event.id !== null)
    : [];
  const statistics = Array.isArray(fixture?.statistics)
    ? fixture.statistics
        .map(normalizeStatistic)
        .filter((statistic) => statistic.type.id !== null)
    : [];
  const injuries = Array.isArray(fixture?.sidelined)
    ? fixture.sidelined.map(normalizeSideline)
    : [];

  return {
    ...base,
    scoreBreakdown: {
      firstHalf: {
        home: scoreByDescription(fixture, "1ST_HALF", "home"),
        away: scoreByDescription(fixture, "1ST_HALF", "away"),
      },
      secondHalf: {
        home: scoreByDescription(fixture, "2ND_HALF_ONLY", "home"),
        away: scoreByDescription(fixture, "2ND_HALF_ONLY", "away"),
      },
    },
    resultInfo: fixture?.result_info ?? null,
    events,
    statistics,
    lineups: {
      home: lineupTeam(rawLineups, base.home.id),
      away: lineupTeam(rawLineups, base.away.id),
    },
    injuries,
    venue: normalizeVenue(fixture?.venue),
    weather: normalizeWeather(fixture?.weatherreport),
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

  async function fixturesBySeason(seasonId) {
    const result = await request("/fixtures", {
      include: "participants;scores;state;league",
      filters: `fixtureSeasons:${seasonId}`,
      per_page: 50,
    });
    return {
      matches: (Array.isArray(result.data) ? result.data : [])
        .map(normalizeSportmonksMatch)
        .filter((match) => match.fixtureId !== null),
      meta: { provider: "sportmonks", pagination: result.pagination, rateLimit: result.rateLimit },
    };
  }

  async function leaguesByDate(date) {
    const result = await request(`/leagues/date/${encodeURIComponent(date)}`, { include: "country;currentSeason" });
    return {
      leagues: (Array.isArray(result.data) ? result.data : [])
        .map(normalizeSportmonksLeagueEntity)
        .filter((league) => league?.id !== null),
      meta: { provider: "sportmonks", pagination: result.pagination, rateLimit: result.rateLimit },
    };
  }

  async function leaguesSearch(search) {
    const result = await request(`/leagues/search/${encodeURIComponent(search)}`, { include: "country;currentSeason" });
    return {
      leagues: (Array.isArray(result.data) ? result.data : [])
        .map(normalizeSportmonksLeagueEntity)
        .filter((league) => league?.id !== null),
      meta: { provider: "sportmonks", pagination: result.pagination, rateLimit: result.rateLimit },
    };
  }

  async function leagueById(leagueId) {
    const result = await request(`/leagues/${encodeURIComponent(leagueId)}`, { include: "country;currentSeason" });
    return {
      league: normalizeSportmonksLeagueEntity(result.data),
      meta: { provider: "sportmonks", rateLimit: result.rateLimit },
    };
  }


  async function teamRecentForm(teamId, { limit = 5 } = {}) {
    const result = await request(`/teams/${encodeURIComponent(teamId)}`, {
      // Keep Recent Form deliberately lightweight. Team-by-ID supports the
      // latest fixture relation and up to three nested include levels; the
      // form card only needs participants, scores, state and league.
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
      // Form must be based on completed, attributable results only. Returning
      // live or malformed fixtures would turn an in-progress score into W/D/L.
      .filter(isUsableRecentFormFixture)
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

  async function teamsSearch(search) {
    const result = await request(`/teams/search/${encodeURIComponent(search)}`, {
      include: "country;venue",
    });
    return {
      teams: (Array.isArray(result.data) ? result.data : [])
        .map(normalizeSportmonksTeam)
        .filter((team) => team?.id !== null),
      meta: { provider: "sportmonks", pagination: result.pagination, rateLimit: result.rateLimit },
    };
  }

  async function teamsBySeason(seasonId) {
    const result = await request(`/teams/seasons/${encodeURIComponent(seasonId)}`, {
      include: "country;venue",
    });
    return {
      teams: (Array.isArray(result.data) ? result.data : [])
        .map(normalizeSportmonksTeam)
        .filter((team) => team?.id !== null),
      meta: { provider: "sportmonks", pagination: result.pagination, rateLimit: result.rateLimit },
    };
  }

  async function teamById(teamId) {
    const richIncludes = [
      "country",
      "venue",
      "activeSeasons.league",
      "latest.statistics.type",
      "latest.xgfixture.type",
      "latest.participants",
      "latest.scores.type",
      "latest.state",
      "latest.league",
    ].join(";");
    let result;
    let includeMode = "rich";
    try {
      result = await request(`/teams/${encodeURIComponent(teamId)}`, { include: richIncludes });
    } catch {
      includeMode = "basic";
      result = await request(`/teams/${encodeURIComponent(teamId)}`, {
        include: "country;venue;activeSeasons.league;latest.participants;latest.scores;latest.state;latest.league",
      });
    }
    const raw = result.data || null;
    const latest = Array.isArray(raw?.latest) ? raw.latest : [];
    return {
      team: normalizeSportmonksTeam(raw),
      fixtures: latest.map(normalizeSportmonksMatch).filter((match) => match.fixtureId !== null),
      form: latest
        .map((fixture) => normalizeRecentFormFixture(fixture, teamId))
        .filter(isUsableRecentFormFixture)
        .sort((a, b) => Number(b.date ? Date.parse(b.date) : 0) - Number(a.date ? Date.parse(a.date) : 0))
        .slice(0, 5),
      competitions: teamCompetitions(raw),
      meta: { provider: "sportmonks", includeMode, rateLimit: result.rateLimit },
    };
  }

  async function headToHead(firstTeamId, secondTeamId, { limit = 5 } = {}) {
    const result = await request(
      `/fixtures/head-to-head/${encodeURIComponent(firstTeamId)}/${encodeURIComponent(secondTeamId)}`,
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


  async function standingsBySeason(seasonId) {
    const pathname = "/standings/seasons/" + encodeURIComponent(seasonId);
    let result;
    let includeMode = "rich";

    // Sportmonks subscriptions can differ in how nested standing detail
    // includes are exposed. Prefer the richest response, but always fall
    // back to a documented shallow response so rank/points/team still work.
    try {
      result = await request(pathname, {
        include: "participant;details;details.type;form",
      });
    } catch (error) {
      includeMode = "shallow";
      try {
        result = await request(pathname, {
          include: "participant;details;form",
        });
      } catch (shallowError) {
        includeMode = "minimal";
        result = await request(pathname, {
          include: "participant",
        });
      }
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      standings: rows
        .map(normalizeSportmonksStanding)
        .filter((row) => row?.team?.id !== null),
      meta: {
        provider: "sportmonks",
        includeMode,
        pagination: result.pagination,
        rateLimit: result.rateLimit,
      },
    };
  }

  async function fixtureById(fixtureId, { deep = false } = {}) {
    const include = deep
      ? [
          "participants",
          "scores",
          "state",
          "league",
          "venue",
          "events.type",
          "events.player",
          "events.period",
          "statistics.type",
          "lineups.player",
          "lineups.type",
          "lineups.details.type",
          "sidelined.sideline.player",
          "sidelined.sideline.type",
          "weatherreport",
        ].join(";")
      : "participants;scores;state;league;venue";
    const result = await request(`/fixtures/${encodeURIComponent(fixtureId)}`, {
      include,
    });
    if (!result.data) return null;
    return {
      fixture: deep
        ? normalizeSportmonksMatchCentre(result.data)
        : normalizeSportmonksFixtureDetails(result.data),
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
    fixturesBySeason,
    fixtureById,
    leaguesByDate,
    leaguesSearch,
    leagueById,
    teamRecentForm,
    teamById,
    teamsSearch,
    teamsBySeason,
    headToHead,
    standingsBySeason,
  };
}
