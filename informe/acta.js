/**
 * El acta del taller: lo que el cliente recibe despues de la sesion.
 *
 * Es el despues de la preparacion. Al terminar un taller, el equipo resumia a
 * mano en un correo lo que se habia puntuado y lo que se habia dicho, copiando
 * cifras de la pantalla. Esto saca ese resumen de la herramienta: una portada
 * con lo que salio de la sesion, lo acordado capacidad a capacidad con las
 * notas del taller, lo que quedo pendiente con la documentacion que ayudaria a
 * puntuarlo, y una tabla de proximos pasos para rellenar.
 *
 * Las cifras salen de las mismas funciones que el Dashboard (resumenGlobal) y
 * que el Overview (agregarPorDominio), asi que el acta no puede decir del
 * dominio algo distinto de lo que se proyecto en la sala.
 *
 * Es un documento A4 de la misma familia que la preparacion, con su misma hoja
 * comun, y puro como el resto de informe/: entra lo que reune app/informe.js y
 * sale el documento entero, sin scripts.
 */

import {
  DEFAULT_TARGET_MATURITY,
  PALANCAS,
  agregarPorDominio,
  getMaturityLevelNumber,
  normalizeTargetValue,
  ordenarPorPrioridadYGap,
  resumenGlobal,
} from "../core/calculo.js?v=27";
import {
  COLOR_DE_PALANCA,
  escapeHtml,
  formatMedia,
  formatNumber,
  priorityColor,
} from "../core/presentacion.js?v=27";
import { CALOR_SIN_DATO, PALETA, colorDeCalor } from "./estilos.js?v=27";
import {
  NIVELES_DE_LA_RUBRICA,
  capacidadesDePreparacion,
  estilosDelDocumento,
  tituloDelDocumento,
} from "./preparacion.js?v=27";


/** Cuantas subcapacidades lleva la portada en «Dónde está la mayor distancia». */
export const BRECHAS_EN_LA_PORTADA = 5;

const PASOS_EN_BLANCO = 6;

/**
 * Anchos fijos para las tablas de las capacidades: cada una media sus columnas
 * por su cuenta y, una debajo de otra, los scores no caian en la misma vertical.
 */
const COLUMNAS_DEL_DETALLE = `
  <colgroup>
    <col style="width:27%">
    <col style="width:14%"><col style="width:14%"><col style="width:14%">
    <col style="width:12%">
    <col style="width:7%">
    <col style="width:12%">
  </colgroup>
`;


/**
 * Las cifras del acta, aparte del HTML para poder probarlas.
 *
 * Cada subcapacidad llega con sus metricas ya calculadas (calculate() en la
 * aplicacion), y de ahi salen las cuatro cifras de cabecera, la media de cada
 * palanca frente a su objetivo, las brechas de la portada y lo pendiente.
 */
export function resumenDelActa(subcapacidades) {
  const items = subcapacidades || [];
  const entradas = items.map((item) => ({ item, metrics: item.metricas }));
  const objetivos = new Map(items.map((item) => [item.capacidad, objetivosDe(item)]));

  const [dominio] = agregarPorDominio(
    [{ id: "acta", items }],
    (item) => item.metricas,
    (capacidad) => objetivos.get(capacidad),
  );

  const palancas = PALANCAS.map((palanca) => ({
    key: palanca.key,
    label: palanca.label,
    media: dominio[palanca.key],
    // objetivoProcesos y las otras dos: la media de todas, tambien las pendientes.
    objetivo: dominio[`objetivo${palanca.key.charAt(0).toUpperCase()}${palanca.key.slice(1)}`],
  }));

  return {
    entradas,
    resumen: resumenGlobal(entradas),
    palancas,
    brechas: ordenarPorPrioridadYGap(
      entradas.filter((entrada) => !entrada.metrics.isPending && entrada.metrics.gap > 0),
    ).slice(0, BRECHAS_EN_LA_PORTADA),
    pendientes: entradas.filter((entrada) => entrada.metrics.isPending),
  };
}


/** Los objetivos de la capacidad de una subcapacidad, como los usa el calculo. */
function objetivosDe(item) {
  return Object.fromEntries(
    PALANCAS.map((palanca) => [
      palanca.key,
      normalizeTargetValue(item.metricas?.targets?.[palanca.key], DEFAULT_TARGET_MATURITY),
    ]),
  );
}


