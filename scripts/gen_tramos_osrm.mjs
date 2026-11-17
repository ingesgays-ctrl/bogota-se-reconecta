// Genera public/data/tramos_viales_bogota.geojson: cada tramo de la red troncal actual (aristas de la
// matriz de 143 estaciones) ajustado a las vías reales con OSRM sobre OpenStreetMap. Se corre UNA vez en local:
//   node scripts/gen_tramos_osrm.mjs            (Node 18+, sin dependencias; ~3 min, respeta el servidor público)
// Perfil a pie primero (sigue el eje de la avenida sin sentidos viales ni retornos); si da un desvío, perfil carro.
// Si ninguno pasa el control de calidad (ruta ≤ 1,6 × la recta o ≤ 300 m más larga), el tramo queda en línea recta.
// Tramos que unen troncales distintas (no consecutivos en paradas_ordenadas.csv) se marcan "conexion" (línea punteada).
import fs from "node:fs";
const D = JSON.parse(fs.readFileSync(new URL("../src/data.json", import.meta.url)));
const EDGES = JSON.parse(fs.readFileSync(new URL("./tramos_aristas.json", import.meta.url)));   // [{k, a:[lon,lat], b:[lon,lat], tipo, troncal, desde, hasta}]
const OSRM = process.env.OSRM || "https://routing.openstreetmap.de/routed-";
const hav = (a, b) => { const R = 6371000, p1 = a[1] * Math.PI / 180, p2 = b[1] * Math.PI / 180, dp = p2 - p1, dl = (b[0] - a[0]) * Math.PI / 180; return 2 * R * Math.asin(Math.sqrt(Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function simplify(pts, tol) {
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const toM = p => [p[0] * 111320 * Math.cos(4.65 * Math.PI / 180), p[1] * 110540], st = [[0, pts.length - 1]];
  while (st.length) { const [i, j] = st.pop(), A = toM(pts[i]), B = toM(pts[j]); let best = -1, bd = 0;
    for (let k = i + 1; k < j; k++) { const P = toM(pts[k]), dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2)), d = Math.hypot(P[0] - A[0] - dx * t, P[1] - A[1] - dy * t); if (d > bd) { bd = d; best = k; } }
    if (bd > tol) { keep[best] = 1; st.push([i, best], [best, j]); } }
  return pts.filter((_, i) => keep[i]);
}
async function route(prof, a, b) {
  for (let t = 0; t < 3; t++) {
    try { const r = await fetch(`${OSRM}${prof}/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`, { headers: { "user-agent": "bogota-se-reconecta (generación única de tramos)" } });
      if (r.status === 429) { await sleep(2000); continue; } const j = await r.json(); return j.code === "Ok" ? j.routes[0] : null; }
    catch { await sleep(1000); }
  }
  return null;
}
export async function tramoOSRM(a, b) {
  const recta = hav(a, b); let pick = null;
  for (const prof of ["foot", "car"]) {
    const r = await route(prof, a, b); await sleep(250);
    if (r) { const ratio = r.distance / recta; if (!pick || r.distance < pick.r.distance) pick = { r, prof, ratio }; if (ratio <= 1.45 || r.distance - recta < 250) break; }
  }
  if (pick && (pick.ratio <= 1.6 || pick.r.distance - recta < 300)) return { g: simplify([a, ...pick.r.geometry.coordinates, b], 4).map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]), m: Math.round(pick.r.distance), s: Math.round(recta), tipo: "osrm-" + pick.prof };
  return { g: [a, b], m: Math.round(recta), s: Math.round(recta), tipo: "recta" };
}
export function toGeoJSON(edges, res) {
  return { type: "FeatureCollection", name: "tramos_viales_bogota",
    metadata: { descripcion: "Tramos de la red troncal actual (143 estaciones, 146 aristas) ajustados a las vías reales", fuente: "OSRM (routing.openstreetmap.de, perfiles foot/car) sobre OpenStreetMap", licencia: "Datos © colaboradores de OpenStreetMap, ODbL 1.0", generado: new Date().toISOString().slice(0, 10), control_calidad: "ruta ≤ 1,6 × distancia recta o ≤ 300 m más larga; si no, línea recta", nota: "Solo geometría visual: los km del grafo y los cálculos del modelo no cambian" },
    features: edges.map(e => { const r = res[e.k]; return { type: "Feature", properties: { k: e.k, desde: e.desde, hasta: e.hasta, troncal: e.troncal, tipo_tramo: e.tipo, metodo: r.tipo, dist_vial_m: r.m, dist_recta_m: r.s }, geometry: { type: "LineString", coordinates: r.g } }; }) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const res = {}; let n = 0;
  for (const e of EDGES) { res[e.k] = await tramoOSRM(e.a, e.b); process.stdout.write(`\r${++n}/${EDGES.length}`); }
  fs.mkdirSync(new URL("../public/data/", import.meta.url), { recursive: true });
  fs.writeFileSync(new URL("../public/data/tramos_viales_bogota.geojson", import.meta.url), JSON.stringify(toGeoJSON(EDGES, res)));
  console.log("\npublic/data/tramos_viales_bogota.geojson");
}
