// GENERADO desde src/gtfsrt.js por npm run build — no editar a mano
// Decodificador GTFS Realtime sin dependencias (protobuf wire format → objetos JS).
// Lo usan el navegador (si el feed llega como .pb) y el puente backend (bridge/), que lo importa como módulo.
// Campos según https://gtfs.org/documentation/realtime/proto/
const GTFSRT = (() => {
  const td = new TextDecoder();
  // lector mínimo de protobuf
  function reader(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = 0;
    // varint: devuelve [valor sin signo (Number, exacto hasta 2^53), 32 bits bajos con signo]
    const varint = () => {
      let v = 0, mul = 1, lo = 0, shift = 0, b;
      do { b = u8[p++]; v += (b & 0x7f) * mul; mul *= 128; if (shift < 32) lo |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80 && p < u8.length);
      return [v, lo | 0];
    };
    return {
      get done() { return p >= u8.length; },
      tag() { const [v] = varint(); return [Math.floor(v / 8), v % 8]; },
      uint() { return varint()[0]; },
      int32() { return varint()[1]; },
      float() { const v = dv.getFloat32(p, true); p += 4; return v; },
      double() { const v = dv.getFloat64(p, true); p += 8; return v; },
      bytes() { const [n] = varint(); const s = u8.subarray(p, p + n); p += n; return s; },
      str() { return td.decode(this.bytes()); },
      skip(wt) { if (wt === 0) varint(); else if (wt === 1) p += 8; else if (wt === 2) { const [n] = varint(); p += n; } else if (wt === 5) p += 4; else throw new Error("wire type " + wt); },
    };
  }
  // recorre un mensaje llamando a fn(campo, tipo, lector); fn devuelve false si no consumió el campo
  function msg(buf, fn) { const r = reader(buf); while (!r.done) { const [f, wt] = r.tag(); if (fn(f, wt, r) === false) r.skip(wt); } }

  const trip = b => { const o = {}; msg(b, (f, wt, r) => { if (f === 1 && wt === 2) o.trip_id = r.str(); else if (f === 5 && wt === 2) o.route_id = r.str(); else if (f === 6 && wt === 0) o.direction_id = r.uint(); else if (f === 2 && wt === 2) o.start_time = r.str(); else if (f === 3 && wt === 2) o.start_date = r.str(); else return false; }); return o; };
  const vdesc = b => { const o = {}; msg(b, (f, wt, r) => { if (f === 1 && wt === 2) o.id = r.str(); else if (f === 2 && wt === 2) o.label = r.str(); else if (f === 3 && wt === 2) o.plate = r.str(); else return false; }); return o; };
  const position = b => { const o = {}; msg(b, (f, wt, r) => { if (wt !== 5 && wt !== 1) return false; const v = wt === 5 ? r.float() : r.double(); if (f === 1) o.lat = v; else if (f === 2) o.lon = v; else if (f === 3) o.bearing = v; else if (f === 5) o.speed = v; }); return o; };
  const STATUS = ["INCOMING_AT", "STOPPED_AT", "IN_TRANSIT_TO"];
  const CONG = ["UNKNOWN", "RUNNING_SMOOTHLY", "STOP_AND_GO", "CONGESTION", "SEVERE_CONGESTION"];
  const OCC = ["EMPTY", "MANY_SEATS_AVAILABLE", "FEW_SEATS_AVAILABLE", "STANDING_ROOM_ONLY", "CRUSHED_STANDING_ROOM_ONLY", "FULL", "NOT_ACCEPTING_PASSENGERS"];
  const vehicle = b => {
    const o = {};
    msg(b, (f, wt, r) => {
      if (f === 1 && wt === 2) o.trip = trip(r.bytes());
      else if (f === 8 && wt === 2) o.vehicle = vdesc(r.bytes());
      else if (f === 2 && wt === 2) o.position = position(r.bytes());
      else if (f === 3 && wt === 0) o.stop_seq = r.uint();
      else if (f === 7 && wt === 2) o.stop_id = r.str();
      else if (f === 4 && wt === 0) o.status = STATUS[r.uint()];
      else if (f === 5 && wt === 0) o.timestamp = r.uint();
      else if (f === 6 && wt === 0) o.congestion = CONG[r.uint()];
      else if (f === 9 && wt === 0) o.occupancy = OCC[r.uint()];
      else return false;
    });
    return o;
  };
  const stEvent = b => { const o = {}; msg(b, (f, wt, r) => { if (f === 1 && wt === 0) o.delay = r.int32(); else if (f === 2 && wt === 0) o.time = r.uint(); else return false; }); return o; };
  const stu = b => { const o = {}; msg(b, (f, wt, r) => { if (f === 1 && wt === 0) o.stop_seq = r.uint(); else if (f === 4 && wt === 2) o.stop_id = r.str(); else if (f === 2 && wt === 2) o.arrival = stEvent(r.bytes()); else if (f === 3 && wt === 2) o.departure = stEvent(r.bytes()); else return false; }); return o; };
  const tripUpdate = b => {
    const o = { stops: [] };
    msg(b, (f, wt, r) => {
      if (f === 1 && wt === 2) o.trip = trip(r.bytes());
      else if (f === 3 && wt === 2) o.vehicle = vdesc(r.bytes());
      else if (f === 2 && wt === 2) o.stops.push(stu(r.bytes()));
      else if (f === 4 && wt === 0) o.timestamp = r.uint();
      else if (f === 5 && wt === 0) o.delay = r.int32();
      else return false;
    });
    // retraso del viaje: el campo delay o el de la primera parada pendiente
    if (o.delay === undefined) { const s = o.stops.find(s => (s.arrival && s.arrival.delay !== undefined) || (s.departure && s.departure.delay !== undefined)); if (s) o.delay = (s.arrival && s.arrival.delay !== undefined ? s.arrival : s.departure).delay; }
    return o;
  };
  const tstr = b => { const t = []; msg(b, (f, wt, r) => { if (f !== 1 || wt !== 2) return false; const o = {}; msg(r.bytes(), (g, wt2, r2) => { if (g === 1 && wt2 === 2) o.text = r2.str(); else if (g === 2 && wt2 === 2) o.lang = r2.str(); else return false; }); t.push(o); }); const es = t.find(x => (x.lang || "").startsWith("es")) || t[0]; return es ? es.text : ""; };
  const CAUSE = [, "UNKNOWN_CAUSE", "OTHER_CAUSE", "TECHNICAL_PROBLEM", "STRIKE", "DEMONSTRATION", "ACCIDENT", "HOLIDAY", "WEATHER", "MAINTENANCE", "CONSTRUCTION", "POLICE_ACTIVITY", "MEDICAL_EMERGENCY"];
  const EFFECT = [, "NO_SERVICE", "REDUCED_SERVICE", "SIGNIFICANT_DELAYS", "DETOUR", "ADDITIONAL_SERVICE", "MODIFIED_SERVICE", "OTHER_EFFECT", "UNKNOWN_EFFECT", "STOP_MOVED", "NO_EFFECT", "ACCESSIBILITY_ISSUE"];
  const alert = b => {
    const o = { routes: [], stops: [], periods: [] };
    msg(b, (f, wt, r) => {
      if (f === 1 && wt === 2) { const p = {}; msg(r.bytes(), (g, w, r2) => { if (g === 1 && w === 0) p.start = r2.uint(); else if (g === 2 && w === 0) p.end = r2.uint(); else return false; }); o.periods.push(p); }
      else if (f === 5 && wt === 2) msg(r.bytes(), (g, w, r2) => { if (g === 2 && w === 2) o.routes.push(r2.str()); else if (g === 5 && w === 2) o.stops.push(r2.str()); else if (g === 4 && w === 2) { const t = trip(r2.bytes()); if (t.route_id) o.routes.push(t.route_id); } else return false; });
      else if (f === 6 && wt === 0) o.cause = CAUSE[r.uint()];
      else if (f === 7 && wt === 0) o.effect = EFFECT[r.uint()];
      else if (f === 10 && wt === 2) o.header = tstr(r.bytes());
      else if (f === 11 && wt === 2) o.description = tstr(r.bytes());
      else return false;
    });
    return o;
  };
  // FeedMessage completo
  function decode(buf) {
    const out = { timestamp: 0, vehicles: [], tripUpdates: [], alerts: [] };
    msg(buf, (f, wt, r) => {
      if (f === 1 && wt === 2) msg(r.bytes(), (g, w, r2) => { if (g === 3 && w === 0) out.timestamp = r2.uint(); else return false; });
      else if (f === 2 && wt === 2) {
        let id = "", del = false, v = null, t = null, a = null;
        msg(r.bytes(), (g, w, r2) => {
          if (g === 1 && w === 2) id = r2.str(); else if (g === 2 && w === 0) del = !!r2.uint();
          else if (g === 3 && w === 2) t = tripUpdate(r2.bytes()); else if (g === 4 && w === 2) v = vehicle(r2.bytes()); else if (g === 5 && w === 2) a = alert(r2.bytes());
          else return false;
        });
        if (del) return;
        if (v) out.vehicles.push({ entity: id, ...v }); if (t) out.tripUpdates.push({ entity: id, ...t }); if (a) out.alerts.push({ entity: id, ...a });
      } else return false;
    });
    return out;
  }
  // une posiciones, retrasos y alertas en el JSON compacto que consume el laboratorio
  function toLive(vp, tu, al, routeNames) {
    const name = id => (routeNames && routeNames[id]) || id || "";
    const delayByTrip = new Map(), delayByVeh = new Map();
    (tu ? tu.tripUpdates : []).forEach(u => { if (u.delay === undefined) return; if (u.trip && u.trip.trip_id) delayByTrip.set(u.trip.trip_id, u.delay); if (u.vehicle && u.vehicle.id) delayByVeh.set(u.vehicle.id, u.delay); });
    const vehicles = (vp ? vp.vehicles : []).filter(v => v.position && isFinite(v.position.lat) && isFinite(v.position.lon) && v.position.lat !== 0).map(v => {
      const id = (v.vehicle && (v.vehicle.id || v.vehicle.label)) || v.entity, t = v.trip || {};
      const delay = delayByVeh.has(id) ? delayByVeh.get(id) : delayByTrip.get(t.trip_id);
      return { id, lat: +v.position.lat.toFixed(6), lon: +v.position.lon.toFixed(6), bearing: v.position.bearing, speed: v.position.speed, route_id: t.route_id || "", route: name(t.route_id), dir: t.direction_id, trip: t.trip_id, stop_id: v.stop_id, ts: v.timestamp || (vp && vp.timestamp), delay, congestion: v.congestion, occupancy: v.occupancy, label: v.vehicle && v.vehicle.label };
    });
    const now = Date.now() / 1000;
    const alerts = (al ? al.alerts : []).filter(a => !a.periods.length || a.periods.some(p => (!p.start || p.start <= now) && (!p.end || p.end >= now))).map(a => ({ id: a.entity, header: a.header, description: a.description, effect: a.effect, cause: a.cause, routes: a.routes.map(name), stops: a.stops }));
    return { source: "gtfs-rt", ts: (vp && vp.timestamp) || Math.round(now), vehicles, alerts };
  }
  return { decode, toLive };
})();

export default GTFSRT;
