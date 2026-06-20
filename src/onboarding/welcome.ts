import { SIGNATURE_PREFIX } from "../shared/constants";
import { hasDisplayName } from "../shared/settings";

const form = document.getElementById("form") as HTMLFormElement;
const input = document.getElementById("displayName") as HTMLInputElement;
const previewEl = document.getElementById("preview") as HTMLElement;
const continueBtn = document.getElementById("continue") as HTMLButtonElement;

function updatePreview(name: string): void {
  continueBtn.disabled = !hasDisplayName(name);

  if (!hasDisplayName(name)) {
    previewEl.textContent = "Enter your name to see a preview.";
    previewEl.classList.add("preview-empty");
    return;
  }

  previewEl.classList.remove("preview-empty");
  previewEl.textContent = `${SIGNATURE_PREFIX}${name.trim()}`;
}

input.addEventListener("input", () => {
  updatePreview(input.value);
});

window.addEventListener("pagehide", () => {
  const name = input.value.trim();
  if (name) {
    chrome.storage.sync.set({ displayName: name });
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const displayName = input.value.trim();
  if (!displayName) return;

  continueBtn.disabled = true;
  chrome.storage.sync.set({ displayName }, () => {
    window.close();
  });
});

updatePreview("");
