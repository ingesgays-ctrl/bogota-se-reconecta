# Agrega a src/data.json el color de cada ruta tomado del Excel (hoja "Rutas", relleno de la celda del código).
# En el Excel ese color es el de la TRONCAL DE DESTINO de la ruta (A Caracas, B Autonorte, C Suba, D Calle 80, ...).
# Uso: python3 -I scripts/colores_rutas.py "<carpeta con Matriz Transmilenio (1).xlsx>"
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
ws = wb["Rutas"]; filas = [(str(r[0].value), color(r[0])) for r in ws.iter_rows(min_row=3) if r[0].value]
p = f"{B}/src/data.json"; d = json.load(open(p))
assert len(filas) == len(d["servicios"]) and all(f[0] == s["cod"] for f, s in zip(filas, d["servicios"])), "orden de rutas distinto"
for (cod, col), s in zip(filas, d["servicios"]): s["color"] = col
json.dump(d, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print(Counter((s["cod"][0] if s["cod"][0].isalpha() else "#", s["color"]) for s in d["servicios"]))