export function documentoDeActa(datos) {
  const capacidades = capacidadesDePreparacion(datos.subcapacidades || []);
  const cifras = resumenDelActa(datos.subcapacidades);
  const cliente = datos.cliente ? escapeHtml(datos.cliente) : "";
  const dominio = escapeHtml(datos.domainLabel || "");
  const ambito = capacidades.length === 1
    ? `de ${escapeHtml(capacidades[0].nombre)}, dentro de ${dominio}`
    : `de ${dominio}`;

  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(tituloDelDocumento("Acta del taller F3M", datos))}</title>
        <style>${estilos()}</style>
      </head>
      <body>
        <div class="marca">
          <span><b>F3M Assessment</b>${cliente ? ` · ${cliente}` : ""}</span>
          <span>Acta del taller · ${dominio}</span>
        </div>

        <h1>Acta del taller de ${escapeHtml(datos.domainTitle || datos.domainLabel || "")}</h1>
        <p class="bajada">Diagnóstico de madurez de la función financiera · Deloitte Finance Strategy</p>

        <div class="huecos">
          <div>Fecha del acta${datos.fecha ? `<b>${escapeHtml(datos.fecha)}</b>` : ""}</div>
          <div>Lugar o enlace</div>
          <div>Asistentes por parte de ${cliente || "la organización"}</div>
          <div>Equipo de Deloitte</div>
        </div>

        <p class="aviso">${frase(cifras, ambito)}</p>
        ${kpis(cifras.resumen)}

        <h2>Por palanca</h2>
        ${barras(cifras.palancas)}
        <p class="nota">La barra es la media de lo puntuado; la línea discontinua, el objetivo.</p>

        <h2>Dónde está la mayor distancia al objetivo</h2>
        ${brechas(cifras.brechas)}

        <section class="detalle">
          <h2>Lo que acordamos, subcapacidad a subcapacidad</h2>
          <p class="nota">${introduccionDelDetalle(datos.subcapacidades || [])}</p>
          ${capacidades.map(capitulo).join("")}
        </section>

        <section class="final">
          ${pendientes(capacidades)}

          <div class="pasos">
            <h2>Próximos pasos</h2>
            <table class="tabla">
              <thead><tr><th>Acción</th><th>Responsable</th><th>Fecha</th></tr></thead>
              <tbody>${"<tr><td></td><td></td><td></td></tr>".repeat(PASOS_EN_BLANCO)}</tbody>
            </table>

            <p class="cierre">Las puntuaciones de esta acta son las acordadas en la sesión y tienen carácter preliminar. El diagnóstico completo, con el roadmap de iniciativas y las oportunidades de IA, llega en el informe.</p>
          </div>
        </section>
      </body>
    </html>
  `;
}


/**
 * La frase de arriba, que es lo que se lee primero: cuanto se ha puntuado,
 * que palanca esta mejor y cual mas lejos de su objetivo, y cuanto queda.
 */
function frase({ resumen, palancas, pendientes: pendientesDelActa }, ambito) {
  const { evaluadas, total } = resumen;

  const cuantas = evaluadas === total
    ? total === 1
      ? `Queda puntuada <b>la subcapacidad</b> ${ambito}.`
      : `Quedan puntuadas <b>las ${total} subcapacidades</b> ${ambito}.`
    : `Con esta sesión ${evaluadas === 1 ? "queda puntuada" : "quedan puntuadas"} <b>${evaluadas} de las ${total} subcapacidades</b> ${ambito}.`;

  const conMedia = palancas.filter((palanca) => Number.isFinite(palanca.media));

  if (!conMedia.length) {
    return cuantas;
  }

  const madura = [...conMedia].sort((a, b) => b.media - a.media)[0];
  const lejos = conMedia
    .map((palanca) => ({ ...palanca, distancia: palanca.objetivo - palanca.media }))
    .filter((palanca) => palanca.distancia > 0.005)
    .sort((a, b) => b.distancia - a.distancia)[0];

  let palancasTexto = `La palanca más madura es <b>${escapeHtml(madura.label)}</b> (${formatMedia(madura.media)} de media)`;

  if (!lejos) {
    palancasTexto += conMedia.length === PALANCAS.length
      ? ", y las tres alcanzan su objetivo."
      : ", y las puntuadas alcanzan su objetivo.";
  } else if (lejos.key === madura.key) {
    palancasTexto += `, y aun así es la que más lejos queda de su objetivo (${formatObjetivo(lejos.objetivo)}).`;
  } else {
    palancasTexto += ` y la que más lejos queda de su objetivo es <b>${escapeHtml(lejos.label)}</b> (${formatMedia(lejos.media)} frente a ${formatObjetivo(lejos.objetivo)}).`;
  }

  const quedan = pendientesDelActa.length
    ? ` ${pendientesDelActa.length === 1 ? "Queda una subcapacidad" : `Quedan ${pendientesDelActa.length} subcapacidades`} para la próxima sesión.`
    : "";

  return `${cuantas} ${palancasTexto}${quedan}`;
}


/** Un objetivo de capacidad es un entero; uno medio puede no serlo. */
function formatObjetivo(valor) {
  return Number.isInteger(valor) ? formatNumber(valor) : formatMedia(valor);
}


/** El nombre corto del nivel, el de la escala de la preparacion: «Avanzado/Referente» no cabe en la columna. */
function nombreDelNivel(score) {
  return NIVELES_DE_LA_RUBRICA[getMaturityLevelNumber(score) - 1] || "";
}


function kpis(resumen) {
  const tarjeta = (titulo, cifra, detalle) => `
    <div class="kpi"><span>${titulo}</span><b>${cifra}</b><small>${detalle}</small></div>
  `;

  return `
    <div class="kpis">
      ${tarjeta("Puntuadas", `${resumen.evaluadas}/${resumen.total}`, "subcapacidades")}
      ${tarjeta("Nivel medio", formatMedia(resumen.scoreGlobal), escapeHtml(nombreDelNivel(resumen.scoreGlobal)))}
      ${tarjeta("Gap medio", formatMedia(resumen.gapMedio), "frente al objetivo")}
      ${tarjeta("Prioridad alta", resumen.prioridadAlta, "con gap de 2 o más")}
    </div>
  `;
}


function barras(palancas) {
  return palancas.map((palanca) => {
    const color = COLOR_DE_PALANCA[palanca.key];
    const media = Number.isFinite(palanca.media) ? palanca.media : 0;
    const cifra = Number.isFinite(palanca.media)
      ? `<b>${formatMedia(palanca.media)}</b> de ${formatObjetivo(palanca.objetivo)}`
      : "Sin puntuar";

    return `
      <div class="barra">
        <span class="nombre"><i style="background:${color}"></i>${escapeHtml(palanca.label)}</span>
        <span class="pista">
          <span class="valor" style="width:${(media / 5) * 100}%;background:${color}"></span>
          <span class="objetivo" style="left:${(palanca.objetivo / 5) * 100}%"></span>
        </span>
        <span class="cifra">${cifra}</span>
      </div>
    `;
  }).join("");
}


function brechas(lista) {
  if (!lista.length) {
    return `<p class="nota">Ninguna subcapacidad puntuada queda por debajo de su objetivo.</p>`;
  }

  const filas = lista.map(({ item, metrics }) => `
    <tr>
      <td>${escapeHtml(item.subcapacidad)}</td>
      <td class="tenue">${escapeHtml(item.capacidad)}</td>
      <td class="c">${formatMedia(metrics.scoreMedio)}</td>
      <td class="c"><b>${formatMedia(metrics.gap)}</b></td>
      <td>${marcaDePrioridad(metrics.prioridad)}</td>
    </tr>
  `).join("");

  return `
    <table class="tabla">
      <thead><tr><th>Subcapacidad</th><th>Capacidad</th><th class="c">Media</th><th class="c">Gap</th><th>Prioridad</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}


