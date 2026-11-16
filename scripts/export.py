"""Exporta los datos limpios a <repo>/datos. Uso: python3 -I export.py data.json fuente.md outdir"""
import json, csv, sys, math, heapq, collections
D = json.load(open(sys.argv[1])); src_md = sys.argv[2]; out = sys.argv[3]
open(f"{out}/fuente_de_verdad_datos.md", "w").write(open(src_md).read())
E = D["escenarios"]
with open(f"{out}/escenarios_kpi.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); keys = ["estaciones", "km", "viajes", "longitud", "tiempo", "carga", "vulnerabilidad", "puentes", "alivio"]
    w.writerow(["escenario", "estaciones_bogota", "km_adicionales", "viajes_pico_am", "longitud_media_km", "tiempo_medio_congestion_min", "carga_paloquemao_ricaurte_pax", "vulnerabilidad_ricaurte_pct", "puentes_topologicos", "alivio_nqs_pct"])
    for e in E: w.writerow([e["nombre"]] + [e[k] for k in keys])
fc = lambda feats: {"type": "FeatureCollection", "features": feats}
json.dump(fc([{"type": "Feature", "geometry": {"type": "LineString", "coordinates": c["coords"]},
  "properties": {k: c[k] for k in ["id", "nombre", "origen", "destino", "km_total", "km_nueva", "km_compartida", "estaciones_nuevas", "transbordos", "upl", "justificacion_topologica"]} | {"ejes_viales": " → ".join(c["ejes"])}} for c in D["corredores"]]),
  open(f"{out}/corredores_pot.geojson", "w"), ensure_ascii=False)
json.dump(fc([{"type": "Feature", "geometry": {"type": "Point", "coordinates": [e["lon"], e["lat"]]},
  "properties": {k: v for k, v in e.items() if k not in ("lat", "lon")}} for e in D["estaciones"]]), open(f"{out}/estaciones_pot.geojson", "w"), ensure_ascii=False)
N = {n["id"]: n for n in D["red"]["nodos"]}
json.dump(fc([{"type": "Feature", "geometry": {"type": "Point", "coordinates": [n["lon"], n["lat"]]}, "properties": {"id": n["id"], "nombre": n["nombre"], "municipio": n["municipio"]}} for n in D["red"]["nodos"]]
  + [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[N[a]["lon"], N[a]["lat"]], [N[b]["lon"], N[b]["lat"]]]}, "properties": {"desde": N[a]["nombre"], "hasta": N[b]["nombre"]}} for a, b in D["red"]["aristas"]]),
  open(f"{out}/red_troncal_actual.geojson", "w"), ensure_ascii=False)
# centralidad (misma definición que la página: Brandes ponderado por km, normalizada por (n-1)(n-2))
pos = {n["id"]: (n["lat"], n["lon"]) for n in D["red"]["nodos"]}; nm = {n["id"]: n["nombre"] for n in D["red"]["nodos"]}
for e in D["estaciones"]:
    if e["estado"] == "Aprobada_Nueva": pos[e["id"]] = (e["lat"], e["lon"]); nm[e["id"]] = e["nombre"]
def hav(a, b):
    (la1, lo1), (la2, lo2) = pos[a], pos[b]; p1, p2 = math.radians(la1), math.radians(la2)
    return 2 * 6371 * math.asin(math.sqrt(math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2))
def graph(cids):
    g = collections.defaultdict(dict)
    for n in D["red"]["nodos"]: g[n["id"]]
    for a, b in D["red"]["aristas"]: g[a][b] = g[b][a] = hav(a, b)
    for c in D["corredores"]:
        if c["id"] in cids:
            for a, b in zip(c["path"], c["path"][1:]):
                if a != b: g[a][b] = g[b][a] = hav(a, b)
    return g
def betw(g):
    V = list(g); C = dict.fromkeys(V, 0.0)
    for s in V:
        S = []; P = {v: [] for v in V}; sig = dict.fromkeys(V, 0); sig[s] = 1; d = dict.fromkeys(V, math.inf); d[s] = 0; Q = [(0, s)]; done = set()
        while Q:
            dv, v = heapq.heappop(Q)
            if v in done or dv > d[v]: continue
            done.add(v); S.append(v)
            for w, wt in g[v].items():
                nd = dv + wt
                if nd < d[w] - 1e-9: d[w] = nd; heapq.heappush(Q, (nd, w)); sig[w] = sig[v]; P[w] = [v]
                elif abs(nd - d[w]) < 1e-9: sig[w] += sig[v]; P[w].append(v)
        dl = dict.fromkeys(V, 0)
        for w in reversed(S):
            for v in P[w]: dl[v] += sig[v] / sig[w] * (1 + dl[w])
            if w != s: C[w] += dl[w]
    n = len(V); return {k: v / ((n - 1) * (n - 2)) for k, v in C.items()}
B = [betw(graph(e["corredores"])) for e in E]
ids = sorted(pos, key=lambda i: -B[3].get(i, 0))
with open(f"{out}/centralidad_por_escenario.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["id", "estacion", "centralidad_pct_esc0", "centralidad_pct_esc1", "centralidad_pct_esc2", "centralidad_pct_esc3"])
    for i in ids: w.writerow([i, nm[i]] + [round(b[i] * 100, 2) if i in b else "" for b in B])
print("top esc0:", [(nm[i], round(B[0][i] * 100, 1)) for i in sorted(B[0], key=lambda i: -B[0][i])[:3]])
