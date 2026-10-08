# CLAUDE.md

Guía de trabajo para Claude Code en este repositorio.

> Este archivo no lleva números de línea a propósito. Los que había quedaron obsoletos con el
> primer cambio y no había forma de notarlo. Se referencia por nombre de archivo y de función.

## Qué es

App web de diagnóstico de madurez financiera según la metodología F3M. Puntúa las subcapacidades de
9 dominios financieros en tres palancas (Procesos, Tecnología, Organización) y genera dashboard,
heatmap y roadmap priorizado.

La usan consultores **delante del cliente**, en talleres y sesiones de scoring. Ese contexto manda:
un fallo silencioso en una sesión con cliente cuesta más que cualquier deuda técnica.

## Cómo ejecutarlo

```powershell
python -m http.server 8000
```

Y abrir `http://localhost:8000/`.

**Hace falta un servidor.** `app.js` se carga como módulo ES y hace `fetch()` del catálogo de
dominios y de los JSON de datos, así que abrir `index.html` con `file://` falla por CORS. La propia
app lo dice en su mensaje de error de arranque.

**No hay `npm install`, ni build, ni watch, ni `package.json`.** Se edita el archivo y se recarga el
navegador. Cualquier servidor estático equivalente sirve.

## Arquitectura

| Archivo | Rol | Líneas |
|---|---|---|
| `index.html` | Maquetación, `<template>` de la tarjeta de assessment, modales | 1.306 |
| `tema.js` | Resuelve tema y densidad **antes del primer pintado**. Síncrono en `<head>` | 59 |
| `app.js` | Raíz de composición: `init()`, el cableado y el escenario | 1.871 |
| `app/estado.js` | El estado compartido y las constantes que lo describen | 183 |
| `app/avisos.js` | El banner de avisos y el diálogo de confirmación | 341 |
| `app/almacenamiento.js` | `localStorage`, que puede fallar y no es motivo para caerse | 78 |
| `app/preferencias.js` | Tema y densidad, y la paleta de los gráficos por tema | 253 |
| `app/graficos.js` | Los seis radares de Chart.js, y a dónde lleva pulsar sus ejes | 718 |
| `app/metricas.js` | El motor atado al estado: objetivos por dominio y caché | 185 |
| `app/dominios.js` | El catálogo, la carga de los nueve dominios y el conmutador | 479 |
| `app/filtros.js` | Los tres filtros y el ámbito de datos que sale de ellos | 313 |
| `app/subcapacidad.js` | Leer los campos de una subcapacidad, que llegan en dos formas | 88 |
| `app/escenario.js` | Un escenario como dato: leerlo, volcarlo y volver a armarlo | 403 |
| `app/firebase.js` | La conexión: configuración, referencia y límite de espera | 220 |
| `app/identidad.js` | La sesión anónima y el nombre de quien edita | 249 |
| `app/copias.js` | **Si el trabajo local tiene copia.** Cuándo fue la última y el punto del aviso | 143 |
| `app/indicador.js` | **El chip de guardado.** La única señal de si el trabajo está a salvo | 155 |
| `app/persistencia.js` | **Guardar y recibir.** Escrituras granulares y suscripción remota | 873 |
| `app/repintado.js` | El cortacircuitos, para no cerrar un ciclo con el orquestador | 40 |
| `app/edicion.js` | Los campos de texto de una subcapacidad: guardado diferido y freno de cierre | 137 |
| `app/celdas.js` | Los fragmentos de HTML que comparten varias vistas, fichas de IA incluidas | 317 |
| `app/modales.js` | Los criterios F3M y la ficha de caso de IA, con su foco | 251 |
| `app/informe.js` | Lo que la aplicación le pasa al informe y a la preparación del taller | 674 |
| `app/buscador.js` | El buscador de Ctrl+K: un `<dialog>` que lleva a cualquier subcapacidad | 196 |
| `app/taller.js` | **El modo taller**: una subcapacidad a pantalla completa, para proyectar | 417 |
| `app/biblioteca.js` | **La biblioteca de IA**: la carga y el visor que abre «Más información» | 417 |
| `app/vistas/overview.js` | Los nueve dominios a la vez. **La vista que no aplica filtros** | 392 |
| `app/vistas/dashboard.js` | El dominio abierto: KPIs, titulares y tabla resumen | 224 |
| `app/vistas/assessment.js` | Puntuar, con la captura y restauración de foco | 1.249 |
| `app/vistas/heatmap.js` | Una fila por capacidad, desplegable a subcapacidad | 172 |
| `app/vistas/roadmap.js` | Las iniciativas y sus campos editables, con guardado diferido | 435 |
| `app/vistas/ia.js` | La pestaña IA: biblioteca y catálogo de casos. **Tampoco aplica filtros** | 674 |
| `styles.css` | Estilos, tokens de color y escalas de tipografía y densidad | 6.285 |
| `core/calculo.js` | **Motor de cálculo F3M.** Reglas de negocio puras | 528 |
| `core/objetivos.js` | **Objetivos por capacidad y palanca.** La mitad de todo gap | 137 |
| `core/coincidencias.js` | **Reconocer el trabajo guardado.** Si falla, se pierde en silencio | 259 |
| `core/escenario.js` | **Contrato de un escenario.** Espejo de `database.rules.json` | 536 |
| `core/exportacion.js` | El CSV para Excel en español, con su protección de fórmulas | 192 |
| `core/presentacion.js` | Escapado, formato de números y fechas, y colores de marca | 203 |
| `core/busqueda.js` | Qué subcapacidades casan con lo que se escribe, y qué resaltar | 152 |
| `core/biblioteca.js` | **Dónde está cada caso.** Referencias comprobadas, etiquetas y filtros | 510 |
| `informe/pdf.js` | **El informe.** Orquestador: qué diapositivas y en qué orden | 480 |
| `informe/secciones.js` | Una función por diapositiva | 1.052 |
| `informe/graficos.js` | Primitivas SVG puras: bullet, anillo, escala de madurez | 307 |
| `informe/estilos.js` | La paleta del informe y su hoja de estilos | 1.016 |
| `informe/desbordes.js` | Mide si una diapositiva recorta. Con `?comprobar=desbordes` | 112 |
| `informe/preparacion.js` | **La preparación del taller**: el documento que el cliente recibe antes | 544 |
| `tests/` | Pruebas de `core/`, de `informe/` y del espejo con las reglas | — |
| `.github/workflows/` | CI: las pruebas y `check_domains_sync.py` en cada PR | — |
| `data/domains.json` | **Fuente única de la lista de dominios** | — |
| `data/domains/*.json` | Datos del assessment, un archivo por dominio | — |
| `data/casos-ia.json` | **Fuente única de los 100 casos de uso de IA**, sus dos etiquetas y su fuente | — |
| `data/biblioteca.json` | **Fuente única de la biblioteca de IA**: los documentos y sus páginas | — |
| `biblioteca/` | Los documentos de la biblioteca. **Públicos**, como el repositorio. Ver su `LEEME.md` | — |
| `database.rules.json` | Reglas de seguridad de la Realtime Database | — |
| `scripts/*.py` | Conversión Excel→JSON, verificación, migración, rotación | — |
| `scripts/check_module_version.py` | Que todos los módulos se pidan con la misma `?v=` y que `index.html` los precargue todos. **En CI** | — |
| `scripts/check_modules.py` | Que cada import encuentre su export y no quede un nombre sin declarar en `app/`. **En CI** | — |
| `vendor/` | Chart.js, servido desde aquí y no desde un CDN. **Se versiona** | — |
| `SECURITY.md` | Modelo de amenazas, qué protege y qué no, y los procedimientos | — |

