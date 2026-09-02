# CLAUDE.md

Guía de trabajo para Claude Code en este repositorio.

## Qué es

App web de diagnóstico de madurez financiera según la metodología F3M. Puntúa las subcapacidades de
9 dominios financieros en tres palancas (Procesos, Tecnología, Organización) y genera dashboard,
heatmap y roadmap priorizado.

## Cómo ejecutarlo

```powershell
python -m http.server 8000
# abrir http://localhost:8000/
```

**Hace falta un servidor.** `app.js` se carga como módulo ES y hace `fetch()` de los JSON de datos,
así que abrir `index.html` con `file://` falla por CORS. El propio código avisa de esto en el
mensaje de error de `app.js:407`.

**No hay `npm install`, ni build, ni watch, ni `package.json`.** Se edita el archivo y se recarga el
navegador. Cualquier servidor estático equivalente sirve.

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | Maquetación completa, `<template>` de la tarjeta de assessment, modales de criterios F3M e iniciativa IA |
| `app.js` | Toda la lógica — 4.659 líneas en un solo archivo, sin módulos internos |
| `styles.css` | Estilos |
| `data/domains/*.json` | Datos del assessment, un archivo por dominio |

Flujo de arranque:
`init()` (`app.js:386`) → `loadCoreDomains()` → `loadDomainData()` → `initializeSharedScenario()`
→ `renderAll()`.

Dependencias externas por CDN, sin bundler:
- **Chart.js 4.5.0** desde cdnjs (`index.html:554`) — radares por capacidad.
- **Firebase Realtime Database 12.15.0** importado desde `gstatic.com` (`app.js:1-9`).

### Código muerto — no dejarse engañar

`DATA_URL = "data/fpa_assessment.json"` (`app.js:39`) y el archivo `data/fpa_assessment.json` son
restos de la versión anterior, cuando solo existía el dominio FP&A. **No se usan.** Los datos reales
salen de `DOMAINS[].dataUrl` → `data/domains/*.json`.

## Reglas de negocio F3M

> **El README está desactualizado en esta sección.** Describe un objetivo de madurez fijo de `4` y
> un gap calculado como `4 - scoreMedio`. Eso ya no es así. La fuente de verdad es el código, que se
> resume a continuación.

**Tres palancas** (`LEVERS`, `app.js:119`), con colores de marca Deloitte:
Procesos `#86BC25` · Tecnología `#ED8B00` · Organización `#012169`.

**Objetivo de madurez**: configurable **por capacidad y por palanca**, vía `getCapabilityTargets()`
(`app.js:703`). `DEFAULT_TARGET_MATURITY = 4` es solo el valor por defecto cuando una capacidad no
tiene objetivo propio, no una constante fija del modelo.

**Cálculo** (`calculate()`, `app.js:763`):
- El gap se calcula **por palanca**: `max(0, target - score)`.
- El gap del ítem es el **promedio de los gaps de las palancas puntuadas**. No es `4 - scoreMedio`.
- Solo entran en los promedios las palancas **con score informado**.
- Si no hay ninguna palanca puntuada, el ítem queda `isPending: true`, con prioridad y oleada
  `"Pendiente"`. No se inventan valores para lo no evaluado.

**Nivel resultante** (`getMaturityLevel()`, `app.js:856`), a partir del score medio:

| Score | Nivel |
|---|---|
| `< 1.5` | 1 - Inicial |
| `< 2.5` | 2 - Estructurado |
| `< 3.5` | 3 - Estandarizado |
| `< 4.5` | 4 - Optimizado |
| `>= 4.5` | 5 - Avanzado/Referente |

**Prioridad** (`priorityFromGap()`, `app.js:2630`): gap `>= 2` → Alta · `>= 1` → Media · resto → Baja.

**Oleada**: Alta → Oleada 1 · Media → Oleada 2 · Baja → Oleada 3.

## Persistencia y escenarios compartidos

