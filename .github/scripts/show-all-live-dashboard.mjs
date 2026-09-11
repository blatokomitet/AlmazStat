import fs from "node:fs";

const path = "app.js";
let source = fs.readFileSync(path, "utf8");

const oldBlock = `      const block = (items, empty) => items.length ? \`<div class="dashboard-fixtures">\${items.slice(0, 6).map((item) => dashboardFixtureButton(item)).join("")} </div>\` : \`<div class="dashboard-empty"><strong>\${empty}</strong></div>\`;
      renderDashboardBlock("live", block(live, "Сейчас матчей нет"));`;

const exactCurrent = `      const block = (items, empty) => items.length ? \`<div class="dashboard-fixtures">\${items.slice(0, 6).map((item) => dashboardFixtureButton(item)).join("")}</div>\` : \`<div class="dashboard-empty"><strong>\${empty}</strong></div>\`;
      renderDashboardBlock("live", block(live, "Сейчас матчей нет"));`;

const replacement = `      const block = (items, empty, limit = 6) => items.length ? \`<div class="dashboard-fixtures">\${(limit === null ? items : items.slice(0, limit)).map((item) => dashboardFixtureButton(item)).join("")}</div>\` : \`<div class="dashboard-empty"><strong>\${empty}</strong></div>\`;
      renderDashboardBlock("live", block(live, "Сейчас матчей нет", null));`;

if (source.includes(replacement)) process.exit(0);
if (!source.includes(exactCurrent)) throw new Error("dashboard block marker not found");
source = source.replace(exactCurrent, replacement);
fs.writeFileSync(path, source);
