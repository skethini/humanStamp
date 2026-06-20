import { DEFAULT_SETTINGS, SIGNATURE_PREFIX } from "../shared/constants";
import { getEffectiveDisplayName, hasDisplayName } from "../shared/settings";

const input = document.getElementById("displayName") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLElement;
const previewEl = document.getElementById("preview") as HTMLElement;

let saveTimer: number | null = null;

function updatePreview(name: string): void {
  previewEl.classList.remove("preview-empty");
  previewEl.textContent = `${SIGNATURE_PREFIX}${getEffectiveDisplayName(name)}`;
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
      statusEl.textContent = hasDisplayName(displayName) ? "Saved" : "Saved (using default)";
      window.setTimeout(() => {
        statusEl.textContent = "";
      }, 1500);
    });
  }, 300);
});
