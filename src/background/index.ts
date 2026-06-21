import {
  DEFAULT_DISPLAY_NAME,
  DEFAULT_SETTINGS,
  ONBOARDING_TAB_ID_KEY,
} from "../shared/constants";
import {
  SIGN_STAMP_MESSAGE,
  SignStampRequest,
  SignStampResponse,
} from "../shared/messages";
import { hasDisplayName } from "../shared/settings";
import { signStamp } from "./signing";

const WELCOME_URL = chrome.runtime.getURL("onboarding/welcome.html");

chrome.runtime.onMessage.addListener(
  (message: SignStampRequest, _sender, sendResponse) => {
    if (message?.type !== SIGN_STAMP_MESSAGE) return;

    if (typeof message.contentHash !== "string") {
      sendResponse({ ok: false, error: "Invalid request" } satisfies SignStampResponse);
      return;
    }

    void signStamp(message.contentHash)
      .then((stamp) => sendResponse({ ok: true, stamp } satisfies SignStampResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Signing failed",
        } satisfies SignStampResponse)
      );

    return true;
  }
);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  void openWelcomeIfNeeded();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void handleWelcomeTabClosed(tabId);
});

async function openWelcomeIfNeeded(): Promise<void> {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (hasDisplayName(settings.displayName)) return;

  const tab = await chrome.tabs.create({ url: WELCOME_URL });
  if (tab.id !== undefined) {
    await chrome.storage.local.set({ [ONBOARDING_TAB_ID_KEY]: tab.id });
  }
}

async function handleWelcomeTabClosed(tabId: number): Promise<void> {
  const stored = await chrome.storage.local.get(ONBOARDING_TAB_ID_KEY);
  if (stored[ONBOARDING_TAB_ID_KEY] !== tabId) return;

  await chrome.storage.local.remove(ONBOARDING_TAB_ID_KEY);

  // Allow welcome page pagehide handler to persist a typed name first.
  await new Promise((resolve) => setTimeout(resolve, 150));

  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (!hasDisplayName(settings.displayName)) {
    await chrome.storage.sync.set({ displayName: DEFAULT_DISPLAY_NAME });
  }
}
