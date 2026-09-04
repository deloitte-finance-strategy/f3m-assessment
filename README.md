# F3M Assessment

Herramienta de diagnóstico de madurez financiera según la metodología F3M. Cubre 9 dominios
(FP&A, Controlling, Transacciones, Finanzas de negocio, Auditoría Interna, Finanzas Estratégicas,
Relación con Inversores, Tesorería y Fiscal), generados a partir de los Excel `F3M_*.xlsx` de la
raíz del repositorio.

## Cómo ejecutarlo

1. Abre una terminal en esta carpeta.
2. Lanza un servidor local:

   ```powershell
   python -m http.server 8000
   ```

3. Abre en el navegador:

   ```text
   http://localhost:8000/
   ```

Si `python` no está disponible en tu equipo, puedes usar cualquier servidor estático equivalente. El navegador necesita servir la carpeta para poder leer los JSON de `data/domains/`.

## Qué permite hacer

- Editar scores de Procesos, Tecnología y Organización para cada subcapacidad.
- Calcular automáticamente score medio, nivel resultante, gap vs objetivo y prioridad.
- Consultar resumen ejecutivo por dominio y por capacidad.
- Ver heatmap por subcapacidad y palanca.
- Revisar roadmap ordenado por prioridad y gap.
- Guardar una copia del trabajo en un archivo y volver a abrirla más adelante, desde el menú
  **Escenario** de la cabecera.
- Exportar resumen y roadmap en CSV, y un informe completo en PDF.

## Reglas de cálculo

- Objetivo de madurez: configurable **por capacidad y por palanca** desde el panel de objetivos.
  `4 - Optimizado` es solo el valor por defecto cuando una capacidad no tiene objetivo propio.
- Score medio: promedio de los scores informados en Procesos, Tecnología y Organización, redondeado a 2 decimales.
- Nivel resultante:
  - `< 1.5`: `1 - Inicial`
  - `< 2.5`: `2 - Estructurado`
  - `< 3.5`: `3 - Estandarizado`
  - `< 4.5`: `4 - Optimizado`
  - `>= 4.5`: `5 - Avanzado/Referente`
- Gap: se calcula **por palanca** como `max(0, objetivo - score)`, y el gap de la subcapacidad es el
  **promedio de los gaps de las palancas puntuadas**.

  No es `max(0, 4 - score medio)`. Las dos fórmulas divergen en cuanto alguna palanca supera su
  objetivo: ese exceso se recorta a `0` en vez de compensar a las demás. Ejemplo real con objetivo
  `4` y scores `[3, 2, 5]` → gap `1.0`, no `0.67`. Como el gap determina prioridad y oleada, la
  diferencia se propaga al roadmap.
- Prioridad:
  - `Alta` si gap `>= 2`
  - `Media` si gap `>= 1`
  - `Baja` si gap `< 1`
- Oleada:
  - `Alta`: `Oleada 1`
  - `Media`: `Oleada 2`
  - `Baja`: `Oleada 3`

Las subcapacidades sin puntuación se muestran como `Pendiente`, sin prioridad ni oleada artificial.

## Notas

- No se han creado nuevas capacidades, subcapacidades ni iniciativas.
- Las iniciativas sugeridas proceden del Excel y no se generan con IA.
- La app extiende a las 152 subcapacidades de los 9 dominios la lógica de cálculo que en el Excel inicial solo estaba aplicada completamente a la primera fila de `Assessment`.

## Regenerar los datos desde los Excel

Los archivos `data/domains/*.json` se generan desde los `F3M_*.xlsx`. Requiere `openpyxl`:

```powershell
python scripts/convert_domains.py       # regenera los JSON
python scripts/check_domains_sync.py    # verifica el catálogo y los JSON
```

`check_domains_sync.py` no escribe nada: compara en memoria y devuelve código de salida `1` si el
catálogo de dominios está incompleto o si algún JSON commiteado ha quedado desincronizado de su
Excel.

La lista de dominios vive en **`data/domains.json`**, que es la fuente única: de ahí la leen tanto
el script de conversión como la aplicación. Añadir un dominio es añadir una entrada ahí y volver a
ejecutar los dos comandos de arriba.

