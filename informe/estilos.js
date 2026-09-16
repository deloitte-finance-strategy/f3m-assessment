/**
 * La paleta y la hoja de estilos del informe.
 *
 * Estaba dentro de informe/pdf.js como una funcion de 320 lineas que devolvia
 * una cadena. Con el informe convertido en deck la hoja pasa del doble, y
 * mezclada con las secciones no habia forma de leer ninguna de las dos.
 *
 * La paleta se exporta aparte porque informe/graficos.js tambien la necesita:
 * un SVG no puede heredar un color de una hoja que quiza no se haya aplicado
 * todavia, asi que escribe los suyos literales y tienen que ser los mismos.
 */

import { COLOR_DE_MARCA, COLOR_DE_MARCA_LEGIBLE } from "../core/presentacion.js?v=11";


/**
 * El tamano de la diapositiva: 338x190mm son 13,33x7,5 pulgadas, que es
 * exactamente la diapositiva 16:9 de PowerPoint. No es una proporcion
 * aproximada: con esta medida el PDF se proyecta a pantalla completa sin
 * bandas y se inserta en una presentacion sin reescalar.
 */
export const DIAPOSITIVA = {
  ancho: 338,
  alto: 190,
  margenLateral: 16,
  margenSuperior: 13,
  margenInferior: 16,
};


/**
 * Los grises del informe. Los colores con significado —palanca, prioridad,
 * marca— no estan aqui: viven en core/presentacion.js, que es de donde los
 * toman la aplicacion y el informe a la vez.
 *
 * Fuera el beige que tenia el informe anterior (#f3f5f0 de fondo, #f8faf5 en
 * las tarjetas, #eef2e9 en las cabeceras de tabla). Tenia el aire de una hoja
 * de calculo impresa. Blanco, un gris calido para los paneles y negro para el
 * texto es lo que hace que una diapositiva se lea como una diapositiva.
 */
export const PALETA = {
  tinta: "#101312",
  tintaSuave: "#5A635C",
  tintaTenue: "#8A9189",
  linea: "#DCE0D8",
  lineaFuerte: "#B9C1B2",
  papel: "#FFFFFF",
  panel: "#F5F7F2",
  negro: "#0A0C0B",
  negroSuave: "#1C211D",
  marca: COLOR_DE_MARCA,
  marcaLegible: COLOR_DE_MARCA_LEGIBLE,
  pista: "#E4E8DF",
};


/**
 * Los cinco colores del heatmap, del rojo al verde.
 *
 * Son los mismos umbrales que getMaturityLevel() en core/calculo.js —1,5 / 2,5
 * / 3,5 / 4,5— y no una escala continua: el informe y la aplicacion tienen que
 * pintar del mismo color la misma celda.
 */
export const ESCALA_DE_CALOR = [
  { hasta: 1.5, fondo: "#F6CFC9", texto: "#7D1F19" },
  { hasta: 2.5, fondo: "#FBE0B6", texto: "#7A4700" },
  { hasta: 3.5, fondo: "#F1EDB2", texto: "#4F4A00" },
  { hasta: 4.5, fondo: "#D7EBC0", texto: "#315D11" },
  { hasta: Infinity, fondo: "#BCDFCB", texto: "#0F5132" },
];

export const CALOR_SIN_DATO = { fondo: "#EDEFEC", texto: "#78817A" };


/**
 * El par fondo/texto que le toca a un score.
 *
 * Se pregunta por el valor tal cual y no por Number(value), que es lo que hacia
 * el informe anterior: Number(null) es 0 y no NaN, asi que una subcapacidad sin
 * puntuar caia en el primer tramo y se pintaba del rojo del nivel 1. La celda
 * decia "-" y el color decia "evaluado con la peor nota", que es justo lo
 * contrario de lo que pasa, y en un heatmap el color se lee antes que la cifra.
 */
export function colorDeCalor(value) {
  if (!Number.isFinite(value)) {
    return CALOR_SIN_DATO;
  }

  return ESCALA_DE_CALOR.find((tramo) => value < tramo.hasta) || ESCALA_DE_CALOR[4];
}


