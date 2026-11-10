# Dependencias gráficas de LINEALAB v1.0

## Plotly.js (gráficas del barrido)

Se distribuye **Plotly.js basic v2.35.2** como copia local, bajo licencia MIT.

- Archivo: `vendor/plotly-basic-2.35.2.min.js` (1 071 091 bytes).
- Licencia íntegra: `vendor/plotly-LICENSE.txt`.
- Copyright del archivo: 2012–2024 Plotly, Inc.; cabecera original conservada.
- Origen: https://cdn.plot.ly/plotly-basic-2.35.2.min.js
- Paquete oficial contrastado: https://registry.npmjs.org/plotly.js-basic-dist-min/-/plotly.js-basic-dist-min-2.35.2.tgz
- Código de la versión: https://github.com/plotly/plotly.js/tree/v2.35.2
- SHA-256: `138c2e81014b979dc00867a93da55b7605a17495ee78dd7afb433b7f021dfcfa`.

El archivo de CDN es idéntico byte a byte al `plotly-basic.min.js` del paquete npm
oficial. La licencia local se extrajo de ese mismo paquete. No se ha modificado
ni recompilado Plotly. La referencia interna del bundle a un archivo de notas de
licencia se mantiene tal como fue publicada por el distribuidor.

El paquete basic soporta las trazas scatter, zoom, hover y exportación PNG usadas
aquí. No interviene en las ecuaciones de LINEALAB ni en la exportación CSV.
No se cargan recursos remotos para ejecutar el proyecto. En CodePen se puede
usar el enlace CDN anterior como recurso externo, conservando esta atribución.

## three.js (visor 3D del modelo geométrico)

Se distribuye **three.js r147 (0.147.0)** como copia local, bajo licencia MIT.
Es la última serie que publica la compilación clásica y los módulos `examples/js`,
compatibles con los scripts sin módulos de este proyecto.

| Archivo local | Origen en el paquete npm `three@0.147.0` | SHA-256 |
| --- | --- | --- |
| `vendor/three-0.147.0.min.js` | `build/three.min.js` | `f34446bf875b5fb0dcd93819ffe1d9e182d46634ee855f5d904c6c4ac7cdbc95` |
| `vendor/three-0.147.0-OrbitControls.js` | `examples/js/controls/OrbitControls.js` | `b4c6e53f98538535b11fd6655627d47fb5877b3ad972568bff0a7026c4b6d5c4` |
| `vendor/three-0.147.0-RoomEnvironment.js` | `examples/js/environments/RoomEnvironment.js` | `251b4e779abb5b432f99a326878fe239747c1fe55f390933085fc3deb20d2cea` |

- Licencia íntegra: `vendor/three-LICENSE.txt` (Copyright © 2010-2022 three.js authors).
- Paquete: https://registry.npmjs.org/three/-/three-0.147.0.tgz
- CDN equivalente: `https://cdn.jsdelivr.net/npm/three@0.147.0/` seguido de la ruta de origen.
- Los archivos se copiaron del paquete npm sin modificar ni recompilar; sólo se
  renombraron. `scripts/verify-release.py` comprueba sus sumas.

three.js sólo dibuja el modelo geométrico. No interviene en las ecuaciones, las
gráficas ni la exportación. Si no carga o no hay WebGL, la app funciona igual
con la ilustración plana.