La regla de reparto: **en `core/` no hay DOM, ni Firebase, ni estado global, ni nada de fuera de
`core/`.** Todo son funciones puras, y por eso se pueden probar sin levantar la aplicación. `app.js`
es quien conoce el estado y le pasa a `core/` lo que necesita.

Los módulos de `core/` **sí se importan entre sí**. La regla decía "ni imports" a secas, y con ella
la validación de un score estaba escrita tres veces y `core/escenario.js` tenía que pedirle a
`app.js` que le inyectara cómo serializar los objetivos — la dependencia del revés, porque esa
función también era pura y solo vivía en el sitio equivocado. Importar dentro de `core/` no rompe lo
que la regla protegía: se siguen probando sin navegador.

Flujo de arranque, en `init()` de `app.js`:

```
cacheElements() → bindGlobalEvents() → setInitialLoading(true) → showScenarioModeNotice()
  → cargarCatalogoDeCasosDeIa()  // data/casos-ia.json; si falla, se sigue sin fichas
    + cargarBiblioteca()         // data/biblioteca.json; si falla, sin «Más información»
    + cargarCatalogoDeDominios() // los tres a la vez; este pinta el conmutador
  → loadCoreDomains()            // Promise.allSettled de los 9; se piden sin esperar a las fichas
  → setActiveDomain("fpa")
  → applyStoredScenario()        // copia local de localStorage
  → inicializarIdentidad()       // signInAnonymously, solo si hay ?scenario= (el SDK se pidió al empezar)
  → initializeSharedScenario()   // lee Firebase, aplica lo remoto, se suscribe
  → populateCapacityFilter() → renderAll()
```

Dependencias de terceros, sin bundler:

- **Chart.js 4.5.0** desde `vendor/chart.umd.min.js` (al final de `index.html`) — radares por
  capacidad. **No va por CDN a propósito**: una red de cliente que filtre cdnjs dejaba los radares
  sin pintar y el PDF entregable con tres huecos. `vendor/LEEME.md` explica el porqué y cómo se
  actualiza.
- **Firebase Realtime Database y Auth 12.15.0** desde `gstatic.com`. Este sí sigue siendo externo:
  son ~500 KB en tres módulos con imports relativos entre ellos, y `gstatic` tiene que funcionar de
  todas formas para que funcione la base de datos. **Pero se descarga con `import()` y solo con
  `?scenario=`**, desde `conectarFirebase()` en `app/firebase.js`. Con un import estático, una red
  que bloqueara `gstatic` dejaba la herramienta en «Cargando assessment» para siempre, también en
  modo local. Nada fuera de `app/firebase.js` importa de `gstatic`: el SDK se pide por
  `conectarFirebase()` o `getConexion()`, y «estoy en un escenario compartido» se pregunta con
  `enEscenarioCompartido`, no con si hay referencia — un escenario cuyo SDK no ha llegado no es
  modo local.

### `app/` es el reparto de `app.js`

`app.js` es la raíz de composición; todo lo demás vive en `app/`: los diecisiete módulos de
infraestructura —estado, avisos, almacenamiento, preferencias, gráficos, métricas, dominios,
filtros, subcapacidad, escenario, Firebase, identidad, indicador, copias, persistencia,
repintado y edición—, las
vistas en `app/vistas/`, `app/celdas.js` con lo que comparten, `app/modales.js`, `app/informe.js`,
`app/biblioteca.js`, `app/buscador.js` y `app/taller.js`. Lo nuevo nace ya en `app/`, no en
`app.js`. Mover código entre módulos se verifica igual que un refactor: consola en silencio, las pruebas, el informe y el A/B contra
`main` sobre los nueve dominios.

Dos reglas que han salido del propio reparto y conviene respetar:

- **De `app/estado.js` solo salen objetos y colecciones, nunca valores sueltos.** En módulos ES se
  puede *leer* lo que otro módulo exporta pero no se le puede asignar: `state.activeDomainId = "x"`
  vale desde cualquier sitio, `vistaActiva = "roadmap"` no compila. Los valores sueltos que de
  verdad cambian se quedan en el módulo que los gobierna y salen por una función de lectura.
- **Lo que necesite repintar, que lo reciba inyectado.** `app/preferencias.js` no importa
  `renderAll`: se lo pasan una vez al arrancar. Importarlo crearía un ciclo con el orquestador de
  vistas, y un ciclo que hoy funciona por cómo se *hoistean* las funciones es una trampa para quien
  lo toque mañana.

En `app.js` se queda lo que de verdad es raíz de composición: `init()`, `cacheElements()`,
`bindGlobalEvents()`, `renderAll()`, el conmutador de vistas y el escenario —importar, exportar,
crear y restaurar—. El cruce con el orquestador se resolvió con `app/repintado.js`, que es por
donde `app/vistas/assessment.js` pide repintar en vez de llamar a `renderAll()`.

Y una regla más, que salió de repartir las vistas: **lo que use más de una vista no puede quedarse
en `app.js`.** `app/` no puede importar de `app.js` sin cerrar un ciclo con el orquestador, así que
va a `app/celdas.js`. Medir qué comparten antes de mover nada es lo que hace barata cada tanda.

### La versión va en cada import, y el CI lo comprueba

`index.html` carga `styles.css`, `tema.js` y `app.js` con `?v=N`, y ese número existe por un motivo
concreto: GitHub Pages sirve cada archivo con su propia caché, así que tras desplegar puede darse la
mezcla «HTML nuevo + JavaScript viejo».

Los imports de un módulo ES **no pasan por `index.html`**: resuelven rutas relativas por su cuenta.
Así que `import "./core/calculo.js"` se pedía sin versión, y un `app.js` nuevo podía venir con un
`core/calculo.js` viejo en caché — justo la mezcla que el `?v=` existe para impedir, una capa más
abajo. Ahora **cada import relativo lleva la versión**, también los de `tests/`.

**Lo evidente sería un `importmap`**, con las rutas versionadas en un solo sitio. No sirve aquí:
un importmap en línea está sujeto a `script-src`, y la CSP **no lleva `'unsafe-inline'` a propósito**
— es la directiva que cierra la inyección de código. Comprobado en el navegador, no de memoria: se
bloquea. Y un importmap externo depende de soporte reciente, que no se puede dar por hecho en el
portátil que haya en la sala.

Al desplegar hay que subir el número **en `index.html` y en todos los imports**. Olvidarlo es un CI
rojo, no un fallo silencioso en casa de un cliente:

```powershell
python scripts/check_module_version.py
```

### Todo el código se pide de golpe

`index.html` lleva un `<link rel="modulepreload">` por cada módulo que carga `app.js` y un
`<link rel="preload">` para los tres JSON del arranque. Firebase no: se descarga aparte, solo con
`?scenario=` (ver abajo). Sin ellos el navegador
descubre los módulos por capas —baja `app.js`, lee sus imports, baja esos…— y eran cuatro viajes al
servidor seguidos solo para tener el código, más tres para los datos. Medido con 100 ms de ida y
vuelta, la carga bajó de 1,26 s a 0,94 s; con 200 ms, de 2,06 s a 1,33 s.

