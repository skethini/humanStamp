import {
  HUMANSTAMP_METADATA_ATTR,
  SIGNATURE_PREFIX,
} from "../shared/constants";

const HIDDEN_STYLE =
  "display:none!important;font-size:0!important;line-height:0!important;";

export function buildSignature(displayName: string): string {
  const name = displayName.trim() || "Author";
  return `\n\n${SIGNATURE_PREFIX}${name}`;
}

export function stripSignature(text: string): string {
  const idx = text.lastIndexOf(SIGNATURE_PREFIX);
  if (idx === -1) return text;
  return text.slice(0, idx).replace(/\s+$/, "");
}

export function hasSignature(text: string): boolean {
  return text.includes(SIGNATURE_PREFIX);
}

export function getBodyText(fullText: string): string {
  return stripSignature(fullText);
}

export function editorHasSignature(editor: HTMLElement): boolean {
  if (editor.querySelector(`[${HUMANSTAMP_METADATA_ATTR}]`)) return true;
  return hasSignature(editor.innerText.replace(/\u00a0/g, " "));
}

export function appendSignedSignature(
  editor: HTMLElement,
  displayName: string,
  stampJson: string
): void {
  const doc = editor.ownerDocument;
  const name = displayName.trim() || "Author";

  const spacer = doc.createElement("div");
  spacer.appendChild(doc.createElement("br"));
  spacer.appendChild(doc.createElement("br"));

  const visible = doc.createElement("span");
  visible.className = "humanstamp-signature";
  visible.textContent = `${SIGNATURE_PREFIX}${name}`;

  const metadata = doc.createElement("span");
  metadata.setAttribute(HUMANSTAMP_METADATA_ATTR, "v2");
  metadata.setAttribute("data-humanstamp-payload", stampJson);
  metadata.setAttribute("aria-hidden", "true");
  metadata.style.cssText = HIDDEN_STYLE;

  editor.appendChild(spacer);
  editor.appendChild(visible);
  editor.appendChild(metadata);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function removeSignatureFromEditor(editor: HTMLElement): void {
  editor
    .querySelectorAll(`[${HUMANSTAMP_METADATA_ATTR}]`)
    .forEach((node) => node.remove());
  editor.querySelectorAll(".humanstamp-signature").forEach((node) => {
    node.remove();
  });

  const text = editor.innerText.replace(/\u00a0/g, " ");
  const idx = text.lastIndexOf(SIGNATURE_PREFIX);
  if (idx !== -1) {
    editor.innerText = text.slice(0, idx).replace(/\s+$/, "");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export function getBodyTextFromEditor(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(`[${HUMANSTAMP_METADATA_ATTR}], .humanstamp-signature`)
    .forEach((node) => node.remove());
  const text = clone.innerText.replace(/\u00a0/g, " ");
  const idx = text.lastIndexOf(SIGNATURE_PREFIX);
  if (idx === -1) return text.trimEnd();
  return text.slice(0, idx).replace(/\s+$/, "");
}
