# Extrae los HORARIOS de la "Guía General de viaje de TransMilenio (corte agosto 2026)" (PDF de una página).
# Solo se usan los horarios: las rutas y estaciones del modelo siguen siendo las del Excel (hoja Rutas / paradas).
# Excepción: los bloques "Operación durante Ciclovía" (domingos y festivos 7:00 a.m.–2:00 p.m.) recorren otro
# trazado; de ellos se toman solo las estaciones TransMilenio que existen en el Excel de estaciones del modelo.
# Uso: python3 -I scripts/horarios_guia.py <guia.pdf>   → datos/horarios_servicios.json
import sys, re, json, os
import pdfplumber
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pg = pdfplumber.open(sys.argv[1]).pages[0]
W = pg.extract_words(keep_blank_chars=True, extra_attrs=["size"])
D = json.load(open(f"{B}/src/data.json")); MOD = {s["cod"] for s in D["servicios"]}; NOD = {n["id"] for n in D["red"]["nodos"]}
TRE = re.compile(r"(\d{1,2}):(\d\d) ?([ap])\.m\. ?- ?(\d{1,2}):(\d\d) ?([ap])\.m\.")
DRE = re.compile(r"^(L ?- ?V|L ?- ?S|L ?- ?D|D ?- ?F|S)$")
def mins(h, m, ap): h = int(h) % 12 + (12 if ap == "p" else 0); return h * 60 + int(m)
# estaciones TransMilenio de las variantes de Ciclovía → nodo del modelo (las demás son paraderos zonales)
TM = {"museo nacional": "E134", "concejo de bogota": "E122", "corferias": "E124", "gobernacion": "E126", "can british council": "E127",
      "el tiempo ccb": "E129", "av rojas unisalesiana": "E130", "av rojas": "E130", "portal eldorado": "E133", "san victorino": "E137",
      "bicentenario": "E82", "av 1 de mayo": "E141", "country sur": "E142", "portal 20 de julio": "E143", "san diego": "E135",
      "polo": "E56", "polo fincomercio": "E56", "kr 47": "E58", "av 68": "E60"}
import unicodedata
def key(s): s = unicodedata.normalize("NFD", s.lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn"); return " ".join(re.sub(r"[^a-z0-9]+", " ", s.replace("°", "")).split())
out = {}
for c in [w for w in W if w["size"] >= 40 and re.fullmatch(r"[A-Z]{1,2}\d{1,3}|\d{1,2}", w["text"].strip())]:
    cod = c["text"].strip()
    if cod not in MOD: continue
    T = [w for w in W if c["x0"] + 15 <= w["x0"] <= c["x0"] + 50 and c["top"] + 35 <= w["top"] <= c["top"] + 110 and TRE.search(w["text"])]
    Dd = [w for w in W if c["x0"] - 25 <= w["x1"] <= c["x0"] + 32 and c["top"] + 35 <= w["top"] <= c["top"] + 110 and DRE.match(w["text"].strip())]
    rows = []
    for t in sorted(T, key=lambda w: w["top"]):
        d = min(Dd, key=lambda w: abs(w["top"] - t["top"]), default=None)
        if not d or abs(d["top"] - t["top"]) >= 5: continue
        g = TRE.search(t["text"]).groups()
        rows.append({"dias": d["text"].replace(" ", "").strip(), "desde": mins(*g[:3]), "hasta": mins(*g[3:])})
    if not rows: continue   # etiquetas del mapa o ejemplo de la leyenda
    ciclo = len(rows) == 1 and rows[0] == {"dias": "D-F", "desde": 420, "hasta": 840}
    if ciclo:
        col = [w for w in W if c["x0"] - 12 <= w["x0"] <= c["x0"] + 30 and c["top"] + 60 <= w["top"] <= 3290 and 10 <= w["size"] <= 20]
        lines = {}
        for w in col: lines.setdefault(round(w["top"] / 3), []).append(w)
        seq = []
        for k in sorted(lines):
            n = TM.get(key(" ".join(x["text"] for x in lines[k])))
            if n and n in NOD and n not in seq: seq.append(n)
        rows[0]["ciclovia"] = True; rows[0]["paradas"] = seq
    out.setdefault(cod, []).extend(rows)
meta = {"fuente": "Guía General de viaje de TransMilenio, corte agosto 2026 (solo horarios)", "dias": {"L-V": "lunes a viernes", "L-S": "lunes a sábado", "S": "sábado", "L-D": "lunes a domingo", "D-F": "domingos y festivos"},
        "nota": "desde/hasta en minutos desde la medianoche. Filas con ciclovia=true: recorrido especial domingos y festivos 7:00 a.m.–2:00 p.m.; 'paradas' = estaciones TransMilenio del modelo que usa."}
json.dump({"meta": meta, "servicios": dict(sorted(out.items()))}, open(f"{B}/datos/horarios_servicios.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "servicios con horario;", sum(1 for v in out.values() for r in v if r.get("ciclovia")), "variantes de Ciclovía;", "sin horario:", sorted(MOD - set(out)))
for k, v in out.items():
    for r in v:
        if r.get("ciclovia"): print(" ", k, "Ciclovía →", r["paradas"])
