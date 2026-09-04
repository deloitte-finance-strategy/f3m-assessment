# vendor/

Dependencias de terceros que se sirven desde este repositorio en vez de desde un CDN.

**Esta carpeta se versiona.** No la añadas al `.gitignore` por reflejo al ver que contiene un
archivo minificado: si no está, la aplicación se queda sin gráficos.

## `chart.umd.min.js`

| | |
|---|---|
| Librería | [Chart.js](https://www.chartjs.org) |
| Versión | 4.5.0 |
| Licencia | MIT |
| Tamaño | 208.341 bytes |
| SHA-384 | `sha384-XcdcwHqIPULERb2yDEM4R0XaQKU3YnDsrTmjACBZyfdVVqjh6xQ4/DCMd7XLcA6Y` |
| Origen | `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js` |

Se usa para los tres radares por capacidad del Dashboard, que son también los que se incrustan en
el informe PDF que se entrega al cliente.

### Por qué está aquí y no en un CDN

Antes se cargaba desde cdnjs. El problema no era la integridad —que Cloudflare sirva un archivo
manipulado es remoto— sino la **disponibilidad**: muchas redes corporativas filtran los CDN de
terceros por categoría, y la red del cliente es precisamente donde se usa esta herramienta. Cuando
el archivo no cargaba no había radares, y el PDF salía con tres recuadros en blanco.

Un `integrity="sha384-..."` no arregla ese caso: protege contra un archivo distinto, pero ante un
bloqueo —o ante un proxy que reescriba un solo byte— el resultado es el mismo, el script no se
ejecuta. Servido desde el mismo origen que la aplicación, si carga la aplicación cargan los
gráficos.

De paso permite una `script-src` más estricta en la CSP y quita un destino externo al que el
navegador enviaría la URL de la página en la cabecera `Referer` — y esa URL lleva el
`?scenario=<id>`, que es la credencial del escenario.

El coste es explícito y asumido: 204 KB de binario en el repositorio y una actualización manual.

### Cómo actualizarlo

1. Descargar la versión nueva de cdnjs:

   ```powershell
   curl -o vendor/chart.umd.min.js https://cdnjs.cloudflare.com/ajax/libs/Chart.js/<version>/chart.umd.min.js
   ```

2. Verificar que el hash coincide con el que publica cdnjs para esa versión. Desde la consola del
   navegador, en cualquier página, contrastando además contra otro CDN del mismo paquete npm:

   ```js
   const h = async (u) => {
     const b = await (await fetch(u)).arrayBuffer();
     const d = await crypto.subtle.digest("SHA-384", b);
     return "sha384-" + btoa(String.fromCharCode(...new Uint8Array(d)));
   };
   await h("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/<version>/chart.umd.min.js");
   await h("https://cdn.jsdelivr.net/npm/chart.js@<version>/dist/chart.umd.min.js");
   ```

   Los dos tienen que dar lo mismo. Si no coinciden, parar y averiguar por qué antes de commitear.

3. Actualizar la tabla de arriba: versión, tamaño y hash.

4. Subir el `?v=` de la etiqueta `<script>` en `index.html`. GitHub Pages cachea cada archivo por
   separado, y sin eso hay navegadores que seguirán con la versión anterior.

5. Comprobar a mano, con el servidor en marcha: los tres radares del Dashboard se pintan, y el
   informe PDF los lleva. Chart.js no avisa de una API rota, simplemente deja de dibujar.
