import { HUMANSTAMP_API_URL } from "../shared/constants";
import { SignedStamp } from "../shared/stamp";

export async function requestSignedStamp(
  contentHash: string
): Promise<SignedStamp> {
  const response = await fetch(HUMANSTAMP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentHash,
      eligible: true,
      timestamp: new Date().toISOString(),
      version: "2",
    }),
  });

  if (!response.ok) {
    throw new Error(`Signing failed (${response.status})`);
  }

  return response.json() as Promise<SignedStamp>;
}
