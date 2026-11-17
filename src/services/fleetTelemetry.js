// =====================================================================
// Telemetría de flota híbrida: simulador BPR acoplado al grafo + entrada GTFS-RT
// ---------------------------------------------------------------------
// El modelo IPF/BPR NO publica V/C por tramo (fuente de verdad, §6). Aquí se ESTIMA:
//   carga relativa del tramo  ∝  s_e (fracción de trayectos que lo usan, centralidad de arista) × viajes del escenario
//   x_e = K · s_e · viajes      (saturación estimada, "V/C estimado")
//   t_e = t0_e · (1 + α·x_e^β)  con α = 0,15 y β = 4 (valores de referencia del Bureau of Public Roads)
// K y la velocidad libre v0 se calibran por mínimos cuadrados para que el tiempo medio con congestión
// de los 4 escenarios reproduzca el oficial (30,1 · 26,9 · 26,4 · 24,6 min). Es una estimación del visor.
// =====================================================================
const BPR = { a: .15, b: 4 };
const FRANJAS = {
  am: { u: "Pico mañana · 6–9 a. m.", demanda: () => 1 },
  valle: { u: "Hora valle", demanda: () => FLEET.valle },    // supuesto ajustable, sin dato oficial
  pm: { u: "Pico tarde · 4:30–7:30 p. m.", demanda: () => 1 },  // OD transpuesta: mismos volúmenes por tramo
};
// ---------- semáforos y demanda de pasajeros (estimación del visor; supuestos en la fuente de verdad §10) ----------
// Por cada intersección semaforizada del tramo (OpenStreetMap, datos/semaforos_tramos.json):
//   espera en rojo (Webster, 1.er término)   d1 = C·(1−g)² / (2·(1 − g·x))
//   cola de buses (Webster, 2.º término)     d2 = x² / (2·q·(1 − x)),  x = buses/h GTFS ÷ (capacidad · g)
//   frenar y arrancar                        (1−g) · v/2 · (1/a + 1/b),  v = mín(v crucero, √(2·s·a·b/(a+b)))
//                                            s = distancia al semáforo o estación anterior: más cerca = menos velocidad
//   φ = fracción de semáforos sin onda verde para el bus: multiplica la espera en rojo y la pérdida por frenar
// Demanda: cada estación demora DWELL s extra por unidad de V/C estimado (abordaje y puertas en hora pico).
// φ se calibra para que el viaje medio del modelo (red actual, pico mañana) sume CONG_OBJ min de congestión.
const SEM = { C: { am: 120, valle: 90, pm: 120 }, g: { am: .5, valle: .6, pm: .5 }, a: 1.0, b: 1.3, vmax: 50 / 3.6, cap: 1200, dwell: 10, phi: 1 };
const CONG_OBJ = 5;   // min · objetivo de diseño (rango pedido: 4–6 min en hora pico para el viaje medio)
const SEMD = (typeof window !== "undefined" && window.SEM_DATA) || { tramos: {}, corredores: {}, bus_h: {} };
const BUS_MED = Object.fromEntries(["am", "valle", "pm"].map(fr => { const v = Object.values(SEMD.bus_h[fr] || {}).sort((a, b) => a - b); return [fr, v.length ? v[v.length >> 1] : 30]; }));
const CORR_OF = new Map(); G.forEach(x => x.corrEdge.forEach((c, k) => { if (!BASE_EDGES.has(k)) CORR_OF.set(k, c); }));
function sigSpacings(esc, k) {   // distancias (m) entre semáforos del tramo
  if (SEMD.tramos[k]) return SEMD.tramos[k];
  const c = CORR_OF.get(k), d = c && SEMD.corredores[c]; if (!d || !d.por_km) return [];
  const [a, b] = k.split("|"), n = d.por_km * edgeKm(esc, a, b), sp = 1000 / d.por_km, out = [];
  for (let i = 0; i < Math.floor(n); i++) out.push(sp);
  if (n % 1 > .5) out.push(sp);
  return out;
}
const SIG_CACHE = new Map();
function sigSec(esc, k, fr) {   // segundos perdidos en los semáforos del tramo
  const key = k + "|" + fr + "|" + (CORR_OF.has(k) ? esc : ""); if (SIG_CACHE.has(key)) return SIG_CACHE.get(key);
  const C = SEM.C[fr], g = SEM.g[fr], r = 1 - g, q = (SEMD.bus_h[fr] || {})[k] ?? BUS_MED[fr], x = Math.min(.95, q / (SEM.cap * g)), qs = q / 3600;
  const d1 = C * r * r / (2 * (1 - g * x)), d2 = qs > 0 ? x * x / (2 * qs * (1 - x)) : 0;
  let t = 0; sigSpacings(esc, k).forEach(s => { const v = Math.min(SEM.vmax, Math.sqrt(2 * s * SEM.a * SEM.b / (SEM.a + SEM.b))); t += SEM.phi * (d1 + r * v / 2 * (1 / SEM.a + 1 / SEM.b)) + d2; });
  SIG_CACHE.set(key, t); return t;
}
const sOfK = (esc, k) => CENT[esc].edges.get(k) || 0;
// minutos extra del tramo por semáforos y demanda (K = factor de saturación; se pasa explícito durante la calibración)
function extraMin(esc, k, fr, K = FLEET.K) { return (sigSec(esc, k, fr) + SEM.dwell * K * sOfK(esc, k) * E[esc].viajes * FRANJAS[fr === "valle" ? "valle" : "am"].demanda()) / 60; }
function sigMin(esc, k, fr) { return sigSec(esc, k, fr) / 60; }
const FLEET = (() => {
  const per = E.map((e, i) => { const arr = []; CENT[i].edges.forEach((s, k) => { const [a, b] = k.split("|"); arr.push({ k, s, km: edgeKm(i, a, b), sig: sigSec(i, k, "am") }); }); return arr; });
  // por escenario: F = factor BPR medio por km; X = min extra por km (semáforos + demanda), ambos ponderados por uso (s·km)
  const FX = (i, K, dw) => { let num = 0, den = 0, ex = 0; per[i].forEach(o => { const w = o.s * o.km, x = K * o.s * E[i].viajes; num += w * (1 + BPR.a * x ** BPR.b); den += w; ex += o.s * (o.sig + dw * x) / 60; }); return [num / den, ex / den]; };
  const smax0 = Math.max(...per[0].map(o => o.s)) * E[0].viajes;
  const fit = dw => {   // K y c = 1/v0 (min/km) por mínimos cuadrados contra el tiempo medio oficial de los 4 escenarios
    let best = null;
    for (let j = 1; j <= 300; j++) {
      const K = (j / 300) * 4 / smax0, fx = E.map((e, i) => FX(i, K, dw));
      const a = E.map((e, i) => e.longitud * fx[i][0] / e.tiempo), b = E.map((e, i) => e.longitud * fx[i][1] / e.tiempo);
      const c = Math.max(1e-3, a.reduce((t, v, i) => t + v * (1 - b[i]), 0) / a.reduce((t, v) => t + v * v, 0));
      const err = Math.sqrt(a.reduce((t, v, i) => t + (c * v + b[i] - 1) ** 2, 0) / a.length);
      if (!best || err < best.err) best = { K, c, err, fx };
    }
    best.cong = E[0].longitud * (best.c * (best.fx[0][0] - 1) + best.fx[0][1]);   // min de congestión del viaje medio (red actual, pico)
    return best;
  };
  // φ por bisección hasta que el viaje medio sume CONG_OBJ min (cambia φ → se rehace el caché de semáforos)
  const setPhi = f => { SEM.phi = f; SIG_CACHE.clear(); per.forEach((arr, i) => arr.forEach(o => { o.sig = sigSec(i, o.k, "am"); })); };
  let lo = 0, hi = 1, best;
  setPhi(1); best = fit(SEM.dwell);
  if (best.cong > CONG_OBJ) { for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; setPhi(m); const f = fit(SEM.dwell); if (f.cong < CONG_OBJ) lo = m; else hi = m; } setPhi((lo + hi) / 2); best = fit(SEM.dwell); }
  const v0 = 60 / best.c;                                // km/h a flujo libre (calibrada)
  const pred = E.map((e, i) => e.longitud * (best.c * best.fx[i][0] + best.fx[i][1]));
  const cong = E.map((e, i) => e.longitud * (best.c * (best.fx[i][0] - 1) + best.fx[i][1]));
  const sig = E.map((e, i) => { let ex = 0, den = 0; per[i].forEach(o => { ex += o.s * o.sig / 60; den += o.s * o.km; }); return e.longitud * ex / den; });
  return { K: best.K, v0, err: best.err, pred, cong, sig, per, valle: .5, xmax: E.map((e, i) => Math.max(...per[i].map(o => best.K * o.s * e.viajes))) };
})();