export function getEnhancedPdfReportStyles() {
  return `
    @page {
      size: ${DIAPOSITIVA.ancho}mm ${DIAPOSITIVA.alto}mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      /* Gris de mesa: solo se ve en pantalla, al abrir la ventana del informe,
         y es lo que hace que se lea como un deck antes de imprimirlo. */
      background: #6E736C;
      color: ${PALETA.tinta};
      font-family: "Segoe UI Variable Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    /* ------------------------------------------------------- la diapositiva */

    /*
     * overflow: hidden recorta, y recortar en silencio es el fallo que mas caro
     * sale en una sesion con cliente. Esta aqui a proposito y con una red:
     * sin el, un milimetro de mas genera una pagina en blanco detras de cada
     * diapositiva —el redondeo de la impresion es asi— y el PDF entregable sale
     * con veinte paginas vacias intercaladas.
     *
     * La red es que nada llegue a recortarse nunca: las secciones largas se
     * reparten en varias diapositivas con paginar() en vez de desbordar, y
     * tests/comprobar-desbordes.js mide en el navegador cada diapositiva y
     * avisa si alguna se pasa. Si se toca esta hoja, hay que volver a pasarlo.
     */
    .slide {
      position: relative;
      width: ${DIAPOSITIVA.ancho}mm;
      height: ${DIAPOSITIVA.alto}mm;
      padding: ${DIAPOSITIVA.margenSuperior}mm ${DIAPOSITIVA.margenLateral}mm ${DIAPOSITIVA.margenInferior}mm;
      margin: 0 auto 9mm;
      background: ${PALETA.papel};
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.35);
    }

    .slide:last-child {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }

    .slide-oscura {
      background: ${PALETA.negro};
      color: ${PALETA.papel};
    }

    /* --------------------------------------------------- cabecera de sección */

    .slide-cabecera {
      flex: 0 0 auto;
      padding-bottom: 4mm;
      margin-bottom: 6mm;
      border-bottom: 0.7pt solid ${PALETA.linea};
    }

    .slide-antetitulo {
      display: flex;
      align-items: center;
      gap: 3mm;
      margin: 0 0 2mm;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${PALETA.tintaSuave};
    }

    .slide-antetitulo b {
      color: ${PALETA.marcaLegible};
      font-weight: 900;
    }

    .slide-antetitulo i {
      flex: 1;
      height: 0.7pt;
      background: ${PALETA.linea};
      font-style: normal;
    }

    .slide h2 {
      margin: 0;
      font-size: 19pt;
      font-weight: 700;
      letter-spacing: -0.012em;
      line-height: 1.12;
    }

    .slide-entradilla {
      margin: 2.5mm 0 0;
      max-width: 210mm;
      font-size: 9.5pt;
      color: ${PALETA.tintaSuave};
    }

    .slide-cuerpo {
      flex: 1 1 auto;
      min-height: 0;
    }

    /* -------------------------------------------------------------- el pie */

    .slide-pie {
      position: absolute;
      left: ${DIAPOSITIVA.margenLateral}mm;
      right: ${DIAPOSITIVA.margenLateral}mm;
      bottom: 7mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8mm;
      padding-top: 2.5mm;
      border-top: 0.7pt solid ${PALETA.linea};
      font-size: 7.5pt;
      letter-spacing: 0.04em;
      color: ${PALETA.tintaTenue};
    }

    .slide-pie strong {
      color: ${PALETA.tintaSuave};
      font-weight: 700;
    }

    .slide-pie-numero {
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      color: ${PALETA.tintaSuave};
    }
  ` + estilosDePortada() + estilosDeCifras() + estilosDeTablas() + estilosDeFichas() + estilosDeGraficos();
}


