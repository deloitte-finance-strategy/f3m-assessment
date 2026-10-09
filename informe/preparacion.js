/**
 * La preparacion del taller: lo que el cliente recibe antes de la sesion.
 *
 * Cada subcapacidad trae sus preguntas clave y la documentacion que sirve de
 * evidencia, pero solo se veian dentro de la herramienta: para preparar la
 * sesion, el equipo las copiaba a mano a un Word o a un correo. Esto saca un
 * documento sin una sola puntuacion, con lo que se tratara y lo que conviene
 * traer, con casillas para ir marcando.
 *
 * Es un documento y no un deck, al reves que el informe: se lee en la mesa y
 * se rellena, no se proyecta. Por eso va en A4 vertical y fluye de pagina en
 * pagina en vez de repartirse en diapositivas. Una subcapacidad no se parte
 * entre dos paginas (break-inside: avoid), y asi no hay que medir que cabe.
 *
 * Puro, como el resto de informe/: entra lo que reune app/informe.js y sale el
 * documento entero, sin scripts, por lo mismo que el informe.
 */

import { PALANCAS } from "../core/calculo.js?v=28";
import { COLOR_DE_PALANCA, escapeHtml } from "../core/presentacion.js?v=28";
import { ESCALA_DE_CALOR, PALETA } from "./estilos.js?v=28";


/**
 * La rubrica general de cada palanca, comun a los nueve dominios.
 *
 * Es la que ensena el modal «Criterios F3M» de index.html. Son dos copias, y
 * tests/casos-preparacion.js comprueba que digan lo mismo: el cliente no puede
 * recibir una escala y ver otra en la pantalla del taller.
 */
export const RUBRICA_GENERAL = {
  procesos: [
    "No existe proceso formal o es ad hoc",
    "Proceso parcial o inconsistente",
    "Proceso homogéneo y documentado",
    "Proceso medido y eficiente",
    "Proceso integrado y orientado a decisiones",
  ],
  tecnologia: [
    "Excel/manual",
    "Herramientas parciales",
    "Herramienta corporativa",
    "Integración y automatización",
    "Predictivo / IA",
  ],
  organizacion: [
    "Roles no claros",
    "Roles parciales",
    "Roles definidos",
    "Business partnering",
    "Influencia estratégica",
  ],
};


/** Los nombres de nivel del mismo modal, mas cortos que los de getMaturityLevel(). */
export const NIVELES_DE_LA_RUBRICA = ["Inicial", "Estructurado", "Estandarizado", "Optimizado", "Avanzado"];


const QUE_MIDE = {
  procesos: "cómo está definido y gobernado el trabajo",
  tecnologia: "qué herramientas y datos lo soportan",
  organizacion: "quién lo hace y con qué roles",
};


/**
 * «Calendario presupuestario; RACI; actas de comités» → una casilla por
 * documento, con mayuscula inicial. En los nueve Excel la evidencia es una sola
 * celda separada por punto y coma.
 */
export function listaDeEvidencias(texto) {
  return String(texto || "")
    .split(";")
    .map((parte) => parte.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toLocaleUpperCase("es") + parte.slice(1));
}


/**
 * Las subcapacidades agrupadas por capacidad, en el orden en que llegan.
 *
 * El numero de cada capacidad sale del prefijo «3.1» de su primera
 * subcapacidad y no de su posicion: con un filtro de capacidad puesto, la
 * tercera es la unica, y numerarla «1» encima de un «3.1» despistaria.
 */
export function capacidadesDePreparacion(subcapacidades) {
  const grupos = new Map();

  subcapacidades.forEach((subcapacidad) => {
    if (!grupos.has(subcapacidad.capacidad)) {
      grupos.set(subcapacidad.capacidad, []);
    }

    grupos.get(subcapacidad.capacidad).push({
      ...subcapacidad,
      preguntas: subcapacidad.preguntas || [],
      evidencias: listaDeEvidencias(subcapacidad.evidencias),
    });
  });

  return [...grupos].map(([nombre, items], posicion) => ({
    nombre,
    numero: /^\s*(\d+)\./.exec(items[0].subcapacidad || "")?.[1] || String(posicion + 1),
    subcapacidades: items,
  }));
}