// ---------- saturación y velocidad por tramo ----------
const FR = () => (typeof S !== "undefined" && S && S.peak) || "am";
const SAT_ALERT = .85;
const sOf = (esc, k) => CENT[esc].edges.get(k) || 0;
function satX(esc, k, fr = FR()) { return FLEET.K * sOf(esc, k) * E[esc].viajes * FRANJAS[fr].demanda(); }
function satKmh(esc, k, fr = FR()) { return FLEET.v0 / (1 + BPR.a * satX(esc, k, fr) ** BPR.b); }
const satLevel = x => x > SAT_ALERT ? "alta" : x > .6 ? "media" : "baja";
const satColor = x => x > SAT_ALERT ? "#D8101E" : x > .6 ? "#E9B949" : "#1E7F55";
// tiempo en bus de un camino del grafo, tramo a tramo (min)
function bprRide(esc, path, fr = FR()) {
  let t = 0; for (let i = 1; i < path.length; i++) { const k = ekey(path[i - 1], path[i]); t += edgeKm(esc, path[i - 1], path[i]) / satKmh(esc, k, fr) * 60 + extraMin(esc, k, fr); } return t;
}
// desglose de la congestión de un camino (min): semáforos, demanda (estaciones) y trancón en vía (BPR)
function congParts(esc, path, fr = FR()) {
  let sig = 0, dem = 0, via = 0;
  for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], k = ekey(a, b), km = edgeKm(esc, a, b), s = sigMin(esc, k, fr);
    sig += s; dem += extraMin(esc, k, fr) - s; via += km / satKmh(esc, k, fr) * 60 - km / FLEET.v0 * 60; }
  return { sig, dem, via, tot: sig + dem + via };
}
function freeRide(esc, path) { let km = 0; for (let i = 1; i < path.length; i++) km += edgeKm(esc, path[i - 1], path[i]); return km / FLEET.v0 * 60; }

