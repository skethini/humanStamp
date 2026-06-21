import {
  SIGN_STAMP_MESSAGE,
  SignStampResponse,
} from "../shared/messages";
import { SignedStamp } from "../shared/stamp";

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
