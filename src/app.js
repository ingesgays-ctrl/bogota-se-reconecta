(() => {
"use strict";
const D = window.DATA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nf = (d = 0) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const fI = n => nf(0).format(n), f1 = n => nf(1).format(n), f2 = n => nf(2).format(n), f3 = n => nf(3).format(n);
const sgn = (n, f = f1) => (n > 0 ? "+" : n < 0 ? "−" : "±") + f(Math.abs(n));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ML = { on: false };   // motor WebGL (MapLibre + OpenFreeMap); se activa solo si carga, si no se usa el motor propio
// ---- modo de lectura: usuario (ciudadano) o desarrollador (técnico) ----
let DEV = false; try { DEV = localStorage.getItem("tm-dev") === "1"; } catch (_) { }
const TX = [
  [/Los 5 corredores periféricos/g, "Las 5 conexiones directas entre barrios"], [/los 5 corredores periféricos/g, "las 5 conexiones directas entre barrios"],
  [/5 corredores periféricos/g, "5 conexiones directas entre barrios"], [/Corredores periféricos/g, "Conexiones directas entre barrios"],
  [/corredores periféricos/g, "conexiones directas entre barrios"], [/corredor periférico/g, "conexión directa entre barrios"],
  [/Explora la red como grafo/g, "Explora la red tú mismo"], [/El anillo punteado/g, "El círculo punteado"], [/de la vista geográfica a la topológica/g, "del mapa real al mapa esquemático"], [/>nodos/g, ">estaciones"],
  [/Tres anillos/g, "Tres conexiones"], [/Los 5 anillos periféricos/g, "Las 5 conexiones entre barrios"], [/los 5 anillos periféricos/g, "las 5 conexiones entre barrios"],
  [/5 anillos periféricos/g, "5 conexiones entre barrios"], [/anillos periféricos/g, "conexiones entre barrios"],
  [/Los 5 anillos/g, "Las 5 conexiones entre barrios"], [/los 5 anillos/g, "las 5 conexiones entre barrios"], [/5 anillos/g, "5 conexiones entre barrios"],
  [/Los anillos/g, "Las conexiones entre barrios"], [/los anillos/g, "las conexiones entre barrios"], [/anillos/g, "conexiones entre barrios"],
  [/el [Bb]ypass transversal/g, "la ruta alterna"], [/[Bb]ypass transversal/g, "ruta alterna"], [/[Ee]l bypass/g, "la ruta alterna"], [/del bypass/g, "de la ruta alterna"], [/al bypass/g, "a la ruta alterna"], [/Bypass/g, "Ruta alterna"], [/bypass/g, "ruta alterna"],
  [/Puentes topológicos/g, "Puntos críticos"], [/puentes topológicos/g, "puntos críticos"], [/puente topológico/g, "punto crítico"],
  [/Centralidad de intermediación/g, "Paso de rutas"], [/centralidad de intermediación/g, "paso de rutas"], [/La centralidad/g, "El paso de rutas"], [/la centralidad/g, "el paso de rutas"],
  [/Centralidad/g, "Paso de rutas"], [/centralidad/g, "paso de rutas"],
  [/los puntos de articulación/g, "las estaciones críticas"], [/puntos de articulación/g, "estaciones críticas"], [/un punto de articulación/g, "una estación crítica"], [/punto de articulación/g, "estación crítica"],
  [/Disposición topológica/g, "Mapa esquemático (estilo plano de Metro)"], [/Disposición geográfica/g, "Mapa real"],
  [/El grafo/g, "La red"], [/el grafo/g, "la red"], [/del grafo/g, "de la red"], [/un grafo/g, "una red"], [/grafo/g, "red"],
  [/ en km \(Dijkstra\)/g, ""], [/ \(Dijkstra\)/g, ""], [/con camino mínimo \(Dijkstra\) /g, ""], [/Dijkstra/g, "ruta más corta"],
  [/modelo IPF con congestión BPR/g, "modelo de viajes con trancón"], [/IPF \+ congestión BPR/g, "modelo de viajes con trancón"], [/con congestión BPR/g, "con trancón"],
  [/congestión BPR/g, "trancón"], [/del modelo BPR/g, "del modelo de trancón"], [/modelo BPR/g, "modelo de trancón"], [/ BPR/g, ""],
  [/aristas/g, "conexiones"], [/arista/g, "conexión"], [/ nodos/g, " estaciones"], [/ nodo/g, " estación"],
  [/(\d) pax\b/g, "$1 pasajeros"], [/Punto de articulación/g, "Estación crítica"], [/Grado en la red/g, "Conexiones directas"], [/pico AM/g, "hora pico de la mañana"], [/Escenario integral/g, "Red completa"], [/escenario integral/g, "red completa"],
];
const tx = h => DEV ? h : TX.reduce((acc, [re, r]) => acc.replace(re, r), h);
function applyModeTexts() { $$("[data-u]").forEach(el => el.innerHTML = DEV ? el.dataset.d : el.dataset.u); }

const COLOR = { C1: "#EF8A17", C2: "#D1495B", C3: "#A23B72", C4: "#6A4C93", C5: "#8C6D31", C6_Av68: "#2747D8" };
const SHORT = { C1: "C1", C2: "C2", C3: "C3", C4: "C4", C5: "C5", C6_Av68: "C6 · Av. 68" };
const PERIF = ["C1", "C2", "C3", "C4", "C5"];
const E = D.escenarios;
const CORR = Object.fromEntries(D.corredores.map(c => [c.id, c]));
const EST = Object.fromEntries(D.estaciones.map(e => [e.id, e]));
const RIC = D.red.ricaurte;
const [CRIT_A, CRIT_B] = D.red.critica;

/* =====================================================================
   1. PROYECCIÓN (Web Mercator, píxeles de zoom 12 relativos a un origen)
   ===================================================================== */
const Z0 = 12, TS = 256;
function merc(lon, lat) {
  const s = TS * 2 ** Z0, sl = Math.sin(lat * Math.PI / 180);
  return [(lon + 180) / 360 * s, (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * s];
}
const ORIGIN = merc(-74.1, 4.65);
const P = (lon, lat) => { const m = merc(lon, lat); return [m[0] - ORIGIN[0], m[1] - ORIGIN[1]]; };
const P_ = P;
const MPP12 = 156543.03392 * Math.cos(4.65 * Math.PI / 180) / 2 ** Z0;   // metros por píxel (z12)
const pathD = pts => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");

/* =====================================================================
   2. MODELO DE GRAFO (nodos actuales + estaciones POT)
   ===================================================================== */
const NODE = new Map();
D.red.nodos.forEach(n => NODE.set(n.id, { ...n, kind: "old", xy: P(n.lon, n.lat), tr: [] }));
D.estaciones.forEach(e => {
  if (e.estado === "Aprobada_Nueva") NODE.set(e.id, { id: e.id, nombre: e.nombre, lon: e.lon, lat: e.lat, kind: "new", est: e, xy: P(e.lon, e.lat) });
  else NODE.get(e.existente).tr.push(e);
});
const ekey = (a, b) => a < b ? a + "|" + b : b + "|" + a;
function buildGraph(corrIds) {
  const g = new Map(); const add = (a, b) => { if (!g.has(a)) g.set(a, new Set()); if (!g.has(b)) g.set(b, new Set()); if (a !== b) { g.get(a).add(b); g.get(b).add(a); } };
  D.red.nodos.forEach(n => g.set(n.id, new Set()));
  D.red.aristas.forEach(([a, b]) => add(a, b));
  const corrEdge = new Map();
  D.corredores.filter(c => corrIds.includes(c.id)).forEach(c => c.path.forEach((p, i) => { if (i) { add(c.path[i - 1], p); const k = ekey(c.path[i - 1], p); if (!corrEdge.has(k)) corrEdge.set(k, c.id); } }));
  return { g, corrEdge };
}
function analyze(g) { // Tarjan iterativo: puentes y puntos de articulación
  const disc = new Map(), low = new Map(), bridges = new Set(), art = new Set(); let t = 0;
  for (const s of g.keys()) {
    if (disc.has(s)) continue;
    disc.set(s, t); low.set(s, t); t++;
    const st = [[s, null, g.get(s)[Symbol.iterator](), 0]];
    while (st.length) {
      const fr = st[st.length - 1], [u, p, it] = fr, nx = it.next();
      if (!nx.done) {
        const v = nx.value; if (v === p) continue;
        if (!disc.has(v)) { disc.set(v, t); low.set(v, t); t++; fr[3]++; st.push([v, u, g.get(v)[Symbol.iterator](), 0]); }
        else low.set(u, Math.min(low.get(u), disc.get(v)));
      } else {
        st.pop();
        if (p !== null) {
          low.set(p, Math.min(low.get(p), low.get(u)));
          if (low.get(u) > disc.get(p)) bridges.add(ekey(p, u));
          if (st.length > 1 && low.get(u) >= disc.get(p)) art.add(p);
        } else if (fr[3] > 1) art.add(u);
      }
    }
  }
  return { bridges, art };
}
function componentsWithout(g, rem) {
  const seen = new Set([rem]), comps = [];
  for (const s of g.keys()) {
    if (seen.has(s)) continue;
    const c = [s]; seen.add(s);
    for (let i = 0; i < c.length; i++) for (const v of g.get(c[i])) if (!seen.has(v)) { seen.add(v); c.push(v); }
    comps.push(c);
  }
  comps.sort((a, b) => b.length - a.length);
  return comps;
}
const G = E.map(e => {
  const { g, corrEdge } = buildGraph(e.corredores);
  const an = analyze(g), comps = componentsWithout(g, RIC);
  const iso = new Set(comps.slice(1).flat());
  let nE = 0; g.forEach(s => nE += s.size); nE /= 2;
  return { g, corrEdge, ...an, comps, iso, nV: g.size, nE, ok: an.bridges.size === e.puentes };
});
const GRAPH_OK = G.every(x => x.ok);
// falla de cualquier estación (con caché)
const FAIL_CACHE = new Map();
function failInfo(esc, id) {
  if (!id) return null;
  const k = esc + "|" + id; if (FAIL_CACHE.has(k)) return FAIL_CACHE.get(k);
  const comps = componentsWithout(G[esc].g, id), r = { id, comps, iso: new Set(comps.slice(1).flat()) };
  FAIL_CACHE.set(k, r); return r;
}
// centralidad de intermediación ponderada por km (Brandes + Dijkstra)
function hav(a, b) { const R = 6371, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180, dl = (b.lon - a.lon) * Math.PI / 180;
  return 2 * R * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2)); }
function betweenness(g) {
  const V = [...g.keys()], C = new Map(V.map(v => [v, 0])), W8 = new Map(), EC = new Map();
  V.forEach(v => W8.set(v, [...g.get(v)].map(w => [w, hav(NODE.get(v), NODE.get(w))])));
  for (const s of V) {
    const S = [], P = new Map(), sig = new Map(), d = new Map(), done = new Set();
    V.forEach(v => { P.set(v, []); sig.set(v, 0); d.set(v, Infinity); });
    sig.set(s, 1); d.set(s, 0); const Q = [[0, s]];
    while (Q.length) {
      let bi = 0; for (let i = 1; i < Q.length; i++) if (Q[i][0] < Q[bi][0]) bi = i;
      const [dv, v] = Q[bi]; Q[bi] = Q[Q.length - 1]; Q.pop();
      if (done.has(v) || dv > d.get(v)) continue; done.add(v); S.push(v);
      for (const [w, wt] of W8.get(v)) {
        const nd = dv + wt;
        if (nd < d.get(w) - 1e-9) { d.set(w, nd); Q.push([nd, w]); sig.set(w, sig.get(v)); P.set(w, [v]); }
        else if (Math.abs(nd - d.get(w)) < 1e-9) { sig.set(w, sig.get(w) + sig.get(v)); P.get(w).push(v); }
      }
    }
    const delta = new Map(V.map(v => [v, 0]));
    for (let i = S.length - 1; i >= 0; i--) { const w = S[i]; for (const v of P.get(w)) { const c = sig.get(v) / sig.get(w) * (1 + delta.get(w)); delta.set(v, delta.get(v) + c); const kk = ekey(v, w); EC.set(kk, (EC.get(kk) || 0) + c); } if (w !== s) C.set(w, C.get(w) + delta.get(w)); }
  }
  const n = V.length, norm = (n - 1) * (n - 2);
  C.forEach((v, k) => C.set(k, v / norm));
  EC.forEach((v, k) => EC.set(k, v / (n * (n - 1))));
  C.edges = EC;
  return C;
}
const CENT = G.map(x => betweenness(x.g));
const CENT_RANK = CENT.map(c => [...c.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]));
const TOP10 = CENT_RANK[0].slice(0, 10);
const EBMAX = Math.max(...CENT[0].edges.values());
const heatColor = t => { const a = [30, 127, 85], b = [233, 185, 73], c = [216, 16, 30], L = (x, y, u) => Math.round(x + (y - x) * u); const [p, q, u] = t < .5 ? [a, b, t * 2] : [b, c, (t - .5) * 2]; return `rgb(${L(p[0], q[0], u)},${L(p[1], q[1], u)},${L(p[2], q[2], u)})`; };
const byName = nm => [...NODE.values()].find(n => n.nombre === nm)?.id;
const EJE = ["Ricaurte", "Paloquemao", "CAD", "AV. Eldorado", "Avenida Jiménez", "Calle 22", "Calle 26 - Atrio", "Museo del Oro", "San Victorino", "Las Aguas - Centro Colombo Americano"].map(byName).filter(Boolean);
const ejeMean = i => EJE.reduce((s, id) => s + CENT[i].get(id), 0) / EJE.length;
const pctC = v => f1(v * 100) + " %";
// ---- rutas origen → destino ----
const BASE_EDGES = new Set(D.red.aristas.map(([a, b]) => ekey(a, b)));
const VEL = E.map(e => e.longitud / e.tiempo * 60);   // km/h efectiva con congestión (longitud media / tiempo medio BPR del modelo)
const SERV = D.servicios.map(sv => ({ cod: sv.cod, nombre: sv.nombre, idx: new Map(sv.stops.map((id, i) => [id, i])) }));
const CORR_SERV = Object.fromEntries(D.corredores.map(c => [c.id, { cod: SHORT[c.id], nombre: c.nombre, idx: new Map(c.path.map((id, i) => [id, i])), corr: c.id }]));
function edgeKm(esc, a, b) {
  const k = ekey(a, b), d = hav(NODE.get(a), NODE.get(b)), c = G[esc].corrEdge.get(k);
  return c && !BASE_EDGES.has(k) ? d * CORR[c].factor_km : d;
}
function shortest(esc, s, t, avoid) {
  if (avoid && (s === avoid || t === avoid)) return null;
  const g = G[esc].g, dist = new Map([[s, 0]]), prev = new Map(), done = new Set(avoid ? [avoid] : []);
  while (true) {
    let u = null, du = Infinity;
    dist.forEach((d, v) => { if (!done.has(v) && d < du) { du = d; u = v; } });
    if (u === null || u === t) break;
    done.add(u);
    for (const w of g.get(u)) { const nd = du + edgeKm(esc, u, w); if (nd < (dist.get(w) ?? Infinity)) { dist.set(w, nd); prev.set(w, u); } }
  }
  if (!dist.has(t)) return null;
  const path = [t]; while (path[path.length - 1] !== s) path.push(prev.get(path[path.length - 1]));
  return { path: path.reverse(), km: dist.get(t) };
}
function legsOf(esc, P) {
  const svcs = SERV.concat(E[esc].corredores.map(id => CORR_SERV[id])), L = [];
  let i = 0;
  while (i < P.length - 1) {
    let best = i, bs = null;
    for (const sv of svcs) {
      if (!sv.idx.has(P[i])) continue;
      let o = sv.idx.get(P[i]), dir = 0, last = i;
      for (let j = i + 1; j < P.length; j++) {
        if (!sv.idx.has(P[j])) continue;
        const d = sv.idx.get(P[j]) > o ? 1 : -1; if (!dir) dir = d; if (d !== dir) break;
        o = sv.idx.get(P[j]); last = j;
      }
      if (last > best || (last === best && bs && sv.corr && !bs.corr)) { best = last; bs = sv; }
    }
    if (!bs) { best = i + 1; bs = { cod: "—", nombre: "conexión a pie / sin servicio directo" }; }
    L.push({ sv: bs, from: P[i], to: P[best] }); i = best;
  }
  return L;
}
const ROUTE_CACHE = new Map();
function routeInfo(esc, o, d, avoid) {
  const k = `${esc}|${o}|${d}|${avoid || ""}`; if (ROUTE_CACHE.has(k)) return ROUTE_CACHE.get(k);
  const r = shortest(esc, o, d, avoid); if (!r) { ROUTE_CACHE.set(k, null); return null; }
  const legs = legsOf(esc, r.path), eje = r.path.filter(id => EJE.includes(id));
  const out = { ...r, legs, transfers: Math.max(0, legs.length - 1), eje, ride: r.km / VEL[esc] * 60 };
  ROUTE_CACHE.set(k, out); return out;
}
const ROUTE_PRESETS = [["Portal Usme", "Portal 20 de Julio"], ["Portal Suba", "Portal El Dorado - C. C Nuestro Bogotá"], ["Portal Tunal", "Calle 72 - Areandina"], ["Portal 80", "Portal El Dorado - C. C Nuestro Bogotá"], ["Terminal", "Portal Suba"], ["Alquería", "Calle 100 - Marketmedios"]].map(([a, b]) => [byName(a), byName(b)]);
let TRANSFER_MIN = 5;   // supuesto ajustable: minutos por transbordo (espera + caminata)
const tripMin = r => r.ride + r.transfers * TRANSFER_MIN;
const short = n => n.replace(" - C. C Nuestro Bogotá", "").replace(" - Unicervantes", "").replace(" - Marketmedios", "").replace(" - Areandina", "");
const QUICK = [...new Set(["Ricaurte", "Avenida Jiménez", "Calle 72 - Areandina", "Banderas"].map(byName).concat(CENT_RANK[0].filter(id => NODE.get(id).kind === "old").slice(0, 4)))].slice(0, 6);

/* =====================================================================
   3. MOTOR DE MAPA 3D (plano CSS en perspectiva + SVG + columnas)
   ===================================================================== */
const mapEl = $("#map"), camEl = $("#cam"), vec = $("#vec"), world = $("#world"), tilesEl = $("#tiles"), colsEl = $("#cols"), fog = $("#fog");
const cam = { cx: 0, cy: 0, z: 11.3, pitch: 48, rot: -10 };
let W = 800, H = 600, lastK = -1, raf = 0;
/* Mapa base. CARTO exige una API key desde 2026 (sin clave, sus teselas llevan la marca "API KEY REQUIRED").
   Si consigues una clave gratuita en https://carto.com/basemaps/apikey pégala aquí y se usará Positron. */
