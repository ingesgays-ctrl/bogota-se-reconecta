// Puente para Cloudflare Workers (gratis): GET /vehicles → JSON con buses, retrasos y alertas, con CORS.
// Despliegue: npx wrangler deploy   (ver README.md)
import { snapshot, cors, DEFAULTS } from "./core.mjs";

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), origin = req.headers.get("origin") || "", h = cors(origin, env.ALLOWED_ORIGIN || "*");
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    if (url.pathname === "/health") return Response.json({ ok: true }, { headers: h });
    if (url.pathname !== "/vehicles") return new Response("Rutas: /vehicles, /health", { status: 404, headers: h });
    const ttl = +(env.CACHE_SECONDS || DEFAULTS.CACHE_SECONDS), key = new Request(url.origin + "/vehicles");
    const cache = caches.default, hit = await cache.match(key);
    if (hit) { const r = new Response(hit.body, hit); Object.entries(h).forEach(([k, v]) => r.headers.set(k, v)); return r; }
    try {
      const data = await snapshot({ UPSTREAM: env.UPSTREAM || DEFAULTS.UPSTREAM, ROUTES_URL: env.ROUTES_URL || "" });
      const res = Response.json(data, { headers: { ...h, "cache-control": `public, max-age=${ttl}` } });
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    } catch (e) {
      return Response.json({ source: "gtfs-rt", error: String(e.message || e), vehicles: [], alerts: [] }, { status: 502, headers: { ...h, "cache-control": "no-store" } });
    }
  },
};
