(function () {
  "use strict";

  const telegram = window.Telegram && window.Telegram.WebApp;
  const params = new URLSearchParams(window.location.search);

  if (telegram) {
    telegram.ready();
    telegram.expand();
  }

  const fixtureFromQuery = (params.get("fixture") || "").trim();
  const fixtureFromTelegram = (
    (telegram && telegram.initDataUnsafe && telegram.initDataUnsafe.start_param) ||
    params.get("tgWebAppStartParam") ||
    ""
  ).trim();
  const fixtureId = fixtureFromQuery || fixtureFromTelegram;

  const elements = {
    matchesScreen: document.getElementById("matches-screen"),
    analysisScreen: document.getElementById("analysis-screen"),
    matchesHeading: document.getElementById("matches-heading"),
    matchesDate: document.getElementById("matches-date"),
    matchesState: document.getElementById("matches-state"),
    matchesList: document.getElementById("matches-list"),
    matchesNav: document.getElementById("matches-nav"),
    analyticsNav: document.getElementById("analytics-nav"),
    dataStatus: document.getElementById("data-status"),
    dataStatusText: document.getElementById("data-status-text"),
    leagueName: document.getElementById("league-name"),
    homeName: document.getElementById("home-name"),
    awayName: document.getElementById("away-name"),
    homeLogo: document.getElementById("home-logo"),
    awayLogo: document.getElementById("away-logo"),
    homeCrest: document.getElementById("home-crest"),
    awayCrest: document.getElementById("away-crest"),
    matchScore: document.getElementById("match-score"),
    fixtureStatus: document.getElementById("fixture-status"),
    matchDate: document.getElementById("match-date"),
    predictionContent: document.getElementById("prediction-content"),
    predictionEmpty: document.getElementById("prediction-empty"),
    predictionPick: document.getElementById("prediction-pick"),
    predictionWinner: document.getElementById("prediction-winner"),
    predictionHome: document.getElementById("prediction-home"),
    predictionDraw: document.getElementById("prediction-draw"),
    predictionAway: document.getElementById("prediction-away"),
    predictionAdvice: document.getElementById("prediction-advice"),
    metricsSection: document.getElementById("metrics-section"),
    metricsList: document.getElementById("metrics-list"),
    formContent: document.getElementById("form-content"),
    h2hContent: document.getElementById("h2h-content"),
    standingsContent: document.getElementById("standings-content"),
    standingsLabel: document.getElementById("standings-label"),
    oddsContent: document.getElementById("odds-content"),
    riskLevel: document.getElementById("risk-level"),
    riskDescription: document.getElementById("risk-description"),
    riskScore: document.getElementById("risk-score"),
    riskFill: document.getElementById("risk-fill"),
    riskSources: document.getElementById("risk-sources"),
    pageError: document.getElementById("page-error"),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setDataStatus(state) {
    const labels = {
      loading: "LOADING",
      live: "LIVE DATA",
      error: "DATA ERROR",
    };
    elements.dataStatus.dataset.state = state;
    elements.dataStatusText.textContent = labels[state];
  }

  function showError(message) {
    elements.pageError.textContent = message;
    elements.pageError.hidden = false;
    setDataStatus("error");
  }

  function formatDate(value, compact) {
    if (!value) return "Нет данных";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Нет данных";

    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: compact ? "2-digit" : "short",
      year: compact ? "2-digit" : "numeric",
      hour: compact ? undefined : "2-digit",
      minute: compact ? undefined : "2-digit",
    }).format(date);
  }

  function dateForOffset(offset) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatMatchDay(value) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "Нет данных";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function formatMatchTime(value) {
    if (!value) return "Нет данных";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Нет данных";
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function setLogo(image, crest, url, teamName) {
    const placeholder = crest.querySelector(".crest-placeholder");
    image.hidden = true;
    placeholder.hidden = false;

    if (!url) return;

    image.alt = teamName ? `Логотип ${teamName}` : "Логотип команды";
    image.onload = function () {
      image.hidden = false;
      placeholder.hidden = true;
    };
    image.onerror = function () {
      image.hidden = true;
      placeholder.hidden = false;
    };
    image.src = url;
  }

  function renderFixture(match) {
    const home = match.teams && match.teams.home;
    const away = match.teams && match.teams.away;
    const goals = match.goals || {};
    const fixture = match.fixture || {};
    const status = fixture.status || {};

    elements.leagueName.textContent =
      (match.league && match.league.name) || "Нет данных";
    elements.homeName.textContent = (home && home.name) || "Нет данных";
    elements.awayName.textContent = (away && away.name) || "Нет данных";
    elements.matchScore.textContent = `${goals.home ?? "—"} : ${goals.away ?? "—"}`;
    elements.fixtureStatus.textContent =
      status.long || status.short || "Нет данных";
    elements.matchDate.textContent = formatDate(fixture.date, false);

    setLogo(elements.homeLogo, elements.homeCrest, home && home.logo, home && home.name);
    setLogo(elements.awayLogo, elements.awayCrest, away && away.logo, away && away.name);
  }

  function numericPercent(value) {
    if (value === null || value === undefined) return null;
    const parsed = Number.parseFloat(String(value).replace("%", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function displayPercent(value) {
    if (value === null || value === undefined || value === "") return "Нет данных";
    return String(value).includes("%") ? String(value) : `${value}%`;
  }

  function addMetric(name, value, extra) {
    if (value === null || value === undefined || value === "") return;
    const card = document.createElement("div");
    card.className = "stat";
    card.innerHTML = `
      <div class="stat-name">${escapeHtml(name)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
      ${extra ? `<div class="stat-extra">${escapeHtml(extra)}</div>` : ""}
    `;
    elements.metricsList.appendChild(card);
  }

  function renderPrediction(prediction) {
    const data = prediction && prediction.predictions;
    const percent = data && data.percent;
    const hasPercent =
      percent &&
      [percent.home, percent.draw, percent.away].some(
        (value) => value !== null && value !== undefined && value !== "",
      );

    if (!data || !hasPercent) {
      elements.predictionContent.hidden = true;
      elements.predictionEmpty.hidden = false;
      elements.metricsSection.hidden = true;
      return;
    }

    const options = [
      { key: "home", label: "П1", value: numericPercent(percent.home) },
      { key: "draw", label: "X", value: numericPercent(percent.draw) },
      { key: "away", label: "П2", value: numericPercent(percent.away) },
    ].filter((item) => item.value !== null);
    const highestValue = Math.max(...options.map((item) => item.value));
    const best = options.filter((item) => item.value === highestValue);
    const winner = data.winner || {};

    elements.predictionPick.textContent = best.length
      ? best.map((item) => item.label).join(" / ")
      : "Нет данных";
    elements.predictionWinner.textContent =
      winner.name ||
      winner.comment ||
      (best.length === 1 && best[0].key === "draw" ? "Ничья" : "");
    elements.predictionHome.textContent = displayPercent(percent.home);
    elements.predictionDraw.textContent = displayPercent(percent.draw);
    elements.predictionAway.textContent = displayPercent(percent.away);

    if (data.advice) {
      elements.predictionAdvice.textContent = data.advice;
      elements.predictionAdvice.hidden = false;
    } else {
      elements.predictionAdvice.hidden = true;
    }

    elements.predictionContent.hidden = false;
    elements.predictionEmpty.hidden = true;

    elements.metricsList.replaceChildren();
    const goals = data.goals || {};
    addMetric("Голы хозяев", goals.home, "Prediction API");
    addMetric("Голы гостей", goals.away, "Prediction API");

    const btts =
      data.btts ??
      data.both_teams_to_score ??
      data.bothTeamsToScore ??
      null;
    addMetric("Обе забьют", btts, "Prediction API");

    elements.metricsSection.hidden = elements.metricsList.children.length === 0;
  }

  function resultForTeam(match, teamId) {
    const status = match.fixture && match.fixture.status;
    if (!status || !["FT", "AET", "PEN"].includes(status.short)) return null;

    const isHome = match.teams && match.teams.home && match.teams.home.id === teamId;
    const isAway = match.teams && match.teams.away && match.teams.away.id === teamId;
    if (!isHome && !isAway) return null;

    const teamGoals = isHome ? match.goals.home : match.goals.away;
    const opponentGoals = isHome ? match.goals.away : match.goals.home;
    if (teamGoals === null || opponentGoals === null) return null;
    if (teamGoals > opponentGoals) return { label: "В", className: "win" };
    if (teamGoals < opponentGoals) return { label: "П", className: "loss" };
    return { label: "Н", className: "draw" };
  }

  function renderFormRow(team, matches) {
    const results = (matches || [])
      .map((match) => resultForTeam(match, team.id))
      .filter(Boolean)
      .slice(0, 5);

    const resultsHtml = results.length
      ? results
          .map(
            (result) =>
              `<div class="result ${result.className}">${result.label}</div>`,
          )
          .join("")
      : `<span class="list-secondary">Нет данных</span>`;

    return `
      <div class="form-row">
        <div class="form-team">${escapeHtml(team.name || "Нет данных")}</div>
        <div class="form-results">${resultsHtml}</div>
      </div>
    `;
  }

  function renderForm(match, form) {
    const home = match.teams.home;
    const away = match.teams.away;
    elements.formContent.innerHTML =
      renderFormRow(home, form && form.home) + renderFormRow(away, form && form.away);
  }

  function renderH2h(matches) {
    if (!matches || matches.length === 0) {
      elements.h2hContent.innerHTML = `<div class="empty-state">Нет данных</div>`;
      return;
    }

    elements.h2hContent.innerHTML = matches
      .slice(0, 5)
      .map(
        (match) => `
          <div class="list-row">
            <div class="list-primary">
              ${escapeHtml(match.teams.home.name)} — ${escapeHtml(match.teams.away.name)}
              <div class="list-secondary">${escapeHtml(formatDate(match.fixture.date, true))}</div>
            </div>
            <div class="list-value">${match.goals.home ?? "—"} : ${match.goals.away ?? "—"}</div>
          </div>
        `,
      )
      .join("");
  }

  function renderStandingCard(row) {
    if (!row) return "";
    const all = row.all || {};
    const goals = all.goals || {};

    return `
      <article class="standing-card">
        <div class="standing-head">
          <div class="standing-team">${escapeHtml(row.team.name)}</div>
          <div class="standing-rank">#${escapeHtml(row.rank ?? "—")}</div>
        </div>
        <div class="standing-grid">
          <div class="standing-stat"><span>И</span><strong>${escapeHtml(all.played ?? "—")}</strong></div>
          <div class="standing-stat"><span>В</span><strong>${escapeHtml(all.win ?? "—")}</strong></div>
          <div class="standing-stat"><span>Н</span><strong>${escapeHtml(all.draw ?? "—")}</strong></div>
          <div class="standing-stat"><span>П</span><strong>${escapeHtml(all.lose ?? "—")}</strong></div>
          <div class="standing-stat"><span>ГЗ</span><strong>${escapeHtml(goals.for ?? "—")}</strong></div>
          <div class="standing-stat"><span>ГП</span><strong>${escapeHtml(goals.against ?? "—")}</strong></div>
          <div class="standing-stat"><span>О</span><strong>${escapeHtml(row.points ?? "—")}</strong></div>
        </div>
      </article>
    `;
  }

  function renderStandings(standings, season) {
    elements.standingsLabel.textContent = season ? `Сезон ${season}` : "Сезон";
    const html =
      renderStandingCard(standings && standings.home) +
      renderStandingCard(standings && standings.away);
    elements.standingsContent.innerHTML =
      html || `<div class="list-card"><div class="empty-state">Нет данных</div></div>`;
  }

  function flattenOdds(odds) {
    const rows = [];
    for (const fixtureOdds of odds || []) {
      for (const bookmaker of fixtureOdds.bookmakers || []) {
        for (const market of bookmaker.bets || []) {
          for (const option of market.values || []) {
            rows.push({
              bookmaker: bookmaker.name,
              market: market.name,
              value: option.value,
              odd: option.odd,
            });
            if (rows.length >= 12) return rows;
          }
        }
      }
    }
    return rows;
  }

  function renderOdds(odds) {
    const rows = flattenOdds(odds);
    if (rows.length === 0) {
      elements.oddsContent.innerHTML =
        `<div class="empty-state">Коэффициенты недоступны</div>`;
      return;
    }

    elements.oddsContent.innerHTML = rows
      .map(
        (row) => `
          <div class="list-row">
            <div class="list-primary">
              ${escapeHtml(row.value)}
              <div class="list-secondary">${escapeHtml(row.bookmaker)} · ${escapeHtml(row.market)}</div>
            </div>
            <div class="list-value">${escapeHtml(row.odd)}</div>
          </div>
        `,
      )
      .join("");
  }

  function renderRisk(availability) {
    const sources = [
      ["fixture", "Fixture"],
      ["prediction", "Prediction"],
      ["form", "Form"],
      ["h2h", "H2H"],
      ["standings", "Standings"],
      ["odds", "Odds"],
    ];
    const availableCount = sources.filter(([key]) => availability[key]).length;
    const missingCount = sources.length - availableCount;
    const score = Math.round((missingCount / sources.length) * 100);

    let level = "HIGH DATA RISK";
    let description = "Большинство источников недоступно";
    if (score <= 33) {
      level = "LOW DATA RISK";
      description = "Большинство источников доступно";
    } else if (score <= 66) {
      level = "MEDIUM DATA RISK";
      description = "Доступна только часть источников";
    }

    elements.riskLevel.textContent = level;
    elements.riskDescription.textContent = description;
    elements.riskScore.textContent = String(score);
    elements.riskFill.style.width = `${score}%`;
    elements.riskSources.innerHTML = sources
      .map(
        ([key, label]) =>
          `<div class="source-item ${availability[key] ? "available" : ""}">${label}</div>`,
      )
      .join("");
  }

  function teamLogo(team) {
    if (!team || !team.logo) {
      return `<span class="team-logo-placeholder" aria-hidden="true">◇</span>`;
    }

    return `<img src="${escapeHtml(team.logo)}" alt="${escapeHtml(
      team.name ? `Логотип ${team.name}` : "Логотип команды",
    )}" loading="lazy" />`;
  }

  function showMatchScore(match) {
    const hiddenScoreStatuses = ["TBD", "NS", "PST", "CANC", "ABD", "AWD", "WO"];
    return (
      !hiddenScoreStatuses.includes(match.status && match.status.short) &&
      match.goals &&
      match.goals.home !== null &&
      match.goals.away !== null
    );
  }

  function renderMatches(matches) {
    const groups = new Map();

    for (const match of matches) {
      const league = match.league || {};
      const key = `${league.id ?? "unknown"}:${league.name ?? ""}:${league.country ?? ""}`;
      if (!groups.has(key)) {
        groups.set(key, {
          league,
          matches: [],
        });
      }
      groups.get(key).matches.push(match);
    }

    elements.matchesList.innerHTML = Array.from(groups.values())
      .map(({ league, matches: leagueMatches }) => {
        const cards = leagueMatches
          .map((match) => {
            const status = match.status || {};
            const elapsed =
              status.elapsed !== null && status.elapsed !== undefined
                ? ` · ${status.elapsed}'`
                : "";
            const score = showMatchScore(match)
              ? `<div class="fixture-card-score">${escapeHtml(
                  match.goals.home,
                )} : ${escapeHtml(match.goals.away)}</div>`
              : "";

            return `
              <button class="fixture-card" type="button" data-fixture-id="${escapeHtml(match.fixtureId)}">
                <div class="fixture-card-top">
                  <span>${escapeHtml(formatMatchTime(match.date))}</span>
                  <span class="fixture-card-status">${escapeHtml(
                    status.long || status.short || "Нет данных",
                  )}${escapeHtml(elapsed)}</span>
                </div>
                <div class="fixture-card-teams">
                  <div class="fixture-card-team">
                    ${teamLogo(match.home)}
                    <span>${escapeHtml(match.home?.name || "Нет данных")}</span>
                  </div>
                  <div class="fixture-card-team">
                    ${teamLogo(match.away)}
                    <span>${escapeHtml(match.away?.name || "Нет данных")}</span>
                  </div>
                  ${score}
                </div>
              </button>
            `;
          })
          .join("");

        return `
          <section class="league-group">
            <div class="league-group-title">
              ${escapeHtml(league.name || "Нет данных")}
              <div class="league-group-country">${escapeHtml(
                league.country || "Нет данных",
              )}</div>
            </div>
            <div class="matches-grid">${cards}</div>
          </section>
        `;
      })
      .join("");

    for (const card of elements.matchesList.querySelectorAll("[data-fixture-id]")) {
      card.addEventListener("click", function () {
        const selectedFixture = card.dataset.fixtureId;
        if (selectedFixture) {
          window.location.href = `/?fixture=${encodeURIComponent(selectedFixture)}`;
        }
      });
    }
  }

  async function loadMatches(offset) {
    const selectedDate = dateForOffset(offset);
    const labels = {
      "-1": "Вчера",
      "0": "Сегодня",
      "1": "Завтра",
    };

    elements.matchesHeading.textContent = labels[String(offset)] || "Матчи";
    elements.matchesDate.textContent = formatMatchDay(selectedDate);
    elements.matchesList.replaceChildren();
    elements.matchesState.textContent = "Загрузка матчей";
    elements.matchesState.hidden = false;
    setDataStatus("loading");

    for (const button of document.querySelectorAll("[data-day-offset]")) {
      button.classList.toggle(
        "active",
        Number(button.dataset.dayOffset) === offset,
      );
    }

    try {
      const response = await fetch(
        `/api/matches?date=${encodeURIComponent(selectedDate)}`,
      );
      const payload = await response.json();

      if (!response.ok) throw new Error("Не удалось загрузить матчи");

      const matches = Array.isArray(payload.matches) ? payload.matches : [];
      if (matches.length === 0) {
        elements.matchesState.textContent = "На эту дату матчей нет";
      } else {
        elements.matchesState.hidden = true;
        renderMatches(matches);
      }
      setDataStatus("live");
    } catch {
      elements.matchesState.textContent = "Не удалось загрузить матчи";
      setDataStatus("error");
    }
  }

  function setupDateSwitcher() {
    for (const button of document.querySelectorAll("[data-day-offset]")) {
      button.addEventListener("click", function () {
        loadMatches(Number(button.dataset.dayOffset));
      });
    }
  }

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const views = Array.from(document.querySelectorAll(".content-view"));

    for (const tab of tabs) {
      tab.addEventListener("click", function () {
        for (const item of tabs) item.classList.toggle("active", item === tab);
        for (const view of views) {
          view.classList.toggle("active", view.id === `view-${tab.dataset.view}`);
        }
      });
    }
  }

  async function loadMatch() {
    setDataStatus("loading");

    try {
      const response = await fetch(`/api/match?fixture=${encodeURIComponent(fixtureId)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload && payload.error && payload.error.message
            ? payload.error.message
            : "Не удалось получить данные матча.",
        );
      }

      const match = payload.response && payload.response[0];
      if (!match) throw new Error("API-Football не вернул данные по этому fixture.");

      const analytics = payload.analytics || {};
      renderFixture(match);
      renderPrediction(analytics.prediction);
      renderForm(match, analytics.form);
      renderH2h(analytics.h2h);
      renderStandings(analytics.standings, match.league && match.league.season);
      renderOdds(analytics.odds);
      renderRisk(
        analytics.availability || {
          fixture: true,
          prediction: false,
          form: false,
          h2h: false,
          standings: false,
          odds: false,
        },
      );
      setDataStatus("live");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Ошибка загрузки данных.");
    }
  }

  setupTabs();
  setupDateSwitcher();

  if (fixtureId) {
    elements.analysisScreen.hidden = false;
    elements.matchesScreen.hidden = true;
    elements.matchesNav.classList.remove("active");
    elements.analyticsNav.classList.add("active");
    elements.analyticsNav.disabled = false;
    elements.analyticsNav.setAttribute("aria-disabled", "false");
    loadMatch();
  } else {
    elements.matchesScreen.hidden = false;
    elements.analysisScreen.hidden = true;
    elements.matchesNav.classList.add("active");
    elements.analyticsNav.classList.remove("active");
    loadMatches(0);
  }
})();