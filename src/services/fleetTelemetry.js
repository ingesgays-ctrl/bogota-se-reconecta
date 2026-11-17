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
const FLEET = (() => {
  const per = E.map((e, i) => { const arr = []; CENT[i].edges.forEach((s, k) => { const [a, b] = k.split("|"); arr.push({ k, s, km: edgeKm(i, a, b) }); }); return arr; });
  const F = (i, K) => { let num = 0, den = 0; per[i].forEach(o => { const w = o.s * o.km, x = K * o.s * E[i].viajes; num += w * (1 + BPR.a * x ** BPR.b); den += w; }); return num / den; };
  const smax0 = Math.max(...per[0].map(o => o.s)) * E[0].viajes;
  let best = null;
  for (let j = 0; j <= 600; j++) {
    const K = (j / 600) * 4 / smax0;                     // x máximo de la red actual entre 0 y 4
    const a = E.map((e, i) => e.longitud * F(i, K) / e.tiempo), c = a.reduce((t, v) => t + v, 0) / a.reduce((t, v) => t + v * v, 0);
    const err = Math.sqrt(a.reduce((t, v) => t + (c * v - 1) ** 2, 0) / a.length);
    if (!best || err < best.err) best = { K, c, err };
  }
  const v0 = 60 / best.c;                                // km/h a flujo libre (calibrada)
  const pred = E.map((e, i) => best.c * e.longitud * F(i, best.K));
  return { K: best.K, v0, err: best.err, pred, per, valle: .5, xmax: E.map((e, i) => Math.max(...per[i].map(o => best.K * o.s * e.viajes))) };
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
  let t = 0; for (let i = 1; i < path.length; i++) { const k = ekey(path[i - 1], path[i]); t += edgeKm(esc, path[i - 1], path[i]) / satKmh(esc, k, fr) * 60; } return t;
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
    arr.push(dep[i - 1] + km / satKmh(esc, k, opts.fr) * 60); free.push(free[i - 1] + km / FLEET.v0 * 60 + (isNode.has(i - 1) ? DWELL_MIN : 0));
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
function franjaHTML(rt, eb, cl) {
  const r0 = routeInfo(0, rt[0], rt[1], cl), rb = routeInfo(eb, rt[0], rt[1], cl), fr = FR();
  if (!r0 && !rb) return "";
  const row = (t, r) => r ? `<li><b>${esc(t)}</b> <span class="num">${fI(tripMin(r))} min</span> <small>sin trancón ${fI(freeRide(r.esc, r.path) + r.transfers * TRANSFER_MIN)} min · +${fI(bprRide(r.esc, r.path) - freeRide(r.esc, r.path))} min por congestión</small></li>` : "";
  return `<div class="franja-box"><b>⏱ ${esc(FRANJAS[fr].u)}${fr === "valle" ? ` · demanda ${fI(FLEET.valle * 100)} % del pico (supuesto)` : ""}</b><ul>${row(escName(0), r0)}${row(escName(eb), rb)}</ul>${DEV ? `<small>BPR tramo a tramo, V/C estimado (calibrado con el tiempo medio oficial; v0 = ${f1(FLEET.v0)} km/h). Estimación del visor, no salida del modelo.</small>` : ""}</div>`;
}
