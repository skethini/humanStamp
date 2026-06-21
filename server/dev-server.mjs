import { createServer } from "node:http";
import { corsHeaders, createSignedStamp } from "./lib/signing.mjs";

const PORT = Number(process.env.PORT ?? 3847);

const server = createServer(async (req, res) => {
  for (const [name, value] of Object.entries(corsHeaders())) {
    res.setHeader(name, value);
  }

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
    const stamp = createSignedStamp(body);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stamp));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Invalid payload" ? 400 : 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
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