export function documentoDePreparacion(datos) {
  const capacidades = capacidadesDePreparacion(datos.subcapacidades || []);
  const total = capacidades.reduce((suma, capacidad) => suma + capacidad.subcapacidades.length, 0);
  const preguntas = capacidades.reduce(
    (suma, capacidad) =>
      suma + capacidad.subcapacidades.reduce((parcial, item) => parcial + item.preguntas.length, 0),
    0,
  );
  const cliente = datos.cliente ? escapeHtml(datos.cliente) : "";
  const dominio = escapeHtml(datos.domainLabel || "");

  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(tituloDelDocumento("Preparación del taller F3M", datos))}</title>
        <style>${estilos()}</style>
      </head>
      <body>
        <div class="marca">
          <span><b>F3M Assessment</b>${cliente ? ` · ${cliente}` : ""}</span>
          <span>Preparación del taller · ${dominio}</span>
        </div>

        <h1>Preparación del taller de ${escapeHtml(datos.domainTitle || datos.domainLabel || "")}</h1>
        <p class="bajada">Diagnóstico de madurez de la función financiera · Deloitte Finance Strategy</p>

        <div class="huecos">
          <div>Fecha de la sesión</div>
          <div>Lugar o enlace</div>
          <div>Asistentes por parte de ${cliente || "la organización"}</div>
          <div>Equipo de Deloitte</div>
        </div>

        ${presentacion(capacidades, total, preguntas, dominio)}
        ${escala()}
        ${capacidades.length > 1 ? indice(capacidades) : ""}
        ${capacidades.map(capitulo).join("")}

        <section class="final">
          <h2>Otros comentarios antes del taller</h2>
          <p class="nota">Cualquier contexto que queráis compartirnos: cambios recientes, proyectos en marcha, prioridades de la dirección.</p>
          <div class="renglones">${"<div></div>".repeat(14)}</div>
        </section>
      </body>
    </html>
  `;
}


function presentacion(capacidades, total, preguntas, dominio) {
  const cuantas = total === 1 ? "<b>una subcapacidad</b>" : `las <b>${total} subcapacidades</b>`;
  const donde = capacidades.length === 1
    ? `de ${escapeHtml(capacidades[0].nombre)}, dentro de ${dominio}`
    : `de ${dominio}, agrupadas en ${capacidades.length} capacidades`;

  return `
    <p>En el taller repasaremos juntos ${cuantas} ${donde}. Para cada una conversaremos sobre cómo se trabaja hoy y acordaremos en qué nivel de madurez está.</p>
    <p>Este documento recoge, para cada subcapacidad, las preguntas que trataremos (${preguntas} en total) y la documentación que nos ayuda a entender la situación real.</p>
    <div class="aviso">
      <b>Antes de la sesión:</b> os pedimos revisar las preguntas y, si es posible, enviarnos la documentación marcada unos días antes. No hace falta tenerla toda ni prepararla a propósito: nos basta con lo que ya exista.
    </div>
  `;
}


function escala() {
  const palancas = PALANCAS.map(
    (palanca) => `<b>${escapeHtml(palanca.label)}</b> (${QUE_MIDE[palanca.key]})`,
  );

  const cabecera = PALANCAS.map(
    (palanca) => `<th><i style="background:${COLOR_DE_PALANCA[palanca.key]}"></i>${escapeHtml(palanca.label)}</th>`,
  ).join("");

  const filas = [1, 2, 3, 4, 5].map((nivel) => {
    const color = ESCALA_DE_CALOR[nivel - 1];
    const nombre = NIVELES_DE_LA_RUBRICA[nivel - 1];
    const celdas = PALANCAS.map(
      (palanca) => `<td>${escapeHtml(RUBRICA_GENERAL[palanca.key][nivel - 1])}</td>`,
    ).join("");

    return `
      <tr>
        <td><b class="nivel" style="background:${color.fondo};color:${color.texto}">${nivel}</b>${escapeHtml(nombre)}</td>
        ${celdas}
      </tr>
    `;
  }).join("");

  return `
    <h2>Cómo puntuaremos</h2>
    <p>Cada subcapacidad se valora de 1 a 5 en tres palancas: ${palancas[0]}, ${palancas[1]} y ${palancas[2]}. Esta es la escala de referencia del modelo F3M:</p>
    <table class="rubrica">
      <thead><tr><th>Nivel</th>${cabecera}</tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}