**Un módulo nuevo necesita su línea de precarga.** Sin ella no se rompe nada, solo llega más tarde,
así que `check_module_version.py` compara la lista con el árbol de imports y pone el CI en rojo con
la línea exacta que hay que añadir o quitar. Los nueve JSON de dominio no se precargan a propósito:
la lista de dominios vive en `data/domains.json` y no se repite en el HTML.

Chart.js lleva `defer` por lo mismo: sin él, compartiendo la línea con todo lo demás, la cabecera
tardaba 200 ms más en pintarse. Se sigue ejecutando antes que `app.js`, porque los scripts diferidos
y los módulos corren en el orden del documento.

### El tema y la densidad se deciden antes de pintar

`tema.js` va **síncrono en `<head>`**, sin `defer` y sin `type="module"`, y escribe `data-tema` y
`data-densidad` en `<html>` leyendo `localStorage`. Va ahí por dos motivos que no son negociables:

- `app.js` es un módulo, así que corre **después** de analizar el HTML: la página llega a pintarse
  en claro y da un salto a oscuro. Proyectado en una sala, ese salto lo ve todo el mundo.
- Un `<script>` en línea sería lo natural para diez líneas, pero **la CSP no los admite** — es la
  directiva que cierra la inyección de código. `script-src 'self'` sí admite un archivo.

Y tiene una tercera ventaja: como el tema llega resuelto en un atributo, `styles.css` necesita **un
solo bloque** `:root[data-tema="oscuro"]`. La alternativa —consulta de medios para el caso por
defecto más un selector para la elección explícita— obliga a escribir los cuarenta y tantos valores
dos veces, y dos copias que se mantienen a mano acaban separándose.

Sin elección guardada manda el sistema, y `app.js` escucha `prefers-color-scheme` para seguirlo en
vivo. Con elección guardada manda ella, en los dos sentidos.

**Tres cosas que no siguen al tema, y cada una por su motivo:**

- **El verde de marca y los tres colores de palanca.** Son identidad. Un verde de Procesos distinto
  en oscuro dejaría de significar "Procesos".
- **Los radares.** Chart.js no lee CSS: sus colores van en la configuración. Por eso existe
  `PALETA_DE_RADAR` en `app/preferencias.js`, con las versiones aclaradas para dibujar sobre fondo oscuro — el
  azul de Organización, `#012169`, sobre una tarjeta oscura es invisible.
- **El informe PDF.** Sale claro siempre, con el tema que sea. Se imprime, y un deck oscuro gasta
  tinta y se proyecta peor. `conLasVistasDelInformeVisibles()` fuerza el tema claro mientras dura la
  captura: los radares del informe son PNG capturados del canvas, y en oscuro salían con rótulos
  gris claro sobre una diapositiva blanca.

Los contrastes están comprobados **pareja a pareja en los dos temas**, sobre el DOM real y
componiendo el alfa. Al tocar un color hay que rehacer esa cuenta: en una celda del heatmap, un
contraste mal puesto no es un problema estético, es un dato que no se lee.

### Las seis pestañas son vistas, no anclas

`setupVistas()` muestra **solo la sección activa**; las otras cinco están `hidden` y no se pintan.
`renderAll()` solo repinta la vista visible. El enlace directo (`#roadmap`) se sigue respetando.

La vista de arranque es **Overview**: `vistaDesdeLaUrl()` cae ahí cuando la URL no trae ancla.

Consecuencia práctica: si algo depende de medir un elemento oculto, hay que hacerlo visible primero.
Es lo que hace `conLasVistasDelInformeVisibles()`, en `app/informe.js`, para capturar los radares
del PDF — un canvas oculto no tiene tamaño y saldría en blanco.

Los radares van **justo debajo de las cuatro tarjetas**, en el Overview y en el Dashboard: son lo
primero que se enseña en un taller. Y **sus ejes se pulsan**: un dominio del Overview abre su
Dashboard, y una capacidad del Dashboard abre el Assessment en sus tarjetas, que se resaltan un
momento. Las filas de las dos tablas resumen llevan al mismo sitio que su eje. A la capacidad se la
lleva desplazando y no filtrando el Assessment, a propósito: un filtro puesto sin querer cambia
después KPIs, roadmap, CSV y PDF. Chart.js no tiene eventos para las etiquetas del radar, así que
`ejeBajoElPuntero()` en `app/graficos.js` mira la caja de cada una con `getPointLabelPosition()`. A
dónde se va lo decide `setupNavegacionDeRadares()` en `app.js`, que se lo inyecta a los radares.

Añadir una vista son cinco sitios: `VISTAS` y `cacheElements()` en `app.js`, un `<a>` en
`<nav class="tabs">`, una `<section id>` en `index.html`, y su rama en `renderAll()`. Si la vista
es un módulo nuevo, también su `modulepreload` en `index.html` (el CI lo pide).

### El ámbito de datos es uno solo, salvo en el Overview

`getScopedItems()` es **la única** fuente de subcapacidades para el dominio abierto: dashboard,
resumen, radares, heatmap, roadmap, CSV y PDF. Antes convivían dos ámbitos y el KPI decía "7 de
prioridad alta" mientras el roadmap enseñaba 2.

No añadir una vista que lea `state.items` directamente.

**El Overview es la excepción, y es deliberada.** Su pregunta es otra —no "cómo está este dominio"
sino "cómo está la función financiera"—, así que lee `state.domains` entero vía
`getDominiosDelOverview()` y **no aplica los filtros**: son del dominio abierto (el desplegable de
capacidad se rellena con las capacidades del activo), así que a nivel global no significan nada. Su
nota de ámbito lo dice en pantalla para que el descuadre con el Dashboard no se lea como un fallo.

**La pestaña IA tampoco usa ese ámbito**, por otro motivo: no habla de subcapacidades puntuadas sino
del catálogo de casos, que es el mismo para los nueve dominios. Va antes del corte de `renderAll()`,
como el Overview, y sus filtros —buscador, dominio, las dos etiquetas y documento— son suyos: no
tocan ni leen los del Assessment. Como casi nada de lo que enseña depende de las puntuaciones, no
se repinta con cada score; solo cuando cambian el catálogo, la biblioteca o los dominios cargados.
La excepción es su desplegable **Orden**: «Prioridad del cliente» pone primero los casos que atacan
más brechas altas y medias (`brechasDeCasos()` y `ordenarPorBrechas()` en `core/biblioteca.js`), y
entonces sí se repinta, pero solo cuando cambia el orden o lo que dice alguna ficha. Ese orden lo
sigue también la diapositiva «Oportunidades de IA» del informe, que lo dice en su entradilla.

**«Lo más urgente de la función financiera»**, al final del Overview, son las diez subcapacidades de
prioridad alta con más gap de los nueve dominios, con `masUrgentes()` de `core/calculo.js`. La
misma función alimenta las diapositivas del mismo nombre en la parte global del informe, para que
pantalla y deck digan las mismas diez. Cada una lleva a su tarjeta en el Assessment de su dominio,
sin tocar los filtros: si un filtro la esconde, un aviso lo dice.

