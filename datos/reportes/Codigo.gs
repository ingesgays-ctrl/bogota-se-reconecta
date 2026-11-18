/**
 * Reportes ciudadanos de "Bogotá se reconecta" → hoja de Google.
 * Se pega en la hoja (Extensiones → Apps Script) y se implementa como aplicación web
 * (Ejecutar como: yo · Quién tiene acceso: cualquier persona). Ver INSTRUCCIONES.md.
 *
 * doPost: recibe un reporte (JSON) desde la página y lo agrega como fila.
 * doGet:  devuelve los reportes publicables de los últimos 30 días (sin datos de contacto).
 * Moderación: en la columna "publicar" escribe "no" para ocultar un reporte del mapa.
 */
const HOJA = 'Reportes';
const COLUMNAS = ['id', 'recibido', 'fecha_hecho', 'tipo', 'estacion_id', 'estacion', 'ruta', 'descripcion', 'publicar', 'estado'];
const TIPOS = ['Seguridad', 'Accidente', 'Acoso', 'Infraestructura dañada', 'Bus o estación llena', 'Accesibilidad', 'Otro'];
const MAX_TEXTO = 500, MAX_POR_MINUTO = 30, DIAS_PUBLICOS = 30;

function hoja_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(HOJA) || ss.insertSheet(HOJA);
  if (sh.getLastRow() === 0) { sh.appendRow(COLUMNAS); sh.setFrozenRows(1); }
  return sh;
}
// evita que un texto se interprete como fórmula en la hoja (=, +, -, @)
function limpio_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.web) return json_({ ok: true });                       // campo trampa: lo llenan solo los robots
    if (TIPOS.indexOf(d.tipo) < 0) return json_({ ok: false, error: 'tipo' });
    if (!/^(E\d{1,3}|C[1-6](_Av68)?-\d{1,2})$/.test(String(d.estacion_id || ''))) return json_({ ok: false, error: 'estacion' });
    const texto = limpio_(d.descripcion, MAX_TEXTO);
    if (texto.length < 5) return json_({ ok: false, error: 'descripcion' });
    const cache = CacheService.getScriptCache(), k = 'n' + Math.floor(Date.now() / 60000), n = +(cache.get(k) || 0);
    if (n >= MAX_POR_MINUTO) return json_({ ok: false, error: 'limite' });
    cache.put(k, String(n + 1), 120);
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const id = Utilities.getUuid().slice(0, 8), ahora = new Date();
      let hecho = new Date(d.fecha_hecho); if (isNaN(hecho) || hecho > ahora) hecho = ahora;
      hoja_().appendRow([id, ahora, hecho, d.tipo, d.estacion_id, limpio_(d.estacion, 120), limpio_(d.ruta, 12), texto, 'sí', 'nuevo']);
      return json_({ ok: true, id: id });
    } finally { lock.releaseLock(); }
  } catch (err) { return json_({ ok: false, error: 'formato' }); }
}

function doGet() {
  const sh = hoja_(), n = sh.getLastRow() - 1;
  if (n < 1) return json_({ ok: true, reportes: [] });
  const desde = Date.now() - DIAS_PUBLICOS * 864e5, filas = sh.getRange(2, 1, n, COLUMNAS.length).getValues();
  const out = filas.filter(r => String(r[8]).toLowerCase() !== 'no' && new Date(r[2]).getTime() >= desde)
    .slice(-300).map(r => ({ id: r[0], recibido: r[1], fecha_hecho: r[2], tipo: r[3], estacion_id: r[4], estacion: r[5], ruta: r[6], descripcion: r[7], estado: r[9] }));
  return json_({ ok: true, reportes: out });
}