/** El punto de color y la palabra, como en el informe: el color solo no se lee impreso en gris. */
function marcaDePrioridad(prioridad) {
  return `<span class="prioridad"><em style="background:${priorityColor(prioridad)}"></em>${escapeHtml(prioridad)}</span>`;
}


function introduccionDelDetalle(subcapacidades) {
  const conNotas = subcapacidades.some((item) => String(item.comentario || "").trim());

  return `Puntuación de 1 a 5 en cada palanca, con el objetivo de la capacidad debajo de su nombre.${
    conNotas ? " Las notas son las que tomamos durante la sesión." : ""
  }`;
}


function capitulo(capacidad) {
  const objetivos = objetivosDe(capacidad.subcapacidades[0]);

  const cabecera = PALANCAS.map((palanca) => `
    <th class="c palanca">
      <i style="background:${COLOR_DE_PALANCA[palanca.key]}"></i>${escapeHtml(palanca.label)}
      <small>Objetivo ${formatObjetivo(objetivos[palanca.key])}</small>
    </th>
  `).join("");

  return `
    <section class="capacidad">
      <h3 class="titulo-capacidad"><span>${escapeHtml(capacidad.numero)}</span>${escapeHtml(capacidad.nombre)}</h3>
      <table class="tabla detalle-tabla">
        ${COLUMNAS_DEL_DETALLE}
        <thead><tr><th>Subcapacidad</th>${cabecera}<th>Nivel</th><th class="c">Gap</th><th>Prioridad</th></tr></thead>
        ${capacidad.subcapacidades.map(fila).join("")}
      </table>
    </section>
  `;
}


