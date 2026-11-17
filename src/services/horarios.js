// =====================================================================
// Horarios oficiales de los servicios (Guía General de viaje TransMilenio, corte agosto 2026)
// Solo se usan los HORARIOS: rutas y paradas son las del Excel del modelo. Las variantes
// "Operación durante Ciclovía" (domingos y festivos 7:00 a.m.–2:00 p.m.) usan su propio recorrido,
// reducido a las estaciones TransMilenio del modelo (datos/horarios_servicios.json).
// =====================================================================
const HOR = (window.HORARIOS && window.HORARIOS.servicios) || {};
// festivos nacionales 2026 (Ley Emiliani; incluye el nuevo festivo de Chiquinquirá, trasladado al 13 de julio)
const FESTIVOS = new Set(["2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
  "2026-07-13", "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25"]);
const DIA_TXT = { lv: "lunes a viernes", s: "sábado", df: "domingo o festivo" };
const DIAS_FILA = { "L-V": ["lv"], "L-S": ["lv", "s"], "S": ["s"], "L-D": ["lv", "s", "df"], "D-F": ["df"] };
const DIAS_FILA_TXT = { "L-V": "lun–vie", "L-S": "lun–sáb", "S": "sáb", "L-D": "todos los días", "D-F": "dom y festivos" };
// horario general del sistema (más temprano y más tarde de la guía): se asume para los corredores propuestos
const SIS = (() => { let a = 1440, b = 0; Object.values(HOR).forEach(rs => rs.forEach(r => { if (!r.ciclovia) { a = Math.min(a, r.desde); b = Math.max(b, r.hasta); } })); return a < b ? { desde: a, hasta: b } : { desde: 240, hasta: 1380 }; })();
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? "a. m." : "p. m."; return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${ap}`; };
// hora actual en Bogotá
function whenNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const fecha = `${p.year}-${p.month}-${p.day}`, h = +p.hour % 24;
  const dia = FESTIVOS.has(fecha) || p.weekday === "Sun" ? "df" : p.weekday === "Sat" ? "s" : "lv";
  return { dia, min: h * 60 + +p.minute, ahora: true, festivo: FESTIVOS.has(fecha) };
}
// cuándo viaja la persona: lab.when (elegido) o ahora; solo en el laboratorio
const TRIP_WHEN = () => { try { return mode === "laboratorio" ? (lab.when || whenNow()) : null; } catch (_) { return null; } };
const whenKey = w => w ? `${w.dia}@${Math.floor(w.min / 5)}` : "";
// estado de un servicio a una hora: si opera, con qué fila del horario y (en Ciclovía) con qué paradas
function svcState(cod, w, t = w.min) {
  const rs = HOR[cod]; if (!rs) return { on: true, sinDato: true };
  const hoy = rs.filter(r => DIAS_FILA[r.dias] && DIAS_FILA[r.dias].includes(w.dia));
  const ciclo = hoy.find(r => r.ciclovia && t >= r.desde && t < r.hasta);
  if (ciclo) return { on: true, fila: ciclo, ciclo };
  const fila = hoy.find(r => !r.ciclovia && t >= r.desde && t < r.hasta);
  if (fila) return { on: true, fila };
  const next = hoy.filter(r => !r.ciclovia && r.desde > t).sort((a, b) => a.desde - b.desde)[0];
  return { on: false, next, hoy: hoy.filter(r => !r.ciclovia), sinServicioHoy: !hoy.some(r => !r.ciclovia) };
}
const SVC_CICLO = new Map();   // índice de paradas de la variante de Ciclovía
function svcAt(sv, w) {
  if (!w) return sv;
  if (sv.corr) return (w.min >= SIS.desde && w.min < SIS.hasta) ? Object.assign(Object.create(sv), { horario: `corredor propuesto: se asume el horario general del sistema (${hhmm(SIS.desde)}–${hhmm(SIS.hasta)})` }) : null;
  const st = svcState(sv.cod, w); if (!st.on) return null;
  if (st.ciclo) {
    const k = sv.cod; if (!SVC_CICLO.has(k)) SVC_CICLO.set(k, Object.assign(Object.create(sv), { idx: new Map(st.ciclo.paradas.map((id, i) => [id, i])), ciclo: true }));
    return Object.assign(Object.create(SVC_CICLO.get(k)), { fila: st.fila });
  }
  return st.sinDato ? sv : Object.assign(Object.create(sv), { fila: st.fila });
}
const filaTxt = f => f ? `${DIAS_FILA_TXT[f.dias]} ${hhmm(f.desde)}–${hhmm(f.hasta)}` : "";
// franja del modelo según la hora (picos de día hábil; sábados, domingos y festivos se tratan como valle)
const franjaDe = w => w.dia !== "lv" ? "valle" : (w.min >= 360 && w.min < 540) ? "am" : (w.min >= 990 && w.min < 1170) ? "pm" : "valle";

// línea de horario de un tramo del itinerario (t = hora estimada en que se toma el bus)
function legHorarioHTML(l, t, w) {
  const sv = l.sv;
  if (sv.cod === "—") return "";
  if (sv.sinHora) return `<span class="hor bad">⛔ A esa hora no pasa ${sv.corr ? "este corredor" : "la ruta " + esc(sv.cod)} por este tramo${sv.next ? `: empieza a las ${hhmm(sv.next.desde)}` : ` ${w.dia === "df" ? "los domingos y festivos" : w.dia === "s" ? "los sábados" : "entre semana"} después de esa hora`}</span>`;
  if (sv.horario) return `<span class="hor">🕒 ${esc(sv.horario)}</span>`;
  const f = sv.fila; if (!f) return "";
  const tt = Math.round(t), rest = f.hasta - tt;
  if (tt >= f.hasta) return `<span class="hor bad">⛔ Llegarías a las ${hhmm(tt)} y el último bus de la ruta ${esc(sv.cod)} pasa antes de las ${hhmm(f.hasta)}.</span>`;
  return `<span class="hor${rest <= 30 ? " warn" : ""}">🕒 ${sv.ciclo ? "Recorrido de Ciclovía · " : ""}${filaTxt(f)}${rest <= 30 ? ` · ¡últimos buses! (tomas el bus hacia las ${hhmm(tt)})` : ""}</span>`;
}
// resumen del horario para la caja de franja del panel de viaje
function whenHTML(r) {
  if (!r || !r.when) return "";
  const w = r.when, sin = r.legs.filter(l => l.sv.sinHora);
  let t = w.min, tarde = 0;
  const P = r.path;
  r.legs.forEach((l, i) => { const seg = P.slice(P.indexOf(l.from), P.indexOf(l.to) + 1); if (l.sv.fila && t >= l.sv.fila.hasta) tarde++; t += (i ? TRANSFER_MIN : 0) + bprRide(r.esc, seg); });
  const fuera = w.min < SIS.desde || w.min >= SIS.hasta;
  return `<div class="when-sum ${sin.length || tarde ? "bad" : ""}">${w.ahora ? "Sales ahora" : "Sales"} (${DIA_TXT[w.dia]}${w.festivo ? ", festivo" : ""}, ${hhmm(w.min)})${fuera ? ` · el sistema troncal opera aprox. de ${hhmm(SIS.desde)} a ${hhmm(SIS.hasta)}` : ""}${sin.length ? ` · ${sin.length} ${sin.length === 1 ? "tramo sin bus" : "tramos sin bus"} a esa hora` : tarde ? " · llegarías después del último bus en algún tramo" : " · todas las rutas del viaje están operando"}</div>`;
}