## Pruebas

Las reglas de cálculo y el contrato de los escenarios se prueban sin instalar nada:

- **En el navegador**: con el servidor en marcha, abre `http://localhost:8000/tests/`.
- **Desde la línea de comandos**, si tienes Node: `node tests/ejecutar.mjs`.

Los dos ejecutan los mismos casos y cubren gap, prioridad, oleada, nivel de madurez,
subcapacidades pendientes, agregación por capacidad y lo que se acepta o se rechaza al importar un
escenario. También comprueban que `core/escenario.js` siga siendo el espejo exacto de
`database.rules.json`: si uno cambia y el otro no, Firebase rechazaría el guardado entero en la
siguiente sesión, y eso ahora se detecta antes de fusionar.

Se ejecutan solas en cada pull request, en `.github/workflows/verificacion.yml`, junto a
`scripts/check_domains_sync.py`.


## Uso online

La herramienta está publicada con GitHub Pages, desde la rama `main` de este mismo repositorio.
Cada vez que se fusiona algo en `main`, la URL se actualiza sola:

https://deloitte-finance-strategy.github.io/f3m-assessment/

### Escenarios compartidos

Para crear uno, usa **Escenario → "Crear escenario compartido"** en la cabecera. Genera un
identificador aleatorio de 128 bits y te lleva a la URL correspondiente:

```text
https://deloitte-finance-strategy.github.io/f3m-assessment/?scenario=<id-generado>
```

> **El enlace es la credencial.** Cualquier persona que lo tenga puede ver y editar el escenario.
> Trátalo como una contraseña: no lo publiques en repositorios, documentos compartidos ni tickets.
> No inventes identificadores a mano — un ID adivinable expone el assessment completo a cualquiera.
>
> Las reglas exigen autenticación, pero es **anónima y abierta**: eso da atribución y frena a quien
> quisiera leer la base sin cargar la aplicación, no controla quién entra. **[SECURITY.md](SECURITY.md)
> explica en detalle qué protege la herramienta y qué no.**
>
> Por eso la herramienta no lo enseña entero: ni en pantalla ni en la portada del PDF, que es un
> documento que se envía al cliente. Para obtener el enlace completo, **Escenario → "Copiar
> enlace"**.

### Escenario de pruebas

Para probar cambios sin tocar escenarios reales:

```text
?scenario=f3m-d56e5e41-954f-4cc7-9014-82e7ee65bd83
```

Este identificador sí está publicado a propósito: contiene únicamente los datos base de
`data/domains/*.json`, sin información de ningún cliente. Precisamente por eso **no debe usarse
nunca para trabajo real** — cualquiera puede leerlo y sobrescribirlo.

### Identidad de quien edita

En un escenario compartido la app se autentica de forma anónima contra Firebase: no pide
credenciales, pero asigna un identificador estable a cada navegador. Sirve para atribuir cada
cambio, con **Escenario → "Poner mi nombre"** para elegir cómo apareces ante el resto.
La columna **"Último cambio"** del Roadmap muestra quién tocó cada subcapacidad por última vez.

**La identidad es obligatoria para escribir.** Sin ella, la aplicación no intenta guardar en el
escenario compartido: el chip se pone rojo y dice *"Sin identidad: no se está compartiendo"*. Los
cambios siguen guardados en el navegador y no se pierden. Antes se guardaba sin atribución, pero eso
deja de ser posible en cuanto las reglas exigen `auth != null`, y un rechazo del servidor llega
disfrazado de fallo de red: es mejor decir la verdad desde el principio.

### Desplegar el endurecimiento de las reglas

`database.rules.json` ya incluye `auth != null`, la lista cerrada de dominios y la de estados. **El
repositorio no despliega reglas**: eso se hace a mano en la consola, y el orden importa.

1. **Comprobar los datos que ya existen.** Exportar la base y pasarla por
   `python scripts/audit_scenarios.py <export>`. Si sale algo, corregirlo o relajar la regla antes
   de seguir.
2. **Desplegar el código primero, las reglas después.** Mientras las reglas sigan siendo permisivas,
   la aplicación es más estricta que el servidor y la vuelta atrás es un despliegue, no una urgencia.
