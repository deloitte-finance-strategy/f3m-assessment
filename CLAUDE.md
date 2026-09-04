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
| `index.html` | Maquetación, `<template>` de la tarjeta de assessment, modales | 603 |
| `app.js` | Estado, DOM, Firebase, filtros, render de las cuatro vistas | 5.395 |
| `styles.css` | Estilos | 3.660 |
| `core/calculo.js` | **Motor de cálculo F3M.** Reglas de negocio puras | 273 |
| `core/escenario.js` | **Contrato de un escenario.** Espejo de `database.rules.json` | 407 |
| `core/presentacion.js` | Escapado, formato de números y colores de marca | 65 |
| `informe/pdf.js` | El informe PDF: de los datos al HTML imprimible | 790 |
| `tests/` | Pruebas de `core/` y del espejo con las reglas, sin dependencias | — |
| `.github/workflows/` | CI: las pruebas y `check_domains_sync.py` en cada PR | — |
| `data/domains.json` | **Fuente única de la lista de dominios** | — |
| `data/domains/*.json` | Datos del assessment, un archivo por dominio | — |
| `database.rules.json` | Reglas de seguridad de la Realtime Database | — |
| `scripts/*.py` | Conversión Excel→JSON, verificación, migración, rotación | — |
| `vendor/` | Chart.js, servido desde aquí y no desde un CDN. **Se versiona** | — |
| `SECURITY.md` | Modelo de amenazas, qué protege y qué no, y los procedimientos | — |

La regla de reparto: **en `core/` no hay DOM, ni Firebase, ni estado global, ni imports.** Todo son
funciones puras, y por eso se pueden probar sin levantar la aplicación. `app.js` es quien conoce el
estado y le pasa a `core/` lo que necesita.

Flujo de arranque, en `init()` de `app.js`:

```
cacheElements() → bindGlobalEvents() → setInitialLoading(true) → showScenarioModeNotice()
  → cargarCatalogoDeDominios()   // data/domains.json + pinta el conmutador
  → loadCoreDomains()            // Promise.allSettled de los 9 dominios
  → setActiveDomain("fpa")
  → applyStoredScenario()        // copia local de localStorage
  → inicializarIdentidad()       // signInAnonymously, solo si hay ?scenario=
  → initializeSharedScenario()   // lee Firebase, aplica lo remoto, se suscribe
  → populateCapacityFilter() → renderAll()
```

Dependencias de terceros, sin bundler:

- **Chart.js 4.5.0** desde `vendor/chart.umd.min.js` (al final de `index.html`) — radares por
  capacidad. **No va por CDN a propósito**: una red de cliente que filtre cdnjs dejaba los radares
  sin pintar y el PDF entregable con tres huecos. `vendor/LEEME.md` explica el porqué y cómo se
  actualiza.
- **Firebase Realtime Database y Auth 12.15.0** importados desde `gstatic.com` (cabecera de
  `app.js`). Este sí sigue siendo externo: son ~500 KB en tres módulos con imports relativos entre
  ellos, y `gstatic` tiene que funcionar de todas formas para que funcione la base de datos.

### Las cuatro pestañas son vistas, no anclas

`setupVistas()` muestra **solo la sección activa**; las otras tres están `hidden` y no se pintan.
`renderAll()` solo repinta la vista visible. El enlace directo (`#roadmap`) se sigue respetando.

Consecuencia práctica: si algo depende de medir un elemento oculto, hay que hacerlo visible primero.
Es lo que hace `conElDashboardVisible()` para capturar los radares del PDF — un canvas oculto no
tiene tamaño y saldría en blanco.

### El ámbito de datos es uno solo

`getScopedItems()` es **la única** fuente de subcapacidades para todas las vistas y exportaciones:
dashboard, resumen, radares, heatmap, roadmap, CSV y PDF. Antes convivían dos ámbitos y el KPI decía
"7 de prioridad alta" mientras el roadmap enseñaba 2.

No añadir una vista que lea `state.items` directamente.

## Reglas de negocio F3M

La fuente de verdad es `core/calculo.js`, y está cubierta por las pruebas. El README coincide.

**Tres palancas** (`PALANCAS` en `core/calculo.js`), con colores de marca Deloitte en
`core/presentacion.js`: Procesos `#86BC25` · Tecnología `#ED8B00` · Organización `#012169`.

**Objetivo de madurez**: configurable **por capacidad y por palanca**, vía `getCapabilityTargets()`
en `app.js`. `DEFAULT_TARGET_MATURITY = 4` es solo el valor por defecto cuando una capacidad no
tiene objetivo propio, no una constante fija del modelo.

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

### Cachés de cálculo

`calculate()` en `app.js` envuelve a `calcularMetricas()` con una caché por ítem, y
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

La configuración de Firebase está en claro en la cabecera de `app.js` (`apiKey`, `databaseURL`,
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
grupo inventado, un id repetido y un JSON huérfano que el catálogo no menciona.

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

Verifica el catálogo de dominios y que los 9 JSON coinciden con sus Excel. Código de salida `1` si
algo falla.

Las reglas de negocio, el contrato de escenario y el espejo con `database.rules.json` se prueban en
`tests/`, sin dependencias:

- **En el navegador**: con el servidor en marcha, abrir `http://localhost:8000/tests/`. Es la forma
  que funciona en cualquier equipo, sin instalar nada.
- **Desde la línea de comandos**, si hay Node: `node tests/ejecutar.mjs`. Sale con código `1` si
  falla algo, listo para CI.

Los dos ejecutan los mismos casos. Al tocar `core/` **o `database.rules.json`**, ejecutarlas.

Ojo con el navegador: los módulos ES se cachean con ganas, y un cambio en `core/` puede no verse al
recargar. Si un resultado no cuadra con lo que acabas de editar, sirve en un puerto distinto —origen
nuevo, caché vacía— antes de dar por buena la prueba.

### Comprobación manual en el navegador

El CI (`.github/workflows/verificacion.yml`) ejecuta esas dos cosas en cada PR. No hay linter, y el
resto se comprueba a mano:

1. `python -m http.server 8000` → `http://localhost:8000/`.
2. Consola del navegador **en silencio**. Un arranque correcto no imprime nada: lo que aparezca
   ahí es un `warn` o un `error` de verdad, y hay que mirarlo.
3. Recorrer las cuatro vistas:
   - **Dashboard**: KPIs, titulares ejecutivos, barras de prioridad y palanca, y los 3 radares.
   - **Assessment**: cambiar un score y comprobar que se recalculan nivel, gap, prioridad y oleada,
     **sin perder el foco ni cerrar los paneles de detalle abiertos**.
   - **Heatmap**: desplegar y plegar capacidades.
   - **Roadmap**: comprobar que respeta los filtros activos.
4. Con un filtro puesto, comprobar que **KPIs, tabla, radares, heatmap, roadmap, CSV y PDF dan el
   mismo recuento**.
5. Cambiar de dominio y confirmar que los datos se recargan.
6. Recargar la página y confirmar que el escenario persiste.
7. Si se ha tocado el flujo compartido: probar con `?scenario=<id-de-prueba>` (el README documenta
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
