# Troncales del visor tomadas del Excel (hoja "Estaciones", relleno de la celda del nombre de cada estación).
# Cada bloque de filas con el mismo color es una troncal; la Caracas Sur (H) se separa en sus dos ramales
# (Tunal y Usme), que comparten el tronco Hortúa – Santa Lucía. Escribe src/data.json → "troncales".
# Uso: python3 -I scripts/troncales_excel.py "<carpeta con Matriz Transmilenio (1).xlsx>"
import sys, os, json, re, openpyxl
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
wb = openpyxl.load_workbook(os.path.join(sys.argv[1], "Matriz Transmilenio (1).xlsx"))
theme = dict(re.findall(r'<a:(accent\d|dk1|lt1|dk2|lt2)>.*?(?:srgbClr val="([0-9A-Fa-f]{6})")', wb.loaded_theme.decode(), re.S))
ORDER = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]
def color(c):
    fg = c.fill.fgColor if c.fill and c.fill.fill_type else None
    if fg is None: return None
    if fg.type == "rgb": return "#" + fg.rgb[2:].upper()
    if fg.type == "theme":
        base = theme.get(ORDER[fg.theme], "808080"); rgb = [int(base[i:i + 2], 16) for i in (0, 2, 4)]; t = fg.tint or 0
        rgb = [round(v + (255 - v) * t) if t > 0 else round(v * (1 + t)) for v in rgb]
        return "#" + "".join(f"{v:02X}" for v in rgb)
    return None
ws = wb["Estaciones"]
filas = [(r[0].value, color(r[0])) for r in ws.iter_rows(min_row=3, max_row=145, max_col=1)]   # fila 3 = E1
COL = {f"E{i + 1}": c for i, (_, c) in enumerate(filas)}
# letra, nombre, rangos de estaciones (E-desde, E-hasta) en el orden del Excel; "propias" = las que pinta esa troncal
DEF = [("B", "Autopista Norte", [(1, 17)], [(1, 17)]),
       ("A", "Caracas", [(18, 25)], [(18, 25)]),
       ("H", "Caracas Sur · Tunal", [(26, 37)], [(26, 37)]),
       ("H", "Caracas Sur · Usme", [(26, 33), (38, 41)], [(38, 41)]),
       ("C", "Suba", [(42, 55)], [(42, 55)]),
       ("D", "Calle 80", [(56, 68)], [(56, 68)]),
       ("E", "NQS Central", [(69, 82)], [(69, 82)]),
       ("G · S", "NQS Sur y Soacha", [(83, 98)], [(83, 98)]),
       ("F", "Américas", [(99, 117)], [(99, 117)]),
       ("J", "Eje Ambiental", [(118, 120)], [(118, 120)]),
       ("K", "Calle 26", [(121, 133)], [(121, 133)]),
       ("L", "Carrera 10", [(134, 143)], [(134, 143)])]
rng = lambda rs: [f"E{i}" for a, b in rs for i in range(a, b + 1)]
out = []
for letra, nombre, ids, own in DEF:
    cols = {COL[e] for e in rng(own)}
    assert len(cols) == 1, f"{nombre}: el Excel tiene más de un color en sus filas {cols}"
    out.append({"letra": letra, "nombre": nombre, "color": cols.pop(), "ids": rng(ids), "propias": rng(own)})
assert sorted({e for t in out for e in t["propias"]}, key=lambda s: int(s[1:])) == [f"E{i}" for i in range(1, 144)], "las troncales deben cubrir las 143 estaciones"
p = f"{B}/src/data.json"; d = json.load(open(p)); d["troncales"] = out
json.dump(d, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
for t in out: print(t["letra"], t["nombre"], t["color"], len(t["ids"]))
