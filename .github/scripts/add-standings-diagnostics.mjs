import fs from 'node:fs';
const path = 'server.js';
let s = fs.readFileSync(path, 'utf8');
const needle = 'app.get("/api/match/:fixture/standings", async (request, response) => {';
if (!s.includes('app.get("/api/debug/standings/:fixture"')) {
  const diagnostic = `app.get("/api/debug/standings/:fixture", async (request, response) => {
  const fixtureId = String(request.params.fixture || "").trim();
  const diagnostic = { fixtureId, sportmonksConfigured: Boolean(sportmonksToken), seasonId: null, home: null, away: null, upstream: { ok: false, status: null, rowCount: null, includeMode: null, error: null } };
  if (!sportmonksToken) return response.status(503).json({ ...diagnostic, upstream: { ...diagnostic.upstream, error: "SPORTMONKS_NOT_CONFIGURED" } });
  try {
    const centre = await getSportmonksMatchCentre(fixtureId);
    diagnostic.seasonId = centre?.league?.season ?? null;
    diagnostic.home = centre?.home ? { id: centre.home.id ?? null, name: centre.home.name ?? null } : null;
    diagnostic.away = centre?.away ? { id: centre.away.id ?? null, name: centre.away.name ?? null } : null;
    if (!diagnostic.seasonId) return response.status(404).json({ ...diagnostic, upstream: { ...diagnostic.upstream, error: "SEASON_ID_MISSING" } });
    const table = await sportmonksProvider.standingsBySeason(diagnostic.seasonId);
    const rows = Array.isArray(table?.standings) ? table.standings : [];
    diagnostic.upstream = { ok: true, status: 200, rowCount: rows.length, includeMode: table?.meta?.includeMode ?? null, error: null };
    diagnostic.matches = { home: rows.some(row => Number(row?.team?.id) === Number(diagnostic.home?.id)), away: rows.some(row => Number(row?.team?.id) === Number(diagnostic.away?.id)) };
    diagnostic.sample = rows.slice(0, 3).map(row => ({ rank: row?.rank ?? null, teamId: row?.team?.id ?? null, teamName: row?.team?.name ?? null, points: row?.points ?? null }));
    return response.json(diagnostic);
  } catch (error) {
    diagnostic.upstream = { ok: false, status: Number(error?.status) || null, rowCount: null, includeMode: null, error: String(error?.message || error || "UNKNOWN_ERROR").slice(0, 300) };
    return response.status(502).json(diagnostic);
  }
});

`;
  if (!s.includes(needle)) throw new Error('standings route marker not found');
  s = s.replace(needle, diagnostic + needle);
  fs.writeFileSync(path, s);
}
