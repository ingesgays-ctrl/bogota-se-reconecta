// =====================================================================
// Datos en vivo (GTFS Realtime de TransMilenio) + seguir una ruta
// ---------------------------------------------------------------------
// Fuente: https://gis.transmilenio.gov.co/gtfs/{vehiclepos,tripupdate,serviceAlerts}.pb
// El servidor oficial no envía cabeceras CORS, así que el navegador lo lee a través
// del puente de bridge/ (Cloudflare Worker o Node). Transportes admitidos:
//   https://…/vehicles  → consulta periódica (JSON del puente o .pb crudo)
//   https://…/stream    → Server-Sent Events (puente Node)
//   wss://…             → WebSocket (mensajes con el mismo JSON)
// Si no hay puente o el feed falla, el laboratorio sigue con la simulación.
// =====================================================================
const LIVE_DEFAULT = "";   // ← pega aquí la URL del puente desplegado, p. ej. https://tm-gtfsrt-bridge.TU-CUENTA.workers.dev/vehicles
const LIVE_OFFICIAL = "https://gis.transmilenio.gov.co/gtfs/vehiclepos.pb";
const SNAP_MAX_M = 250;            // más lejos que esto de un tramo troncal = bus zonal o fuera de la red: no se dibuja
const LATE_S = 300, SLOW_MS = 2.8; // retraso ≥ 5 min · lento < 10 km/h fuera de estación
var LIVE = {
  url: (() => { const q = new URLSearchParams(location.search).get("live"); if (q === "off") return ""; let s = ""; try { s = localStorage.getItem("tm-live") || ""; } catch (_) { } return q || s || LIVE_DEFAULT || ""; })(),   // sin puente no se consulta el feed oficial (no tiene CORS: solo daría errores en consola)
  mode: "sim",          // "sim" | "live"
  status: "idle",       // idle · connecting · ok · error
  err: "", interval: 15000, timer: 0, es: null, ws: null, fails: 0,
  busMarkers: new Map(),   // id de vehículo → marcador (se reutiliza; nunca se recrea la capa)
  edges: new Map(),        // tramo del grafo → { n, slow, late }
  byRoute: new Map(),      // código de servicio → { n, slow, late, maxDelay }
  alerts: [], ts: 0, recv: 0, counts: { total: 0, snapped: 0 },
  sel: null,               // ruta seleccionada (código de servicio)
};

// ---------- índice espacial de tramos (para acoplar cada GPS al grafo) ----------
const SNAP_CELL = 600 / MPP12;     // celdas de ~600 m
let SNAP_IDX = null;
function snapIndex() {
  if (SNAP_IDX) return SNAP_IDX;
  SNAP_IDX = new Map();
  const put = (cx, cy, s) => { const k = cx + "," + cy; if (!SNAP_IDX.has(k)) SNAP_IDX.set(k, []); SNAP_IDX.get(k).push(s); };
  const seen = new Set();
  G[0].g.forEach((ns, a) => ns.forEach(b => {
    const k = ekey(a, b); if (seen.has(k)) return; seen.add(k);
    const pts = routePts(0, [a, b]); let acc = 0; const L = []; for (let i = 1; i < pts.length; i++) L.push(acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    for (let i = 1; i < pts.length; i++) {
      const s = { k, a: pts[i - 1], b: pts[i], from: a, l0: L[i - 2] || 0, l1: L[i - 1], len: acc };
      const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / SNAP_CELL), x1 = Math.floor(Math.max(s.a[0], s.b[0]) / SNAP_CELL), y0 = Math.floor(Math.min(s.a[1], s.b[1]) / SNAP_CELL), y1 = Math.floor(Math.max(s.a[1], s.b[1]) / SNAP_CELL);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) put(x, y, s);
    }
  }));
  return SNAP_IDX;
}
// proyecta un punto GPS sobre el tramo más cercano; si allowed (Set de tramos) viene, prefiere esos
function snap(lon, lat, allowed) {
  const p = P(lon, lat), idx = snapIndex(), cx = Math.floor(p[0] / SNAP_CELL), cy = Math.floor(p[1] / SNAP_CELL);
  let best = null, bestA = null;
  for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) (idx.get(x + "," + y) || []).forEach(s => {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / L2));
    const x2 = s.a[0] + dx * t, y2 = s.a[1] + dy * t, d = Math.hypot(p[0] - x2, p[1] - y2);
    const c = { x: x2, y: y2, d, k: s.k, from: s.from, u: (s.l0 + (s.l1 - s.l0) * t) / (s.len || 1), ang: Math.atan2(dy, dx) * 180 / Math.PI };
    if (!best || d < best.d) best = c;
    if (allowed && allowed.has(s.k) && (!bestA || d < bestA.d)) bestA = c;
  });
  const lim = SNAP_MAX_M / MPP12, pick = bestA && bestA.d < lim ? bestA : best;
  return pick && pick.d < lim ? pick : null;
}

