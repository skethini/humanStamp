export const GMAIL_HOST = "mail.google.com";

export const OUTLOOK_HOSTS = [
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "outlook.cloud.microsoft.com",
] as const;

export function isGmailHost(): boolean {
  return location.hostname === GMAIL_HOST;
}

export function isOutlookHost(): boolean {
  return OUTLOOK_HOSTS.includes(
    location.hostname as (typeof OUTLOOK_HOSTS)[number]
  );
}

export function isSupportedMailHost(): boolean {
  return isGmailHost() || isOutlookHost();
}
