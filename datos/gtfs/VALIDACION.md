# Validación de `matriz_arcos_gtfs_visor.csv` frente al grafo del visor

Fuente: GTFS estático TransMilenio `GTFS_20261013`, `agency_id == 1` (troncal), `service_id == 1` (día hábil). Validado el 17-nov-2026 con `scripts/gtfs_integrar.py`.

## 1. Consistencia interna del archivo: correcta
- **Filas:** 944 arcos dirigidos (312 mañana · 322 valle · 310 tarde).
- **Calidad de las filas:** sin duplicados ni bucles. En todas, `buses_por_hora = total_buses_franja / horas_franja` y `tiempo_minimo ≤ tiempo_promedio`.
- **Promedios y máximos:** coinciden con lo reportado.
  - Mañana: 5,27 min · 17,45 bus/h, con máximo de 55 en Fucha → Nariño.
  - Valle: 4,98 min · 12,32 bus/h, con máximo de 42,8 en Danubio → Portal Usme.
  - Tarde: 5,68 min · 17,11 bus/h, con máximo de 67 en Danubio → Portal Usme.
- **Rutas:** el archivo trae **27 rutas** distintas, no 28.
- **Sentido de los picos:** en la mañana la mayor oferta va hacia el norte (Santa Lucía → Socorro, Hortúa → Av. Jiménez) y en la tarde hacia el sur (Av. Jiménez → Hortúa). Esto respalda el supuesto del visor de que el pico tarde es el espejo del pico mañana.

## 2. Inconsistencias encontradas

### 2.1 Cobertura del feed (crítica)
- Solo hay viajes para **27 de las 106 rutas** del modelo (hoja `Rutas`).
- Faltan corredores completos que operan hoy:
  - Av. Américas (todas las F, Portal Américas);
  - Soacha (San Mateo, Terreros, León XIII, La Despensa, Bosa);
  - Eje Ambiental (Las Aguas, Museo del Oro);
  - estaciones Calle 161, Calle 106, Calle 85, Escuela Militar, Carrera 53, 21 Ángeles, Suba–Av. Boyacá, Gobernación, Normandía y CL 38A Sur.
- En total quedan **36 de 143 nodos** sin oferta y **22 de 146 tramos** sin buses.
- Probable causa: el filtro `service_id == 1`. Muchos servicios de día hábil suelen venir con otro `service_id`. Conviene tomar todos los `service_id` que tengan `monday..friday = 1` en `calendar.txt` (o fechas en `calendar_dates.txt`) para el periodo vigente.
- Mientras no se corrija, las frecuencias están **subestimadas** y no deben usarse como oferta total del sistema.

### 2.2 IDs y nombres
- **"Suba" se repite en tres IDs: 3002, 3012 y 90007.** Asignados por posición en la secuencia: 3002 = Suba TV 91 (E53), 90007 = Suba Calle 100 (E45), 3012 = Suba Calle 95 (E44). Confianza media.
- **"NQS" se repite en dos IDs: 7102 y 7007.**
  - 7102 = NQS Calle 75 (E70).
  - 7007 queda **sin resolver**: puede ser NQS Calle 30 Sur (E85) o NQS Calle 38A Sur (E86).
- **Portal Usme T1A (90004) y T3A (74372)** son el mismo portal, pero quedaron como nodos distintos. En el grafo se unen en E41.
- **Movistar Arena (7105) = TIGO (E73)** en el modelo; nuestros datos tienen el nombre comercial anterior.
- **Marly (9118):** en el modelo el nodo entre Av. 39 y Calle 57 se llama "Calle 53 – UMB" y está a 0,32 km de Calle 57. El GTFS programa 3,4 min, lo que implica 5,6 km/h. Hay que revisar las coordenadas o el nombre de ese nodo.
- **Nombres con formato irregular:** `Danubio  A` (doble espacio), `Portal Sur T3.` y `Portal Tunal T5.` (punto final), `PORTAL 20 DE JULIO T9.` (mayúsculas).

### 2.3 Topología: el GTFS contradice nuestro grafo (conectores que faltan o están cambiados)

| Arco GTFS | Rutas | Tiempo | En nuestro grafo | Diagnóstico |
|---|---|---|---|---|
| Socorro ↔ Consuelo, Socorro → Molinos | B75, C17, J76, H17, H75, H72 | 1,6–2,2 min | Hay que pasar por Santa Lucía (61–72 km/h implícitos) | En la matriz Socorro está unido a Biblioteca y Consuelo a Santa Lucía. Los IDs GTFS (900x = Usme, 800x = Tunal) y los arcos indican Santa Lucía–Biblioteca y Socorro–Consuelo. |
| Quiroga ↔ Av. 1 de Mayo | M83, H83 | 8,8–9,7 min | 11,7 km por 15 estaciones (72–80 km/h) | Falta el conector Caracas Sur ↔ Carrera 10 por la Av. 1° de Mayo. |
| Tygua ↔ Nariño | H72, B72 | 4,8–5,5 min | 5,9 km por 6 estaciones (64–74 km/h) | Falta el conector Calle 6 ↔ Caracas Sur. |

Estos arcos **no se proyectan** sobre tramos físicos, para no inflar tramos por los que esas rutas no pasan.

### 2.4 Tiempos con velocidad implícita < 8 km/h (no son errores de tránsito)
- **Portal Tunal ↔ Parque** (5,4–5,8 min por 0,45 km) y **Portal 20 de Julio → Country Sur** (5,1 min): maniobra y espera dentro del portal.
- **Universidades ↔ Av. Jiménez** (H76/J76, 13–25,6 min por 1,6 km): espera en el terminal de Universidades o recorrido en lazo.
- **Calle 127 → Calle 187** (B18, 1–2 viajes por franja, 21–24 min): variante de viaje poco frecuente.
- Recomendación: excluir estos casos de cualquier calibración de velocidades.

### 2.5 Franjas
- **Arcos con menos de 1 bus/h:** 23. Casi todos son de valle, con viajes de G53/K53, J76/H76 y B18 en los bordes de franja.
- Hay que confirmar cómo se asigna un viaje a una franja: por la hora de salida en el primer arco o por la hora de cada arco.

## 3. Comparación con el modelo BPR del visor (estimación del visor, no salida del modelo)
- **Velocidad comercial programada, ponderada por km del grafo:**

  | Mañana | Valle | Tarde |
  |---|---|---|
  | 20,1 km/h | 21,3 km/h | 18,7 km/h |

  Los km del grafo son en línea recta; con trazado vial, la velocidad sería algo mayor.
- **Tramos entre estaciones adyacentes (129, mañana):**
  - Tiempo GTFS: 343 min. Tiempo BPR estimado: 223 min. Razón 1,54; mediana 1,49.
  - La diferencia se explica sobre todo porque el GTFS incluye la **detención en estación** (de llegada a llegada) y el BPR solo el movimiento.
- **Tramos más cargados según el modelo (NQS: Av. El Dorado, Movistar Arena–Campín, 7 de Agosto, Av. Chile):** el tiempo GTFS es igual o algo menor que el BPR (por ejemplo, 1,9 frente a 2,3 min). El cuello de botella estimado no aparece como más lento en el horario programado. Es esperable, porque el horario es el plan y no la operación real.

## 4. Archivos generados
- `equivalencias_gtfs_grafo.csv`: station_id → nodo del grafo, con método y confianza.
- `oferta_tramos_gtfs.csv`: buses/h programados por tramo físico dirigido y franja (arcos expresos proyectados por el camino más corto), y tiempo programado en arcos entre estaciones adyacentes.
- `validacion_gtfs.json`: todos los hallazgos en formato máquina.
