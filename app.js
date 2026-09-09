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
    appStatus: document.getElementById("app-status"),
    fixtureId: document.getElementById("fixture-id"),
    homeName: document.getElementById("home-name"),
    homeCrest: document.getElementById("home-crest"),
    awayName: document.getElementById("away-name"),
    awayCrest: document.getElementById("away-crest"),
    score: document.getElementById("score"),
    matchDate: document.getElementById("match-date"),
    matchState: document.getElementById("match-state"),
  };

  function setStatus(message, state) {
    elements.appStatus.textContent = message;
    if (state) {
      elements.appStatus.dataset.state = state;
    } else {
      delete elements.appStatus.dataset.state;
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function setCrest(element, imageUrl) {
    if (!imageUrl) return;
    element.classList.add("has-image");
    element.style.backgroundImage = `url("${imageUrl}")`;
  }

  function renderMatch(payload) {
    const match = payload && payload.response && payload.response[0];

    if (!match) {
      throw new Error("API-Football не вернул данные по этому fixture.");
    }

    const home = match.teams && match.teams.home;
    const away = match.teams && match.teams.away;
    const goals = match.goals || {};
    const status = (match.fixture && match.fixture.status) || {};

    elements.homeName.textContent = home && home.name ? home.name : "—";
    elements.awayName.textContent = away && away.name ? away.name : "—";
    elements.score.textContent = `${goals.home ?? "—"} : ${goals.away ?? "—"}`;
    elements.matchDate.textContent = formatDate(match.fixture && match.fixture.date);
    elements.matchState.textContent = status.long || status.short || "Статус неизвестен";

    setCrest(elements.homeCrest, home && home.logo);
    setCrest(elements.awayCrest, away && away.logo);
  }

  async function loadMatch() {
    if (!fixtureId) {
      elements.fixtureId.textContent = "fixture не указан";
      setStatus("Передайте fixture через URL или Telegram start_param", "error");
      return;
    }

    elements.fixtureId.textContent = `fixture ${fixtureId}`;
    elements.matchState.textContent = "Загрузка…";
    setStatus("Загрузка данных матча…");

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

      renderMatch(payload);
      setStatus("Данные матча загружены", "success");
    } catch (error) {
      elements.matchState.textContent = "Ошибка загрузки";
      setStatus(error instanceof Error ? error.message : "Ошибка загрузки матча", "error");
    }
  }

  loadMatch();
})();