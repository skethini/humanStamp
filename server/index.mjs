import { createServer } from "node:http";
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3847);
const privateKey = createPrivateKey({
  key: JSON.parse(readFileSync(join(__dirname, "keys", "private.jwk"), "utf8")),
  format: "jwk",
});

function canonicalize(payload) {
  return JSON.stringify({
    contentHash: payload.contentHash,
    eligible: payload.eligible,
    timestamp: payload.timestamp,
    version: payload.version,
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/v1/sign") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = JSON.parse(
      Buffer.concat(await readArray(req)).toString("utf8")
    );
    if (
      body.eligible !== true ||
      body.version !== "2" ||
      typeof body.contentHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.contentHash) ||
      Number.isNaN(Date.parse(body.timestamp))
    ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid payload" }));
      return;
    }

    const payload = {
      contentHash: body.contentHash,
      eligible: true,
      timestamp: body.timestamp,
      version: "2",
    };
    const signature = sign("sha256", Buffer.from(canonicalize(payload)), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ payload, signature }));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Server error",
      })
    );
  }
});

async function readArray(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks;
}

server.listen(PORT, () => {
  console.log(`HumanStamp signing service on http://localhost:${PORT}`);
});
