import fs from "node:fs";

const path = "lib/sportmonks-provider.js";
let source = fs.readFileSync(path, "utf8");

const start = source.indexOf("  async function standingsBySeason(seasonId) {");
const end = source.indexOf("\n  async function fixtureById", start);
if (start < 0 || end < 0) throw new Error("standingsBySeason block not found");

const replacement = `  async function standingsBySeason(seasonId) {
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
`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
