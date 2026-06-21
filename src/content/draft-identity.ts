import { queryAllDeep } from "./dom";
import { hashText } from "./draft-hash";

const SESSION_ATTR = "data-humanstamp-draft-id";
const COMPOSE_BINDINGS_KEY = "draftComposeBindings";
const MAX_BINDINGS = 64;

export interface DraftIdentity {
  adapterId: string;
  composeId: string;
  subject: string;
  recipients: string;
  bodyText: string;
}

function readFieldText(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) continue;

    const value =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : el.innerText || el.textContent || "";

    const normalized = value.replace(/\u00a0/g, " ").trim();
    if (normalized) return normalized;
  }

  return "";
}

function findComposeRoot(adapterId: string, editor: HTMLElement): HTMLElement {
  if (adapterId === "gmail") {
    return (
      editor.closest<HTMLElement>(
        "[data-compose-id], .AD, .iN, .M9, form.bAs"
      ) ?? editor
    );
  }

  return (
    editor.closest<HTMLElement>(
      '[data-app-section="ComposeContainer"], [data-app-section="Compose"], [role="dialog"], [class*="ComposeForm"]'
    ) ?? editor
  );
}

function getNativeComposeId(
  adapterId: string,
  composeRoot: HTMLElement,
  editor: HTMLElement
): string | null {
  const composeId =
    editor.closest<HTMLElement>("[data-compose-id]")?.getAttribute(
      "data-compose-id"
    ) ??
    composeRoot.getAttribute("data-compose-id") ??
    composeRoot.getAttribute("data-compose-id-stable");

  if (composeId) return composeId;

  if (adapterId === "outlook") {
    const url = new URL(location.href);
    const fromUrl =
      url.searchParams.get("conversationid") ??
      url.searchParams.get("itemid") ??
      url.searchParams.get("id");
    if (fromUrl) return `url:${fromUrl}`;
  }

  return null;
}

function composeBindingKey(
  adapterId: string,
  subject: string,
  recipients: string
): string {
  return `${adapterId}:${hashText(subject)}:${hashText(recipients)}`;
}

async function readComposeBindings(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(COMPOSE_BINDINGS_KEY);
  const bindings = result[COMPOSE_BINDINGS_KEY];
  return bindings && typeof bindings === "object"
    ? (bindings as Record<string, string>)
    : {};
}

async function persistComposeBinding(
  bindingKey: string,
  composeId: string
): Promise<void> {
  const bindings = await readComposeBindings();
  bindings[bindingKey] = composeId;

  const entries = Object.entries(bindings);
  const trimmed =
    entries.length <= MAX_BINDINGS
      ? bindings
      : Object.fromEntries(entries.slice(entries.length - MAX_BINDINGS));

  await chrome.storage.local.set({ [COMPOSE_BINDINGS_KEY]: trimmed });
}

async function getOrCreateComposeId(
  adapterId: string,
  composeRoot: HTMLElement,
  editor: HTMLElement,
  subject: string,
  recipients: string
): Promise<string> {
  const native = getNativeComposeId(adapterId, composeRoot, editor);
  if (native) return native;

  const existing = composeRoot.getAttribute(SESSION_ATTR);
  if (existing) return existing;

  const bindingKey = composeBindingKey(adapterId, subject, recipients);
  const bindings = await readComposeBindings();
  const stored = bindings[bindingKey];
  if (stored) {
    composeRoot.setAttribute(SESSION_ATTR, stored);
    return stored;
  }

  const sessionId = crypto.randomUUID();
  composeRoot.setAttribute(SESSION_ATTR, sessionId);
  await persistComposeBinding(bindingKey, sessionId);
  return sessionId;
}

function readSubject(adapterId: string, composeRoot: HTMLElement): string {
  const selectors =
    adapterId === "gmail"
      ? [
          'input[name="subjectbox"]',
          'input[aria-label="Subject"]',
          'input[aria-label*="Subject" i]',
        ]
      : [
          'input[aria-label="Add a subject"]',
          'input[aria-label*="subject" i]',
          'input[placeholder*="subject" i]',
        ];

  const fromRoot = readFieldText(composeRoot, selectors);
  if (fromRoot) return fromRoot;

  for (const el of queryAllDeep(selectors.join(", "))) {
    if (!composeRoot.contains(el) && !el.contains(composeRoot)) continue;
    const value =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : el.innerText || el.textContent || "";
    const normalized = value.replace(/\u00a0/g, " ").trim();
    if (normalized) return normalized;
  }

  return "";
}

function readRecipients(adapterId: string, composeRoot: HTMLElement): string {
  const selectors =
    adapterId === "gmail"
      ? [
          'textarea[aria-label="To recipients"]',
          'textarea[aria-label="To"]',
          'input[aria-label="To recipients"]',
          'input[aria-label="To"]',
          '[aria-label="To recipients"]',
        ]
      : [
          '[aria-label="To"]',
          '[aria-label="To recipients"]',
          'input[aria-label="To"]',
        ];

  const fromRoot = readFieldText(composeRoot, selectors);
  if (fromRoot) return fromRoot;

  for (const el of queryAllDeep(selectors.join(", "))) {
    if (!composeRoot.contains(el) && !el.contains(composeRoot)) continue;
    if (el.getAttribute("aria-label")?.toLowerCase().includes("message body")) {
      continue;
    }

    const value =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : el.innerText || el.textContent || "";
    const normalized = value.replace(/\u00a0/g, " ").trim();
    if (normalized) return normalized;
  }

  return "";
}

export async function resolveDraftIdentity(
  adapterId: string,
  editor: HTMLElement,
  bodyText: string
): Promise<DraftIdentity> {
  const composeRoot = findComposeRoot(adapterId, editor);
  const subject = readSubject(adapterId, composeRoot);
  const recipients = readRecipients(adapterId, composeRoot);
  const composeId = await getOrCreateComposeId(
    adapterId,
    composeRoot,
    editor,
    subject,
    recipients
  );

  return {
    adapterId,
    composeId,
    subject,
    recipients,
    bodyText,
  };
}
