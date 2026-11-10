# LINEALAB v1.0 — Informe de validación final

Este informe distingue cálculos contrastados, pruebas reales de navegador y
verificaciones que el entorno no permitió realizar. No sustituye una validación
experimental ni elimina las advertencias físicas de los modelos.

## Resultado verificado

| Verificación | Resultado / evidencia |
| --- | --- |
| Suite automática | 112 pruebas aprobadas; `unit-tests.tap` |
| Referencias independientes | 9 casos (tres geometrías × 1 MHz/100 MHz/1 GHz), Python Decimal a 70 dígitos |
| Error máximo frente a referencias | 3.3306690738754696×10⁻¹⁶ relativo; tolerancia 2×10⁻¹² |
| Motores primario y secundario | Sin cambios respecto a v0.4; `engine-integrity.json` |
| Unidades y conversiones | mm→m, Hz/kHz/MHz/GHz, Ω/m/H/m/F/m/S/m, complejos, Np/m→dB/m |
| Casos ideales y bajas pérdidas | Pruebas de Z₀, γ, α≥0, β>0, velocidad de fase y λ |
| Tendencias | R′∝√f, L′/C′ constantes y G′∝f, para materiales constantes |
| Barridos | 10, 100 y 500 puntos en las tres geometrías; extremos incluidos, sin mutaciones |
| Navegador real | Chromium 156.0.8078.79, Playwright 1.62.1; no es un doble de Plotly |
| Escritorio | 1440×1000, renderizado y capturas revisados |
| Móvil | Emulación 390×844; no se afirma prueba en dispositivo físico |
| Gráficas | 198 combinaciones: 3 geometrías × 3 tamaños de barrido × 11 magnitudes × 2 tamaños de pantalla |
| Interacción gráfica | Arrastre real de zoom, cambio de escala, hover y botón de restablecimiento |
| PNG | Dos descargas reales, una por tamaño de pantalla; firma PNG válida, 2200×1200 px |
| CSV | Dos descargas reales UTF-8 con BOM; 100 filas y 27 columnas |
| Compatibilidad de hoja de cálculo | CSV abierto y convertido por LibreOffice Calc a XLSX; 2200 celdas numéricas contrastadas |
| Error de conversión CSV→XLSX | Máximo relativo 4.884981308350689×10⁻¹⁵; tolerancia 2×10⁻¹² |
| Validaciones / Restablecer | Probados en navegador y tests de controladores |
| Uso sin Internet | Recursos locales y contexto offline; cero peticiones HTTP y cero errores JavaScript |
| Plotly local | v2.35.2; archivo idéntico al paquete npm oficial y licencia MIT íntegra |
| Rutas / ZIP | Comprobación local automatizada de enlaces, recursos, ARIA, versión y contenido; `scripts/verify-release.py` |

## Alcance exacto de la prueba de navegador

Se cargaron el HTML, CSS y scripts locales íntegros de la aplicación en un
documento de prueba de Chromium mediante `setContent`/`addScriptTag`, con red
inactiva. Plotly fue la biblioteca real de 1 071 091 bytes incluida en `vendor/`.
Se ejecutaron los formularios, eventos, gráficos y descargas reales, no llamadas
simuladas a Plotly. Las pruebas unitarias con DOM/Plotly simulados son otras
pruebas y se identifican como tales en `tests/`.

La navegación directa `file://` devolvió `ERR_BLOCKED_BY_ADMINISTRATOR`; el
servicio oficial `sites-preview` devolvió `preview relay unavailable`. No se
modificaron políticas, permisos de red ni la infraestructura para sortearlos.
Por tanto **no se presenta esta prueba como navegación al sitio publicado ni
como verificación de todas las rutas mediante HTTP**. Las rutas se comprobaron
por archivos y el contenido de `proyecto.zip` se cotejó byte a byte.

El cambio de origen del documento en pruebas no valida permisos de descarga o
políticas de otros equipos/navegadores. Debe hacerse una comprobación final en
el equipo concreto de la demostración.

## Pendiente / no realizado

- **Microsoft Excel real**: no había sesión Excel conectada ni aplicación Microsoft
  Excel disponible. LibreOffice y openpyxl no se presentan como sustitutos de esa
  prueba. Archivo de evidencia: `csv-opened-with-libreoffice.xlsx`.
