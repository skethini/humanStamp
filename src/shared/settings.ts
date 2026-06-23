import { SIGNATURE_LABEL, SIGNATURE_PREFIX } from "./constants";

export function resolveDisplayName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasDisplayName(name: string): boolean {
  return resolveDisplayName(name) !== null;
}

export function formatSignatureLine(displayName: string): string {
  const name = resolveDisplayName(displayName);
  if (!name) return SIGNATURE_LABEL;
  return `${SIGNATURE_PREFIX}${name}`;
}

export function findSignatureIndex(text: string): number {
  const namedIdx = text.lastIndexOf(SIGNATURE_PREFIX);
  if (namedIdx !== -1) return namedIdx;

  const bareIdx = text.lastIndexOf(SIGNATURE_LABEL);
  if (bareIdx === -1) return -1;

  const afterLabel = text.slice(bareIdx + SIGNATURE_LABEL.length);
  const restOfLine = (afterLabel.split("\n")[0] ?? "").trim();
  if (restOfLine.length === 0) return bareIdx;

  return -1;
}

export function hasSignatureText(text: string): boolean {
  return findSignatureIndex(text) !== -1;
}

export function stripSignatureText(text: string): string {
  const idx = findSignatureIndex(text);
  if (idx === -1) return text;
  return text.slice(0, idx).replace(/\s+$/, "");
}
