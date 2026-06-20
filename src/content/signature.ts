import {
  HUMANSTAMP_COMMENT_PREFIX,
  HUMANSTAMP_METADATA_ATTR,
  HUMANSTAMP_PAYLOAD_ATTR,
  SIGNATURE_PREFIX,
} from "../shared/constants";
import { normalizeBodyForHash } from "../shared/normalize";
import { resolveDisplayName } from "../shared/settings";
import { SignedStamp } from "../shared/stamp";

export function buildSignature(displayName: string): string | null {
  const name = resolveDisplayName(displayName);
  if (!name) return null;
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
  return normalizeBodyForHash(stripSignature(fullText));
}

export function encodeStampForTransport(stampJson: string): string {
  const bytes = new TextEncoder().encode(stampJson);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeStampFromTransport(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function parseSignedStamp(encoded: string): SignedStamp | null {
  try {
    return JSON.parse(encoded) as SignedStamp;
  } catch {
    return null;
  }
}

export function editorHasSignature(editor: HTMLElement): boolean {
  if (editor.querySelector(`[${HUMANSTAMP_PAYLOAD_ATTR}]`)) return true;
  if (editor.querySelector(`[${HUMANSTAMP_METADATA_ATTR}]`)) return true;
  return hasSignature(editor.innerText.replace(/\u00a0/g, " "));
}

export function appendSignedSignature(
  editor: HTMLElement,
  displayName: string,
  stampJson: string
): boolean {
  const name = resolveDisplayName(displayName);
  if (!name) return false;

  const doc = editor.ownerDocument;

  const spacer = doc.createElement("div");
  spacer.appendChild(doc.createElement("br"));
  spacer.appendChild(doc.createElement("br"));

  const visible = doc.createElement("span");
  visible.className = "humanstamp-signature";
  visible.textContent = `${SIGNATURE_PREFIX}${name}`;
  visible.setAttribute(HUMANSTAMP_METADATA_ATTR, "v2");
  visible.setAttribute(HUMANSTAMP_PAYLOAD_ATTR, stampJson);

  const comment = doc.createComment(
    `${HUMANSTAMP_COMMENT_PREFIX}${encodeStampForTransport(stampJson)}`
  );

  const backup = doc.createElement("span");
  backup.className = "humanstamp-backup";
  backup.setAttribute("aria-hidden", "true");
  backup.style.cssText =
    "font-size:1px;line-height:1px;opacity:0.01;width:1px;height:1px;overflow:hidden;display:inline;";
  backup.textContent = encodeStampForTransport(stampJson);

  editor.appendChild(spacer);
  editor.appendChild(visible);
  editor.appendChild(comment);
  editor.appendChild(backup);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

export function removeSignatureFromEditor(editor: HTMLElement): void {
  editor
    .querySelectorAll(`[${HUMANSTAMP_PAYLOAD_ATTR}], [${HUMANSTAMP_METADATA_ATTR}]`)
    .forEach((node) => node.remove());
  editor.querySelectorAll(".humanstamp-signature, .humanstamp-backup").forEach((node) => node.remove());
  removeStampComments(editor);

  const text = editor.innerText.replace(/\u00a0/g, " ");
  const idx = text.lastIndexOf(SIGNATURE_PREFIX);
  if (idx !== -1) {
    editor.innerText = text.slice(0, idx).replace(/\s+$/, "");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function removeStampComments(root: HTMLElement): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const toRemove: Comment[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Comment;
    if (node.data.startsWith(HUMANSTAMP_COMMENT_PREFIX)) toRemove.push(node);
  }
  toRemove.forEach((node) => node.remove());
}

export function getBodyTextFromEditor(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      `[${HUMANSTAMP_PAYLOAD_ATTR}], [${HUMANSTAMP_METADATA_ATTR}], .humanstamp-signature, .humanstamp-backup`
    )
    .forEach((node) => node.remove());
  removeStampComments(clone);

  const text = clone.innerText.replace(/\u00a0/g, " ");
  const idx = text.lastIndexOf(SIGNATURE_PREFIX);
  if (idx === -1) return normalizeBodyForHash(text);
  return normalizeBodyForHash(text.slice(0, idx).replace(/\s+$/, ""));
}
