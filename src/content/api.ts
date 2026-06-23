import {
  GET_DISPLAY_NAME_MESSAGE,
  GetDisplayNameResponse,
  SIGN_STAMP_MESSAGE,
  SignStampResponse,
} from "../shared/messages";
import { SignedStamp } from "../shared/stamp";
import { canUseExtensionApis } from "../shared/extension-api";

export async function fetchDisplayName(): Promise<string | null> {
  if (!canUseExtensionApis()) return null;

  try {
    const response = (await chrome.runtime.sendMessage({
      type: GET_DISPLAY_NAME_MESSAGE,
    })) as GetDisplayNameResponse | undefined;

    if (!response?.ok) return null;
    return response.displayName;
  } catch {
    return null;
  }
}

export async function requestSignedStamp(
  contentHash: string
): Promise<SignedStamp> {
  const response = (await chrome.runtime.sendMessage({
    type: SIGN_STAMP_MESSAGE,
    contentHash,
  })) as SignStampResponse | undefined;

  if (chrome.runtime.lastError) {
    throw new Error(chrome.runtime.lastError.message);
  }

  if (!response?.ok) {
    throw new Error(response?.error ?? "Could not reach the signing service");
  }

  return response.stamp;
}
