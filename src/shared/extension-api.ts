export function canUseExtensionApis(): boolean {
  return typeof chrome !== "undefined" && !!chrome.runtime?.id;
}

export function canUseExtensionStorage(): boolean {
  return canUseExtensionApis() && !!chrome.storage?.local;
}
