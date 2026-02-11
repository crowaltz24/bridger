const bridgerState = {
  enabled: true,
  autoSimplify: true,
  view: "transformed",
  toastTimer: null,
  highlightLongWords: false,
  splitLongWords: false,
  highlightColor: "gold",
  highlightStyle: "solid",
  highlightThickness: 1,
  lineSpacing: 1.7,
  letterSpacing: 0
};

const HIGHLIGHT_COLOR_MAP = {
  gold: { light: "#c98616", dark: "#f6c65b" },
  sky: { light: "#2563eb", dark: "#7dd3fc" },
  teal: { light: "#0f766e", dark: "#5eead4" },
  rose: { light: "#be123c", dark: "#fda4af" },
  lime: { light: "#4d7c0f", dark: "#bef264" },
  slate: { light: "#475569", dark: "#cbd5f5" }
};

const BRIDGER_COLOR_CLASSES = new Set(["amber", "teal", "rose", "sky", "lime", "slate"]);

function loadState() {
  chrome.storage.local.get(
    {
      enabled: true,
      autoSimplify: true,
      highlightLongWords: false,
      splitLongWords: false,
      highlightColor: "gold",
      highlightStyle: "solid",
      highlightThickness: 1,
      lineSpacing: 1.7,
      letterSpacing: 0
    },
    (data) => {
    bridgerState.enabled = Boolean(data.enabled);
    bridgerState.autoSimplify = Boolean(data.autoSimplify);
    bridgerState.highlightLongWords = Boolean(data.highlightLongWords);
    bridgerState.splitLongWords = Boolean(data.splitLongWords);
    bridgerState.highlightColor = data.highlightColor || "gold";
    bridgerState.highlightStyle = data.highlightStyle || "solid";
    bridgerState.highlightThickness = Number(data.highlightThickness ?? 1);
    updateHighlightColor();
    bridgerState.lineSpacing = Number(data.lineSpacing ?? 1.7);
    bridgerState.letterSpacing = Number(data.letterSpacing ?? 0);
    updateTypographySettings();
  });
}

loadState();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    bridgerState.enabled = Boolean(changes.enabled.newValue);
  }
  if (changes.autoSimplify) {
    bridgerState.autoSimplify = Boolean(changes.autoSimplify.newValue);
  }
  if (changes.highlightLongWords) {
    bridgerState.highlightLongWords = Boolean(changes.highlightLongWords.newValue);
    refreshTransformedViews();
  }
  if (changes.splitLongWords) {
    bridgerState.splitLongWords = Boolean(changes.splitLongWords.newValue);
    refreshTransformedViews();
  }
  if (changes.highlightColor) {
    bridgerState.highlightColor = changes.highlightColor.newValue || "gold";
    updateHighlightColor();
    refreshTransformedViews();
  }
  if (changes.highlightStyle) {
    bridgerState.highlightStyle = changes.highlightStyle.newValue || "solid";
    updateHighlightColor();
    refreshTransformedViews();
  }
  if (changes.highlightThickness) {
    bridgerState.highlightThickness = Number(changes.highlightThickness.newValue ?? 1);
    updateHighlightColor();
    refreshTransformedViews();
  }
  if (changes.lineSpacing) {
    bridgerState.lineSpacing = Number(changes.lineSpacing.newValue ?? 1.7);
    updateTypographySettings();
  }
  if (changes.letterSpacing) {
    bridgerState.letterSpacing = Number(changes.letterSpacing.newValue ?? 0);
    updateTypographySettings();
  }
});

function updateHighlightColor() {
  const prefDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const entry = HIGHLIGHT_COLOR_MAP[bridgerState.highlightColor] || HIGHLIGHT_COLOR_MAP.gold;
  const color = prefDark ? entry.dark : entry.light;
  document.documentElement.style.setProperty("--bridger-highlight-color", color);
  document.documentElement.style.setProperty(
    "--bridger-highlight-style",
    bridgerState.highlightStyle || "solid"
  );
  const thickness = Number.isFinite(bridgerState.highlightThickness)
    ? bridgerState.highlightThickness
    : 1;
  document.documentElement.style.setProperty("--bridger-highlight-width", `${thickness}px`);
}

function updateTypographySettings() {
  const lineSpacing = Number.isFinite(bridgerState.lineSpacing) ? bridgerState.lineSpacing : 1.7;
  const letterSpacing = Number.isFinite(bridgerState.letterSpacing)
    ? bridgerState.letterSpacing
    : 0;
  document.documentElement.style.setProperty("--bridger-line-height", String(lineSpacing));
  document.documentElement.style.setProperty("--bridger-letter-spacing", `${letterSpacing}em`);
}

function isEditableNode(node) {
  if (!node) return false;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element) return false;
  if (element.isContentEditable) return true;
  return element.closest("input, textarea, [contenteditable='true']") !== null;
}

