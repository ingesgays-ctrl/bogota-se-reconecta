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
- **143 de los 146 tramos** de la matriz base tienen oferta. Los 3 que no la tienen son Santa Lucía–Consuelo y Socorro–Biblioteca (ver §4) y Virrey–La Castellana (sus buses usan el enlace La Castellana–Calle 100).
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

**Extensión Américas (corregida el 17-nov-2026).** Islandia (E115), Laureles (E116) y Tibanica (E117) estaban en el grafo a 1.610, 1.104 y 790 m de su coordenada GTFS. El orden de las estaciones coincidía; las coordenadas no.
- **Cambio aplicado:** se tomaron las coordenadas GTFS (90011, 90010, 90009), igual que con E21. La topología no cambió.
- **Trazado vial nuevo** desde los shapes oficiales:
  - Portal Américas–Islandia: 3,05 km (shape 12689).
  - Islandia–Laureles: 1,16 km (shape 13168).
  - Laureles–Tibanica: 0,64 km (shape 13167).
- **Efecto en las cifras oficiales:** los puentes siguen en 110 / 38 / 83 / 27 y la centralidad media del eje central sigue en 23,6 % → 16,8 %.

**Coordenadas que siguen con diferencias de 190 a 275 m (sin corregir):** Danubio (E40), Flores (E19), Calle 57 (E20) y Av. Jiménez (E25). No afectan la topología.

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

**Siete conectores más de la capa de oferta (enlaces operacionales de tráfico mixto).** Se derivaron de `shapes.txt`: son estaciones consecutivas del trazado oficial que el grafo base no une. Con ellos ya **no queda ningún par O-D sin proyectar** (antes eran 26 pares y 72 arcos-franja).

| Conector | Pares de estaciones | Rutas |
|---|---|---|
| Calle 26 ↔ Caracas | Centro Memoria ↔ Calle 26 · Centro Memoria ↔ Calle 22 · Universidades ↔ Calle 26 | K23, B23, 3, J74, B74, J24, D24 |
| Carrera 10 ↔ Caracas | Bicentenario ↔ Av. Jiménez · Las Nieves ↔ Av. Jiménez | L18, B18, M51, F51 |
| Carrera 10 ↔ Calle 26 | San Diego ↔ Centro Memoria | K10, L10 |
| Calle 6 ↔ Caracas | Tygua ↔ Av. Jiménez · Tygua ↔ Hortúa | 8, C17, H17, D21 |
| Suba ↔ Calle 80 | San Martín ↔ Escuela Militar | 7, B50, C50 |
| NQS ↔ Autonorte | La Castellana ↔ Calle 100 | B12 |
| Caracas ↔ Calle 13 | Calle 22 ↔ De La Sabana | A61, Z61 |

En total, la capa tiene 13 enlaces operacionales: estos 11 pares más Quiroga ↔ Av. 1 de Mayo y Tygua ↔ Nariño. Los más cargados en la mañana son La Castellana → Calle 100 (111 bus/h), Calle 100 → La Castellana (85 bus/h) y De La Sabana → Calle 22 (54 bus/h).

**Hallazgo nuevo: Virrey ↔ La Castellana (E15–E69).** Este tramo de la matriz base ya no recibe ningún bus GTFS. Las rutas que unen la NQS con la Autonorte entran por Calle 100, no por Virrey. Se recomienda revisar ese tramo de la matriz (no se tocó, porque cambiaría los puentes oficiales).

## 5. Reparto de los saltos expresos
Para cada uno de los 747 pares origen-destino se buscó el método más fiel:

| Método | Pares | Qué hace |
|---|---|---|
| Adyacente | 282 | Las dos estaciones son vecinas en el grafo. |
| Trazado | 413 | Se toma el shape oficial que pasa a 60 m o menos de ambas estaciones y cuya longitud se parece a `distancia_km`. La oferta se reparte en las estaciones por las que pasa, a 45 m o menos. |
| Grafo | 32 | No hubo shape compatible; se usa el camino más corto, cuya longitud sí es compatible con la distancia GTFS. |
| Enlace operacional | 20 | Los 13 enlaces de tráfico mixto (algunos en ambos sentidos). |

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
