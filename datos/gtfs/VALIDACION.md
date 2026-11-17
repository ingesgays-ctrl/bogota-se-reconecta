# Validación de la oferta GTFS completa de día hábil frente al grafo del visor

- **Fuente:** GTFS estático TransMilenio `GTFS_20261013`, `agency_id == 1` (troncal), con **todos los `service_id` de día hábil** (lunes a viernes = 1 en `calendar.txt`, cruce con `dtype=str`).
- **Validación:** 17-nov-2026 con `python3 -I scripts/gtfs_integrar.py <shapes.txt>`.
- **Reemplaza:** la versión anterior (`matriz_arcos_gtfs_visor.csv`, solo `service_id == 1`, 27 rutas y 107 nodos), que queda en el historial de git.

## 1. Archivos de entrada

| Archivo | Contenido |
|---|---|
| `matriz_arcos_gtfs_habil_completo.csv` | 2.173 arcos dirigidos: 721 de mañana (6–9 a. m.), 733 de valle (9 a. m.–4:30 p. m.) y 719 de tarde (4:30–7:30 p. m.). Incluye `distancia_km` real tomada de `shape_dist_traveled`. |
| `catalogo_estaciones_gtfs_coords.csv` | 143 estaciones con `lat` y `lon` GTFS. Portal Usme queda unificado en `90004`. |
| `shapes.txt` | 1.100 trazados oficiales. Pesa 46 MB y no se versiona; se pasa como argumento al script. |

**Consistencia interna: correcta.**
- Sin filas duplicadas.
- En todas las filas, `buses_por_hora = total_buses_franja / horas_franja` y `tiempo_minimo ≤ tiempo_promedio`.
- Ninguna fila tiene distancia vacía o igual a 0.
- 29 arcos tienen menos de 1 bus/h.
- Las 143 estaciones del catálogo son las mismas que aparecen en la matriz.

## 2. Cobertura: completa
- **143 de 143 nodos** del grafo tienen estación GTFS, con correspondencia uno a uno.
- **95 rutas comerciales.**
  - 94 están en el modelo. Solo **G45** no aparece en la hoja `Rutas`.
  - 12 rutas del modelo no tienen viajes en el GTFS de día hábil:
    - D81, K86, L81, L82 y M86: variantes de Ciclovía, que operan solo domingos y festivos.
    - C84, F63, M82, M84, M85, P85 y Z63.
- **144 de los 146 tramos** de la matriz base tienen oferta. Los 2 que no la tienen son Santa Lucía–Consuelo y Socorro–Biblioteca (ver §4).
- **Conclusión:** esta versión **sí sirve como oferta programada completa del sistema troncal en día hábil**.

## 3. Equivalencias station_id → nodo (`equivalencias_gtfs_grafo.csv`)
El método principal es la coordenada GTFS más cercana al nodo del grafo. Así quedan los casos que antes estaban en confianza `media` o `revisar`:

| station_id | Nombre GTFS | Nodo | Distancia | Confianza |
|---|---|---|---|---|
| 3002 | Suba | E53 Suba TV 91 | < 300 m | alta |
| 3005 | Suba | E50 Suba – Av. Boyacá | 9 m | alta |
| 3012 | Suba | E44 Suba Calle 95 | < 300 m | alta |
| 90007 | Suba | E45 Suba Calle 100 | < 300 m | alta |
| 7102 | NQS | E70 NQS Calle 75 | < 300 m | alta |
| 7105 | Movistar Arena | E73 (TIGO en el modelo) | < 300 m | alta |
| **7007** | NQS | **E86 CL 38 A Sur – Centro Mayor** | **1 m** | alta |
| **7008** | NQS | **E85 NQS Calle 30 Sur** | 25 m | alta |
| 9118 | Marly B | E21 (coordenada corregida, ver abajo) | — | alta |

**7007 no es E85.** Su coordenada (4,5938, −74,1235) cae a 1 m del nodo E86 (CL 38 A Sur) y a 636 m de E85. E85 corresponde al ID **7008**, que en el catálogo nuevo aparece como segunda estación "NQS". Se asignó por coordenada.

