# Fuente única de verdad — Visor Expansión Troncal TransMilenio (POT)

Decisiones de unificación de datos aprobadas el 16-nov-2026.

## 1. KPIs oficiales (modelo IPF + congestión BPR)
Fuente única: `comparacion_4_escenarios_congestion.csv`. Legados (versión sin congestión, NO usar): `comparacion_3_escenarios_av68.csv`, `comparacion_antes_despues.csv`, cifras de la tabla del `.md`.

| Indicador | Esc. 0 Base | Esc. 1 +5 Perif. | Esc. 2 +Av. 68 | Esc. 3 Integral |
|---|---|---|---|---|
| Estaciones Bogotá | 139 | 161 | 153 | 175 |
| Km adicionales (*) | 0.00 | 37.32 | 22.38 | 59.70 |
| Viajes pico AM (pax) | 433,315 | 456,067 | 446,788 | 469,541 |
| Longitud media (km) | 11.68 | 10.95 | 10.92 | 10.51 |
| Tiempo medio congestión (min) | 30.1 | 26.9 | 26.4 | 24.6 |
| Carga Paloquemao–Ricaurte (pax) | 84,683 | 88,894 | 70,552 | 68,216 |
| Vulnerabilidad Ricaurte (%) | 37.4 | 16.6 | 0.0 | 0.0 |
| Puentes topológicos | 110 | 38 | 83 | 27 |
| Alivio NQS vs actual | +0.0% | +5.0% | -16.7% | -19.4% |

(*) Km sobrescritos desde `tabla_coherencia_corredores.csv` (longitud geométrica en EPSG:9377).

Nota KPI: red base = 143 estaciones (139 Bogotá + 4 Soacha); la simulación evalúa demanda interna de Bogotá (139 → 175).

## 2. Kilómetros (tabla de coherencia)
Total 59.70 km = 38.42 obra nueva + 21.28 operación compartida. C1 5.07 · C2 6.49 · C3 11.72 · C4 6.99 · C5 7.05 · C6_Av68 22.38.

## 3. Ejes viales completos
- C1: Av. Calle 80 → Transversal 94 → Av. Ciudad de Cali (Carrera 86)
- C2: Av. Calle 145 → Av. Carrera 104 → Av. Calle 132 → Av. Calle 127 → Av. Calle 90 → Transversal 94
- C3: Autonorte (Av. Carrera 45) → Av. Calle 153 → Av. Boyacá (Carrera 72) → Av. Suba (Transversal 76 / Calle 145)
- C4: Av. Caracas (Carrera 14) → Av. Calle 51 Sur → Carrera 5R → Diagonal 50 Sur → Av. Carrera 10
- C5: Av. Calle 58A Sur → Av. Carrera 19C → Diagonal 48 Sur → Av. Caracas → Calle 44C Sur → Calle 27 Sur → Av. Carrera 10
- C6_Av68: Av. Carrera 68 → Av. Calle 100 (NQS Sur / Alquería → Autonorte / Calle 100)

## 4. Estaciones
- Nombres repetidos se desambiguan con `[corredor·orden]`, p. ej. `Avenida Carrera 86 (Tabora) [C1·2]`.
- Av. 68: ficha enriquecida con UPL, índice de densidad, conexión Metro y Área de Actividad por tramo: Puente Aranda → industrial/productivo; Salitre → grandes servicios metropolitanos; Teusaquillo y Barrios Unidos → estructurante/proximidad (asignación por UPL, no por cruce espacial con `p1_area_actividad`).
- Calle 76 y Tercer Milenio no están en la matriz de 143 estaciones: no se pueden simular.

## 5. Limpieza
CSV con `utf-8-sig` (BOM); "Ricuarte" → "Ricaurte"; `p3_upl.geojson` simplificado (tolerancia ~0.0005°).