// ---------- recorrido de un bus: polilínea + horario por vértice (llega / sale) ----------
const DWELL_MIN = 20 / 60;   // detención simulada en cada estación (supuesto visual: 20 s)
function mkTimedTrack(esc, P, opts = {}) {
  const pts = [NODE.get(P[0]).xy], seg = [], node = [0];
  for (let i = 1; i < P.length; i++) {
    const k = ekey(P[i - 1], P[i]), q = routePts(esc, [P[i - 1], P[i]]);
    for (let j = 1; j < q.length; j++) { pts.push(q[j]); seg.push(k); }
    node.push(pts.length - 1);
  }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const isNode = new Set(node), arr = [0], dep = [isNode.has(0) ? DWELL_MIN : 0], free = [0];
  // km reales de cada tramo repartidos en proporción a su largo dibujado
  const pxEdge = new Map(); for (let i = 1; i < pts.length; i++) pxEdge.set(seg[i - 1], (pxEdge.get(seg[i - 1]) || 0) + (cum[i] - cum[i - 1]));
  for (let i = 1; i < pts.length; i++) {
    const k = seg[i - 1], [a, b] = k.split("|"), share = (cum[i] - cum[i - 1]) / (pxEdge.get(k) || 1), km = edgeKm(esc, a, b) * share;
    arr.push(dep[i - 1] + km / satKmh(esc, k, opts.fr) * 60 + extraMin(esc, k, opts.fr || FR()) * share); free.push(free[i - 1] + km / FLEET.v0 * 60 + (isNode.has(i - 1) ? DWELL_MIN : 0));
    dep.push(arr[i] + (isNode.has(i) && i < pts.length - 1 ? DWELL_MIN : 0));
  }
  const eje = pts.map(p => EJE_XY.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < EJE_R));
  return { pts, cum, len: cum[cum.length - 1], seg, arr, dep, free, T: dep[dep.length - 1], eje, esc, ids: P };
}
// posición de un bus a los m minutos de su salida
function trackAt(tr, m) {
  const n = tr.pts.length; if (m >= tr.T) return { i: n - 1, x: tr.pts[n - 1][0], y: tr.pts[n - 1][1], ang: 0, stop: true, k: tr.seg[tr.seg.length - 1], free: tr.free[n - 1] };
  let lo = 0, hi = n - 1; while (lo < hi) { const md = (lo + hi + 1) >> 1; if (tr.arr[md] <= m) lo = md; else hi = md - 1; }
  const i = lo, p = tr.pts[i];
  if (m < tr.dep[i] || i === n - 1) { const q = tr.pts[Math.min(i + 1, n - 1)]; return { i, x: p[0], y: p[1], ang: Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI, stop: true, k: tr.seg[Math.min(i, tr.seg.length - 1)], free: tr.free[i] }; }
  const q = tr.pts[i + 1], u = (m - tr.dep[i]) / ((tr.arr[i + 1] - tr.dep[i]) || 1);
  return { i, x: p[0] + (q[0] - p[0]) * u, y: p[1] + (q[1] - p[1]) * u, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI, stop: false, k: tr.seg[i], free: tr.free[i] + (tr.free[i + 1] - tr.free[i]) * u };
}
// estado operativo: fluido | congestionado (tramo con V/C estimado > 0,85) | retraso (≥ 5 min sobre flujo libre o cierre en su recorrido)
function opState(b, at, m) {
  if (S.fail && b.tr.ids && b.tr.ids.includes(S.fail)) return "retraso";
  if (m - at.free >= 5) return "retraso";
  return satX(b.tr.esc, at.k) > SAT_ALERT ? "congestionado" : "fluido";
}
const ST_COLOR = { fluido: "#1E7F55", congestionado: "#E9A100", retraso: "#D8101E" };
const ST_TXT = { fluido: "fluido", congestionado: "congestionado", retraso: "con retraso" };

