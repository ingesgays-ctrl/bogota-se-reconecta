/* =====================================================================
   11. MOTOR WebGL: MapLibre GL + OpenFreeMap (mejora progresiva)
   Si MapLibre o las teselas vectoriales no cargan (p. ej. visores que
   bloquean recursos externos), se mantiene el motor propio.
   El estado visual se lee del modelo que ya actualiza apply().
   ===================================================================== */
const ML_STYLE = "https://tiles.openfreemap.org/styles/positron";
const unP = ([x, y]) => { const sz = TS * 2 ** Z0, X = x + ORIGIN[0], Y = y + ORIGIN[1], n = Math.PI - 2 * Math.PI * Y / sz; return [X / sz * 360 - 180, 180 / Math.PI * Math.atan(Math.sinh(n))]; };
const LL = id => { const n = NODE.get(id); return [n.lon, n.lat]; };
const camML = c => ({ center: unP([c.cx, c.cy]), zoom: c.z - 1, pitch: Math.min(70, Math.max(0, c.pitch)), bearing: -c.rot });
const FC = f => ({ type: "FeatureCollection", features: f });
const numW = str => { const m = /([\d.]+)px/.exec(str || ""); return m ? +m[1] : null; };
const square = (ll, half) => { const dy = half / 110540, dx = half / (111320 * Math.cos(ll[1] * Math.PI / 180)); return [[[ll[0] - dx, ll[1] - dy], [ll[0] + dx, ll[1] - dy], [ll[0] + dx, ll[1] + dy], [ll[0] - dx, ll[1] + dy], [ll[0] - dx, ll[1] - dy]]]; };
const circlePoly = (ll, r) => { const dy = r / 110540, dx = r / (111320 * Math.cos(ll[1] * Math.PI / 180)), ring = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * 2 * Math.PI; ring.push([ll[0] + Math.cos(a) * dx, ll[1] + Math.sin(a) * dy]); } return [ring]; };

function mlPushCam() {
  const m = ML.map; if (!m) return;
  ML.pushing = true; m.jumpTo(camML(cam)); if (ML.mapB && S.compare) ML.mapB.jumpTo(camML(cam)); ML.pushing = false;
  mlCurtain();
}
function mlCurtain() {
  const box = $("#mlMap"); if (!box) return;
  if (S.compare) { box.style.clipPath = `inset(0 0 0 ${(curtain * W).toFixed(0)}px)`; $("#cmpBar").style.left = curtain * W + "px"; }
  else box.style.clipPath = "";
}
function mlRect(sel) {
  const ll = sel.type === "node" ? LL(sel.id) : CORR[sel.id].coords[Math.floor(CORR[sel.id].coords.length / 2)];
  const p = ML.map.project(ll), r = $("#mlMap").getBoundingClientRect();
  return { left: r.left + p.x, top: r.top + p.y, width: 0, height: 0 };
}
function mlCamFromMap(m) {
  const c = m.getCenter(), xy = P(c.lng, c.lat);
  cam.cx = xy[0]; cam.cy = xy[1]; cam.z = m.getZoom() + 1; cam.pitch = m.getPitch(); cam.rot = -m.getBearing();
}