/** Portada, separadores de parte y cierre: las diapositivas a sangre. */
function estilosDePortada() {
  return `
    .portada,
    .separador,
    .cierre {
      justify-content: center;
      padding: 22mm 24mm;
    }

    /*
     * La banda verde no es decoracion: es lo unico de marca que lleva la
     * portada, y por eso ocupa el borde entero en vez de ser la barrita de
     * 110px que tenia el informe anterior.
     */
    .portada::before,
    .separador::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 7mm;
      background: ${PALETA.marca};
    }

    .portada-antetitulo {
      margin: 0 0 9mm;
      font-size: 9pt;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${PALETA.marca};
    }

    .portada h1 {
      margin: 0;
      max-width: 230mm;
      font-size: 40pt;
      font-weight: 300;
      line-height: 1.06;
      letter-spacing: -0.02em;
    }

    .portada h1 b {
      display: block;
      font-weight: 700;
    }

    .portada-bajada {
      margin: 7mm 0 0;
      max-width: 180mm;
      font-size: 11pt;
      line-height: 1.5;
      color: #C2C9C0;
    }

    .portada-datos {
      display: flex;
      flex-wrap: wrap;
      gap: 14mm;
      margin-top: 16mm;
      padding-top: 7mm;
      border-top: 0.7pt solid #363C37;
    }

    .portada-datos div {
      max-width: 62mm;
    }

    .portada-datos span {
      display: block;
      margin-bottom: 2mm;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${PALETA.tintaTenue};
    }

    .portada-datos strong {
      font-size: 10.5pt;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .separador-numero {
      margin: 0;
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${PALETA.marca};
    }

    .separador h2 {
      margin: 5mm 0 0;
      max-width: 240mm;
      font-size: 34pt;
      font-weight: 300;
      line-height: 1.1;
      letter-spacing: -0.02em;
      border: 0;
    }

    .separador p {
      margin: 6mm 0 0;
      max-width: 175mm;
      font-size: 10.5pt;
      color: #C2C9C0;
    }

    /* El indice: una lista con guia de puntos hasta el numero de diapositiva. */
    .indice {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2.2mm 16mm;
      margin-top: 1mm;
    }

    .indice-parte {
      grid-column: 1 / -1;
      margin: 3mm 0 0.8mm;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${PALETA.marcaLegible};
    }

    .indice-parte:first-child {
      margin-top: 0;
    }

    .indice-fila {
      display: flex;
      align-items: baseline;
      gap: 2mm;
      font-size: 9.2pt;
    }

    .indice-fila i {
      flex: 1;
      height: 0.7pt;
      background: ${PALETA.linea};
      font-style: normal;
    }

    .indice-fila b {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      color: ${PALETA.tintaSuave};
    }
  `;
}


/** KPIs, paneles y todo lo que envuelve a un grafico. */
function estilosDeCifras() {
  return `
    .rejilla-kpi {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5mm;
    }

    .kpi {
      padding: 6mm 6mm 6.5mm;
      background: ${PALETA.panel};
      border-top: 1.4mm solid ${PALETA.marca};
    }

    .kpi span {
      display: block;
      margin-bottom: 3mm;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: ${PALETA.tintaSuave};
    }

    /*
     * 32pt. En el informe anterior un KPI se escribia a 15pt y no se distinguia
     * de un texto corriente; la cifra es lo unico que se lee de una diapositiva
     * proyectada desde el fondo de una sala.
     */
    .kpi strong {
      display: block;
      font-size: 32pt;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
    }

    .kpi small {
      display: block;
      margin-top: 3mm;
      font-size: 8pt;
      line-height: 1.35;
      color: ${PALETA.tintaSuave};
    }

    .kpi-alerta {
      border-top-color: #BB3128;
    }

    .panel {
      padding: 6mm;
      background: ${PALETA.panel};
    }

    .panel-claro {
      background: ${PALETA.papel};
      border: 0.7pt solid ${PALETA.linea};
    }

    .panel h3,
    .bloque h3 {
      margin: 0 0 4mm;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: ${PALETA.tintaSuave};
    }

    .rejilla-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6mm;
    }

    .rejilla-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
    }

    .rejilla-dos-tercios {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 6mm;
    }

    /*
     * height: auto es la trampa de un SVG con viewBox: al ocupar todo el ancho
     * de su columna, la altura sale de la proporcion del viewBox y un bullet de
     * 30mm de ancho pasa a medir 4mm, pero el mismo bullet en una tarjeta de
     * 140mm se planta en 20mm y tira la diapositiva entera fuera de pagina.
     * Cada uso fija su altura; el ancho lo pone el contenedor.
     */
    .grafico {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .celda-grafico .grafico {
      height: 4.2mm;
    }

    .brecha .grafico {
      height: 3.6mm;
      margin-top: 1.2mm;
    }

    .anillo .grafico {
      max-width: 30mm;
      margin: 0 auto;
    }

    /* La escala y el titular, uno al lado del otro: a lo ancho de la
       diapositiva la escala se iria a 60mm de alto y no le hacen falta. */
    .rejilla-panorama {
      display: grid;
      grid-template-columns: 1.75fr 1fr;
      gap: 6mm;
      align-items: stretch;
    }

    /*
     * Una pila que ocupa la diapositiva entera, con un bloque que crece.
     *
     * Sin esto el contenido se apila arriba y deja una franja blanca de dos
     * dedos sobre el pie. En un documento no se nota; proyectado, la
     * diapositiva parece a medio terminar.
     */
    .pila {
      display: flex;
      flex-direction: column;
      gap: 6mm;
      height: 100%;
    }

    .pila > .crece {
      flex: 1 1 auto;
      min-height: 0;
    }

    .escala {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .titular {
      margin: 0;
      padding-left: 5mm;
      border-left: 1mm solid ${PALETA.marca};
      font-size: 13pt;
      font-weight: 300;
      line-height: 1.38;
      letter-spacing: -0.01em;
    }

    .titular b {
      font-weight: 700;
    }

    .nota {
      margin: 0;
      font-size: 8pt;
      line-height: 1.4;
      color: ${PALETA.tintaTenue};
    }

    .nota-alcance {
      margin-top: 4mm;
      padding: 3mm 4mm;
      background: ${PALETA.panel};
      border-left: 0.8mm solid ${PALETA.lineaFuerte};
      font-size: 8pt;
      color: ${PALETA.tintaSuave};
    }

    .radar {
      display: block;
      width: 100%;
      max-height: 88mm;
      object-fit: contain;
    }

    .radar-titulo {
      display: flex;
      align-items: center;
      gap: 2.5mm;
      margin: 0 0 3mm;
      font-size: 9pt;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .radar-titulo em {
      width: 2.8mm;
      height: 2.8mm;
      border-radius: 50%;
      font-style: normal;
    }
  `;
}


