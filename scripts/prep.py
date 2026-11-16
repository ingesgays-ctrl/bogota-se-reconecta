"""Preprocesado único -> data.json (fuente de verdad: claude/fuente_de_verdad_datos.md).
Uso: python3 -I prep.py <carpeta_datos> <salida.json>
"""
import csv, json, math, re, sys, collections
import openpyxl

SRC, OUT = sys.argv[1], sys.argv[2]
def P(f): return f"{SRC}/{f}"
def rd(f): return list(csv.DictReader(open(P(f), encoding="utf-8-sig")))
def fix(s): return s.replace("Ricuarte", "Ricaurte")

# ---------- utilidades geométricas ----------
def dp(pts, tol):
    if len(pts) < 3: return pts
    keep = [False]*len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts)-1)]
    while st:
        a, b = st.pop(); ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx-ax, by-ay; L = dx*dx+dy*dy
        best, bi = -1, -1
        for i in range(a+1, b):
            px, py = pts[i]
            if L == 0: d = (px-ax)**2+(py-ay)**2
            else:
                t = max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/L))
                d = (px-ax-t*dx)**2+(py-ay-t*dy)**2
            if d > best: best, bi = d, i
        if best > tol*tol:
            keep[bi] = True; st += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def r5(pts): return [[round(x, 5), round(y, 5)] for x, y in pts]
def hav(lat1, lon1, lat2, lon2):
    R = 6371000; p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin(math.radians(lon2-lon1)/2)**2
    return 2*R*math.asin(math.sqrt(a))
def proj_on_line(line, lon, lat):
    """devuelve (distancia_m, posicion_acumulada_m) del punto sobre la polilínea"""
    kx = 111320*math.cos(math.radians(4.65)); ky = 110540
    best = (1e18, 0); acc = 0
    for (x1, y1), (x2, y2) in zip(line, line[1:]):
        ax, ay, bx, by = x1*kx, y1*ky, x2*kx, y2*ky; px, py = lon*kx, lat*ky
        dx, dy = bx-ax, by-ay; L2 = dx*dx+dy*dy; L = math.sqrt(L2) or 1e-9
        t = 0 if L2 == 0 else max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/L2))
        d = math.hypot(px-ax-t*dx, py-ay-t*dy)
        if d < best[0]: best = (d, acc+t*L)
        acc += L
    return best

# ---------- 1. KPIs ----------
KM_OFICIAL = [0.00, 37.32, 22.38, 59.70]
COL = {"Estaciones Bogotá": "estaciones", "Km Adicionales": "km", "Viajes Pico AM (pax)": "viajes",
       "Longitud Media (km)": "longitud", "Tiempo Medio Congestión (min)": "tiempo",
       "Carga Paloquemao-Ricaurte (pax)": "carga", "Vulnerabilidad Ricaurte (%)": "vulnerabilidad",
       "Puentes Topológicos": "puentes", "Alivio NQS vs Actual (%)": "alivio"}
escenarios = []
CORTOS = ["Red Actual", "+5 Periféricos", "+Solo Av. 68", "Integral"]
INCL = [[], ["C1", "C2", "C3", "C4", "C5"], ["C6_Av68"], ["C1", "C2", "C3", "C4", "C5", "C6_Av68"]]
for i, r in enumerate(rd("comparacion_4_escenarios_congestion.csv")):
    e = {"id": i, "nombre": fix(r["Escenario"]), "corto": CORTOS[i], "corredores": INCL[i]}
    for k, v in COL.items():
        v = r[k].strip()
        e[COL[k]] = float(v.replace("%", "")) if k == "Alivio NQS vs Actual (%)" else float(v)
    e["km"] = KM_OFICIAL[i]
    for k in ("estaciones", "viajes", "carga", "puentes"): e[k] = int(e[k])
    escenarios.append(e)