function indice(capacidades) {
  const filas = capacidades.map((capacidad) => {
    const cuantas = capacidad.subcapacidades.length;

    return `<li><span>${escapeHtml(capacidad.numero)}. ${escapeHtml(capacidad.nombre)}</span><span>${cuantas} ${cuantas === 1 ? "subcapacidad" : "subcapacidades"}</span></li>`;
  }).join("");

  // Entero en una pagina: una linea suelta del indice arriba de la siguiente,
  // encima del primer capitulo, parecia un capitulo mas.
  return `
    <div class="bloque">
      <h2>Qué veremos</h2>
      <ul class="indice">${filas}</ul>
    </div>
  `;
}


function capitulo(capacidad) {
  return `
    <section class="capacidad">
      <h2><span>${escapeHtml(capacidad.numero)}</span>${escapeHtml(capacidad.nombre)}</h2>
      ${capacidad.subcapacidades.map(subcapacidad).join("")}
    </section>
  `;
}


function subcapacidad(item) {
  const preguntas = item.preguntas.length
    ? `<ul>${item.preguntas.map((pregunta) => `<li>${escapeHtml(pregunta)}</li>`).join("")}</ul>`
    : `<p class="nota">Las veremos en la sesión.</p>`;

  const evidencias = item.evidencias.length
    ? `<ul class="casillas">${item.evidencias.map((evidencia) => `<li><span class="casilla"></span>${escapeHtml(evidencia)}</li>`).join("")}</ul>`
    : `<p class="nota">Ninguna en concreto.</p>`;

  return `
    <article class="subcapacidad">
      <h3>${escapeHtml(item.subcapacidad)}</h3>
      ${item.objetivo ? `<p class="objetivo">${escapeHtml(item.objetivo)}</p>` : ""}
      <div class="columnas">
        <div><h4>Preguntas que trataremos</h4>${preguntas}</div>
        <div><h4>Documentación que conviene traer</h4>${evidencias}</div>
      </div>
    </article>
  `;
}


/**
 * El nombre que propone el dialogo de guardar: con el cliente delante, como el
 * informe, y sin los caracteres que Windows no admite en un nombre de archivo.
 * Lo comparte el acta del taller, con su propio tipo de documento.
 */
