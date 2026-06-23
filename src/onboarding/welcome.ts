import { SIGNATURE_LABEL } from "../shared/constants";
import { SET_DISPLAY_NAME_MESSAGE } from "../shared/messages";
import { formatSignatureLine, hasDisplayName } from "../shared/settings";

const form = document.getElementById("form") as HTMLFormElement;
const input = document.getElementById("displayName") as HTMLInputElement;
const previewEl = document.getElementById("preview") as HTMLElement;
const continueBtn = document.getElementById("continue") as HTMLButtonElement;

function updatePreview(name: string): void {
  continueBtn.disabled = !hasDisplayName(name);

  if (!hasDisplayName(name)) {
    previewEl.textContent = SIGNATURE_LABEL;
    previewEl.classList.add("preview-empty");
    return;
  }

  previewEl.classList.remove("preview-empty");
  previewEl.textContent = formatSignatureLine(name);
}

input.addEventListener("input", () => {
  updatePreview(input.value);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const displayName = input.value.trim();
  if (!displayName) return;

  continueBtn.disabled = true;
  void chrome.runtime
    .sendMessage({ type: SET_DISPLAY_NAME_MESSAGE, displayName })
    .then(() => window.close())
    .catch(() => {
      continueBtn.disabled = false;
    });
});

updatePreview("");
