# Seguridad

Qué protege esta herramienta, qué no protege, y qué hacer cuando algo se tuerce.

Está escrito para que se pueda leer entero antes de una reunión. Si algo aquí suena a promesa, es
un error: lo que no se pueda sostener con el código delante no debería estar en este documento.

---

## Lo primero, porque condiciona todo lo demás

**El enlace es la credencial.** Cualquier persona que tenga el `?scenario=<id>` puede leer y
escribir el escenario entero. No hay usuarios, no hay permisos por persona, no hay forma de
revocarle el acceso a alguien en concreto.

Es una decisión de diseño, no un descuido: el escenario lo abren tanto consultores de Deloitte como
personas del cliente, y exigir identidad corporativa dejaría fuera a la mitad. Pero hay que tenerla
presente, porque de ella se derivan casi todas las limitaciones de la sección "Lo que no protege".

**Trata el enlace como una contraseña.** No lo pegues en un ticket, en un repositorio ni en un
documento compartido. Si se filtra, hay procedimiento (ver *Rotar y borrar*).

---

## Lo que protege

**Acceso a la base de datos.** Las reglas de `database.rules.json` exigen `auth != null` y validan
**campo a campo**: cada nivel declara los campos que admite, con su tipo y su longitud máxima, y un
cerrojo `$otro...: false` rechaza cualquier campo no declarado. Los dominios están limitados a los
nueve del catálogo y los estados a los cuatro que ofrece la herramienta. Los scores solo aceptan de
1 a 5.

**Identificadores impredecibles.** Los genera `crypto.randomUUID()` en el navegador y
`secrets.token_hex(16)` al rotar — 128 bits en ambos casos, nunca `Math.random`. El identificador
**no se enseña entero** en ninguna parte: ni en pantalla ni en la portada del PDF, que es un
documento que se envía al cliente. Solo se muestran los cuatro últimos caracteres.

**Inyección de HTML.** Todo lo que un usuario escribe —responsable, comentarios, nombre de quien
edita, texto de búsqueda— pasa por `escapeHtml`/`escapeAttr` de `core/presentacion.js` antes de
llegar al DOM o al informe. Los selectores dinámicos usan `CSS.escape`. No hay `eval`, ni
`new Function`, ni `insertAdjacentHTML`, ni `setTimeout` con cadena.

**Content Security Policy.** `index.html` declara una política estrecha. Lo importante es que
`script-src` **no** lleva `'unsafe-inline'`: no hay ni un script en línea ni un manejador `onclick`
en el HTML, así que no hace falta. `connect-src` limita a dónde puede hablar la página: Firebase y
nada más.

**Sin dependencias de terceros en ejecución, salvo Firebase.** Chart.js se sirve desde `vendor/` en
este repositorio, con su SHA-384 documentado y verificado contra tres CDN independientes. Solo el
SDK de Firebase viene de fuera (`gstatic.com`), fijado a la versión 12.15.0.

**Nada se pierde en silencio.** El indicador de guardado tiene un estado de error real, y ningún
`catch` termina en un mensaje de éxito. Si falla la conexión, la identidad o la librería de
gráficos, se dice. La copia local es **por escenario**, así que no puede aparecer el trabajo de un
cliente bajo el enlace de otro.

**Verificación automática.** Cada pull request ejecuta las pruebas de las reglas de negocio y del
contrato de escenario, incluida una que comprueba que `core/escenario.js` sigue siendo el espejo
exacto de `database.rules.json`. Si los dos dejan de decir lo mismo, el CI se pone rojo antes de
fusionar, no en la siguiente sesión con cliente.

---

## Lo que NO protege

Esta sección es la que importa cuando alguien pregunta "¿es seguro?".

**No hay control de acceso.** Quien tenga el enlace lo tiene todo: leer, escribir, borrar contenido.
No hay roles, ni lectura sin escritura, ni caducidad.

