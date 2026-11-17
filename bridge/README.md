# Puente GTFS-RT → laboratorio

TransMilenio publica sus datos en tiempo real con el estándar GTFS Realtime:

| Feed | URL |
|---|---|
| Posición de los buses | https://gis.transmilenio.gov.co/gtfs/vehiclepos.pb |
| Actualizaciones de viaje (retrasos) | https://gis.transmilenio.gov.co/gtfs/tripupdate.pb |
| Alertas de servicio | https://gis.transmilenio.gov.co/gtfs/serviceAlerts.pb |

El navegador no puede leer estos archivos directamente, porque el servidor oficial no envía cabeceras CORS. Este puente:

1. Descarga los tres archivos.
2. Los decodifica sin usar dependencias, con el mismo `src/gtfsrt.js` del sitio, copiado aquí como `gtfsrt.mjs` por `npm run build`.
3. Une posiciones, retrasos y alertas.
4. Entrega un JSON pequeño con CORS.

## Formato de salida (`/vehicles`)

```json
{
  "source": "gtfs-rt", "ts": 1794875367, "fetched": 1794875370, "partial": false,
  "vehicles": [
    { "id": "TM-0001", "lat": 4.60454, "lon": -74.067528, "bearing": 90, "speed": 7.5,
      "route_id": "1234", "route": "B74", "dir": 0, "trip": "…", "ts": 1794875367,
      "delay": 30, "congestion": "RUNNING_SMOOTHLY", "occupancy": "FEW_SEATS_AVAILABLE" }
  ],
  "alerts": [ { "id": "a1", "header": "…", "effect": "SIGNIFICANT_DELAYS", "routes": ["K23"], "stops": [] } ]
}
```

En los vehículos:
- `speed` está en m/s y `delay` en segundos.
- `route` es el código visible de la ruta (B74, K23…) cuando se configura `ROUTES_URL`. Si no se configura, vale lo mismo que `route_id`.

Si el feed oficial falla, la respuesta es `502` con `{ "error": "…" }`. En ese caso el laboratorio sigue mostrando la simulación.

## Opción A: Cloudflare Workers (gratis, sin servidor)

```bash
cd bridge
npx wrangler login
npx wrangler deploy        # usa wrangler.toml
```

Te devuelve una URL como `https://tm-gtfsrt-bridge.TU-CUENTA.workers.dev`. El laboratorio debe consultar `…/vehicles`. Las respuestas se guardan en caché 10 s, así que el feed oficial se consulta como máximo una vez cada 10 s, sin importar cuántas personas tengan abierto el sitio.

## Opción B: Node 18+ (sin dependencias)

```bash
npm run bridge            # http://localhost:8787/vehicles · /stream (SSE) · /health
```

Variables de entorno:

| Variable | Valor por defecto | Para qué sirve |
|---|---|---|
| `PORT` | 8787 | Puerto del servidor. |
| `POLL_SECONDS` | 10 | Cada cuánto se consulta el feed oficial. |
| `UPSTREAM` | feed oficial | URL base de los tres archivos `.pb`. |
| `ROUTES_URL` | (vacío) | Ver más abajo. |
| `ALLOWED_ORIGIN` | `*` | Sitios que pueden leer el puente; por ejemplo `https://ingesgays-ctrl.github.io`. |

`/stream` empuja cada lectura por Server-Sent Events. Hay un solo ciclo de consulta, compartido por todos los navegadores conectados.

## Conectar el sitio

Hay tres formas, de la más permanente a la más rápida:

1. **Para todos los visitantes:** pega la URL en `LIVE_DEFAULT`, al inicio de `src/live.js`. Luego ejecuta `npm run build` y haz push.
2. **Sin tocar código:** en modo desarrollador, abre la pestaña **Rutas → Conexión a datos en vivo**. Pega la URL y toca *Conectar*. Queda guardada en ese navegador.
3. **Para una prueba puntual:** agrega `?live=https://…/vehicles` a la dirección del sitio. `?live=off` desactiva los datos en vivo.

Con una URL de `/stream` el sitio usa SSE. Con una que empiece por `wss://` usa WebSocket, con mensajes en el mismo JSON.

## Traducir route_id → código de ruta

El GTFS-RT identifica cada ruta con un `route_id` interno. Para relacionar los buses con nuestras 114 rutas (B74, K23…), apunta `ROUTES_URL` a uno de estos:

- el `routes.txt` del GTFS estático de TransMilenio (Portal de Datos Abiertos de Bogotá), o
- un JSON con la forma `{"route_id": "B74"}`.

Sin esa tabla, los buses se dibujan igual: cada uno se acopla al tramo troncal más cercano del grafo y toma el color de su troncal. Lo único que se pierde es el filtro y las ondas de "seguir una ruta" con datos reales.
