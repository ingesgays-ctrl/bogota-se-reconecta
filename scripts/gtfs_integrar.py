# Integra datos/gtfs/matriz_arcos_gtfs_visor.csv (GTFS estático TransMilenio GTFS_20261013, troncales, día hábil)
# con el grafo del visor (143 nodos, 146 tramos). Salidas en datos/gtfs/:
#   equivalencias_gtfs_grafo.csv  station_id GTFS → nodo del grafo (método y confianza)
#   oferta_tramos_gtfs.csv        buses/h programados por tramo físico dirigido y franja (arcos expresos proyectados
#                                 por el camino más corto en km) y tiempo programado en arcos entre estaciones adyacentes
#   validacion_gtfs.json          hallazgos (arcos con velocidad implícita fuera de 8–60 km/h, cobertura, etc.)
# Uso: python3 -I scripts/gtfs_integrar.py
import csv, json, heapq, collections, math, os
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = list(csv.DictReader(open(f"{B}/datos/gtfs/matriz_arcos_gtfs_visor.csv", encoding="utf-8")))
D = json.load(open(f"{B}/src/data.json")); N = {n["id"]: n for n in D["red"]["nodos"]}
EQ = {  # station_id GTFS → (nodo, método, confianza)
 "2502":("E1","nombre","alta"),"2001":("E2","nombre","alta"),"2000":("E3","nombre","alta"),"2101":("E4","nombre","alta"),"2103":("E6","nombre","alta"),
 "2104":("E7","nombre","alta"),"2105":("E8","nombre","alta"),"2200":("E9","nombre","alta"),"2201":("E10","nombre","alta"),"2202":("E11","nombre","alta"),
 "2204":("E12","nombre","alta"),"2300":("E14","nombre","alta"),"2302":("E15","nombre","alta"),"2304":("E17","nombre","alta"),"9122":("E18","nombre","alta"),
 "9121":("E19","nombre","alta"),"9119":("E20","nombre","alta"),"9118":("E21","posición entre Av. 39 y Calle 57 (en el modelo se llama 'Calle 53'; tramo de 0,32 km frente a 3,4 min programados)","revisar"),
 "9116":("E22","nombre","alta"),"9114":("E23","nombre","alta"),"9113":("E24","nombre","alta"),"9110":("E25","nombre","alta"),"9107":("E26","nombre","alta"),
 "9106":("E27","nombre","alta"),"9105":("E28","nombre","alta"),"9104":("E29","nombre","alta"),"9103":("E30","nombre","alta"),"9101":("E31","nombre","alta"),
 "9100":("E32","nombre","alta"),"9004":("E33","nombre","alta"),"9003":("E34","nombre","alta"),"8002":("E35","nombre","alta"),"8001":("E36","nombre","alta"),
 "8000":("E37","nombre","alta"),"9002":("E38","nombre","alta"),"9001":("E39","nombre","alta"),"90008":("E40","nombre","alta"),
 "90004":("E41","nombre (Portal Usme T1A)","alta"),"74372":("E41","nombre (Portal Usme T3A, mismo portal que 90004)","alta"),
 "3014":("E42","nombre","alta"),"3013":("E43","nombre","alta"),"3012":("E44","posición: segundo 'Suba' después de Puentelargo, antes de San Martín","media"),
 "90007":("E45","posición: primer 'Suba' después de Puentelargo","media"),"3010":("E46","nombre","alta"),"3009":("E47","nombre","alta"),"3007":("E48","nombre","alta"),
 "3006":("E49","nombre","alta"),"3004":("E51","nombre","alta"),"3002":("E53","posición: 'Suba' entre La Campiña y Gratamira","media"),"3001":("E54","nombre","alta"),"3000":("E55","nombre","alta"),
 "4108":("E56","nombre","alta"),"4106":("E58","nombre","alta"),"4104":("E60","nombre","alta"),"4103":("E61","nombre","alta"),"4102":("E62","nombre","alta"),
 "4101":("E63","nombre","alta"),"4004":("E64","nombre","alta"),"4003":("E65","nombre","alta"),"4002":("E66","nombre","alta"),"4001":("E67","nombre","alta"),"4000":("E68","nombre","alta"),
 "7101":("E69","nombre","alta"),"7102":("E70","posición: 'NQS' entre Cra. 47 y Av. Chile = NQS Calle 75","media"),"7103":("E71","nombre","alta"),"7104":("E72","nombre","alta"),
 "7105":("E73","nombre comercial nuevo: Movistar Arena = TIGO en el modelo","media"),"7106":("E74","nombre","alta"),"7107":("E75","nombre","alta"),"7108":("E76","nombre","alta"),
 "7109":("E77","nombre","alta"),"7110":("E78","nombre","alta"),"7111":("E79","nombre","alta"),"7201":("E80","nombre","alta"),"7200":("E81","nombre","alta"),"10005":("E82","nombre","alta"),
 "7112":("E83","nombre","alta"),"7113":("E84","nombre","alta"),"7007":("E85","posición: 'NQS' entre Sevillana y Comuneros; puede ser NQS Calle 30 Sur (E85) o NQS Calle 38A Sur (E86)","revisar"),
 "7006":("E87","nombre","alta"),"7005":("E88","nombre","alta"),"7004":("E89","nombre","alta"),"7003":("E90","nombre","alta"),"7002":("E91","nombre","alta"),"7001":("E92","nombre","alta"),"7000":("E93","nombre","alta"),
 "6111":("E118","nombre","alta"),"6109":("E121","nombre","alta"),"6108":("E122","nombre","alta"),"6107":("E123","nombre","alta"),"6106":("E124","nombre","alta"),"6105":("E125","nombre","alta"),
 "6103":("E127","nombre","alta"),"6102":("E128","nombre","alta"),"6101":("E129","nombre","alta"),"6100":("E130","nombre","alta"),"6001":("E132","nombre","alta"),"6000":("E133","nombre","alta"),
 "10009":("E134","nombre","alta"),"10008":("E135","nombre","alta"),"10007":("E136","nombre","alta"),"10006":("E137","nombre","alta"),"10010":("E138","nombre","alta"),
 "10004":("E139","nombre","alta"),"10003":("E140","nombre","alta"),"10002":("E141","nombre","alta"),"10001":("E142","nombre","alta"),"10000":("E143","nombre","alta")}
