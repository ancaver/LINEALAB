# LINEALAB v1.0 — Simulador de Líneas de Transmisión

Herramienta didáctica para calcular y visualizar parámetros primarios y secundarios
de líneas bifilares, coaxiales y de placas paralelas. Permite comparar geometrías,
materiales y tendencias en frecuencia, con unidades, referencias numéricas y avisos
de validez física visibles. Conserva los motores de las etapas anteriores.

La validación es **matemática y funcional**, dentro de los modelos descritos. No es
una validación experimental de una línea fabricada ni una garantía de exactitud
para cualquier frecuencia o material.

## Inicio rápido y demostración

1. Extraer `proyecto.zip` conservando todas las carpetas, especialmente `vendor/`.
2. Abrir `index.html` en un navegador moderno. Las funciones de cálculo, tablas,
   gráficas, CSV y PNG usan archivos locales: **no requieren Internet ni backend**.
3. Seleccionar geometría, frecuencia, materiales y dimensiones. Pulsar **Calcular**
   para actualizar los resultados principales, **Resumen** y **Detalles**.
4. En la pestaña **Gráfica**, ajustar el intervalo y pulsar **Generar análisis**
   (o el botón lateral). El intervalo inicial es 1–1000 MHz, 100 puntos logarítmicos.
5. Elegir una de las once magnitudes, ampliar con el ratón, restablecer el zoom y
   descargar PNG. Consultar la pestaña **Tabla** y descargar **Exportar CSV**.

Para una demostración reproducible: coaxial, cobre (σc=5.8×10⁷ S/m), PTFE
(εr=2.1, tanδ=0.0002), a=0.5 mm, b=2 mm, 100 MHz y longitud 1 m.
Debe mostrar Z₀≈57.3586−j0.165158 Ω y γ≈0.00935266+j3.03718 m⁻¹.
El aviso del espesor desconocido de la pared coaxial debe permanecer visible.

Como alternativa para servir archivos localmente (Python 3):

```sh
python3 -m http.server 8000
```

Abrir `http://localhost:8000`. Este servidor sólo entrega archivos estáticos y no
forma parte de la lógica de la aplicación. La navegación `file://` puede estar
restringida en equipos administrados; usar un servidor estático en esos equipos.

## Interfaz y apariencia

La pantalla combina una organización lateral con pestañas de trabajo:

- **Configuración** (columna izquierda): tipo de línea, frecuencia, materiales,
  dimensiones, **Calcular**, **Generar análisis de frecuencia** y Restablecer.
- **Modelo geométrico**: visor 3D (three.js local) y sección transversal acotada
  en SVG, ambos construidos con los valores escritos (a, b, D, w, d) y a escala
  cuando las proporciones lo permiten; si no, lo indican («Proporción ajustada…»).
  El visor se muestra compacto junto al texto y la sección, para que los
  resultados queden a la vista; se puede girar arrastrando. **Ampliar visor** lo
  agranda y muestra sus controles: vistas Isométrica, Sección frontal (casi
  ortográfica) y Lateral, giro con arrastre, acercamiento con + y − (la rueda sigue desplazando
  la página), giro automático y cotas/etiquetas ancladas al modelo. La cubierta,
  los espesores de malla y placa y la extensión del dieléctrico son ilustrativos:
  no forman parte del modelo eléctrico. Debajo se resumen tipo, conductor,
  dieléctrico, frecuencia y longitud configurados.
- **Sin WebGL o sin three.js**: el visor no se muestra y queda una ilustración
  plana junto a la sección acotada. Los cálculos no dependen del visor.
- **Resultados principales**: R′, L′, Z₀ y α (dB/m). Los avisos del modelo y el
  diagnóstico pelicular (δ, Rs) quedan siempre visibles bajo estas tarjetas.
- Pestañas **Resumen** (los diez parámetros), **Detalles** (tabla del resultado
  individual), **Gráfica** (barrido, intervalo, CSV y PNG) y **Tabla** (barrido).
  Generar un análisis abre la pestaña Gráfica, salvo que se esté en Tabla.
