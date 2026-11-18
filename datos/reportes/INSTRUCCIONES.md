# Reportes ciudadanos → hoja de Google

La pestaña **Reportar** de la página envía cada reporte a una hoja de Google tuya. Un Apps Script publicado como aplicación web recibe los reportes y le devuelve al mapa los de los últimos 30 días. GitHub Pages no tiene servidor propio; el script hace ese papel.

## Configuración (una sola vez, unos 5 minutos)

1. **Crea la hoja.**
   - Abre <https://sheets.new> con la cuenta de Google que va a administrar los reportes.
   - Nómbrala, por ejemplo, "Reportes ciudadanos – Bogotá se reconecta".
2. **Pega el script.**
   - En la hoja, ve a **Extensiones → Apps Script**.
   - Borra lo que haya en `Código.gs` y pega el contenido de [`Codigo.gs`](Codigo.gs).
   - Guarda con el ícono del disquete.
3. **Publícalo como aplicación web.**
   - Ve a **Implementar → Nueva implementación** y, en el engranaje de "Tipo", elige **Aplicación web**.
   - Configúrala así:
     - **Ejecutar como:** Yo.
     - **Quién tiene acceso:** Cualquier persona.
   - Pulsa **Implementar** y autoriza el acceso a la hoja.
   - Si Google muestra "Google no verificó esta app", entra en **Configuración avanzada → Ir a … (no seguro)**. Es tu propio script y solo usa esta hoja.
4. **Copia la URL** de la aplicación web, la que termina en `/exec`, y pégala en `REPORTES_URL`, al comienzo de `src/reportes.js`. Luego compila y publica.
   - Para probar antes, en **modo desarrollador** la pestaña Reportar tiene un campo donde puedes pegar la URL. Queda guardada solo en tu navegador.

La primera vez que llegue un reporte, el script crea la pestaña **Reportes** con estas columnas: `id, recibido, fecha_hecho, tipo, estacion_id, estacion, ruta, descripcion, publicar, estado`.

## Moderación y seguimiento

- **Ocultar un reporte del mapa:** escribe `no` en la columna **publicar**. El reporte se queda en la hoja; solo deja de mostrarse.
- **Columna estado:** úsala para el seguimiento interno (`nuevo`, `en revisión`, `atendido`…). El mapa no la muestra.
- **Reportes publicados:** el mapa muestra los de los últimos 30 días, máximo 300.

## Qué datos se guardan y protecciones

- **Datos del reporte:** tipo, estación, ruta (opcional), fecha y hora del hecho y descripción, de máximo 500 caracteres.
- **Datos personales:** no se piden nombre, correo, teléfono ni ubicación GPS. La página pide no incluirlos en la descripción. El script no registra direcciones IP.
- **Fórmulas:** un texto que empiece por `=`, `+`, `-` o `@` se guarda como texto, sin ejecutarse como fórmula.
- **Validación:** se aceptan solo los tipos de la lista y los ID de estación del modelo (`E1`–`E143`).
- **Límites contra abusos:**
  - Como máximo 30 reportes por minuto en total.
  - Cada navegador puede enviar un reporte por minuto.
  - Un campo oculto detecta a los robots.
- **Emergencias:** la página recuerda que para emergencias se llama a la **Línea 123**, porque los reportes no se atienden en tiempo real.

## Si cambias el script

Después de editar `Código.gs`, ve a **Implementar → Gestionar implementaciones**, edita la implementación y elige **Nueva versión**. Así la URL `/exec` se mantiene.