3. **Observar unos días.** Si en alguna red de cliente aparece el chip rojo por identidad, publicar
   las reglas dejaría a esa persona sin escribir. Es la señal que hay que esperar.
4. **Probar las reglas en el simulador** de Firebase Console → Realtime Database → Reglas, que
   permite validar una escritura sin publicar nada. Comprobar como mínimo: un `status` válido y uno
   inválido, un dominio del catálogo y uno inventado, un id de escenario con el formato correcto, y
   una escritura completa del escenario de pruebas. **El regex de `$scenarioId` es lo que hay que
   mirar con más cuidado**: si `matches()` no se comportara como se espera, la regla falla cerrada y
   nadie podría leer ni escribir.
5. **Publicar las reglas** fuera de horario de sesión. La consola guarda el historial de versiones,
   así que revertir es un clic.

> **Anonymous Auth tiene que estar habilitado** en Firebase → *Authentication* → *Sign-in method*
> antes de publicar las reglas. Si no, nadie obtiene identidad y nadie puede escribir.

Conviene ser claro sobre qué compra `auth != null` y qué no. La autenticación es **anónima y
abierta**: cualquiera puede obtener un uid. Lo que aporta es atribución, trazabilidad y una barrera
frente a quien lea la base con `curl` sin siquiera cargar la aplicación. **No es control de acceso**:
quien tenga el enlace sigue pudiendo leer y escribir el escenario entero.

### Rotar un escenario expuesto

Si un identificador se ha filtrado (por ejemplo, publicado en un repositorio o en un correo),
hay que rotarlo a uno nuevo e impredecible:

```powershell
python scripts/rotate_scenario.py <id-antiguo>              # muestra qué haría
python scripts/rotate_scenario.py <id-antiguo> --confirm    # copia y verifica
```

El script copia el contenido a un id aleatorio de 128 bits y comprueba que la copia es idéntica.
No borra el original: para eso está el script siguiente.

### Borrar un escenario

```powershell
python scripts/delete_scenario.py <id>              # muestra qué haría
python scripts/delete_scenario.py <id> --confirm    # guarda copia y borra
```

Guarda una copia verificada en `copias/<id>-<fecha>.json` antes de borrar, y si la copia no coincide
no borra nada. `copias/` está en el `.gitignore` a propósito: son datos reales de cliente y este
repositorio es público.

> **Un escenario borrado puede resucitar.** Si alguien tiene la pestaña abierta con ese enlace, la
> aplicación lo recrea en cuanto recargue o toque algo. El orden correcto es rotar primero,
> confirmar que todo el mundo está en el enlace nuevo y ha cerrado el viejo, y borrar después.

### Los scripts y la autenticación

Con `auth != null` en las reglas, los tres scripts que hablan con la base necesitan un token. Lo
piden solos: uno **anónimo**, el mismo que obtiene cualquier navegador que abra la aplicación, así
que acaban con exactamente los mismos privilegios que cualquiera con el enlace. No hace falta
ninguna credencial de administrador, y por tanto no hay ningún secreto nuevo que guardar.

- `--token <idToken>` reutiliza uno en vez de crear otro usuario anónimo.
- `--sin-auth` no autentica. Sirve mientras las reglas no exijan `auth != null`, y para diagnosticar:
  si un script funciona con este flag y falla sin él, el problema es la autenticación y no la base.

### Antes de cambiar las reglas de Firebase

Unas reglas más estrictas pueden rechazar datos que ya están escritos. Para saberlo **antes** de
publicarlas, exporta la base desde Firebase Console → Realtime Database → ⋮ → *Exportar JSON* y
pásale el archivo a:

```powershell
python scripts/audit_scenarios.py <export-de-la-consola.json>
```

Lee `database.rules.json` de la rama en la que estés, así que sirve tal cual para probar reglas
candidatas: las cambias, lo ejecutas, y te dice qué se rompería. Sale con código `1` si encuentra
algo.

Se usa un export y no la API REST porque las reglas no permiten leer `/scenarios` entero, y meter
una credencial de administrador en un repositorio público para esquivarlo sería peor que el problema
que resuelve.