# ---------- 2. Corredores ----------
EJES = {
 "C1": ["Av. Calle 80", "Transversal 94", "Av. Ciudad de Cali (Carrera 86)"],
 "C2": ["Av. Calle 145", "Av. Carrera 104", "Av. Calle 132", "Av. Calle 127", "Av. Calle 90", "Transversal 94"],
 "C3": ["Autonorte (Av. Carrera 45)", "Av. Calle 153", "Av. Boyacá (Carrera 72)", "Av. Suba (Transversal 76 / Calle 145)"],
 "C4": ["Av. Caracas (Carrera 14)", "Av. Calle 51 Sur", "Carrera 5R", "Diagonal 50 Sur", "Av. Carrera 10"],
 "C5": ["Av. Calle 58A Sur", "Av. Carrera 19C", "Diagonal 48 Sur", "Av. Caracas", "Calle 44C Sur", "Calle 27 Sur", "Av. Carrera 10"],
 "C6_Av68": ["Av. Carrera 68", "Av. Calle 100"],
}
TOPO = {
 "C1": "Cierra el anillo occidental entre la troncal Calle 80 y la troncal Calle 26 sin pasar por el centro: un viaje Portal 80 → Portal El Dorado deja de depender de la NQS y la Caracas.",
 "C2": "Une los dos portales del noroccidente (Suba y Calle 80), hoy conectados solo a través del tronco central. Crea un camino alternativo que elimina puentes topológicos en las ramas de Suba y Calle 80.",
 "C3": "Enlaza la Autonorte con la troncal Suba por el norte, rodeando los Cerros de Suba y la Reserva Thomas van der Hammen. La rama Suba deja de ser un callejón sin salida del grafo.",
 "C4": "Conecta Usme con la troncal Av. Carrera 10 (20 de Julio) por el sur. Si falla la Caracas Sur, Usme conserva una ruta hacia el centro.",
 "C5": "Conecta Portal Tunal con la troncal Av. Carrera 10. Junto con C4 forma una malla en el sur que duplica las rutas de salida de Tunal y Usme.",
 "C6_Av68": "Bypass transversal que corre paralelo al tronco central (NQS–Caracas). Al cruzar Américas, Calle 26, Calle 80 y Suba, y llegar a la Autonorte, ofrece a los viajes radiales una ruta que no pasa por Paloquemao–Ricaurte.",
}
coh = {r["ID"]: r for r in rd("tabla_coherencia_corredores.csv")}
gj = json.load(open(P("corredores_pot_trazados.geojson")))
av = json.load(open(P("troncal_av68_trazada.geojson")))
geoms = {}
for f in gj["features"]:
    pid = "C"+str(f["properties"]["paso"])
    geoms[pid] = (f["geometry"]["coordinates"], f["properties"]["estacion_origen"], f["properties"]["estacion_destino"])
geoms["C6_Av68"] = (av["features"][0]["geometry"]["coordinates"], None, None)

# ---------- 3. Red actual ----------
paradas = rd("paradas_ordenadas.csv")
wb = openpyxl.load_workbook(P("Matriz Transmilenio (1).xlsx"), read_only=True, data_only=True)
M = [r for r in wb["Estaciones"].iter_rows(min_row=3, max_row=145, max_col=144, values_only=True)]
assert [r[0] for r in M] == [p["estacion"] for p in paradas]
SOACHA = {"La Despensa", "León XIII", "Terreros - H. Cardiovascular", "San Mateo"}
red_nodes = [{"id": f"E{int(p['estacion_id'])}", "nombre": fix(p["estacion"]), "lat": float(p["lat"]), "lon": float(p["lon"]),
              "municipio": "Soacha" if p["estacion"] in SOACHA else "Bogotá"} for p in paradas]
red_edges = []
for i in range(143):
    for j in range(i+1, 143):
        if M[i][j+1] == 1: red_edges.append([red_nodes[i]["id"], red_nodes[j]["id"]])
byname = {n["nombre"]: n for n in red_nodes}
def find_existing(txt):
    txt = fix(txt).strip()
    for n in red_nodes:
        if n["nombre"] == txt or n["nombre"].startswith(txt) or txt.startswith(n["nombre"]): return n
    return None

# ---------- 4. Estaciones POT ----------
AREA_AV68 = {"Puente Aranda": "Área de Actividad industrial / productiva",
             "Salitre": "Área de Actividad de grandes servicios metropolitanos",
             "Teusaquillo": "Área de Actividad estructurante / de proximidad",
             "Barrios Unidos": "Área de Actividad estructurante / de proximidad"}