/** Tablas: filetes horizontales y cebra, nunca una rejilla completa. */
function estilosDeTablas() {
  return `
    .tabla {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8.6pt;
    }

    /*
     * El relleno de fila sale de cuadrar con POR_DIAPOSITIVA en
     * informe/secciones.js: con las filas mas apretadas, una tabla de nueve
     * dominios ocupaba dos tercios de la diapositiva y dejaba una franja vacia
     * debajo. Si se cambia uno, hay que volver a pasar
     * tests/comprobar-desbordes.js sobre los nueve dominios.
     */
    .tabla th,
    .tabla td {
      padding: 3.2mm 2.5mm;
      text-align: left;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }

    .tabla thead th {
      padding-bottom: 2mm;
      border-bottom: 1pt solid ${PALETA.tinta};
      font-size: 7.2pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${PALETA.tintaSuave};
    }

    .tabla tbody tr {
      border-bottom: 0.6pt solid ${PALETA.linea};
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .tabla tbody tr:nth-child(even) {
      background: #FAFBF8;
    }

    .tabla .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .tabla .principal {
      font-weight: 600;
    }

    .tabla-vacia td {
      padding: 8mm 0;
      color: ${PALETA.tintaTenue};
      text-align: center;
    }

    /* La celda que lleva un bullet chart no lleva relleno lateral propio. */
    .celda-grafico {
      padding-right: 0;
    }

    .marca-prioridad {
      display: inline-flex;
      align-items: center;
      gap: 1.8mm;
      font-weight: 700;
      white-space: nowrap;
    }

    .marca-prioridad em {
      width: 2.2mm;
      height: 2.2mm;
      border-radius: 50%;
      font-style: normal;
    }

    .chip-oleada {
      display: inline-block;
      padding: 0.8mm 2.2mm;
      border-radius: 1mm;
      font-size: 7.4pt;
      font-weight: 800;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
  `;
}


