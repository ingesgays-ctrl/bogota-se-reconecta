import sys,json
src,data,out=sys.argv[1],sys.argv[2],sys.argv[3]
h=open(f"{src}/index.html").read()
d=open(data).read().replace("</","<\\/")
h=h.replace("/*CSS*/",open(f"{src}/styles.css").read()).replace("/*DATA*/",d).replace("/*JS*/",open(f"{src}/app.js").read())
import os
if os.path.exists(f"{src}/ml.js"): h=h.replace("/*ML*/",open(f"{src}/ml.js").read())
for k,f in (("/*GTFSRT*/","gtfsrt.js"),("/*LIVE*/","live.js")):
    if os.path.exists(f"{src}/{f}"): h=h.replace(k,open(f"{src}/{f}").read())
open(out,"w").write(h); print(len(h))
