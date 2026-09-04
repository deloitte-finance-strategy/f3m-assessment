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

> **El enlace es la credencial.** Cualquier persona que lo tenga puede ver y editar el escenario,
> sin autenticación. Trátalo como una contraseña: no lo publiques en repositorios, documentos
> compartidos ni tickets. No inventes identificadores a mano — un ID adivinable expone el
> assessment completo a cualquiera.
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

Si la autenticación no está disponible, la herramienta sigue funcionando sin atribución. Se
prefiere perder la trazabilidad a que deje de guardarse.

> **Orden de despliegue.** Las escrituras son atómicas: si las reglas rechazan el campo de autoría,
> falla también el dato que lo acompaña, y el guardado deja de funcionar sin que se note.
> Por eso hay que hacerlo en este orden:
>
> 1. Publicar `database.rules.json` (ya incluye `lastEditedBy`).
> 2. Habilitar *Anonymous* en Firebase → *Authentication* → *Sign-in method*.
> 3. Desplegar el código.
>
> Al revés, cada guardado se rechazaría con `Permission denied`.

Cuando todo el equipo use la versión nueva, se puede exigir autenticación en las reglas cambiando
las dos líneas de `$scenarioId`:

```json
".read": "auth != null && $scenarioId.length >= 20",
".write": "auth != null && $scenarioId.length >= 20"
```

No hacerlo antes: quien siga con la versión anterior dejaría de poder leer y escribir.

### Rotar un escenario expuesto

Si un identificador se ha filtrado (por ejemplo, publicado en un repositorio o en un correo),
hay que rotarlo a uno nuevo e impredecible:

```powershell
python scripts/rotate_scenario.py <id-antiguo>              # muestra qué haría
python scripts/rotate_scenario.py <id-antiguo> --confirm    # copia y verifica
```

El script copia el contenido a un id aleatorio de 128 bits y comprueba que la copia es idéntica.
No borra el original: eso se hace a mano desde la consola de Firebase, una vez confirmado que el
enlace nuevo funciona.