/** Tarjetas: brechas, comentarios y las fichas de casos de IA. */
function estilosDeFichas() {
  return `
    .brechas {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm 8mm;
    }

    .brecha {
      display: grid;
      grid-template-columns: 5mm 1fr;
      gap: 3mm;
      padding-bottom: 2.6mm;
      border-bottom: 0.6pt solid ${PALETA.linea};
    }

    .brecha-orden {
      font-size: 12pt;
      font-weight: 700;
      line-height: 1;
      color: ${PALETA.lineaFuerte};
      font-variant-numeric: tabular-nums;
    }

    .brecha-titulo {
      margin: 0 0 1.4mm;
      font-size: 9pt;
      font-weight: 600;
      line-height: 1.3;
    }

    .brecha-capacidad {
      display: block;
      font-size: 7.4pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${PALETA.tintaTenue};
    }

    .tarjetas {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
    }

    .tarjeta {
      padding: 4mm;
      background: ${PALETA.panel};
      border-left: 0.9mm solid ${PALETA.lineaFuerte};
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .tarjeta h4 {
      margin: 0 0 2.2mm;
      font-size: 9pt;
      font-weight: 700;
      line-height: 1.28;
    }

    .tarjeta p {
      margin: 0;
      font-size: 8.2pt;
      line-height: 1.34;
      color: ${PALETA.tintaSuave};
    }

    .tarjeta-origen {
      display: block;
      margin-bottom: 2mm;
      font-size: 7.2pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${PALETA.tintaTenue};
    }

    .etiquetas {
      display: flex;
      flex-wrap: wrap;
      gap: 1.6mm;
      margin: 0 0 2.4mm;
    }

    /*
     * Las dos etiquetas de un caso no estrenan familia de color, y no es una
     * limitacion: el verde, el naranja y el azul marino son las palancas, y el
     * rojo, el ambar y el verde son la prioridad. Una familia mas le quitaria
     * significado a las que ya lo tienen.
     *
     * Se diferencian por peso dentro de la familia neutra, igual que en la
     * aplicacion: el tipo de valor va relleno porque es el eje que ordena la
     * conversacion con el cliente, y el tipo de IA con borde porque es un
     * calificativo tecnico.
     */
    .etiqueta {
      display: inline-block;
      padding: 0.7mm 2mm;
      border-radius: 1mm;
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .etiqueta-valor {
      background: ${PALETA.negroSuave};
      color: ${PALETA.papel};
    }

    .etiqueta-ia {
      border: 0.6pt solid ${PALETA.lineaFuerte};
      color: ${PALETA.tintaSuave};
    }

    .etiqueta-ia.es-agentica {
      border-color: ${PALETA.tinta};
      color: ${PALETA.tinta};
    }

    .etiqueta-ia.es-automatizacion {
      border-color: ${PALETA.linea};
      color: ${PALETA.tintaTenue};
    }

    /*
     * Dos columnas y el nombre sobre la definicion. A una columna con el nombre
     * al lado son cinco filas de texto largo y la diapositiva se pasaba de
     * pagina en los dominios con las cinco familias de valor representadas.
     */
    .leyenda {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2.4mm 6mm;
      font-size: 7.6pt;
    }

    .leyenda div {
      line-height: 1.32;
    }

    .leyenda b {
      display: block;
    }

    .leyenda b {
      font-weight: 700;
    }

    .leyenda span {
      color: ${PALETA.tintaSuave};
    }

    @media print {
      body {
        background: ${PALETA.papel};
      }

      .slide {
        margin: 0;
        box-shadow: none;
      }
    }
  `;
}


/** Lo que envuelve a las primitivas de informe/graficos.js. */
function estilosDeGraficos() {
  return `
    .barras {
      display: grid;
      gap: 2.6mm;
    }

    .barra-cabeza {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 4mm;
      margin-bottom: 1.2mm;
      font-size: 8.4pt;
      font-weight: 600;
    }

    .barra-cabeza strong {
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .barra-pista {
      height: 3mm;
      background: ${PALETA.pista};
      overflow: hidden;
    }

    .barra-relleno {
      height: 100%;
    }

    /* La escala de madurez pide aire a los lados: las etiquetas de los tramos
       extremos se dibujan centradas bajo su tramo y rozan el borde. */


    /*
     * El heatmap como rejilla y no como tabla con celdas pintadas.
     *
     * La diferencia es el filete: una tabla con borde en cada celda dibuja una
     * cuadricula gris por encima del color y lo que se lee es la cuadricula. Con
     * separacion en blanco entre celdas, lo que se lee es el color, que es de lo
     * que va un heatmap.
     */
    .rejilla-calor {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0.7mm;
      table-layout: fixed;
      font-size: 8.4pt;
    }

    .rejilla-calor th {
      padding: 0 1.5mm 1.5mm;
      text-align: left;
      font-size: 7.2pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${PALETA.tintaSuave};
    }

    .rejilla-calor th.col-dato {
      text-align: center;
    }

    .rejilla-calor td {
      padding: 2.4mm 2mm;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }

    .rejilla-calor .celda-nombre {
      padding-left: 0;
      font-size: 8.2pt;
      line-height: 1.28;
    }

    .rejilla-calor .celda-nombre b {
      display: block;
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${PALETA.tintaTenue};
    }

    .rejilla-calor .celda-calor {
      text-align: center;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .rejilla-calor .celda-fin {
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: ${PALETA.tintaSuave};
    }
  `;
}
