# biblioteca/

Los documentos de los que salen los casos de uso de IA. La herramienta los enseña en la pestaña
**IA** y los abre, en la página de cada caso, desde **«Más información»**.

**Esta carpeta es pública**, como el repositorio y la web que se publica desde él: cualquiera que
tenga la dirección puede descargar lo que haya aquí. Los dos documentos de ahora se subieron
sabiendo que el repositorio es público. Antes de añadir otro, comprobar que se puede compartir
fuera de Deloitte.

## Lo que hay

| Archivo | Qué es | Unidad |
|---|---|---|
| `the-ai-dossier.pdf` | *The AI Dossier*, del Deloitte AI Institute, octubre de 2025. El original se llamaba «Full PDF Report - The AI Dossier - 80+ AI use cases.pdf» | 190 páginas |
| `financeai-use-cases-summary.pptx` | *FinanceAI Use Case Overview*, junio de 2024. El original, «FinanceAI - Use Cases Summary_C.pptx». Es lo que se descarga | 19 diapositivas |
| `financeai-use-cases-summary.pdf` | El mismo PowerPoint exportado a PDF. Es lo que se ve dentro de la herramienta | 19 diapositivas |

Los nombres van en minúsculas, sin espacios ni acentos. La ruta acaba en el `src` de un iframe, y
`core/biblioteca.js` y el CI rechazan cualquier carácter que no sea una letra sin acento, una cifra,
un punto, un guion o un guion bajo. Al descargar, el archivo recupera su nombre original, que está
en `nombreDeDescarga`, en `data/biblioteca.json`.

## Por qué el PowerPoint lleva un PDF al lado

Un navegador no sabe enseñar un `.pptx`, y un PDF sí, y además en una página concreta
(`the-ai-dossier.pdf#page=123`). Así que dentro de la herramienta se ve el PDF, con una página por
diapositiva, y lo que se descarga es el original, que es lo que el consultor querrá reutilizar.

**El PDF de ahora está exportado con LibreOffice**, no con PowerPoint, porque se generó en un
equipo sin Office. Se ve bien salvo en un detalle: **la tabla de la diapositiva 4 se corta por
abajo**. Conviene sustituirlo por la exportación del propio PowerPoint:

1. Abrir `financeai-use-cases-summary.pptx` en PowerPoint.
2. **Archivo → Exportar → Crear documento PDF/XPS**. En **Opciones**: intervalo **Todas**,
   publicar **Diapositivas** (no Documentos ni Páginas de notas) y, si alguna vez las hay,
   **Incluir diapositivas ocultas**: sin ellas, las páginas dejan de coincidir con las
   diapositivas.
3. Guardarlo con el mismo nombre, `financeai-use-cases-summary.pdf`, encima del actual.
4. Comprobar que tiene **19 páginas**, una por diapositiva y en el mismo orden.

Con el mismo nombre y las mismas páginas no hay que tocar nada más: ni el JSON ni el código.

## Añadir un documento

1. Dejar aquí el PDF, con un nombre que cumpla lo de arriba. Si el original es otra cosa —un
   PowerPoint, un Word—, dejar también el original, y el PDF exportado al lado.
2. Añadir su entrada en `data/biblioteca.json`:
   - `id`: minúsculas, cifras y guiones. Es lo que citan los casos.
   - `titulo`, `autor`, `fecha`, `idioma` y `descripcion`: lo que se ve en su tarjeta.
   - `tituloCorto`, si el título es largo para ir en la etiqueta de cada ficha («FinanceAI»).
   - `formato`: lo que dice el enlace de descarga, «Descargar el PDF», «Descargar el PowerPoint».
   - `unidad`: `pagina` o `diapositiva`. Es como se nombra la ubicación: «página 123»,
     «diapositiva 9».
   - `total`: las páginas o diapositivas que tiene. **Contarlas en el archivo**: el CI no puede, y
     una referencia que pase de `total` se descarta.
   - `archivo`: el PDF que se ve. `original`, si es otro archivo, el que se descarga.
     `nombreDeDescarga`, el nombre con el que se descarga.
3. Apuntar a él los casos que salgan de él, como dice la sección siguiente.
4. Pasar `python scripts/check_domains_sync.py`.

Un documento que todavía no cita ningún caso no es un error: la tarjeta sale igual, sin el botón
de ver sus casos, y el script lo enumera como aviso.

## Apuntar un caso a su fuente

En `data/casos-ia.json`, cada caso lleva una lista de `fuentes`. La primera es la que abre
«Más información»; las demás salen en el visor como «También en».

```json
"fuentes": [
  { "documento": "ai-dossier", "pagina": 123, "hasta": 124, "texto": "Global policy tracking" }
]
```

- `pagina`: **la del visor**, contando la portada como 1. En los dos documentos de ahora coincide
  con el número impreso en la página, pero no tiene por qué: muchos informes empiezan a numerar
  después de la portada y el índice.
- `hasta`: la última, si el caso ocupa más de una. En el Dossier cada caso ocupa dos.
- `texto`: cómo se llama el caso **en el documento**, en su idioma. Es lo que el consultor busca
  con la vista al abrirse la página, y en una diapositiva con veinte casos hace falta.
- `"alcance": "area"` y una `nota`: cuando el caso no aparece con esas palabras y lo que hay es su
  área. El visor lo marca como **referencia aproximada**, para que delante del cliente nadie lo
  confunda con el caso exacto.

## Lo que comprueba el CI y lo que no

`scripts/check_domains_sync.py` pone el CI en rojo si un archivo no existe o sale de
`biblioteca/`, si lo que se ve no es un PDF, si un caso no tiene fuente o le falta el texto, si
apunta a un documento que no está o a una página que pasa de `total`, o si una referencia de área
no explica por qué.

Lo que no puede comprobar:

- **Que `total` sea el de verdad.** Contar las páginas de un PDF sin librerías no es fiable —el
  Dossier guarda comprimida la lista de sus páginas—, y una dependencia más en el CI no compensa
  para un número que se cuenta una vez. Si se sustituye un PDF, contar sus páginas.
- **Que la página sea la buena.** Eso solo se sabe abriéndola. Una edición nueva de un documento
  mueve las páginas: al cambiarlo, hay que repasar las de sus casos.