**El buscador** (la lupa al final de la barra de pestañas, o **Ctrl+K** desde cualquier sitio)
tampoco usa el ámbito: busca en los nueve dominios, sin tildes y con las palabras en cualquier
orden, y pesa más lo que está en el nombre de la subcapacidad que en su capacidad o su dominio
(`buscarSubcapacidades()` en `core/busqueda.js`). Elegir un resultado hace lo mismo que «Lo más
urgente», con la misma función, `abrirTarjetaEnSuDominio()` en `app.js`: su tarjeta, sin tocar
los filtros. Es un `<dialog>` nativo y no uno de los modales: `showModal()` ya deja el fondo
inerte, atrapa el foco y cierra con Escape.

**El modo taller** (**Sesión → Modo taller**, en la cabecera) proyecta una subcapacidad a pantalla
completa: los cinco niveles en columnas, con las palancas y el objetivo marcados encima, la escala
para puntuar, las preguntas clave y las notas del taller. **Sí usa el ámbito**: recorre las tarjetas
que enseña el Assessment, con sus filtros, y la lista se fija al abrir, para que puntuar una que el
filtro de prioridad deja fuera no la saque del recorrido a mitad de sesión. Puntúa y guarda con lo
mismo que las tarjetas —`conectarPuntuacion()` y `app/edicion.js`—, y `renderAll()` lo pone al día
con `refrescarModoTaller()`. Desde otra vista, primero abre el Assessment: empieza en la tarjeta en
la que se estaba y vuelve a ella al salir. Cambiar de vista es del orquestador, así que `app.js` se
lo inyecta a `setupModoTaller()`.

Es un `.modal-backdrop` y no un `<dialog>`, al revés que el buscador y a propósito: la capa superior
de `showModal()` taparía el chip de guardado y los avisos, y en un taller tienen que seguir a la
vista. Sus radios llevan el prefijo `taller` en el `name` porque los grupos de radios son de todo el
documento: con el mismo nombre que la tarjeta, puntuar en uno desmarcaba el otro.

El menú de la cabecera se llamaba «Escenario» y ahora es **«Sesión»**: agrupa lo de la sesión con el
cliente, del modo taller a las copias. El modo taller estuvo primero en la barra de pestañas, pero
no cabía a 1366 px sin acortar todo lo demás.

«Volver arriba» flota abajo a la derecha, en un círculo, y sube por encima del chip de guardado
mientras este se ve (`apartarDelChip()` en `app/indicador.js`). A la izquierda tapaba la primera
columna del Roadmap y del Heatmap.

### Los objetivos se resuelven por dominio

`getCapabilityTargets(capacidad, domainId)` y `calculate(item, domainId)` reciben el dominio, con el
activo por defecto. Antes solo miraban el abierto en el conmutador, y eso daba gaps equivocados para
los otros ocho: **un mismo nombre de capacidad puede existir en dos dominios** y no tienen por qué
compartir objetivo. La caché de objetivos va indexada por la pareja dominio + capacidad.

Hoy ningún nombre se repite —el caso real era "Contabilidad y provisión fiscal", en Fiscal y en
Tesorería, hasta que la de Tesorería pasó a llamarse "Control y tratamiento contable"—, pero la
resolución por dominio se queda: los datos salen de nueve Excel que mantienen personas distintas, y
nada impide que dos vuelvan a coincidir. La cubren las pruebas de `core/`.

Cuidado al pasar cualquiera de las dos a un `map()`: su segundo argumento es el dominio, y `map`
pasa el índice. Por eso `agregarPorCapacidad()` las envuelve en lambdas, y el motor también
(`core/calculo.js`). Esas lambdas no son redundantes.

### El informe PDF es un deck, no un documento

La página mide **338×190mm**, que es exactamente la diapositiva 16:9 de PowerPoint (13,33×7,5
pulgadas). No es una proporción aproximada: con esa medida el PDF se proyecta a pantalla completa
sin bandas y se inserta en una presentación sin reescalar. Es lo más cerca de una `.pptx` sin
generar una `.pptx`, que habría sido una dependencia vendorizada y un motor de maquetación distinto.

El informe abre con **la función financiera entera** —los nueve dominios, los datos del Overview— y
después entra al dominio activo. Eso significa que el PDF hereda la excepción del Overview: **la
parte global no aplica los filtros y la de dominio sí.** El informe lo dice en pantalla, igual que
la aplicación, para que el descuadre no se lea como un fallo.

**Hay dos informes**, y «Exportar PDF» abre un menú para elegir. Es un menú y no un diálogo a
propósito: `window.open()` tiene que ir en el mismo clic que lo pide, o el navegador lo bloquea como
ventana emergente. El mismo menú lleva además la **preparación del taller**, que no es un informe
(ver abajo).

- **El del dominio** es el de siempre: la parte global y el dominio abierto, con los filtros activos.
- **El de todo el proyecto** lleva, tras la parte global, un **capítulo por cada dominio con algo
  puntuado** (`dominiosDelProyecto()` en `app/informe.js`), en el orden del Overview y **sin
  filtros**: son del dominio abierto —el de capacidad ni existe en los demás—, y aplicar solo los
  que sí existen daría capítulos filtrados y otros enteros sin que se notara. Cada capítulo son las
  mismas diapositivas que el informe de un dominio, sin el separador de «Hacia dónde», y su pie dice
  de qué dominio es. El índice pasa a ser **por partes**, con el rango de cada sección, porque una
  línea por sección no cabe con nueve dominios. Los radares de cada dominio se pintan uno detrás de
  otro en los canvas del Dashboard y se capturan; al acabar se repinta el Dashboard.

**La preparación del taller** (`informe/preparacion.js`) es lo que se envía al cliente antes de
la sesión: para cada subcapacidad, su objetivo, las preguntas clave y la documentación que conviene
traer, con casillas, y la escala de la rúbrica general. **No lleva ni una puntuación ni las notas**,
que son del equipo. Es un documento y no un deck: **A4 vertical**, fluye de página en página y no
reparte en diapositivas, así que no pasa por `?comprobar=desbordes`; una subcapacidad no se parte
entre dos páginas y el número de página va en el margen con `@page`. Lleva lo que dejan los filtros,
como el modo taller —un taller de una sola capacidad tiene su preparación—, y como va al cliente, el
menú y el aviso dicen cuántas quedan fuera. La rúbrica es una copia de la del modal «Criterios F3M»
de `index.html`, y `tests/casos-preparacion.js` compara las dos.

Las cifras de un capítulo salen de `datosDeDominio()`, que recibe el dominio en vez de leer el
abierto: el informe de un dominio usa la misma función, así que los dos no pueden decir cosas
distintas del mismo dominio.

El reparto de `informe/`:

- `pdf.js` decide **qué diapositivas y en qué orden**. El plan se arma entero antes de dibujar nada,
  porque el índice necesita los números de las demás y esos dependen de los filtros y del dominio.
- `secciones.js` pinta cada diapositiva. `graficos.js` dibuja. `estilos.js` tiene la paleta y la hoja.

Los gráficos van en **SVG generado por funciones puras**, no en Chart.js: la ventana del informe se
escribe con `document.write()` y **no lleva scripts a propósito**, así que no hay dónde arrancar una
librería. De paso imprimen en vectorial y se pueden probar sin navegador. Los **radares siguen
siendo PNG capturados de Chart.js** —seis ahora, no tres: los del Dashboard y los del Overview—
porque un radar a mano sale peor y ese camino ya estaba probado.

**Ninguna diapositiva puede desbordar.** Lleva `overflow: hidden`, y está ahí a propósito: sin él,
un milímetro de más genera una página en blanco detrás de cada una y el PDF sale con veinte páginas
vacías intercaladas. Pero recortar en silencio es el fallo que más caro sale en una sesión con
cliente, así que la red es que nada llegue a recortarse nunca:

- Las secciones largas se **reparten** en varias diapositivas con `paginar()`, no se truncan.
  Cuántas filas caben está en `POR_DIAPOSITIVA`, en `informe/secciones.js`.
- `informe/desbordes.js` mide cada diapositiva en el navegador y dice lo que sobra. Se dispara
  abriendo la herramienta con **`?comprobar=desbordes`** y exportando el informe: la medida sale en
  el aviso de la aplicación, y la tabla completa en la consola. **Al tocar `informe/estilos.js`, el
  tamaño de letra de una tabla o `POR_DIAPOSITIVA`, hay que volver a pasarlo**, y sobre los nueve
  dominios: Controlling tiene 24 subcapacidades y es el que aprieta.

  Se mide **desde la aplicación**, no desde dentro del informe, y no es un capricho: la ventana del
  informe no lleva scripts a propósito y además hereda una CSP que no admite scripts en línea, así
  que un botón ahí dentro no es posible. Desde la aplicación el documento está a mano, porque lo
  acaba de escribir ella.

Los números de `POR_DIAPOSITIVA` y el relleno de fila de `.tabla` están cuadrados entre sí. Apretar
las filas no es gratis en la otra dirección: con ellas más juntas, la tabla de nueve dominios
ocupaba dos tercios de la diapositiva y dejaba una franja blanca debajo que, proyectada, parece una
diapositiva a medio terminar.

Un SVG con `viewBox` y `height: auto` mide lo que diga su proporción **por ancho**: el mismo bullet
ocupa 4mm en una celda de tabla y 20mm en una tarjeta. Cada uso fija su altura en `estilos.js`; si
se añade un gráfico nuevo, hay que fijársela también.

## Reglas de negocio F3M

La fuente de verdad es `core/calculo.js`, y está cubierta por las pruebas. El README coincide.

**Tres palancas** (`PALANCAS` en `core/calculo.js`), con colores de marca Deloitte en
`core/presentacion.js`: Procesos `#86BC25` · Tecnología `#ED8B00` · Organización `#012169`.

**Objetivo de madurez**: configurable **por capacidad y por palanca**, vía `getCapabilityTargets()`
en `app/metricas.js`. `DEFAULT_TARGET_MATURITY = 4` es solo el valor por defecto cuando una capacidad no
tiene objetivo propio, no una constante fija del modelo.

El panel de objetivos lleva arriba una fila **«Todas las capacidades»**: cambiar ahí una palanca la
pone igual en todas las capacidades del dominio, y si no coinciden dice «Varios». **«Usar estos
objetivos en los nueve dominios»** copia, tras confirmar, las palancas que coinciden a todos los
dominios cargados; las que dicen «Varios» no se tocan, y el diálogo lo enumera. Va en una sola
escritura, `persistTargetsDeDominios()`, para que en un escenario compartido no queden unos
dominios cambiados y otros no.

**Cálculo** (`calcularMetricas()` en `core/calculo.js`):

- El gap se calcula **por palanca**: `max(0, target - score)`.
- El gap del ítem es el **promedio de los gaps de las palancas puntuadas**. No es `4 - scoreMedio`.
  Con objetivo 4 y scores `[3, 2, 5]` el gap es `1,0`, no `0,67`.
- Solo entran en los promedios las palancas **con score informado**.
- Sin ninguna palanca puntuada, el ítem queda `isPending: true`, con prioridad y oleada
  `"Pendiente"`. No se inventan valores para lo no evaluado.

**Nivel resultante** (`getMaturityLevel()`), a partir del score medio:

| Score | Nivel |
|---|---|
| `< 1.5` | 1 - Inicial |
| `< 2.5` | 2 - Estructurado |
| `< 3.5` | 3 - Estandarizado |
| `< 4.5` | 4 - Optimizado |
| `>= 4.5` | 5 - Avanzado/Referente |

**Prioridad** (`priorityFromGap()`): gap `>= 2` → Alta · `>= 1` → Media · resto → Baja.

**Oleada** (`oleadaDesdePrioridad()`): Alta → Oleada 1 · Media → Oleada 2 · Baja → Oleada 3.

**Agregación por capacidad** (`agregarPorCapacidad()`): una sola función para la tabla resumen, el
heatmap, el PDF y el CSV. Las medias por palanca usan todas las subcapacidades con esa palanca
puntuada; score medio, objetivo medio y gap solo las que tienen alguna palanca puntuada.

**Agregación por dominio** (`agregarPorDominio()`): la hermana de la anterior, para el Overview, con
las mismas reglas de promedio. Dos cosas propias:

- Se promedian **métricas de subcapacidad, nunca filas de capacidad ya promediadas**. Un dominio con
  capacidades de 2 y 8 subcapacidades daría otro número con una media de medias, y no coincidiría
  con el PDF.
- El **objetivo por palanca del dominio** (`objetivoProcesos` y compañeros, los que dibuja el radar)
  promedia **todas** las subcapacidades, también las pendientes. El objetivo es configuración, no
  medición: si contara solo lo puntuado, la línea de referencia del radar se movería cada vez que se
  rellena una celda en un taller. Es distinto de `targetMedio`, la columna "Objetivo medio" de la
  tabla, que sí cuenta solo lo evaluado — igual que en la agregación por capacidad.

### Cachés de cálculo

`calculate()` en `app/metricas.js` envuelve a `calcularMetricas()` con una caché por ítem, y
`getCapabilityTargets()` devuelve la misma referencia mientras los objetivos no cambien.

**Ninguna se invalida a mano**: los valores se recalculan siempre y la caché solo decide si
reutiliza el resultado anterior. Si un score o un objetivo cambia, la comparación falla y se
recalcula. No hay que acordarse de vaciar nada al tocar el estado.

## Persistencia y escenarios compartidos

- **Local**: `localStorage`. La clave (`STORAGE_KEY`) es `f3m-fpa-assessment-scenario` sin escenario
  compartido, y `f3m-fpa-assessment-scenario:<id>` con él. **Es por escenario a propósito**: con una
  clave única, abrir el escenario de un cliente y después el de otro dejaba los datos del primero en
  pantalla cuando la lectura remota del segundo fallaba. El nombre de quien edita va aparte, en
  `f3m-nombre-editor`.

  En modo local el trabajo solo vive en ese navegador, así que `app/copias.js` lleva la cuenta de
  si tiene copia fuera: `f3m-ultima-copia` (cuándo se guardó o se abrió la última) y
  `f3m-cambios-sin-copia-desde` (el primer cambio después). «Guardar una copia» dice cuándo fue la
  última, y con cambios de **más de un día** sin copia, el botón «Sesión» lleva un punto ámbar.
  Un día y no antes: durante el taller el trabajo está a salvo, y un aviso que salta delante del
  cliente a los cinco minutos acaba ignorado. En un escenario compartido no se dice nada.
- **Compartido**: parámetro de URL `?scenario=<id>`. Lee y escribe en `scenarios/<id>` de la
  Realtime Database. El id se valida contra `/^[a-zA-Z0-9_-]{20,120}$/` en `getScenarioIdFromUrl()`.

Al tocar el flujo de guardado, tener en cuenta:

