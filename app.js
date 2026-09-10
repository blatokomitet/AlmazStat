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
  const loadedSections = new Set();
  const failedSections = new Set();
  const loadingSections = new Map();
  let currentMatch = null;
  let currentForm = null;
  let sourceState = {
    fixture: true,
    prediction: false,
    form: "unknown",
    h2h: "unknown",
    standings: "unknown",
    odds: "unknown",
  };
  const matchCenterStateKey = "almazstat.matchCenter";
  const liveStatuses = new Set([
    "1H",
    "HT",
    "2H",
    "ET",
    "BT",
    "P",
    "LIVE",
    "INT",
    "SUSP",
  ]);
  const upcomingStatuses = new Set(["NS", "TBD"]);
  const finishedStatuses = new Set(["FT", "AET", "PEN"]);
  const validFilters = new Set(["all", "live", "upcoming", "finished"]);
  let allMatches = [];
  let selectedDate = "";
  let selectedFilter = "all";
  let searchQuery = "";
  let matchesLoadSequence = 0;

  const elements = {
    matchesScreen: document.getElementById("matches-screen"),
    analysisScreen: document.getElementById("analysis-screen"),
    analysisState: document.getElementById("analysis-state"),
    analysisContent: document.getElementById("analysis-content"),
    matchesHeading: document.getElementById("matches-heading"),
    matchesDate: document.getElementById("matches-date"),
    matchesState: document.getElementById("matches-state"),
    matchesList: document.getElementById("matches-list"),
    matchSearch: document.getElementById("match-search"),
    matchFilters: document.getElementById("match-filters"),
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

  function isDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && dateForDate(date) === value;
  }

  function dateForDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function restoreMatchCenterState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(matchCenterStateKey) || "{}");
      selectedDate = isDateString(saved.selectedDate)
        ? saved.selectedDate
        : dateForOffset(0);
      selectedFilter = validFilters.has(saved.selectedFilter)
        ? saved.selectedFilter
        : "all";
      searchQuery =
        typeof saved.searchQuery === "string" ? saved.searchQuery.slice(0, 120) : "";
    } catch {
      selectedDate = dateForOffset(0);
      selectedFilter = "all";
      searchQuery = "";
    }
  }

  function saveMatchCenterState() {
    try {
      sessionStorage.setItem(
        matchCenterStateKey,
        JSON.stringify({ selectedDate, selectedFilter, searchQuery }),
      );
    } catch {
      // Match Center remains usable when browser storage is unavailable.
    }
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
    const home = match.home || {};
    const away = match.away || {};
    const goals = match.score || {};
    const fixture = match.fixture || {};
    const status = fixture.status || {};

    elements.leagueName.textContent = match.league?.name || "Нет данных";
    elements.homeName.textContent = home.name || "Нет данных";
    elements.awayName.textContent = away.name || "Нет данных";
    elements.matchScore.textContent = `${goals.home ?? "—"} : ${goals.away ?? "—"}`;
    elements.fixtureStatus.textContent =
      status.long || status.short || "Нет данных";
    elements.matchDate.textContent = formatDate(fixture.date, false);

    setLogo(elements.homeLogo, elements.homeCrest, home.logo, home.name);
    setLogo(elements.awayLogo, elements.awayCrest, away.logo, away.name);
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

  function formPercentage(matches) {
    const completed = (matches || []).filter((match) =>
      ["W", "D", "L"].includes(match.result),
    );
    if (completed.length === 0) return null;
    const points = completed.reduce(
      (total, match) =>
        total + (match.result === "W" ? 3 : match.result === "D" ? 1 : 0),
      0,
    );
    return Math.round((points / (completed.length * 3)) * 100);
  }

  function renderMetrics(prediction, form) {
    elements.metricsList.replaceChildren();
    const goals = prediction?.goals || {};
    addMetric("Голы хозяев", goals.home, "Prediction API");
    addMetric("Голы гостей", goals.away, "Prediction API");
    addMetric("Тотал", prediction?.underOver, "Prediction API");
    const homeForm = formPercentage(form?.home);
    const awayForm = formPercentage(form?.away);
    addMetric(
      "Форма хозяев",
      homeForm === null ? null : `${homeForm}%`,
      "Последние матчи",
    );
    addMetric(
      "Форма гостей",
      awayForm === null ? null : `${awayForm}%`,
      "Последние матчи",
    );
    elements.metricsSection.hidden = elements.metricsList.children.length === 0;
  }

  function renderPrediction(prediction, form) {
    const data = prediction;
    renderMetrics(data, form);
    const percent = data && data.percent;
    const hasPercent =
      percent &&
      [percent.home, percent.draw, percent.away].some(
        (value) => value !== null && value !== undefined && value !== "",
      );

    if (!data || !hasPercent) {
      elements.predictionContent.hidden = true;
      elements.predictionEmpty.hidden = false;
      return;
    }

    const options = [
      { key: "home", label: "П1", value: numericPercent(percent.home) },
      { key: "draw", label: "X", value: numericPercent(percent.draw) },
      { key: "away", label: "П2", value: numericPercent(percent.away) },
    ].filter((item) => item.value !== null);
    const highestValue = Math.max(...options.map((item) => item.value));
    const best = options.filter((item) => item.value === highestValue);
    elements.predictionPick.textContent = best.length
      ? best.map((item) => item.label).join(" / ")
      : "Нет данных";
    elements.predictionWinner.textContent =
      data.winner ||
      data.winnerComment ||
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

  }

  function renderFormRow(team, matches) {
    const resultClasses = {
      W: "win",
      D: "draw",
      L: "loss",
    };
    const resultLabels = {
      W: "В",
      D: "Н",
      L: "П",
    };
    const matchesHtml = (matches || []).length
      ? matches
          .slice(0, 5)
          .map(
            (match) => `
              <div class="form-match">
                <div class="result ${resultClasses[match.result] || ""}">
                  ${escapeHtml(resultLabels[match.result] || "—")}
                </div>
                <div class="form-match-opponent">
                  ${escapeHtml(match.opponent?.name || "Нет данных")}
                  <div class="list-secondary">
                    ${escapeHtml(formatDate(match.date, true))} ·
                    ${escapeHtml(match.side || "—")} ·
                    ${escapeHtml(match.league || "Нет данных")}
                  </div>
                </div>
                <div class="form-match-score">
                  ${escapeHtml(match.score?.home ?? "—")} :
                  ${escapeHtml(match.score?.away ?? "—")}
                </div>
              </div>
            `,
          )
          .join("")
      : `<div class="empty-state">Нет данных</div>`;

    return `
      <div class="form-team-block">
        <div class="form-team-title">${escapeHtml(team.name || "Нет данных")}</div>
        ${matchesHtml}
      </div>
    `;
  }

  function renderForm(match, form) {
    if (!(form?.home?.length || form?.away?.length)) {
      elements.formContent.innerHTML =
        `<div class="empty-state">Форма команд недоступна</div>`;
      return;
    }
    elements.formContent.innerHTML =
      renderFormRow(match.home, form && form.home) +
      renderFormRow(match.away, form && form.away);
  }

  function renderH2h(matches) {
    if (!matches || matches.length === 0) {
      elements.h2hContent.innerHTML =
        `<div class="empty-state">История очных встреч недоступна</div>`;
      return;
    }

    elements.h2hContent.innerHTML = matches
      .slice(0, 5)
      .map(
        (match) => `
          <div class="list-row">
            <div class="list-primary">
              ${escapeHtml(match.home?.name || "Нет данных")} —
              ${escapeHtml(match.away?.name || "Нет данных")}
              <div class="list-secondary">
                ${escapeHtml(formatDate(match.date, true))} ·
                ${escapeHtml(match.league || "Нет данных")}
              </div>
            </div>
            <div class="list-value">${match.score?.home ?? "—"} : ${match.score?.away ?? "—"}</div>
          </div>
        `,
      )
      .join("");
  }

  function renderStandingCard(row) {
    if (!row) return "";

    return `
      <article class="standing-card">
        <div class="standing-head">
          <div class="standing-team">${escapeHtml(row.team?.name || "Нет данных")}</div>
          <div class="standing-rank">#${escapeHtml(row.rank ?? "—")}</div>
        </div>
        <div class="standing-grid">
          <div class="standing-stat"><span>И</span><strong>${escapeHtml(row.played ?? "—")}</strong></div>
          <div class="standing-stat"><span>В</span><strong>${escapeHtml(row.win ?? "—")}</strong></div>
          <div class="standing-stat"><span>Н</span><strong>${escapeHtml(row.draw ?? "—")}</strong></div>
          <div class="standing-stat"><span>П</span><strong>${escapeHtml(row.lose ?? "—")}</strong></div>
          <div class="standing-stat"><span>ГЗ</span><strong>${escapeHtml(row.goalsFor ?? "—")}</strong></div>
          <div class="standing-stat"><span>ГП</span><strong>${escapeHtml(row.goalsAgainst ?? "—")}</strong></div>
          <div class="standing-stat"><span>±</span><strong>${escapeHtml(row.goalDifference ?? "—")}</strong></div>
          <div class="standing-stat"><span>О</span><strong>${escapeHtml(row.points ?? "—")}</strong></div>
        </div>
        ${row.form ? `<div class="list-secondary">Форма: ${escapeHtml(row.form)}</div>` : ""}
      </article>
    `;
  }

  function renderStandings(standings, season) {
    elements.standingsLabel.textContent = season ? `Сезон ${season}` : "Сезон";
    const html =
      renderStandingCard(standings && standings.home) +
      renderStandingCard(standings && standings.away);
    elements.standingsContent.innerHTML =
      html ||
      `<div class="list-card"><div class="empty-state">Таблица недоступна для этого турнира</div></div>`;
  }

  function renderOdds(odds) {
    const rows = (odds || []).slice(0, 24);
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
              ${escapeHtml(row.option || "Нет данных")}
              <div class="list-secondary">${escapeHtml(row.bookmaker)} · ${escapeHtml(row.market)}</div>
            </div>
            <div class="list-value">${escapeHtml(row.odd)}</div>
          </div>
        `,
      )
      .join("");
  }

  function renderRisk(risk, availability) {
    const sources = [
      ["fixture", "Fixture"],
      ["prediction", "Prediction"],
      ["form", "Form"],
      ["h2h", "H2H"],
      ["standings", "Standings"],
      ["odds", "Odds"],
    ];
    const score = risk?.score ?? 100;
    const level = risk?.level || "HIGH DATA RISK";
    const description = `${risk?.availableSources ?? 0} из ${risk?.totalSources ?? 6} источников доступны`;

    elements.riskLevel.textContent = level;
    elements.riskDescription.textContent = description;
    elements.riskScore.textContent = String(score);
    elements.riskFill.style.width = `${score}%`;
    elements.riskSources.innerHTML = sources
      .map(
        ([key, label]) => {
          const stateClass =
            availability[key] === true
              ? "available"
              : availability[key] === "unknown"
                ? "unknown"
                : "";
          const stateLabel =
            availability[key] === "unknown" ? " · unknown" : "";
          return `<div class="source-item ${stateClass}">${label}${stateLabel}</div>`;
        },
      )
      .join("");
  }

  function riskFromCurrentSources() {
    const values = Object.values(sourceState);
    const known = values.filter((value) => value === true || value === false);
    const available = known.filter(Boolean).length;
    const score =
      known.length === 0
        ? 0
        : Math.round(((known.length - available) / known.length) * 100);
    return {
      score,
      level:
        score <= 33
          ? "LOW DATA RISK"
          : score <= 66
            ? "MEDIUM DATA RISK"
            : "HIGH DATA RISK",
      availableSources: available,
      totalSources: 6,
      knownSources: known.length,
    };
  }

  function refreshRisk() {
    const risk = riskFromCurrentSources();
    renderRisk(risk, sourceState);
    elements.riskDescription.textContent =
      `${risk.availableSources} из ${risk.knownSources} проверенных источников доступны`;
  }

  function renderSectionLoading(view) {
    const loading = `<div class="empty-state">Загрузка данных</div>`;
    if (view === "form") elements.formContent.innerHTML = loading;
    if (view === "h2h") elements.h2hContent.innerHTML = loading;
    if (view === "standings") elements.standingsContent.innerHTML = loading;
    if (view === "odds") elements.oddsContent.innerHTML = loading;
  }

  function renderSectionUnavailable(view) {
    if (view === "form") renderForm(currentMatch, { home: [], away: [] });
    if (view === "h2h") renderH2h([]);
    if (view === "standings") {
      renderStandings({ home: null, away: null }, currentMatch?.league?.season);
    }
    if (view === "odds") renderOdds([]);
  }

  function renderRetry(container, message, retry) {
    container.innerHTML = `
      <div class="request-error">
        <div>${escapeHtml(message)}</div>
        <button class="retry-button" type="button">Повторить</button>
      </div>
    `;
    container
      .querySelector(".retry-button")
      .addEventListener("click", retry, { once: true });
  }

  function renderSectionError(view) {
    const containers = {
      form: elements.formContent,
      h2h: elements.h2hContent,
      standings: elements.standingsContent,
      odds: elements.oddsContent,
    };
    const messages = {
      form: "Не удалось загрузить форму команд",
      h2h: "Не удалось загрузить очные встречи",
      standings: "Не удалось загрузить турнирную таблицу",
      odds: "Не удалось загрузить коэффициенты",
    };
    renderRetry(containers[view], messages[view], () => loadSection(view, true));
  }

  async function loadSection(view, retryFailed = false) {
    const endpoints = {
      form: "form",
      h2h: "h2h",
      standings: "standings",
      odds: "odds",
    };
    const endpoint = endpoints[view];
    if (
      !endpoint ||
      loadedSections.has(view) ||
      (failedSections.has(view) && !retryFailed)
    ) {
      return;
    }
    if (loadingSections.has(view)) return loadingSections.get(view);
    if (retryFailed) failedSections.delete(view);

    renderSectionLoading(view);
    const loadingPromise = (async () => {
      let succeeded = false;
      try {
        const response = await fetch(
          `/api/match/${encodeURIComponent(fixtureId)}/${endpoint}`,
        );
        const payload = await response.json();
        if (!response.ok) throw new Error("Section request failed");

        sourceState[view] = payload.source === true;
        if (view === "form") {
          currentForm = payload.form || { home: [], away: [] };
          renderForm(currentMatch, currentForm);
          renderMetrics(currentMatch?.prediction, currentForm);
        }
        if (view === "h2h") renderH2h(payload.h2h || []);
        if (view === "standings") {
          renderStandings(
            payload.standings || { home: null, away: null },
            payload.season || currentMatch?.league?.season,
          );
        }
        if (view === "odds") renderOdds(payload.odds || []);
        failedSections.delete(view);
        succeeded = true;
      } catch {
        sourceState[view] = false;
        failedSections.add(view);
        renderSectionError(view);
      } finally {
        if (succeeded) loadedSections.add(view);
        loadingSections.delete(view);
        refreshRisk();
      }
    })();

    loadingSections.set(view, loadingPromise);
    return loadingPromise;
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
    return (
      !upcomingStatuses.has(match.status?.short) &&
      match.goals?.home !== null &&
      match.goals?.home !== undefined &&
      match.goals?.away !== null &&
      match.goals?.away !== undefined
    );
  }

  function leagueLogo(league) {
    if (!league?.logo) {
      return `<span class="league-group-logo-placeholder" aria-hidden="true">◇</span>`;
    }
    return `<img class="league-group-logo" src="${escapeHtml(league.logo)}" alt="" loading="lazy" />`;
  }

  function matchStatusLabel(match) {
    const status = match.status || {};
    if (liveStatuses.has(status.short)) {
      return status.elapsed !== null && status.elapsed !== undefined
        ? `${status.elapsed}'`
        : "LIVE";
    }
    if (finishedStatuses.has(status.short)) return "Завершён";
    if (upcomingStatuses.has(status.short)) return formatMatchTime(match.date);
    return status.long || status.short || "Нет данных";
  }

  function matchesForCurrentView() {
    const query = searchQuery.trim().toLocaleLowerCase("ru-RU");
    return allMatches.filter((match) => {
      const status = match.status?.short;
      const matchesFilter =
        selectedFilter === "all" ||
        (selectedFilter === "live" && liveStatuses.has(status)) ||
        (selectedFilter === "upcoming" && upcomingStatuses.has(status)) ||
        (selectedFilter === "finished" && finishedStatuses.has(status));
      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        match.home?.name,
        match.away?.name,
        match.league?.name,
        match.league?.country,
      ].some((value) =>
        String(value || "")
          .toLocaleLowerCase("ru-RU")
          .includes(query),
      );
    });
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
            const isLive = liveStatuses.has(status.short);
            const score = showMatchScore(match)
              ? `<div class="fixture-card-score">${escapeHtml(
                  match.goals.home,
                )} : ${escapeHtml(match.goals.away)}</div>`
              : "";

            return `
              <button class="fixture-card${isLive ? " live" : ""}" type="button" data-fixture-id="${escapeHtml(match.fixtureId)}">
                <div class="fixture-card-top">
                  <span>${escapeHtml(
                    finishedStatuses.has(status.short)
                      ? formatMatchTime(match.date)
                      : status.short || "—",
                  )}</span>
                  <span class="fixture-card-status">${escapeHtml(matchStatusLabel(match))}</span>
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
              ${leagueLogo(league)}
              <div class="league-group-copy">
                ${escapeHtml(league.name || "Нет данных")}
                <div class="league-group-country">${escapeHtml(
                  league.country || "Нет данных",
                )}</div>
              </div>
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
          saveMatchCenterState();
          window.location.href = `/?fixture=${encodeURIComponent(selectedFixture)}`;
        }
      });
    }
  }

  function renderCurrentMatches() {
    const matches = matchesForCurrentView();
    elements.matchesList.replaceChildren();
    if (allMatches.length === 0) {
      elements.matchesState.textContent = "На эту дату матчей нет";
      elements.matchesState.hidden = false;
      return;
    }
    if (matches.length === 0) {
      elements.matchesState.textContent = "Матчей не найдено";
      elements.matchesState.hidden = false;
      return;
    }
    elements.matchesState.hidden = true;
    renderMatches(matches);
  }

  function updateMatchCenterControls() {
    const today = dateForOffset(0);
    const labels = {
      [dateForOffset(-1)]: "Вчера",
      [today]: "Сегодня",
      [dateForOffset(1)]: "Завтра",
    };
    elements.matchesHeading.textContent = labels[selectedDate] || "Match Center";
    elements.matchesDate.textContent = formatMatchDay(selectedDate);
    elements.matchSearch.value = searchQuery;

    for (const button of document.querySelectorAll("[data-day-offset]")) {
      button.classList.toggle(
        "active",
        dateForOffset(Number(button.dataset.dayOffset)) === selectedDate,
      );
    }
    for (const button of elements.matchFilters.querySelectorAll(
      "[data-match-filter]",
    )) {
      button.classList.toggle(
        "active",
        button.dataset.matchFilter === selectedFilter,
      );
    }
  }

  async function loadMatches(date, minimumLoadingTime = 0) {
    selectedDate = isDateString(date) ? date : dateForOffset(0);
    saveMatchCenterState();
    updateMatchCenterControls();
    const requestSequence = ++matchesLoadSequence;
    allMatches = [];
    elements.matchesList.replaceChildren();
    elements.matchesState.textContent = "Загрузка матчей";
    elements.matchesState.hidden = false;
    setDataStatus("loading");
    const loadingStartedAt = performance.now();

    try {
      const response = await fetch(
        `/api/matches?date=${encodeURIComponent(selectedDate)}`,
      );
      const payload = await response.json();
      if (requestSequence !== matchesLoadSequence) return;

      if (!response.ok) throw new Error("Не удалось загрузить матчи");
      const remainingLoadingTime =
        minimumLoadingTime - (performance.now() - loadingStartedAt);
      if (remainingLoadingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingLoadingTime));
      }
      if (requestSequence !== matchesLoadSequence) return;

      allMatches = Array.isArray(payload.matches) ? payload.matches : [];
      renderCurrentMatches();
      setDataStatus("live");
    } catch {
      if (requestSequence !== matchesLoadSequence) return;
      allMatches = [];
      elements.matchesList.replaceChildren();
      elements.matchesState.hidden = false;
      renderRetry(elements.matchesState, "Не удалось загрузить матчи", () =>
        loadMatches(selectedDate),
      );
      setDataStatus("error");
    }
  }

  function setupMatchCenter() {
    for (const button of document.querySelectorAll("[data-day-offset]")) {
      button.addEventListener("click", function () {
        loadMatches(dateForOffset(Number(button.dataset.dayOffset)), 650);
      });
    }
    for (const button of elements.matchFilters.querySelectorAll(
      "[data-match-filter]",
    )) {
      button.addEventListener("click", function () {
        selectedFilter = button.dataset.matchFilter;
        saveMatchCenterState();
        updateMatchCenterControls();
        renderCurrentMatches();
      });
    }
    elements.matchSearch.addEventListener("input", function () {
      searchQuery = elements.matchSearch.value;
      saveMatchCenterState();
      renderCurrentMatches();
    });
  }

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const views = Array.from(document.querySelectorAll(".content-view"));

    for (const tab of tabs) {
      tab.addEventListener("click", function () {
        for (const item of tabs) {
          const active = item === tab;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        }
        for (const view of views) {
          view.classList.toggle("active", view.id === `view-${tab.dataset.view}`);
        }
        loadSection(tab.dataset.view);
      });
    }
  }

  async function loadMatch() {
    setDataStatus("loading");
    elements.analysisState.textContent = "Загрузка аналитики";
    elements.analysisState.hidden = false;
    elements.analysisContent.hidden = true;

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

      if (!payload.fixture) {
        throw new Error("Не удалось загрузить аналитику");
      }

      currentMatch = payload;
      currentForm = null;
      sourceState = {
        fixture: true,
        prediction: Boolean(payload.prediction),
        form: "unknown",
        h2h: "unknown",
        standings: "unknown",
        odds: "unknown",
      };
      renderFixture(payload);
      renderPrediction(payload.prediction, null);
      refreshRisk();
      elements.analysisContent.hidden = false;
      elements.analysisState.hidden = true;
      setDataStatus("live");
    } catch {
      elements.analysisState.hidden = false;
      elements.analysisContent.hidden = true;
      renderRetry(
        elements.analysisState,
        "Не удалось загрузить аналитику",
        loadMatch,
      );
      setDataStatus("error");
    }
  }

  setupTabs();
  restoreMatchCenterState();
  setupMatchCenter();

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
    updateMatchCenterControls();
    loadMatches(selectedDate);
  }
})();