// ---------- servicios (las 114 rutas del Excel) ----------
const normCod = s => String(s || "").toUpperCase().replace(/[\s\-_.]/g, "");
const SVC_BY = new Map(D.servicios.map(sv => [normCod(sv.cod), sv]));
const svcOf = v => SVC_BY.get(normCod(v.route)) || SVC_BY.get(normCod(v.label)) || SVC_BY.get(normCod(v.route_id)) || null;
const SVC_GEO = new Map();
function svcGeo(cod) {   // camino en el grafo que une las paradas del servicio, en orden
  if (SVC_GEO.has(cod)) return SVC_GEO.get(cod);
  const sv = SVC_BY.get(normCod(cod)); if (!sv) return null;
  const path = [sv.stops[0]];
  for (let i = 1; i < sv.stops.length; i++) { const r = shortest(0, sv.stops[i - 1], sv.stops[i]); if (r) path.push(...r.path.slice(1)); }
  const edges = new Set(); for (let i = 1; i < path.length; i++) edges.add(ekey(path[i - 1], path[i]));
  const tr = [...edges].map(k => EDGE_TR.get(k)).filter(t => t !== undefined);
  const mode2 = tr.length ? tr.sort((a, b) => tr.filter(x => x === b).length - tr.filter(x => x === a).length)[0] : undefined;
  const g = { sv, path, edges, color: mode2 !== undefined ? TRONCAL[mode2].color : "#0B66E4", pts: routePts(0, path) };
  SVC_GEO.set(cod, g); return g;
}

// ---------- conexión ----------
function liveStart() {
  liveStop(); if (!LIVE.url) return;
  LIVE.status = "connecting"; renderLive();
  const u = LIVE.url;
  if (/^wss?:/i.test(u)) {
    try { LIVE.ws = new WebSocket(u); LIVE.ws.onmessage = ev => { try { liveIngest(JSON.parse(ev.data)); } catch (e) { liveFail(e); } }; LIVE.ws.onerror = () => liveFail(new Error("WebSocket sin conexión")); LIVE.ws.onclose = () => { if (sim.on) LIVE.timer = setTimeout(liveStart, 10000); }; }
    catch (e) { liveFail(e); }
  } else if (/\/stream(\?|$)/.test(u) && "EventSource" in window) {
    LIVE.es = new EventSource(u);
    LIVE.es.onmessage = ev => { try { liveIngest(JSON.parse(ev.data)); } catch (e) { liveFail(e); } };
    LIVE.es.addEventListener("error", ev => liveFail(new Error(ev.data ? JSON.parse(ev.data).error : "flujo SSE interrumpido")));
  } else livePoll();
}
function liveStop() { clearTimeout(LIVE.timer); if (LIVE.es) { LIVE.es.close(); LIVE.es = null; } if (LIVE.ws) { LIVE.ws.onclose = null; LIVE.ws.close(); LIVE.ws = null; } }
async function livePoll() {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(LIVE.url + (LIVE.url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store", signal: ctl.signal });
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("json")) { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); liveIngest(j); }
    else { if (!r.ok || ct.includes("html")) throw new Error("HTTP " + r.status); liveIngest(GTFSRT.toLive(GTFSRT.decode(await r.arrayBuffer()))); }
  } catch (e) { liveFail(e.name === "AbortError" ? new Error("sin respuesta en 12 s") : e.message === "Failed to fetch" ? new Error("el servidor no permite la lectura desde el navegador (CORS) o no responde") : e); }
  finally { clearTimeout(to); }
  if (!sim.on) return;
  const wait = document.hidden ? 60000 : LIVE.status === "error" ? Math.min(60000, 15000 * 2 ** Math.min(2, LIVE.fails - 1)) : LIVE.interval;
  LIVE.timer = setTimeout(livePoll, wait);
}
function liveFail(e) {
  LIVE.fails++; LIVE.err = String(e && e.message || e); LIVE.status = "error";
  // tras 2 fallos seguidos (o sin haber tenido datos nunca) se vuelve a la simulación
  if (LIVE.mode === "live" && LIVE.fails >= 2) liveToSim();
  renderLive();
}
function liveToSim() {
  LIVE.mode = "sim"; LIVE.busMarkers.forEach(m => m.g.remove()); LIVE.busMarkers.clear(); LIVE.edges.clear(); liveEdgeClasses();
  if (sim.on) { sim.esc = -1; simBuild(); }
  if (ML.on) mlApply();
}