- Todo lo que va a Firebase pasa por `sanitizeScenarioForFirebase()`, que delega en
  `normalizarEscenarioParaFirebase()` de `core/escenario.js`. **Construye el escenario desde cero**
  con los campos que las reglas admiten: un campo de más hace que Firebase rechace la escritura
  entera, no solo ese campo.
- El flag `isApplyingRemoteScenario` evita que un cambio recibido de Firebase se vuelva a escribir
  en Firebase. **No eliminarlo** al refactorizar el guardado.
- `snapshotRemotoPendiente` guarda el snapshot que llega mientras estamos escribiendo, para
  aplicarlo después en vez de descartarlo.
- Las escrituras normales son **granulares por ruta** (`persistGranularChange()`), no del payload
  completo. Las únicas escrituras completas son crear escenario, importar y restaurar.
- El **nombre del cliente** (`cliente`, en la raíz del escenario) viaja siempre en su propia
  escritura, `persistCliente()`, y nunca dentro de una completa. Es el campo más nuevo de las
  reglas: si las publicadas en la consola aún no lo conocen, una escritura completa que lo llevara
  se rechazaría entera, puntuaciones incluidas. Separado, lo peor es que no se comparta el nombre.
- El indicador de guardado tiene un estado `error` real. **Ningún `catch` puede terminar en un
  mensaje de éxito**: es el fallo que más caro sale en una sesión con cliente.

### El contrato con las reglas de Firebase

`core/escenario.js` es el **espejo en JavaScript de `database.rules.json`**: campos admitidos en
cada nivel, longitudes máximas, estados válidos y campos de autoría.

**Si se cambia `database.rules.json`, hay que cambiar `core/escenario.js` también.** Esto ya no
depende de que alguien se acuerde: `tests/casos-reglas.js` lee el archivo de reglas y compara campo a
campo los límites, los campos admitidos, los cerrojos `$otro...` y los rangos de score. Si los dos
dejan de decir lo mismo, el CI se pone rojo.

Lo que **no** puede comprobar ninguna prueba es que las reglas desplegadas en Firebase coincidan con
las de este repositorio. Eso se mira en la consola.

`revisarEscenario()` revisa un archivo importado **antes** de aplicarlo: lo que no es un escenario
de esta herramienta no llega a tocar los datos, y lo que se puede arreglar al vuelo se enumera en el
aviso en vez de corregirse en silencio.

### Aviso de seguridad — Firebase

**`SECURITY.md` es el documento completo**: qué protege la herramienta, qué no, qué datos guarda y
dónde, y los procedimientos. Lo que sigue es lo que hay que tener presente al tocar este código.

La configuración de Firebase está en claro en la cabecera de `app/firebase.js` (`apiKey`, `databaseURL`,
`projectId`…). En una web app de Firebase esto es **público por diseño** y no constituye un secreto
filtrado: la autorización la dan las reglas, no el secreto de la clave.

Las reglas de `database.rules.json` exigen `auth != null`, validan campo a campo y rechazan
cualquier campo no declarado. Pero **el repositorio no puede garantizar qué reglas están
desplegadas**: eso se comprueba en la consola de Firebase. Si las reglas activas fueran las
permisivas, cualquiera con la URL de la base —que está en el código público— podría leer y escribir
todos los escenarios.

Y conviene no confundirse con lo que aporta `auth != null`: la autenticación es **anónima y
abierta**, así que da atribución y una barrera frente al `curl`, no control de acceso. **El enlace
sigue siendo la credencial.**

Al tocar el guardado, tener presente que hay una puerta de identidad:
`hayIdentidadParaEscribir()` corta la escritura antes de intentarla si no hay `usuarioActual`. No
quitarla al refactorizar — sin ella, el rechazo de las reglas llega disfrazado de fallo de red.

El README documenta el orden de despliegue y los scripts de rotación, borrado y auditoría.

## Datos: flujo Excel → JSON

Los 9 archivos `F3M_*.xlsx` de la raíz son la fuente desde la que se generan los JSON de datos.
`scripts/convert_domains.py` lee la hoja `Assessment` (y la hoja opcional `AI Overlay`) de cada uno y
escribe `data/domains/*.json`:

```powershell
python scripts/convert_domains.py
```

Requiere `openpyxl`. Consecuencia práctica: si se editan los JSON a mano, la siguiente ejecución del
script sobrescribe esos cambios.

## Los casos de uso de IA van por otro camino

El **título** de cada caso viene de la hoja `AI Overlay` del Excel de dominio y acaba en `ai.cases`,
una cadena `"a; b; c"` dentro de cada subcapacidad. Lo que el caso **hace** y sus **dos etiquetas**
—tipo de IA y tipo de valor— viven en `data/casos-ia.json`, y la aplicación las cruza al pintar.

**El cruce es por el título, exacto.** Son 100 fichas para 413 apariciones: meterlas dentro de cada
subcapacidad serían 413 copias repartidas por los nueve archivos de datos, y renombrar un caso
obligaría a tocarlas todas.

Aquí la dirección del flujo se invierte respecto a todo lo demás: **el repositorio es la fuente y el
Excel del equipo es la salida**, que se regenera con `scripts/generar_excel_casos_ia.py` y por eso
no se versiona. `scripts/bootstrap_casos_ia.py` es el arranque de una sola vez que trajo los tres
campos al repositorio; se conserva por trazabilidad. Si el equipo corrige una etiqueta en su copia,
hay que traerla al JSON a conciencia.

Un título que se renombre en un sitio y no en el otro no rompe nada visiblemente: la ficha se pinta
con el título solo, sin etiquetas ni frase, y eso no se distingue de un caso sin clasificar. Por eso
`check_domains_sync.py` cruza las dos listas en las dos direcciones y pone el CI en rojo.

### Y cada caso dice de dónde sale

Cada caso de `data/casos-ia.json` lleva `fuentes`: el documento de la biblioteca, la página o
diapositiva —la del visor, no la impresa— y el texto exacto con el que aparece allí, en inglés. La
primera es la que abre **«Más información»**, en cualquier ficha: el detalle del Assessment, el
modal de IA del Roadmap y la pestaña IA. Las demás salen en el visor como «También en».

Cuatro casos no aparecen con esas palabras en los documentos y apuntan a la diapositiva de su área,
con `"alcance": "area"` y una `nota`. El visor los marca como **referencia aproximada**: delante del
cliente, el consultor tiene que saber si lo que se abre es el caso o su contexto.

Los documentos y su número de páginas están en `data/biblioteca.json`, y los archivos en
`biblioteca/`. Lo que se enseña dentro de la herramienta **tiene que ser un PDF**: es lo único que
el navegador sabe abrir en una página concreta. Un PowerPoint lleva al lado su PDF exportado, y lo
que se descarga es el original. Cómo se añade un documento: `biblioteca/LEEME.md`.

El visor es el del propio navegador, en un iframe, y no una librería: pdf.js sería más de un
megabyte vendorizado para enseñar algo que Chrome, Edge y Firefox ya enseñan. La CSP no cambia: el
iframe hereda `default-src 'self'`. **No poner `frame-src 'none'`**: dejaría el visor en blanco.

`core/biblioteca.js` descarta, sin corregir, cualquier fuente que no lleve a una página que existe,
y `check_domains_sync.py` dice en el CI cuál se ha descartado: archivos que faltan, páginas fuera de
rango, casos sin fuente o sin texto. Un documento que no cita ningún caso es solo un aviso: lo
natural es subirlo antes de terminar de apuntar sus casos. Lo que no comprueba es que `total`
coincida con el PDF ni que la página sea la buena: eso se mira abriéndola.

