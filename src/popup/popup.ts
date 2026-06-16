import { DEFAULT_SETTINGS, SIGNATURE_PREFIX } from "../shared/constants";

const input = document.getElementById("displayName") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLElement;
const previewEl = document.getElementById("preview") as HTMLElement;

let saveTimer: number | null = null;

function updatePreview(name: string): void {
  const display = name.trim() || "Your Name";
  previewEl.textContent = `${SIGNATURE_PREFIX}${display}`;
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
      statusEl.textContent = "Saved";
      window.setTimeout(() => {
        statusEl.textContent = "";
      }, 1500);
    });
  }, 300);
});