// ---------- ingesta: actualiza el diccionario busMarkers ----------
function liveIngest(data) {
  const now = performance.now(), vs = data.vehicles || [];
  if (data.error) throw new Error(data.error);
  LIVE.fails = 0; LIVE.err = ""; LIVE.status = "ok"; LIVE.ts = data.ts || Math.round(Date.now() / 1000); LIVE.recv = Date.now();
  LIVE.alerts = data.alerts || [];
  let snapped = 0;
  if (LIVE.mode !== "live") {   // primera tanda útil: se reemplazan los buses simulados
    if (!vs.some(v => snap(v.lon, v.lat))) { LIVE.counts = { total: vs.length, snapped: 0 }; renderLive(); return; }
    LIVE.mode = "live"; lyBus.innerHTML = ""; sim.buses = []; if (cy) cy.$(".bus").remove(); LIVE.busMarkers.clear();
  }
  const dur = Math.min(LIVE.interval * 1.05, 30000);
  vs.forEach(v => {
    const sv = svcOf(v), geo = sv ? svcGeo(sv.cod) : null, sn = snap(v.lon, v.lat, geo && geo.edges);
    let m = LIVE.busMarkers.get(v.id);
    if (!sn) { if (m) m.miss = (m.miss || 0) + 1; return; }
    snapped++;
    if (!m) {
      const g = svgEl("g", { class: "bus live" }, lyBus);
      g.innerHTML = '<circle class="ring" r="11"/><rect x="-7" y="-3.6" width="14" height="7.2" rx="2"/><rect x="3.2" y="-2.6" width="2.6" height="5.2" rx=".8" fill="#fff" opacity=".85"/>';
      m = { id: v.id, g, live: true, x: sn.x, y: sn.y, from: [sn.x, sn.y], to: [sn.x, sn.y], t0: now, t1: now, ang: sn.ang };
      LIVE.busMarkers.set(v.id, m);
    } else {
      const moved = Math.hypot(sn.x - m.x, sn.y - m.y);
      m.from = [m.x, m.y]; m.to = [sn.x, sn.y]; m.t0 = now; m.t1 = now + dur;
      if (moved > .4) m.ang = Math.atan2(sn.y - m.y, sn.x - m.x) * 180 / Math.PI;
    }
    const t = EDGE_TR.get(sn.k), [a, b] = sn.k.split("|"), near = NODE.get(sn.u < .5 ? sn.from : (sn.from === a ? b : a));
    Object.assign(m, { seen: now, miss: 0, v, k: sn.k, u: sn.u, from_id: sn.from, svc: sv ? sv.cod : null, near: near.id,
      color: sv && geo ? geo.color : t !== undefined ? TRONCAL[t].color : "#3E4A53",
      late: v.delay !== undefined && v.delay >= LATE_S,
      slow: (v.speed !== undefined && v.speed < SLOW_MS && v.status !== "STOPPED_AT") || /CONGESTION/.test(v.congestion || "") });
    m.st = m.late ? "retraso" : (m.slow || satX(0, sn.k) > SAT_ALERT) ? "congestionado" : "fluido"; m.color0 = m.color; if (lab.colorMode === "sat") m.color = ST_COLOR[m.st];
    m.g.querySelector("rect").setAttribute("fill", m.color);
    m.g.dataset.tip = m.label = liveLabel(m);
  });
  // los que dejaron de reportar se retiran (sin reconstruir la capa)
  const stale = Math.max(90000, LIVE.interval * 3);
  LIVE.busMarkers.forEach((m, id) => { if (now - m.seen > stale) { m.g.remove(); LIVE.busMarkers.delete(id); } });
  LIVE.counts = { total: vs.length, snapped };
  // estado de tramos y rutas, a partir de los buses acoplados al grafo
  LIVE.edges.clear(); LIVE.byRoute.clear();
  LIVE.busMarkers.forEach(m => {
    const e = LIVE.edges.get(m.k) || { n: 0, slow: 0, late: 0, spd: 0, spdN: 0 }; e.n++; if (m.slow) e.slow++; if (m.late) e.late++; if (m.v.speed !== undefined && m.v.status !== "STOPPED_AT") { e.spd += m.v.speed * 3.6; e.spdN++; } LIVE.edges.set(m.k, e);
    if (m.svc) { const r = LIVE.byRoute.get(m.svc) || { n: 0, slow: 0, late: 0, maxDelay: 0 }; r.n++; if (m.slow) r.slow++; if (m.late) r.late++; r.maxDelay = Math.max(r.maxDelay, m.v.delay || 0); LIVE.byRoute.set(m.svc, r); }
  });
  liveHeadways(); LIVE.busMarkers.forEach(m => m.g.dataset.tip = m.label = liveLabel(m));
  liveEdgeClasses(); liveSyncBuses();
  if (ML.on) mlApply();
  renderLive(); if (mode === "laboratorio") renderTicker(labState());
}
function liveLabel(m) {
  const v = m.v, st = m.late ? `<em class="lt bad">${fI(v.delay / 60)} min de retraso</em>` : m.slow ? '<em class="lt mid">avanza lento</em>' : v.delay !== undefined ? `<em class="lt good">${v.delay <= 60 ? "a tiempo" : fI(v.delay / 60) + " min tarde"}</em>` : "";
  const [a, b] = m.k.split("|");
  const occ = { EMPTY: "vacío", MANY_SEATS_AVAILABLE: "con sillas libres", FEW_SEATS_AVAILABLE: "pocas sillas libres", STANDING_ROOM_ONLY: "solo de pie", CRUSHED_STANDING_ROOM_ONLY: "muy lleno", FULL: "lleno", NOT_ACCEPTING_PASSENGERS: "no recibe pasajeros" }[v.occupancy];
  const gap = m.ahead !== undefined ? ` · siguiente bus de la ruta delante a ~${fI(m.ahead)} min${m.gapFlag === "hueco" ? " (hueco)" : m.gapFlag === "pegado" ? " (van pegados)" : ""}` : "";
  return `<b>${m.svc ? "Ruta " + esc(m.svc) : DEV ? "Ruta " + esc(v.route_id || "sin código") : "Bus troncal"}${DEV ? " · " + esc(v.id) : ""}</b>${st}<small>Cerca de ${esc(short(NODE.get(m.near).nombre))} · tramo ${esc(short(NODE.get(a).nombre))} – ${esc(short(NODE.get(b).nombre))}${v.speed !== undefined ? ` · ${fI(v.speed * 3.6)} km/h` : ""}${occ ? " · " + occ : ""}${gap}</small>`;
}
function liveSyncBuses() {   // el resto del laboratorio (WebGL, seguir bus, clics) lee sim.buses
  sim.buses = [...LIVE.busMarkers.values()];
  sim.buses.forEach(m => { m.g.classList.toggle("late", m.late); m.g.classList.toggle("slow", !m.late && m.slow); m.g.classList.toggle("svc", !!LIVE.sel && m.svc === LIVE.sel); m.g.style.setProperty("--svc", m.color); });
  if (sim.focus && !LIVE.busMarkers.has(sim.focus.id)) sim.focus = null;
}
function liveEdgeClasses() {
  EDGE_EL.forEach((el, k) => { const e = LIVE.mode === "live" && LIVE.edges.get(k); el.classList.toggle("live-slow", !!e && (e.slow >= 2 || (e.n >= 2 && e.slow / e.n >= .5))); });
}

