export const GMAIL_HOST = "mail.google.com";

export const OUTLOOK_HOSTS = [
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "outlook.cloud.microsoft.com",
  "outlook.cloud.microsoft",
  "outlook.com",
] as const;

export function isGmailHost(): boolean {
  return location.hostname === GMAIL_HOST;
}

export function isOutlookHost(): boolean {
  const host = location.hostname;
  if (OUTLOOK_HOSTS.includes(host as (typeof OUTLOOK_HOSTS)[number])) {
    return true;
  }
  return host.endsWith(".outlook.com") || host === "outlook.com";
}

export function isSupportedMailHost(): boolean {
  return isGmailHost() || isOutlookHost();
}

/** Outlook compose often runs in a nested iframe before the editor mounts. */
export function isBlankComposeFrame(): boolean {
  if (window.top === window) return false;
  if (!isOutlookHost()) return false;
  return !document.querySelector(
    'div.elementToProof, [aria-label*="Message body" i][contenteditable], [aria-label*="Message Body" i][contenteditable]'
  );
}