export function tituloDelDocumento(tipo, datos) {
  const partes = [datos.cliente, datos.domainLabel]
    .filter(Boolean)
    .map((parte) => String(parte).replace(/[<>:"/\\|?*]+/g, " ").trim())
    .join(" - ");

  return [tipo, partes, datos.fechaDeArchivo].filter(Boolean).join(" - ");
}


/**
 * La hoja comun de los documentos A4 que se envian al cliente: la preparacion,
 * antes del taller, y el acta, despues. Son el antes y el despues de la misma
 * sesion y tienen que parecer de la misma familia; con dos copias de la hoja,
 * la primera que se tocara dejaria de parecerlo.
 */
export function estilosDelDocumento() {
  return `
    /* El numero de pagina va en el margen, que es donde el navegador lo sabe:
       el documento fluye y no hay forma de saber desde aqui en que pagina cae
       cada cosa. */
    @page {
      size: A4;
      margin: 16mm 16mm 18mm;

      @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        color: ${PALETA.tintaTenue};
        font-family: "Segoe UI Variable Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 7.5pt;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: ${PALETA.tinta};
      background: ${PALETA.papel};
      font-family: "Segoe UI Variable Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    /* En pantalla, antes de imprimir, una hoja sobre la mesa gris del informe. */
    @media screen {
      html {
        background: #6E736C;
      }

      body {
        max-width: 210mm;
        margin: 10mm auto;
        padding: 16mm;
        box-shadow: 0 2px 14px rgba(0, 0, 0, 0.25);
      }
    }

    p {
      margin: 0 0 7pt;
    }

    .marca {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12pt;
      padding-bottom: 6pt;
      border-bottom: 2.5pt solid ${PALETA.marca};
      color: ${PALETA.tintaSuave};
      font-size: 9pt;
    }

    .marca b {
      color: ${PALETA.tinta};
      font-size: 11pt;
    }

    h1 {
      margin: 16pt 0 4pt;
      font-size: 21pt;
      line-height: 1.15;
    }

    .bajada {
      margin-bottom: 12pt;
      color: ${PALETA.tintaSuave};
      font-size: 11pt;
    }

    .huecos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6pt 18pt;
      margin-bottom: 14pt;
      font-size: 9.5pt;
    }

    .huecos div {
      padding: 10pt 0 2pt;
      border-bottom: 0.75pt solid ${PALETA.lineaFuerte};
      color: ${PALETA.tintaSuave};
    }

    .aviso {
      margin: 10pt 0 12pt;
      padding: 8pt 11pt;
      border-left: 3pt solid ${PALETA.marca};
      background: #F1F7E7;
    }

    h2 {
      display: flex;
      align-items: center;
      gap: 8pt;
      margin: 14pt 0 6pt;
      padding: 6pt 10pt;
      border-radius: 4pt;
      background: #EEF6E2;
      color: ${PALETA.marcaLegible};
      font-size: 13pt;
      break-after: avoid;
    }

    h2 span {
      padding: 0 6pt;
      border-radius: 3pt;
      background: ${PALETA.marca};
      color: ${PALETA.papel};
      font-size: 11pt;
    }

    h3 {
      margin: 0 0 2pt;
      font-size: 11pt;
    }

    h4 {
      margin: 0 0 3pt;
      color: ${PALETA.tintaSuave};
      font-size: 7.5pt;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .nota {
      color: ${PALETA.tintaSuave};
      font-size: 9pt;
    }

    .nivel {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 15pt;
      height: 15pt;
      margin-right: 6pt;
      border-radius: 3pt;
    }

    ul {
      margin: 0;
      padding-left: 13pt;
      font-size: 9.5pt;
    }

    .casillas {
      padding: 0;
      list-style: none;
    }

    .casillas li {
      display: flex;
      align-items: flex-start;
      gap: 6pt;
    }

    .casilla {
      flex: none;
      width: 8pt;
      height: 8pt;
      margin-top: 3pt;
      border: 0.9pt solid ${PALETA.tintaSuave};
      border-radius: 1pt;
    }

    .final {
      break-before: page;
    }

    .final h2 {
      margin-top: 0;
    }

    .renglones div {
      height: 20pt;
      border-bottom: 0.75pt solid ${PALETA.lineaFuerte};
    }
  `;
}


function estilos() {
  return `${estilosDelDocumento()}

    .rubrica {
      width: 100%;
      margin-bottom: 4pt;
      border-collapse: collapse;
      font-size: 9pt;
      break-inside: avoid;
    }

    .rubrica th {
      padding: 3pt 6pt;
      border-bottom: 1pt solid ${PALETA.lineaFuerte};
      color: ${PALETA.tintaSuave};
      font-size: 7.5pt;
      letter-spacing: 0.06em;
      text-align: left;
      text-transform: uppercase;
    }

    .rubrica th i {
      display: inline-block;
      width: 7pt;
      height: 7pt;
      margin-right: 4pt;
      border-radius: 50%;
    }

    .rubrica td {
      padding: 4pt 6pt;
      border-bottom: 0.5pt solid ${PALETA.linea};
      vertical-align: middle;
    }

    .rubrica td:first-child {
      font-weight: 700;
      white-space: nowrap;
    }

    .indice {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .indice li {
      display: flex;
      justify-content: space-between;
      gap: 12pt;
      padding: 3pt 0;
      border-bottom: 0.5pt dotted ${PALETA.lineaFuerte};
    }

    .indice li span:last-child {
      color: ${PALETA.tintaSuave};
      white-space: nowrap;
    }

    .bloque {
      break-inside: avoid;
    }

    .capacidad {
      margin-top: 12pt;
    }

    .subcapacidad {
      padding: 8pt 0 9pt;
      border-bottom: 0.75pt solid ${PALETA.linea};
      break-inside: avoid;
    }

    .objetivo {
      margin-bottom: 6pt;
      color: ${PALETA.tintaSuave};
      font-size: 9pt;
    }

    .columnas {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 16pt;
    }
  `;
}