est = rd("estaciones_finales_nombradas.csv")
cnt = collections.Counter(r["nombre_estacion"] for r in est)
estaciones = []
for r in est:
    cid = r["corredor_id"]; nombre = fix(r["nombre_estacion"])
    if cnt[r["nombre_estacion"]] > 1:
        nombre = f"{nombre} [{cid.replace('_Av68','')}·{r['orden']}]"
    j = fix(r["justificacion_pot"]); metro = r["conexion_metro_pot"].strip()
    e = {"id": f"{cid}-{r['orden']}", "corredor": cid, "orden": int(r["orden"]), "nombre": nombre,
         "estado": r["estado_pot"], "upl": r["upl"], "lat": float(r["lat"]), "lon": float(r["lon"]),
         "densidad": float(r["indice_densidad_pot"]), "metro": metro == "Sí", "justificacion": j}
    if r["estado_pot"] == "Integrada_Transbordo":
        e["tipo"] = "Transbordo"
        m = re.match(r"Transferencia directa con (.+?) \((\d+) m\)", j)
        ex = find_existing(m.group(1)) if m else None
        assert ex, ("transbordo sin match", j)
        e["existente"] = ex["id"]; e["dist_transbordo_m"] = int(m.group(2))
    elif cid == "C6_Av68":
        e["tipo"] = "Bypass Av. 68"
        area = AREA_AV68[r["upl"]]; e["area_actividad"] = area; e["area_por_upl"] = True
        e["justificacion"] = (f"Bypass transversal POT en la UPL {r['upl']}, dentro del {area[0].lower()+area[1:]}. "
                              f"Índice de densidad POT {float(r['indice_densidad_pot']):.3f}"
                              + (". Integración directa (≤ 350 m) con la red Metro POT." if metro == "Sí" else ". Sin integración directa con la red Metro POT."))
    else:
        e["tipo"] = "Alta actividad POT"
        m = re.search(r"\((Área de Actividad[^)]*)\)", j)
        if m: e["area_actividad"] = m.group(1)
    estaciones.append(e)
assert len(estaciones) == 47
assert sum(e["estado"] == "Aprobada_Nueva" for e in estaciones) == 36
assert sum(e["estado"] == "Integrada_Transbordo" for e in estaciones) == 11
assert len({e["nombre"] for e in estaciones}) == 47

# ---------- 5. Corredores: secuencia topológica ----------
corredores = []
NOMBRES = {k: coh[k]["Corredor"] for k in coh}
for cid in ["C1", "C2", "C3", "C4", "C5", "C6_Av68"]:
    coords, o, d = geoms[cid]
    line = [(x, y) for x, y in coords]
    c = coh[cid]
    # nodos POT del corredor ordenados por posición sobre la polilínea
    seq = []
    for e in estaciones:
        if e["corredor"] != cid: continue
        dist, pos = proj_on_line(line, e["lon"], e["lat"])
        seq.append((pos, e["existente"] if e["tipo"] == "Transbordo" else e["id"]))
    inferidos = []
    if cid == "C6_Av68":
        # conexiones con troncales existentes inferidas por cercanía (≤ 300 m) - solo para el grafo
        for n in red_nodes:
            dist, pos = proj_on_line(line, n["lon"], n["lat"])
            if dist <= 300:
                seq.append((pos, n["id"])); inferidos.append({"id": n["id"], "nombre": n["nombre"], "dist_m": round(dist)})
        ends = [line[0], line[-1]]
        o_n = min(red_nodes, key=lambda n: hav(n["lat"], n["lon"], ends[0][1], ends[0][0]))
        d_n = min(red_nodes, key=lambda n: hav(n["lat"], n["lon"], ends[1][1], ends[1][0]))
    else:
        o_n, d_n = find_existing(o), find_existing(d)
    seq.sort()
    path = [o_n["id"]] + [s for _, s in seq] + [d_n["id"]]
    path = [p for k, p in enumerate(path) if k == 0 or p != path[k-1]]
    corredores.append({
        "id": cid, "nombre": fix(NOMBRES[cid]), "ejes": EJES[cid], "justificacion_topologica": TOPO[cid],
        "km_total": float(c["Km Totales Reales"]), "km_nueva": float(c["Km Obra Nueva"]), "km_compartida": float(c["Km Operación Compartida"]),
        "estaciones_nuevas": int(c["Estaciones Nuevas"]), "transbordos": int(c["Transbordos Existentes"]),
        "upl": [u.strip() for u in c["UPL Atendidas"].split(",")],
        "origen": o_n["nombre"], "destino": d_n["nombre"], "path": path, "conexiones_inferidas": inferidos,
        "coords": r5(dp(line, 0.00003)),
    })

