import { DEFAULT_SETTINGS } from "../shared/constants";
import {
  GET_DISPLAY_NAME_MESSAGE,
  GetDisplayNameResponse,
  SET_DISPLAY_NAME_MESSAGE,
  SetDisplayNameRequest,
  SetDisplayNameResponse,
  SIGN_STAMP_MESSAGE,
  SignStampRequest,
  SignStampResponse,
} from "../shared/messages";
import { hasDisplayName } from "../shared/settings";
import { signStamp } from "./signing";

const WELCOME_URL = chrome.runtime.getURL("onboarding/welcome.html");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === GET_DISPLAY_NAME_MESSAGE) {
    void chrome.storage.sync
      .get(DEFAULT_SETTINGS)
      .then((settings) =>
        sendResponse({
          ok: true,
          displayName: settings.displayName || "",
        } satisfies GetDisplayNameResponse)
      )
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Read failed",
        } satisfies GetDisplayNameResponse)
      );

    return true;
  }

  if (message?.type === SET_DISPLAY_NAME_MESSAGE) {
    const { displayName } = message as SetDisplayNameRequest;
    if (typeof displayName !== "string") {
      sendResponse({ ok: false, error: "Invalid request" } satisfies SetDisplayNameResponse);
      return;
    }

    void chrome.storage.sync
      .set({ displayName })
      .then(() => sendResponse({ ok: true } satisfies SetDisplayNameResponse))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Save failed",
        } satisfies SetDisplayNameResponse)
      );

    return true;
  }

  if (message?.type !== SIGN_STAMP_MESSAGE) return;

  const signMessage = message as SignStampRequest;
  if (typeof signMessage.contentHash !== "string") {
    sendResponse({ ok: false, error: "Invalid request" } satisfies SignStampResponse);
    return;
  }

  void signStamp(signMessage.contentHash)
    .then((stamp) => sendResponse({ ok: true, stamp } satisfies SignStampResponse))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Signing failed",
      } satisfies SignStampResponse)
    );

  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  void openWelcomeIfNeeded();
});

async function openWelcomeIfNeeded(): Promise<void> {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (hasDisplayName(settings.displayName)) return;

  await chrome.tabs.create({ url: WELCOME_URL });
}
