// ============================================================
// VERCEL SERVERLESS FUNCTION - Anthropic API Proxy
// ============================================================
// File location: api/proxy.js  (inside your project folder)
// Your API key is stored as an Environment Variable in Vercel —
// never exposed to the browser.
// ============================================================

const ALLOWED_ORIGIN = "*"; // Replace with "https://your-project.vercel.app" after deploy

export default async function handler(req, res) {
  // Set CORS headers on every response
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured: missing API key" });
  }

  const body = req.body;
  if (!body) {
    return res.status(400).json({ error: "Missing request body" });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await anthropicRes.json();
    return res.status(anthropicRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Upstream error: " + err.message });
  }
}
