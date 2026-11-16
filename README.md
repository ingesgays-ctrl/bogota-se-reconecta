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