- **Condiciones del modelo** y **Ecuaciones y referencias**: paneles desplegables.
  «Acerca de» abre el primero.

El visor y los esquemas sólo dibujan las entradas: no intervienen en ningún cálculo.

El interruptor **Modo oscuro**, en la barra superior, cambia toda la interfaz,
incluidas gráficas y tablas. La preferencia se recuerda localmente cuando el
navegador permite almacenamiento; no modifica los datos ni los resultados. Los
colores de ambos temas son variables CSS al inicio de `styles.css`.

## Tecnologías y arquitectura

HTML5, CSS3, JavaScript moderno, scripts clásicos sin frameworks, Plotly.js basic
**2.35.2 local** y three.js **r147 local** (última serie con compilación clásica). Los datos viven en memoria del navegador; no se envían a servicios.

| Archivo/carpeta | Responsabilidad |
| --- | --- |
| `index.html` | Estructura, formularios, tarjetas, tablas y rutas relativas |
| `styles.css` | Diseño adaptable y estilos del sitio |
| `calculations.js` | Constantes, materiales, validación y parámetros primarios |
| `secondary.js` | Aritmética compleja estable y parámetros secundarios |
| `sweep.js` | Muestreo, llamadas a ambos motores, avisos por punto y CSV |
| `charts.js` | Especificaciones de las once magnitudes para Plotly |
| `app.js` | Cálculo individual, formato e invalidación de tarjetas |
| `analysis.js` | Barridos, tablas, gráfica y descargas en navegador |
| `viewer3d.js` | Visor 3D del modelo geométrico; opcional y sin ecuaciones |
| `vendor/` | Plotly y three.js locales sin modificar, con sus licencias MIT |
| `tests/` | Pruebas numéricas, referencias y pruebas de controladores |
| `scripts/` | Referencias independientes, navegador, empaquetado y verificación |
| `validation/` | Informe, resultados numéricos, CSV/XLSX, PNG y capturas reales |

No se modificaron las ecuaciones de `calculations.js` ni de `secondary.js` para
v1.0: las pruebas no demostraron errores en esos motores. Se corrigieron dos
problemas de presentación encontrados con el navegador real: estilos SVG del
esquema que afectaban al texto de Plotly y expansión de la tabla en móvil.

## Entradas, salidas y unidades

- Geometrías en **mm**: bifilar (radio a y distancia D entre centros), coaxial
  (radio interior a y radio interno del conductor exterior b), placas (ancho w y
  separación d). Antes de calcular se convierten a m multiplicando por 10⁻³.
- Frecuencia positiva: Hz, kHz, MHz o GHz, factores 1, 10³, 10⁶ y 10⁹.
- Conductividad σc en S/m, permitividad relativa εr positiva y tanδ no negativa.
  Los selectores cargan valores iniciales editables; no modelan dispersión.
- Longitud positiva en m. **No multiplica R′, L′, C′ ni G′: son por metro.**
  Tampoco modifica Z₀, γ, α, β, vₚ ni λ de la línea uniforme. Se reserva para
  cálculos posteriores de una línea completa, que no se implementan aquí.

| Salida | Unidad |
| --- | --- |
| R′, L′, C′, G′ | Ω/m, H/m, F/m, S/m |
| Z₀, con ambas componentes; \|Z₀\| | Ω |
| γ=α+jβ | m⁻¹ |
| α; αdB | Np/m; dB/m |
| β | rad/m |
| vₚ (velocidad de fase) | m/s |
| λ | m |
| ∠Z₀ | grados en interfaz; radianes también en motor/CSV |
| δ, Rs (diagnóstico) | m; Ω/□ |

El motor conserva números IEEE 754 de doble precisión. Las tarjetas y tablas se
redondean a seis cifras significativas; el CSV usa `String(Number)` para recuperar
el mismo double al leerlo. Se permite G′=0. Las entradas inválidas no generan
resultados y no se sustituyen por ceros.

## Constantes y materiales

