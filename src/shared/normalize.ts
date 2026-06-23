import { findSignatureIndex } from "./settings";

/** Stable text normalization for hashing and verification across email clients. */
export function normalizeBodyForHash(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd();
}

export function extractBodyBeforeSignature(container: HTMLElement): string {
  const text = container.innerText.replace(/\u00a0/g, " ");
  const idx = findSignatureIndex(text);
  if (idx === -1) return normalizeBodyForHash(text);
  return normalizeBodyForHash(text.slice(0, idx).replace(/\s+$/, ""));
}