# ---------- 6. UPL ----------
upl = json.load(open(P("p3_upl.geojson")))
upls = []; npts = 0
for f in upl["features"]:
    g = f["geometry"]; polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    rings = []
    for poly in polys:
        for ring in poly:
            s = dp([(x, y) for x, y, *_ in ring], 0.0005)
            if len(s) >= 4: rings.append(r5(s)); npts += len(s)
    upls.append({"nombre": f["properties"]["NIOMBRE"], "codigo": f["properties"]["CODIGO_ID"],
                 "vocacion": f["properties"]["VOCACION"], "area_ha": round(f["properties"]["AREA_HA"], 1), "rings": rings})

# ---------- 7. Servicios (hoja Rutas) ----------
rows = list(wb["Rutas"].iter_rows(min_row=2, values_only=True)); hdr = rows[0]
name2id = {p["estacion"]: red_nodes[i]["id"] for i, p in enumerate(paradas)}
servicios = []
for r in rows[1:]:
    if not r[0]: continue
    st = sorted((v, name2id[hdr[i]]) for i, v in enumerate(r[4:147], start=4) if isinstance(v, int) and v > 0)
    servicios.append({"cod": str(r[0]), "nombre": str(r[1]).title(), "stops": [x for _, x in st]})
assert len(servicios) == 114
# factor de longitud real por corredor (km oficiales / suma de distancias rectas entre estaciones del path)
pos = {n["id"]: (n["lat"], n["lon"]) for n in red_nodes}
pos.update({e["id"]: (e["lat"], e["lon"]) for e in estaciones})
for c in corredores:
    rect = sum(hav(*pos[a], *pos[b]) for a, b in zip(c["path"], c["path"][1:])) / 1000
    c["factor_km"] = round(c["km_total"] / rect, 4)

data = {"escenarios": escenarios, "servicios": servicios, "corredores": corredores, "estaciones": estaciones,
        "red": {"nodos": red_nodes, "aristas": red_edges, "critica": [byname["Paloquemao"]["id"], byname["Ricaurte"]["id"]],
                "ricaurte": byname["Ricaurte"]["id"]},
        "upl": upls}
json.dump(data, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

# ---------- verificaciones ----------
print("KPIs:", [(e["corto"], e["km"], e["carga"], e["alivio"]) for e in escenarios])
print("km total", round(sum(c["km_total"] for c in corredores), 2), "nueva", round(sum(c["km_nueva"] for c in corredores), 2),
      "compartida", round(sum(c["km_compartida"] for c in corredores), 2), "perif", round(sum(c["km_total"] for c in corredores[:5]), 2))
for c in corredores:
    nn = sum(1 for e in estaciones if e["corredor"] == c["id"] and e["estado"] == "Aprobada_Nueva")
    nt = sum(1 for e in estaciones if e["corredor"] == c["id"] and e["estado"] != "Aprobada_Nueva")
    print(c["id"], c["origen"], "->", c["destino"], "| nuevas", nn, "/", c["estaciones_nuevas"], "transb", nt, "/", c["transbordos"],
          "| path", len(c["path"]), "| pts", len(c["coords"]), "| inferidas", [i["nombre"] for i in c["conexiones_inferidas"]])
print("factores", [(c["id"], c["factor_km"]) for c in corredores]); print("aristas red", len(red_edges), "upl pts", npts, "dup renombradas", [e["nombre"] for e in estaciones if "[" in e["nombre"]])