**`auth != null` no es control de acceso.** La autenticación es **anónima y abierta**: cualquiera
puede obtener un uid pidiéndolo. Lo que aporta es atribución, trazabilidad y una barrera frente a
quien quisiera leer la base con `curl` sin cargar la aplicación. No decide quién entra.

**La autoría es falsificable.** Las reglas no comprueban que el `uid` de `lastEditedBy` coincida con
el de quien escribe. La columna "Último cambio" sirve para coordinarse dentro del equipo, **no como
registro de auditoría**.

**No hay auditoría.** Solo se guarda quién tocó cada subcapacidad la última vez. No hay historial,
ni quién leyó qué, ni cuándo.

**No hay revocación selectiva.** La única forma de quitarle el acceso a alguien es rotar el
escenario a un enlace nuevo y borrar el viejo — lo que se lo quita a todo el mundo a la vez.

**No hay protección contra clickjacking.** Haría falta `frame-ancestors` o `X-Frame-Options`, y
GitHub Pages no permite enviar cabeceras HTTP; en una etiqueta `<meta>`, `frame-ancestors` se
ignora. Se asume: la herramienta no usa cookies ni sesión, y todas las acciones destructivas piden
confirmación escrita.

**El cifrado en reposo no está bajo control de Deloitte.** Es el de Google Cloud.

**El repositorio es público.** El código, las reglas y la configuración de Firebase están a la
vista. La configuración de Firebase (`apiKey`, `databaseURL`…) es pública por diseño en una web app
y no constituye un secreto filtrado: la autorización la dan las reglas, no el secreto de la clave.
Aun así, **hacer el repositorio privado es la medida pendiente más recomendable**. Aviso operativo:
servir GitHub Pages desde un repositorio privado requiere GitHub Enterprise Cloud. Si la
organización no lo tiene, **hacerlo privado tumba el sitio**. Confirmarlo antes.

**El repositorio no puede garantizar qué reglas están desplegadas.** `database.rules.json` es lo que
*debería* estar publicado. Que lo esté se comprueba en la consola de Firebase, y no hay forma de
automatizarlo desde aquí. **Si las reglas activas fueran las permisivas, todo lo de la sección
anterior sobre acceso a la base no aplica.**

---

## Qué datos se guardan y dónde

Por subcapacidad: puntuaciones de las tres palancas, objetivo, responsable (`owner`), estado,
**comentario libre de hasta 2.000 caracteres**, y la marca de quién hizo el último cambio (uid
anónimo, nombre elegido por la propia persona y fecha).

Conviene decir en voz alta lo del comentario libre: es un campo de texto de 2.000 caracteres donde
puede acabar cualquier cosa del cliente. Es el dato más sensible de la herramienta, y sale también
en el informe PDF que se entrega.

**Dónde vive:**

| | |
|---|---|
| Base de datos | Firebase Realtime Database, proyecto `fpa-assessment-mvp`, región `europe-west1` (UE) |
| Copia local | `localStorage` del navegador, una clave por escenario |
| Copias de borrado | `copias/` en la máquina de quien ejecute `delete_scenario.py`. Está en el `.gitignore` |

**No se guarda** el nombre de la organización cliente en ningún campo: los `meta` de cada dominio
solo llevan metadatos de la metodología. La identificación del cliente vive en el enlace, en el
nombre del archivo exportado y, si alguien lo escribe, en los comentarios libres.

**No hay política de retención.** Los escenarios viven en Firebase indefinidamente hasta que alguien
los borra a mano. Si la organización tiene una obligación de retención o de borrado para datos de
taller con cliente, hoy no se está cumpliendo automáticamente.

---

## Procedimientos

### Si se filtra un enlace

```powershell
python scripts/rotate_scenario.py <id-antiguo>              # muestra qué haría
python scripts/rotate_scenario.py <id-antiguo> --confirm    # copia a un id nuevo
python scripts/delete_scenario.py <id-antiguo> --confirm    # copia local y borra
```

