import sys,json
src,data,out=sys.argv[1],sys.argv[2],sys.argv[3]
h=open(f"{src}/index.html").read()
d=open(data).read().replace("</","<\\/")
h=h.replace("/*CSS*/",open(f"{src}/styles.css").read()).replace("/*DATA*/",d).replace("/*JS*/",open(f"{src}/app.js").read())
import os
if os.path.exists(f"{src}/ml.js"): h=h.replace("/*ML*/",open(f"{src}/ml.js").read())
for k,f in (("/*FLEET*/","services/fleetTelemetry.js"),("/*HORARIOS_JS*/","services/horarios.js"),("/*GTFSRT*/","gtfsrt.js"),("/*LIVE*/","live.js"),("/*REPORTES*/","reportes.js")):
    if os.path.exists(f"{src}/{f}"): h=h.replace(k,open(f"{src}/{f}").read())
tr=f"{os.path.dirname(os.path.abspath(src))}/public/data/tramos_viales_bogota.geojson"
if os.path.exists(tr): h=h.replace("/*TRAMOS*/null",open(tr).read().replace("</","<\\/"))
hr=f"{os.path.dirname(os.path.abspath(src))}/datos/horarios_servicios.json"
if os.path.exists(hr): h=h.replace("/*HORARIOS*/null",open(hr).read().replace("</","<\\/"))
sm=f"{os.path.dirname(os.path.abspath(src))}/datos/semaforos_tramos.json"
if os.path.exists(sm): h=h.replace("/*SEM*/null",open(sm).read().replace("</","<\\/"))
open(out,"w").write(h); print(len(h))
