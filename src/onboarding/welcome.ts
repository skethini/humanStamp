import { SIGNATURE_LABEL } from "../shared/constants";
import { SET_DISPLAY_NAME_MESSAGE } from "../shared/messages";
import { formatSignatureLine, hasDisplayName } from "../shared/settings";

const form = document.getElementById("form") as HTMLFormElement;
const input = document.getElementById("displayName") as HTMLInputElement;
const previewEl = document.getElementById("preview") as HTMLElement;
const continueBtn = document.getElementById("continue") as HTMLButtonElement;
const skipBtn = document.getElementById("skip") as HTMLButtonElement;

function updatePreview(name: string): void {
  if (!hasDisplayName(name)) {
    previewEl.textContent = SIGNATURE_LABEL;
    previewEl.classList.add("preview-empty");
    return;
  }

  previewEl.classList.remove("preview-empty");
  previewEl.textContent = formatSignatureLine(name);
}

function closeWelcome(): void {
  window.close();
}

function saveDisplayName(displayName: string): Promise<void> {
  return chrome.runtime
    .sendMessage({ type: SET_DISPLAY_NAME_MESSAGE, displayName })
    .then(() => undefined);
}

input.addEventListener("input", () => {
  updatePreview(input.value);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  continueBtn.disabled = true;
  skipBtn.disabled = true;

  const displayName = input.value.trim();
  const savePromise = hasDisplayName(displayName)
    ? saveDisplayName(displayName)
    : Promise.resolve();

  void savePromise
    .then(() => closeWelcome())
    .catch(() => {
      continueBtn.disabled = false;
      skipBtn.disabled = false;
    });
});

skipBtn.addEventListener("click", () => {
  closeWelcome();
});

updatePreview("");
