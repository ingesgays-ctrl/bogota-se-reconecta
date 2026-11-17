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
- **V/C estimado por tramo (no es salida del modelo).** Los datos no traen volumen ni capacidad por tramo. El visor estima x_e = K · s_e · viajes del escenario, donde s_e es la centralidad de arista (fracción de trayectos que usan el tramo). Tiempo del tramo: t = t0 · (1 + 0,15 · x⁴). K y la velocidad libre v0 se ajustan por mínimos cuadrados para reproducir el tiempo medio con congestión oficial de los 4 escenarios. Resultado: v0 ≈ 25,6 km/h, error medio 1,8 %, predicción 29,5 / 27,5 / 26,0 / 24,9 min frente a los oficiales 30,1 / 26,9 / 26,4 / 24,6. V/C estimado máximo: 1,27 en la red actual (eje Paloquemao–Ricaurte–CAD–El Dorado–NQS norte) y 0,92 en el integral. Umbral de alerta visual: 0,85.
- Franjas: pico tarde = mismos volúmenes por tramo que el pico mañana (OD transpuesta). Hora valle = demanda como % ajustable del pico (por defecto 50 %), supuesto sin dato oficial.
- Simulación de flota: los buses avanzan a la velocidad BPR estimada de cada tramo, con 20 s de detención en cada estación (supuesto visual). Estados: fluido; congestionado (tramo con V/C estimado > 0,85); retraso (≥ 5 min sobre flujo libre, o estación cerrada en su recorrido).
- Parámetros α y β de la función BPR: no consignados en la memoria técnica; en la interfaz se citan los valores de referencia del Bureau of Public Roads (α = 0.15, β = 4) como referencia, no como valores del modelo.

- Trazado vial de la red actual: `public/data/tramos_viales_bogota.geojson`, generado una vez con OSRM sobre OpenStreetMap (perfil a pie, carro si el primero da desvío). Resultado: 131 tramos a pie, 5 en carro y 10 en línea recta (sin ruta razonable: ≤ 1,6 × la recta o ≤ 300 m más). 18 tramos que unen troncales distintas se dibujan punteados. Solo cambia el dibujo: los km del grafo y todos los cálculos siguen iguales.

## 7. Mapa base
CARTO exige API key desde 2026 (sin clave, marca de agua "API KEY REQUIRED"). Por defecto: Esri World Light Gray (base + referencia), respaldo OpenStreetMap en gris, y base vectorial UPL si el visor bloquea imágenes externas. Si se obtiene una clave CARTO, se pega en `CARTO_KEY` y se usa Positron.