// ---------- intervalos entre buses (huecos y buses pegados) ----------
// Cada bus de una ruta se ubica a lo largo del recorrido de esa ruta; ordenados por sentido, la distancia
// entre buses consecutivos se pasa a minutos con la velocidad real observada en la ruta.
function alongOf(geo, x, y) {
  if (!geo.cum) { geo.cum = [0]; for (let i = 1; i < geo.pts.length; i++) geo.cum.push(geo.cum[i - 1] + Math.hypot(geo.pts[i][0] - geo.pts[i - 1][0], geo.pts[i][1] - geo.pts[i - 1][1])); }
  let best = Infinity, at = 0;
  for (let i = 1; i < geo.pts.length; i++) {
    const a = geo.pts[i - 1], b = geo.pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
    const d = Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); if (d < best) { best = d; at = geo.cum[i - 1] + Math.sqrt(L2) * t; }
  }
  return at;
}
function liveHeadways() {
  LIVE.hw = new Map();
  const groups = new Map();
  LIVE.busMarkers.forEach(m => {
    m.ahead = undefined; m.gapFlag = undefined; if (!m.svc) return;
    const geo = svcGeo(m.svc), al = alongOf(geo, m.to[0], m.to[1]);
    const dir = m.v.dir !== undefined ? m.v.dir : m.along !== undefined && Math.abs(al - m.along) > .3 ? (al > m.along ? 0 : 1) : (m.dirS ?? 0);
    m.along = al; m.dirS = dir;
    const key = m.svc + "|" + dir; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(m);
  });
  groups.forEach((ms, key) => {
    const cod = key.split("|")[0], fwd = key.endsWith("|0");
    const sp = ms.map(m => m.v.speed).filter(v => v !== undefined && v > .5), kmh = sp.length ? sp.reduce((a, b) => a + b, 0) / sp.length * 3.6 : VEL[0];
    ms.sort((a, b) => fwd ? b.along - a.along : a.along - b.along);   // el primero es el que va más adelante
    const gaps = [];
    for (let i = 1; i < ms.length; i++) { const km = Math.abs(ms[i - 1].along - ms[i].along) * MPP12 / 1000, min = km / Math.max(kmh, 5) * 60; ms[i].ahead = min; gaps.push({ min, rear: ms[i], front: ms[i - 1] }); }
    const h = LIVE.hw.get(cod) || { gaps: [], kmh: [] }; h.gaps.push(...gaps); h.kmh.push(kmh); LIVE.hw.set(cod, h);
  });
  LIVE.hw.forEach(h => {
    // intervalo de referencia = promedio (lo que se vería con los buses repartidos parejo)
    h.med = h.gaps.length ? h.gaps.reduce((t, g) => t + g.min, 0) / h.gaps.length : null;
    h.gaps.forEach(g => { if (h.gaps.length >= 2 && h.med) { if (g.min > 1.6 * h.med && g.min > 6) g.rear.gapFlag = g.flag = "hueco"; else if (g.min < .35 * h.med || g.min < 1) g.rear.gapFlag = g.flag = "pegado"; } });
  });
}
// tiempo real del recorrido de una ruta: velocidad observada en cada tramo (o la media de la ruta) frente al modelo
function svcRealHTML(cod) {
  const geo = svcGeo(cod), h = LIVE.hw && LIVE.hw.get(cod), rk = h && h.kmh.length ? h.kmh.reduce((a, b) => a + b, 0) / h.kmh.length : null;
  let km = 0, real = 0, seen = 0;
  for (let i = 1; i < geo.path.length; i++) {
    const a = geo.path[i - 1], b = geo.path[i], k = ekey(a, b), d = edgeKm(0, a, b), e = LIVE.edges.get(k), v = e && e.spdN ? e.spd / e.spdN : rk;
    km += d; if (v) { real += d / Math.max(v, 4) * 60; if (e && e.spdN) seen += d; }
  }
  const model = km / VEL[0] * 60, parts = [];
  if (real) parts.push(`<b>Recorrido completo ahora: ~${fI(real)} min</b> <small>(modelo: ${fI(model)} min · ${f1(km)} km · ${fI(seen / km * 100)} % medido con buses en vía)</small>`);
  if (h && h.med) {
    const hu = h.gaps.filter(g => g.flag === "hueco").sort((a, b) => b.min - a.min)[0], pe = h.gaps.filter(g => g.flag === "pegado").length;
    parts.push(`Pasa un bus cada <b>~${fI(h.med)} min</b>` + (hu ? ` · <span class="bad">hueco de ${fI(hu.min)} min antes de ${esc(short(NODE.get(hu.front.near).nombre))}</span>` : "") + (pe ? ` · <span class="mid">${pe} ${pe === 1 ? "par de buses pegados" : "pares de buses pegados"}</span>` : ""));
  }
  return parts.length ? `<p class="svc-real">${parts.join("<br>")}</p>` : "";
}

