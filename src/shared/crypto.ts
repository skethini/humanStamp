import { normalizeBodyForHash } from "./normalize";
import { HUMANSTAMP_PUBLIC_JWK } from "./public-key";
import { SignedStamp, VerificationPayload } from "./stamp";

const textEncoder = new TextEncoder();

let cachedPublicKey: CryptoKey | null = null;

export function canonicalizePayload(payload: VerificationPayload): string {
  return JSON.stringify({
    contentHash: payload.contentHash,
    eligible: payload.eligible,
    timestamp: payload.timestamp,
    version: payload.version,
  });
}

export async function hashContent(content: string): Promise<string> {
  return hashRawContent(normalizeBodyForHash(content));
}

async function hashRawContent(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(content)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function contentHashCandidates(bodyText: string): Promise<string[]> {
  const variants = [
    normalizeBodyForHash(bodyText),
    bodyText.replace(/\u00a0/g, " ").trimEnd(),
    bodyText,
  ];
  const hashes = await Promise.all(variants.map((text) => hashRawContent(text)));
  return [...new Set(hashes)];
}

async function importPublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey;
  cachedPublicKey = await crypto.subtle.importKey(
    "jwk",
    HUMANSTAMP_PUBLIC_JWK,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  return cachedPublicKey;
}

export async function verifySignedStamp(
  stamp: SignedStamp,
  bodyText: string
): Promise<boolean> {
  if (stamp.payload.version !== "2" || stamp.payload.eligible !== true) {
    return false;
  }

  const bodyHashes = await contentHashCandidates(bodyText);
  if (!bodyHashes.includes(stamp.payload.contentHash)) return false;

  const publicKey = await importPublicKey();
  const signature = Uint8Array.from(atob(stamp.signature), (c) =>
    c.charCodeAt(0)
  );
  const data = textEncoder.encode(canonicalizePayload(stamp.payload));

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signature,
    data
  );
}
