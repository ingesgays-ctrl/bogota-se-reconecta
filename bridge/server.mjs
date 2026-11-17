// Puente en Node 18+ sin dependencias: JSON (/vehicles) y transmisión continua por SSE (/stream).
// Uso: node bridge/server.mjs   (variables: PORT, UPSTREAM, ROUTES_URL, ALLOWED_ORIGIN, POLL_SECONDS)
import http from "node:http";
import { snapshot, cors } from "./core.mjs";

const PORT = +(process.env.PORT || 8787), POLL = +(process.env.POLL_SECONDS || 10) * 1000;
const cfg = { UPSTREAM: process.env.UPSTREAM, ROUTES_URL: process.env.ROUTES_URL };
for (const k of Object.keys(cfg)) if (!cfg[k]) delete cfg[k];
let last = null, lastErr = null;
const clients = new Set();

// un solo ciclo de consulta al feed oficial, compartido por todos los navegadores conectados
async function tick() {
  try { last = await snapshot(cfg); lastErr = null; }
  catch (e) { lastErr = String(e.message || e); }
  const msg = lastErr ? `event: error\ndata: ${JSON.stringify({ error: lastErr })}\n\n` : `data: ${JSON.stringify(last)}\n\n`;
  for (const res of clients) res.write(msg);
}
tick(); setInterval(tick, POLL);

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x"), h = cors(req.headers.origin || "", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") { res.writeHead(204, h); return res.end(); }
  if (url.pathname === "/vehicles") {
    if (!last) { res.writeHead(502, { ...h, "content-type": "application/json" }); return res.end(JSON.stringify({ error: lastErr || "sin datos aún", vehicles: [], alerts: [] })); }
    res.writeHead(200, { ...h, "content-type": "application/json", "cache-control": "no-store" }); return res.end(JSON.stringify(last));
  }
  if (url.pathname === "/stream") {
    res.writeHead(200, { ...h, "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(`retry: 5000\n\n`); if (last) res.write(`data: ${JSON.stringify(last)}\n\n`);
    clients.add(res); req.on("close", () => clients.delete(res)); return;
  }
  if (url.pathname === "/health") { res.writeHead(200, { ...h, "content-type": "application/json" }); return res.end(JSON.stringify({ ok: !lastErr, error: lastErr, vehicles: last ? last.vehicles.length : 0, clients: clients.size })); }
  res.writeHead(404, h); res.end("Rutas: /vehicles, /stream, /health");
}).listen(PORT, () => console.log(`Puente GTFS-RT en http://localhost:${PORT}  (/vehicles · /stream · /health)`));