## 6. Cálculos derivados en el visor (no son salidas del modelo IPF/BPR)
- Grafo por escenario: matriz 143×143 (146 aristas) + secuencia de estaciones de cada corredor. Reproduce exactamente los puentes oficiales (110 / 38 / 83 / 27). Conexiones de la Av. 68 con troncales existentes inferidas por cercanía (≤ 300 m), solo para el grafo.
- Centralidad de intermediación (Brandes) ponderada por km, normalizada por (n−1)(n−2). Mide rutas, no pasajeros. Media del eje central (10 nodos: Ricaurte, Paloquemao, CAD, Av. El Dorado, Av. Jiménez, Calle 22, Calle 26, Museo del Oro, San Victorino, Las Aguas): 23.6 % → 16.8 % en el escenario integral.
- Simulador de rutas O→D: Dijkstra por km (tramos de corredor escalados a sus km oficiales; tramos de la red actual en línea recta). Transbordos = cambios entre los 114 servicios de la hoja `Rutas` (cada corredor nuevo = 1 servicio). Tiempo = suma tramo a tramo con BPR estimado (ver punto siguiente) + minutos por transbordo (supuesto ajustable, 5 min por defecto).
- **V/C estimado por tramo (no es salida del modelo).** Los datos no traen volumen ni capacidad por tramo. El visor estima x_e = K · s_e · viajes del escenario, donde s_e es la centralidad de arista (fracción de trayectos que usan el tramo). Tiempo del tramo: t = t0 · (1 + 0,15 · x⁴). K y la velocidad libre v0 se ajustan por mínimos cuadrados para reproducir el tiempo medio con congestión oficial de los 4 escenarios. Desde el 17-nov-2026 la calibración incluye semáforos y demanda (§10): v0 ≈ 28,5 km/h, error medio 1,7 %, predicción 29,6 / 27,4 / 26,0 / 24,9 min frente a los oficiales 30,1 / 26,9 / 26,4 / 24,6 (solo BPR: v0 ≈ 25,6 km/h, error 1,8 %). V/C estimado máximo: 1,23 en la red actual (eje Paloquemao–Ricaurte–CAD–El Dorado–NQS norte) y 0,89 en el integral (antes de §10: 1,27 y 0,92). Umbral de alerta visual: 0,85.
- Franjas: pico tarde = mismos volúmenes por tramo que el pico mañana (OD transpuesta). Hora valle = demanda como % ajustable del pico (por defecto 50 %), supuesto sin dato oficial.
- Simulación de flota: los buses avanzan a la velocidad BPR estimada de cada tramo, con 20 s de detención en cada estación (supuesto visual). Estados: fluido; congestionado (tramo con V/C estimado > 0,85); retraso (≥ 5 min sobre flujo libre, o estación cerrada en su recorrido).
- Parámetros α y β de la función BPR: no consignados en la memoria técnica; en la interfaz se citan los valores de referencia del Bureau of Public Roads (α = 0.15, β = 4) como referencia, no como valores del modelo.

- Trazado vial de la red actual: `public/data/tramos_viales_bogota.geojson`, generado una vez con OSRM sobre OpenStreetMap (perfil a pie, carro si el primero da desvío). Resultado: 131 tramos a pie, 5 en carro y 10 en línea recta (sin ruta razonable: ≤ 1,6 × la recta o ≤ 300 m más). 18 tramos que unen troncales distintas se dibujan punteados solo cuando el mapa no está coloreado por troncal (con color por troncal van continuos, ver §11). Solo cambia el dibujo: los km del grafo y todos los cálculos siguen iguales.

## 7. Mapa base
CARTO exige API key desde 2026 (sin clave, marca de agua "API KEY REQUIRED"). Por defecto: Esri World Light Gray (base + referencia), respaldo OpenStreetMap en gris, y base vectorial UPL si el visor bloquea imágenes externas. Si se obtiene una clave CARTO, se pega en `CARTO_KEY` y se usa Positron.