// ---------- adaptador GTFS-RT ----------
// Acepta entidades ya simplificadas {lat, lon, trip_id, route_id, id?, speed?, delay?} o FeedEntity de GTFS-RT
// ({ vehicle: { position: {latitude, longitude, speed}, trip: {trip_id, route_id}, vehicle: {id} } }).
// Si no hay entidades válidas, el simulador BPR sigue activo (sin errores de CORS/404 en GitHub Pages).
function ingestGtfsRtFeed(entities) {
  const vs = (entities || []).map((e, i) => {
    const v = e.vehicle && e.vehicle.position ? e.vehicle : null, pos = v ? v.position : e, trip = (v && v.trip) || e;
    const lat = +(pos.lat ?? pos.latitude), lon = +(pos.lon ?? pos.longitude);
    if (!isFinite(lat) || !isFinite(lon) || !lat) return null;
    return { id: String((v && v.vehicle && (v.vehicle.id || v.vehicle.label)) || e.id || e.vehicle_id || trip.trip_id || "veh" + i), lat, lon, route_id: trip.route_id || "", route: e.route || trip.route_id || "", trip: trip.trip_id, speed: pos.speed ?? e.speed, delay: e.delay, bearing: pos.bearing };
  }).filter(Boolean);
  if (!vs.length) return { ok: false, motivo: "sin vehículos válidos: sigue el simulador BPR" };
  try { liveIngest({ source: "gtfs-rt", ts: Math.round(Date.now() / 1000), vehicles: vs, alerts: [] }); }
  catch (err) { return { ok: false, motivo: String(err.message || err) }; }
  return { ok: LIVE.mode === "live", acoplados: LIVE.counts.snapped, recibidos: vs.length };
}
window.ingestGtfsRtFeed = ingestGtfsRtFeed;

