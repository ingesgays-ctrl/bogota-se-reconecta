# Integra la oferta GTFS completa de día hábil (GTFS_20261013, agency_id 1 troncal, todos los service_id con
# lunes–viernes = 1 en calendar.txt) con el grafo del visor (143 nodos, 146 tramos). La matriz base del grafo NO se
# modifica: la topología corregida del ramal sur y los enlaces operacionales viven solo en esta capa de oferta.
# Entradas (datos/gtfs/):
#   matriz_arcos_gtfs_habil_completo.csv   2.173 arcos dirigidos × 3 franjas, distancia_km desde shape_dist_traveled
#   catalogo_estaciones_gtfs_coords.csv    143 estaciones con lat/lon GTFS
#   shapes.txt (argumento opcional; 46 MB, no se versiona) trazados oficiales para repartir los saltos expresos
# Salidas (datos/gtfs/):
#   equivalencias_gtfs_grafo.csv  station_id → nodo del grafo, distancia GTFS↔grafo, método y confianza
#   oferta_tramos_gtfs.csv        buses/h programados por tramo dirigido y franja (expresos repartidos por su trazado)
#   arcos_proyeccion_gtfs.csv     cada arco GTFS con su camino de nodos, método, velocidad y si sirve para calibrar
#   validacion_gtfs.json          cifras y hallazgos en formato máquina
# Uso: python3 -I scripts/gtfs_integrar.py [ruta/a/shapes.txt]
import csv, json, heapq, collections, math, os, sys
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); G = f"{B}/datos/gtfs"
R = list(csv.DictReader(open(f"{G}/matriz_arcos_gtfs_habil_completo.csv", encoding="utf-8")))
CAT = {r["station_id"]: r for r in csv.DictReader(open(f"{G}/catalogo_estaciones_gtfs_coords.csv", encoding="utf-8"))}
D = json.load(open(f"{B}/src/data.json")); N = {n["id"]: n for n in D["red"]["nodos"]}
hav = lambda la1, lo1, la2, lo2: 2 * 6371 * math.asin(math.sqrt(math.sin(math.radians(la2 - la1) / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(math.radians(lo2 - lo1) / 2) ** 2))
ek = lambda a, b: a + "|" + b if a < b else b + "|" + a

# ---------- 1. equivalencias: coordenada GTFS → nodo más cercano; nombre cuando el grafo tiene la coordenada corrida ----------
POR_NOMBRE = {"90009": ("E117", "nombre (Tibanica); el nodo del grafo está a {d} m de la coordenada GTFS"),
              "90010": ("E116", "nombre (Laureles); el nodo del grafo está a {d} m de la coordenada GTFS"),
              "90011": ("E115", "nombre (Islandia); el nodo del grafo está a {d} m de la coordenada GTFS"),
              "9118": ("E21", "posición entre Av. 39 y Calle 57 (Marly = 'Calle 53 - UMB' del modelo); coordenada del grafo corregida a la GTFS")}
NOTA = {"7007": "coordenada GTFS a 1 m de CL 38 A Sur - Centro Mayor (E86), no de NQS Calle 30 Sur (E85, que es el ID 7008)",
        "7008": "coordenada GTFS a 25 m de NQS Calle 30 Sur", "3002": "coordenada ('Suba' entre La Campiña y Gratamira)",
        "3005": "coordenada ('Suba' = Suba - Av. Boyacá)", "3012": "coordenada ('Suba' = Suba Calle 95)",
        "90007": "coordenada ('Suba' = Suba Calle 100)", "7102": "coordenada ('NQS' = NQS Calle 75)",
        "7105": "coordenada (Movistar Arena = TIGO en el modelo)", "90004": "coordenada (Portal Usme unificado: T1A + T3A)"}
EQ = {}
for sid, r in CAT.items():
    la, lo = float(r["lat"]), float(r["lon"])
    d, k = min((hav(la, lo, n["lat"], n["lon"]), k) for k, n in N.items())
    if sid in POR_NOMBRE:
        k = POR_NOMBRE[sid][0]; d = hav(la, lo, N[k]["lat"], N[k]["lon"]); m = POR_NOMBRE[sid][1].format(d=round(d * 1000))
    else: m = NOTA.get(sid, "coordenada")
    EQ[sid] = {"nodo": k, "metodo": m, "dist_m": round(d * 1000), "confianza": "alta" if d < 0.3 or sid in POR_NOMBRE else "media"}
assert len({e["nodo"] for e in EQ.values()}) == 143, "las 143 estaciones GTFS deben cubrir los 143 nodos uno a uno"
NODE_OF = {s: e["nodo"] for s, e in EQ.items()}; SID_OF = {e["nodo"]: s for s, e in EQ.items()}
with open(f"{G}/equivalencias_gtfs_grafo.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["station_id", "nombre_gtfs", "lat_gtfs", "lon_gtfs", "nodo_grafo", "nombre_grafo", "dist_gtfs_grafo_m", "metodo", "confianza"])
    for sid in sorted(EQ, key=lambda s: int(N[EQ[s]["nodo"]]["id"][1:])):
        e = EQ[sid]; w.writerow([sid, " ".join(CAT[sid]["nombre_gtfs"].split()), CAT[sid]["lat"], CAT[sid]["lon"], e["nodo"], N[e["nodo"]]["nombre"], e["dist_m"], e["metodo"], e["confianza"]])

# ---------- 2. grafo de la capa de oferta: matriz base + corrección del ramal sur + enlaces operacionales ----------
BASE = {ek(a, b) for a, b in D["red"]["aristas"]}
QUITA = {ek("E33", "E38"), ek("E34", "E35")}          # Santa Lucía–Consuelo y Socorro–Biblioteca (cruzados en la matriz)
AGREGA = {ek("E34", "E38"), ek("E33", "E35")}         # Socorro–Consuelo y Santa Lucía–Biblioteca (GTFS y trazado)
ENLACE = {ek("E31", "E141"): "Quiroga ↔ Av. 1 de Mayo (M83/H83)", ek("E81", "E27"): "Tygua ↔ Nariño (B72/H72)"}
CAPA = (BASE - QUITA) | AGREGA
adj = collections.defaultdict(set)
for k in CAPA: a, b = k.split("|"); adj[a].add(b); adj[b].add(a)
KMg = {k: hav(N[k.split("|")[0]]["lat"], N[k.split("|")[0]]["lon"], N[k.split("|")[1]]["lat"], N[k.split("|")[1]]["lon"]) for k in CAPA | set(ENLACE)}
LL = lambda node: (float(CAT[SID_OF[node]]["lat"]), float(CAT[SID_OF[node]]["lon"]))
def sp(s, t):
    dist = {s: 0}; prev = {}; q = [(0, s)]
    while q:
        d, u = heapq.heappop(q)
        if u == t: break
        if d > dist[u]: continue
        for v in adj[u]:
            nd = d + KMg[ek(u, v)]
            if nd < dist.get(v, 1e9): dist[v] = nd; prev[v] = u; heapq.heappush(q, (nd, v))
    if t not in dist: return None
    p = [t]
    while p[-1] != s: p.append(prev[p[-1]])
    return p[::-1]

# ---------- 3. trazados oficiales (shapes.txt): camino de estaciones por las que pasa cada arco ----------
SH = {}
if len(sys.argv) > 1:
    cur = None
    for r in csv.DictReader(open(sys.argv[1], encoding="utf-8-sig")):
        if r["shape_id"] != cur: cur = r["shape_id"]; SH[cur] = []
        SH[cur].append((float(r["shape_pt_lat"]), float(r["shape_pt_lon"])))
CELL = 0.002; grid = collections.defaultdict(list)             # índice espacial de puntos de trazado
CUM = {}
for sh, pts in SH.items():
    c = [0.0]
    for i in range(1, len(pts)): c.append(c[-1] + hav(*pts[i - 1], *pts[i]))
    CUM[sh] = c
    for i, (la, lo) in enumerate(pts): grid[(int(la / CELL), int(lo / CELL))].append((sh, i))
def near(la, lo, r_km):
    out = collections.defaultdict(list); cx, cy = int(la / CELL), int(lo / CELL)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for sh, i in grid.get((cx + dx, cy + dy), ()):
                if hav(la, lo, *SH[sh][i]) <= r_km: out[sh].append(i)
    return out
STGRID = collections.defaultdict(list)
for node in N: la, lo = LL(node); STGRID[(int(la / CELL), int(lo / CELL))].append(node)
def tramo_shape(a, b, km):
    """mejor tramo de trazado de a a b con longitud parecida a distancia_km → (shape, i, j, km_trazado)"""
    A, Bn = near(*LL(a), 0.06), near(*LL(b), 0.06); best = None
    for sh in A.keys() & Bn.keys():
        for i in A[sh]:
            js = [j for j in Bn[sh] if j > i]
            if not js: continue
            j = min(js); L = CUM[sh][j] - CUM[sh][i]
            if best is None or abs(L - km) < abs(best[3] - km): best = (sh, i, j, L)
    return best if best and abs(best[3] - km) <= max(0.3, 0.2 * km) else None
def estaciones_en(sh, i, j):
    seq = []
    for t in range(i, j + 1):
        la, lo = SH[sh][t]; cx, cy = int(la / CELL), int(lo / CELL)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for node in STGRID.get((cx + dx, cy + dy), ()):
                    if hav(la, lo, *LL(node)) <= 0.045 and (not seq or seq[-1] != node) and node not in seq: seq.append(node)
    return seq
def camino(a, b, km):
    """camino de nodos del arco; 'trazado' si sale del shape oficial, 'grafo' si cae al camino más corto"""
    if ek(a, b) in ENLACE: return [a, b], "enlace operacional", None
    if b in adj[a]: return [a, b], "adyacente", None
    ts = tramo_shape(a, b, km) if SH else None
    if ts:
        seq = estaciones_en(ts[0], ts[1], ts[2])
        seq = [a] + [x for x in seq if x not in (a, b)] + [b]
        # quita estaciones laterales captadas por cercanía (cruces): se queda con la cadena de vecinos del grafo
        path = [a]
        for x in seq[1:]:
            if x in path: continue
            if x in adj[path[-1]] or ek(path[-1], x) in ENLACE: path.append(x)
            elif x == b:
                sub = sp(path[-1], b)
                if not sub: return None, "sin camino", ts
                path += sub[1:]
        if path[-1] == b: return revisa(path, km, "trazado", ts)
    return revisa(sp(a, b), km, "grafo (camino más corto)", ts)
def revisa(path, km, met, ts):
    """si el camino del grafo es mucho más largo que la distancia GTFS, al grafo le falta el conector que usa la ruta:
    no se proyecta (inflaría tramos por los que el bus no pasa) y queda listado como conector faltante"""
    if not path: return None, "sin camino", ts
    L = sum(hav(*LL(path[i - 1]), *LL(path[i])) for i in range(1, len(path)))
    if L > RATIO * km: return None, f"conector faltante (grafo {L:.2f} km vs GTFS {km:.2f} km)", ts
    return path, met, ts
RATIO = 1.35

# ---------- 4. proyección de los 2.173 arcos ----------
FR = {"Mañana (6-9 a. m.)": "am", "Valle (9 a. m.-4:30 p. m.)": "valle", "Tarde (4:30-7:30 p. m.)": "pm"}
oferta = collections.defaultdict(lambda: {"bph": 0.0, "rutas": set(), "t": [], "w": [], "km": []})
memo = {}; filas = []; excl = collections.Counter()
for r in R:
    a, b, fr = NODE_OF[r["station_id"]], NODE_OF[r["next_station"]], FR[r["franja"]]
    km, t = float(r["distancia_km"]), float(r["tiempo_promedio_min"]); v = km / (t / 60) if t > 0 else 0
    rutas = [x.strip() for x in r["rutas_activas"].split(",")]
    if a == b: excl["bucle"] += 1; filas.append([fr, r["station_id"], r["next_station"], a, b, "", "excluido: bucle interno", km, round(t, 2), round(v, 1), "no", r["rutas_activas"]]); continue
    if (a, b) not in memo: memo[(a, b)] = camino(a, b, km)
    path, met, ts = memo[(a, b)]
    calib = "no" if v < 8 else "sí"
    if v < 8: excl["<8 km/h"] += 1
    filas.append([fr, r["station_id"], r["next_station"], a, b, " ".join(path or []), met, km, round(t, 2), round(v, 1), calib, r["rutas_activas"]])
    if not path: excl["conector faltante" if met.startswith("conector") else "sin camino"] += 1; continue
    # reparto: buses/h a cada tramo del camino; km por tramo desde el trazado si hay shape, si no proporcional al grafo
    kms = [KMg[ek(path[i - 1], path[i])] for i in range(1, len(path))]
    for i in range(1, len(path)):
        o = oferta[(fr, path[i - 1], path[i])]; o["bph"] += float(r["buses_por_hora"]); o["rutas"].update(rutas)
    if len(path) == 2:
        o = oferta[(fr, a, b)]; o["km"].append(km)
        if calib == "sí": o["t"].append(t); o["w"].append(int(r["total_buses_franja"]))
with open(f"{G}/arcos_proyeccion_gtfs.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["franja", "station_id", "next_station", "desde", "hasta", "camino_nodos", "metodo", "distancia_km", "tiempo_promedio_min", "kmh_implicita", "apto_calibracion_bpr", "rutas"]); w.writerows(filas)
with open(f"{G}/oferta_tramos_gtfs.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["franja", "desde", "hasta", "desde_nombre", "hasta_nombre", "tipo", "km_grafo", "km_gtfs", "buses_hora_programados", "rutas", "tiempo_programado_min"])
    for (fr, a, b), o in sorted(oferta.items(), key=lambda x: (x[0][0], int(x[0][1][1:]), int(x[0][2][1:]))):
        k = ek(a, b); tipo = "enlace operacional (tráfico mixto)" if k in ENLACE else "corrección ramal sur" if k in AGREGA else "troncal"
        tp = round(sum(t * x for t, x in zip(o["t"], o["w"])) / sum(o["w"]), 2) if o["w"] else ""
        w.writerow([fr, a, b, N[a]["nombre"], N[b]["nombre"], tipo, round(KMg[k], 3), round(sum(o["km"]) / len(o["km"]), 3) if o["km"] else "", round(o["bph"], 2), " ".join(sorted(o["rutas"])), tp])

# ---------- 5. validación ----------
mod = {s["cod"] for s in D["servicios"]}; gt = {x.strip() for r in R for x in r["rutas_activas"].split(",")}
cub = {ek(a, b) for (_, a, b) in oferta}
met = collections.Counter(m.split(" (")[0] for (p, m, ts) in memo.values())
falt = sorted({(N[a]["nombre"], N[b]["nombre"], m.split("(")[1].rstrip(")"), " ".join(sorted({x for r in R if NODE_OF[r["station_id"]] == a and NODE_OF[r["next_station"]] == b for x in r["rutas_activas"].replace(" ", "").split(",")}))) for (a, b), (p, m, ts) in memo.items() if m.startswith("conector")})
stats = {}
for fr in ("am", "valle", "pm"):
    rs = [x for x in filas if x[0] == fr]; bph = [float(r["buses_por_hora"]) for r in R if FR[r["franja"]] == fr]
    top = max(((o["bph"], a, b) for (f2, a, b), o in oferta.items() if f2 == fr))
    stats[fr] = {"arcos": len(rs), "bus_h_promedio_arco": round(sum(bph) / len(bph), 2), "tramo_mas_cargado": f"{N[top[1]]['nombre']} → {N[top[2]]['nombre']}", "bus_h_tramo_mas_cargado": round(top[0], 1)}
dif = sorted(((e["dist_m"], s) for s, e in EQ.items()), reverse=True)
json.dump({"fuente": "GTFS_20261013, agency_id 1, todos los service_id hábiles (calendar.txt lunes–viernes = 1)",
           "arcos": len(R), "arcos_por_franja": dict(collections.Counter(FR[r["franja"]] for r in R)), "estaciones_gtfs": len(CAT),
           "nodos_grafo_cubiertos": len(set(NODE_OF.values())), "rutas_gtfs": len(gt), "rutas_modelo": len(mod),
           "rutas_modelo_sin_viajes_gtfs": sorted(mod - gt), "rutas_gtfs_fuera_del_modelo": sorted(gt - mod),
           "shapes_cargados": len(SH), "metodo_por_par_od": dict(met), "excluidos": dict(excl),
           "tramos_base": len(BASE), "tramos_base_con_oferta": len(cub & BASE), "tramos_base_sin_oferta": sorted(k for k in BASE - cub),
           "correccion_ramal_sur": {"quita": sorted(QUITA), "agrega": sorted(AGREGA)}, "enlaces_operacionales": ENLACE,
           "franjas": stats, "equivalencias_mayor_distancia_m": [{"station_id": s, "nodo": EQ[s]["nodo"], "dist_m": d} for d, s in dif[:12]],
           "pares_od_conector_faltante": [{"de": a, "a": b, "km": k, "rutas": r} for a, b, k, r in falt],
           "pares_od_sin_camino": sorted(f"{a}→{b}" for (a, b), (p, m, ts) in memo.items() if not p)},
          open(f"{G}/validacion_gtfs.json", "w"), ensure_ascii=False, indent=1)
print("ok:", len(CAT), "estaciones,", len(oferta), "tramo-franja,", dict(met), dict(excl), "tramos base con oferta", len(cub & BASE), "/", len(BASE))