## 8. GTFS estático TransMilenio (GTFS_20261013), oferta completa de día hábil
`datos/gtfs/matriz_arcos_gtfs_habil_completo.csv`: 2.173 arcos (721 mañana · 733 valle · 719 tarde), troncal, todos los `service_id` hábiles de `calendar.txt`, con `distancia_km` desde `shape_dist_traveled`. `catalogo_estaciones_gtfs_coords.csv`: 143 estaciones con coordenadas, uno a uno con los 143 nodos (`equivalencias_gtfs_grafo.csv`). 95 rutas (94 del modelo + G45). Integración: `python3 -I scripts/gtfs_integrar.py <shapes.txt>`; validación en `datos/gtfs/VALIDACION.md`.
- Uso permitido: oferta PROGRAMADA y tiempos programados de referencia. No reemplaza ninguna cifra oficial del modelo IPF/BPR.
- La matriz base de 143 nodos / 146 tramos (110 / 38 / 83 / 27 puentes) no se modifica. La capa de oferta GTFS usa su propio grafo: ramal sur corregido (Socorro–Consuelo y Santa Lucía–Biblioteca en lugar de Socorro–Biblioteca y Santa Lucía–Consuelo) y 13 enlaces operacionales de tráfico mixto: Quiroga ↔ Av. 1 de Mayo (M83/H83), Tygua ↔ Nariño (B72/H72) y los 7 conectores derivados de `shapes.txt` (Calle 26 ↔ Caracas, Carrera 10 ↔ Caracas, Carrera 10 ↔ Calle 26, Calle 6 ↔ Caracas, Suba ↔ Calle 80, NQS ↔ Autonorte, Caracas ↔ Calle 13; 11 pares de estaciones).
- Saltos expresos repartidos por el trazado oficial (`shapes.txt`, no versionado): todos los arcos quedan proyectados. Virrey ↔ La Castellana (E15–E69) no recibe buses GTFS (entran por Calle 100): pendiente de revisión en la matriz.
- Equivalencias por coordenada: 7007 = E86 (CL 38 A Sur), 7008 = E85 (NQS Calle 30 Sur), 9118 Marly = E21.
- Correcciones al grafo (solo coordenadas, topología sin cambios; `COORD_GTFS` en `scripts/prep.py`): **E21** = Marly GTFS (4,636288, −74,067008), el Excel la ubicaba a 0,32 km de Calle 57 (real ≈ 1,0 km); **E115 Islandia, E116 Laureles y E117 Tibanica** = coordenadas GTFS 90011 / 90010 / 90009 (estaban corridas 1,6 / 1,1 / 0,8 km). Trazados viales de esos tramos tomados de los shapes 12558, 12689, 13168 y 13167. Puentes (110 / 38 / 83 / 27) y centralidad del eje central (23,6 % → 16,8 %) sin cambios.
- Filtros: bucle 9110 → 9110 excluido; arcos con velocidad implícita < 8 km/h fuera de la calibración BPR (con distancia real no hay ninguno; mínimo 11,8 km/h).
- Cifras derivadas (cálculo propio sobre el GTFS): velocidad comercial programada 19,8 km/h (mañana), 21,0 (valle), 18,5 (tarde); tramo más cargado Paloquemao → CAD con 319 bus/h en la mañana.

## 9. Horarios de los servicios (Guía General de viaje TransMilenio, corte agosto 2026)
`datos/horarios_servicios.json`, extraído con `scripts/horarios_guia.py`. De la guía solo se toman los HORARIOS: rutas y paradas siguen siendo las del Excel. Los 106 códigos de servicio del modelo tienen horario, y las filas se verificaron visualmente contra el PDF.
- Días: L-V lunes a viernes · L-S lunes a sábado · S sábado · L-D todos los días · D-F domingos y festivos (festivos nacionales de 2026 incluidos, con el nuevo del 13 de julio).
- "Operación durante Ciclovía" (D81, K86, L81, L82, M86; domingos y festivos de 7:00 a.m. a 2:00 p.m.): recorrido especial. Solo se usan sus estaciones TransMilenio que están en el Excel; los paraderos zonales se ignoran.
- Planeador de viaje: una ruta solo se ofrece si opera a la hora de salida. Si un tramo se queda sin bus, se muestra cuándo vuelve a pasar. Se avisa cuando quedan ≤ 30 min para el último bus, contando el tiempo de viaje estimado hasta ese tramo.
- Corredores propuestos (C1–C6) sin horario oficial: se asume el horario general del sistema según la guía (4:00 a.m.–11:00 p.m.).
- La hora de salida fija la franja del modelo: pico mañana 6–9, pico tarde 4:30–7:30 (días hábiles); el resto, y sábados, domingos y festivos, valle.