## Renombrar una capacidad o una subcapacidad

El nombre de la capacidad **es la clave** de sus objetivos guardados (en Firebase, en la copia local
y en los JSON exportados), y la red de las subcapacidades guardadas sin id. Cambiarlo solo en el
Excel no rompe nada a la vista: los objetivos que el equipo hubiera ajustado vuelven al de por
defecto, en silencio, y el gap cambia.

Por eso un renombrado son tres pasos:

1. El Excel del dominio, en **todas** las hojas donde aparece (Assessment, Resumen, Heatmap,
   Roadmap, AI Overlay, Instrucciones y la caché del gráfico). Si se edita con `openpyxl`, ojo:
   **descarta los gráficos al guardar**. El de Tesorería se cambió sustituyendo el texto dentro del
   `.xlsx` (`xl/sharedStrings.xml` y `xl/charts/chart1.xml`), que no toca nada más.
2. `python scripts/convert_domains.py`, y comprobar que el diff de `data/domains/` es solo ese nombre.
3. Una entrada en `CAPACIDADES_RENOMBRADAS`, en `core/coincidencias.js`, con el nombre que tenía.
   `capacidadVigente()` traduce el antiguo al nuevo **solo** si el antiguo ya no existe en el dominio
   y el nuevo sí, así que no hace falta que la entrada sepa de qué dominio es para no equivocarse.

**Una subcapacidad** se renombra igual, con su entrada en `SUBCAPACIDADES_RENOMBRADAS`. Ahí el nombre
pesa menos: lo guardado se reconoce por el id, y el id sale del prefijo «1.1» del nombre
(`make_id()` en `scripts/convert_domains.py`), así que **el prefijo no se toca**. La entrada es la
red de los escenarios anteriores a los ids.

Al sustituir textos dentro del `.xlsx`, ojo: Excel guarda cada cadena **una sola vez** en
`xl/sharedStrings.xml`, y la comparten todas las celdas que dicen lo mismo. Antes de cambiar una hay
que mirar qué celdas apuntan a ella, o el cambio se cuela en otra subcapacidad.

## Añadir un dominio nuevo

**Un solo sitio**: una entrada en `data/domains.json`, con `id`, `label`, `title`, `group`, `source`
(el Excel) y `dataUrl`. De ahí lo leen `scripts/convert_domains.py` (para saber qué convertir) y
`app.js` (para las rutas de datos y para pintar el conmutador).

Después:

```powershell
python scripts/convert_domains.py
python scripts/check_domains_sync.py
```

Los tres `group` válidos están en `groups`, dentro del mismo archivo: `Transaccionales y operativos`,
`Técnicos y especializados`, `Estratégicos y de negocio`.

`check_domains_sync.py` detecta lo que suele fallar: un Excel que no existe, un campo que falta, un
grupo inventado, un id repetido y un JSON huérfano que el catálogo no menciona. También cruza el
catálogo de casos de IA con los títulos que usan las subcapacidades, en las dos direcciones, y la
biblioteca con las fuentes de cada caso.

## Convenciones

- Trabajo en ramas `feature/<tema>`, PR contra `main`.
- Mensajes de commit en español, explicando **por qué** además de qué.
- Los comentarios del código explican decisiones, no mecánica. Los que hay documentan por qué se
  descartó una alternativa: conviene leerlos antes de "simplificar" algo que parece redundante.

## Verificación

### Pruebas automáticas

```powershell
python scripts/check_domains_sync.py
```

Verifica el catálogo de dominios, el catálogo de casos de IA, la biblioteca de IA con las fuentes
de cada caso y que los 9 JSON coinciden con sus Excel. Código de salida `1` si algo falla.

Se prueban en `tests/`, sin dependencias, todos los módulos que no necesitan navegador: las reglas
de negocio, los objetivos, la coincidencia de subcapacidades, el contrato de escenario y su espejo
con `database.rules.json`, el formato de presentación, la exportación a CSV, la biblioteca de IA
—que una fuente rota no llegue a la pantalla—, el buscador, el informe —el deck que arma `informe/pdf.js`, las
primitivas SVG y la lectura de las medidas de desborde— y la preparación del taller, con su rúbrica
comparada con la de `index.html`.

- **En el navegador**: con el servidor en marcha, abrir `http://localhost:8000/tests/`. Es la forma
  que funciona en cualquier equipo, sin instalar nada.
- **Desde la línea de comandos**, si hay Node: `node tests/ejecutar.mjs`. Sale con código `1` si
  falla algo, listo para CI.

Los dos ejecutan los mismos casos. Al tocar `core/`, `informe/` **o `database.rules.json`**,
ejecutarlas.

La medida de desbordes del informe no va con esos: necesita un navegador que maquete de verdad. Se
pasa con **`?comprobar=desbordes`** en la dirección, exportando el informe. Su parte pura —la
lectura de las medidas— sí está en `tests/casos-informe.js`.

Ojo con el navegador: los módulos ES se cachean con ganas, y un cambio en `core/` puede no verse al
recargar. Si un resultado no cuadra con lo que acabas de editar, sirve en un puerto distinto —origen
nuevo, caché vacía— antes de dar por buena la prueba.

### Comprobación manual en el navegador

El CI (`.github/workflows/verificacion.yml`) ejecuta en cada PR esas dos cosas y además
`check_module_version.py` y `check_modules.py`, que caza los imports rotos de `app/` que las
pruebas no ven porque no cargan el navegador. No hay linter, y el resto se comprueba a mano:

1. `python -m http.server 8000` → `http://localhost:8000/`.
2. Consola del navegador **en silencio**. Un arranque correcto no imprime nada: lo que aparezca
   ahí es un `warn` o un `error` de verdad, y hay que mirarlo.
3. **Los dos temas y las dos densidades.** El conmutador «Oscuro» y el de «Presentación» son
   independientes y se combinan: probar las cuatro combinaciones al menos en Overview y Heatmap,
   que son las que codifican datos en color y en tamaño. Sin elección guardada, cambiar el tema del
   sistema con la pestaña abierta tiene que arrastrar la herramienta. En Presentación, los campos
   del Roadmap y de las notas se ven como texto, sin caja ni flecha, y los scores como la escala
   «1 2 3 4 5» con el elegido en su color; todo se sigue pudiendo editar, y la caja vuelve con el
   ratón encima o con el foco.
