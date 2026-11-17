// Lógica común del puente: descarga los 3 feeds GTFS-RT de TransMilenio, los decodifica y los une en un JSON compacto.
import GTFSRT from "./gtfsrt.mjs";

export const DEFAULTS = {
  UPSTREAM: "https://gis.transmilenio.gov.co/gtfs/",   // vehiclepos.pb, tripupdate.pb, serviceAlerts.pb
  ROUTES_URL: "",          // opcional: routes.txt del GTFS estático (o JSON {route_id: "B74"}) para traducir route_id → código visible
  CACHE_SECONDS: 10,       // el feed oficial se refresca cada ~10-30 s; no tiene sentido pedirlo más seguido
  TIMEOUT_MS: 8000,
};

async function get(url, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "bogota-se-reconecta-bridge/1.0" } });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || type.includes("text/html")) throw new Error(`${url} → HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

function parseRoutes(text) {
  const t = text.trim();
  if (t.startsWith("{")) return JSON.parse(t);
  const rows = t.split(/\r?\n/).map(l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')));
  const h = rows.shift().map(x => x.replace(/^﻿/, "").trim()), iId = h.indexOf("route_id"), iS = h.indexOf("route_short_name");
  const map = {}; rows.forEach(r => { if (r[iId]) map[r[iId]] = (r[iS] || r[iId]).trim(); }); return map;
}

let routeCache = null;
export async function snapshot(cfg = {}) {
  const c = { ...DEFAULTS, ...cfg }, base = c.UPSTREAM.replace(/\/?$/, "/");
  if (c.ROUTES_URL && !routeCache) { try { routeCache = parseRoutes(new TextDecoder().decode(await get(c.ROUTES_URL, c.TIMEOUT_MS))); } catch (e) { routeCache = {}; } }
  // las posiciones son obligatorias; retrasos y alertas son opcionales (si fallan, se sigue sin ellos)
  const [vp, tu, al] = await Promise.allSettled(["vehiclepos.pb", "tripupdate.pb", "serviceAlerts.pb"].map(f => get(base + f, c.TIMEOUT_MS).then(GTFSRT.decode)));
  if (vp.status !== "fulfilled") throw vp.reason;
  const out = GTFSRT.toLive(vp.value, tu.status === "fulfilled" ? tu.value : null, al.status === "fulfilled" ? al.value : null, routeCache);
  out.partial = [tu, al].some(x => x.status !== "fulfilled");
  out.fetched = Math.round(Date.now() / 1000);
  return out;
}

export function cors(origin, allowed) {
  const ok = !allowed || allowed === "*" || allowed.split(",").map(s => s.trim()).includes(origin);
  return { "access-control-allow-origin": ok ? (allowed === "*" || !allowed ? "*" : origin) : "null", "access-control-allow-methods": "GET, OPTIONS", vary: "origin" };
}
