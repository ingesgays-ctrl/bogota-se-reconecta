# Bogotá se reconecta

Visor interactivo de la expansión troncal de TransMilenio (POT Bogotá, Decreto 555 de 2021): relato por capítulos sobre un mapa 3D, laboratorio de la red (escenarios, cierres de estación, viajes origen → destino, cortina comparativa, simulación de buses) y análisis con metodología.

**Ver en línea:** https://ingesgays-ctrl.github.io/bogota-se-reconecta/

- **Modo usuario:** lenguaje cotidiano para cualquier persona de Bogotá.
- **Modo desarrollador:** términos técnicos (grafos, IPF, BPR, POT), metodología y preguntas del jurado.
- **Presentación:** botón ▶ Presentar o tecla P; flechas ← / → para avanzar.

## Compilar

```bash
npm run build   # valida src/app.js y genera index.html (un solo archivo) a partir de src/
```

`src/data.json` es el resultado del preprocesado (`scripts/prep.py`) de los archivos originales del proyecto. Los datos limpios descargables están en `datos/`.

## Datos en vivo (GTFS-RT)

El laboratorio puede mostrar los buses reales de TransMilenio, tomados del feed GTFS Realtime oficial, a través del puente de [`bridge/`](bridge/README.md). Cada posición GPS se acopla al tramo más cercano del grafo de la red troncal (a menos de 250 m).

Estados de un bus:
- **Retrasado:** 5 minutos o más de retraso.
- **Lento:** menos de 10 km/h fuera de una estación.

Si dos o más buses van lentos en el mismo tramo, el tramo se marca en ámbar. Para la ruta elegida también se calcula cada cuánto pasa un bus, los huecos (más de 1,6 veces el intervalo medio), los buses pegados y el tiempo real del recorrido completo comparado con el modelo.

Sin puente, o si el feed falla, el laboratorio muestra la simulación. La pestaña **Rutas** permite elegir cualquiera de las 114 rutas, verla sobre el mapa con ondas en sus paradas y seguir uno de sus buses.

## Trazado vial de las troncales

`public/data/tramos_viales_bogota.geojson` tiene cada uno de los 146 tramos de la red actual ajustado a las vías reales (OSRM sobre OpenStreetMap, © colaboradores de OpenStreetMap, ODbL). Se generó una sola vez; para regenerarlo: `node scripts/gen_tramos_osrm.mjs`. `npm run build` lo incrusta en `index.html`, y también queda publicado como archivo en GitHub Pages.