function splitSections(raw) {
  const matches = Array.from(raw.matchAll(/\[SECTION:([^\]]+)\]/g));
  if (matches.length === 0) {
    return [{ title: null, body: raw }];
  }

  const sections = [];

  if (matches[0].index > 0) {
    const preface = raw.slice(0, matches[0].index).trim();
    if (preface) {
      sections.push({ title: null, body: preface });
    }
  }

  matches.forEach((match, index) => {
    const title = match[1].trim();
    const bodyStart = match.index + match[0].length;
    const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : raw.length;
    sections.push({ title, body: raw.slice(bodyStart, bodyEnd) });
  });

  return sections;
}

function extractParagraphs(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function appendPlainText(container, text) {
  if (!text) return;
  const lines = text.split(/\n/);
  lines.forEach((line, index) => {
    if (index > 0) {
      container.appendChild(document.createElement("br"));
    }
    container.appendChild(document.createTextNode(line));
  });
}

function appendInlineWithMarkers(container, text) {
  const regex = /\[(PAUSE|CHECKPOINT)\]|\[KEY:([^\]]+)\]|\[SYLLABLE:([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const leading = text.slice(lastIndex, match.index);
    appendPlainText(container, leading);

    if (match[1]) {
      const label = match[1] === "PAUSE" ? "Pause" : "Checkpoint";
      const badge = document.createElement("span");
      badge.className = match[1] === "PAUSE" ? "bridger-pause bridger-badge" : "bridger-checkpoint bridger-badge";
      badge.textContent = label;
      container.appendChild(badge);
    } else if (match[2]) {
      const key = document.createElement("span");
      key.className = "bridger-key";
      key.textContent = match[2].trim();
      container.appendChild(key);
    } else if (match[3]) {
      const syllable = document.createElement("span");
      syllable.className = "bridger-syllable";
      syllable.textContent = match[3].trim();
      container.appendChild(syllable);
    }

    lastIndex = regex.lastIndex;
  }

  appendPlainText(container, text.slice(lastIndex));
}

function appendDecoratedText(container, text) {
  const regex = /\[COLOR:([a-zA-Z0-9_-]+)\]([\s\S]*?)\[\/COLOR\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const leading = text.slice(lastIndex, match.index);
    appendInlineWithMarkers(container, leading);

    const colorName = match[1].toLowerCase();
    const span = document.createElement("span");
    span.className = "bridger-color";
    if (BRIDGER_COLOR_CLASSES.has(colorName)) {
      span.classList.add(`bridger-color-${colorName}`);
    }
    appendInlineWithMarkers(span, match[2]);
    container.appendChild(span);

    lastIndex = regex.lastIndex;
  }

  appendInlineWithMarkers(container, text.slice(lastIndex));
}

function splitLongWord(word) {
  const vowels = "aeiouy";
  const lower = word.toLowerCase();
  if (!/[aeiouy]/i.test(word)) return [word];

  const parts = [];
  let buffer = word[0];

  for (let i = 1; i < word.length; i += 1) {
    const prev = lower[i - 1];
    const curr = lower[i];
    buffer += word[i];

    const prevIsVowel = vowels.includes(prev);
    const currIsVowel = vowels.includes(curr);

    if (prevIsVowel && !currIsVowel && buffer.length >= 3 && i < word.length - 2) {
      parts.push(buffer);
      buffer = "";
    }
  }

  if (buffer) {
    parts.push(buffer);
  }

  return parts.length ? parts : [word];
}

function shouldProcessTextNode(node) {
  if (!node.parentElement) return false;
  return !node.parentElement.closest(
    ".bridger-badge,.bridger-toast,.bridger-section-title,.bridger-key,.bridger-syllable"
  );
}

function applyLongWordAssist(root) {
  if (!bridgerState.highlightLongWords && !bridgerState.splitLongWords) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let current = walker.nextNode();

  while (current) {
    if (shouldProcessTextNode(current)) {
      nodes.push(current);
    }
    current = walker.nextNode();
  }

  nodes.forEach((node) => {
    const text = node.nodeValue;
    if (!text) return;

    const regex = /([A-Za-z]{8,})/g;
    let match;
    let lastIndex = 0;
    let replaced = false;
    const fragment = document.createDocumentFragment();

    while ((match = regex.exec(text)) !== null) {
      const leading = text.slice(lastIndex, match.index);
      if (leading) {
        fragment.appendChild(document.createTextNode(leading));
      }

      const word = match[1];
      const span = document.createElement("span");
      span.className = bridgerState.highlightLongWords ? "bridger-longword bridger-longword-highlight" : "bridger-longword";

      if (bridgerState.splitLongWords) {
        const parts = splitLongWord(word);
        parts.forEach((part, index) => {
          if (index > 0) {
            const sep = document.createElement("span");
            sep.className = "bridger-syllable-sep";
            sep.textContent = "|";
            span.appendChild(sep);
          }
          span.appendChild(document.createTextNode(part));
        });
      } else {
        span.textContent = word;
      }

      fragment.appendChild(span);
      lastIndex = regex.lastIndex;
      replaced = true;
    }

    const trailing = text.slice(lastIndex);
    if (trailing) {
      fragment.appendChild(document.createTextNode(trailing));
    }

    if (replaced && node.parentNode) {
      node.parentNode.replaceChild(fragment, node);
    }
  });
}

function showToast(message, isError = false) {
  let toast = document.querySelector(".bridger-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "bridger-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.toggle("bridger-toast-error", isError);
  toast.classList.add("bridger-toast-show");

  if (bridgerState.toastTimer) {
    clearTimeout(bridgerState.toastTimer);
  }

  bridgerState.toastTimer = setTimeout(() => {
    toast.classList.remove("bridger-toast-show");
  }, 1800);
}

function buildTransformedFragment(rawText) {
  const fragment = document.createDocumentFragment();
  const sections = splitSections(rawText);

  sections.forEach((section, sectionIndex) => {
    const sectionEl = document.createElement("div");
    sectionEl.className = "bridger-section";

    if (section.title) {
      const heading = document.createElement("div");
      heading.className = "bridger-section-title";
      heading.textContent = section.title;
      sectionEl.appendChild(heading);
    }

    const paragraphs = extractParagraphs(section.body);
    paragraphs.forEach((paragraph, chunkIndex) => {
      const container = document.createElement("div");
      container.className = "bridger-chunk";
      appendDecoratedText(container, paragraph);
      sectionEl.appendChild(container);

      if (chunkIndex < paragraphs.length - 1) {
        const spacer = document.createElement("div");
        spacer.className = "bridger-spacer";
        sectionEl.appendChild(spacer);
      }
    });

    applyLongWordAssist(sectionEl);
    fragment.appendChild(sectionEl);

    if (sectionIndex < sections.length - 1) {
      const sectionSpacer = document.createElement("div");
      sectionSpacer.className = "bridger-section-spacer";
      fragment.appendChild(sectionSpacer);
    }
  });

  return fragment;
}

function refreshTransformedViews() {
  const wrappers = document.querySelectorAll(".bridger-wrap");
  wrappers.forEach((wrapper) => {
    const transformedSpan = wrapper.querySelector(".bridger-transformed");
    const raw = wrapper.dataset.bridgerTransformed;
    if (!transformedSpan || !raw) return;
    transformedSpan.textContent = "";
    transformedSpan.appendChild(buildTransformedFragment(raw));
  });
  applyViewState();
}

async function transformSelection() {
  if (!bridgerState.enabled) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const selectedText = selection.toString().trim();
  if (!selectedText) return;

  const range = selection.getRangeAt(0);
  if (isEditableNode(range.commonAncestorContainer)) return;

  const wrapper = document.createElement("span");
  wrapper.className = "bridger-wrap";
  wrapper.dataset.bridger = "1";

  const originalSpan = document.createElement("span");
  originalSpan.className = "bridger-original";
  originalSpan.textContent = selectedText;

  const transformedSpan = document.createElement("span");
  transformedSpan.className = "bridger-transformed";
  transformedSpan.textContent = "";

  wrapper.appendChild(originalSpan);
  wrapper.appendChild(transformedSpan);

  range.deleteContents();
  range.insertNode(wrapper);
  selection.removeAllRanges();

  try {
    showToast("Processing...", false);
    const response = await chrome.runtime.sendMessage({
      type: "ollama_transform",
      text: selectedText
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Ollama unavailable");
    }
    if (!response.text) {
      throw new Error("Empty response from Ollama");
    }

    transformedSpan.textContent = "";
    wrapper.dataset.bridgerTransformed = response.text;
    transformedSpan.appendChild(buildTransformedFragment(response.text));
  } catch (error) {
    console.error("Bridger transform failed", error);
    transformedSpan.textContent = "";
    transformedSpan.appendChild(document.createTextNode(selectedText));
    wrapper.classList.add("bridger-error");
    const message = String(error?.message || "");
    const isCors = message.includes("403") || message.toLowerCase().includes("cors") || message.toLowerCase().includes("cross-origin");
    if (isCors) {
      showToast("Ollama blocked by CORS", true);
    }
  }

  applyViewState();
}

function applyViewState() {
  const wrappers = document.querySelectorAll(".bridger-wrap");
  wrappers.forEach((wrapper) => {
    const showTransformed = bridgerState.view === "transformed";
    wrapper.classList.toggle("bridger-show-transformed", showTransformed);
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "toggle_view") {
    bridgerState.view = bridgerState.view === "transformed" ? "original" : "transformed";
    applyViewState();
  }
  if (message?.type === "simplify_selection") {
    transformSelection();
  }
});

document.addEventListener("mouseup", () => {
  if (!bridgerState.autoSimplify) return;
  setTimeout(transformSelection, 0);
});