const CARTO_KEY = "";
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PROVIDERS = [
  ...(CARTO_KEY ? [{ id: "carto", cls: "", max: 20, retina: true, attr: OSM_ATTR + ' © <a href="https://carto.com/attributions">CARTO</a>',
    layers: [(z, x, y) => `https://${"abc"[(x + y) % 3]}.basemaps.cartocdn.com/rastertiles/light_all/${z}/${x}/${y}@2x.png?key=${CARTO_KEY}`] }] : []),
  { id: "esri", cls: "", max: 16, attr: 'Teselas © <a href="https://www.esri.com">Esri</a>, HERE, Garmin, ' + OSM_ATTR,
    layers: [(z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
             (z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/${z}/${y}/${x}`] },
  { id: "osm", cls: "gray", max: 19, attr: OSM_ATTR, layers: [(z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`] },
];
let prov = 0, provLoaded = 0, provErr = 0;
const is3D = () => cam.pitch > 1;

function requestDraw() { if (!raf) raf = requestAnimationFrame(draw); }
function draw() {
  raf = 0;
  if (ML.on) { mlPushCam(); drawHud(); return; }
  const k = 2 ** (cam.z - Z0);
  camEl.style.transform = `rotateX(${cam.pitch}deg) rotateZ(${cam.rot}deg)`;
  const C = Math.min(5200, Math.ceil(Math.max(W, H) * (1.25 + 2.2 * Math.sin(cam.pitch * Math.PI / 180))));
  vec.setAttribute("width", C); vec.setAttribute("height", C);
  vec.style.left = -C / 2 + "px"; vec.style.top = -C / 2 + "px";
  world.setAttribute("transform", `translate(${(C / 2 - cam.cx * k).toFixed(2)} ${(C / 2 - cam.cy * k).toFixed(2)}) scale(${k})`);
  if (k !== lastK) {
    world.style.setProperty("--k", k);
    $$(".mk", world).forEach(m => m.setAttribute("transform", `translate(${m.dataset.x} ${m.dataset.y}) scale(${1 / k})`));
    lastK = k;
  }
  // columnas y etiquetas 3D
  const rr = cam.rot * Math.PI / 180, pp = cam.pitch * Math.PI / 180, cr = Math.cos(rr), sr = Math.sin(rr), cp = Math.cos(pp), sp = Math.sin(pp);
  const PD = 1100, ox = W / 2, oy = H * 0.38, cl = W / 2, ct = H * 0.52;
  for (const o of COLS) {
    const x = (o.xy[0] - cam.cx) * k, y = (o.xy[1] - cam.cy) * k;
    if (o.type === "col") { o.el.style.transform = `translate3d(${x}px,${y}px,0) rotateZ(${-cam.rot}deg) rotateX(-90deg)`; continue; }
    const z = is3D() ? (o.h ? o.h() : 0) + (o.dz || 0) : 0;
    const x1 = x * cr - y * sr, y1 = x * sr + y * cr, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
    const s = PD / (PD - z2), X = ox + (cl + x1 - ox) * s, Y = oy + (ct + y2 - oy) * s;
    const off = z2 > PD * 0.85 || X < -200 || X > W + 200 || Y < -60 || Y > H + 80;
    o.el.style.visibility = off ? "hidden" : "";
    o.el.style.transform = `translate(${X.toFixed(1)}px,${Y.toFixed(1)}px)`;
  }
  colsEl.style.opacity = is3D() ? 1 : 0;
  loadLbl.el.style.display = is3D() ? "" : "none";
  // cortina: recorte en coordenadas del mapa por proyección inversa de la línea de pantalla
  if (S.compare) {
    const Xc = curtain * W;
    const inv = (X, Y) => { const a = X - ox, b = Y - oy, y1 = PD * (b - (ct - oy)) / (cp * PD + b * sp), sc = PD / (PD - y1 * sp), x1 = a / sc - (cl - ox);
      return [cam.cx + (x1 * cr + y1 * sr) / k, cam.cy + (-x1 * sr + y1 * cr) / k]; };
    const poly = (x0, x1) => [inv(x0, 0), inv(x1, 0), inv(x1, H * 1.8), inv(x0, H * 1.8)].map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    $("#polyL").setAttribute("points", poly(-3 * W, Xc)); $("#polyR").setAttribute("points", poly(Xc, 4 * W));
    $("#cmpBar").style.left = Xc + "px";
    const side = o => { const x = (o.xy[0] - cam.cx) * k, y = (o.xy[1] - cam.cy) * k, x1 = x * cr - y * sr, y1 = x * sr + y * cr, sc = PD / (PD - y1 * sp); return ox + (cl + x1 - ox) * sc < Xc ? 0 : 3; };
    const ls = side(loadCol);
    if (loadCol.side !== ls) { loadCol.side = ls; setColH(loadCol, loadH(E[ls].carga)); loadCol.el.classList.toggle("ok", ls === 3); loadLbl.el.innerHTML = loadHTML(E[ls]); }
    COLS.forEach(o => { if (o.est) o.el.style.visibility = side(o) === 3 ? "" : "hidden"; });
    Object.values(CORR_LBL).forEach(o => { if (side(o) === 0) o.el.style.visibility = "hidden"; });
  }
  fog.style.opacity = Math.min(1, cam.pitch / 50);
  drawHud();
  drawTiles(k, C);
}
function drawHud() {
  $("#northArrow").style.transform = `rotate(${cam.rot}deg)`;
  const topIn = mode === "laboratorio" ? ($("#hudTop").offsetHeight + 16) : presenting ? 14 : 40, botIn = mode === "laboratorio" ? 96 : 40;
  $$("#cardinals span").forEach(el => {
    const a = (+el.dataset.a + cam.rot) * Math.PI / 180, hw = el.offsetWidth / 2 + 8, hh = el.offsetHeight / 2 + 4;
    const L = hw, Rr = W - hw - 52, T = topIn + hh, B = H - botIn - hh, dx = Math.sin(a), dy = -Math.cos(a), cx = W / 2, cy2 = H / 2;
    const tx2 = dx > 1e-6 ? (Rr - cx) / dx : dx < -1e-6 ? (L - cx) / dx : Infinity, ty2 = dy > 1e-6 ? (B - cy2) / dy : dy < -1e-6 ? (T - cy2) / dy : Infinity;
    const t = Math.max(0, Math.min(tx2, ty2));
    el.style.transform = `translate(${(cx + dx * t).toFixed(0)}px,${(cy2 + dy * t).toFixed(0)}px) translate(-50%,-50%)`;
  });
  $("#t3d").textContent = is3D() ? "3D" : "2D"; $("#t3d").setAttribute("aria-pressed", is3D());
  const c3 = $("#cam3d"); if (c3) { c3.querySelector("b").textContent = is3D() ? "3D" : "2D"; c3.setAttribute("aria-pressed", is3D()); }
}
// ---- teselas del mapa base (con respaldo automático entre proveedores) ----
const tilePool = new Map();
function drawTiles(k, C) {
  const pv = PROVIDERS[prov];
  if (!pv) { tilesEl.style.display = "none"; return; }
  tilesEl.style.display = "";
  const tz = Math.max(3, Math.min(pv.max, Math.round(cam.z))), sc = 2 ** (cam.z - tz), size = TS * sc;
  const cAbsX = (cam.cx + ORIGIN[0]) * 2 ** (tz - Z0), cAbsY = (cam.cy + ORIGIN[1]) * 2 ** (tz - Z0);
  const half = C / 2 / sc;
  const x0 = Math.floor((cAbsX - half) / TS), x1 = Math.floor((cAbsX + half) / TS), y0 = Math.floor((cAbsY - half) / TS), y1 = Math.floor((cAbsY + half) / TS);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) * pv.layers.length > 700) return;
  const want = new Set();
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) pv.layers.forEach((url, li) => {
    const key = `${prov}/${li}/${tz}/${x}/${y}`; want.add(key);
    let img = tilePool.get(key);
    if (!img) {
      img = new Image(); img.alt = ""; img.decoding = "async"; img.style.zIndex = li;
      const p0 = prov;
      img.onload = () => { if (p0 !== prov) return; if (++provLoaded === 1) onTilesOK(); };
      img.onerror = () => { if (p0 !== prov) return; if (provLoaded === 0 && ++provErr >= 4) nextProvider(); };
      img.src = url(tz, x, y);
      tilesEl.appendChild(img); tilePool.set(key, img);
    }
    img.style.width = img.style.height = size + 0.6 + "px";
    img.style.left = (x * TS - cAbsX) * sc + "px"; img.style.top = (y * TS - cAbsY) * sc + "px";
  });
  for (const [key, img] of tilePool) if (!want.has(key)) { img.remove(); tilePool.delete(key); }
}
function nextProvider() { prov++; provErr = 0; provLoaded = 0; tilesEl.innerHTML = ""; tilePool.clear(); if (!PROVIDERS[prov]) onTilesFail(); else requestDraw(); }
function onTilesOK() { const pv = PROVIDERS[prov]; $("#lyBase").style.display = "none"; tilesEl.className = "tiles " + pv.cls; $("#attrib").innerHTML = pv.attr; }
function onTilesFail() { $("#lyBase").style.display = ""; $("#attrib").innerHTML = 'Mapa simplificado. Para ver las calles abre <a href="https://ingesgays-ctrl.github.io/bogota-se-reconecta/">la versión web completa</a>'; }

function resize() { const r = mapEl.getBoundingClientRect(); W = r.width || 800; H = r.height || 600; requestDraw(); }
new ResizeObserver(resize).observe(mapEl);

// ---- cámara: encuadre y vuelo ----
function fit(pts, opt = {}) {
  let a = [1e9, 1e9, -1e9, -1e9];
  pts.forEach(([lon, lat]) => { const [x, y] = P(lon, lat); a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)]; });
  const pad = opt.pad ?? 0.78, dx = Math.max(a[2] - a[0], 30), dy = Math.max(a[3] - a[1], 30);
  const pitch = opt.pitch ?? 48, rot = opt.rot ?? -10;
  const z = Z0 + Math.log2(Math.min(W * pad / dx, H * pad / dy)) + (pitch > 1 ? 0.18 : 0) + (opt.dz || 0);
  return { cx: (a[0] + a[2]) / 2, cy: (a[1] + a[3]) / 2 + (opt.oy || 0), z: Math.max(10, Math.min(15.5, z)), pitch, rot };
}
let flight = 0;
function flyTo(t, ms = 1500) {
  cancelAnimationFrame(flight);
  if (reduceMotion) ms = 0;
  const s = { ...cam }, t0 = performance.now();
  const ease = x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  const step = now => {
    const u = ms ? Math.min(1, (now - t0) / ms) : 1, e = ease(u);
    for (const k of ["cx", "cy", "z", "pitch", "rot"]) cam[k] = s[k] + (t[k] - s[k]) * e;
    draw(); if (u < 1) flight = requestAnimationFrame(step);
  };
  flight = requestAnimationFrame(step);
}

// ---- interacción ----
let drag = null, moved = false;
const ptrs = new Map();
mapEl.addEventListener("pointerdown", ev => {
  if (ev.pointerType === "mouse" && ev.button > 2) return;
  cancelAnimationFrame(flight);
  ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  drag = { x: ev.clientX, y: ev.clientY, rotate: ev.shiftKey || ev.button === 2 || ev.ctrlKey, d: null };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag.d = Math.hypot(a.x - b.x, a.y - b.y); drag.z = cam.z; }
  moved = false;
});
mapEl.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("pointermove", ev => {
  if (!drag || !ptrs.has(ev.pointerId)) return;
  const prev = ptrs.get(ev.pointerId); const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
  ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 4) { moved = true; mapEl.classList.add("dragging"); hideTip(); }
  if (!moved) return;
  if (ptrs.size === 2 && drag.d) { const [a, b] = [...ptrs.values()]; cam.z = Math.max(10, Math.min(16.5, drag.z + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / drag.d))); requestDraw(); return; }
  if (drag.rotate) { cam.rot += dx * 0.35; cam.pitch = Math.max(0, Math.min(62, cam.pitch - dy * 0.25)); }
  else {
    const k = 2 ** (cam.z - Z0), r = -cam.rot * Math.PI / 180, c = Math.max(0.35, Math.cos(cam.pitch * Math.PI / 180));
    const px = dx, py = dy / c;
    cam.cx -= (px * Math.cos(r) - py * Math.sin(r)) / k; cam.cy -= (px * Math.sin(r) + py * Math.cos(r)) / k;
  }
  requestDraw();
});
const endDrag = ev => { ptrs.delete(ev.pointerId); if (!ptrs.size) { drag = null; mapEl.classList.remove("dragging"); } };
window.addEventListener("pointerup", endDrag); window.addEventListener("pointercancel", endDrag);
mapEl.addEventListener("click", ev => { if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; } else if (ev.target === mapEl || ev.target.closest(".tiles") || ev.target.classList.contains("upl")) { select(null); } }, true);
mapEl.addEventListener("wheel", ev => { ev.preventDefault(); cancelAnimationFrame(flight); cam.z = Math.max(10, Math.min(16.5, cam.z - ev.deltaY * 0.0022)); requestDraw(); }, { passive: false });
const zoomBy = d => flyTo({ ...cam, z: Math.max(10, Math.min(16.5, cam.z + d)) }, 350);
$("#zIn").onclick = () => zoomBy(0.8); $("#zOut").onclick = () => zoomBy(-0.8);
$("#t3d").onclick = () => flyTo({ ...cam, pitch: is3D() ? 0 : 48 }, 700);
$("#rotL").onclick = () => flyTo({ ...cam, rot: cam.rot - 30 }, 500);
$("#rotR").onclick = () => flyTo({ ...cam, rot: cam.rot + 30 }, 500);
$("#north").onclick = () => flyTo({ ...cam, rot: 0 }, 600);

/* =====================================================================
   4. CAPAS DEL MAPA
   ===================================================================== */
// base vectorial (UPL como tierra) + límites UPL
const lyBase = $("#lyBase"), lyUpl = $("#lyUpl"), lyRed = $("#lyRed"), lyCorr = $("#lyCorr"), lyCrit = $("#lyCrit"), lyMk = $("#lyMk"), lyRadio = $("#lyRadio");
const lyRedL = $("#lyRedL"), lyRoute = $("#lyRoute"), lyMkNew = $("#lyMkNew");
D.upl.forEach(u => {
  const d = u.rings.map(r => pathD(r.map(([lon, lat]) => P(lon, lat))) + "Z").join("");
  svgEl("path", { d, class: "basefill" }, lyBase);
  const p = svgEl("path", { d, class: "upl", "fill-rule": "evenodd" }, lyUpl);
  p.dataset.tip = `<b>UPL ${esc(u.nombre)}</b><small>Vocación ${esc(u.vocacion)} · ${fI(u.area_ha)} ha</small>`;
});
// red actual (aristas de la matriz de adyacencia)
const EDGE_EL = new Map(), EDGE_L = new Map();
D.red.aristas.forEach(([a, b]) => {
  const k = ekey(a, b); const el = svgEl("path", { d: pathD([NODE.get(a).xy, NODE.get(b).xy]), class: "edge" + (k === ekey(CRIT_A, CRIT_B) ? " crit" : "") }, lyRed);
  EDGE_EL.set(k, el);
  EDGE_L.set(k, el.cloneNode(true)); lyRedL.appendChild(EDGE_L.get(k));
});
// corredores
const CORR_EL = {};
D.corredores.forEach(c => {
  const g = svgEl("g", { class: "corrg", "data-c": c.id }, lyCorr);
  const d = pathD(c.coords.map(([lon, lat]) => P(lon, lat)));
  const cs = svgEl("path", { d, class: "corr-case", pathLength: 1 }, g);
  const ln = svgEl("path", { d, class: "corr", stroke: COLOR[c.id], pathLength: 1 }, g);
  const hit = svgEl("path", { d, class: "hit" }, g);
  hit.dataset.tip = `<b>${esc(SHORT[c.id])} · ${esc(c.nombre)}</b><small>${f2(c.km_total)} km · ${esc(c.ejes.join(" → "))}</small>`;
  hit.addEventListener("click", () => select({ type: "corr", id: c.id }));
  [cs, ln].forEach(p => { p.style.strokeDasharray = "1 1"; p.style.strokeDashoffset = 1; });
  CORR_EL[c.id] = { g, cs, ln, drawn: false };
});
// marcadores
const MK = new Map();
function marker(id, xy, cls, inner, tip) {
  const g = svgEl("g", { class: "mk " + cls }, cls.startsWith("new") ? lyMkNew : lyMk);
  g.dataset.x = xy[0].toFixed(1); g.dataset.y = xy[1].toFixed(1); g.dataset.id = id; g.dataset.tip = tip;
  g.innerHTML = '<circle class="mkhit" r="9"/>' + inner;
  g.setAttribute("tabindex", "-1");
  g.addEventListener("click", () => select({ type: "node", id }));
  MK.set(id, g); return g;
}
NODE.forEach(n => {
  if (n.kind === "old") {
    const ric = n.id === RIC;
    marker(n.id, n.xy, "old" + (ric ? " ric" : ""),
      ric ? '<circle class="pulse" r="6"/><circle class="s-ric" r="6.5"/>' : '<circle class="s-old" r="3.2"/><rect class="s-tr hidden" x="-5" y="-5" width="10" height="10" transform="rotate(45)"/>',
      `<b>${esc(n.nombre)}</b><small>Estación actual${n.municipio === "Soacha" ? " · Soacha" : ""}${n.tr.length ? " · transbordo POT" : ""}</small>`);
  } else {
    const e = n.est;
    marker(n.id, n.xy, "new", (e.metro ? '<circle class="metro" r="9.5"/>' : "") + '<circle class="s-new" r="5.6"/>',
      `<b>${esc(e.nombre)}</b><small>Estación nueva · ${esc(SHORT[e.corredor])} · UPL ${esc(e.upl)} · densidad ${f3(e.densidad)}${e.metro ? " · Metro" : ""}</small>`);
  }
});
// rutas O→D
const RT = { a: { cs: svgEl("path", { class: "rt-case" }, lyRoute), ln: svgEl("path", { class: "rt rt-a" }, lyRoute) }, c: { cs: svgEl("path", { class: "rt-case" }, lyRoute), ln: svgEl("path", { class: "rt rt-c" }, lyRoute) }, b: { cs: svgEl("path", { class: "rt-case" }, lyRoute), ln: svgEl("path", { class: "rt rt-b" }, lyRoute) } };
const lyHeat = $("#lyHeat"), HEAT_EL = new Map();
E.forEach((e, i) => G[i].g.forEach((set, a) => set.forEach(b => { const k = ekey(a, b); if (!HEAT_EL.has(k)) HEAT_EL.set(k, svgEl("path", { class: "heat", d: routeGeom(i, [a, b]) }, lyHeat)); })));
const setRT = (o, d) => { o.cs.setAttribute("d", d || ""); o.ln.setAttribute("d", d || ""); };
function routeGeom(esc, P) { return pathD(routePts(esc, P)); }
function routePts(esc, P) { // usa la geometría real de los corredores cuando el tramo es de corredor
  const pts = [NODE.get(P[0]).xy];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], k = ekey(a, b), c = G[esc].corrEdge.get(k);
    if (c && !BASE_EDGES.has(k)) {
      const L = CORR[c].coords.map(([lon, lat]) => P_(lon, lat)), A = NODE.get(a).xy, B = NODE.get(b).xy;
      const near = q => L.reduce((bi, p, j) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(L[bi][0] - q[0], L[bi][1] - q[1]) ? j : bi), 0);
      const ia = near(A), ib = near(B), seg = ia <= ib ? L.slice(ia, ib + 1) : L.slice(ib, ia + 1).reverse();
      pts.push(...seg);
    }
    pts.push(NODE.get(b).xy);
  }
  return pts;
}
/* ---- simulación de operación en vivo ----
   Recorridos: pares origen–destino reales por camino más corto (Dijkstra) sobre el grafo del escenario,
   más servicios reales de la hoja Rutas siguiendo su secuencia de paradas. Velocidad: la velocidad
   efectiva con congestión del modelo BPR para el escenario (no hay datos de congestión por tramo). */
const lyBus = $("#lyBus");
const SIM_OD = [["Portal Usme", "Portal 20 de Julio"], ["Portal Suba", "Portal 80"], ["Portal 80", "Portal El Dorado - C. C Nuestro Bogotá"], ["Portal Suba", "Portal El Dorado - C. C Nuestro Bogotá"],
  ["Terminal", "Portal Suba"], ["Portal Tunal", "Portal 20 de Julio"], ["Alquería", "Calle 100 - Marketmedios"], ["Portal Usme", "Portal Tunal"]].map(([a, b]) => [byName(a), byName(b)]);
// Troncales: el orden de paradas_ordenadas.csv, cortado donde dos estaciones seguidas no están conectadas en la matriz
const CHAINS = (() => {
  const adj = new Set(D.red.aristas.map(([a, b]) => ekey(a, b))), out = [[D.red.nodos[0].id]];
  for (let i = 1; i < D.red.nodos.length; i++) { const a = D.red.nodos[i - 1].id, b = D.red.nodos[i].id; if (adj.has(ekey(a, b))) out[out.length - 1].push(b); else out.push([b]); }
  const cen = NODE.get(byName("Avenida Jiménez")).xy, dc = id => Math.hypot(NODE.get(id).xy[0] - cen[0], NODE.get(id).xy[1] - cen[1]);
  return out.filter(c => c.length >= 3).map(c => dc(c[0]) < dc(c[c.length - 1]) ? [...c].reverse() : c);   // orientadas: periferia → centro
})();
const TRONCAL_DEF = [["Portal Tunal", "B · A · H", "Autopista Norte, Caracas y Caracas Sur", "#1F5FAD"], ["Portal Usme", "H", "Caracas Sur (Usme)", "#F07F1D"], ["Portal Suba", "C", "Suba", "#E3A21A"],
  ["Portal 80", "D", "Calle 80", "#7B3F98"], ["Bicentenario", "E", "NQS Central", "#8C5A2B"], ["San Mateo", "G · S", "NQS Sur y Soacha", "#0098C7"], ["Tibanica - Primavera", "F", "Américas", "#C2185B"],
  ["Museo del Oro", "J", "Eje Ambiental", "#7E8F2A"], ["Portal El Dorado - C. C Nuestro Bogotá", "K", "Calle 26", "#5B4FBF"], ["Portal 20 de Julio", "L", "Carrera 10", "#0E8C84"]];