Rotar **antes** de borrar, y borrar solo cuando todo el mundo esté en el enlace nuevo y haya cerrado
el viejo: la aplicación recrea un escenario que no existe, así que una pestaña abierta lo resucita.

### Antes de cambiar las reglas

```powershell
python scripts/audit_scenarios.py <export-de-la-consola.json>
```

Lee `database.rules.json` de la rama en la que estés y dice si esas reglas rechazarían datos que ya
están escritos. Exporta la base desde Firebase Console → Realtime Database → ⋮ → *Exportar JSON*.

### Orden de despliegue, y cuánto tarda revertir

El orden importa porque un rechazo de las reglas tumba la escritura entera, no solo el campo que
sobra.

1. **Auditar** los datos existentes.
2. **Desplegar el código**, con las reglas todavía permisivas. La aplicación es entonces más
   estricta que el servidor, y la vuelta atrás es un despliegue y no una urgencia.
3. **Observar unos días.** Si aparece el chip rojo por identidad en alguna red de cliente, publicar
   las reglas dejaría a esa persona sin escribir.
4. **Probar en el simulador** de reglas de la consola, que valida una escritura sin publicar nada.
5. **Publicar las reglas**, fuera de horario de sesión.

Anonymous Auth tiene que estar habilitado en Firebase → *Authentication* → *Sign-in method* antes de
publicar las reglas. Si no, nadie obtiene identidad y nadie puede escribir.

| Qué se revierte | Cuánto tarda |
|---|---|
| Reglas de Firebase | ~30 segundos, desde el historial de versiones de la consola |
| `index.html` (CSP incluida) | Hasta ~10 minutos, por la caché de GitHub Pages |
| `app.js` | Un despliegue, **subiendo el `?v=`** de la etiqueta `<script>` |

---

## Decisiones, y por qué

**Por qué no hay SSO corporativo.** Personas del cliente también abren los enlaces. Restringir a
cuentas de Deloitte las dejaría fuera.

**Por qué Chart.js está en el repositorio.** El riesgo que importa no es que la CDN sirva un archivo
manipulado, sino que la red del cliente la bloquee: entonces no había radares y el PDF salía con
tres recuadros en blanco, sin aviso. Un `integrity=` no cubre ese caso.

**Por qué `'unsafe-inline'` en `style-src`.** El informe PDF inyecta su hoja de estilos en línea y
las barras se pintan con `style="width:X%"`, cuyo valor sale de los datos: un nonce no cubre
atributos `style` y un hash es imposible con valores variables. Sin ello el informe se imprime sin
estilos. El valor de la política está en `script-src` y `connect-src`.

**Por qué no hay `frame-ancestors` ni framebuster.** En `<meta>` la directiva se ignora *y* el
navegador imprime una advertencia en consola en cada carga, lo que rompería el "la consola arranca
en silencio" del que depende toda la verificación manual. Un framebuster en JavaScript sería un
script en línea, y obligaría a debilitar `script-src` —la única directiva que aquí aporta de
verdad— para mitigar un riesgo casi nulo.

**Por qué la autoría no está atada a `auth.uid`.** Atarla rompería crear escenarios e importar: las
escrituras completas envían las marcas de autoría de otras personas. Arreglarlo exigiría descartar
la autoría ajena al importar, con lo que reimportar perdería la atribución de los demás. Lo que
compra es impedir que un compañero falsifique una firma; quien viene de fuera con el enlace ya tiene
escritura completa. No compensa.

**Por qué los scripts usan un token anónimo y no una credencial de administrador.** Así obtienen
exactamente los mismos privilegios que cualquiera con el enlace, ni uno más. No hay ningún secreto
nuevo que guardar ni ninguna puerta trasera en un repositorio público.

---

## Cómo comunicar un problema

Si encuentras un fallo de seguridad, díselo al equipo que mantiene la herramienta antes de abrir una
incidencia pública: el repositorio es público y una incidencia es un aviso para todo el mundo.