function fila(item) {
  const metrics = item.metricas || {};
  const nota = String(item.comentario || "").trim();

  const puntos = PALANCAS.map((palanca) => {
    const score = item.scores?.[palanca.key];
    const color = Number.isFinite(score) ? colorDeCalor(score) : CALOR_SIN_DATO;

    return `<td class="c"><b class="nivel" style="background:${color.fondo};color:${color.texto}">${Number.isFinite(score) ? formatNumber(score) : "–"}</b></td>`;
  }).join("");

  // Cada subcapacidad en su propio tbody, para que su nota no se quede sola
  // arriba de la pagina siguiente.
  return `
    <tbody>
    <tr class="${nota ? "con-nota" : ""}">
      <td>${escapeHtml(item.subcapacidad)}</td>
      ${puntos}
      <td>${metrics.isPending ? `<span class="tenue">Sin puntuar</span>` : escapeHtml(nombreDelNivel(metrics.scoreMedio))}</td>
      <td class="c">${metrics.isPending ? "–" : formatMedia(metrics.gap)}</td>
      <td>${marcaDePrioridad(metrics.prioridad || "Pendiente")}</td>
    </tr>
    ${nota ? `<tr class="nota-del-taller"><td colspan="${PALANCAS.length + 4}"><span>Notas del taller</span>${escapeHtml(nota)}</td></tr>` : ""}
    </tbody>
  `;
}


/**
 * Lo que no se llego a puntuar, con la documentacion que ayudaria a hacerlo:
 * es la misma lista de la preparacion, y el acta la vuelve a pedir solo para
 * lo que falta.
 */
function pendientes(capacidades) {
  const lista = capacidades.flatMap((capacidad) =>
    capacidad.subcapacidades.filter((item) => item.metricas?.isPending),
  );

  if (!lista.length) {
    return "";
  }

  const bloques = lista.map((item) => `
    <div class="pendiente">
      <h3>${escapeHtml(item.subcapacidad)}</h3>
      ${
        item.evidencias.length
          ? `<ul class="casillas">${item.evidencias.map((evidencia) => `<li><span class="casilla"></span>${escapeHtml(evidencia)}</li>`).join("")}</ul>`
          : `<p class="nota">Ninguna documentación en concreto.</p>`
      }
    </div>
  `);

  // El titulo y la entradilla van con la primera, para que no se queden solos
  // al pie de una pagina con la lista en la siguiente.
  return `
    <div class="pendiente-inicio">
      <h2>Quedó pendiente</h2>
      <p>No llegamos a puntuar ${lista.length === 1 ? "esta subcapacidad" : `estas ${lista.length} subcapacidades`}. Para ${lista.length === 1 ? "verla" : "verlas"} en la próxima sesión, nos ayudaría contar antes con esta documentación:</p>
      ${bloques[0]}
    </div>
    ${bloques.slice(1).join("")}
  `;
}