// ---------- cuadro a cuadro (interpolación suave entre lecturas) ----------
let liveHudT = 0;
function liveFrame(now) {
  const k = 2 ** (cam.z - Z0);
  LIVE.busMarkers.forEach(m => {
    const u = m.t1 > m.t0 ? Math.max(0, Math.min(1, (now - m.t0) / (m.t1 - m.t0))) : 1, e = u * u * (3 - 2 * u);
    m.x = m.from[0] + (m.to[0] - m.from[0]) * e; m.y = m.from[1] + (m.to[1] - m.from[1]) * e;
    m.g.setAttribute("transform", `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${(1 / k).toFixed(4)}) rotate(${(m.ang || 0).toFixed(0)})`);
  });
  if (ML.on) mlBuses();
  if (now - liveHudT > 1000) {
    liveHudT = now; const n = LIVE.busMarkers.size, late = [...LIVE.busMarkers.values()].filter(m => m.late).length, ago = Math.round((Date.now() - LIVE.recv) / 1000);
    $("#simHud").innerHTML = `Datos reales de TransMilenio · actualizado hace <b class="num">${ago} s</b> · <b class="num">${n}</b> buses en troncales` + (late ? ` · <b class="num" style="color:#FF8A8A">${late}</b> con retraso` : "");
    renderLiveStatus();
  }
  if (follow && sim.focus && sim.focus.x !== undefined && !drag) { cam.cx += (sim.focus.x - cam.cx) * .12; cam.cy += (sim.focus.y - cam.cy) * .12; requestDraw(); }
}

// ---------- simulación: buses de ejemplo de la ruta elegida ----------
function simSvcBuses(add) {
  if (!LIVE.sel) return;
  const geo = svcGeo(LIVE.sel); if (!geo || geo.path.length < 2) return;
  const ida = geo.path, vuelta = [...geo.path].reverse(), nm = id => esc(short(NODE.get(id).nombre));
  [[ida, 0], [vuelta, .5]].forEach(([p, ph]) => {
    const tr = mkTrack(0, p);
    for (let j = 0; j < 2; j++) {
      add(tr, `<b>Ruta ${esc(geo.sv.cod)} · hacia ${nm(p[p.length - 1])}</b><small>Simulación · ${geo.sv.stops.length} paradas · sale de ${nm(p[0])}</small>`, geo.color, (ph + j * .5 + .1) % 1, false, p);
      const b = sim.buses[sim.buses.length - 1]; b.svc = geo.sv.cod; b.g.classList.add("svc"); b.g.style.setProperty("--svc", geo.color);
      b.g.insertAdjacentHTML("afterbegin", '<circle class="ring" r="11"/>');
    }
  });
}

// ---------- ruta seleccionada: trazo animado + ondas en paradas y buses ----------
const lySvc = (() => { const g = svgEl("g", { id: "lySvc" }, lyMk.parentNode); lyMk.parentNode.insertBefore(g, lyMk); return g; })();
const SVC_STOP_LBL = [];
function selectSvc(cod) {
  LIVE.sel = cod || null; lySvc.innerHTML = "";
  SVC_STOP_LBL.forEach(o => o.el.style.display = "none");
  if (LIVE.sel) {
    const geo = svcGeo(LIVE.sel), d = "M" + geo.pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");
    lySvc.style.setProperty("--svc", geo.color);
    lySvc.innerHTML = `<path class="svc-glow" d="${d}"/><path class="svc-line" d="${d}"/><path class="svc-flow" d="${d}"/>`;
    geo.sv.stops.forEach((id, i) => {
      if (!SVC_STOP_LBL[i]) SVC_STOP_LBL[i] = addLbl([0, 0], "pulse svcstop", "<i></i><i></i>", null, 0);
      const o = SVC_STOP_LBL[i]; o.xy = NODE.get(id).xy; o.el.style.display = ""; o.el.style.setProperty("--svc", geo.color);
      o.el.querySelectorAll("i").forEach(x => x.style.animationDelay = (i * .12 % 1.6).toFixed(2) + "s");
    });
    if (lab.view === "map") flyTo(fit(geo.path.map(id => [NODE.get(id).lon, NODE.get(id).lat]), { pitch: cam.pitch, rot: cam.rot, pad: .7 }), 1100);
    if (!sim.on) simToggle(true);
  }
  if (LIVE.mode !== "live" && sim.on) { sim.esc = -1; simBuild(); } else liveSyncBuses();
  if (ML.on) { mlApply(); mlSvcApply(); }
  svcAnimate(); renderLive(); requestDraw();
}
function followSvc() {
  const b = sim.buses.find(x => x.svc && x.svc === LIVE.sel) || null;
  if (!b) return false;
  sim.focus = b; setFollow(true); return true;
}

