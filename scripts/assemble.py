import sys,json
src,data,out=sys.argv[1],sys.argv[2],sys.argv[3]
h=open(f"{src}/index.html").read()
d=open(data).read().replace("</","<\\/")
h=h.replace("/*CSS*/",open(f"{src}/styles.css").read()).replace("/*DATA*/",d).replace("/*JS*/",open(f"{src}/app.js").read())
open(out,"w").write(h); print(len(h))