**Marly (9118 → E21).** En el grafo, el nodo E21 ("Calle 53 – UMB") estaba a 0,32 km de Calle 57. Con la coordenada GTFS (4,636288, −74,067008), la distancia real a la estación GTFS de Calle 57 es de unos 1,0 km.
- **Cambio aplicado:** se corrigió solo la **coordenada** de E21 en `src/data.json`, `datos/red_troncal_actual.geojson`, `scripts/tramos_aristas.json` y `scripts/prep.py` (`COORD_GTFS`). La topología no cambió.
- **Trazado vial nuevo:** E20–E21 y E21–E22 se tomaron del shape oficial 12558 (`metodo: gtfs-shape`).
  - E20–E21: 0,76 km (antes 0,34 km).
  - E21–E22: 1,06 km (antes 1,55 km).
  - Calle 57 → Av. 39 suma lo mismo que antes, unos 1,8 km.

**Coordenadas del grafo con diferencias grandes frente al GTFS (sin corregir):**

| Nodos | Diferencia | Observación |
|---|---|---|
| Islandia (E115) | 1.610 m | Extensión Américas. El orden de las estaciones coincide; las coordenadas no. Se asignaron por nombre. |
| Laureles (E116) | 1.104 m | Ídem. |
| Tibanica (E117) | 790 m | Ídem. |
| Danubio (E40) | 273 m | |
| Flores (E19) | 256 m | |
| Calle 57 (E20) | 232 m | |
| Av. Jiménez (E25) | 191 m | |

Estas diferencias no afectan la topología, pero sí las distancias de esos tramos en el grafo. Se dejan anotadas para revisión.

## 4. Topología (capa de oferta GTFS, separada de la matriz base)
**La matriz base de 143 nodos y 146 tramos no se modificó.** Sigue reproduciendo los 110 / 38 / 83 / 27 puentes oficiales. La capa de oferta usa su propio grafo:

**Corrección del ramal sur.**
- Se quitan Santa Lucía–Consuelo (E33–E38) y Socorro–Biblioteca (E34–E35).
- Se agregan Socorro–Consuelo (E34–E38) y Santa Lucía–Biblioteca (E33–E35).
- Oferta en la mañana:
  - Consuelo → Socorro: 109,7 bus/h.
  - Socorro → Consuelo: 72,3 bus/h.
  - Biblioteca → Santa Lucía: 66,0 bus/h.
  - Santa Lucía → Biblioteca: 58,7 bus/h.

**Enlaces operacionales de tráfico mixto.** Son buses duales que salen de la calzada exclusiva sin parada intermedia, no infraestructura troncal construida. En `oferta_tramos_gtfs.csv` van con `tipo = "enlace operacional (tráfico mixto)"`.
- **Quiroga ↔ Av. 1 de Mayo** (M83/H83): 17,7 y 12,0 bus/h en la mañana.
- **Tygua ↔ Nariño** (B72/H72): 28,0 y 21,3 bus/h en la mañana.

**Conectores que aún le faltan al grafo.** Son 26 pares origen-destino (72 arcos-franja) en los que el camino más corto del grafo mide más de 1,35 veces la distancia GTFS. Para no inflar tramos por los que el bus no pasa, **no se proyectan** y quedan listados en `validacion_gtfs.json`:

| Conector | Rutas | Grafo vs GTFS |
|---|---|---|
| Calle 26 (Centro Memoria/Concejo) ↔ Caracas (Calle 26/Calle 22) | 3, K23, B23, J74, B74, J24, D24 | 3,7–6,4 km vs 1,3–3,0 km |
| Carrera 10 (Las Nieves/Bicentenario) ↔ Caracas (Av. Jiménez) | F51, M51, B18, L18 | 4,6–6,3 km vs 0,7–1,9 km |
| Carrera 10 (Las Nieves) ↔ Calle 26 (Centro Memoria) | K10, L10 | 8,1–9,3 km vs 1,9–2,2 km |
| Calle 6 (Tygua/Guatoque) ↔ Caracas (Av. Jiménez/Hortúa/Fucha) | 8, C17, H17, D21 | 3,6–6,0 km vs 1,0–3,7 km |
| Suba (San Martín/Rionegro) ↔ Calle 80 (Escuela Militar), sin pasar por NQS Calle 75 | 7, B50, C50 | 1,6–2,1 km vs 0,7–1,4 km |
| NQS (La Castellana) ↔ Autonorte (Calle 100) | B12 | 1,5 km vs 1,1 km |
| Caracas (Calle 22) ↔ De La Sabana | A61, Z61 | 1,6 km vs 1,1 km |

