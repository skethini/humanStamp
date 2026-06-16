import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keysDir = join(root, "server", "keys");

mkdirSync(keysDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});
const publicJwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });

writeFileSync(join(keysDir, "private.jwk"), JSON.stringify(privateJwk, null, 2));
writeFileSync(
  join(root, "src", "shared", "public-key.ts"),
  `export const HUMANSTAMP_PUBLIC_JWK: JsonWebKey = ${JSON.stringify(publicJwk, null, 2)};\n`
);

console.log("Generated signing keys.");
