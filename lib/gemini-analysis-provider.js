const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

const responseSchema = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    summary: { type: "STRING" },
    lean: { type: "STRING", enum: ["HOME", "DRAW", "AWAY", "NO_EDGE"] },
    confidence: { type: "INTEGER", minimum: 0, maximum: 100 },
    dataQuality: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
    keyFactors: { type: "ARRAY", items: { type: "STRING" }, maxItems: 5 },
    risks: { type: "ARRAY", items: { type: "STRING" }, maxItems: 4 },
    marketSignals: {
      type: "ARRAY",
      maxItems: 4,
      items: {
        type: "OBJECT",
        properties: {
          market: { type: "STRING" },
          observation: { type: "STRING" },
        },
        required: ["market", "observation"],
      },
    },
  },
  required: ["headline", "summary", "lean", "confidence", "dataQuality", "keyFactors", "risks", "marketSignals"],
};

function boundedText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeAnalysis(value) {
  const lean = ["HOME", "DRAW", "AWAY", "NO_EDGE"].includes(value?.lean)
    ? value.lean
    : "NO_EDGE";
  const dataQuality = ["LOW", "MEDIUM", "HIGH"].includes(value?.dataQuality)
    ? value.dataQuality
    : "LOW";
  return {
    headline: boundedText(value?.headline, 120),
    summary: boundedText(value?.summary, 900),
    lean,
    confidence: Math.max(0, Math.min(100, Math.round(Number(value?.confidence) || 0))),
    dataQuality,
    keyFactors: (Array.isArray(value?.keyFactors) ? value.keyFactors : []).slice(0, 5).map((item) => boundedText(item, 220)).filter(Boolean),
    risks: (Array.isArray(value?.risks) ? value.risks : []).slice(0, 4).map((item) => boundedText(item, 220)).filter(Boolean),
    marketSignals: (Array.isArray(value?.marketSignals) ? value.marketSignals : []).slice(0, 4).map((item) => ({
      market: boundedText(item?.market, 80),
      observation: boundedText(item?.observation, 220),
    })).filter((item) => item.market && item.observation),
  };
}

export function createGeminiAnalysisProvider({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = 30_000,
} = {}) {
  async function analyze(facts, { language = "ru" } = {}) {
    if (!apiKey) {
      const error = new Error("GEMINI_API_KEY is missing.");
      error.code = "GEMINI_KEY_MISSING";
      throw error;
    }

    const outputLanguage = language === "en" ? "English" : "Russian";
    const systemInstruction = [
      "You are the football analysis engine for AlmazStat.",
      "Use only the supplied Sportmonks facts. Never invent injuries, lineups, statistics, news or odds.",
      "If evidence is incomplete, lower confidence and state the missing evidence in risks.",
      "Describe market data as observations, not guaranteed outcomes or financial advice.",
      `Return all human-readable text in ${outputLanguage}.`,
    ].join(" ");

    const upstream = await fetch(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify({ task: "Analyze this football match", facts }) }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      },
    );

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const error = new Error(payload?.error?.message || `Gemini returned HTTP ${upstream.status}.`);
      error.code = "GEMINI_UPSTREAM_ERROR";
      error.status = upstream.status;
      throw error;
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();
    if (!text) {
      const error = new Error("Gemini returned an empty response.");
      error.code = "GEMINI_EMPTY_RESPONSE";
      throw error;
    }

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/, ""));
    } catch {
      const error = new Error("Gemini returned invalid JSON.");
      error.code = "GEMINI_INVALID_RESPONSE";
      throw error;
    }

    return {
      analysis: normalizeAnalysis(parsed),
      meta: {
        provider: "gemini",
        model: payload?.modelVersion || model,
        usage: payload?.usageMetadata || null,
      },
    };
  }

  return { name: "gemini", model, analyze };
}

