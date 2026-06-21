import { corsHeaders, createSignedStamp } from "../../lib/signing.mjs";

export default async function handler(req, res) {
  for (const [name, value] of Object.entries(corsHeaders())) {
    res.setHeader(name, value);
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const stamp = createSignedStamp(req.body ?? {});
    res.status(200).json(stamp);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Invalid payload" ? 400 : 500;
    res.status(status).json({ error: message });
  }
}