function estilos() {
  return `${estilosDelDocumento()}

    .huecos b {
      margin-left: 5pt;
      color: ${PALETA.tinta};
      font-weight: 600;
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8pt;
      margin-bottom: 4pt;
    }

    .kpi {
      padding: 8pt 10pt;
      border: 0.75pt solid ${PALETA.linea};
      border-radius: 5pt;
    }

    .kpi span {
      display: block;
      color: ${PALETA.tintaSuave};
      font-size: 7.5pt;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .kpi b {
      display: block;
      margin-top: 2pt;
      font-size: 17pt;
      line-height: 1.1;
    }

    .kpi small {
      color: ${PALETA.tintaSuave};
      font-size: 8.5pt;
    }

    .barra {
      display: grid;
      grid-template-columns: 90pt 1fr 60pt;
      align-items: center;
      gap: 10pt;
      margin: 0 0 7pt;
      font-size: 9.5pt;
    }

    .barra .nombre {
      display: flex;
      align-items: center;
      gap: 5pt;
      font-weight: 600;
    }

    .barra i,
    .tabla th i {
      display: inline-block;
      width: 7pt;
      height: 7pt;
      margin-right: 3pt;
      border-radius: 50%;
    }

    .pista {
      position: relative;
      height: 9pt;
      border-radius: 5pt;
      background: ${PALETA.pista};
    }

    .valor {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 5pt;
    }

    .pista .objetivo {
      position: absolute;
      top: -3pt;
      bottom: -3pt;
      width: 0;
      border-left: 1.5pt dashed ${PALETA.tinta};
    }

    .cifra {
      color: ${PALETA.tintaSuave};
    }

    .cifra b {
      color: ${PALETA.tinta};
    }

    .tabla {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .tabla th {
      padding: 3pt 5pt;
      border-bottom: 1pt solid ${PALETA.lineaFuerte};
      color: ${PALETA.tintaSuave};
      font-size: 7pt;
      letter-spacing: 0.05em;
      text-align: left;
      text-transform: uppercase;
      vertical-align: bottom;
      white-space: nowrap;
    }

    /* Los nombres de palanca, sin espaciado: «ORGANIZACIÓN» con su punto no
       cabia en su columna. */
    .detalle-tabla th.palanca {
      padding: 3pt 2pt;
      font-size: 6.5pt;
      letter-spacing: 0;
    }

    .tabla th small {
      display: block;
      font-size: 6.5pt;
      letter-spacing: 0.02em;
      text-transform: none;
    }

    .tabla td {
      padding: 4pt 5pt;
      border-bottom: 0.5pt solid ${PALETA.linea};
      vertical-align: middle;
    }

    .tabla thead {
      display: table-header-group;
    }

    .tabla tr,
    .tabla tbody {
      break-inside: avoid;
    }

    .c {
      text-align: center;
    }

    .tenue {
      color: ${PALETA.tintaSuave};
    }

    .tabla .nivel {
      width: 16pt;
      height: 16pt;
      margin: 0;
      font-size: 9pt;
    }

    .prioridad {
      display: inline-flex;
      align-items: center;
      gap: 4pt;
      white-space: nowrap;
    }

    .prioridad em {
      width: 7pt;
      height: 7pt;
      border-radius: 50%;
    }

    .detalle {
      break-before: page;
    }

    .detalle > h2:first-child {
      margin-top: 0;
    }

    /* Una capacidad si se parte entre dos paginas, por subcapacidades y con
       la cabecera repetida: entera, dejaba media hoja en blanco cada vez que
       no cabia. */
    .capacidad {
      margin-top: 10pt;
    }

    .titulo-capacidad {
      display: flex;
      align-items: center;
      gap: 7pt;
      margin: 0 0 3pt;
      color: ${PALETA.marcaLegible};
      font-size: 11.5pt;
      break-after: avoid;
    }

    .titulo-capacidad span {
      padding: 0 5pt;
      border-radius: 3pt;
      background: ${PALETA.marca};
      color: ${PALETA.papel};
      font-size: 10pt;
    }

    .detalle-tabla {
      table-layout: fixed;
    }

    tr.con-nota td {
      border-bottom: 0;
    }

    tr.nota-del-taller td {
      padding: 0 5pt 6pt;
      color: ${PALETA.tintaSuave};
      font-size: 8.5pt;
      font-style: italic;
      white-space: pre-line;
    }

    tr.nota-del-taller span {
      margin-right: 6pt;
      color: ${PALETA.marcaLegible};
      font-size: 7pt;
      font-style: normal;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .pendiente {
      margin: 0 0 8pt;
      break-inside: avoid;
    }

    .pendiente-inicio {
      break-inside: avoid;
    }

    .pendiente .casillas {
      columns: 2;
      font-size: 9pt;
    }

    .pendiente .casillas li {
      break-inside: avoid;
    }

    /* Lo pendiente y los pasos siguen al detalle sin saltar de pagina: con un
       taller de una sola capacidad, el detalle ocupaba media hoja y los pasos
       se iban solos a la siguiente. Los pasos, eso si, no se parten. */
    .final {
      margin-top: 16pt;
      break-before: auto;
    }

    .pasos {
      break-inside: avoid;
    }

    .pasos td {
      height: 22pt;
    }

    .pasos th:first-child {
      width: 55%;
    }

    .cierre {
      margin-top: 14pt;
      color: ${PALETA.tintaSuave};
      font-size: 8.5pt;
    }
  `;
}
