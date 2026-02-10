function setStatus(text) {
  const status = document.getElementById("status");
  status.textContent = text;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

document.addEventListener("DOMContentLoaded", async () => {
  const enabled = document.getElementById("enabled");
  const model = document.getElementById("model");
  const highlightLongWords = document.getElementById("highlightLongWords");
  const highlightColor = document.getElementById("highlightColor");
  const highlightStyle = document.getElementById("highlightStyle");
  const highlightThickness = document.getElementById("highlightThickness");
  const highlightThicknessValue = document.getElementById("highlightThicknessValue");
  const lineSpacing = document.getElementById("lineSpacing");
  const lineSpacingValue = document.getElementById("lineSpacingValue");
  const letterSpacing = document.getElementById("letterSpacing");
  const letterSpacingValue = document.getElementById("letterSpacingValue");
  const splitLongWords = document.getElementById("splitLongWords");
  const toggleView = document.getElementById("toggleView");
  const save = document.getElementById("save");

  const stored = await chrome.storage.local.get({
    enabled: true,
    model: "gemma3:1b",
    highlightLongWords: false,
    splitLongWords: false,
    highlightColor: "gold",
    highlightStyle: "solid",
    highlightThickness: 1,
    lineSpacing: 1.7,
    letterSpacing: 0
  });
  enabled.checked = Boolean(stored.enabled);
  model.value = stored.model || "gemma3:1b";
  highlightLongWords.checked = Boolean(stored.highlightLongWords);
  splitLongWords.checked = Boolean(stored.splitLongWords);
  highlightColor.value = stored.highlightColor || "gold";
  highlightStyle.value = stored.highlightStyle || "solid";
  highlightThickness.value = String(stored.highlightThickness ?? 1);
  highlightThicknessValue.textContent = `${Number.parseFloat(highlightThickness.value).toFixed(2)}px`;
  lineSpacing.value = String(stored.lineSpacing ?? 1.7);
  lineSpacingValue.textContent = Number.parseFloat(lineSpacing.value).toFixed(2);
  letterSpacing.value = String(stored.letterSpacing ?? 0);
  letterSpacingValue.textContent = `${Number.parseFloat(letterSpacing.value).toFixed(3)}em`;

  enabled.addEventListener("change", async () => {
    await chrome.storage.local.set({ enabled: enabled.checked });
    setStatus("Updated");
  });

  highlightLongWords.addEventListener("change", async () => {
    await chrome.storage.local.set({ highlightLongWords: highlightLongWords.checked });
    setStatus("Updated");
  });

  highlightColor.addEventListener("change", async () => {
    await chrome.storage.local.set({ highlightColor: highlightColor.value });
    setStatus("Updated");
  });

  highlightStyle.addEventListener("change", async () => {
    await chrome.storage.local.set({ highlightStyle: highlightStyle.value });
    setStatus("Updated");
  });

  highlightThickness.addEventListener("input", async () => {
    const value = Number.parseFloat(highlightThickness.value);
    highlightThicknessValue.textContent = `${Number.parseFloat(highlightThickness.value).toFixed(2)}px`;
    await chrome.storage.local.set({ highlightThickness: Number.isNaN(value) ? 1 : value });
    setStatus("Updated");
  });

  lineSpacing.addEventListener("input", async () => {
    const value = Number.parseFloat(lineSpacing.value);
    lineSpacingValue.textContent = Number.parseFloat(lineSpacing.value).toFixed(2);
    await chrome.storage.local.set({ lineSpacing: Number.isNaN(value) ? 1.7 : value });
    setStatus("Updated");
  });

  letterSpacing.addEventListener("input", async () => {
    const value = Number.parseFloat(letterSpacing.value);
    letterSpacingValue.textContent = `${Number.parseFloat(letterSpacing.value).toFixed(3)}em`;
    await chrome.storage.local.set({ letterSpacing: Number.isNaN(value) ? 0 : value });
    setStatus("Updated");
  });

  splitLongWords.addEventListener("change", async () => {
    await chrome.storage.local.set({ splitLongWords: splitLongWords.checked });
    setStatus("Updated");
  });

  toggleView.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "toggle_view" });
  });

  save.addEventListener("click", async () => {
    await chrome.storage.local.set({ model: model.value.trim() || "gemma3:1b" });
    setStatus("Saved");
  });
});