const TRONCAL = CHAINS.map(c => { const d = TRONCAL_DEF.find(t => c.some(id => NODE.get(id).nombre === t[0])); return d ? { letra: d[1], nombre: d[2], color: d[3], ids: c } : { letra: "·", nombre: `${short(NODE.get(c[0]).nombre)} – ${short(NODE.get(c[c.length - 1]).nombre)}`, color: "#6C757D", ids: c }; });
const EDGE_TR = new Map(); TRONCAL.forEach((t, i) => t.ids.forEach((id, j) => { if (j) EDGE_TR.set(ekey(t.ids[j - 1], id), i); }));
const troncalesDe = id => TRONCAL.filter(t => t.ids.includes(id));
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const UPL_OF = new Map(); const uplOf = id => { if (!UPL_OF.has(id)) { const n = NODE.get(id); const u = D.upl.find(u => inRing(n.lon, n.lat, u.rings[0])); UPL_OF.set(id, u ? u.nombre : (n.municipio === "Soacha" ? "Soacha" : "—")); } return UPL_OF.get(id); };
const EJE_XY = EJE.map(id => NODE.get(id).xy), EJE_R = 450 / MPP12;
const sim = { on: false, t: 0, last: 0, esc: -1, buses: [], raf: 0 };
const MIN_PER_SEC = 4;   // 1 segundo en pantalla = 4 minutos reales
function mkTrack(esc, P) {
  const pts = routePts(esc, P), cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const eje = pts.map(p => EJE_XY.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < EJE_R));
  return { pts, cum, len: cum[cum.length - 1], eje };
}
function simBuild() {
  if (LIVE.mode === "live") return;
  const esc2 = S.esc; sim.esc = esc2; sim.peak = S.peak; lyBus.innerHTML = ""; sim.buses = []; if (cy) cy.$(".bus").remove();
  const pxPerMin = VEL[esc2] / 60 * 1000 / MPP12; sim.odEje = 0; sim.odN = 0;
  const add = (tr, label, color, phase, od, ids) => {
    const g = svgEl("g", { class: "bus" + (od ? " od" : "") }, lyBus);
    g.innerHTML = `<rect x="-7" y="-3.6" width="14" height="7.2" rx="2" fill="${color}"/><rect x="3.2" y="-2.6" width="2.6" height="5.2" rx=".8" fill="#fff" opacity=".85"/>`;
    g.dataset.tip = label; if (!sim.focus || sim.focus.g && !sim.focus.g.isConnected) sim.focus = null; sim.buses.push({ g, tr, phase, pxPerMin, od, ids, color, label });
  };
  SIM_OD.forEach(([a, b], i) => [[a, b], [b, a]].forEach(([o, d], j) => {
    const r = routeInfo(esc2, o, d); if (!r) return;
    const usa = r.legs.map(l => l.sv.corr ? `corredor ${SHORT[l.sv.corr]}` : `servicio ${l.sv.cod}`).join(" → ");
    const pasa = r.eje.length ? `pasa por ${r.eje.map(id => NODE.get(id).nombre).join(", ")}` : "no pasa por el eje central";
    const col = r.legs.find(l => l.sv.corr) ? COLOR[r.legs.find(l => l.sv.corr).sv.corr] : "#3E4A53";
    const tr = mkTrack(esc2, r.path); sim.odN++; if (r.eje.length) sim.odEje++;
    for (let k = 0; k < 2; k++) add(tr, `<b>${esc(short(NODE.get(o).nombre))} → ${esc(short(NODE.get(d).nombre))}</b><small>${esc(usa)} · ${esc(pasa)} · ${fI(tripMin(r))} min</small>`, col, (k * 0.5 + i * 0.13 + j * 0.27) % 1, true, r.path);
  }));
  const pm = S.peak === "pm";
  CHAINS.forEach((P, i) => {
    const inb = P, outb = [...P].reverse(), lbl = (Q, sent) => `<b>Troncal ${esc(short(NODE.get(Q[0]).nombre))} → ${esc(short(NODE.get(Q[Q.length - 1]).nombre))}</b><small>${sent} · ${Q.length} paradas en el orden de paradas_ordenadas.csv</small>`;
    const nIn = pm ? 1 : 2, nOut = pm ? 2 : 1;
    for (let k = 0; k < nIn; k++) add(mkTrack(0, inb), lbl(inb, "hacia el centro"), pm ? "#E58A93" : "#D8101E", (i * 0.17 + k / nIn) % 1, false, inb);
    for (let k = 0; k < nOut; k++) add(mkTrack(0, outb), lbl(outb, "hacia los barrios"), pm ? "#D8101E" : "#E58A93", (i * 0.17 + .25 + k / nOut) % 1, false, outb);
  });
  simSvcBuses(add);
}
function simFrame(now) {
  if (!sim.on) return;
  if (LIVE.mode === "live") { liveFrame(now); sim.raf = requestAnimationFrame(simFrame); return; }
  const dt = sim.last ? Math.min(.1, (now - sim.last) / 1000) : 0; sim.last = now; sim.t += dt * MIN_PER_SEC;
  if (sim.esc !== S.esc || sim.peak !== S.peak) simBuild();
  const k = 2 ** (cam.z - Z0); let inEje = 0, odEje = 0, nOd = 0;
  const inGraph = lab.view === "graph" && cy && mode === "laboratorio";
  for (const b of sim.buses) {
    const tr = b.tr, cycle = tr.len / b.pxPerMin + 6;           // minutos por vuelta + 6 min en terminal
    const m = ((sim.t / cycle + b.phase) % 1) * cycle, d = Math.min(tr.len, m * b.pxPerMin);
    let i = 1; while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
    const a = tr.pts[i - 1], c = tr.pts[i], seg = tr.cum[i] - tr.cum[i - 1] || 1, u = (d - tr.cum[i - 1]) / seg;
    const x = a[0] + (c[0] - a[0]) * u, y = a[1] + (c[1] - a[1]) * u, ang = Math.atan2(c[1] - a[1], c[0] - a[0]) * 180 / Math.PI;
    b.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(1 / k).toFixed(4)}) rotate(${ang.toFixed(0)})`); b.x = x; b.y = y;
    const e2 = tr.eje[i] || tr.eje[i - 1]; if (e2) inEje++;
    if (inGraph && b.ids) {   // misma posición sobre el esquema del grafo
      if (!b.gc) { b.gc = [0]; for (let j = 1; j < b.ids.length; j++) b.gc.push(b.gc[j - 1] + hav(NODE.get(b.ids[j - 1]), NODE.get(b.ids[j]))); }
      const f = d / tr.len * b.gc[b.gc.length - 1]; let j = 1; while (j < b.gc.length - 1 && b.gc[j] < f) j++;
      const na = cy.$id(b.ids[j - 1]), nb = cy.$id(b.ids[j]);
      if (na.length && nb.length) {
        const pa = na.position(), pb = nb.position(), uu = Math.max(0, Math.min(1, (f - b.gc[j - 1]) / ((b.gc[j] - b.gc[j - 1]) || 1)));
        if (!b.cn || b.cn.removed()) b.cn = cy.add({ group: "nodes", data: { id: "bus" + sim.buses.indexOf(b), c: b.color, lbl: b.label }, classes: "bus", position: { x: 0, y: 0 } });
        b.cn.position({ x: pa.x + (pb.x - pa.x) * uu, y: pa.y + (pb.y - pa.y) * uu });
      }
    }
    if (b.od) { nOd++; if (e2) odEje++; }
  }
  if (ML.on) mlBuses();
  $("#simHud").innerHTML = (S.peak === "pm" ? "Tarde: más buses saliendo del centro · " : "Mañana: más buses entrando al centro · ") + `Rutas entre bordes que pasan por el centro: <b class="num">${sim.odEje} de ${sim.odN}</b> · buses en el eje central ahora: <b class="num">${inEje}</b>`;
  if (follow && sim.focus && sim.focus.x !== undefined && !drag) { cam.cx += (sim.focus.x - cam.cx) * .12; cam.cy += (sim.focus.y - cam.cy) * .12; requestDraw(); }
  sim.raf = requestAnimationFrame(simFrame);
}
let follow = false;
function simToggle(on = !sim.on) {
  sim.on = on; sim.last = 0;
  $("#simPlay").setAttribute("aria-pressed", on); $("#simPlay").innerHTML = on ? '<span aria-hidden="true">❚❚</span> Pausar simulación' : '<span aria-hidden="true">▶</span> Simular operación en vivo';
  lyBus.style.display = on && S.layers.bus !== false ? "" : "none"; $("#simHud").hidden = !on; $("#liveBadge").hidden = !on;
  if (!on && follow) setFollow(false); if (!on && cy) cy.$(".bus").remove(); sim.buses.forEach(b => b.cn = null);
  if (on) { if (sim.esc !== S.esc) simBuild(); cancelAnimationFrame(sim.raf); sim.raf = requestAnimationFrame(simFrame); liveStart(); }
  else { cancelAnimationFrame(sim.raf); liveStop(); if (LIVE.mode === "live") liveToSim(); }
  renderLive();
}
$("#simPlay").onclick = () => simToggle();
lyBus.addEventListener("click", ev => { const b = ev.target.closest(".bus"); if (b) { ev.stopPropagation(); sim.focus = sim.buses.find(x => x.g === b); const r = b.getBoundingClientRect(); showTip(b.dataset.tip, r.left + r.width / 2, r.top, true); } });
// radio peatonal 500 m
const radio = svgEl("circle", { class: "radio", r: (500 / MPP12).toFixed(2), cx: 0, cy: 0 }, lyRadio); radio.style.display = "none";

// objetos 3D: columnas de densidad, columna de carga, etiquetas
const COLS = [];
function addCol(xy, cls, hPx) { const el = document.createElement("div"); el.className = "col " + cls; colsEl.appendChild(el); const o = { type: "col", el, xy, hv: hPx }; setColH(o, hPx); COLS.push(o); return o; }
function setColH(o, h) { o.hv = h; o.el.style.height = h + "px"; o.el.style.top = -h + "px"; }
const lblsEl = $("#lbls");
function addLbl(xy, cls, html, h, dz) { const el = document.createElement("div"); el.className = "lbl " + cls; el.innerHTML = `<span>${html}</span>`; lblsEl.appendChild(el); const o = { type: "lbl", el, xy, h, dz }; COLS.push(o); return o; }
D.estaciones.forEach(e => {
  const xy = e.estado === "Aprobada_Nueva" ? NODE.get(e.id).xy : NODE.get(e.existente).xy;
  const o = addCol(xy, "dens" + (e.estado === "Aprobada_Nueva" ? "" : " tr"), Math.round(e.densidad * 72));
  o.est = e;
});
const CCOLS = TOP10.map(id => { const o = addCol(NODE.get(id).xy, "cent", 10); o.id = id; o.el.style.opacity = 0; return o; });
const HCOLS = Array.from({ length: 20 }, () => { const o = addCol([0, 0], "heatcol", 10); o.el.style.opacity = 0; return o; });
const critXY = [(NODE.get(CRIT_A).xy[0] + NODE.get(CRIT_B).xy[0]) / 2, (NODE.get(CRIT_A).xy[1] + NODE.get(CRIT_B).xy[1]) / 2];
const loadH = c => Math.round(c / 420);
const loadCol = addCol(critXY, "load", loadH(E[0].carga));
const loadLbl = addLbl(critXY, "load", "", () => loadCol.hv, 6);
const ricLbl = addLbl(NODE.get(RIC).xy, "ric", "Ricaurte", null, 10);
const failLbl = addLbl(NODE.get(RIC).xy, "ric", "", null, 10); failLbl.el.style.display = "none";
const pulseLbl = addLbl([0, 0], "pulse", "<i></i><i></i><i></i>", null, 0); pulseLbl.el.style.display = "none";
const odA = addLbl([0, 0], "od", "", null, 8), odB = addLbl([0, 0], "od", "", null, 8); odA.el.style.display = odB.el.style.display = "none";
const CORR_LBL = {};
D.corredores.forEach(c => {
  const mid = c.coords[Math.floor(c.coords.length * (c.id === "C6_Av68" ? 0.55 : 0.5))];
  const o = addLbl(P(mid[0], mid[1]), "corr-l", esc(SHORT[c.id]), null, 4);
  o.el.firstChild.style.borderLeftColor = COLOR[c.id]; CORR_LBL[c.id] = o;
});
const UPL_LBL = D.upl.map(u => {
  const r = u.rings[0]; let sx = 0, sy = 0; r.forEach(([a, b]) => { sx += a; sy += b; });
  const o = addLbl(P(sx / r.length, sy / r.length), "small", esc(u.nombre), null, 0); o.el.style.display = "none"; return o;
});

// tooltip
const tip = $("#tip"); let tipPinned = false;
function showTip(html, x, y, pin = false) { const r = $("#mapWrap").getBoundingClientRect(); tip.innerHTML = html; tip.style.left = Math.max(150, Math.min(r.width - 150, x - r.left)) + "px"; tip.style.top = (y - r.top) + "px"; tip.classList.add("on"); tipPinned = pin; tip.style.pointerEvents = pin ? "auto" : "none"; }
function hideTip(force) { if (tipPinned && !force) return; tip.classList.remove("on"); tipPinned = false; tip.style.pointerEvents = "none"; }
mapEl.addEventListener("mousemove", ev => { if (drag || tipPinned) return; const t = ev.target.closest("[data-tip]"); if (t) showTip(t.dataset.tip, ev.clientX, ev.clientY); else hideTip(); });
mapEl.addEventListener("mouseleave", () => hideTip());

/* =====================================================================
   5. ESTADO Y APLICACIÓN SOBRE EL MAPA
   ===================================================================== */
const lab = { esc: 3, fail: null, failMode: false, bridges: false, layers: { red: true, per: true, av: true, est: true, col: false, upl: false, cent: false, heat: false, bus: true, base: true }, sel: null, view: "map", route: null, compare: false, peak: "am", colorMode: "corr" };
let S = { ...lab, layers: { ...lab.layers }, only: null, stagger: false };
let mode = "relato", presenting = false, collapsed = matchMedia("(max-width: 820px)").matches;

function visibleCorr(s) {
  const base = s.only || E[s.esc].corredores;
  return base.filter(id => (PERIF.includes(id) ? s.layers.per : s.layers.av));
}
function apply(s = S) {
  S = s;
  const gi = G[s.esc], vc = visibleCorr(s), F = failInfo(s.esc, s.fail), dead = s.fail;
  // corredores (animación de trazado)
  let i = 0;
  D.corredores.forEach(c => {
    const o = CORR_EL[c.id], on = vc.includes(c.id);
    const delay = s.stagger && on && !o.drawn ? (i++) * 0.55 : 0;
    [o.cs, o.ln].forEach(p => { p.style.transitionDelay = delay + "s"; p.style.strokeDashoffset = on ? 0 : 1; });
    o.drawn = on; o.g.style.pointerEvents = on ? "" : "none";
    o.ln.classList.toggle("sel", !!(s.sel && s.sel.type === "corr" && s.sel.id === c.id));
    CORR_LBL[c.id].el.style.opacity = on ? 1 : 0;
  });
  // red actual
  lyRed.style.display = s.layers.red ? "" : "none";
  EDGE_EL.forEach((el, k) => {
    const [a, b] = k.split("|");
    el.classList.toggle("bridge", s.bridges && gi.bridges.has(k));
    el.classList.toggle("iso", !!F && (F.iso.has(a) || F.iso.has(b)) && a !== dead && b !== dead);
    el.classList.toggle("dead", !!F && (a === dead || b === dead));
  });
  // marcadores
  const trOn = new Set(); D.estaciones.forEach(e => { if (e.estado !== "Aprobada_Nueva" && vc.includes(e.corredor)) trOn.add(e.existente); });
  MK.forEach((g, id) => {
    const n = NODE.get(id);
    if (n.kind === "new") g.classList.toggle("hidden", !(s.layers.est && vc.includes(n.est.corredor)));
    else {
      g.classList.toggle("hidden", !s.layers.red && !trOn.has(id) && id !== RIC);
      const isTr = s.layers.est && trOn.has(id), r = g.querySelector(".s-tr");
      if (r) { r.classList.toggle("hidden", !isTr); g.querySelector(".s-old").classList.toggle("hidden", isTr); }
    }
    g.classList.toggle("iso", !!F && F.iso.has(id));
    g.classList.toggle("dead", !!F && id === dead);
    g.classList.toggle("sel", !!(s.sel && s.sel.type === "node" && s.sel.id === id));
  });
  // columnas
  COLS.forEach(o => { if (o.est) o.el.style.opacity = s.layers.col ? 1 : 0; });
  const e = E[s.esc];
  setColH(loadCol, loadH(e.carga));
  loadLbl.el.innerHTML = loadHTML(e);
  ricLbl.el.querySelector("span").textContent = s.fail === RIC ? "Ricaurte · fuera de servicio" : "Ricaurte";
  if (s.fail && s.fail !== RIC) { failLbl.xy = NODE.get(s.fail).xy; failLbl.el.querySelector("span").textContent = NODE.get(s.fail).nombre + " · fuera de servicio"; failLbl.el.style.display = ""; }
  else failLbl.el.style.display = "none";
  $("#lgCent").hidden = !s.layers.cent;
  // ondas sobre la estación elegida
  if (s.sel && s.sel.type === "node" && NODE.get(s.sel.id)) { pulseLbl.xy = NODE.get(s.sel.id).xy; pulseLbl.el.style.display = ""; pulseLbl.el.classList.toggle("dead", s.fail === s.sel.id); }
  else pulseLbl.el.style.display = "none";
  // columnas de centralidad
  CCOLS.forEach(o => { const v = CENT[s.esc].get(o.id) || 0; setColH(o, Math.round(v * 300)); o.el.style.opacity = s.layers.cent ? 1 : 0; });
  // UPL
  lyUpl.style.display = s.layers.upl ? "" : "none";
  UPL_LBL.forEach(o => o.el.style.display = s.layers.upl ? "" : "none");
  // radio 500 m
  if (s.sel && s.sel.type === "node" && NODE.get(s.sel.id).kind === "new" || (s.sel && s.sel.type === "node" && NODE.get(s.sel.id).tr.length)) {
    const xy = NODE.get(s.sel.id).xy; radio.setAttribute("cx", xy[0]); radio.setAttribute("cy", xy[1]); radio.style.display = "";
  } else radio.style.display = "none";
  // color de la red: por troncal o por uso
  const byTr = s.colorMode !== "uso";
  EDGE_EL.forEach((el, k) => { const t = EDGE_TR.get(k); el.style.stroke = byTr && t !== undefined && !el.classList.contains("crit") ? TRONCAL[t].color : ""; el.style.strokeOpacity = byTr && t !== undefined ? ".8" : ""; });
  if (s.colorMode === "uso") s.layers.heat = true;
  lyBus.style.display = sim.on && s.layers.bus !== false ? "" : "none";
  tilesEl.style.visibility = s.layers.base === false ? "hidden" : ""; $("#lyBase").style.visibility = s.layers.base === false ? "hidden" : "";
  if (mode === "laboratorio") renderTicker(s);
  // mapa de calor de tramos
  const ed = CENT[s.esc].edges, hOn = !!s.layers.heat;
  lyHeat.style.display = hOn ? "" : "none"; $("#lgHeat").hidden = !hOn;
  if (hOn) HEAT_EL.forEach((el, k) => { const v = ed.get(k); if (v === undefined) { el.style.display = "none"; return; } const t = Math.min(1, v / EBMAX); el.style.display = ""; el.style.stroke = heatColor(t); el.style.strokeWidth = `calc(${(2 + 8 * t).toFixed(1)}px / var(--k,1))`; });
  const topE = [...ed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  HCOLS.forEach((o, i) => { const [k, v] = topE[i] || []; if (!k || !hOn) { o.el.style.opacity = 0; return; } const [a, b] = k.split("|"), A = NODE.get(a).xy, B = NODE.get(b).xy, t = Math.min(1, v / EBMAX);
    o.xy = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; setColH(o, Math.round(20 + t * 190)); o.el.style.background = `linear-gradient(to top, ${heatColor(t)}, ${heatColor(t).replace("rgb", "rgba").replace(")", ",.55)")})`; o.el.style.opacity = 1; });
  // ruta O→D
  const rt = s.route;
  lyRoute.style.display = rt ? "" : "none"; $("#mapWrap").classList.toggle("routing", !!rt); $("#mapWrap").classList.toggle("closing", !!rt && !!s.fail); odA.el.style.display = odB.el.style.display = rt ? "" : "none";
  if (rt) {
    const eb = s.esc || 3, cl = s.fail, ra = routeInfo(0, rt[0], rt[1]), blocked = !!cl && !!ra && ra.path.includes(cl);
    const rc = blocked ? routeInfo(0, rt[0], rt[1], cl) : null, rb = routeInfo(eb, rt[0], rt[1], cl || undefined);
    setRT(RT.a, ra ? routeGeom(0, ra.path) : ""); RT.a.ln.classList.toggle("blocked", blocked);
    setRT(RT.c, rc ? routeGeom(0, rc.path) : ""); setRT(RT.b, rb ? routeGeom(eb, rb.path) : "");
    odA.xy = NODE.get(rt[0]).xy; odB.xy = NODE.get(rt[1]).xy;
    odA.el.innerHTML = `<span>Origen · ${esc(short(NODE.get(rt[0]).nombre))}</span>`; odB.el.innerHTML = `<span>Destino · ${esc(short(NODE.get(rt[1]).nombre))}</span>`;
  }
  // cortina Red actual | Integral
  const cmp = !!s.compare;
  $("#mapWrap").classList.toggle("comparing", cmp);
  ["lyRed", "lyCorr", "lyMkNew", "lyBus"].forEach(id => cmp ? $("#" + id).setAttribute("clip-path", "url(#clipR)") : $("#" + id).removeAttribute("clip-path"));
  lyRedL.style.display = cmp && s.layers.red ? "" : "none";
  const critEl = EDGE_EL.get(ekey(CRIT_A, CRIT_B));
  critEl.classList.toggle("ok", cmp && s.esc > 0); critEl.style.strokeWidth = cmp ? `calc(${(6 * E[s.esc].carga / E[0].carga).toFixed(2)}px / var(--k,1))` : "";
  if (cmp) {
    EDGE_L.forEach((el, k) => el.classList.toggle("bridge", G[0].bridges.has(k)));
    $("#cmpL").innerHTML = hudHTML(E[0], "Red actual"); $("#cmpR").innerHTML = hudHTML(E[s.esc], E[s.esc].corto);
  } else {
    COLS.forEach(o => { if (o.est) o.el.style.visibility = ""; });
    loadCol.side = null; loadCol.el.classList.remove("ok"); loadLbl.el.innerHTML = loadHTML(e);
  }
  if (ML.on) mlApply();
  requestDraw();
  if (mode === "laboratorio") { renderLabPanels(); if (lab.view === "graph") updateGraph(); }
}
let curtain = 0.5;
const loadHTML = e => `<span>${fI(e.carga)} ${DEV ? "pax" : "pasajeros"}<small>Paloquemao–Ricaurte · ${e.id ? sgn(e.alivio) + " % · " : ""}${S.peak === "pm" ? "pico tarde, salida" : "pico mañana"}</small></span>`;
const hudHTML = (e, t) => `<b>${esc(t)}</b><span><i class="num">${fI(e.carga)}</i> ${DEV ? "pax" : "pasajeros en"} Paloquemao–Ricaurte</span><span><i class="num">${e.puentes}</i> puentes topológicos</span><span><i class="num">${f1(e.vulnerabilidad)} %</i> vulnerabilidad Ricaurte</span>`;

function select(sel) {
  if (mode === "relato") {
    hideTip(true);
    if (!sel) return;
    S.sel = sel; apply(S);
    const html = selSummary(sel) + `<div style="margin-top:6px"><a href="#laboratorio" class="linkbtn" style="color:#9DB4FF" id="tipGo">Abrir ficha completa en el laboratorio</a></div>`;
    const el = sel.type === "node" ? MK.get(sel.id) : CORR_EL[sel.id].ln;
    const r = ML.on ? mlRect(sel) : el.getBoundingClientRect();
    showTip(html, r.left + r.width / 2, r.top, true);
    $("#tipGo").onclick = () => { lab.sel = sel; lab.esc = sel.type === "corr" ? (sel.id === "C6_Av68" ? 2 : 1) : lab.esc; };
    return;
  }
  if (lab.failMode && sel && sel.type === "node") lab.fail = lab.fail === sel.id ? null : sel.id;
  lab.sel = sel; if (sel) { setTab("sta"); openPanel(); } apply(labState());
  if (sel && sel.type === "node" && lab.view === "map" && !lab.compare) { const n = NODE.get(sel.id); flyTo({ ...cam, ...fit([[n.lon, n.lat]], { pitch: cam.pitch, rot: cam.rot }), z: Math.max(cam.z, 14.4) }, 900); }
}
function selSummary(sel) {
  if (sel.type === "corr") { const c = CORR[sel.id]; return `<b>${esc(SHORT[c.id])} · ${esc(c.nombre)}</b><small>${f2(c.km_total)} km (${f2(c.km_nueva)} obra nueva) · ${esc(c.ejes.join(" → "))}</small>`; }
  const n = NODE.get(sel.id);
  if (n.kind === "new") { const e = n.est; return `<b>${esc(e.nombre)}</b><small>UPL ${esc(e.upl)} · densidad POT ${f3(e.densidad)} · Metro: ${e.metro ? "Sí" : "No"}<br>${esc(e.justificacion)}</small>`; }
  return `<b>${esc(n.nombre)}</b><small>${n.tr.length ? "Transbordo POT: " + esc(n.tr.map(t => t.justificacion).join(" · ")) : "Estación actual · " + n.municipio}</small>`;
}
const labState = () => ({ ...lab, layers: { ...lab.layers }, only: null, stagger: false });

/* =====================================================================
   6. RELATO POR CAPÍTULOS
   ===================================================================== */
const [e0, e1, e2, e3] = E;
const nNew = D.estaciones.filter(e => e.estado === "Aprobada_Nueva").length, nTr = D.estaciones.length - nNew;
const perNew = D.estaciones.filter(e => e.estado === "Aprobada_Nueva" && e.corredor !== "C6_Av68");
const avNew = D.estaciones.filter(e => e.corredor === "C6_Av68");
const kmTot = D.corredores.reduce((s, c) => s + c.km_total, 0), kmNew = D.corredores.reduce((s, c) => s + c.km_nueva, 0), kmSh = D.corredores.reduce((s, c) => s + c.km_compartida, 0);
const perUpl = [...new Set(perNew.map(e => e.upl))];
const compName = c => { const has = n => c.some(id => NODE.get(id)?.nombre === n);
  if (has("Banderas") && has("Alquería")) return "NQS Sur y troncal Américas";
  if (has("Banderas")) return "troncal Américas"; if (has("Alquería")) return "NQS Sur y Soacha";
  if (has("Portal Usme") && has("Portal Tunal")) return "Caracas Sur (Tunal y Usme)";
  const p = c.map(id => NODE.get(id)).find(n => n.nombre.startsWith("Portal")); return p ? "rama de " + p.nombre : (c.length === 1 ? NODE.get(c[0]).nombre : "rama de " + NODE.get(c[0]).nombre); };
const isoTxt = gi => gi.comps.slice(1).map(c => `${compName(c)} (${c.length} estaciones)`).join(" y ");
const allPts = [...D.red.nodos.map(n => [n.lon, n.lat]), ...D.corredores.flatMap(c => c.coords)];
const ptsOf = ids => D.corredores.filter(c => ids.includes(c.id)).flatMap(c => c.coords);
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

const ejesHTML = ids => `<ul class="ejes">${ids.map(id => { const c = CORR[id]; return `<li style="--cc:${COLOR[id]}"><header><strong>${esc(SHORT[id])} · ${esc(c.origen)} → ${esc(c.destino)}</strong><span class="num">${f2(c.km_total)} km</span></header><div class="route">${c.ejes.map(x => `<span>${esc(x)}</span>`).join("<em>→</em>")}</div></li>`; }).join("")}</ul>`;
const stat = (v, k, cls = "") => `<div class="stat ${cls}"><span class="v">${v}</span><span class="k">${k}</span></div>`;
const areaCount = (() => { const m = {}; perNew.forEach(e => { const a = (e.area_actividad || "Sin área").replace("Área de Actividad ", "").replace(/ - A$/, ""); m[a] = (m[a] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); })();
const top = [...perNew].sort((a, b) => b.densidad - a.densidad)[0];
const avAreas = Object.entries(avNew.reduce((m, e) => { (m[e.upl] = m[e.upl] || { n: 0, a: e.area_actividad }).n++; return m; }, {}));

const nmC = n => NODE.get(byName(n)), cN = (i, n) => pctC(CENT[i].get(byName(n)));
const dPct = (a, b) => sgn((b - a) / a * 100, f1) + " %";
const isoN = (i, n) => failInfo(i, byName(n)).iso.size;
const JIM = "Avenida Jiménez", ELD = "AV. Eldorado", N75 = "NQS Calle 75";
const centRows = (ids, i) => `<div class="why">${ids.map(id => `<div><span class="num">${f1(CENT[i].get(id) * 100)}</span><span>${esc(NODE.get(id).nombre)}<small>% de los caminos más cortos que pasan por la estación${i ? ` · red actual ${pctC(CENT[0].get(id))}` : ""}</small></span></div>`).join("")}</div>`;
const VIAJE = ROUTE_PRESETS[0];
function routeCam(rt, esc2 = 3) { const ids = routeInfo(0, rt[0], rt[1]).path.concat(routeInfo(esc2, rt[0], rt[1]).path); return fit(ids.map(id => [NODE.get(id).lon, NODE.get(id).lat]), { pitch: 46, rot: -10, pad: .6 }); }
function routeCompareHTML(rt, eb, compact) {
  const a = routeInfo(0, rt[0], rt[1]), b = routeInfo(eb, rt[0], rt[1]), ta = tripMin(a), tb = tripMin(b);
  const eje = r => r.eje.length ? r.eje.map(id => esc(NODE.get(id).nombre)).join(", ") : "ninguno";
  const svc = r => r.legs.map(l => `<span class="svc${l.sv.corr ? " new" : ""}" ${l.sv.corr ? `style="--cc:${COLOR[l.sv.corr]}"` : ""}>${esc(l.sv.cod)}</span>`).join("<em>→</em>");
  return `<div class="big-row">${stat(`${sgn(tb - ta, fI)} min`, `de ${fI(ta)} a ${fI(tb)} min (${sgn((tb - ta) / ta * 100, fI)} %)`, tb < ta ? "good" : "")}${stat(`${f1(a.km)} → ${f1(b.km)} km`, "distancia recorrida", b.km < a.km ? "good" : "")}${stat(`${a.transfers} → ${b.transfers}`, "transbordos", b.transfers < a.transfers ? "good" : "")}${stat(`${a.eje.length} → ${b.eje.length}`, "nodos del eje central atravesados", b.eje.length < a.eje.length ? "good" : "")}</div>
    <div class="rt-cmp"><div><b class="rt-key a">Red actual</b><div class="route">${svc(a)}</div><small>${a.path.length - 1} tramos · eje central: ${eje(a)}</small></div>
    <div><b class="rt-key b">${esc(E[eb].corto)}</b><div class="route">${svc(b)}</div><small>${b.path.length - 1} tramos · eje central: ${eje(b)}</small></div></div>
    ${compact ? "" : ""}<p class="note">Ruta más corta en km (Dijkstra) sobre el grafo de cada escenario. Transbordos: cambios entre los 114 servicios de la hoja Rutas (cada corredor nuevo cuenta como un servicio). Tiempo: km ÷ velocidad efectiva con congestión del modelo BPR (${f1(VEL[0])} km/h en la red actual y ${f1(VEL[eb])} km/h en este escenario), más ${TRANSFER_MIN} min por transbordo (supuesto ajustable en el laboratorio).</p>`;
}
const CH = [
  { id: "inicio", cam: () => fit(allPts, { pitch: 44, rot: -12, pad: .86 }), st: { esc: 3, layers: { col: true } },
    html: `<div class="eyebrow">Expansión troncal · POT Bogotá</div>
      <h1>Bogotá se reconecta</h1>
      <p class="lead">Seis troncales nuevas para que la red de TransMilenio deje de depender de un solo nodo del centro. Este relato explica por qué avenidas pasan, dónde se ubica cada estación y qué cambia en la hora pico de la mañana.</p>
      <div class="big-row">${stat("6", "troncales nuevas: 5 corredores periféricos y el bypass Av. Carrera 68")}${stat(f2(kmTot) + " km", `${f2(kmNew)} km de obra nueva y ${f2(kmSh)} km de operación compartida`)}${stat(nNew, "estaciones nuevas aprobadas")}${stat(nTr, "nodos de integración o transbordo en estaciones actuales")}</div>
      <div class="cta-row"><button class="cta" type="button" data-go="1">Empezar el relato ↓</button><a class="cta ghost" href="#laboratorio">Ir al laboratorio</a></div>` },
  { id: "red", cam: () => fit(D.red.nodos.map(n => [n.lon, n.lat]), { pitch: 40, rot: 0, pad: .9 }), st: { esc: 0, bridges: true, layers: { col: false } },
    html: `<div class="eyebrow"><b>1</b> La red de hoy</div><h2>Una red que es casi un árbol</h2>
      <p>TransMilenio opera hoy ${D.red.nodos.length} estaciones troncales (${D.red.nodos.filter(n => n.municipio === "Bogotá").length} en Bogotá y ${D.red.nodos.filter(n => n.municipio === "Soacha").length} en Soacha) unidas por ${G[0].nE} conexiones directas. Un árbol con ${D.red.nodos.length} nodos tendría ${D.red.nodos.length - 1} aristas; la red actual solo tiene ${G[0].nE - D.red.nodos.length + 1} ciclos independientes.</p>
      <p>Por eso ${fI(e0.puentes)} de sus ${G[0].nE} conexiones son <strong>puentes topológicos</strong>, marcados en naranja: si cualquiera de ellos se interrumpe, la red queda partida en dos.</p>
      <div class="big-row">${stat(fI(e0.puentes), "puentes topológicos (puntos únicos de falla)", "warn")}${stat(f1(e0.tiempo) + " min", "tiempo medio de viaje con congestión")}</div>` },
  { id: "ricaurte", cam: () => fit([...G[0].iso, RIC].map(id => [NODE.get(id).lon, NODE.get(id).lat]), { pitch: 52, rot: -25, pad: .8 }), st: { esc: 0, fail: RIC, layers: { col: false } },
    html: `<div class="eyebrow"><b>2</b> El punto crítico</div><h2>Ricaurte, el nodo que parte la ciudad</h2>
      <p>Ricaurte cruza la NQS con la Calle 13 y la troncal Américas. En el grafo es un punto de articulación: si lo retiramos, la red se divide en ${G[0].comps.length} pedazos y quedan aisladas la ${isoTxt(G[0])}.</p>
      <p>El modelo estima que una falla en Ricaurte desconecta el <strong>${f1(e0.vulnerabilidad)} %</strong> de la demanda de la hora pico. Además, por el tramo vecino Paloquemao–Ricaurte pasan <strong>${fI(e0.carga)} pasajeros</strong> entre las 6:00 y las 9:00 a. m. Es la columna roja del mapa.</p>
      <div class="big-row">${stat(f1(e0.vulnerabilidad) + " %", "de la demanda queda desconectada si falla Ricaurte", "crit")}${stat(fI(e0.carga), "pasajeros en Paloquemao–Ricaurte, pico AM", "crit")}</div>` },
  { id: "eje", cam: () => fit(TOP10.concat(EJE).map(id => [NODE.get(id).lon, NODE.get(id).lat]), { pitch: 56, rot: -18, pad: .62 }), st: { esc: 0, layers: { col: false, cent: true } },
    html: `<div class="eyebrow"><b>3</b> El eje central de transbordos</div><h2>No es solo Ricaurte: todo el centro hace de embudo</h2>
      <p>En una red radial casi todos los viajes entre dos puntos de la ciudad pasan por el mismo eje. Para medirlo usamos la <strong>centralidad de intermediación</strong>: el porcentaje de los caminos más cortos (en km) entre todos los pares de estaciones que atraviesan cada una. Las columnas oscuras del mapa la muestran.</p>
      ${centRows(TOP10.slice(0, 5).concat([byName(JIM)]), 0)}
      <p>El embudo es la NQS central (Ricaurte, Paloquemao, CAD, Av. El Dorado, NQS Calle 75) más la Caracas Centro: Av. Jiménez (${cN(0, JIM)}), Hortúa (${cN(0, "Hortúa")}) y Nariño (${cN(0, "Nariño")}). La centralidad media de los 10 nodos del eje es ${pctC(ejeMean(0))}.</p>
      <p>Varios de esos nodos también son puntos de articulación. Si cae Av. Jiménez quedan aisladas ${isoN(0, JIM)} estaciones; si cae Av. El Dorado, ${isoN(0, ELD)}; si cae NQS Calle 75, ${isoN(0, N75)}. Puedes probar cualquier estación en el laboratorio.</p>
      <p class="note">Calle 76 y Tercer Milenio no están en la matriz de 143 estaciones del proyecto, así que no se pueden medir aquí. La centralidad mide rutas en el grafo, no pasajeros: la única carga en pasajeros del modelo es la del tramo Paloquemao–Ricaurte.</p>` },
  { id: "norte", cam: () => fit(ptsOf(["C1", "C2", "C3"]), { pitch: 50, rot: -20, pad: .82 }), st: { esc: 1, only: ["C1", "C2", "C3"], stagger: true, layers: { col: false } },
    html: `<div class="eyebrow"><b>4</b> Corredores periféricos · norte</div><h2>Tres anillos que conectan portales sin pasar por el centro</h2>
      <p>Los corredores se trazaron con camino mínimo (Dijkstra) sobre la malla vial arterial real del POT. Cada uno une dos portales que hoy solo se comunican a través del tronco central.</p>
      ${ejesHTML(["C1", "C2", "C3"])}
      <p class="note">C3 rodea los Cerros de Suba y la Reserva Thomas van der Hammen por la Calle 153 y la Av. Boyacá, en vez de atravesarlos.</p>` },
  { id: "sur", cam: () => fit(ptsOf(["C4", "C5"]), { pitch: 50, rot: 15, pad: .8 }), st: { esc: 1, only: PERIF, stagger: true, layers: { col: false } },
    html: `<div class="eyebrow"><b>5</b> Corredores periféricos · sur</div><h2>Usme y Tunal ganan una segunda salida</h2>
      <p>En el sur, dos corredores llevan Usme y Tunal hacia la troncal Av. Carrera 10 (Portal 20 de Julio). Juntos forman una malla que duplica las rutas de salida de esas localidades.</p>
      ${ejesHTML(["C4", "C5"])}
      <p>Los 5 corredores suman <strong>${f2(sum(PERIF, id => CORR[id].km_total))} km</strong>: ${f2(sum(PERIF, id => CORR[id].km_nueva))} km de obra nueva y ${f2(sum(PERIF, id => CORR[id].km_compartida))} km sobre carriles exclusivos existentes.</p>` },
  { id: "estaciones", cam: () => fit([...perNew.map(e => [e.lon, e.lat]), ...D.estaciones.filter(e => e.estado !== "Aprobada_Nueva").map(e => [e.lon, e.lat])], { pitch: 55, rot: -8, pad: .85 }), st: { esc: 1, layers: { col: true } },
    html: `<div class="eyebrow"><b>6</b> Justificación POT</div><h2>Por qué cada estación está donde está</h2>
      <p>Se evaluaron estaciones candidatas cada ~950 m, cada una con un radio peatonal de 500 m, contra cuatro capas oficiales del Decreto 555: UPL, Áreas de Actividad, Estructura Ecológica Principal (EEP) y red Metro. Ninguna se descartó por invadir la EEP.</p>
      <p>Resultado: <strong>${perNew.length} estaciones nuevas</strong> en ${perUpl.length} UPL y <strong>${nTr} transbordos</strong> en estaciones actuales. La altura de cada columna es su índice de densidad POT (de ${f3(Math.min(...perNew.map(e => e.densidad)))} a ${f3(Math.max(...perNew.map(e => e.densidad)))}). El anillo punteado indica integración con el Metro a 350 m o menos (${perNew.filter(e => e.metro).length} estaciones).</p>
      <div class="why">${areaCount.map(([a, n]) => `<div><span class="num">${n}</span><span>Área de Actividad ${esc(a)}<small>estaciones nuevas de los corredores periféricos</small></span></div>`).join("")}</div>
      <p>La de mayor densidad es <button class="linkbtn" type="button" data-sel="${top.id}">${esc(top.nombre)}</button> (${f3(top.densidad)}). Toca cualquier estación para ver su ficha.</p>` },
  { id: "giro", cam: () => fit([...G[1].iso, RIC, CRIT_A].map(id => [NODE.get(id).lon, NODE.get(id).lat]).concat(ptsOf(PERIF)), { pitch: 48, rot: -15, pad: .9 }), st: { esc: 1, fail: RIC, layers: { col: false, cent: true } },
    html: `<div class="eyebrow"><b>7</b> Escenario 1 · +5 corredores periféricos</div><h2>Más resiliencia, pero el centro se carga más</h2>
      <p>Los anillos cierran ciclos entre portales y el grafo gana caminos alternativos: los puentes caen de ${e0.puentes} a ${e1.puentes} y la vulnerabilidad de Ricaurte baja de ${f1(e0.vulnerabilidad)} % a ${f1(e1.vulnerabilidad)} %.</p>
      <p>Pero los viajes de la mañana van de la periferia al centro expandido. Los corredores captan ${fI(e1.viajes - e0.viajes)} viajes más, y muchos terminan entrando por el mismo tronco. La carga en Paloquemao–Ricaurte <strong>sube a ${fI(e1.carga)} pasajeros (${sgn(e1.alivio)} %)</strong>.</p>
      <div class="big-row">${stat(`${e0.puentes} → ${e1.puentes}`, "puentes topológicos", "good")}${stat(`${f1(e0.vulnerabilidad)} → ${f1(e1.vulnerabilidad)} %`, "vulnerabilidad Ricaurte", "good")}${stat(sgn(e1.alivio) + " %", `carga Paloquemao–Ricaurte (${fI(e1.carga)} pax)`, "crit")}${stat(`${f1(e0.tiempo)} → ${f1(e1.tiempo)} min`, "tiempo medio con congestión", "good")}</div>
      <p>En el eje central el alivio es pequeño: la centralidad de Ricaurte pasa de ${cN(0, "Ricaurte")} a ${cN(1, "Ricaurte")} y la media del eje de ${pctC(ejeMean(0))} a ${pctC(ejeMean(1))}. Lo que sí cambia es la robustez: si cae Av. Jiménez ya no se aísla ninguna estación (antes eran ${isoN(0, JIM)}), porque C4 y C5 conectan el sur con la Av. Carrera 10.</p>
      <p class="note">Con Ricaurte fuera de servicio sigue aislada la ${isoTxt(G[1])}: ningún corredor periférico la toca.</p>` },
  { id: "av68", cam: () => fit(ptsOf(["C6_Av68"]), { pitch: 54, rot: -30, pad: .78 }), st: { esc: 2, stagger: true, layers: { col: false, cent: true } },
    html: `<div class="eyebrow"><b>8</b> Escenario 2 · bypass transversal</div><h2>La Av. Carrera 68 descarga el tronco central</h2>
      ${ejesHTML(["C6_Av68"])}
      <p>${f2(CORR.C6_Av68.km_total)} km (${f2(CORR.C6_Av68.km_nueva)} de obra nueva) y ${avNew.length} estaciones nuevas, ${avNew.filter(e => e.metro).length} de ellas integradas con el Metro. Corre en paralelo a la NQS y la Caracas y cruza las troncales Américas, Calle 26, Calle 80 y Suba, así que los viajes radiales tienen otra ruta hacia el norte.</p>
      <div class="big-row">${stat(sgn(e2.alivio) + " %", `carga Paloquemao–Ricaurte (${fI(e2.carga)} pax)`, "good")}${stat(f1(e2.vulnerabilidad) + " %", "vulnerabilidad Ricaurte", "good")}${stat(`${cN(0, N75)} → ${cN(2, N75)}`, `centralidad NQS Calle 75 (${dPct(CENT[0].get(byName(N75)), CENT[2].get(byName(N75)))})`, "good")}${stat(`${cN(0, "Ricaurte")} → ${cN(2, "Ricaurte")}`, "centralidad Ricaurte", "good")}</div>
      <p>Es la intervención que más descarga la NQS central: la media del eje baja de ${pctC(ejeMean(0))} a ${pctC(ejeMean(2))}. Pero no protege el sur: si cae Av. Jiménez siguen quedando aisladas ${isoN(2, JIM)} estaciones.</p>
      <div class="why">${avAreas.map(([u, o]) => `<div><span class="num">${o.n}</span><span>UPL ${esc(u)}<small>${esc(o.a)}</small></span></div>`).join("")}</div>
      <p class="note">El Área de Actividad de las 14 estaciones de la Av. 68 se asignó según la UPL donde está cada una, no por cruce espacial con la capa de Áreas de Actividad, que no está en los datos de este visor. Sola, la Av. 68 deja ${e2.puentes} puentes topológicos: la periferia sigue siendo frágil.</p>` },
  { id: "integral", cam: () => fit(allPts, { pitch: 46, rot: -12, pad: .88 }), st: { esc: 3, layers: { col: false, cent: true } },
    html: `<div class="eyebrow"><b>9</b> Escenario 3 · integral</div><h2>Los corredores periféricos y la Av. 68 se complementan</h2>
      <p>Cada intervención resuelve un problema distinto. Los anillos periféricos dan resiliencia y la Av. 68 da descongestión. Juntos logran las dos cosas.</p>
      <div class="eqn">${stat(e1.puentes + " puentes", "Esc. 1 aporta resiliencia")}<span class="op">+</span>${stat(sgn(e2.alivio) + " %", "Esc. 2 aporta descongestión")}<span class="op">=</span><div class="stat int"><span class="v">${e3.puentes} · ${sgn(e3.alivio)} %</span><span class="k">Integral: ${e3.puentes} puentes, ${sgn(e3.alivio)} % de carga y ${f1(e3.vulnerabilidad)} % de vulnerabilidad</span></div></div>
      <p>Sobre el eje central: la centralidad media de sus 10 nodos baja de ${pctC(ejeMean(0))} a ${pctC(ejeMean(3))} (${dPct(ejeMean(0), ejeMean(3))}). Ricaurte pasa de ${cN(0, "Ricaurte")} a ${cN(3, "Ricaurte")} y Av. Jiménez de ${cN(0, JIM)} a ${cN(3, JIM)}. Ninguna falla de Ricaurte, Av. Jiménez, Av. El Dorado o NQS Calle 75 aísla estaciones.</p>
      <p class="note">El peso no desaparece, se reparte: las estaciones de la Caracas norte suben cerca de un punto (Calle 72: ${cN(0, "Calle 72 - Areandina")} → ${cN(3, "Calle 72 - Areandina")}) porque reciben rutas que antes iban por la NQS. Y Banderas sigue siendo crítica: su falla aísla ${isoN(3, "Banderas")} estaciones de la troncal Américas en todos los escenarios.</p>
      <div class="big-row">${stat(`${f1(e0.tiempo)} → ${f1(e3.tiempo)} min`, "tiempo medio con congestión", "good")}${stat("+" + fI(e3.viajes - e0.viajes), `viajes captados en el pico AM (${fI(e3.viajes)} en total)`, "good")}${stat(`${f2(e0.longitud)} → ${f2(e3.longitud)} km`, "longitud media de viaje", "good")}${stat(`${e0.estaciones} → ${e3.estaciones}`, "estaciones activas en Bogotá", "")}</div>` },
  { id: "viaje", cam: () => routeCam(VIAJE), st: { esc: 3, route: VIAJE, layers: { col: false } },
    html: `<div class="eyebrow"><b>10</b> Un viaje cotidiano</div><h2>${esc(short(NODE.get(VIAJE[0]).nombre))} → ${esc(short(NODE.get(VIAJE[1]).nombre))}</h2>
      ${routeCompareHTML(VIAJE, 3, true)}` },
  { id: "explora", cam: () => fit(allPts, { pitch: 30, rot: 0, pad: .9 }), st: { esc: 3, layers: { col: true } },
    html: `<div class="eyebrow"><b>11</b> Tu turno</div><h2>Explora la red como grafo</h2>
      <p>En el laboratorio puedes cambiar de escenario, simular la falla de Ricaurte, ver los puentes topológicos, pasar de la vista geográfica a la topológica y abrir la ficha de cada corredor y estación.</p>
      <p class="note">${GRAPH_OK ? `Verificación: el grafo que calcula esta página reproduce exactamente los puentes topológicos del modelo oficial (${E.map(e => e.puentes).join(", ")}).` : "Aviso: el grafo calculado en esta página no coincide con los puentes oficiales."}</p>
      <div class="cta-row"><a class="cta" href="#laboratorio">Abrir el laboratorio</a><a class="cta ghost" href="#analisis">Ver análisis y datos</a></div>` },
];
const storyInner = $("#storyInner");
let curCh = -1;
const renderStory = () => { storyInner.innerHTML = CH.map((c, i) => `<article class="ch${i === 0 ? " hero" : ""}${i === Math.max(0, curCh) ? " active" : ""}" data-i="${i}">${tx(c.html)}</article>`).join(""); $$(".ch", storyInner).forEach(el => io.observe(el)); };
function enterChapter(i) {
  if (i === curCh || mode !== "relato" || presenting) return; curCh = i;
  $$(".ch", storyInner).forEach((el, j) => el.classList.toggle("active", j === i));
  const c = CH[i], st = c.st;
  hideTip(true);
  apply({ esc: st.esc, fail: st.fail || null, bridges: !!st.bridges, layers: { red: true, per: true, av: true, est: true, upl: false, col: !!st.layers?.col, cent: !!st.layers?.cent }, sel: null, only: st.only || null, stagger: !!st.stagger, view: "map", route: st.route || null, compare: !!st.compare });
  flyTo(c.cam(), 1700);
}
const io = new IntersectionObserver(ents => {
  const vis = ents.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
  if (vis[0]) enterChapter(+vis[0].target.dataset.i);
}, { root: $("#story"), rootMargin: "-38% 0px -38% 0px", threshold: [0, .01] });
renderStory();
storyInner.addEventListener("click", ev => {
  const g = ev.target.closest("[data-go]"); if (g) { $$(".ch", storyInner)[+g.dataset.go].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); }
  const s = ev.target.closest("[data-sel]"); if (s) { const n = NODE.get(s.dataset.sel); flyTo({ ...cam, ...fit([[n.lon, n.lat]], { pitch: 55, rot: cam.rot }), z: 14.2 }, 1200); setTimeout(() => select({ type: "node", id: s.dataset.sel }), 1250); }
});

/* =====================================================================
   7. LABORATORIO
   ===================================================================== */
const DESC = [
  `Red troncal en operación: ${D.red.nodos.length} estaciones (139 en Bogotá y 4 en Soacha) y ${G[0].nE} conexiones. ${e0.puentes} de esas conexiones son puentes topológicos y el eje central de transbordos concentra los caminos más cortos: Ricaurte ${pctC(CENT[0].get(RIC))}, Av. El Dorado ${pctC(CENT[0].get(byName("AV. Eldorado")))}, Av. Jiménez ${pctC(CENT[0].get(byName("Avenida Jiménez")))}.`,
  `Se suman los 5 corredores periféricos (${f2(e1.km)} km). Los puentes bajan a ${e1.puentes} y la vulnerabilidad de Ricaurte a ${f1(e1.vulnerabilidad)} %, pero la carga en Paloquemao–Ricaurte sube ${sgn(e1.alivio)} % porque los viajes pendulares siguen yendo al centro.`,
  `Solo el bypass Av. Carrera 68 (${f2(e2.km)} km). Abre una ruta paralela al tronco central: la carga Paloquemao–Ricaurte baja ${sgn(e2.alivio)} % y la vulnerabilidad de Ricaurte llega a ${f1(e2.vulnerabilidad)} %, aunque quedan ${e2.puentes} puentes.`,
  `Corredores periféricos y Av. 68 (${f2(e3.km)} km). Combina los dos efectos: ${e3.puentes} puentes, ${f1(e3.vulnerabilidad)} % de vulnerabilidad y ${sgn(e3.alivio)} % de carga central.`,
];
const ESC_U = ["Hoy en día", "Solo conexiones entre barrios", "Solo Av. Carrera 68", "Red completa"];
const ESC_UD = ["Casi todas las rutas obligan a pasar por el centro, generando trancones.", "Une los portales por fuera, pero sin la Av. 68 el centro sigue lleno.", "Ayuda a cruzar de sur a norte, pero deja barrios periféricos desconectados.", "Combina las conexiones entre barrios + la Av. 68: menos tiempo y cero colapso."];
const ESC_D = ["Esc. 0 · Red actual", "Esc. 1 · +5 corredores periféricos", "Esc. 2 · +Bypass Av. 68", "Esc. 3 · Integral"];
const escName = i => DEV ? ESC_D[i] : ESC_U[i];
function renderEscList() {
  $("#escList").innerHTML = E.map(e => `<button type="button" class="esc" role="radio" data-e="${e.id}" aria-checked="${e.id === lab.esc}" title="${esc(ESC_UD[e.id])}"><span class="n">${e.id}</span><b>${esc(escName(e.id))}</b></button>`).join("");
  const e = E[lab.esc]; $("#escCap").innerHTML = DEV ? `${esc(ESC_D[e.id])} · ${f2(e.km)} km · ${e.puentes} puentes · P–R ${fI(e.carga)} pax · ${f1(e.tiempo)} min` : esc(ESC_UD[e.id]);
}
renderEscList();
$("#escList").addEventListener("click", ev => { const b = ev.target.closest(".esc"); if (!b) return; lab.esc = +b.dataset.e; apply(labState()); });
$("#failQuick").innerHTML = QUICK.map(id => `<button type="button" class="chip" data-fail="${id}" aria-pressed="false">${esc(NODE.get(id).nombre.replace(" - Centro Colombo Americano", ""))}</button>`).join("");
const norm = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ALL_SORTED = [...NODE.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
function makeAC(input, { onPick, oldOnly = false, onClear }) {
  const list = input.parentElement.querySelector(".ac-list"); let items = [], act = -1;
  const pool = () => ALL_SORTED.filter(n => !oldOnly || n.kind === "old");
  const show = () => {
    const q = norm(input.value.trim());
    const rank = n => { const t = norm(n.nombre); return (t.startsWith(q) ? 0 : t.split(/[\s\-()]+/).some(w => w.startsWith(q.split(" ")[0])) && t.includes(q) ? 1 : 2) * 10 + (n.kind === "new" ? 1 : 0); };
    items = (q ? pool().filter(n => norm(n.nombre).includes(q)).sort((a, b) => rank(a) - rank(b) || a.nombre.length - b.nombre.length) : pool()).slice(0, q ? 12 : 250); act = items.length ? 0 : -1;
    list.innerHTML = items.length ? items.map((n, i) => `<li role="option" data-i="${i}" aria-selected="${i === act}">${esc(n.nombre)}<small>${n.kind === "new" ? "estación nueva · " + esc(SHORT[n.est.corredor]) : n.municipio === "Soacha" ? "Soacha" : "estación actual"}</small></li>`).join("") : '<li class="none">Sin resultados</li>';
    list.hidden = false; input.setAttribute("aria-expanded", "true");
  };
  const hide = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); };
  const pick = i => { const n = items[i]; if (!n) return; input.value = n.nombre; hide(); onPick(n.id); };
  input.addEventListener("focus", show); input.addEventListener("input", () => { show(); if (!input.value && onClear) onClear(); });
  input.addEventListener("keydown", ev => {
    if (list.hidden && ev.key === "ArrowDown") { show(); return; }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { act = (act + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; $$("li", list).forEach((li, i) => li.setAttribute("aria-selected", i === act)); ev.preventDefault(); }
    else if (ev.key === "Enter") { pick(Math.max(0, act)); ev.preventDefault(); }
    else if (ev.key === "Escape") hide();
  });
  list.addEventListener("mousedown", ev => { const li = ev.target.closest("li[data-i]"); if (li) { ev.preventDefault(); pick(+li.dataset.i); } });
  input.addEventListener("blur", () => setTimeout(hide, 120));
  return { set: id => { input.value = id ? NODE.get(id).nombre : ""; } };
}
const acFail2 = makeAC($("#failSearch"), { onPick: id => { lab.fail = id; lab.sel = { type: "node", id }; apply(labState()); setTab("fail"); if (lab.view === "map") flyToFail(); } });
const acSta = makeAC($("#staSearch"), { onPick: id => { const n = NODE.get(id); lab.sel = { type: "node", id }; if (n.kind === "new" && lab.esc === 0) lab.esc = 3; setTab("sta"); apply(labState()); if (lab.view !== "graph") flyTo({ ...cam, ...fit([[n.lon, n.lat]], { pitch: cam.pitch, rot: cam.rot }), z: 14.2 }, 1000); } });
const acFail = makeAC($("#failSel"), { onPick: id => { lab.fail = id; if (!lab.route) lab.sel = { type: "node", id }; apply(labState()); if (lab.view === "map" && !lab.route) flyToFail(); }, onClear: () => { lab.fail = null; apply(labState()); } });
const acSearch = makeAC($("#qSearch"), { onPick: id => { const n = NODE.get(id); lab.sel = { type: "node", id }; setTab("sta"); openPanel(); if (n.kind === "new" && lab.esc === 0) lab.esc = 3; apply(labState()); if (lab.view !== "graph") flyTo({ ...cam, ...fit([[n.lon, n.lat]], { pitch: cam.pitch, rot: cam.rot }), z: 14.2 }, 1000); } });
$("#failQuick").addEventListener("click", ev => { const b = ev.target.closest("[data-fail]"); if (!b) return; const id = b.dataset.fail; lab.fail = lab.fail === id ? null : id; if (lab.fail) lab.sel = { type: "node", id }; apply(labState()); if (lab.fail && lab.view === "map") flyToFail(); });

$("#failMode").onchange = ev => { lab.failMode = ev.target.checked; mapEl.classList.toggle("failmode", lab.failMode); };
$("#btnReset").onclick = () => { lab.fail = null; apply(labState()); };
function flyToFail() { const F = failInfo(lab.esc, lab.fail); const ids = F && F.iso.size ? [...F.iso, lab.fail] : [lab.fail]; flyTo(fit(ids.map(id => [NODE.get(id).lon, NODE.get(id).lat]), { pitch: cam.pitch || 0, rot: cam.rot, pad: .75, dz: ids.length === 1 ? -1.2 : 0 }), 1100); }
$("#tgBridges").onchange = ev => { lab.bridges = ev.target.checked; apply(labState()); };
[["lyRedT", "red"], ["lyPerT", "per"], ["lyAvT", "av"], ["lyEstT", "est"], ["lyColT", "col"], ["lyCentT", "cent"], ["lyHeatT", "heat"], ["lyUplT", "upl"], ["lyBusT", "bus"], ["lyBaseT", "base"]].forEach(([id, k]) => $("#" + id).onchange = ev => { lab.layers[k] = ev.target.checked; apply(labState()); });
$("#vMap").onclick = () => setView("map"); $("#vGraph").onclick = () => setView("graph"); $("#vCmp").onclick = () => setView("cmp");
const OLD_SORTED = [...NODE.values()].filter(n => n.kind === "old").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
const rtSel = { o: null, d: null };
const rtTry = () => { if (rtSel.o && rtSel.d && rtSel.o !== rtSel.d) setRoute([rtSel.o, rtSel.d]); };
const acO = makeAC($("#rtO"), { oldOnly: true, onPick: id => { rtSel.o = id; rtTry(); } }), acD = makeAC($("#rtD"), { oldOnly: true, onPick: id => { rtSel.d = id; rtTry(); } });
$("#routeQuick").innerHTML = ROUTE_PRESETS.map((r, i) => `<button type="button" class="chip" data-rt="${i}" aria-pressed="false">${esc(short(NODE.get(r[0]).nombre).replace("Portal ", ""))} → ${esc(short(NODE.get(r[1]).nombre).replace("Portal ", ""))}</button>`).join("");
function setRoute(rt) {
  if (rt) { setTab("trip"); openPanel(); }
  if (!rt) { rtSel.o = rtSel.d = null; }
  lab.route = rt; lab.sel = null; if (rt && lab.esc === 0) lab.esc = 3;
  apply(labState());
  if (rt && lab.view !== "graph") flyTo(routeCam(rt, lab.esc), 1200);
}
$("#routeQuick").addEventListener("click", ev => { const b = ev.target.closest("[data-rt]"); if (b) setRoute(ROUTE_PRESETS[+b.dataset.rt]); });

$("#rtPen").oninput = ev => { TRANSFER_MIN = +ev.target.value; $("#rtPenV").textContent = TRANSFER_MIN + " min"; renderDetail(); };
$("#rtClear").onclick = () => setRoute(null);
// cortina: arrastre
(() => {
  const bar = $("#cmpBar"); let on = false;
  bar.addEventListener("pointerdown", ev => { on = true; ev.stopPropagation(); bar.setPointerCapture(ev.pointerId); });
  bar.addEventListener("pointermove", ev => { if (!on) return; const r = mapEl.getBoundingClientRect(); curtain = Math.max(.04, Math.min(.96, (ev.clientX - r.left) / r.width)); requestDraw(); });
  bar.addEventListener("pointerup", () => on = false);
  bar.addEventListener("keydown", ev => { if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") { curtain = Math.max(.04, Math.min(.96, curtain + (ev.key === "ArrowLeft" ? -.05 : .05))); requestDraw(); ev.preventDefault(); ev.stopPropagation(); } });
})();

const KPI = [
  { k: "carga", td: "Carga Paloquemao–Ricaurte", sd: "tramo crítico", t: "Pasajeros en hora pico de la mañana", sub: "en el tramo más cargado: Paloquemao–Ricaurte (NQS)", u: "", f: fI, better: -1, crit: true,
    delta: e => e.id ? `${Math.abs(e.alivio) === 0 ? "igual que hoy" : (e.alivio < 0 ? f1(-e.alivio) + " % menos" : f1(e.alivio) + " % más") + " que hoy"}` : "entre 6 y 9 a. m." },
  { k: "vulnerabilidad", td: "Vulnerabilidad Ricaurte", sd: "% de la demanda desconectada si se retira el nodo", t: "Viajes que quedan sin ruta si se cierra Ricaurte", sub: "de cada 100 viajes de la mañana", u: " %", f: f1, better: -1, crit: true,
    delta: e => e.id ? `hoy son ${f1(e0.vulnerabilidad)} de cada 100` : "Ricaurte es el cruce NQS · Calle 13 · Américas" },
  { k: "puentes", td: "Puentes topológicos", sd: "aristas cuya remoción desconecta el grafo", t: "Puntos críticos donde un cierre parte el sistema en dos", sub: "conexiones sin ruta alternativa", u: "", f: fI, better: -1,
    delta: e => e.id ? `${fI(e0.puentes - e.puentes)} menos que hoy` : `de ${G[0].nE} conexiones en total` },
  { k: "tiempo", td: "Tiempo medio con congestión (BPR)", sd: "asignación con función BPR", t: "Tiempo promedio de viaje", sub: "contando el trancón de la hora pico", u: " min", f: f1, better: -1,
    delta: e => e.id ? `${f1(e0.tiempo - e.tiempo)} min menos que hoy` : "promedio de todos los viajes" },
  { k: "longitud", td: "Longitud media de viaje", sd: "km por viaje (IPF)", t: "Distancia promedio de un viaje", sub: "rutas más directas, menos vueltas", u: " km", f: f2, better: -1,
    delta: e => e.id ? `${f2(e0.longitud - e.longitud)} km menos que hoy` : "" },
  { k: "viajes", td: "Viajes pico AM (IPF)", sd: "matriz OD gravitacional doblemente restringida", t: "Viajes en TransMilenio en hora pico", sub: "de 6 a 9 de la mañana", u: "", f: fI, better: 1,
    delta: e => e.id ? `${fI(e.viajes - e0.viajes)} viajes más que hoy` : "" },
  { k: "estaciones", td: "Estaciones activas en Bogotá", sd: "+4 en Soacha = 143 nodos en la red base", t: "Estaciones en Bogotá", sub: "más 4 en Soacha (143 en la red de hoy)", u: "", f: fI, better: 0,
    delta: e => e.id ? `${fI(e.estaciones - e0.estaciones)} estaciones nuevas` : "" },
  { k: "km", td: "Km troncales adicionales", sd: "tabla de coherencia (EPSG:9377)", t: "Kilómetros de troncal agregados", sub: "obra nueva más tramos compartidos", u: " km", f: f2, better: 0,
    delta: e => e.id ? `${f2(sum(D.corredores.filter(c => e.corredores.includes(c.id)), c => c.km_nueva))} km de obra nueva` : "red de hoy" },
];
function spark(k, cur) {
  const vals = Array.isArray(k) ? k : E.map(e => e[k]), mn = Math.min(...vals), mx = Math.max(...vals), w = 120, h = 26, px = i => 6 + i * (w - 12) / 3, py = v => mx === mn ? h / 2 : 4 + (1 - (v - mn) / (mx - mn)) * (h - 8);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${vals.map((v, i) => px(i) + "," + py(v)).join(" ")}" fill="none" stroke="#9AA4A9" stroke-width="1.4" vector-effect="non-scaling-stroke"/>${vals.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="${i === cur ? 3.6 : 2}" fill="${i === cur ? "#172026" : "#9AA4A9"}"/>`).join("")}</svg>`;
}
const PLAIN = [
  "Hoy casi todos los viajes largos tienen que pasar por el centro (NQS, Caracas, Av. Jiménez), y ahí se forma el trancón.",
  "Se suman 5 conexiones directas entre barrios: los portales quedan unidos por fuera, pero más gente termina entrando al centro.",
  "Solo la Av. Carrera 68: una vía paralela a la NQS que descongestiona el centro, aunque los barrios del borde siguen frágiles.",
  "Las 5 conexiones entre barrios más la Av. 68: menos trancón en el centro y una red que no se parte si se cierra una estación.",
];
const PEAK = { am: { u: "de la mañana", dir: "entrando al centro", d: "AM (6:00–9:00)" }, pm: { u: "de la tarde", dir: "saliendo del centro hacia los barrios", d: "PM (16:30–19:30)" } };
function focusCards(id, e) {
  const n = NODE.get(id), nm = short(n.nombre), cv = E.map((_, i) => (CENT[i].get(id) || 0) * 100);
  const iso = E.map((_, i) => G[i].g.has(id) ? failInfo(i, id).iso.size / (G[i].nV - 1) * 100 : 0);
  const has = G[e.id].g.has(id), dC = cv[e.id] - cv[0], dI = iso[e.id] - iso[0];
  const cls = (dv, better) => !e.id || dv === 0 ? "flat" : dv * better > 0 ? "good" : "bad";
  return `<div class="kc crit focus"><div class="kt">${DEV ? `Centralidad de ${esc(nm)}` : `Rutas que pasan por ${esc(nm)}`}</div><div class="ks">${DEV ? "intermediación ponderada por km" : "de cada 100 trayectos posibles entre estaciones"}</div><div class="kval">${has ? f1(cv[e.id]) : "—"}<small> %</small></div><div class="kd ${cls(dC, -1)}">${e.id ? `hoy ${f1(cv[0])} %` : "en la red de hoy"}</div>${spark(cv, e.id)}<div class="kx">${E.map((_, i) => esc(escName(i))).join(" · ")}</div></div>
  <div class="kc crit focus"><div class="kt">${DEV ? `Vulnerabilidad de ${esc(nm)}` : `Impacto si se cierra ${esc(nm)}`}</div><div class="ks">${DEV ? "% de nodos aislados al retirar el nodo" : "% de estaciones que quedan incomunicadas"}</div><div class="kval">${has ? f1(iso[e.id]) : "—"}<small> %</small></div><div class="kd ${cls(dI, -1)}">hoy ${f1(iso[0])} % · ${esc(escName(3).toLowerCase())} ${f1(iso[3])} %</div>${spark(iso, e.id)}<div class="kx">${id === RIC ? `Modelo: ${f1(e.vulnerabilidad)} % de los viajes sin ruta` : "&nbsp;"}</div></div>`;
}
function renderKPIs() {
  const e = E[lab.esc], gi = G[lab.esc], pk = PEAK[lab.peak || "am"];
  const focus = lab.fail || (lab.sel && lab.sel.type === "node" ? lab.sel.id : null);
  const cards = KPI.map((m, idx) => {
    if (focus && idx < 2) return idx === 0 ? focusCards(focus, e) : "";
    const dv = e[m.k] - e0[m.k], cls = !e.id || !m.better || dv === 0 ? "flat" : (dv * m.better > 0 ? "good" : "bad");
    let t = DEV ? m.td : m.t, sub = DEV ? m.sd : m.sub;
    if (m.k === "carga") { t = DEV ? `Carga Paloquemao–Ricaurte · pico ${pk.d}` : `Pasajeros en hora pico ${pk.u}`; sub = DEV ? (lab.peak === "pm" ? "matriz OD transpuesta: misma carga, sentido inverso" : "tramo crítico, salida oficial del modelo") : `en el tramo más cargado (Paloquemao–Ricaurte), ${pk.dir}`; }
    return `<div class="kc${m.crit ? " crit" : ""}"><div class="kt">${esc(t)}</div><div class="ks">${esc(sub)}</div><div class="kval">${m.f(e[m.k])}<small>${m.u}</small></div><div class="kd ${cls}">${m.delta(e)}</div>${spark(m.k, e.id)}<div class="kx">${E.map((_, i) => esc(escName(i))).join(" · ")}</div></div>`;
  }).join("");
  $("#kpis").innerHTML = tx(`<div class="info-in">
    <header class="info-h"><span class="tag">${DEV ? `Escenario ${e.id} · pico ${pk.d}` : `Hora pico ${pk.u}`}</span><h2>${esc(escName(e.id))}</h2><p>${esc(DEV ? DESC[e.id] : PLAIN[e.id])}</p></header>
    ${focus ? `<p class="focus-note">Las dos primeras tarjetas muestran <b>${esc(NODE.get(focus).nombre)}</b>${lab.fail ? " (cerrada)" : ""}. ${DEV ? "La carga en pasajeros por estación no existe en las salidas del modelo (solo la del tramo Paloquemao–Ricaurte); se muestra la centralidad." : "El modelo no trae pasajeros por estación, así que se muestra por cuántos trayectos pasa."} <button type="button" class="linkbtn" id="focusClear">Volver a la vista general</button></p>` : ""}
    <div class="kgrid">${cards}</div>
    ${lab.peak === "pm" ? `<p class="note">${DEV ? "Pico PM: con la matriz OD transpuesta (T<sub>ij</sub> → T<sub>ji</sub>) y una red simétrica, la asignación da los mismos volúmenes por tramo en sentido inverso; por eso las cifras coinciden con el pico AM oficial. No se volvió a correr el modelo." : "En la tarde el viaje se invierte: la gente sale del centro hacia los barrios. El modelo da las mismas cargas, pero en sentido contrario, así que el trancón se forma en las salidas del centro."}</p>` : ""}
    <h3 class="why-h">¿Por qué las conexiones entre barrios y la Av. 68 funcionan mejor juntas?</h3>
    <div class="why3">
      <article><span class="wn">1</span><h4>Los barrios de los bordes dejan de quedar aislados</h4><p>Hoy, si se cierra Ricaurte, <b>${f1(e0.vulnerabilidad)} de cada 100 viajes</b> se quedan sin ruta, y hay <b>${e0.puentes} puntos</b> donde un solo cierre parte el sistema. Las 5 conexiones unen los portales entre sí (Suba con la Calle 80, Usme y Tunal con la Av. Décima…): esos puntos críticos bajan a <b>${e1.puentes}</b>.</p></article>
      <article><span class="wn">2</span><h4>El centro deja de ser un embudo</h4><p>Por el tramo Paloquemao–Ricaurte pasan <b>${fI(e0.carga)} pasajeros</b> en la hora pico. Las conexiones entre barrios solas no lo arreglan: suben a ${fI(e1.carga)} (${f1(e1.alivio)} % más), porque la gente igual va al centro. La Av. Carrera 68 corre paralela a la NQS y lo baja a <b>${fI(e2.carga)}</b> (${f1(-e2.alivio)} % menos).</p></article>
      <article class="all"><span class="wn">=</span><h4>Juntas: menos trancón y una red que no se cae</h4><p>Con la red completa el tramo más cargado baja a <b>${fI(e3.carga)} pasajeros (${f1(-e3.alivio)} % menos)</b>, los puntos críticos a <b>${e3.puentes}</b>, nadie queda sin ruta si se cierra Ricaurte y el viaje promedio pasa de ${f1(e0.tiempo)} a <b>${f1(e3.tiempo)} minutos</b>. Un viaje Usme → 20 de Julio pasa de ${fI(tripMin(routeInfo(0, ...VIAJE)))} a ${fI(tripMin(routeInfo(3, ...VIAJE)))} minutos.</p></article>
    </div>
    ${e.corredores.length ? `<div class="corr-chips"><span class="sub">Tramos de este escenario:</span>${e.corredores.map(id => `<button type="button" class="chip" data-corr="${id}"><i style="background:${COLOR[id]}"></i>${esc(SHORT[id])} · ${esc(CORR[id].nombre)} · ${f2(CORR[id].km_total)} km</button>`).join("")}</div>` : ""}
    <details class="card acc dev-only"><summary><h3>Fuente de verdad (fuente_de_verdad_datos.md)</h3><span class="sub">Indicadores oficiales y kilómetros por corredor</span></summary>
      <div class="tbl-wrap"><table><thead><tr><th>Indicador (pico AM)</th>${E.map(x => `<th class="n">${esc(ESC_D[x.id])}</th>`).join("")}</tr></thead><tbody>
      ${KPI.map(m => `<tr><td>${esc(m.td)}</td>${E.map(x => `<td class="n">${m.f(x[m.k])}${m.u}</td>`).join("")}</tr>`).join("")}
      <tr><td>Alivio NQS frente a la red actual</td>${E.map(x => `<td class="n">${sgn(x.alivio)} %</td>`).join("")}</tr></tbody></table></div>
      <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Corredor</th><th class="n">Km total</th><th class="n">Obra nueva</th><th class="n">Compartida</th><th class="n">Nuevas</th><th class="n">Transbordos</th></tr></thead><tbody>
      ${D.corredores.map(c => `<tr><td>${esc(SHORT[c.id])} · ${esc(c.nombre)}</td><td class="n">${f2(c.km_total)}</td><td class="n">${f2(c.km_nueva)}</td><td class="n">${f2(c.km_compartida)}</td><td class="n">${c.estaciones_nuevas}</td><td class="n">${c.transbordos}</td></tr>`).join("")}</tbody></table></div>
      <p class="sub" style="margin-top:8px">Red base: 143 estaciones (139 Bogotá + 4 Soacha). La saturación V/C por tramo no está en las salidas del modelo entregadas, solo la carga del tramo Paloquemao–Ricaurte. Parámetros BPR α y β no consignados en la memoria (referencia BPR: α = 0,15, β = 4).</p>
    </details>
    <p class="note dev-only">Cifras oficiales del modelo gravitacional IPF con congestión BPR (comparacion_4_escenarios_congestion.csv). Grafo del escenario: ${gi.nV} nodos, ${gi.nE} aristas, ${gi.bridges.size} puentes (Tarjan), ${gi.art.size} puntos de articulación${gi.ok ? "; coincide con el modelo" : ""}. Incluye las 4 estaciones de Soacha.</p>
  </div>`);
  const fc = $("#focusClear"); if (fc) fc.onclick = () => { lab.sel = null; lab.fail = null; apply(labState()); };
}
function renderLabPanels() {
  renderEscList();
  $$("#failQuick [data-fail]").forEach(b => b.setAttribute("aria-pressed", b.dataset.fail === lab.fail));
  if (document.activeElement !== $("#failSel")) acFail.set(lab.fail);
  if (document.activeElement !== $("#failSearch")) acFail2.set(lab.fail);
  if (document.activeElement !== $("#staSearch")) acSta.set(lab.sel && lab.sel.type === "node" ? lab.sel.id : null);
  $("#btnReset").disabled = !lab.fail;
  $("#failMode").checked = lab.failMode;
  $$("#routeQuick [data-rt]").forEach(b => b.setAttribute("aria-pressed", !!lab.route && ROUTE_PRESETS[+b.dataset.rt].join() === lab.route.join()));
  if (lab.route) { rtSel.o = lab.route[0]; rtSel.d = lab.route[1]; } if (document.activeElement !== $("#rtO")) acO.set(lab.route && lab.route[0]); if (document.activeElement !== $("#rtD")) acD.set(lab.route && lab.route[1]); $("#rtClear").disabled = !lab.route;
  $("#colorMode").value = lab.colorMode || "corr";
  $("#vMap").setAttribute("aria-pressed", lab.view === "map" && !lab.compare); $("#vCmp").setAttribute("aria-pressed", lab.compare); $("#vGraph").setAttribute("aria-pressed", lab.view === "graph");
  const gi = G[lab.esc];
  $("#failMsg").className = "sub" + (lab.fail ? " alert" : "");
  $("#failMsg").innerHTML = tx(esc(failText(lab.esc, lab.fail)));
  renderKPIs(); renderDetail();
}
function failText(esc, id) {
  if (!id) return "Elige una estación o activa el modo de tocar para retirarla del grafo. Las estaciones que queden aisladas se pintan en rojo.";
  const F = failInfo(esc, id), n = NODE.get(id), tot = G[esc].nV - 1;
  const model = id === RIC ? ` Modelo de demanda: ${f1(E[esc].vulnerabilidad)} % de la demanda desconectada.` : "";
  if (!F.iso.size) return `Sin ${n.nombre} la red sigue conectada: las demás ${tot} estaciones conservan una ruta.${model}`;
  return `Sin ${n.nombre} quedan aisladas ${F.iso.size} estaciones (${f1(F.iso.size / tot * 100)} % de la red): ${isoTxt(F)}.${model}`;
}
const legsHTML = (t, r) => `<h3 style="font-size:16px">${esc(t)}: ${fI(tripMin(r))} min</h3><ul class="strip legs">${r.legs.map(l => `<li style="--cc:${l.sv.corr ? COLOR[l.sv.corr] : "#6C757D"}"><b>${esc(l.sv.cod)}</b> ${esc(l.sv.nombre)} · ${esc(short(NODE.get(l.from).nombre))} → ${esc(short(NODE.get(l.to).nombre))}</li>`).join("")}</ul>`;
function closureCardHTML(rt, eb, cl) {
  const [o, d] = rt, cn = NODE.get(cl).nombre, title = `${esc(short(NODE.get(o).nombre))} → ${esc(short(NODE.get(d).nombre))}`;
  if (o === cl || d === cl) return `<div class="det"><span class="tag"><i style="background:var(--tm)"></i>Estación cerrada</span><h2>${title}</h2><p>Tu origen o tu destino es la estación cerrada (${esc(cn)}). Elige otra estación cercana.</p><button type="button" class="linkbtn" id="rtClear2">Quitar viaje</button></div>`;
  const ra = routeInfo(0, o, d), blocked = !!ra && ra.path.includes(cl), rc = blocked ? routeInfo(0, o, d, cl) : null, rb = routeInfo(eb, o, d, cl);
  const row = (cls, t, r, extra) => `<div class="opt ${cls}"><b>${t}</b>${r ? `<span class="num">${fI(tripMin(r))} min</span><small>${f1(r.km)} km · ${r.transfers} ${r.transfers === 1 ? "transbordo" : "transbordos"} · ${r.legs.map(l => esc(l.sv.cod)).join(" → ")}</small>` : `<span class="num">—</span><small>${extra}</small>`}</div>`;
  const today = blocked ? rc : ra, best = rb ? tripMin(rb) : null, base = today ? tripMin(today) : null;
  return `<div class="det"><span class="tag"><i style="background:var(--tm)"></i>Viaje con ${esc(cn)} cerrada</span><h2>${title}</h2>
    <div class="opts">
      ${blocked ? row("blk", `Tu ruta de hoy pasa por ${esc(cn)}: bloqueada`, ra) : row("ok0", `Tu ruta de hoy no pasa por ${esc(cn)}`, ra)}
      ${blocked ? row("alt", "Única alternativa hoy", rc, "No hay otra ruta: con la red de hoy quedas incomunicado.") : ""}
      ${row("new", `Con ${esc(escName(eb).toLowerCase())}`, rb, "Tampoco hay ruta en este escenario.")}
    </div>
    ${best != null && base != null ? `<p class="lead-s">${best < base ? `Ahorras <b>${fI(base - best)} min</b> frente a la mejor opción de hoy.` : best === base ? "Mismo tiempo que la mejor opción de hoy." : `Tardas ${fI(best - base)} min más que hoy.`}</p>` : base == null && best != null ? `<p class="lead-s">Hoy no tendrías cómo llegar; con ${esc(escName(eb).toLowerCase())} sí.</p>` : ""}
    <p class="note">En el mapa: rojo discontinuo = tramo bloqueado, naranja = alternativa de hoy, verde = nueva opción. Tiempos con la velocidad promedio con trancón del modelo y ${TRANSFER_MIN} min por cada cambio de bus.</p>
    <button type="button" class="linkbtn" id="rtClear2">Quitar viaje</button></div>`;
}
function thermoHTML(title, r, cls) {
  if (!r) return "";
  const P = r.path, idx = id => P.indexOf(id);
  const legColor = l => { if (l.sv.corr) return COLOR[l.sv.corr]; const a = l.from, b = P[idx(a) + 1], t = EDGE_TR.get(ekey(a, b)); return t !== undefined ? TRONCAL[t].color : "#6C757D"; };
  return `<div class="thermo ${cls}"><div class="th-h"><b>${esc(title)}</b><span class="num">${fI(tripMin(r))} min</span></div><ol>${r.legs.map(l => { const n = idx(l.to) - idx(l.from); return `<li style="--cc:${legColor(l)}"><span class="st">${esc(short(NODE.get(l.from).nombre))}</span><span class="lg">${esc(l.sv.cod)} · ${n} ${n === 1 ? "parada" : "paradas"}</span></li>`; }).join("")}<li class="end"><span class="st">${esc(short(NODE.get(P[P.length - 1]).nombre))}</span></li></ol><small>${f1(r.km)} km · ${r.transfers} ${r.transfers === 1 ? "transbordo" : "transbordos"}${r.eje.length ? " · pasa por el centro" : ""}</small></div>`;
}
function stepsHTML(r, title, open) {
  if (!r) return "";
  const P = r.path, idx = id => P.indexOf(id), nm = id => esc(NODE.get(id).nombre);
  const svc = l => l.sv.corr ? (DEV ? `corredor ${esc(SHORT[l.sv.corr])}` : `la nueva ${PERIF.includes(l.sv.corr) ? "conexión entre barrios" : "troncal de la Av. Carrera 68"} (${esc(SHORT[l.sv.corr])})`) : l.sv.cod === "—" ? "a pie" : `la ruta <b class="svc">${esc(l.sv.cod)}</b> (hacia ${esc(l.sv.nombre)})`;
  const items = r.legs.map((l, i) => {
    const seg = P.slice(idx(l.from), idx(l.to) + 1), n = seg.length - 1;
    return `<li><span class="sn">${i + 1}</span><div>${i ? "Cambia a" : "Toma"} ${svc(l)} en <b>${nm(l.from)}</b> y bájate en <b>${nm(l.to)}</b> · ${n} ${n === 1 ? "parada" : "paradas"}
      <details><summary>Ver las ${n + 1} estaciones del tramo</summary><ol class="stops">${seg.map(id => `<li>${nm(id)}</li>`).join("")}</ol></details></div></li>`;
  }).join("");
  return `<details class="itin"${open ? " open" : ""}><summary>${esc(title)} · ${fI(tripMin(r))} min · ${r.transfers} ${r.transfers === 1 ? "cambio de bus" : "cambios de bus"}</summary><ol class="steps">${items}<li><span class="sn">✓</span><div>Llegas a <b>${nm(P[P.length - 1])}</b></div></li></ol></details>`;
}
function renderTrip() {
  const out = $("#tripOut");
  if (!lab.route) { out.innerHTML = tx('<p class="sub" style="margin-top:8px">Elige un viaje de ejemplo o escribe de dónde sales y a dónde vas.</p>'); return; }
  const rt = lab.route, eb = lab.esc || 3, cl = lab.fail;
  if (cl) {
    const blocked = routeInfo(0, rt[0], rt[1])?.path.includes(cl);
    const rToday = blocked ? routeInfo(0, rt[0], rt[1], cl) : routeInfo(0, rt[0], rt[1]), rNew = routeInfo(eb, rt[0], rt[1], cl);
    out.innerHTML = tx(closureCardHTML(rt, eb, cl) + `<div class="thermos">${blocked ? thermoHTML("Desvío de hoy", rToday, "alt") : thermoHTML(escName(0), rToday, "a")}${thermoHTML(escName(eb), rNew, "b")}</div><h3 class="itin-h">Cómo llegar</h3>${stepsHTML(rNew, "Con " + escName(eb).toLowerCase(), true)}${stepsHTML(rToday, blocked ? "Hoy, con el desvío" : "Hoy", false)}`);
  } else {
    out.innerHTML = tx(`<div class="det"><h2>${esc(short(NODE.get(rt[0]).nombre))} → ${esc(short(NODE.get(rt[1]).nombre))}</h2>${routeCompareHTML(rt, eb)}<div class="thermos">${thermoHTML(escName(0), routeInfo(0, rt[0], rt[1]), "a")}${thermoHTML(escName(eb), routeInfo(eb, rt[0], rt[1]), "b")}</div><h3 class="itin-h">Cómo llegar</h3>${stepsHTML(routeInfo(eb, rt[0], rt[1]), "Con " + escName(eb).toLowerCase(), true)}${stepsHTML(routeInfo(0, rt[0], rt[1]), "Hoy", false)}</div>`);
  }
  const c2 = $("#rtClear2"); if (c2) c2.onclick = () => setRoute(null);
}
function renderDetail() {
  const el = $("#detail"), sel = lab.sel, gi = G[lab.esc];
  renderTrip();
  if (!sel) {
    el.innerHTML = tx('<p class="sub" style="margin:8px 0">Toca una estación o un corredor en el mapa, o búscala arriba, para ver su ficha.</p>'); return;
  } else if (sel.type === "corr") {
    const c = CORR[sel.id], inf = new Set(c.conexiones_inferidas.map(x => x.id));
    const items = c.path.map((id, i) => {
      const n = NODE.get(id), endp = i === 0 || i === c.path.length - 1;
      if (n.kind === "new") return `<li class="new"><button type="button" data-node="${id}">${esc(n.nombre)}</button></li>`;
      if (n.tr.some(t => t.corredor === c.id)) return `<li class="tr"><button type="button" data-node="${id}">${esc(n.nombre)} · transbordo</button></li>`;
      if (endp) return `<li class="end"><button type="button" data-node="${id}">${esc(n.nombre)}</button></li>`;
      if (inf.has(id)) return `<li class="ax">cruce con ${esc(n.nombre)} (conexión inferida)</li>`;
      return `<li><button type="button" data-node="${id}">${esc(n.nombre)}</button></li>`;
    }).join("");
    const pn = c.km_nueva / c.km_total * 100;
    el.innerHTML = `<div class="det" style="--cc:${COLOR[c.id]}"><span class="tag"><i style="background:${COLOR[c.id]}"></i>${esc(SHORT[c.id])} · ${PERIF.includes(c.id) ? "corredor periférico" : "bypass transversal"}</span>
      <h2>${esc(c.nombre)}</h2>
      <div class="route">${c.ejes.map(x => `<span>${esc(x)}</span>`).join("<em>→</em>")}</div>
      <div><div class="stack"><span class="n" style="width:${pn}%"></span><span class="s" style="width:${100 - pn}%"></span></div>
      <div class="stack-l"><span><b class="num">${f2(c.km_nueva)} km</b> obra nueva</span><span><b class="num">${f2(c.km_compartida)} km</b> compartida</span></div></div>
      <dl class="kv"><dt>Longitud total</dt><dd class="num">${f2(c.km_total)} km</dd><dt>Estaciones nuevas</dt><dd class="num">${c.estaciones_nuevas}</dd><dt>Transbordos existentes</dt><dd class="num">${c.transbordos}</dd><dt>UPL atendidas</dt><dd>${esc(c.upl.join(", "))}</dd></dl>
      <p><strong>Por qué este trazado.</strong> ${esc(c.justificacion_topologica)}</p>
      <h3 style="font-size:17px">Perfil de la línea</h3><ul class="strip" style="--cc:${COLOR[c.id]}">${items}</ul>
      ${c.id === "C6_Av68" ? `<p class="note">La tabla de coherencia registra ${c.transbordos} transbordos para la Av. 68, pero el archivo de estaciones solo trae sus ${c.estaciones_nuevas} estaciones nuevas. Para el grafo, los cruces con troncales existentes se infieren por cercanía (300 m o menos, ${c.conexiones_inferidas.length} estaciones). No forman parte de los 11 transbordos oficiales.</p>` : ""}
      <button type="button" class="linkbtn" data-clear>Cerrar ficha</button></div>`;
  } else {
    const n = NODE.get(sel.id);
    if (n.kind === "new") {
      const e = n.est, c = CORR[e.corredor];
      el.innerHTML = `<div class="det"><span class="tag"><i style="background:var(--gold);border:1.5px solid #111;border-radius:50%"></i>Estación nueva aprobada</span><h2>${esc(e.nombre)}</h2>
        <dl class="kv"><dt>Corredor</dt><dd><button type="button" class="linkbtn" data-corr="${c.id}">${esc(SHORT[c.id])} · ${esc(c.nombre)}</button></dd><dt>UPL</dt><dd>${esc(e.upl)}</dd><dt>Orden en la línea</dt><dd class="num">${e.orden}</dd>
        <dt>Densidad POT</dt><dd><span class="num">${f3(e.densidad)}</span><div class="meter"><i style="width:${e.densidad * 100}%"></i></div></dd>
        <dt>Conexión Metro POT</dt><dd><span class="badge ${e.metro ? "yes" : "no"}">${e.metro ? "Sí · ≤ 350 m" : "No"}</span></dd>
        ${e.area_actividad ? `<dt>Área de Actividad</dt><dd>${esc(e.area_actividad)}${e.area_por_upl ? " <small>(asignada por UPL)</small>" : ""}</dd>` : ""}
        <dt>Grado en el grafo</dt><dd class="num">${gi.g.get(e.id)?.size ?? "—"}</dd>
        <dt>Centralidad</dt><dd class="num">${gi.g.has(e.id) ? pctC(CENT[lab.esc].get(e.id)) : "— (no está en este escenario)"}</dd></dl>
        ${gi.g.has(e.id) ? `<button type="button" class="btn-fail" data-failnode="${e.id}" aria-pressed="${lab.fail === e.id}"><span class="bolt" aria-hidden="true"></span>${lab.fail === e.id ? (DEV ? "Restablecer el nodo" : "Abrir esta estación de nuevo") : (DEV ? "Simular falla (retirar nodo)" : "Simular cierre aquí")}</button>` : ""}
        <p><strong>Justificación POT.</strong> ${esc(e.justificacion)}</p>
        <p class="note">El círculo azul del mapa es el radio peatonal de 500 m que se usó para cruzar la estación con las capas del POT.${e.area_por_upl ? " En la Av. 68, el Área de Actividad se asigna según la UPL de la estación, no por cruce espacial." : ""}</p>
        <button type="button" class="linkbtn" data-clear>Cerrar ficha</button></div>`;
    } else {
      const deg = gi.g.get(n.id)?.size ?? 0, isArt = gi.art.has(n.id);
      el.innerHTML = `<div class="det"><span class="tag"><i style="background:${n.tr.length ? "var(--emerald)" : "#fff"};border:1.5px solid var(--base)"></i>${n.tr.length ? "Estación actual · nodo de transbordo POT" : "Estación actual"}</span><h2>${esc(n.nombre)}</h2>
        <dl class="kv"><dt>Municipio</dt><dd>${n.municipio}</dd><dt>Grado en el grafo</dt><dd class="num">${deg}</dd><dt>Punto de articulación</dt><dd>${isArt ? '<span class="badge no" style="background:#FDE3E4;color:#9A0F17">Sí: si falla, parte la red</span>' : '<span class="badge yes">No</span>'}</dd>
        <dt>Centralidad</dt><dd class="num">${pctC(CENT[lab.esc].get(n.id))} <small>(puesto ${CENT_RANK[lab.esc].indexOf(n.id) + 1}; red actual ${pctC(CENT[0].get(n.id))})</small></dd></dl>
        <button type="button" class="btn-fail" data-failnode="${n.id}" aria-pressed="${lab.fail === n.id}"><span class="bolt" aria-hidden="true"></span>${lab.fail === n.id ? (DEV ? "Restablecer el nodo" : "Abrir esta estación de nuevo") : (DEV ? "Simular falla (retirar nodo)" : "Simular cierre aquí")}</button>
        ${lab.fail === n.id ? `<p class="sub alert" style="color:var(--tm)">${esc(failText(lab.esc, n.id))}</p>` : ""}
        ${n.tr.map(t => `<p><strong>Transbordo ${esc(SHORT[t.corredor])}.</strong> ${esc(t.justificacion)}. UPL ${esc(t.upl)}, densidad ${f3(t.densidad)}, Metro POT: ${t.metro ? "Sí" : "No"}.</p>`).join("")}

        <button type="button" class="linkbtn" data-clear>Cerrar ficha</button></div>`;
    }
  }
  if (sel.type === "node") {
    const n = NODE.get(sel.id), tr = troncalesDe(sel.id), kv = el.querySelector(".kv");
    const extra = `<dl class="kv"><dt>Troncal</dt><dd>${tr.length ? tr.map(t => `<span class="trk" style="--cc:${t.color}">${esc(t.letra)}</span> ${esc(t.nombre)}`).join("<br>") : n.kind === "new" ? esc(SHORT[n.est.corredor]) + " (nueva)" : "Conector entre troncales"}</dd><dt>Sector (UPL)</dt><dd>${esc(n.est ? n.est.upl : uplOf(sel.id))}</dd>
      <dt>${DEV ? "Demanda" : "¿Cuánta gente pasa?"}</dt><dd>${DEV ? "Sin dato por estación en el modelo; centralidad " : "El modelo no publica pasajeros por estación. Por aquí pasan "}${G[lab.esc].g.has(sel.id) ? pctC(CENT[lab.esc].get(sel.id)) : "—"}${DEV ? "" : " de los trayectos"}</dd></dl>
      <div class="row2">${n.kind === "old" ? `<button type="button" class="chip" data-act="o" data-id="${sel.id}">Fijar como origen</button><button type="button" class="chip" data-act="d" data-id="${sel.id}">Fijar como destino</button>` : ""}</div>`;
    if (kv) kv.insertAdjacentHTML("beforebegin", extra); else el.insertAdjacentHTML("beforeend", extra);
  }
  el.innerHTML = tx(el.innerHTML);
}
$("#kpis").addEventListener("click", ev => { const c = ev.target.closest("[data-corr]"); if (!c) return; select({ type: "corr", id: c.dataset.corr }); flyTo(fit(CORR[c.dataset.corr].coords, { pitch: cam.pitch || 0, rot: cam.rot, pad: .7 }), 1100); $("#mapWrap").scrollIntoView({ behavior: "smooth", block: "start" }); });
$("#detail").addEventListener("click", ev => {
  const act = ev.target.closest("[data-act]");
  if (act) { const id = act.dataset.id;
    if (act.dataset.act === "close") { lab.fail = lab.fail === id ? null : id; apply(labState()); return; }
    if (act.dataset.act === "o") rtSel.o = id; else rtSel.d = id;
    (act.dataset.act === "o" ? acO : acD).set(id); setTab("trip"); if (rtSel.o && rtSel.d && rtSel.o !== rtSel.d) setRoute([rtSel.o, rtSel.d]); return; }
  const c = ev.target.closest("[data-corr]"), n = ev.target.closest("[data-node]"), x = ev.target.closest("[data-clear]");
  if (c) { select({ type: "corr", id: c.dataset.corr }); if (lab.view === "map") flyTo(fit(CORR[c.dataset.corr].coords, { pitch: cam.pitch || 0, rot: cam.rot, pad: .75 }), 1100); }
  if (n) { select({ type: "node", id: n.dataset.node }); const nd = NODE.get(n.dataset.node); if (lab.view === "map") flyTo({ ...cam, ...fit([[nd.lon, nd.lat]], { pitch: cam.pitch, rot: cam.rot }), z: 14.3 }, 1000); }
  if (x) select(null);
  const fb = ev.target.closest("[data-failnode]"); if (fb) { const id = fb.dataset.failnode; lab.fail = lab.fail === id ? null : id; apply(labState()); if (lab.fail && lab.view === "map") flyToFail(); }
});

/* =====================================================================
   8. VISTA GRAFO (Cytoscape + fcose)
   ===================================================================== */
let cy = null, graphLayout = "geo";
function setView(v) {
  lab.compare = v === "cmp"; lab.view = v === "graph" ? "graph" : "map";
  if (lab.compare) { if (lab.esc === 0) lab.esc = 3; lab.bridges = true; $("#tgBridges").checked = true; curtain = .5; }
  $("#graph").hidden = lab.view !== "graph"; $("#mapWrap").classList.toggle("graphing", lab.view === "graph");
  if (mode === "laboratorio") apply(labState());
  if (lab.view === "graph") updateGraph();
}
function updateGraph() {
  if (typeof window.cytoscape !== "function") { $("#gNote").textContent = "No se pudo cargar la librería de grafos (Cytoscape) desde jsDelivr. Revisa tu conexión."; return; }
  if (!cy) {
    try { if (window.cytoscapeFcose) cytoscape.use(window.cytoscapeFcose); } catch (_) { }
    cy = cytoscape({ container: $("#cy"), minZoom: .2, maxZoom: 5,
      style: [
        { selector: "node", style: { width: 7, height: 7, "background-color": "#fff", "border-width": 1.5, "border-color": "#6C757D" } },
        { selector: "node.new", style: { width: 11, height: 11, "background-color": "#FFD166", "border-color": "#111" } },
        { selector: "node.tr", style: { shape: "diamond", width: 13, height: 13, "background-color": "#2A9D8F", "border-color": "#0D3B36" } },
        { selector: "node.ric", style: { width: 16, height: 16, "background-color": "#D8101E", "border-color": "#fff", label: "Ricaurte", "font-size": 11, "font-weight": 600, "text-margin-y": -6 } },
        { selector: "node.iso", style: { "background-color": "#D8101E", "border-color": "#7A0A12" } },
        { selector: "node.dead", style: { opacity: .25 } },
        { selector: "node:selected", style: { "border-color": "#2747D8", "border-width": 3.5 } },
        { selector: "node.hl", style: { label: "data(label)", "font-size": 10, color: "#172026", "text-background-color": "#fff", "text-background-opacity": .85, "text-background-padding": 2 } },
        { selector: "edge", style: { width: 2, "line-color": "#B8BEC2", "curve-style": "straight" } },
        { selector: "edge.corr", style: { width: 3.4, "line-color": "data(color)" } },
        { selector: "edge.bridge", style: { "line-color": "#E85D04", "line-style": "dashed", width: 3 } },
        { selector: "edge.iso", style: { "line-color": "#D8101E" } },
        { selector: "edge.dead", style: { opacity: .15 } },
        { selector: "edge.crit", style: { width: 6, "line-color": "#D8101E" } },
        { selector: "edge.heat", style: { "line-color": "data(hc)", width: "data(hw)", "line-style": "solid", opacity: 1 } },
        { selector: "node.bus", style: { shape: "round-rectangle", width: 10, height: 6, "background-color": "data(c)", "border-width": 1, "border-color": "#fff", label: "" } },
      ] });
    cy.on("tap", "node", ev => { if (ev.target.hasClass("bus")) { const r = ev.renderedPosition, c = $("#cy").getBoundingClientRect(); showTip(ev.target.data("lbl"), c.left + r.x, c.top + r.y, true); return; } select({ type: "node", id: ev.target.id() }); });
    cy.on("tap", ev => { if (ev.target === cy) select(null); });
    cy.on("mouseover", "node", ev => ev.target.addClass("hl")); cy.on("mouseout", "node", ev => { if (!ev.target.selected()) ev.target.removeClass("hl"); });
    $("#gGeo").onclick = () => { graphLayout = "geo"; runLayout(true); };
    $("#gTopo").onclick = () => { graphLayout = "topo"; runLayout(true); };
  }
  const gi = G[lab.esc], s = labState(), vcorr = new Set(E[lab.esc].corredores), F = failInfo(lab.esc, lab.fail);
  const els = [];
  gi.g.forEach((_, id) => {
    const n = NODE.get(id), cls = [n.kind === "new" ? "new" : "", n.kind === "old" && n.tr.some(t => vcorr.has(t.corredor)) ? "tr" : "", id === RIC ? "ric" : "", F && F.iso.has(id) ? "iso" : "", F && id === lab.fail ? "dead" : ""].filter(Boolean).join(" ");
    els.push({ group: "nodes", data: { id, label: n.nombre }, position: { x: n.xy[0] * 1.6, y: n.xy[1] * 1.6 }, classes: cls });
  });
  const seen = new Set();
  gi.g.forEach((set, a) => set.forEach(b => {
    const k = ekey(a, b); if (seen.has(k)) return; seen.add(k);
    const cid = gi.corrEdge.get(k);
    const cls = [cid ? "corr" : "", s.bridges && gi.bridges.has(k) ? "bridge" : "", F && (F.iso.has(a) || F.iso.has(b)) && a !== lab.fail && b !== lab.fail ? "iso" : "", F && (a === lab.fail || b === lab.fail) ? "dead" : "", k === ekey(CRIT_A, CRIT_B) ? "crit" : ""].filter(Boolean).join(" ");
    const hv = s.layers.heat ? CENT[lab.esc].edges.get(k) : undefined, ht = hv === undefined ? 0 : Math.min(1, hv / EBMAX);
    els.push({ group: "edges", data: { id: "e" + k, source: a, target: b, color: cid ? COLOR[cid] : "#B8BEC2", hc: heatColor(ht), hw: 2 + 9 * ht }, classes: cls + (hv !== undefined ? " heat" : "") });
  }));
  const prevPos = {}; cy.nodes().forEach(n => prevPos[n.id()] = { ...n.position() });
  cy.batch(() => { cy.elements().remove(); cy.add(els); });
  if (graphLayout === "topo") cy.nodes().forEach(n => { if (prevPos[n.id()]) n.position(prevPos[n.id()]); });
  if (lab.sel && lab.sel.type === "node") cy.$id(lab.sel.id).select().addClass("hl");
  runLayout(false);
  $("#gNote").textContent = `${gi.nV} nodos · ${gi.nE} aristas · ${gi.bridges.size} puentes${gi.ok ? " (coincide con el modelo)" : ""}`;
}
function runLayout(animate) {
  if (!cy) return;
  $("#gGeo").setAttribute("aria-pressed", graphLayout === "geo"); $("#gTopo").setAttribute("aria-pressed", graphLayout === "topo");
  const els = cy.elements().not(".bus");
  if (graphLayout === "geo") els.layout({ name: "preset", positions: n => { const x = NODE.get(n.id()).xy; return { x: x[0] * 1.6, y: x[1] * 1.6 }; }, animate: animate && !reduceMotion, animationDuration: 900, fit: true, padding: 30 }).run();
  else {
    const hasF = !!(window.cytoscapeFcose || (cytoscape.extension && cytoscape.extension("layout", "fcose")));
    els.layout(hasF ? { name: "fcose", quality: "proof", randomize: true, animate: animate && !reduceMotion ? "end" : false, animationDuration: 1200, nodeRepulsion: () => 6500, idealEdgeLength: () => 34, edgeElasticity: () => .55, gravity: .25, numIter: 3000, fit: true, padding: 30 }
      : { name: "cose", animate: false, fit: true, padding: 30 }).run();
  }
}

/* =====================================================================
   9. ANÁLISIS Y DATOS
   ===================================================================== */
function lineChart(m) {
  const w = 260, h = 150, l = 26, r = 26, t = 40, b = 24, vals = E.map(e => e[m.k]);
  let mn = Math.min(...vals), mx = Math.max(...vals); const pad = (mx - mn) * .12 || 1; mn = Math.max(0, mn - pad); mx += pad;
  if (["vulnerabilidad", "puentes", "km"].includes(m.k)) mn = 0;
  const x = i => l + i * (w - l - r) / 3, y = v => t + (1 - (v - mn) / (mx - mn)) * (h - t - b);
  const ticks = [mn, (mn + mx) / 2, mx];
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(m.t)} por escenario">
    <text class="ttl" x="0" y="14">${esc(m.t)}</text>
    ${ticks.map(v => `<line x1="${l - 10}" x2="${w - r + 10}" y1="${y(v)}" y2="${y(v)}" stroke="#E3E6E2"/>`).join("")}
    <polyline points="${vals.map((v, i) => x(i) + "," + y(v)).join(" ")}" fill="none" stroke="${m.crit ? "#D8101E" : "#172026"}" stroke-width="2"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === 3 ? 4.5 : 3}" fill="${i === 3 ? (m.crit ? "#D8101E" : "#172026") : "#fff"}" stroke="${m.crit ? "#D8101E" : "#172026"}" stroke-width="1.6"/><text class="lab" x="${x(i)}" y="${y(v) - 8}" text-anchor="middle">${m.f(v)}</text><text x="${x(i)}" y="${h - 8}" text-anchor="middle">Esc. ${i}</text>`).join("")}
  </svg>`;
}
function kmChart() {
  const cs = [...D.corredores].sort((a, b) => b.km_total - a.km_total), w = 900, rowH = 30, l = 112, r = 60, h = cs.length * rowH + 34, mx = Math.max(...cs.map(c => c.km_total));
  const sx = v => (w - l - r) * v / mx;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Km de obra nueva y compartida por corredor">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#D6DBDE"/><rect width="3" height="6" fill="#B9C0C4"/></pattern></defs>
    ${[0, 5, 10, 15, 20].map(v => `<line x1="${l + sx(v)}" x2="${l + sx(v)}" y1="6" y2="${h - 24}" stroke="#E3E6E2"/><text x="${l + sx(v)}" y="${h - 8}" text-anchor="middle">${v} km</text>`).join("")}
    ${cs.map((c, i) => { const y = 8 + i * rowH; return `<text class="lab" x="${l - 8}" y="${y + 15}" text-anchor="end">${esc(SHORT[c.id])}</text>
      <rect x="${l}" y="${y + 3}" width="${sx(c.km_nueva)}" height="18" fill="${COLOR[c.id]}" rx="2"/>
      <rect x="${l + sx(c.km_nueva)}" y="${y + 3}" width="${sx(c.km_compartida)}" height="18" fill="url(#hatch)" rx="2"/>
      <text x="${l + sx(c.km_total) + 6}" y="${y + 16}">${f2(c.km_total)}</text>`; }).join("")}
  </svg>`;
}
function dumbbell(a, b) {
  const w = 180, x = v => 8 + v / 0.6 * (w - 16);
  return `<svg viewBox="0 0 ${w} 18" width="${w}" height="18" aria-hidden="true"><line x1="8" x2="${w - 8}" y1="9" y2="9" stroke="#E3E6E2"/><line x1="${x(b)}" x2="${x(a)}" y1="9" y2="9" stroke="#9AA4A9" stroke-width="2"/><circle cx="${x(a)}" cy="9" r="4.5" fill="#fff" stroke="#D8101E" stroke-width="2"/><circle cx="${x(b)}" cy="9" r="4.5" fill="#1E7F55"/></svg>`;
}
const DL = "https://ingesgays-ctrl.github.io/bogota-se-reconecta/datos/";
function renderAnalysis() {
  const tot = { t: kmTot, n: kmNew, s: kmSh, en: sum(D.corredores, c => c.estaciones_nuevas), tr: sum(D.corredores, c => c.transbordos) };
  $("#analysis").innerHTML = tx(`<div class="an">
    <div><h2>Análisis y datos</h2><p class="intro">Todas las cifras salen de una fuente única: los indicadores, de <span class="mono">comparacion_4_escenarios_congestion.csv</span> (modelo IPF con congestión BPR); los kilómetros, de <span class="mono">tabla_coherencia_corredores.csv</span>, medidos sobre las polilíneas en EPSG:9377.</p></div>

    <div class="card"><h3>El hallazgo: complementariedad</h3>
      <div class="eqn">${stat(`${e1.puentes} puentes · ${f1(e1.vulnerabilidad)} %`, `Esc. 1 · 5 periféricos: resiliencia, pero la carga central sube ${sgn(e1.alivio)} %`)}<span class="op">+</span>${stat(`${sgn(e2.alivio)} % · ${f1(e2.vulnerabilidad)} %`, `Esc. 2 · Av. 68: descongestión, pero quedan ${e2.puentes} puentes`)}<span class="op">=</span><div class="stat int"><span class="v">${e3.puentes} · ${sgn(e3.alivio)} % · ${f1(e3.vulnerabilidad)} %</span><span class="k">Integral: puentes, carga Paloquemao–Ricaurte y vulnerabilidad de Ricaurte</span></div></div>
    </div>

    <div class="card"><h3>El problema es todo el eje central</h3><p style="max-width:80ch;margin:0">La red radial obliga a casi todos los viajes a pasar por el mismo eje de transbordos: la NQS central (Ricaurte ${cN(0, "Ricaurte")}, Av. El Dorado ${cN(0, ELD)}, NQS Calle 75 ${cN(0, N75)}) y la Caracas Centro (Av. Jiménez ${cN(0, JIM)}, Hortúa ${cN(0, "Hortúa")}). Los 5 corredores periféricos dan rutas alternativas entre portales y quitan los puntos de falla del sur (sin Av. Jiménez se aíslan ${isoN(0, JIM)} → ${isoN(1, JIM)} estaciones). El bypass de la Av. 68 da una ruta directa paralela a la NQS (NQS Calle 75: ${cN(0, N75)} → ${cN(2, N75)}). Juntos bajan la centralidad media del eje ${dPct(ejeMean(0), ejeMean(3))}.</p></div>

    <div><h3>Los 4 escenarios, indicador por indicador</h3><p class="intro" style="margin-bottom:10px">Esc. 0 Red actual · Esc. 1 +5 periféricos · Esc. 2 +solo Av. 68 · Esc. 3 Integral. En rojo, los indicadores del tramo crítico.</p>
      <div class="grid4 chart">${KPI.map(m => `<div class="card">${lineChart(m)}</div>`).join("")}</div></div>

    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card chart"><h3>Obra nueva y operación compartida por corredor</h3><p class="sub"><span class="sw" style="background:#555"></span>color sólido: obra nueva · <span class="sw" style="background:repeating-linear-gradient(45deg,#B9C0C4 0 3px,#D6DBDE 3px 6px)"></span>rayado: compartida sobre troncales existentes</p>${kmChart()}
        <p class="sub" style="margin-top:8px">Total ${f2(tot.t)} km = ${f2(tot.n)} km de obra nueva + ${f2(tot.s)} km de operación compartida.</p></div>
      <div class="card"><h3>Tabla de coherencia por corredor</h3><div class="tbl-wrap"><table>
        <thead><tr><th>Corredor</th><th class="n">Km total</th><th class="n">Obra nueva</th><th class="n">Compartida</th><th class="n">Nuevas</th><th class="n">Transb.</th><th>UPL</th></tr></thead>
        <tbody>${D.corredores.map(c => `<tr class="click" data-corr="${c.id}"><td><span class="sw" style="background:${COLOR[c.id]}"></span><b>${esc(SHORT[c.id])}</b><br><small>${esc(c.nombre)}</small></td><td class="n">${f2(c.km_total)}</td><td class="n">${f2(c.km_nueva)}</td><td class="n">${f2(c.km_compartida)}</td><td class="n">${c.estaciones_nuevas}</td><td class="n">${c.transbordos}</td><td><small>${esc(c.upl.join(", "))}</small></td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="n">${f2(tot.t)}</td><td class="n">${f2(tot.n)}</td><td class="n">${f2(tot.s)}</td><td class="n">${tot.en}</td><td class="n">${tot.tr}</td><td></td></tr></tfoot></table></div>
        <p class="sub" style="margin-top:8px">Los 6 transbordos de la Av. 68 vienen de la tabla de coherencia. El archivo de estaciones registra 11 transbordos oficiales, todos en los corredores periféricos.</p></div>
    </div>

    <div class="card"><h3>Top 10 de centralidad: cómo se redistribuye el peso del centro</h3>
      <p class="sub">Centralidad de intermediación ponderada por km: porcentaje de los caminos más cortos entre pares de estaciones que pasan por cada nodo. Se calcula en esta página sobre el grafo de cada escenario. Mide rutas, no pasajeros.</p>
      <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Estación (top 10 de la red actual)</th>${E.map(e => `<th class="n">${esc(e.corto)}</th>`).join("")}<th class="n">Cambio integral</th><th style="min-width:180px">Red actual → integral</th></tr></thead>
      <tbody>${TOP10.map((id, i) => { const a = CENT[0].get(id), b = CENT[3].get(id); return `<tr class="click" data-node="${id}" data-c=""><td class="n">${i + 1}</td><td><b>${esc(NODE.get(id).nombre)}</b></td>${CENT.map(c => `<td class="n">${f1(c.get(id) * 100)}</td>`).join("")}<td class="n" style="color:var(--good)">${dPct(a, b)}</td><td>${dumbbell(a, b)}</td></tr>`; }).join("")}
      <tr><td></td><td><b>Media del eje central</b><br><small>${esc(EJE.map(id => NODE.get(id).nombre.replace(" - Centro Colombo Americano", "")).join(", "))}</small></td>${[0, 1, 2, 3].map(i => `<td class="n">${f1(ejeMean(i) * 100)}</td>`).join("")}<td class="n" style="color:var(--good)">${dPct(ejeMean(0), ejeMean(3))}</td><td>${dumbbell(ejeMean(0), ejeMean(3))}</td></tr></tbody></table></div>
      <p class="sub" style="margin-top:8px">Top 10 del escenario integral: ${CENT_RANK[3].slice(0, 10).map((id, i) => `${i + 1}. ${esc(NODE.get(id).nombre)} (${f1(CENT[3].get(id) * 100)})`).join(" · ")}. Las estaciones de la Caracas norte suben alrededor de un punto porque reciben rutas que dejan la NQS. Calle 76 y Tercer Milenio no están en la matriz del proyecto.</p></div>

    <div class="card"><h3>Prueba de falla por estación crítica</h3><p class="sub">Estaciones que quedan aisladas del resto de la red si se retira cada nodo.</p>
      <div class="tbl-wrap"><table><thead><tr><th>Estación retirada</th>${E.map(e => `<th class="n">${esc(e.corto)}</th>`).join("")}</tr></thead>
      <tbody>${QUICK.map(id => `<tr><td><b>${esc(NODE.get(id).nombre)}</b></td>${E.map((e, i) => { const n = failInfo(i, id).iso.size; return `<td class="n" style="color:${n ? "var(--tm)" : "var(--good)"}">${n}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="sub" style="margin-top:8px">Para Ricaurte, el modelo de demanda traduce esto a ${E.map(e => f1(e.vulnerabilidad) + " %").join(", ")} de demanda desconectada en los escenarios 0 a 3. En el laboratorio puedes retirar cualquier otra estación.</p></div>

    <div class="card"><h3>Indicadores oficiales por escenario</h3><div class="tbl-wrap"><table>
      <thead><tr><th>Indicador (pico AM)</th>${E.map(e => `<th class="n">${esc(e.corto)}</th>`).join("")}</tr></thead>
      <tbody>${KPI.map(m => `<tr><td>${esc(m.t)}</td>${E.map(e => `<td class="n">${m.f(e[m.k])}${m.u}</td>`).join("")}</tr>`).join("")}
      <tr><td>Alivio NQS frente a la red actual</td>${E.map(e => `<td class="n">${sgn(e.alivio)} %</td>`).join("")}</tr></tbody></table></div>
      <p class="sub" style="margin-top:8px">Red base: 143 estaciones en total (139 en Bogotá y 4 en Soacha). La simulación evalúa la demanda interna de Bogotá, de 139 a 175 estaciones. Los km adicionales coinciden con la tabla de coherencia: 37,32 para los periféricos, 22,38 para la Av. 68 y 59,70 en el escenario integral.</p></div>

    <div class="card"><h3>Las ${D.estaciones.length} estaciones POT</h3>
      <div class="filters"><label class="sr" for="fq" style="position:absolute;left:-9999px">Buscar estación</label><input id="fq" type="search" placeholder="Buscar estación o UPL">
        <label for="fc" style="position:absolute;left:-9999px">Corredor</label><select id="fc"><option value="">Todos los corredores</option>${D.corredores.map(c => `<option value="${c.id}">${esc(SHORT[c.id])}</option>`).join("")}</select>
        <label for="ft" style="position:absolute;left:-9999px">Tipo</label><select id="ft"><option value="">Nuevas y transbordos</option><option value="Aprobada_Nueva">Solo nuevas (${nNew})</option><option value="Integrada_Transbordo">Solo transbordos (${nTr})</option></select>
        <label for="fm" style="position:absolute;left:-9999px">Metro</label><select id="fm"><option value="">Metro: todas</option><option value="1">Con conexión Metro</option><option value="0">Sin conexión Metro</option></select></div>
      <div class="tbl-wrap"><table><thead><tr><th>Estación</th><th>Tipo</th><th>Corredor</th><th>UPL</th><th class="n">Densidad</th><th>Metro</th><th>Justificación POT</th></tr></thead><tbody id="estRows"></tbody></table></div>
      <p class="sub" id="estCount"></p></div>

    <details class="card acc dev-only" open><summary><h3>Metodología y supuestos</h3><span class="sub">Las 4 etapas del modelo</span></summary>
      <ol class="pipe">
        <li><b>1 · Grafo ponderado de la red troncal.</b> ${D.red.nodos.length} estaciones (nodos) y ${G[0].nE} conexiones directas tomadas de la matriz de adyacencia 143×143, con la distancia en km como peso. Los corredores POT se trazaron con camino mínimo (Dijkstra) sobre 5.091 tramos de la malla vial arterial (EPSG:9377). Sobre ese grafo, esta página calcula puentes y puntos de articulación (Tarjan), centralidad de intermediación (Brandes) y rutas (Dijkstra).</li>
        <li><b>2 · Matriz origen–destino gravitacional.</b> Modelo doblemente restringido ajustado por Iterative Proportional Fitting (IPF), con β = 0,10 km⁻¹, para la hora pico AM (6:00–9:00). Red actual: ${fI(e0.viajes)} viajes; escenario integral: ${fI(e3.viajes)}.</li>
        <li><b>3 · Asignación con congestión BPR.</b> El tiempo de cada tramo crece con su saturación:
          <div class="formula" role="math" aria-label="t igual a t sub cero por uno más alfa por V sobre C elevado a beta">t = t<sub>0</sub> · [ 1 + α · (V / C)<sup>β</sup> ]</div>
          t<sub>0</sub> es el tiempo a flujo libre, V el volumen asignado y C la capacidad del tramo. La memoria técnica entregada no consigna los valores de α y β usados; los valores de referencia del Bureau of Public Roads son α = 0,15 y β = 4. Resultado: tiempo medio de ${f1(e0.tiempo)} min en la red actual y ${f1(e3.tiempo)} min en el escenario integral.</li>
        <li><b>4 · Selección voraz de enlaces filtrada por el POT.</b> Un algoritmo voraz eligió los 5 enlaces entre portales (<span class="mono">seleccion_voraz_enlaces.csv</span>). Cada corredor y estación se validó contra el Decreto 555 de 2021: UPL, Áreas de Actividad, Estructura Ecológica Principal (exclusión si ocupa más del 45 % de áreas protegidas) y red Metro (integración a 350 m o menos). La Av. Carrera 68 se evaluó como escenario contrafactual.</li>
      </ol>
    </details>

    <details class="card acc dev-only"><summary><h3>Preguntas del jurado</h3><span class="sub">Respuestas cortas con las cifras del modelo</span></summary>
      <dl class="faq">
        <dt>¿Cómo se modeló la congestión?</dt>
        <dd>Con la función BPR de la etapa 3: cada tramo se vuelve más lento a medida que su volumen se acerca a la capacidad. Por eso el tiempo medio (${f1(e0.tiempo)} → ${f1(e3.tiempo)} min) baja más que la longitud media (${f2(e0.longitud)} → ${f2(e3.longitud)} km): el escenario integral acorta los viajes y además los saca de los tramos saturados.</dd>
        <dt>¿Por qué con los 5 corredores periféricos sube un ${f1(e1.alivio)} % la carga del centro?</dt>
        <dd>Los anillos unen portales entre sí, pero no crean una nueva entrada al centro expandido, que es hacia donde va la mayoría de viajes de la mañana. Al mejorar la accesibilidad, el modelo gravitacional capta ${fI(e1.viajes - e0.viajes)} viajes más, y esos viajes siguen entrando por la NQS y la Caracas: Paloquemao–Ricaurte pasa de ${fI(e0.carga)} a ${fI(e1.carga)} pasajeros. La Av. 68 sí abre una entrada paralela al tronco central (${sgn(e2.alivio)} %), y por eso las dos intervenciones se complementan.</dd>
        <dt>¿Cómo se calcula el ahorro del simulador de rutas?</dt>
        <dd>Ruta más corta en km (Dijkstra) en cada escenario. Transbordos: cambios entre los 114 servicios reales de la hoja Rutas, y cada corredor nuevo cuenta como un servicio. Tiempo: km ÷ velocidad efectiva con congestión del escenario, que sale del propio modelo BPR (longitud media ÷ tiempo medio: ${f1(VEL[0])} km/h en la red actual y ${f1(VEL[3])} km/h en el integral), más un tiempo por transbordo ajustable. Los datos no traen volumen ni capacidad por tramo, así que no se aplica BPR tramo a tramo.</dd>
        <dt>¿Qué mide la centralidad?</dt>
        <dd>El porcentaje de los caminos más cortos (en km) entre todos los pares de estaciones que pasan por cada estación. Mide rutas en el grafo, no pasajeros. La media del eje central baja de ${pctC(ejeMean(0))} a ${pctC(ejeMean(3))}.</dd>
        <dt>¿Por qué no aparecen Calle 76 ni Tercer Milenio?</dt>
        <dd>No están en la matriz de 143 estaciones del proyecto, que es la base de todo el grafo.</dd>
      </dl>
    </details>

    <div class="card"><h3>Descargar evidencias</h3><p class="sub">Archivos limpios que usa esta página (WGS84, EPSG:4326).</p>
      <ul class="dl">
        <li><a href="${DL}fuente_de_verdad_datos.md" download>fuente_de_verdad_datos.md</a><span>Reglas de unificación y cifras oficiales</span></li>
        <li><a href="${DL}escenarios_kpi.csv" download>escenarios_kpi.csv</a><span>Indicadores de los 4 escenarios (km de la tabla de coherencia)</span></li>
        <li><a href="${DL}corredores_pot.geojson" download>corredores_pot.geojson</a><span>6 corredores con ejes viales completos y km</span></li>
        <li><a href="${DL}estaciones_pot.geojson" download>estaciones_pot.geojson</a><span>47 estaciones POT con justificación</span></li>
        <li><a href="${DL}red_troncal_actual.geojson" download>red_troncal_actual.geojson</a><span>143 estaciones y 146 conexiones</span></li>
        <li><a href="${DL}centralidad_por_escenario.csv" download>centralidad_por_escenario.csv</a><span>Centralidad de cada estación en los 4 escenarios</span></li>
      </ul></div>

    <div class="card notes"><h3>Notas sobre los datos</h3><ul>
      <li>Fuente única de indicadores: <span class="mono">comparacion_4_escenarios_congestion.csv</span>. Los archivos <span class="mono">comparacion_3_escenarios_av68.csv</span> y <span class="mono">comparacion_antes_despues.csv</span> corresponden a una versión preliminar sin congestión y no se usan.</li>
      <li>Kilómetros tomados de <span class="mono">tabla_coherencia_corredores.csv</span>. Algunas propiedades de los GeoJSON (por ejemplo, Av. 68 = 21,44 km) difieren porque se calcularon de otra forma.</li>
      <li>Los ejes viales se reconstruyeron completos; en los archivos originales estaban cortados a 120 caracteres.</li>
      <li>Las estaciones con nombre repetido llevan el sufijo [corredor·orden], por ejemplo «Avenida Carrera 86 (Tabora) [C1·2]».</li>
      <li>En las 14 estaciones de la Av. 68, el Área de Actividad se asignó según la UPL (Puente Aranda: industrial/productiva; Salitre: grandes servicios metropolitanos; Teusaquillo y Barrios Unidos: estructurante/proximidad), no por cruce espacial.</li>
      <li>«Ricuarte» en los archivos fuente se corrigió a «Ricaurte». Los límites UPL se simplificaron con una tolerancia de 0,0005° para que carguen rápido.</li>
      <li>El mapa base CartoDB Positron se carga cuando el entorno lo permite. En visores que bloquean imágenes externas se usa un mapa base vectorial dibujado con los polígonos UPL.</li>
    </ul></div>
  </div>`);
  const rows = () => {
    const q = ($("#fq").value || "").toLowerCase(), fc = $("#fc").value, ft = $("#ft").value, fm = $("#fm").value;
    const L = D.estaciones.filter(e => (!q || (e.nombre + " " + e.upl).toLowerCase().includes(q)) && (!fc || e.corredor === fc) && (!ft || e.estado === ft) && (!fm || (fm === "1") === e.metro));
    $("#estRows").innerHTML = L.map(e => `<tr class="click" data-node="${e.estado === "Aprobada_Nueva" ? e.id : e.existente}" data-c="${e.corredor}"><td><b>${esc(e.nombre)}</b></td><td>${e.estado === "Aprobada_Nueva" ? "Nueva" : "Transbordo"}</td><td><span class="sw" style="background:${COLOR[e.corredor]}"></span>${esc(SHORT[e.corredor])}</td><td>${esc(e.upl)}</td><td class="n">${f3(e.densidad)}</td><td>${e.metro ? "Sí" : "No"}</td><td><small>${esc(e.justificacion)}</small></td></tr>`).join("");
    $("#estCount").textContent = `${L.length} de ${D.estaciones.length} estaciones. Toca una fila para verla en el laboratorio.`;
  };
  ["fq", "fc", "ft", "fm"].forEach(id => $("#" + id).addEventListener("input", rows)); rows();
  $("#analysis").addEventListener("click", ev => {
    const n = ev.target.closest("tr[data-node]"), c = ev.target.closest("tr[data-corr]");
    if (n) { lab.esc = n.dataset.c === "" ? 3 : n.dataset.c === "C6_Av68" ? 2 : 1; lab.sel = { type: "node", id: n.dataset.node }; location.hash = "laboratorio"; }
    if (c) { lab.esc = c.dataset.corr === "C6_Av68" ? 2 : 1; lab.sel = { type: "corr", id: c.dataset.corr }; location.hash = "laboratorio"; }
  });
}

/* =====================================================================
   9b. MODO PRESENTACIÓN
   ===================================================================== */
const JIM_ID = byName("Avenida Jiménez");
const demoFail = (id, esc2) => ({ id: "demo-" + id + esc2, cam: () => { const F = failInfo(0, id); const ids = [...F.iso, id]; return fit(ids.map(x => [NODE.get(x).lon, NODE.get(x).lat]), { pitch: 50, rot: -15, pad: .8 }); }, st: { esc: esc2, fail: id, layers: { col: false } },
  html: `<div class="eyebrow">Demostración en vivo · ${esc2 ? "Escenario integral" : "Red actual"}</div><h2>Falla en ${esc(NODE.get(id).nombre)}</h2><p class="lead">${esc(failText(esc2, id))}</p>${esc2 ? `<p>En la red actual la misma falla aislaba ${failInfo(0, id).iso.size} estaciones.</p>` : ""}` });
const STEPS = [
  ...CH.slice(0, CH.length - 1),
  demoFail(RIC, 0), demoFail(RIC, 3), demoFail(JIM_ID, 0), demoFail(JIM_ID, 3),
  { id: "demo-cortina", cam: () => fit(allPts, { pitch: 40, rot: 0, pad: .88 }), st: { esc: 3, bridges: true, compare: true, layers: { col: false } },
    html: `<div class="eyebrow">Demostración en vivo · cortina</div><h2>Red actual | Escenario integral</h2><p class="lead">Arrastra la línea vertical. A la izquierda, la red actual: ${fI(e0.carga)} pasajeros en Paloquemao–Ricaurte y ${e0.puentes} puentes topológicos (naranja). A la derecha, el escenario integral: ${fI(e3.carga)} pasajeros y ${e3.puentes} puentes, con los 6 corredores articulados.</p>` },
  { id: "demo-ruta2", cam: () => routeCam(ROUTE_PRESETS[1]), st: { esc: 3, route: ROUTE_PRESETS[1], layers: { col: false } },
    html: `<div class="eyebrow">Demostración en vivo · ruta</div><h2>${esc(short(NODE.get(ROUTE_PRESETS[1][0]).nombre))} → ${esc(short(NODE.get(ROUTE_PRESETS[1][1]).nombre))}</h2>${routeCompareHTML(ROUTE_PRESETS[1], 3, true)}` },
  CH[CH.length - 1],
];
let step = 0, prevHash = "relato";
function presGo(i) {
  step = Math.max(0, Math.min(STEPS.length - 1, i));
  const c = STEPS[step], st = c.st;
  hideTip(true);
  apply({ esc: st.esc, fail: st.fail || null, bridges: !!st.bridges, layers: { red: true, per: true, av: true, est: true, upl: false, col: !!st.layers?.col, cent: !!st.layers?.cent }, sel: null, only: st.only || null, stagger: !!st.stagger, view: "map", route: st.route || null, compare: !!st.compare });
  if (st.compare) curtain = .5;
  flyTo(c.cam(), 1400);
  $("#presCard").innerHTML = tx(c.html); $("#presCard").scrollTop = 0;
  $("#presCount").textContent = `${step + 1} / ${STEPS.length}`;
  $("#presPrev").disabled = step === 0; $("#presNext").disabled = step === STEPS.length - 1;
}
function presEnter() {
  if (presenting) return;
  prevHash = location.hash.replace("#", "") || "relato";
  if (mode !== "relato") { mode = "relato"; }
  presenting = true; document.body.className = "mode-relato presenting" + (DEV ? " dev" : ""); $("#pres").hidden = false; $("#graph").hidden = true;
  try { const p = document.documentElement.requestFullscreen?.(); if (p && p.catch) p.catch(() => { }); } catch (_) { }
  resize(); presGo(curCh > 0 ? Math.min(curCh, STEPS.length - 1) : 0);
}
function presExit() {
  if (!presenting) return;
  presenting = false; $("#pres").hidden = true;
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); } catch (_) { }
  curCh = -1; route();
}
$("#presBtn").onclick = presEnter;
$("#presPrev").onclick = () => presGo(step - 1); $("#presNext").onclick = () => presGo(step + 1); $("#presExit").onclick = presExit;
$("#presCard").addEventListener("click", ev => { const s2 = ev.target.closest("[data-sel]"); if (s2) select({ type: "node", id: s2.dataset.sel }); const g = ev.target.closest("[data-go]"); if (g) presGo(+g.dataset.go); });
document.addEventListener("fullscreenchange", () => resize());
document.addEventListener("keydown", ev => {
  if (ev.target.closest && ev.target.closest("input,select,textarea")) return;
  if (presenting) {
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(ev.key)) { presGo(step + 1); ev.preventDefault(); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(ev.key)) { presGo(step - 1); ev.preventDefault(); }
    else if (ev.key === "Home") presGo(0); else if (ev.key === "End") presGo(STEPS.length - 1);
    else if (ev.key === "Escape") presExit();
    return;
  }
  if (ev.key === "p" || ev.key === "P") { if (mode !== "analisis") presEnter(); return; }
  if (mode === "relato" && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) {
    const i = Math.max(0, Math.min(CH.length - 1, (curCh < 0 ? 0 : curCh) + (ev.key === "ArrowRight" ? 1 : -1)));
    $$(".ch", storyInner)[i].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); ev.preventDefault();
  }
});

// ---- panel con pestañas ----
const TABS = { trip: ["#tbTrip", "#paneTrip"], fail: ["#tbFail", "#paneFail"], sta: ["#tbSta", "#paneSta"], live: ["#tbLive", "#paneLive"] };
function setTab(t) { Object.entries(TABS).forEach(([k, [b, p]]) => { $(b).setAttribute("aria-selected", k === t); $(p).hidden = k !== t; }); }
Object.keys(TABS).forEach(k => $(TABS[k][0]).onclick = () => setTab(k));
function openPanel() { $("#lPanel").hidden = false; $("#btnPanel").hidden = true; }
$("#lpClose").onclick = () => { $("#lPanel").hidden = true; $("#btnPanel").hidden = false; };
$("#btnPanel").onclick = openPanel;
if (matchMedia("(max-width: 820px)").matches) { $("#lPanel").hidden = true; $("#btnPanel").hidden = false; }
$("#rtSwap").onclick = () => { [rtSel.o, rtSel.d] = [rtSel.d, rtSel.o]; acO.set(rtSel.o); acD.set(rtSel.d); if (rtSel.o && rtSel.d) setRoute([rtSel.o, rtSel.d]); };
// ---- capas, convenciones, color ----
$("#btnLayers").onclick = ev => { ev.stopPropagation(); const p = $("#layersPanel"); p.hidden = !p.hidden; $("#btnLayers").setAttribute("aria-expanded", !p.hidden); };
document.addEventListener("click", ev => { if (!ev.target.closest(".dd")) { $("#layersPanel").hidden = true; $("#btnLayers").setAttribute("aria-expanded", "false"); } });
$("#btnConv").onclick = () => { const on = $("#btnConv").getAttribute("aria-pressed") !== "true"; $("#btnConv").setAttribute("aria-pressed", on); $("#mapWrap").classList.toggle("conv", on); };
$("#lgTroncal").innerHTML = TRONCAL.filter(t => t.letra !== "·").map(t => `<span><i class="lg-t" style="background:${t.color}"></i>${esc(t.letra)} ${esc(t.nombre)}</span>`).join("");
$("#colorMode").onchange = ev => { lab.colorMode = ev.target.value; lab.layers.heat = ev.target.value === "uso"; $("#lyHeatT").checked = lab.layers.heat; apply(labState()); };
// ---- cámara ----
let orbitRaf = 0, prevTilt = 48;
function setOrbit(on) { $("#camOrbit").setAttribute("aria-pressed", on); cancelAnimationFrame(orbitRaf); if (!on) return; const step = () => { cam.rot += .12; requestDraw(); orbitRaf = requestAnimationFrame(step); }; orbitRaf = requestAnimationFrame(step); }
function setFollow(on) {
  follow = on; $("#camFollow").setAttribute("aria-pressed", on);
  if (on) { if (!sim.on) simToggle(true); if (!sim.focus || !sim.focus.g.isConnected) sim.focus = (LIVE.sel && sim.buses.find(b => b.svc === LIVE.sel)) || sim.buses.find(b => b.od) || sim.buses[0];
    if (sim.focus) { $("#simHud").hidden = false; flyTo({ ...cam, z: 14, pitch: Math.max(cam.pitch, 45) }, 600); showTip(sim.focus.label, innerWidth / 2, innerHeight / 2, false); setTimeout(() => hideTip(), 2500); } }
}
$("#cam3d").onclick = () => $("#t3d").click();
$("#camAll").onclick = () => { setFollow(false); flyTo(fit(allPts, { pitch: cam.pitch > 1 ? 45 : 0, rot: cam.rot, pad: .9 }), 1000); };
$("#camTop").onclick = () => { const top = cam.pitch > 1; if (top) prevTilt = cam.pitch; $("#camTop").setAttribute("aria-pressed", top); flyTo({ ...cam, pitch: top ? 0 : prevTilt, rot: top ? 0 : cam.rot }, 800); };
$("#camOrbit").onclick = () => setOrbit($("#camOrbit").getAttribute("aria-pressed") !== "true");
$("#camFollow").onclick = () => setFollow(!follow);
mapEl.addEventListener("pointerdown", () => { if ($("#camOrbit").getAttribute("aria-pressed") === "true") setOrbit(false); if (follow) setFollow(false); });
// ---- ticker de estado por eje ----
// la barra se puede arrastrar, mover con la rueda o con las flechas
(() => {
  const t = $("#ticker"); if (!t) return;
  let d = null;
  t.addEventListener("pointerdown", ev => { if (ev.button !== 0) return; d = { x: ev.clientX, s: t.scrollLeft, moved: false }; t.classList.add("drag"); });
  addEventListener("pointermove", ev => { if (!d) return; const dx = ev.clientX - d.x; if (Math.abs(dx) > 3) d.moved = true; t.scrollLeft = d.s - dx; });
  addEventListener("pointerup", () => { d = null; t.classList.remove("drag"); });
  t.addEventListener("wheel", ev => { if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) { t.scrollLeft += ev.deltaY; ev.preventDefault(); } }, { passive: false });
  const wrap = t.parentElement, mk = (dir, txt) => { const b = document.createElement("button"); b.type = "button"; b.className = "tk-arrow " + dir; b.setAttribute("aria-label", dir === "l" ? "Ver anteriores" : "Ver siguientes"); b.textContent = txt; b.onclick = () => t.scrollBy({ left: (dir === "l" ? -1 : 1) * t.clientWidth * .6, behavior: "smooth" }); wrap.appendChild(b); return b; };
  const L = mk("l", "‹"), R = mk("r", "›");
  const upd = () => { L.hidden = t.scrollLeft < 4 || t.offsetParent === null; R.hidden = t.scrollLeft + t.clientWidth > t.scrollWidth - 4 || t.offsetParent === null; };
  t.addEventListener("scroll", upd); new ResizeObserver(upd).observe(t); new MutationObserver(upd).observe(t, { childList: true });
})();
function renderTicker(s) {
  const e = E[s.esc], pm = s.peak === "pm", c = id => (CENT[s.esc].get(id) || 0) * 100, c0 = id => (CENT[0].get(id) || 0) * 100;
  const lvl = v => v >= 30 ? ["Muy cargado", "bad"] : v >= 15 ? ["Cargado", "mid"] : ["Fluido", "good"];
  const node = (nm, lab2) => { const id = byName(nm), v = c(id), [t, k] = lvl(v); return { n: lab2, st: t, k, v: DEV ? `centralidad ${f1(v)} %` : `${fI(v)} de cada 100 trayectos`, d: s.esc ? (DEV ? sgn(v - c0(id)) + " pp" : `hoy ${fI(c0(id))}`) : "" }; };
  const prk = e.carga >= e0.carga ? ["Saturado", "bad"] : e.carga >= .9 * e0.carga ? ["Cargado", "mid"] : ["Más fluido", "good"];
  const items = [
    { n: pm ? "Ricaurte → Paloquemao (salida)" : "Paloquemao → Ricaurte", st: prk[0], k: prk[1], v: `${fI(e.carga)} pasajeros`, d: s.esc ? sgn(e.alivio) + " %" : "" },
    node("Avenida Jiménez", "Av. Jiménez"), node("Calle 72 - Areandina", "Calle 72"), node("NQS Calle 75", "NQS Calle 75"),
    { n: "Av. Carrera 68", st: e.corredores.includes("C6_Av68") ? "En operación" : "No existe hoy", k: e.corredores.includes("C6_Av68") ? "good" : "off", v: e.corredores.includes("C6_Av68") ? "22,38 km · 14 estaciones" : "", d: "" },
    { n: DEV ? "Corredores periféricos C1–C5" : "Conexiones entre barrios", st: e.corredores.includes("C1") ? "En operación" : "No existen hoy", k: e.corredores.includes("C1") ? "good" : "off", v: e.corredores.includes("C1") ? "37,32 km · 5 tramos" : "", d: "" },
  ];
  const head = `<span class="tk-head ${s.esc ? "fut" : ""}">${s.esc ? (DEV ? "Con mejoras · " + ESC_D[s.esc] : "Con las mejoras · " + ESC_U[s.esc]) : (DEV ? "Hoy · Esc. 0 red actual" : "Hoy · red actual")} · ${pm ? "pico tarde" : "pico mañana"}</span>`;
  $("#ticker").innerHTML = head + (typeof LIVE !== "undefined" && LIVE ? liveTickerHTML() : "") + items.map(i => `<span class="tk ${i.k}"><b>${esc(i.n)}</b><em>${esc(i.st)}</em>${i.v ? `<span>${esc(i.v)}</span>` : ""}${i.d ? `<span class="num">${esc(i.d)}</span>` : ""}</span>`).join("") + (DEV ? '<span class="tk-note">Umbrales de centralidad: ≥ 30 % muy cargado · ≥ 15 % cargado</span>' : "");
}
// ---- interruptor de modo y jornada ----
function setDev(v) {
  DEV = v; try { localStorage.setItem("tm-dev", v ? "1" : "0"); } catch (_) { }
  document.body.classList.toggle("dev", v);
  $("#mUser").setAttribute("aria-pressed", !v); $("#mDev").setAttribute("aria-pressed", v);
  applyModeTexts(); renderEscList(); renderStory();
  analysisDone = false; if (mode === "analisis") { renderAnalysis(); analysisDone = true; }
  if (mode === "laboratorio") apply(labState()); else if (mode === "relato" && !presenting) { const i = curCh; curCh = -1; enterChapter(Math.max(0, i)); }
  if (presenting) presGo(step);
}
$("#mUser").onclick = () => setDev(false); $("#mDev").onclick = () => setDev(true);
const setPeak = pk => { lab.peak = pk; $("#pkAM").setAttribute("aria-pressed", pk === "am"); $("#pkPM").setAttribute("aria-pressed", pk === "pm"); apply(labState()); };
$("#pkAM").onclick = () => setPeak("am"); $("#pkPM").onclick = () => setPeak("pm");
applyModeTexts(); $("#mUser").setAttribute("aria-pressed", !DEV); $("#mDev").setAttribute("aria-pressed", DEV);

/* =====================================================================
   10. NAVEGACIÓN
   ===================================================================== */
let analysisDone = false;
function route() {
  if (presenting) { presExit(); return; }
  if (sim.on && location.hash.replace("#", "") !== "laboratorio") simToggle(false);
  const h = location.hash.replace("#", "");
  const m = ["relato", "laboratorio", "analisis"].includes(h) ? h : "relato";
  const prev = mode; mode = m;
  document.body.className = "mode-" + m + (collapsed ? " lab-collapsed" : "") + (DEV ? " dev" : "");
  if (prev !== m) { $(".stage").scrollTop = 0; $("#story").scrollTop = 0; hideTip(true); }
  $$(".modes a").forEach(a => a.dataset.mode === m ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  hideTip(true);
  if (m === "analisis") { if (!analysisDone) { renderAnalysis(); analysisDone = true; } return; }
  resize();
  if (m === "relato") { const i = curCh < 0 ? 0 : curCh; curCh = -1; setView("map"); enterChapter(i); }
  if (m === "laboratorio") {
    $("#graph").hidden = lab.view !== "graph";
    apply(labState());
    if (prev !== "laboratorio") {
      const sel = lab.sel;
      if (sel && sel.type === "corr") flyTo(fit(CORR[sel.id].coords, { pitch: 50, rot: -15, pad: .7 }), 1200);
      else if (sel && sel.type === "node") { const n = NODE.get(sel.id); flyTo({ ...fit([[n.lon, n.lat]], { pitch: 52, rot: -15 }), z: 14.3 }, 1200); }
      else flyTo(fit(allPts, { pitch: 48, rot: -12, pad: .9 }), 1200);
    }
  }
}
window.addEventListener("hashchange", route);
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !presenting) { hideTip(true); if (mode === "laboratorio") select(null); } });

// arranque
resize();
Object.assign(cam, fit(allPts, { pitch: 44, rot: -12, pad: .86 }));
draw();
route();
/*GTFSRT*/
/*LIVE*/
/*ML*/
window.__TM = { G, E, GRAPH_OK, cam, apply, lab, NODE, CENT, TOP10, EJE, ejeMean, failInfo, QUICK, ML, LIVE, sim };
})();
