const OLLAMA_URL = "http://localhost:11434/api/generate";
const DEFAULT_MODEL = "gemma3:1b";

function buildPrompt(text) {
  return [
    "You are Bridger, a text accessibility assistant for dyslexia and ADHD.",
    "Rewrite the text to be easier to read while preserving meaning and tone.",
    "Be concise. Do not add new ideas or expand the text.",
    "Keep the output length within +/- 15% of the input length.",
    "Keep the number of sentences the same or fewer than the input.",
    "Use short sentences (max 15 words) and one to two ideas per sentence.",
    "Use shorter, dyslexic-friendly words when possible.",
    "Split dense paragraphs into bullet points when helpful.",
    "Remove generic filler or self-evident statements.",
    "Only include points explicitly present in the source text.",
    "Do not dumb content down, assume your reader can process complex ideas.",
    "Do NOT simplify if the text is already easy to read (e.g. below 7th grade level).",
    "Do not affect technical accuracy or remove important details, but rephrase complex sentences for clarity.",
    "Do not repeat information already stated.",
    "Do not infer missing context.",
    "If you cannot simplify without adding information, return the original text unchanged.",
    "Avoid analysis, commentary, or prefaces.",
    "Return only the rewritten text with no special markers.",
    "Text:",
    text
  ].join("\n");
}

function tokenizeForOverlap(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function shouldFallbackToOriginal(inputText, outputText) {
  const inputTokens = tokenizeForOverlap(inputText);
  const outputTokens = tokenizeForOverlap(outputText);

  if (outputTokens.length === 0) return true;

  const inputSet = new Set(inputTokens);
  const overlapCount = outputTokens.filter((token) => inputSet.has(token)).length;
  const overlapRatio = overlapCount / outputTokens.length;

  const lengthRatio = outputText.length / Math.max(1, inputText.length);

  return overlapRatio < 0.4 || lengthRatio > 1.2;
}

async function callOllama(text, model) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(text),
        stream: false,
        options: {
          temperature: 0.2,
          top_p: 0.9,
          repeat_penalty: 1.1
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return data.response || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ollama_transform") {
    return false;
  }

  (async () => {
    try {
      const stored = await chrome.storage.local.get({ model: DEFAULT_MODEL });
      const model = stored.model || DEFAULT_MODEL;
      const text = String(message.text || "");
      const output = await callOllama(text, model);
      const finalText = shouldFallbackToOriginal(text, output) ? text : output;
      sendResponse({ ok: true, text: finalText });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "Ollama unavailable" });
    }
  })();

  return true;
});