Si se agregan como enlaces de la capa de oferta, como ya se hizo con Quiroga y Tygua, la proyección queda completa.

## 5. Reparto de los saltos expresos
Para cada uno de los 747 pares origen-destino se buscó el método más fiel:

| Método | Pares | Qué hace |
|---|---|---|
| Adyacente | 282 | Las dos estaciones son vecinas en el grafo. |
| Trazado | 403 | Se toma el shape oficial que pasa a 60 m o menos de ambas estaciones y cuya longitud se parece a `distancia_km`. La oferta se reparte en las estaciones por las que pasa, a 45 m o menos. |
| Grafo | 32 | No hubo shape compatible; se usa el camino más corto, cuya longitud sí es compatible con la distancia GTFS. |
| Enlace operacional | 4 | Los dos enlaces de tráfico mixto, en ambos sentidos. |
| Conector faltante | 26 | No se proyecta (ver §4). |

El detalle de cada arco, con su camino, método, velocidad implícita y si es apto para calibración, está en `arcos_proyeccion_gtfs.csv`.

## 6. Filtros de limpieza
- **Bucle `9110 → 9110`** (Av. Jiménez, ruta 5): excluido en las 3 franjas.
- **Velocidad implícita < 8 km/h:** con la distancia real del shape, **ningún arco queda por debajo de 8 km/h**. La mínima es 11,8 km/h (Olaya → Quiroga, tarde).
  - Los casos que antes daban menos de 8 km/h (Portal Tunal ↔ Parque, Universidades ↔ Av. Jiménez, Calle 127 → Calle 187) salían de usar la distancia en línea recta del grafo.
  - El filtro sigue activo en la columna `apto_calibracion_bpr`.
- **Distancias mayores en el GTFS que en el grafo:** en los portales y algunos retornos, la distancia GTFS duplica la del grafo. Ejemplos: Portal 20 de Julio → Country Sur (1,44 frente a 0,69 km), Portal Tunal → Parque y Portal Américas → Patio Bonito. Es la maniobra dentro del portal. No se excluyen, pero conviene tenerlo en cuenta al calibrar.

## 7. Cifras del sistema (oferta programada, día hábil)

| Franja | Velocidad comercial | Tiempo medio por arco | Tramo físico más cargado |
|---|---|---|---|
| Mañana | 19,8 km/h | 5,81 min | Paloquemao → CAD, 319 bus/h |
| Valle | 21,0 km/h | 5,50 min | CAD → Paloquemao, 142 bus/h |
| Tarde | 18,5 km/h | 6,14 min | CAD → Paloquemao, 292 bus/h |

- La velocidad comercial es la distancia real ponderada por buses, dividida por el tiempo ponderado.
- **Resto del top 5 en la mañana:**
  - Ricaurte → Paloquemao: 317 bus/h.
  - CAD → Av. El Dorado: 304 bus/h.
  - Calle 106 → Pepe Sierra: 286 bus/h.
  - Pepe Sierra → Calle 127: 286 bus/h.
- **Sentido de los picos:** en la tarde los tramos más cargados se invierten (hacia el sur por la NQS y la Autonorte). Esto confirma el supuesto del visor de que el pico tarde es el espejo del pico mañana.
- **Alcance:** todo esto es el **horario programado** (el plan), no la operación real. No reemplaza ninguna cifra oficial del modelo IPF/BPR.

## 8. Archivos generados
- `equivalencias_gtfs_grafo.csv`: 143 filas con station_id → nodo, lat/lon GTFS, distancia al nodo, método y confianza.
- `oferta_tramos_gtfs.csv`: buses/h programados por tramo dirigido y franja, con `tipo` (troncal, corrección ramal sur o enlace operacional), km del grafo, km GTFS (en arcos adyacentes), rutas y tiempo programado (solo arcos aptos para calibración).
- `arcos_proyeccion_gtfs.csv`: los 2.173 arcos con su camino de nodos, método, velocidad y filtro.
- `validacion_gtfs.json`: todas las cifras y hallazgos en formato máquina.