## 10. Congestión por semáforos y demanda de pasajeros (estimación del visor, no salida del modelo)
Se suma al BPR del §6 en el tiempo de viaje del planeador y en la simulación de buses. Objetivo de diseño pedido: el viaje medio en hora pico suma de 4 a 6 min de congestión; se calibra a 5 min.
- **Semáforos:** `datos/semaforos_osm.json`, 11.462 nodos `highway=traffic_signals` o `crossing=traffic_signals` de OpenStreetMap (Overpass, base 2026-06-01; descarga reproducible con `.github/workflows/semaforos_osm.yml`). `scripts/semaforos_tramos.py` los asigna a un tramo si están a ≤ 25 m de su trazado, agrupa los que quedan a ≤ 40 m en una intersección y descarta los que quedan a < 60 m de una estación. Resultado: 242 intersecciones en los 146 tramos de la red actual (≈ 1,9 por km); 49 tramos sin semáforo (Autopista Norte y la mayor parte de la Calle 26 y la NQS). Corredores nuevos: densidad por km sobre su trazado (C1 2,6 · C2 2,9 · C3 1,4 · C4 1,9 · C5 3,1 · C6 1,4 por km).
- **Demora por intersección (fórmulas de Webster):** espera en rojo C·(1−g)²/(2·(1−g·x)); cola de buses x²/(2·q·(1−x)), con q = buses/h programados del GTFS en ese tramo y franja, y capacidad 1.200 buses/h con verde continuo; frenar y arrancar (1−g)·v/2·(1/a + 1/b), donde v depende de la **distancia al semáforo o estación anterior**: con poca distancia el bus no alcanza los 50 km/h.
- **Supuestos:** ciclo de 120 s en pico y 90 s en valle; verde para la troncal de 50 % en pico y 60 % en valle; a = 1,0 m/s², b = 1,3 m/s².
- **φ (fracción de semáforos donde el bus sí se detiene, sin onda verde):** es el único parámetro calibrado. Valor resultante: 0,17.
- **Demanda de pasajeros:** 10 s extra por estación por cada unidad de V/C estimado, para el abordaje en hora pico (supuesto).
- **Recalibración:** v0 y K se volvieron a ajustar con los tres componentes para que el tiempo medio siga reproduciendo el oficial: 29,6 / 27,4 / 26,0 / 24,9 min frente a 30,1 / 26,9 / 26,4 / 24,6 (error medio 1,7 %; antes 1,8 %). La velocidad a flujo libre pasa de 25,6 a 28,5 km/h.
- **Congestión del viaje medio en el pico:** red actual 5,0 min, de los cuales 1,9 min son semáforos; red completa 2,8 min. En la muestra del planeador (1.001 pares O-D, red actual), el pico da media 5,2 min, mediana 5,0 y percentil 90 de 9,4 min; la hora valle da 1,8 min.

## 11. Troncales y colores del mapa
Fuente: hoja `Estaciones` del Excel, color de relleno del nombre de cada estación (`scripts/troncales_excel.py` → `src/data.json`, clave `troncales`). Cada bloque de color es una troncal.

