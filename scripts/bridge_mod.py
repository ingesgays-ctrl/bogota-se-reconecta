# Copia el decodificador del navegador como módulo ES para el puente (una sola fuente de verdad)
src = open("src/gtfsrt.js").read()
open("bridge/gtfsrt.mjs", "w").write("// GENERADO desde src/gtfsrt.js por npm run build — no editar a mano\n" + src + "\nexport default GTFSRT;\n")
print("bridge/gtfsrt.mjs")
