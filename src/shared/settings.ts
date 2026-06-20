export function resolveDisplayName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasDisplayName(name: string): boolean {
  return resolveDisplayName(name) !== null;
}