| Troncal | Estaciones | Color |
|---|---|---|
| B Autopista Norte | E1–E17 | #92D050 |
| A Caracas | E18–E25 | #6600FF |
| H Caracas Sur · Tunal | E26–E37 | #FF9933 |
| H Caracas Sur · Usme | E38–E41, con el tronco E26–E33 | #FF9933 |
| C Suba | E42–E55 | #FFFF00 |
| D Calle 80 | E56–E68 | #9933FF |
| E NQS Central | E69–E82 | #F6C6AD |
| G · S NQS Sur y Soacha | E83–E98 | #00B0F0 |
| F Américas | E99–E117 | #FF0000 |
| J Eje Ambiental | E118–E120 | #FF99FF |
| K Calle 26 | E121–E133 | #F0AD76 |
| L Carrera 10 | E134–E143 | #66FFFF |

- Tunal y Usme tienen el mismo color en el Excel. En el visor se separan en dos ramales: comparten el tronco Hortúa – Santa Lucía y cada uno se puede filtrar por separado en la pestaña Troncal.
- Un tramo toma el color de la troncal que contiene sus dos estaciones. Los tramos entre dos troncales consecutivas en el Excel van con la segunda.
- **Conectores entre troncales (15 tramos):** cada uno pasa a la troncal que continúa por él, y la estación de transbordo queda también como estación de esa troncal (`CONECTORES` en `scripts/troncales_excel.py`):
  - NQS Central: Virrey–La Castellana.
  - Calle 80: Héroes–Polo y Escuela Militar–NQS Calle 75.
  - Américas: Av. Jiménez–De La Sabana, Ricaurte–San Façon y Ricaurte–CDS.
  - Eje Ambiental: Av. Jiménez–Museo del Oro.
  - Suba: San Martín–NQS Calle 75.
  - Calle 26: Av. El Dorado–Concejo, Av. El Dorado–Ciudad Universitaria y Universidades–Centro Memoria.
  - NQS Sur y Soacha: Ricaurte–Comuneros y Guatoque–Comuneros.
  - Carrera 10: Bicentenario–San Victorino y Bicentenario–San Bernardo.
- **Efecto:** los 146 tramos quedan con troncal y se dibujan continuos, en el mapa, en el mapa vectorial y en el esquema. Las estaciones de transbordo pertenecen a varias troncales (p. ej. Ricaurte: NQS Central, NQS Sur y Soacha, Américas; Av. Jiménez: Caracas, Américas, Eje Ambiental), y así aparecen en la ficha de estación y en el filtro de la pestaña Troncal. Solo cambia el color y la pertenencia: la topología y las cifras oficiales no cambian.
- Para que el amarillo, el durazno y el cian se lean sobre el mapa claro, las líneas van con un borde oscuro fino; el color no se cambia.
- Socorro sigue en el ramal Tunal, como en el orden del Excel y en la matriz oficial. El GTFS la ubica en el ramal Usme (ver §8).
- Caminata entre buses: en modo usuario es un valor fijo de 5 min por transbordo; en modo desarrollador sigue siendo un supuesto ajustable de 0 a 12 min.

## 12. Presentación (no cambia ninguna cifra)
- **Modo noche:** botón "🌙 Noche" en la barra superior, guardado en el navegador. Oscurece paneles y textos, invierte suavemente el mapa base de teselas y pone un velo oscuro sobre el mapa vectorial (capa `ml-night`). Los colores de troncales y corredores no cambian.
- **"Valle" → "Hora tranquila · 9 a. m.–4:30 p. m."** en modo usuario. En modo desarrollador sigue diciendo "Valle".
- **Planear viaje:** con un viaje elegido y la pestaña abierta, el mapa muestra solo la ruta (hoy y con la red nueva), sus estaciones, el origen con la primera ruta que se toma y cada transbordo con el cambio de ruta (p. ej. "Transbordo 1 · Portal 80 · C2 → C1"). Las troncales, corredores, buses, columnas y demás etiquetas vuelven al cambiar de pestaña, cerrar el panel o quitar el viaje.
- **Portales:** las 9 estaciones cuyo nombre empieza por "Portal" (Norte, Tunal, Usme, Suba, 80, Sur, Américas, El Dorado y 20 de Julio) se dibujan como un cuadro oscuro con una "P" en el mapa, en el mapa vectorial, en el esquema y en la leyenda. Terminal no se marca como portal.

