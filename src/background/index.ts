import { DEFAULT_SETTINGS } from "../shared/constants";
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

async function openWelcomeIfNeeded(): Promise<void> {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (hasDisplayName(settings.displayName)) return;

  await chrome.tabs.create({ url: WELCOME_URL });
}
