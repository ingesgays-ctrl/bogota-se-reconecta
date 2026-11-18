// ---------- reportes ciudadanos (pestaña "Reportar") ----------
// Los reportes van a una hoja de Google a través de un Apps Script publicado como aplicación web
// (datos/reportes/Codigo.gs e INSTRUCCIONES.md). REPORTES_URL es la URL /exec de esa aplicación.
// Sin URL, la pestaña funciona igual y guarda los reportes solo en este navegador.
const REPORTES_URL = "";
const REP = {
  tipos: [["Seguridad", "🛡️"], ["Accidente", "🚑"], ["Acoso", "✋"], ["Infraestructura dañada", "🔧"], ["Bus o estación llena", "👥"], ["Accesibilidad", "♿"], ["Otro", "✎"]],
  lista: [], porEst: new Map(), estado: "", sel: { tipo: "", est: "" }, ultimo: 0,
};
const repUrl = () => { try { return localStorage.getItem("tm-rep-url") || REPORTES_URL; } catch (_) { return REPORTES_URL; } };
const repIcon = t => (REP.tipos.find(x => x[0] === t) || ["", "•"])[1];
const repLocal = () => { try { return JSON.parse(localStorage.getItem("tm-reportes") || "[]"); } catch (_) { return []; } };
const repLocalSave = a => { try { localStorage.setItem("tm-reportes", JSON.stringify(a.slice(-200))); } catch (_) { } };
function repHace(t) {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  return m < 1 ? "hace un momento" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
}
function repIndex() {
  REP.porEst = new Map();
  REP.lista.forEach(r => REP.porEst.set(r.estacion_id, (REP.porEst.get(r.estacion_id) || 0) + 1));
  // insignia con el número de reportes en cada estación (mapa SVG); el mapa vectorial la toma de REP.porEst
  MK.forEach((g, id) => {
    let b = g.querySelector(".rep-b"); const n = REP.porEst.get(id) || 0;
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = svgEl("g", { class: "rep-b" }, g); svgEl("circle", { cx: 8, cy: -8, r: 6.5 }, b); svgEl("text", { x: 8, y: -5.2 }, b); }
    b.querySelector("text").textContent = n > 9 ? "9+" : n;
  });
}
async function repCargar() {
  const url = repUrl(); let remotos = [];
  if (url) {
    try { const r = await fetch(url, { cache: "no-store" }); const j = await r.json(); if (j.ok) remotos = j.reportes; REP.estado = "ok"; await repReintentar(url); }
    catch (_) { REP.estado = "sin conexión"; }
  } else REP.estado = "local";
  const ids = new Set(remotos.map(r => r.id));
  REP.lista = [...remotos, ...repLocal().filter(r => !ids.has(r.id) && (!url || r.pendiente))]
    .filter(r => Date.now() - new Date(r.fecha_hecho).getTime() < 30 * 864e5)
    .sort((a, b) => new Date(b.fecha_hecho) - new Date(a.fecha_hecho));
  repIndex(); repRender(); if (typeof ML !== "undefined" && ML.on) mlApply();
}
// reportes que quedaron pendientes por falta de conexión: se reenvían cuando la hoja responde
async function repReintentar(url) {
  const loc = repLocal(); let cambio = false;
  for (const r of loc.filter(x => x.pendiente)) {
    try { const res = await fetch(url, { method: "POST", body: JSON.stringify(r) }); const j = await res.json(); if (j.ok) { r.pendiente = false; if (j.id) r.id = j.id; cambio = true; } } catch (_) { break; }
  }
  if (cambio) repLocalSave(loc);
}
function repRender() {
  const box = $("#repList"); if (!box) return;
  const est = REP.estado === "local" ? `<p class="rep-aviso">Los reportes todavía no están conectados a la hoja de Google: por ahora quedan guardados solo en este navegador.</p>`
    : REP.estado === "sin conexión" ? `<p class="rep-aviso">No se pudo leer la lista de reportes. Revisa tu conexión e inténtalo de nuevo.</p>` : "";
  const cuenta = REP.tipos.map(([t, i]) => { const n = REP.lista.filter(r => r.tipo === t).length; return n ? `<span class="rep-c">${i} ${esc(t)} <b>${n}</b></span>` : ""; }).join("");
  box.innerHTML = est + (REP.lista.length ? `<div class="rep-cs">${cuenta}</div><ul class="rep-ul">${REP.lista.slice(0, 40).map(r => {
    const n = NODE.get(r.estacion_id);
    return `<li><button type="button" data-rep-go="${esc(r.estacion_id)}"><span class="rep-i">${repIcon(r.tipo)}</span><span><b>${esc(r.tipo)}</b> · ${esc(n ? n.nombre : r.estacion)}${r.ruta ? ` · ruta ${esc(r.ruta)}` : ""}<small>${repHace(r.fecha_hecho)}${r.pendiente ? " · pendiente de envío" : ""}</small><span class="rep-d">${esc(r.descripcion)}</span></span></button></li>`;
  }).join("")}</ul>` : `<p class="hint">No hay reportes en los últimos 30 días.</p>`);
}
function repFormInit() {
  $("#repTipos").innerHTML = REP.tipos.map(([t, i]) => `<button type="button" class="rep-t" data-rep-t="${esc(t)}" aria-pressed="false"><span>${i}</span>${esc(t)}</button>`).join("");
  $("#repTipos").addEventListener("click", ev => { const b = ev.target.closest("[data-rep-t]"); if (!b) return; REP.sel.tipo = b.dataset.repT;
    $("#repTipos").querySelectorAll("[data-rep-t]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  makeAC($("#repEst"), { oldOnly: true, onPick: id => { REP.sel.est = id; }, onClear: () => { REP.sel.est = ""; } });
  $("#repUsarSel").onclick = () => { const s = lab.sel; if (s && s.type === "node" && NODE.get(s.id) && NODE.get(s.id).kind === "old") { REP.sel.est = s.id; $("#repEst").value = NODE.get(s.id).nombre; } else repMsg("Primero toca una estación en el mapa.", "bad"); };
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); $("#repCuando").value = d.toISOString().slice(0, 16);
  $("#repTxt").addEventListener("input", () => { $("#repN").textContent = `${$("#repTxt").value.length}/500`; });
  $("#repForm").addEventListener("submit", ev => { ev.preventDefault(); repEnviar(); });
  $("#repList").addEventListener("click", ev => { const b = ev.target.closest("[data-rep-go]"); if (!b) return; const n = NODE.get(b.dataset.repGo); if (!n) return;
    lab.sel = { type: "node", id: n.id }; apply(labState()); if (lab.view === "map") flyTo({ ...cam, ...fit([[n.lon, n.lat]], { pitch: cam.pitch || 0, rot: cam.rot, dz: -1.2 }) }, 900); });
  $("#repRefrescar").onclick = () => repCargar();
  const u = $("#repUrlDev"); if (u) { u.value = repUrl(); u.addEventListener("change", () => { try { u.value ? localStorage.setItem("tm-rep-url", u.value.trim()) : localStorage.removeItem("tm-rep-url"); } catch (_) { } repCargar(); }); }
  $("#repMapa").addEventListener("change", () => { document.body.classList.toggle("rep-on", $("#repMapa").checked); if (ML.on) mlApply(); });
  document.body.classList.add("rep-on");
}
function repMsg(t, cls = "") { const m = $("#repMsg"); m.className = "rep-msg " + cls; m.textContent = t; }
async function repEnviar() {
  if (!REP.sel.tipo) return repMsg("Elige qué pasó.", "bad");
  if (!REP.sel.est) return repMsg("Elige la estación de la lista.", "bad");
  const txt = $("#repTxt").value.trim(); if (txt.length < 5) return repMsg("Cuéntanos un poco más (mínimo 5 caracteres).", "bad");
  if (Date.now() - REP.ultimo < 60000) return repMsg("Espera un minuto antes de enviar otro reporte.", "bad");
  const n = NODE.get(REP.sel.est), cuando = new Date($("#repCuando").value || Date.now());
  const r = { tipo: REP.sel.tipo, estacion_id: n.id, estacion: n.nombre, ruta: $("#repRuta").value.trim().toUpperCase().slice(0, 12), descripcion: txt.slice(0, 500),
    fecha_hecho: (isNaN(cuando) || cuando > new Date() ? new Date() : cuando).toISOString(), web: $("#repWeb").value };
  const btn = $("#repBtn"); btn.disabled = true; repMsg("Enviando…");
  const url = repUrl(); let ok = false, id = "L" + Date.now().toString(36);
  if (url) {
    try { const res = await fetch(url, { method: "POST", body: JSON.stringify(r) }); const j = await res.json(); ok = !!j.ok; if (j.id) id = j.id;
      if (!ok) repMsg(j.error === "limite" ? "Hay muchos reportes en este momento. Inténtalo en un minuto." : "No se pudo guardar el reporte. Revisa los datos.", "bad"); }
    catch (_) { ok = false; }
  }
  const loc = repLocal(); loc.push({ ...r, id, web: undefined, recibido: new Date().toISOString(), pendiente: !!url && !ok }); repLocalSave(loc);
  btn.disabled = false; REP.ultimo = Date.now();
  if (ok || !url) {
    repMsg(url ? "¡Gracias! Tu reporte quedó registrado." : "Reporte guardado en este navegador.", "good");
    $("#repTxt").value = ""; $("#repRuta").value = ""; $("#repN").textContent = "0/500";
  } else if (url && !$("#repMsg").classList.contains("bad")) repMsg("Sin conexión: el reporte quedó guardado aquí y aparece como pendiente.", "bad");
  repCargar();
}
repFormInit(); repCargar();
setInterval(() => { if (!document.hidden && repUrl()) repCargar(); }, 5 * 60000);