4. Recorrer las seis vistas:
   - **Overview**: los 4 KPIs, el titular, las barras, la tabla por dominio, los 3 radares de 9
     ejes y «Lo más urgente», cuyas fichas abren su tarjeta en el Assessment de su dominio.
     Cambiar de dominio en el conmutador **no** debe cambiar ninguna cifra del Overview.
   - **Dashboard**: KPIs, titulares ejecutivos, barras de prioridad y palanca, y los 3 radares.
   - **Assessment**: cambiar un score y comprobar que se recalculan nivel, gap, prioridad y oleada,
     **sin perder el foco ni cerrar los paneles de detalle abiertos**. En «Ver detalle», el bloque
     de casos de IA trae de 2 a 4 fichas, cada una con sus dos etiquetas y su frase: un título
     suelto, sin etiquetas, es un cruce roto. Puntuar también con teclado: Tab llega a cada
     palanca, las teclas 1 a 5 y las flechas puntúan, y Suprimir la deja sin puntuar; pulsar
     otra vez el número elegido también. Las «Notas del taller» del detalle son el mismo
     comentario que el Roadmap: lo escrito en uno aparece en el otro y en el informe. «Siguiente
     sin puntuar», en la barra de pestañas junto al dominio, lleva desde cualquier vista del
     dominio a la próxima tarjeta sin ninguna palanca puntuada, con el foco en su primer score, y
     sin filtros su cifra cuadra con la de la pestaña Assessment.
   - **Modo taller**: **Sesión → Modo taller**, desde cualquier vista, abre el Assessment y en él,
     a pantalla completa, la tarjeta en la que se estaba trabajando, la última tocada o la primera
     que se ve. Puntuar ahí se ve en la tarjeta al salir y el chip de guardado sigue a la vista; las
     notas son las mismas del detalle. «Siguiente» y Av Pág recorren solo lo que dejan los filtros
     («1 de 4» con una capacidad elegida). Tab no sale del modo taller, Ctrl+K no abre el buscador
     encima, y Escape vuelve a la tarjeta en la que se estaba, con el foco en su primer score.
     Probarlo en los cuatro modos de tema y densidad a 1366×768: ninguna de las 152 subcapacidades
     necesita desplazarse.
   - **Heatmap**: desplegar y plegar capacidades.
   - **Roadmap**: comprobar que respeta los filtros activos y que la cifra de iniciativas cuadra.
     Va agrupado por oleada, con una fila de cabecera por oleada y las pendientes al final.
     Cuando cabe a lo ancho, la tabla crece con la página y su encabezado se queda bajo las
     pestañas; cuando no cabe —Presentación, o menos de 1366 px— vuelve a su caja con desplazamiento
     propio. Lo decide `setupCajaDelRoadmap()`. Al tocar los anchos de sus columnas, medir con la
     barra de desplazamiento visible, como en Windows: un Chromium sin ella da 17 px de más.
   - **IA**: los 4 KPIs, las dos tarjetas de la biblioteca y los 100 casos. «Ver sus N casos»
     deja exactamente N fichas. «Más información» abre el documento en la página del caso, con su
     texto en inglés encima para encontrarlo; probarlo también desde el detalle del Assessment y
     desde el modal de IA del Roadmap, donde **Escape cierra solo el visor** y el foco vuelve al
     modal. Cambiar de dominio no cambia nada en esta pestaña, salvo con el orden «Prioridad del
     cliente», que sigue las puntuaciones y no el dominio abierto.
5. Con un filtro puesto, comprobar que **KPIs, tabla, radares, heatmap, roadmap, CSV y PDF dan el
   mismo recuento** — y que el **Overview no cambia**, que es lo suyo.
6. Ir y volver entre Overview y Dashboard: los radares de los dos siguen correctos (5 ejes de
   capacidad y 9 de dominio).
7. **El informe.** Exportar desde **cada una de las seis vistas**, incluidos el Roadmap y la IA
   sin haber pasado por Dashboard ni Overview: los **seis** radares tienen que salir pintados, los
   3 de dominio y los 3 de la parte global. En el diálogo, «Guardar como PDF» con **«Gráficos de
   fondo» activado** —sin eso las portadas y el heatmap salen en blanco—, y comprobar que **ninguna
   diapositiva desborda** a una segunda página. Para eso, abrir con `?comprobar=desbordes` y volver
   a exportar: el aviso dice si alguna se recorta y cuál va más justa. Hacerlo también sobre
   **Controlling**, que con 24 subcapacidades es el dominio que aprieta. Y el **de todo el
   proyecto**, con los nueve dominios puntuados: un capítulo por dominio, cada uno con sus tres
   radares, el índice por partes y ninguna diapositiva recortada. Al terminar, el Dashboard
   tiene que seguir enseñando los radares del dominio abierto.
   **La preparación del taller**, del mismo menú: vertical, sin una puntuación, cada subcapacidad
   entera en su página y el índice entero en la primera. Con un filtro de capacidad, el menú y el
   aviso dicen cuántas lleva, y el número de su capacidad es el suyo («3», no «1»).
8. Cambiar el objetivo de una capacidad en Fiscal y comprobar que en el Overview **solo** se mueve
   la fila de Fiscal. En la fila «Todas las capacidades», cambiar una palanca la pone igual en
   todas y cambiar después una sola la deja en «Varios»; «Usar estos objetivos en los nueve
   dominios» mueve las nueve filas del Overview y no toca las palancas en «Varios».
9. **Los radares se pulsan.** En el Overview, pulsar el nombre de un dominio abre su Dashboard. En el
   Dashboard, pulsar el nombre de una capacidad abre el Assessment en su primera tarjeta, con todas
   las de esa capacidad resaltadas y el foco en su primer score, **sin tocar los filtros**. Lo
   mismo al pulsar una fila de cada tabla resumen. El cursor cambia a mano solo encima de un nombre o de un vértice.
10. Cambiar de dominio y confirmar que los datos se recargan. Con **Ctrl+K**, escribir
   «conciliacion» sin tilde: salen las de varios dominios, las flechas mueven la selección e Intro
   abre su tarjeta en su dominio, con el foco en su primer score. Escape cierra y devuelve el foco.
11. Recargar la página y confirmar que el escenario persiste. En modo local, «Sesión → Guardar
   una copia» dice cuándo fue la última; para ver el punto ámbar sin esperar un día, poner
   `f3m-cambios-sin-copia-desde` a una fecha de anteayer en `localStorage` y recargar. Guardar
   una copia lo quita.
12. Si se ha tocado el flujo compartido: probar con `?scenario=<id-de-prueba>` (el README documenta
   uno seguro), y cortar la red desde las herramientas de desarrollo para comprobar que el chip de
   guardado se pone **rojo**.

### Comparación A/B, para refactorizaciones

Cuando un cambio no debe alterar ninguna cifra, sirve servir la versión anterior en paralelo y
comparar:

```powershell
git archive HEAD | tar -x -C <carpeta-temporal>
cd <carpeta-temporal>; python -m http.server 8001
```

Aplicar el mismo patrón de puntuaciones en los dos y comparar tabla resumen, KPIs, heatmap, roadmap
y CSV. Es lo que se usó para verificar que la unificación de la agregación, las cachés y la
extracción del informe PDF no cambiaban ningún número.

**Si el cambio toca los objetivos, puntuar no basta.** Los nueve JSON vienen sin `targets` y con
`meta.targetMaturity` a 4, así que con los valores por defecto todos los caminos dan el mismo
número y el A/B saldría idéntico aunque el cambio estuviera mal. Hay que **editar objetivos por
capacidad en al menos dos dominios**, con valores distintos entre sí, guardar una copia con
**Sesión → Guardar una copia**, abrirla en la versión antigua y comparar entonces.

Ya no hay en los datos un par de dominios con una capacidad del mismo nombre —era Fiscal y Tesorería
con "Contabilidad y provisión fiscal", hasta el cambio de nombre en Tesorería—, así que el A/B no
pone a prueba la resolución por dominio. Eso queda en `tests/casos-calculo.js`.

La forma cómoda de comparar es recorrer los nueve dominios en las dos versiones y quedarse con un
hash del texto de las vistas, en lugar de mirar tabla por tabla: si los hashes coinciden, no se ha
movido ninguna cifra.