// ---------- capa WebGL (MapLibre) de la ruta elegida ----------
function mlLiveSetup(m) {
  m.addSource("s-svc", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  m.addSource("s-sat", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  m.addLayer({ id: "ml-sat-pulse", type: "line", source: "s-sat", layout: { "line-cap": "round" }, paint: { "line-color": "#D8101E", "line-width": 9, "line-opacity": .35, "line-blur": 2 } }, "ml-stations");
  m.addLayer({ id: "ml-svc-glow", type: "line", source: "s-svc", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": 16, "line-opacity": .22, "line-blur": 4 } }, "ml-stations");
  m.addLayer({ id: "ml-svc-line", type: "line", source: "s-svc", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": 5 } }, "ml-stations");
  m.addLayer({ id: "ml-svc-flow", type: "line", source: "s-svc", layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 2.4, "line-dasharray": [0, 4, 3] } }, "ml-stations");
  m.addLayer({ id: "ml-bus-ring", type: "circle", source: "live-buses", filter: ["==", ["get", "sv"], 1], paint: { "circle-radius": 8, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": ["get", "c"], "circle-stroke-width": 2.5, "circle-stroke-opacity": .9, "circle-pitch-alignment": "map" } }, "ml-bus");
  m.setPaintProperty("ml-bus", "circle-stroke-color", ["match", ["get", "st"], 2, "#D8101E", 1, "#F2A007", "#ffffff"]);
  m.setPaintProperty("ml-bus", "circle-stroke-width", ["match", ["get", "st"], 0, 1.5, 3]);
  m.setPaintProperty("ml-bus", "circle-radius", ["case", ["==", ["get", "sv"], 1], 6.5, ["==", ["get", "od"], 1], 5.5, 4.5]);
}
function mlSvcApply() {
  [ML.map, ML.mapB].forEach(m => { if (!m || !m.getSource("s-svc")) return; const geo = LIVE.sel && svcGeo(LIVE.sel);
    m.getSource("s-svc").setData({ type: "FeatureCollection", features: geo ? [{ type: "Feature", properties: { c: geo.color }, geometry: { type: "LineString", coordinates: geo.pts.map(unP) } }] : [] });
    const hot = m === ML.map ? [...EDGE_EL].filter(([, el]) => el.classList.contains("sat-hot") && lyRed.style.display !== "none").map(([k]) => { const [a, b] = k.split("|"); return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: roadLL(a, b) || [LL(a), LL(b)] } }; }) : [];
    if (m.getSource("s-sat")) m.getSource("s-sat").setData({ type: "FeatureCollection", features: hot }); ML.hot = hot.length; });
  svcAnimate();
}
const mlBusProps = b => ({ st: b.late || b.st === "retraso" ? 2 : b.slow || b.st === "congestionado" ? 1 : 0, sv: LIVE.sel && b.svc === LIVE.sel ? 1 : 0 });
let svcRaf = 0;
const DASH = [[0, 4, 3], [.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, .5], [3, 4, 0], [0, .5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, .5]];
function svcAnimate() {
  cancelAnimationFrame(svcRaf); if ((!LIVE.sel && !ML.hot) || !ML.on) return;
  let last = -1;
  const step = t => {
    const m = ML.map; if ((!LIVE.sel && !ML.hot) || !m) return;
    if (ML.hot && m.getLayer("ml-sat-pulse")) { const g = .5 + .5 * Math.sin(t / 260); m.setPaintProperty("ml-sat-pulse", "line-opacity", .15 + .45 * g); m.setPaintProperty("ml-sat-pulse", "line-width", 7 + 6 * g); }
    const i = Math.floor(t / 55) % DASH.length;
    if (i !== last && m.getLayer("ml-svc-flow")) { m.setPaintProperty("ml-svc-flow", "line-dasharray", DASH[i]); last = i; }
    const f = (t % 1500) / 1500;
    if (m.getLayer("ml-bus-ring")) { m.setPaintProperty("ml-bus-ring", "circle-radius", 7 + f * 16); m.setPaintProperty("ml-bus-ring", "circle-stroke-opacity", .95 * (1 - f)); }
    svcRaf = requestAnimationFrame(step);
  };
  svcRaf = requestAnimationFrame(step);
}

// ---------- panel "Rutas" ----------
const SVC_LIST = D.servicios.map(sv => ({ sv, txt: norm(`${sv.cod} ${sv.nombre} ${NODE.get(sv.stops[0]).nombre} ${NODE.get(sv.stops[sv.stops.length - 1]).nombre}`) }));
const svcLine = sv => `${short(NODE.get(sv.stops[0]).nombre)} → ${short(NODE.get(sv.stops[sv.stops.length - 1]).nombre)}`;
function svcChip(cod) { const g = svcGeo(cod); return `<span class="svc-chip" style="--c:${g ? g.color : "#6C757D"}">${esc(cod)}</span>`; }
(() => {
  const inp = $("#svcSearch"), list = $("#svcList"); let act = -1, items = [];
  const show = () => {
    const q = norm(inp.value.trim());
    items = SVC_LIST.filter(o => !q || o.txt.includes(q)).sort((a, b) => (norm(a.sv.cod).startsWith(q) ? 0 : 1) - (norm(b.sv.cod).startsWith(q) ? 0 : 1) || a.sv.cod.localeCompare(b.sv.cod, "es", { numeric: true })).slice(0, q ? 30 : 114);
    act = items.length ? 0 : -1;
    list.innerHTML = items.map((o, i) => { const r = LIVE.byRoute.get(o.sv.cod); return `<li role="option" data-i="${i}" class="${i === act ? "act" : ""}"><span>${svcChip(o.sv.cod)} <b>${esc(o.sv.nombre)}</b>${r && LIVE.mode === "live" ? ` <small class="lv">${r.n} en vía${r.late ? ` · ${r.late} con retraso` : ""}</small>` : ""}</span><small>${esc(svcLine(o.sv))} · ${o.sv.stops.length} paradas</small></li>`; }).join("") || '<li class="none">Ninguna ruta coincide</li>';
    list.hidden = false; inp.setAttribute("aria-expanded", "true");
  };
  const pick = i => { const o = items[i]; if (!o) return; inp.value = `${o.sv.cod} · ${o.sv.nombre}`; list.hidden = true; inp.setAttribute("aria-expanded", "false"); selectSvc(o.sv.cod); };
  inp.addEventListener("focus", show); inp.addEventListener("input", show);
  inp.addEventListener("keydown", ev => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); act = Math.max(0, Math.min(items.length - 1, act + (ev.key === "ArrowDown" ? 1 : -1))); list.querySelectorAll("li").forEach((li, i) => li.classList.toggle("act", i === act)); const a = list.querySelector("li.act"); if (a) a.scrollIntoView({ block: "nearest" }); }
    else if (ev.key === "Enter") { ev.preventDefault(); pick(act); } else if (ev.key === "Escape") list.hidden = true;
  });
  list.addEventListener("mousedown", ev => { const li = ev.target.closest("li[data-i]"); if (li) { ev.preventDefault(); pick(+li.dataset.i); } });
  inp.addEventListener("blur", () => setTimeout(() => list.hidden = true, 120));
})();
$("#paneLive").addEventListener("click", ev => {
  const b = ev.target.closest("[data-svc-act],[data-svc]"); if (!b) return;
  if (b.dataset.svc) { $("#svcSearch").value = b.dataset.svc; selectSvc(b.dataset.svc); return; }
  const a = b.dataset.svcAct;
  if (a === "follow") { if (!followSvc()) { $("#svcMsg").textContent = "Todavía no hay buses de esta ruta en la vía. Intenta en unos segundos."; } }
  else if (a === "fit") { const geo = svcGeo(LIVE.sel); setFollow(false); flyTo(fit(geo.path.map(id => [NODE.get(id).lon, NODE.get(id).lat]), { pitch: cam.pitch, rot: cam.rot, pad: .7 }), 900); }
  else if (a === "clear") { $("#svcSearch").value = ""; setFollow(false); selectSvc(null); }
  else if (a === "connect") { const u = $("#liveUrl").value.trim(); LIVE.url = u; try { u ? localStorage.setItem("tm-live", u) : localStorage.removeItem("tm-live"); } catch (_) { } if (sim.on) liveStart(); else simToggle(true); }
});
function renderLiveStatus() {
  const el = $("#liveStatus"); if (!el) return;
  const ago = LIVE.recv ? Math.round((Date.now() - LIVE.recv) / 1000) : 0;
  let h;
  if (LIVE.mode === "live") h = `<span class="dot ok"></span><b>En vivo</b> · datos reales de TransMilenio (GTFS-RT) · hace ${ago} s<br><small>${LIVE.busMarkers.size} buses en troncales${DEV ? ` · ${LIVE.counts.total} en el feed, ${LIVE.counts.total - LIVE.counts.snapped} fuera de la red troncal (> ${SNAP_MAX_M} m)` : ""}${LIVE.status === "error" ? ` · último intento falló: ${esc(LIVE.err)}` : ""}</small>`;
  else if (!sim.on) h = `<span class="dot"></span><b>Buses apagados</b> · toca <i>Simular operación</i> para verlos.`;
  else if (LIVE.status === "connecting") h = `<span class="dot wait"></span><b>Conectando</b> con los datos en vivo…`;
  else h = `<span class="dot sim"></span><b>Simulación</b> · buses de ejemplo sobre la red${LIVE.url ? `<br><small>Los datos en vivo de TransMilenio no están disponibles por ahora${DEV && LIVE.err ? ": " + esc(LIVE.err) : ""}. Se reintenta solo.</small>` : ""}`;
  el.innerHTML = h;
  const badge = $("#liveBadge"); if (badge) badge.innerHTML = `<i></i>${LIVE.mode === "live" ? "EN VIVO · TransMilenio" : "SIMULACIÓN"}`; if (badge) badge.classList.toggle("sim", LIVE.mode !== "live");
}
function renderLive() {
  renderLiveStatus();
  const out = $("#svcOut"); if (!out) return;
  if (!LIVE.sel) out.innerHTML = "";
  else {
    const geo = svcGeo(LIVE.sel), sv = geo.sv, r = LIVE.byRoute.get(sv.cod), al = LIVE.alerts.filter(a => a.routes.some(x => normCod(x) === normCod(sv.cod)));
    const nm = id => esc(NODE.get(id).nombre);
    const now = LIVE.mode === "live" ? (r ? `<b>${r.n}</b> ${r.n === 1 ? "bus" : "buses"} en la vía${r.late ? ` · <span class="bad">${r.late} con retraso (hasta ${fI(r.maxDelay / 60)} min)</span>` : ""}${r.slow ? ` · <span class="mid">${r.slow} avanzando lento</span>` : ""}` : "Ningún bus de esta ruta reporta posición en este momento.") : "Simulación: 4 buses de ejemplo, 2 en cada sentido.";
    out.innerHTML = `<div class="svc-card" style="--c:${geo.color}"><div class="svc-h">${svcChip(sv.cod)}<b>${esc(sv.nombre)}</b></div>
      <p class="svc-od">${nm(sv.stops[0])} → ${nm(sv.stops[sv.stops.length - 1])}</p>
      <p class="svc-now">${now}</p>
      ${LIVE.mode === "live" ? svcRealHTML(sv.cod) : ""}
      ${al.map(a => `<p class="svc-alert">⚠ ${esc(a.header || a.description || "Novedad en la ruta")}</p>`).join("")}
      <div class="svc-btns"><button type="button" class="btn pri" data-svc-act="follow">Seguir un bus</button><button type="button" class="btn" data-svc-act="fit">Ver toda la ruta</button><button type="button" class="btn" data-svc-act="clear">Quitar</button></div>
      <p class="note" id="svcMsg"></p>
      <details class="stops"><summary>Las ${sv.stops.length} paradas</summary><ol>${sv.stops.map(id => `<li>${nm(id)}</li>`).join("")}</ol></details></div>`;
  }
  const lr = $("#liveRoutes"); if (!lr) return;
  if (LIVE.mode !== "live") { lr.innerHTML = ""; return; }
  const bad = [...LIVE.byRoute.entries()].filter(([, r]) => r.late || r.slow).sort((a, b) => b[1].late - a[1].late || b[1].slow - a[1].slow).slice(0, 8);
  const slowE = [...LIVE.edges.entries()].filter(([k]) => EDGE_EL.get(k) && EDGE_EL.get(k).classList.contains("live-slow")).slice(0, 5);
  lr.innerHTML = (bad.length ? `<h4>Rutas con novedades ahora</h4><ul class="lr">${bad.map(([c, r]) => `<li><button type="button" data-svc="${esc(c)}">${svcChip(c)} ${r.late ? `<span class="bad">${r.late} con retraso</span>` : ""} ${r.slow ? `<span class="mid">${r.slow} lentos</span>` : ""}</button></li>`).join("")}</ul>` : "<p class=\"note\">Ninguna ruta reporta retrasos ahora.</p>")
    + (slowE.length ? `<h4>Tramos lentos</h4><ul class="lr">${slowE.map(([k, e]) => { const [a, b] = k.split("|"); return `<li>${esc(short(NODE.get(a).nombre))} – ${esc(short(NODE.get(b).nombre))} <small>${e.slow} de ${e.n} buses lentos</small></li>`; }).join("")}</ul>` : "")
    + (LIVE.alerts.length ? `<h4>Alertas de TransMilenio</h4>${LIVE.alerts.slice(0, 6).map(a => `<p class="svc-alert">⚠ ${esc(a.header || a.description)}${a.routes.length ? ` <small>(${a.routes.map(esc).join(", ")})</small>` : ""}</p>`).join("")}` : "");
}
function liveTickerHTML() {
  if (LIVE.mode !== "live") return "";
  const ms = [...LIVE.busMarkers.values()], late = ms.filter(m => m.late).length, slowE = [...EDGE_EL.values()].filter(el => el.classList.contains("live-slow")).length;
  return `<span class="tk ${late ? "mid" : "good"}"><b>En vivo</b><em>${ms.length} buses</em><span>${late} con retraso${slowE ? ` · ${slowE} tramos lentos` : ""}</span></span>` + LIVE.alerts.slice(0, 2).map(a => `<span class="tk bad"><b>Alerta</b><em>${esc((a.routes[0] || "TM"))}</em><span>${esc((a.header || "").slice(0, 70))}</span></span>`).join("");
}
$("#liveUrl").value = LIVE.url;
renderLive();