- **Local**: `localStorage`, clave `f3m-fpa-assessment-scenario` (`STORAGE_KEY`, `app.js:116`).
- **Compartido**: parámetro de URL `?scenario=<id>`. Lee y escribe en `scenarios/<id>` de la
  Realtime Database. El id se valida contra `/^[a-zA-Z0-9_-]{6,120}$/` (`app.js:4625`) para evitar
  rutas raras en Firebase.

Al tocar el flujo de guardado, tener en cuenta:
- Todo lo que va a Firebase pasa por `sanitizeScenarioForFirebase()` (`app.js:661`) y
  `toFirebaseSafeKey()` (`app.js:512`), porque las claves de Firebase no admiten `.` `$` `#` `[` `]` `/`.
- El flag `isApplyingRemoteScenario` (`app.js:214`) evita que un cambio recibido de Firebase se
  vuelva a escribir en Firebase. **No eliminarlo** al refactorizar el guardado.

### Aviso de seguridad — Firebase

La configuración de Firebase está en claro en `app.js:12-22` (`apiKey`, `databaseURL`, `projectId`…).
En una web app de Firebase esto es **público por diseño** y no constituye un secreto filtrado.

Pero la protección real no está en el código: depende de las **reglas de seguridad de la Realtime
Database, que no viven en este repositorio**. Si están abiertas, cualquiera con la URL de la base
—que está en el código público— puede leer y escribir todos los escenarios. Conviene verificarlo en
la consola de Firebase. No es algo que se arregle tocando este repo.

## Datos: flujo Excel → JSON

Los 9 archivos `F3M_*.xlsx` de la raíz son la fuente desde la que se generan los JSON de datos.
`scripts/convert_domains.py` lee la hoja `Assessment` (y la hoja opcional `AI Overlay`) de cada uno y
escribe `data/domains/*.json`:

```powershell
python scripts/convert_domains.py   # requiere openpyxl
```

Consecuencia práctica: si se editan los JSON a mano, la siguiente ejecución del script sobrescribe
esos cambios.

La lista de dominios está **duplicada** en `FILES` (dentro del script) y en `DOMAINS` (`app.js:47`).

## Añadir un dominio nuevo

Hay que tocar **tres sitios** que no están conectados entre sí:

1. `scripts/convert_domains.py` → nueva entrada en `FILES` (`domain_id`, `domain_label`,
   `domain_title`, `source`, `output`).
2. `app.js:47` → nueva entrada en `DOMAINS` con `id`, `label`, `title`, `group`, `dataUrl`.
3. `index.html:89-137` → nuevo `<button class="domain-button" data-domain-id="...">` dentro del
   `.domain-group` correspondiente.

Los tres `group` válidos son: `Transaccionales y operativos`, `Técnicos y especializados`,
`Estratégicos y de negocio`.

## Convenciones

- Trabajo en ramas `feature/<tema>`, PR contra `main` (siguiendo las ramas existentes:
  `feature/auditoria-interna`, `feature/objetivos-por-capacidad`, …).

## Verificación

**No hay tests, ni linter, ni CI.** La comprobación es manual en el navegador:

1. `python -m http.server 8000` → `http://localhost:8000/`.
2. Consola del navegador sin errores (al arrancar debe aparecer el log de conexión a Firebase).
3. Recorrer las cuatro pestañas:
   - **Dashboard**: KPIs, barras de prioridad y palanca, y los 3 radares por capacidad.
   - **Assessment**: cambiar un score y comprobar que se recalculan nivel, gap, prioridad y oleada.
   - **Heatmap**: desplegar y plegar capacidades.
   - **Roadmap**: comprobar que respeta los filtros activos.
4. Cambiar de dominio con los botones y confirmar que los datos se recargan.
5. Recargar la página y confirmar que el escenario persiste.
6. Si se ha tocado el flujo compartido: probar con `?scenario=<id-de-prueba>`.