hav = lambda a, b: 2 * 6371 * math.asin(math.sqrt(math.sin(math.radians(b["lat"] - a["lat"]) / 2) ** 2 + math.cos(math.radians(a["lat"])) * math.cos(math.radians(b["lat"])) * math.sin(math.radians(b["lon"] - a["lon"]) / 2) ** 2))
ek = lambda a, b: a + "|" + b if a < b else b + "|" + a
adj = collections.defaultdict(set); KM = {}
for a, b in D["red"]["aristas"]: adj[a].add(b); adj[b].add(a); KM[ek(a, b)] = hav(N[a], N[b])
def sp(s, t):
    dist = {s: 0}; prev = {}; q = [(0, s)]
    while q:
        d, u = heapq.heappop(q)
        if u == t: break
        if d > dist[u]: continue
        for v in adj[u]:
            nd = d + KM[ek(u, v)]
            if nd < dist.get(v, 1e9): dist[v] = nd; prev[v] = u; heapq.heappush(q, (nd, v))
    if t not in dist: return None, None
    p = [t]
    while p[-1] != s: p.append(prev[p[-1]])
    return p[::-1], dist[t]
names = {}
for r in R: names[r["station_id"]] = r["origen_nombre"]; names[r["next_station"]] = r["destino_nombre"]
with open(f"{B}/datos/gtfs/equivalencias_gtfs_grafo.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["station_id", "nombre_gtfs", "nodo_grafo", "nombre_grafo", "metodo", "confianza"])
    for sid in sorted(names, key=int): n, m, c = EQ[sid]; w.writerow([sid, names[sid].strip(), n, N[n]["nombre"], m, c])
FR = {"Mañana (6-9 a. m.)": "am", "Valle (9 a. m.-4:30 p. m.)": "valle", "Tarde (4:30-7:30 p. m.)": "pm"}
oferta = collections.defaultdict(lambda: {"bph": 0.0, "rutas": set(), "t": [], "w": []})
anom = []
for r in R:
    a, b = EQ[r["station_id"]][0], EQ[r["next_station"]][0]
    p, km = sp(a, b); t = float(r["tiempo_promedio_min"]); v = km / (t / 60)
    if v < 8 or v > 60: anom.append({"franja": FR[r["franja"]], "de": r["station_id"], "a": r["next_station"], "nombres": f'{r["origen_nombre"]} → {r["destino_nombre"]}', "rutas": r["rutas_activas"], "min": round(t, 1), "km_grafo": round(km, 2), "estaciones_intermedias_en_grafo": len(p) - 2, "kmh": round(v, 1)})
    if v > 60: continue   # el grafo no tiene el conector que usa la ruta: proyectarla por el rodeo inflaría tramos ajenos
    for i in range(1, len(p)):
        o = oferta[(FR[r["franja"]], p[i - 1], p[i])]; o["bph"] += float(r["buses_por_hora"]); o["rutas"].update(x.strip() for x in r["rutas_activas"].split(","))
    if len(p) == 2: o = oferta[(FR[r["franja"]], a, b)]; o["t"].append(t); o["w"].append(int(r["total_buses_franja"]))
with open(f"{B}/datos/gtfs/oferta_tramos_gtfs.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["franja", "desde", "hasta", "desde_nombre", "hasta_nombre", "km_grafo", "buses_hora_programados", "rutas", "tiempo_programado_min"])
    for (fr, a, b), o in sorted(oferta.items()):
        tp = round(sum(t * x for t, x in zip(o["t"], o["w"])) / sum(o["w"]), 2) if o["w"] else ""
        w.writerow([fr, a, b, N[a]["nombre"], N[b]["nombre"], round(KM[ek(a, b)], 3), round(o["bph"], 2), " ".join(sorted(o["rutas"])), tp])
mod = {s["cod"] for s in D["servicios"]}; gt = {x.strip() for r in R for x in r["rutas_activas"].split(",")}
json.dump({"fuente": "GTFS_20261013, agency_id 1, service_id 1", "arcos": len(R), "estaciones_gtfs": len(names), "nodos_grafo_cubiertos": len({v[0] for v in EQ.values()}),
           "nodos_grafo_sin_oferta": [f'{k} {n["nombre"]}' for k, n in N.items() if k not in {v[0] for v in EQ.values()}],
           "rutas_modelo": len(mod), "rutas_gtfs": len(gt), "rutas_modelo_sin_viajes_gtfs": sorted(mod - gt),
           "tramos_fisicos_con_oferta": len({ek(a, b) for (_, a, b) in oferta}), "tramos_fisicos_total": len(KM), "arcos_velocidad_fuera_8_60": anom},
          open(f"{B}/datos/gtfs/validacion_gtfs.json", "w"), ensure_ascii=False, indent=1)
print("ok:", len(names), "estaciones,", len(oferta), "tramo-franja,", len(anom), "arcos anómalos")
