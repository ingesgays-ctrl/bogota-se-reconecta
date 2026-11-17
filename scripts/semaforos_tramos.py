# Semáforos por tramo para el modelo de congestión del visor → datos/semaforos_tramos.json
# Entradas:
#   datos/semaforos_osm.json                   nodos highway=traffic_signals / crossing=traffic_signals de OpenStreetMap
#                                              (descargados por .github/workflows/semaforos_osm.yml)
#   public/data/tramos_viales_bogota.geojson   trazado vial de los 146 tramos de la red actual
#   src/data.json                              trazado de los corredores nuevos (coords)
#   datos/gtfs/oferta_tramos_gtfs.csv          buses/h programados por tramo y franja (GTFS día hábil)
# Método: un semáforo cuenta para un tramo si está a ≤ 25 m de su trazado. Los nodos a ≤ 40 m entre sí a lo largo del
# tramo se agrupan en una sola intersección, y se descartan los que quedan a < 60 m de una estación (plataforma).
# Para cada intersección se guarda su distancia al semáforo o estación anterior (m): el visor la usa para la pérdida
# por frenar y arrancar. Uso: python3 -I scripts/semaforos_tramos.py
import json, math, collections, csv, os
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = json.load(open(f"{B}/datos/semaforos_osm.json"))
T = json.load(open(f"{B}/public/data/tramos_viales_bogota.geojson"))
D = json.load(open(f"{B}/src/data.json"))
kx, ky = 111320 * math.cos(math.radians(4.65)), 110540
P = lambda lo, la: (lo * kx, la * ky)
grid = collections.defaultdict(list)
for n in S["nodos"]:
    x, y = P(n[2], n[1]); grid[(int(x // 100), int(y // 100))].append((x, y, n[0]))
def segd(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t
def signals_on(coords, ends_m=60):
    pts = [P(*c) for c in coords]; cum = [0.0]
    for i in range(1, len(pts)): cum.append(cum[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    cells = set()
    for i in range(1, len(pts)):
        n = int(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) // 50) + 1
        for s in range(n + 1):
            x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * s / n; y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * s / n
            cells.update((int(x // 100) + dx, int(y // 100) + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    hits, seen = [], set()
    for c in cells:
        for x, y, oid in grid.get(c, ()):
            if oid in seen: continue
            best = min((segd((x, y), pts[i - 1], pts[i]) + (i,) for i in range(1, len(pts))), key=lambda r: r[0])
            if best[0] <= 25: seen.add(oid); i = best[2]; hits.append(cum[i - 1] + best[1] * (cum[i] - cum[i - 1]))
    hits.sort(); grp = []
    for h in hits:
        if grp and h - grp[-1][-1] <= 40: grp[-1].append(h)
        else: grp.append([h])
    L = cum[-1]; pos = [sum(g) / len(g) for g in grp]
    return L, [p for p in pos if ends_m < p < L - ends_m]
out = {"fuente": f"OpenStreetMap (Overpass, base {S['osm_base']}), {len(S['nodos'])} nodos de semáforo", "tramos": {}, "corredores": {}, "bus_h": {}}
for f in T["features"]:
    L, pos = signals_on(f["geometry"]["coordinates"])
    prev = 0; sp = []
    for p in pos: sp.append(round(p - prev)); prev = p
    out["tramos"][f["properties"]["k"]] = sp
for c in D["corredores"]:
    L, pos = signals_on(c["coords"])
    out["corredores"][c["id"]] = {"km": round(L / 1000, 3), "intersecciones": len(pos), "por_km": round(len(pos) / (L / 1000), 3)}
# buses/h programados por tramo físico (máximo de los dos sentidos) y franja
bh = collections.defaultdict(dict)
for r in csv.DictReader(open(f"{B}/datos/gtfs/oferta_tramos_gtfs.csv", encoding="utf-8")):
    k = "|".join(sorted([r["desde"], r["hasta"]]))
    bh[r["franja"]][k] = max(bh[r["franja"]].get(k, 0), round(float(r["buses_hora_programados"]), 1))
out["bus_h"] = bh
json.dump(out, open(f"{B}/datos/semaforos_tramos.json", "w"), ensure_ascii=False, separators=(",", ":"))
n = sum(len(v) for v in out["tramos"].values())
print("intersecciones en la red actual:", n, "· tramos sin semáforo:", sum(1 for v in out["tramos"].values() if not v), "· corredores:", out["corredores"])
