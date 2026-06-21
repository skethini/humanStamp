import { createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import("node:crypto").KeyObject | null} */
let cachedPrivateKey = null;

function loadPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;

  const fromEnv = process.env.HUMANSTAMP_PRIVATE_JWK;
  if (fromEnv) {
    cachedPrivateKey = createPrivateKey({
      key: JSON.parse(fromEnv),
      format: "jwk",
    });
    return cachedPrivateKey;
  }

  const keyPath = join(__dirname, "..", "keys", "private.jwk");
  if (existsSync(keyPath)) {
    cachedPrivateKey = createPrivateKey({
      key: JSON.parse(readFileSync(keyPath, "utf8")),
      format: "jwk",
    });
    return cachedPrivateKey;
  }

  throw new Error(
    "Missing signing private key. Set HUMANSTAMP_PRIVATE_JWK or run npm run generate-keys."
  );
}

export function canonicalize(payload) {
  return JSON.stringify({
    contentHash: payload.contentHash,
    eligible: payload.eligible,
    timestamp: payload.timestamp,
    version: payload.version,
  });
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
  };
}

export function validateSignRequest(body) {
  if (
    body.eligible !== true ||
    body.version !== "2" ||
    typeof body.contentHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.contentHash) ||
    Number.isNaN(Date.parse(body.timestamp))
  ) {
    throw new Error("Invalid payload");
  }
}

export function createSignedStamp(body) {
  validateSignRequest(body);

  const payload = {
    contentHash: body.contentHash,
    eligible: true,
    timestamp: body.timestamp,
    version: "2",
  };

  const signature = sign("sha256", Buffer.from(canonicalize(payload)), {
    key: loadPrivateKey(),
    dsaEncoding: "ieee-p1363",
  }).toString("base64");

  return { payload, signature };
}