// aspecto de un bus simulado según su estado y el modo de color
function busLook(b) {
  const sat = (typeof lab !== "undefined" && lab.colorMode === "sat");
  b.color = sat ? ST_COLOR[b.st || "fluido"] : b.color0;
  const r = b.g.querySelector("rect"); if (r) r.setAttribute("fill", b.color);
  b.g.classList.toggle("cong", b.st === "congestionado"); b.g.classList.toggle("late", b.st === "retraso");
  if (b.k && b.tr) {
    const [a, c] = b.k.split("|"), x = satX(b.tr.esc, b.k), v = satKmh(b.tr.esc, b.k);
    b.label = b.g.dataset.tip = `${b.base}<em class="lt ${b.st === "retraso" ? "bad" : b.st === "congestionado" ? "mid" : "good"}">${ST_TXT[b.st || "fluido"]}</em><small>${b.stop ? "Detenido en estación · " : ""}Tramo ${esc(short(NODE.get(a).nombre))} – ${esc(short(NODE.get(c).nombre))} · ${fI(v)} km/h · ${DEV ? "V/C estimado " + f2(x) : "saturación estimada de la vía " + fI(x * 100) + " %"}</small>`;
  }
}
// tiempo del viaje en la franja elegida, frente a flujo libre
// desglose de la congestión: semáforos (OSM, con su distancia), pasajeros (demanda en estaciones) y tráfico de buses en la vía
function congHTML(r) {
  const c = congParts(r.esc, r.path), n = r.path.slice(1).reduce((t, id, i) => t + sigSpacings(r.esc, ekey(r.path[i], id)).length, 0);
  if (c.tot < .05) return "";
  return `<small class="cong-parts">🚦 ${f1(c.sig)} min en ${fI(n)} semáforo${n === 1 ? "" : "s"} · 👥 ${f1(c.dem)} min subiendo y bajando pasajeros · 🚌 ${f1(c.via)} min por buses represados en la vía</small>`;
}
function franjaHTML(rt, eb, cl) {
  const r0 = routeInfo(0, rt[0], rt[1], cl), rb = routeInfo(eb, rt[0], rt[1], cl), fr = FR();
  if (!r0 && !rb) return "";
  const row = (t, r) => r ? `<li><b>${esc(t)}</b> <span class="num">${fI(tripMin(r))} min</span> <small>sin trancón ${fI(freeRide(r.esc, r.path) + r.transfers * TRANSFER_MIN)} min · +${fI(bprRide(r.esc, r.path) - freeRide(r.esc, r.path))} min por congestión</small>${congHTML(r)}</li>` : "";
  return `<div class="franja-box"><b>⏱ ${esc(FRANJAS[fr].u)}${fr === "valle" ? ` · demanda ${fI(FLEET.valle * 100)} % del pico (supuesto)` : ""}</b><ul>${row(escName(0), r0)}${row(escName(eb), rb)}</ul>${DEV ? `<small>BPR tramo a tramo + semáforos de OpenStreetMap (Webster, ciclo ${SEM.C[fr]} s, verde ${fI(SEM.g[fr] * 100)} %, φ = ${f2(SEM.phi)} sin onda verde) + ${SEM.dwell} s por estación a V/C = 1. Calibrado con el tiempo medio oficial (v0 = ${f1(FLEET.v0)} km/h) y para que el viaje medio en pico sume ${CONG_OBJ} min de congestión. Estimación del visor, no salida del modelo.</small>` : `<small>Estimación del visor: semáforos reales de OpenStreetMap y demanda estimada; no es una cifra oficial.</small>`}</div>`;
}
