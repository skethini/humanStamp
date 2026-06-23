import { DEFAULT_SETTINGS, SIGNATURE_LABEL } from "../shared/constants";
import { formatSignatureLine, hasDisplayName } from "../shared/settings";

const input = document.getElementById("displayName") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLElement;
const previewEl = document.getElementById("preview") as HTMLElement;

let saveTimer: number | null = null;

function updatePreview(name: string): void {
  previewEl.classList.remove("preview-empty");
  previewEl.textContent = formatSignatureLine(name);
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  input.value = settings.displayName;
  updatePreview(settings.displayName);
});

input.addEventListener("input", () => {
  updatePreview(input.value);

  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(() => {
    const displayName = input.value.trim();
    chrome.storage.sync.set({ displayName }, () => {
      statusEl.textContent = hasDisplayName(displayName) ? "Saved" : "Saved (default signature)";
      window.setTimeout(() => {
        statusEl.textContent = "";
      }, 1500);
    });
  }, 300);
});