// ---- capas ----
function mlSetup(m, side) {
  const st = m.getStyle(), src = Object.keys(st.sources).find(k => st.sources[k].type === "vector");
  const firstSym = (st.layers.find(l => l.type === "symbol") || {}).id;
  if (src) m.addLayer({ id: "ml-bldg", type: "fill-extrusion", source: src, "source-layer": "building", minzoom: 13,
    paint: { "fill-extrusion-color": "#E2E8F0", "fill-extrusion-opacity": 0.55,
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 15, ["coalesce", ["get", "render_height"], 8]],
      "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 15, ["coalesce", ["get", "render_min_height"], 0]] } }, firstSym);
  ["upl", "heat", "edges", "corr", "route", "radio", "cols", "stations", "bus"].forEach(id => m.addSource("s-" + id, { type: "geojson", data: FC([]) }));
  m.addLayer({ id: "ml-upl", type: "line", source: "s-upl", paint: { "line-color": "#7E8A90", "line-width": 1.1, "line-dasharray": [3, 2] } });
  m.addLayer({ id: "ml-heat", type: "line", source: "s-heat", layout: { "line-cap": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["get", "w"], "line-opacity": .9 } });
  m.addLayer({ id: "ml-edges", type: "line", source: "s-edges", filter: ["!=", ["get", "d"], 1], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["get", "w"], "line-opacity": ["get", "o"] } });
  m.addLayer({ id: "ml-edges-dash", type: "line", source: "s-edges", filter: ["==", ["get", "d"], 1], paint: { "line-color": ["get", "c"], "line-width": ["get", "w"], "line-opacity": ["get", "o"], "line-dasharray": [2, 1.2] } });
  m.addLayer({ id: "ml-corr-case", type: "line", source: "s-corr", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": ["+", ["get", "w"], 3.5] } });
  m.addLayer({ id: "ml-corr", type: "line", source: "s-corr", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["get", "w"] } });
  m.addLayer({ id: "ml-corr-hit", type: "line", source: "s-corr", paint: { "line-color": "#000", "line-width": 18, "line-opacity": 0.01 } });
  m.addLayer({ id: "ml-route-case", type: "line", source: "s-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 10 } });
  [["a", "#4A5560", [2, 1.4], 5], ["ab", "#D8101E", [1.6, 1.2], 5], ["c", "#EF8A17", null, 5.5], ["b", "#1E7F55", null, 6.5]].forEach(([t, c, dash, w]) =>
    m.addLayer({ id: "ml-route-" + t, type: "line", source: "s-route", filter: ["==", ["get", "t"], t], layout: { "line-join": "round" }, paint: { "line-color": c, "line-width": w, ...(dash ? { "line-dasharray": dash } : {}) } }));
  m.addLayer({ id: "ml-radio", type: "fill", source: "s-radio", paint: { "fill-color": "#2747D8", "fill-opacity": .1, "fill-outline-color": "#2747D8" } });
  m.addLayer({ id: "ml-cols", type: "fill-extrusion", source: "s-cols", paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": .88 } });
  m.addLayer({ id: "ml-metro", type: "circle", source: "s-stations", filter: ["==", ["get", "metro"], 1], paint: { "circle-radius": 9.5, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#111", "circle-stroke-width": 1, "circle-stroke-opacity": .7 } });
  m.addLayer({ id: "ml-stations", type: "circle", source: "s-stations", paint: { "circle-radius": ["get", "r"], "circle-color": ["get", "fc"], "circle-stroke-color": ["get", "sc"], "circle-stroke-width": ["get", "sw"], "circle-opacity": ["get", "o"], "circle-stroke-opacity": ["get", "o"], "circle-pitch-alignment": "map" } });
  m.addLayer({ id: "ml-bus", type: "circle", source: "s-bus", paint: { "circle-radius": ["case", ["==", ["get", "od"], 1], 5.5, 4.5], "circle-color": ["get", "c"], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
  m.getSource("s-upl").setData(FC(D.upl.map(u => ({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: u.rings } }))));
}
const HEAT_GEO = new Map();
const heatGeo = k => { if (!HEAT_GEO.has(k)) { const [a, b] = k.split("|"), c = G[3].corrEdge.get(k); HEAT_GEO.set(k, c && !BASE_EDGES.has(k) ? routePts(3, [a, b]).map(unP) : [LL(a), LL(b)]); } return HEAT_GEO.get(k); };
function mlData(side) {
  const L = side === "L", out = {};
  // red actual (estado leído de los trazos SVG que actualiza apply)
  const els = L ? EDGE_L : EDGE_EL, redOn = (L ? lyRedL : lyRed).style.display !== "none" || (L && S.layers.red);
  out.edges = !redOn ? [] : [...els].map(([k, el]) => {
    const cl = el.classList; let c = el.style.stroke || "#6C757D", w = 2.2, o = el.style.strokeOpacity ? +el.style.strokeOpacity : .55, d = 0;
    if (cl.contains("crit")) { c = !L && cl.contains("ok") ? "#1E7F55" : "#D8101E"; w = L ? 6 : (numW(el.style.strokeWidth) || 6); o = 1; }
    if (cl.contains("bridge")) { c = "#E85D04"; w = 3.2; o = .95; d = 1; }
    if (cl.contains("iso")) { c = "#D8101E"; w = 2.8; o = .9; d = 0; }
    if (cl.contains("dead")) o = .12;
    const [a, b] = k.split("|");
    return { type: "Feature", properties: { c, w, o, d }, geometry: { type: "LineString", coordinates: [LL(a), LL(b)] } };
  });
  out.corr = L ? [] : D.corredores.filter(c => CORR_EL[c.id].drawn).map(c => ({ type: "Feature", properties: { id: c.id, c: COLOR[c.id], w: CORR_EL[c.id].ln.classList.contains("sel") ? 8 : 5.5, tip: CORR_EL[c.id].g.querySelector(".hit").dataset.tip }, geometry: { type: "LineString", coordinates: c.coords } }));
  out.heat = L || lyHeat.style.display === "none" ? [] : [...HEAT_EL].filter(([, el]) => el.style.display !== "none" && el.style.stroke).map(([k, el]) => ({ type: "Feature", properties: { c: el.style.stroke, w: numW(el.style.strokeWidth) || 3 }, geometry: { type: "LineString", coordinates: heatGeo(k) } }));
  // estaciones
  out.stations = [];
  MK.forEach((g, id) => {
    const cl = g.classList; if (cl.contains("hidden")) return;
    const isNew = cl.contains("new"); if (L && isNew) return;
    const tr = !L && !!g.querySelector(".s-tr:not(.hidden)"), ric = cl.contains("ric");
    let p = isNew ? { r: 5.6, fc: "#FFD166", sc: "#111", sw: 1.6 } : ric ? { r: 6.5, fc: "#D8101E", sc: "#fff", sw: 2 } : tr ? { r: 5.5, fc: "#2A9D8F", sc: "#0D3B36", sw: 1.4 } : { r: 3.6, fc: "#fff", sc: "#6C757D", sw: 1.4 };
    if (!L && cl.contains("iso") && !isNew) p = { ...p, fc: "#D8101E", sc: "#7A0A12" };
    if (!L && cl.contains("sel")) p = { ...p, sc: "#2747D8", sw: 3 };
    out.stations.push({ type: "Feature", properties: { id, ...p, o: !L && cl.contains("dead") ? .25 : 1, metro: isNew && g.querySelector(".metro") ? 1 : 0, tip: g.dataset.tip }, geometry: { type: "Point", coordinates: LL(id) } });
  });
  // rutas O→D
  out.route = [];
  if (!L && S.route) {
    const rt = S.route, eb = S.esc || 3, cl = S.fail, ra = routeInfo(0, rt[0], rt[1]), blocked = !!cl && !!ra && ra.path.includes(cl);
    const rc = blocked ? routeInfo(0, rt[0], rt[1], cl) : null, rb = routeInfo(eb, rt[0], rt[1], cl || undefined);
    [[ra, blocked ? "ab" : "a", 0], [rc, "c", 0], [rb, "b", eb]].forEach(([r, t, e]) => { if (r) out.route.push({ type: "Feature", properties: { t }, geometry: { type: "LineString", coordinates: routePts(e, r.path).map(unP) } }); });
  }
  // radio peatonal
  out.radio = !L && radio.style.display !== "none" && S.sel ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: circlePoly(LL(S.sel.id), 500) } }] : [];
  // columnas 3D
  out.cols = [];
  const colOn = o => o.el.style.opacity !== "0" && o.el.style.visibility !== "hidden";
  const add = (xy, h, half, c) => out.cols.push({ type: "Feature", properties: { h, c }, geometry: { type: "Polygon", coordinates: square(unP(xy), half) } });
  if (L) add(loadCol.xy, loadH(E[0].carga) * 55, 150, "#D8101E");
  else COLS.forEach(o => {
    if (o.type !== "col" || !colOn(o) || !o.hv) return;
    const cl = o.el.classList;
    if (cl.contains("load")) add(o.xy, o.hv * 55, 150, S.compare && S.esc > 0 ? "#1E7F55" : "#D8101E");
    else if (cl.contains("dens")) add(o.xy, o.hv * 45, 85, cl.contains("tr") ? "#2A9D8F" : "#F2C14E");
    else if (cl.contains("cent")) add(o.xy, o.hv * 45, 75, "#2B3A44");
    else if (cl.contains("heatcol")) add(o.xy, o.hv * 45, 60, (o.el.style.background.match(/rgb\([^)]+\)/) || ["#E9B949"])[0]);
  });
  return out;
}
function mlApplyTo(m, side) {
  if (!m || !m.getSource("s-edges")) return;
  const d = mlData(side);
  ["edges", "corr", "heat", "stations", "route", "radio", "cols"].forEach(k => m.getSource("s-" + k).setData(FC(d[k])));
  m.setLayoutProperty("ml-upl", "visibility", side === "R" && S.layers.upl ? "visible" : "none");
  const base = S.layers.base === false ? "none" : "visible";
  m.getStyle().layers.forEach(l => { if (!l.id.startsWith("ml-") || l.id === "ml-bldg") m.setLayoutProperty(l.id, "visibility", base); });
}
// etiquetas HTML como marcadores (pocas: corredores, Ricaurte, carga, origen/destino, UPL)
const ML_LBL = new Map();
function mlLabels() {
  const m = ML.map; if (!m) return;
  COLS.forEach(o => {
    if (o.type !== "lbl") return;
    const vis = o.el.style.display !== "none" && o.el.style.opacity !== "0" && !(o === loadLbl && !is3D());
    let mk = ML_LBL.get(o);
    if (!vis) { if (mk) { mk.remove(); ML_LBL.delete(o); } return; }
    if (!mk) { const el = document.createElement("div"); mk = new maplibregl.Marker({ element: el, anchor: o === pulseLbl ? "center" : "bottom", offset: o === pulseLbl ? [0, 0] : [0, o === loadLbl ? -6 : -8] }); ML_LBL.set(o, mk); mk.setLngLat(unP(o.xy)).addTo(m); }
    const el = mk.getElement(); el.className = o.el.className + " ml-lbl"; if (el.innerHTML !== o.el.innerHTML) el.innerHTML = o.el.innerHTML;
    mk.setLngLat(unP(o.xy));
  });
}
function mlApply() {
  if (!ML.map) return;
  mlApplyTo(ML.map, "R"); mlLabels(); mlBuses();
  if (S.compare) mlEnsureB(); else if (ML.boxB) ML.boxB.style.display = "none";
  if (ML.mapB && S.compare) { ML.boxB.style.display = ""; mlApplyTo(ML.mapB, "L"); }
  mlCurtain();
}
function mlBuses() {
  const m = ML.map; if (!m || !m.getSource("s-bus")) return;
  const on = sim.on && S.layers.bus !== false;
  m.getSource("s-bus").setData(FC(!on ? [] : sim.buses.filter(b => b.x !== undefined).map((b, i) => ({ type: "Feature", properties: { i: sim.buses.indexOf(b), c: b.color, od: b.od ? 1 : 0 }, geometry: { type: "Point", coordinates: unP([b.x, b.y]) } }))));
}
// ---- cortina: segundo mapa sincronizado debajo del principal ----
function mlEnsureB() {
  if (ML.mapB || ML.creatingB) return;
  ML.creatingB = true;
  const box = document.createElement("div"); box.className = "mlmap mlmapB"; $("#mapWrap").insertBefore(box, $("#mlMap")); ML.boxB = box;
  const mb = new maplibregl.Map({ container: box, style: ML_STYLE, ...camML(cam), attributionControl: false, maxPitch: 70, minZoom: 8, maxZoom: 18 });
  mb.on("load", () => { mlSetup(mb, "L"); ML.mapB = mb; mlApplyTo(mb, "L"); mlPushCam(); });
  mb.on("move", () => { if (ML.pushing || !S.compare) return; ML.pushing = true; ML.map.jumpTo({ center: mb.getCenter(), zoom: mb.getZoom(), pitch: mb.getPitch(), bearing: mb.getBearing() }); ML.pushing = false; mlCamFromMap(mb); drawHud(); });
  new ResizeObserver(() => mb.resize()).observe(box);
}
// ---- interacción ----
function mlInteract(m) {
  const pick = e => {
    const p = e.point, box = [[p.x - 12, p.y - 12], [p.x + 12, p.y + 12]];
    const bus = m.queryRenderedFeatures(p, { layers: ["ml-bus"] })[0]; if (bus) return bus;
    const st = m.queryRenderedFeatures(box, { layers: ["ml-stations"] }).filter(f => f.properties.o > 0);
    if (st.length) { let best = null, bd = 1e9; st.forEach(f => { const q = m.project(f.geometry.coordinates), dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (dd < bd) { bd = dd; best = f; } }); return best; }
    return m.queryRenderedFeatures(p, { layers: ["ml-corr-hit"] })[0];
  };
  m.on("mousemove", e => {
    if (tipPinned) return;
    const f = pick(e); m.getCanvas().style.cursor = f ? "pointer" : "";
    const tipHtml = f ? (f.layer.id === "ml-bus" ? (sim.buses[f.properties.i] || {}).label : f.properties.tip) : null;
    if (tipHtml) showTip(tipHtml, e.originalEvent.clientX, e.originalEvent.clientY); else hideTip();
  });
  m.on("mouseout", () => hideTip());
  m.on("click", e => {
    const f = pick(e);
    if (!f) { hideTip(true); if (mode === "laboratorio" && !lab.failMode) select(null); return; }
    if (f.layer.id === "ml-bus") { const b = sim.buses[f.properties.i]; if (b) { sim.focus = b; showTip(b.label, e.originalEvent.clientX, e.originalEvent.clientY, true); } return; }
    if (f.layer.id === "ml-stations") select({ type: "node", id: f.properties.id });
    else select({ type: "corr", id: f.properties.id });
  });
  const stop = e => { if (!e.originalEvent) return; if ($("#camOrbit").getAttribute("aria-pressed") === "true") setOrbit(false); if (follow) setFollow(false); };
  m.on("dragstart", stop); m.on("rotatestart", stop); m.on("pitchstart", stop); m.on("zoomstart", stop);
  m.on("move", () => { if (ML.pushing) return; mlCamFromMap(m); drawHud(); if (!tipPinned) hideTip(); if (ML.mapB && S.compare) { ML.pushing = true; ML.mapB.jumpTo(camML(cam)); ML.pushing = false; } });
}
// ---- arranque ----
function mlInit() {
  if (typeof window.maplibregl === "undefined" || !$("#mapWrap")) return;
  const wrap = $("#mapWrap"), box = document.createElement("div");
  box.className = "mlmap"; box.id = "mlMap"; box.style.visibility = "hidden";
  wrap.insertBefore(box, $("#lbls"));
  let m;
  try { m = new maplibregl.Map({ container: box, style: ML_STYLE, ...camML(cam), attributionControl: { compact: true }, maxPitch: 70, minZoom: 8, maxZoom: 18 }); }
  catch (e) { box.remove(); return; }
  const giveUp = () => { if (ML.on) return; try { m.remove(); } catch (_) { } box.remove(); };
  // solo se abandona WebGL ante un error real del estilo (p. ej. visores que bloquean la red); las teselas sueltas que fallen no cuentan
  m.on("error", ev => { if (!ML.on && ev && ev.sourceId === undefined && !ev.tile) giveUp(); });
  m.on("load", () => {
    try {
      mlSetup(m, "R"); mlInteract(m);
      ML.map = m; ML.on = true;
      box.style.visibility = "";
      mapEl.style.visibility = "hidden"; mapEl.style.pointerEvents = "none"; $("#lbls").style.display = "none";
      wrap.classList.add("ml");
      new ResizeObserver(() => m.resize()).observe(box);
      apply(S); requestDraw();
    } catch (e) { console.warn("MapLibre no disponible, se usa el motor propio:", e); ML.on = false; ML.map = null; mapEl.style.visibility = ""; mapEl.style.pointerEvents = ""; $("#lbls").style.display = ""; giveUp(); }
  });
}
// arranca solo con la pestaña visible (en segundo plano el navegador no dibuja WebGL)
if (document.hidden) { const onVis = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", onVis); mlInit(); } }; document.addEventListener("visibilitychange", onVis); }
else mlInit();
