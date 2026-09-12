import assert from "node:assert/strict";
import test from "node:test";

import { createGeminiAnalysisProvider } from "../lib/gemini-analysis-provider.js";

test("Gemini analysis uses structured JSON and normalizes unsafe values", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  let requestHeaders;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    requestHeaders = options.headers;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        headline: "Balanced match",
        summary: "The available evidence is mixed.",
        lean: "UNKNOWN",
        confidence: 140,
        dataQuality: "MEDIUM",
        keyFactors: ["Home form", "Away position"],
        risks: ["Lineups unavailable"],
        marketSignals: [{ market: "1X2", observation: "Prices are close" }],
      }) }] } }],
      modelVersion: "gemini-test",
      usageMetadata: { promptTokenCount: 10 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const provider = createGeminiAnalysisProvider({ apiKey: "secret", baseUrl: "https://gemini.test/v1beta" });
    const result = await provider.analyze({ home: { name: "Almaz" } }, { language: "en" });
    assert.equal(requestHeaders["x-goog-api-key"], "secret");
    assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
    assert.match(requestBody.systemInstruction.parts[0].text, /English/);
    assert.equal(result.analysis.lean, "NO_EDGE");
    assert.equal(result.analysis.confidence, 100);
    assert.equal(result.meta.provider, "gemini");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini analysis refuses to run without a server key", async () => {
  const provider = createGeminiAnalysisProvider({ apiKey: "" });
  await assert.rejects(() => provider.analyze({}), { code: "GEMINI_KEY_MISSING" });
});