Valores centrales CODATA 2022 redondeados:

- ε₀=8.8541878188×10⁻¹² F/m, μ₀=1.25663706127×10⁻⁶ H/m.
- ε=ε₀εr; μ=μc=μ₀ (materiales no magnéticos); ω=2πf.
- En el SI actual ε₀ y μ₀ no son constantes exactas. Referencias:
  [NIST ε₀](https://physics.nist.gov/cgi-bin/cuu/Value?ep0),
  [NIST μ₀](https://physics.nist.gov/cgi-bin/cuu/Value?mu0).

| Conductor | σc inicial [S/m], aproximadamente a 20 °C |
| --- | ---: |
| Cobre | 5.8×10⁷ |
| Aluminio | 3.5×10⁷ |
| Plata | 6.3×10⁷ |
| Oro | 4.1×10⁷ |

| Dieléctrico | εr inicial | tanδ inicial |
| --- | ---: | ---: |
| Aire | 1.0006 | 0 |
| Vacío | 1 | 0 |
| PTFE | 2.1 | 0.0002 |
| Polietileno | 2.25 | 0.0003 |

Son valores de arranque orientativos, no una ficha de un producto específico ni
una caracterización de toda la banda. Ajustar según frecuencia, temperatura,
humedad, pureza y material real. El aire se idealiza sin pérdidas dieléctricas;
el vacío usa εr=1 y tanδ=0. Ambos conductores comparten σc y μc. No hay materiales
magnéticos ni permitividad negativa en este modelo.

## Ecuaciones implementadas

Rs=√(πfμc/σc), δ=√(2/(ωμcσc)) y **G′=ωC′tanδ** en las tres geometrías.

| Geometría | C′ [F/m] | L′ [H/m] | R′ [Ω/m], aproximada de alta frecuencia |
| --- | --- | --- | --- |
| Coaxial | 2πε/ln(b/a) | μ ln(b/a)/(2π) | Rs(1/a+1/b)/(2π) |
| Bifilar | πε/A | μA/π | Rs/(πa) |
| Placas paralelas | εw/d | μd/w | 2Rs/w |

Bifilar: A=arcosh(D/(2a)), D>2a>0. Coaxial: b>a>0. Placas: w,d>0.
L′ es inductancia externa; se omite la inductancia interna del conductor.

Con la convención temporal e^(jωt) y propagación e^(−γz):

```text
Z′ = R′ + jωL′             [Ω/m]
Y′ = G′ + jωC′             [S/m]
Z₀ = √(Z′/Y′)              [Ω]
γ = √(Z′Y′) = α + jβ       [m⁻¹]
vₚ = ω/β                  [m/s]
λ = 2π/β                  [m]
αdB = 8.686α              [dB/m]
```

Se conserva Im(Z₀), que puede ser positiva, negativa o cero. La raíz principal
con R′,G′≥0 y L′,C′,ω>0 da Re(Z₀)>0, α≥0 y β>0. Las operaciones complejas
escalan cada componente con mantisa/exponente binario y calculan la componente
pequeña de la raíz mediante 2uv=Im(z), evitando cancelación. Se detectan resultados
no representables y se informa el error. Se usa arg(0)=0 como convención de API.

8.686 es el factor solicitado, redondeado respecto a 20 log10(e)≈8.685889638.
Las aproximaciones analíticas de bajas pérdidas se usan para pruebas, no para
sustituir las ecuaciones completas del simulador.

## Límites de validez física

Las ecuaciones suponen medio homogéneo, materiales no dispersivos y propagación
TEM. Se omiten rugosidad, radiación, conectores, dobleces, inhomogeneidad y modos
superiores. vₚ es velocidad de **fase**, no de grupo ni de transmisión de información.

R′ supone efecto pelicular desarrollado. La aproximación bifilar omite proximidad;
las placas se suponen anchas y sin efectos de borde. No se modela la transición
hacia resistencia DC. Los siguientes avisos son criterios **heurísticos**, sin
una tolerancia de error físico garantizada:

- δ/a≥0.1 en conductores circulares: penetración no pequeña respecto al radio.
- δ/w≥0.1 en placas: penetración no pequeña respecto al ancho.
- D/(2a)<5 en bifilar: proximidad que la expresión de R′ no considera.
- w/d<10: efectos de borde potencialmente relevantes.

No se conoce el espesor de placas ni de la pared coaxial exterior: siempre se
advierte que no se puede verificar espesor≫δ. Los secundarios heredan todas las
limitaciones primarias. «Calculado» sólo confirma éxito numérico. Los avisos se
mantienen en las tarjetas, el resumen del barrido, sus filas y el CSV.

## Barridos, gráficas y exportación

Se admiten 10–500 puntos, muestreo lineal o logarítmico y 0<f inicial<f final.
Se incluyen ambos extremos exactamente. Cada muestra llama a los dos motores,
conserva una copia de configuración y registra sus avisos/error sin mutar entradas.
Los puntos rechazados aparecen como huecos en la gráfica y «—» en la tabla; sus
campos eléctricos quedan vacíos en CSV. Los ceros físicos se mantienen como cero.

Hay once magnitudes: R′, L′, C′, G′, |Z₀|, Re(Z₀), Im(Z₀), α en dB/m, β, vₚ y λ.
Sólo una magnitud y su unidad ocupan el eje vertical. Cambiar el eje horizontal
entre lineal/logarítmico no cambia las muestras; cambiar el muestreo exige generar
el análisis de nuevo. Marcadores ámbar indican avisos.

El cálculo individual y su tabla se conservan al generar un barrido. Editar el
panel principal invalida ambos resultados; editar el intervalo sólo invalida el
barrido. Restablecer recupera la configuración y el intervalo iniciales.

CSV: UTF-8 con BOM, comas, CRLF, comillas escapadas, frecuencia siempre en Hz y
27 columnas con unidades, resultados, diagnósticos, avisos/errores y configuración.
Se descarga como Blob sin servidor. En Excel, usar **Datos → Desde texto/CSV**,
UTF-8, delimitador coma y punto decimal si la configuración regional lo requiere.
No se afirma que Excel se haya probado: véase el informe.

PNG: descarga real desde Plotly, 2200×1200 px (1100×600 con escala 2), probada
en Chromium. La barra gráfica permite paneo, zoom, hover y restablecimiento.

## Escalas de las gráficas y precisión del cursor

Los prefijos sólo se aplican a los valores dibujados. El eje y la leyenda indican
la unidad visual: por ejemplo, 2.69415×10⁻⁷ H/m se presenta como **0.269415 µH/m**.
Las capacitancias pueden mostrarse en pF/m o nF/m, y se eligen otros prefijos de
ingeniería según el orden de magnitud. Fuera de los prefijos habituales se usa
una potencia de diez explícita junto a la unidad. Los datos internos, las
frecuencias del barrido, las tarjetas, las tablas y el CSV permanecen en SI.

El eje vertical usa los extremos reales de la serie con un margen del 8 % del
recorrido (y un mínimo de 16 épsilon de máquina respecto a su amplitud para
conservar límites distintos). Para una constante no nula se centra un intervalo
de ±5 % y se anota su valor. No se clasifica un valor como
cero mediante tolerancias ni se llama constante a una serie que difiere aunque
sea muy poco. Los puntos rechazados siguen siendo huecos.

Si todos los valores válidos son exactamente cero, la línea se centra y se muestra
**sólo la marca 0**, con la anotación «Valor exactamente cero». El espacio vertical
restante sirve para dibujar esa línea, sin marcas numéricas que sugieran amplitud.

El cursor incluye el valor en la unidad visual y la cadena completa del valor SI
almacenado (precisión round-trip de JavaScript), sin limitarlo a las seis cifras
de las tarjetas. Restablecer zoom y el botón Autoscale de Plotly recuperan la
escala basada en los datos; los PNG incluyen la anotación de constancia/cero.

Pruebas: `tests/chart-display.test.cjs` y `scripts/chart-display-browser.cjs`.
El segundo usa Chromium real en el mismo documento de prueba local explicado
más abajo. Evidencias: `validation/chart-display/report.json` y sus PNG.

## Validación matemática y tolerancias

[Informe completo](validation/REPORT.md), [resultados](validation/mathematical-results.json)
y [referencias de 70 dígitos](tests/fixtures/final-references.json).

`scripts/reference-values.py` evalúa las ecuaciones con Python Decimal a 70
cifras, **sin importar los motores JS**, para las tres geometrías a 1 MHz,
100 MHz y 1 GHz. Materiales: σc=5.8×10⁷ S/m, εr=2.1, tanδ=0.0002.
Geometrías: coaxial (a=0.5,b=2 mm), bifilar (a=0.5,D=5 mm), placas (w=20,d=1 mm).

- Referencias completas no nulas: error relativo ≤2×10⁻¹², sin tolerancia absoluta
  adicional; ceros ideales exactos. Máximo observado: 3.33×10⁻¹⁶.
- Caso coaxial redondeado solicitado: L′≈2.77259×10⁻⁷ H/m y C′≈8.42738×10⁻¹¹ F/m,
  tolerancia relativa 10⁻⁶ por el redondeo de la referencia corta.
- Sin pérdidas: Z₀=√(L′/C′), α=0, β=ω√(L′C′), vₚ=1/√(L′C′), λ=vₚ/f.
  Comparación vₚ=c/√εr con c=299792458 m/s: tolerancia relativa 2×10⁻¹⁰ para
  permitir el redondeo de ε₀/μ₀. Identidades internas: 2×10⁻¹².
- Bajas pérdidas: α≈R′/(2Zi)+G′Zi/2, β≈ω√(L′C′),
  Z₀≈Zi[1+j/2(G′/(ωC′)−R′/(ωL′))], Zi=√(L′/C′).
  Para R′=0.01 Ω/m, L′=2.5×10⁻⁷ H/m, C′=10⁻¹⁰ F/m, G′=10⁻⁶ S/m y
  f=100 MHz, tolerancia relativa 10⁻⁸ frente a esas aproximaciones independientes.
- Tendencias comprobadas: R′∝√f, L′ y C′ constantes, G′∝f; β y α crecen y λ
  disminuye en los casos ensayados. No se generaliza una tendencia a materiales dispersivos.

## Pruebas ejecutables y resultados

Pruebas automáticas principales (Node.js 18+, sin `npm install`):

```sh
node --test tests/*.test.cjs
```

**112 pruebas aprobadas**, incluidas las 101 anteriores y once verificaciones de escalas, prefijos y valores constantes/nulos:
referencias, tendencias y barridos 10/100/500 con once magnitudes en las tres
geometrías. El entorno ejecutado usó Node.js 24.22.1.

Prueba de navegador opcional para desarrollo, con Playwright 1.62.1 y Chromium:

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
node scripts/browser-check.cjs
node scripts/chart-display-browser.cjs
node scripts/viewer3d-browser.cjs
```

`viewer3d-browser.cjs` comprueba el visor 3D con WebGL por software (tres
geometrías, vistas, etiquetas, dimensiones no válidas, tema) y el respaldo sin
WebGL. Evidencias en `validation/viewer3d/`. No sustituye una prueba con GPU física.

Si se usa Chromium del sistema, establecer `LINEALAB_CHROMIUM` con su ruta. La
aplicación normal no necesita Playwright ni paquetes npm. El script carga HTML,
CSS y scripts íntegros en un documento de prueba del navegador; **no prueba la
navegación HTTP/file://**. Guarda evidencias en `validation/browser/`.

Verificado con Chromium real 156.0.8078.79, sin conexión:

- Escritorio 1440×1000 y móvil **emulado** 390×844.
- 198 combinaciones: tres geometrías × 10/100/500 puntos × once magnitudes × dos tamaños.
- Zoom por arrastre real, hover, restablecimiento y validaciones del formulario.
- Descargas efectivas PNG y CSV en ambos tamaños; PNG comprobados por firma y dimensiones.
- Sin errores JavaScript y sin peticiones HTTP durante las pruebas.
- Tabla móvil: documento de 390 px y tabla de 1488 px dentro de un panel desplazable de 352 px.
- CSV abierto en LibreOffice Calc y convertido a XLSX: 100 filas de datos, 27
  columnas y 2200 celdas numéricas contrastadas; error relativo máximo 4.89×10⁻¹⁵.

**Pendiente / no afirmado:** apertura real en Microsoft Excel (no hubo sesión
conectada), móvil físico, Safari/Firefox y navegación del sitio publicado. En este
entorno file:// está bloqueado por una política del navegador y el servicio de
vista previa carece de relay. No se cambiaron políticas para sortear esas restricciones.
La prueba de renderizado real anterior usa un documento de prueba, no una vista
previa ni un doble de Plotly. Los tests unitarios de controladores sí usan DOM y
Plotly simulados, separados de esa prueba real.

## Publicación en GitHub Pages

1. Crear o elegir un repositorio. Extraer el ZIP y colocar **su contenido**, no
   sólo el ZIP, en la raíz del repositorio. Conservar `.nojekyll`, `vendor/`,
   `tests/`, `scripts/` y los documentos/licencias.
2. Confirmar y subir esos archivos a la rama elegida (por ejemplo `main`).
3. En **Settings → Pages → Build and deployment**, elegir **Deploy from a branch**,
   la rama y **/(root)**. No se requiere compilación ni instalar dependencias.
4. Abrir la URL entregada por GitHub, normalmente
   `https://USUARIO.github.io/REPOSITORIO/`.
5. Para que funcione también el enlace de descarga, subir el `proyecto.zip`
   generado junto a `index.html`.

Las rutas de la aplicación son relativas, incluidas las de Plotly. Se verifican
por archivo y son compatibles con la subruta de un repositorio. No se creó un
repositorio GitHub ni se afirmó un despliegue allí; se entregan archivos e instrucciones.

## Visualizar en CodePen

1. Crear un Pen con preprocesadores None, sin frameworks.
2. Pegar en HTML el contenido de `<body>`, retirando todas las etiquetas `<script>`.
3. Pegar `styles.css` en CSS.
4. En Settings → JavaScript → External Scripts, agregar la versión fijada:
   `https://cdn.plot.ly/plotly-basic-2.35.2.min.js`.
5. Concatenar en JavaScript, en orden: `calculations.js`, `secondary.js`,
   `sweep.js`, `charts.js`, `app.js`, `analysis.js`. Para el visor 3D (opcional),
   agregar antes como External Scripts los tres archivos `three@0.147.0` indicados
   en `THIRD_PARTY.md` y añadir `viewer3d.js` al final.
6. Ejecutar y usar Full Page. Generar el análisis para ver la gráfica.

CodePen necesita conexión y no aloja los archivos relativos del ZIP: sustituir
los enlaces al proyecto y la documentación por URLs propias o retirarlos del Pen.
La distribución local de este ZIP, en cambio, no requiere CDN.

## Licencia, empaquetado y trazabilidad

Plotly y three.js locales, con sus licencias MIT íntegras: [THIRD_PARTY.md](THIRD_PARTY.md).
La versión de CDN se contrastó byte a byte con el paquete npm oficial. La suma
SHA-256 se comprueba en `scripts/verify-release.py`.

```sh
python3 scripts/reference-values.py  # opcional: regenerar referencias independientes
node --test tests/*.test.cjs
python3 scripts/package.py
python3 scripts/verify-release.py
```

Python 3.9+ y biblioteca estándar para esas tareas. El ZIP único contiene código,
Plotly, licencia, pruebas, scripts y evidencias. No incluye otra copia de sí mismo
ni Git, perfiles del navegador, credenciales o dependencias de desarrollo. Se
puede regenerar de forma reproducible después de una modificación.