- **Móvil físico**, Safari y Firefox. La prueba móvil realizada es una emulación
  de viewport/táctil en Chromium.
- **Navegación real al sitio publicado y por file://** en este entorno, debido a
  las restricciones descritas. El estado de publicación devuelto por Sites es
  independiente de esta prueba de navegador.
- **Despliegue real a GitHub Pages**: se prepararon rutas, `.nojekyll`, ZIP e
  instrucciones. No se recibió un repositorio de destino para publicar allí.
- Accesibilidad auditada con lector de pantalla y validación experimental de
  hardware: no se realizaron ni se afirman.

## Referencias y tolerancias

`tests/fixtures/final-references.json` contiene 70 dígitos para cada valor de
referencia, generado con `scripts/reference-values.py`, sin importar los motores
JavaScript. `mathematical-results.json` incluye valor real, referencia y error
relativo para cada magnitud en los nueve casos.

Se usaron las constantes ε₀=8.8541878188×10⁻¹² F/m y μ₀=1.25663706127×10⁻⁶ H/m,
σc=5.8×10⁷ S/m, εr=2.1 y tanδ=0.0002. Geometrías: coaxial (a=0.5,b=2 mm),
bifilar (a=0.5,D=5 mm), placas (w=20,d=1 mm).

- Referencias completas no nulas: 2×10⁻¹² de tolerancia relativa, sin margen
  absoluto adicional. Ceros ideales comprobados como cero exacto.
- Referencia coaxial corta L′=2.77259×10⁻⁷ H/m, C′=8.42738×10⁻¹¹ F/m:
  10⁻⁶ relativo por el redondeo de los valores publicados en el enunciado.
- Bajas pérdidas: 10⁻⁸ relativo frente a las aproximaciones analíticas indicadas
  en README, para el caso R′=0.01,L′=2.5×10⁻⁷,C′=10⁻¹⁰,G′=10⁻⁶ a 100 MHz.
- vₚ=c/√εr en línea ideal: 2×10⁻¹⁰ relativo, considerando redondeo de ε₀/μ₀.
- Las tolerancias anteriores son **numéricas**, no límites del error físico de
  las aproximaciones de efecto pelicular, proximidad o efectos de borde.

## Correcciones realizadas sin cambiar ecuaciones

1. Delimitar los estilos SVG al esquema `#line-diagram`; antes alteraban textos y
   leyendas de Plotly. Se verificó `text-anchor:start` en leyendas reales.
2. Usar `minmax(0,1fr)` en la cuadrícula móvil y mínimo de anchura cero para los
   paneles. La tabla ya no ensancha el documento: 390 px de página y 1488 px de
   tabla dentro de un contenedor desplazable de 352 px.
3. Incluir Plotly y su licencia localmente, actualizar v1.0 y aclarar la etiqueta
   de longitud. Se conservan ecuaciones, validaciones y advertencias del modelo.

## Evidencias incluidas

- `unit-tests.tap`: salida íntegra del ejecutor Node.
- `mathematical-results.json`: errores y resultados de las nueve referencias.
- `engine-integrity.json`: sumas de los dos motores antes/después.
- `browser/report.json`: entorno, matriz de casos, zoom, hover, PNG/CSV y pendientes.
- `browser/desktop-screen.png`, `browser/mobile-screen.png`, `browser/mobile-table.png`.
- `browser/desktop-plot.png`, `browser/mobile-plot.png`: PNG descargados realmente.
- `browser/desktop-coaxial.csv`, `browser/mobile-coaxial.csv`: CSV descargados realmente.
- `csv-compatibility.json`, `csv-opened-with-libreoffice.xlsx`.

Para reproducir: consultar README. El último paso de distribución es ejecutar
`python3 scripts/package.py` y `python3 scripts/verify-release.py`.

## Ajuste posterior de presentación

Se retiró la etiqueta de etapa del encabezado y se añadió el botón Modo oscuro /
Modo claro, con preferencia local cuando el navegador lo permite. El cambio
incluye tablas, formularios y Plotly. Se comprobó en Chromium real, mediante el
mismo documento de prueba, a 1440, 686 y 390 px: alternancia de colores, estado
accesible del botón, datos conservados, ausencia de desbordamiento y de errores.
Las 101 pruebas existentes siguen pasando. Las capturas anteriores documentan
la validación académica previa a este ajuste visual.


## Corrección de escalas para magnitudes constantes o pequeñas

Se añadieron once pruebas automáticas y la suite completa pasa **112/112**.
El cambio sólo afecta a charts.js y al restablecimiento del eje en analysis.js;
no se modificaron calculations.js, secondary.js ni sweep.js. Se verifican prefijos,
márgenes relativos, cero exacto, signos negativos, datos casi constantes, huecos,
precisión SI del cursor y ausencia de mutaciones o cambios en CSV.

La prueba real `scripts/chart-display-browser.cjs` pasó en Chromium a 1440 y
390 px, sin red: L′, C′ y G′ constantes/nulas de las tres geometrías, cursor con
cadena SI íntegra, Restablecer zoom, Autoscale, modo oscuro y descarga PNG.
También se dibujó el caso sintético solicitado de 2.69415×10⁻⁷ H/m como
0.269415 µH/m, con escala y anotación correctas. Ese caso es un dato de prueba
separado y no modifica ningún resultado del simulador.

Las evidencias nuevas están en `chart-display/`. Conservan el mismo alcance del
navegador in-memory y las mismas limitaciones de navegación descritas antes.

## Rediseño de la interfaz (organización lateral + pestañas)

Se reescribieron `index.html`, `styles.css` y la capa de vistas de `app.js`; en
`analysis.js` sólo cambió la activación de pestañas y en `charts.js` los colores
de los temas. `calculations.js`, `secondary.js` y `sweep.js` no se modificaron.

- 112 pruebas unitarias aprobadas (una prueba de pestañas se adaptó al nuevo orden:
  Resumen, Detalles, Gráfica, Tabla).
- `scripts/browser-check.cjs` y `scripts/chart-display-browser.cjs` se volvieron a
  ejecutar con Chrome 153 real tras el rediseño; sus informes y capturas de esta
  carpeta corresponden a la interfaz nueva. Los scripts se ajustaron para abrir la
  pestaña Gráfica antes de editar el intervalo y al nuevo color de fondo oscuro.
- Las cifras de versión de navegador citadas en secciones anteriores de este
  informe y del README corresponden a la validación original (Chromium 156).

## Visor 3D del modelo geométrico (three.js r147 local)

Se añadió `viewer3d.js` y tres archivos de three.js en `vendor/`. Los motores
`calculations.js`, `secondary.js` y `sweep.js` siguen sin modificarse.

- 112 pruebas unitarias aprobadas con el visor integrado (el DOM mínimo de esas
  pruebas no carga three.js: verifican que la app funciona sin el visor).
- `scripts/viewer3d-browser.cjs`, Chrome 153 real con WebGL por software
  (SwiftShader), escritorio 1440×1000 y móvil emulado 390×844: arranque del
  visor, un modelo distinto por geometría, cotas con los valores escritos, tres
  vistas, acercamiento, ocultar etiquetas, aviso con dimensiones no válidas,
  cambio de tema, sin errores JavaScript, sin peticiones HTTP y sin
  desbordamiento horizontal. Con WebGL deshabilitado: el visor no arranca, se
  muestra la ilustración plana y el cálculo funciona. Informe y capturas en
  `validation/viewer3d/`.
- `browser-check.cjs` y `chart-display-browser.cjs` se repitieron cargando
  también el visor.
- **Pendiente / no afirmado:** GPU física, móvil físico, Safari/Firefox y
  rendimiento en equipos modestos. El visor dibuja sólo cuando algo cambia.

### Ajuste: visor compacto por defecto

El modelo geométrico vuelve a ocupar una sola franja (texto, visor 3D de 200 px de
alto y sección acotada), de modo que los resultados principales quedan en la
primera pantalla de escritorio. «Ampliar visor» abre el modo grande con vistas,
acercamiento y etiquetas. `viewer3d-browser.cjs` comprueba ambos modos; se
repitieron las tres pruebas de navegador y las 112 unitarias.
