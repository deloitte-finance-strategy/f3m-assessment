/**
 * El resumen de una pagina: la funcion financiera entera en una diapositiva,
 * para el comite de direccion.
 *
 * El informe es un deck de veinte o cuarenta diapositivas, y al director
 * financiero le sobra casi todo. Lo que se reenvia hacia arriba en el cliente
 * es una hoja: como esta la funcion, donde estan las brechas y que se va a
 * hacer. Eso es esta diapositiva.
 *
 * No calcula nada propio. Las cuatro cifras son las del panorama del informe
 * (kpisDeLaFuncionFinanciera()) y el titular es el suyo; el radar lleva el
 * score medio de cada dominio, el de la tabla del Overview; las palancas y las
 * brechas siguen el criterio del acta, y los proximos pasos son los que se
 * apuntaron al cierre de cada taller. Asi el resumen no puede contradecir ni
 * al informe ni a la pantalla.
 *
 * Es una diapositiva y no una hoja A4: tiene la medida del deck, 16:9, para
 * que se pueda proyectar o pegar en la presentacion del comite tal cual. Y
 * como el resto del deck, no lleva scripts.
 *
 * Sin filtros, como la parte global del informe, que es lo que resume.
 */

import { normalizarLogo } from "../core/escenario.js?v=31";
import {
  COLOR_DE_PALANCA,
  escapeAttr,
  escapeHtml,
  formatMedia,
  formatNumber,
  priorityColor,
} from "../core/presentacion.js?v=31";
import { PALETA, getEnhancedPdfReportStyles } from "./estilos.js?v=31";
import { svgBullet } from "./graficos.js?v=31";
import { kpisDeLaFuncionFinanciera, rejillaDeKpis, titularHtml } from "./secciones.js?v=31";


/** Cinco brechas: las que caben en la columna sin apretar la letra. */
export const BRECHAS_EN_EL_RESUMEN = 5;

/**
 * Cuatro pasos, en dos columnas: los que caben bajo las brechas aunque cada
 * uno ocupe dos lineas y su responsable otras dos. Con seis, las acciones
 * largas se metian debajo del pie.
 */
export const PASOS_EN_EL_RESUMEN = 4;

/**
 * Lo que cabe de una accion en dos lineas de su columna. Una accion admite 300
 * caracteres; las mas largas se acortan aqui, con puntos suspensivos y el
 * bloque diciendolo, en vez de recortarlas el CSS sin que se note.
 */
export const LARGO_DE_ACCION_EN_EL_RESUMEN = 100;


export function documentoDelResumen(data) {
  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(tituloDelResumen(data))}</title>
        <style>${getEnhancedPdfReportStyles()}${estilosDelResumen()}</style>
      </head>
      <body>${diapositivaDelResumen(data)}</body>
    </html>
  `;
}


/** El nombre que propone «Guardar como PDF»: con el cliente y la fecha, como el informe. */
export function tituloDelResumen(data) {
  const cliente = String(data.cliente || "").replace(/[<>:"/\\|?*]+/g, " ").trim();

  return ["Resumen F3M", cliente, data.fechaDeArchivo].filter(Boolean).join(" - ");
}


export function diapositivaDelResumen(data) {
  const global = data.global;

  if (!global) {
    return `
      <section class="slide resumen">
        <p class="nota">No había ningún dominio cargado al generar el resumen.</p>
      </section>
    `;
  }

  return `
    <section class="slide resumen">
      <header class="slide-cabecera resumen-cabecera">
        <div>
          <p class="slide-antetitulo">
            <b>F3M</b>
            <span>Resumen para el comité de dirección${data.cliente ? ` · ${escapeHtml(data.cliente)}` : ""}</span>
            <i></i>
          </p>
          <h2>La función financiera en una página</h2>
          ${titularHtml(global.titulares, "la función financiera")}
        </div>
        ${logo(data)}
      </header>

      <div class="slide-cuerpo">
        <div class="pila resumen-pila">
          ${rejillaDeKpis(kpisDeLaFuncionFinanciera(global))}

          <div class="resumen-centro crece">
            ${madurez(data.radar, global.palancas || [])}
            <div class="resumen-derecha">
              ${brechas(global.brechas)}
              ${pasos(data.pasos || [])}
            </div>
          </div>
        </div>
      </div>

      <footer class="slide-pie">
        <span><strong>F3M Assessment</strong>${data.cliente ? ` · ${escapeHtml(data.cliente)}` : ""} · La función financiera</span>
        <span>${escapeHtml(alcance(global))}</span>
        <span>${escapeHtml(data.generatedAt || "")}</span>
      </footer>
    </section>
  `;
}


/** De cuanto habla la hoja, en el pie: quien la recibe no ha visto la herramienta. */
export function alcance(global) {
  const dominios = global.dominios < global.dominiosTotales
    ? `${global.dominios} de los ${global.dominiosTotales} dominios`
    : `los ${global.dominios} dominios`;

  return `${global.evaluadas} de ${global.subcapacidades} subcapacidades puntuadas en ${dominios} · Sin filtros`;
}


function logo(data) {
  const imagen = normalizarLogo(data.logo);

  return imagen
    ? `<img class="resumen-logo" src="${escapeAttr(imagen)}" alt="${escapeAttr(data.cliente ? `Logo de ${data.cliente}` : "Logo del cliente")}">`
    : "";
}


/** El radar de los dominios y, debajo, cada palanca frente a su objetivo. */
export function madurez(radar, palancas) {
  const filas = palancas
    .map((palanca) => `
      <li>
        <span class="resumen-palanca"><em style="background:${COLOR_DE_PALANCA[palanca.key]}"></em>${escapeHtml(palanca.label)}</span>
        ${svgBullet({
          valor: palanca.media,
          objetivo: palanca.objetivo,
          color: COLOR_DE_PALANCA[palanca.key],
          etiqueta: `${palanca.label}: ${formatNumber(palanca.media)} de 5, objetivo ${formatNumber(palanca.objetivo)}`,
        })}
        <span class="resumen-palanca-cifra">${escapeHtml(formatMedia(palanca.media))} <small>/ ${escapeHtml(formatMedia(palanca.objetivo))}</small></span>
      </li>
    `)
    .join("");

  return `
    <section class="resumen-bloque resumen-madurez">
      <h3>Madurez por dominio</h3>
      ${
        radar
          ? `<img class="radar" src="${escapeAttr(radar)}" alt="Radar de la madurez media de cada dominio frente a su objetivo">`
          : `<p class="nota resumen-sin-radar">No se pudo dibujar el radar: la librería de gráficos no cargó.</p>`
      }
      <p class="nota">Un eje por dominio. El área es la madurez media y la línea discontinua, el objetivo.</p>
      ${filas ? `<ul class="resumen-palancas">${filas}</ul>` : ""}
    </section>
  `;
}


export function brechas(datos) {
  const lista = datos?.lista || [];

  if (!lista.length) {
    return `
      <section class="resumen-bloque">
        <h3>Las mayores brechas</h3>
        <p class="nota">Ninguna subcapacidad puntuada queda por debajo de su objetivo.</p>
      </section>
    `;
  }

  const titulo = lista.length === 1 ? "La mayor brecha" : `Las ${lista.length} mayores brechas`;
  const de = datos.total > lista.length ? `<span>de ${formatNumber(datos.total)} por debajo del objetivo</span>` : "";

  return `
    <section class="resumen-bloque">
      <h3>${escapeHtml(titulo)} ${de}</h3>
      <ol class="resumen-brechas">
        ${lista
          .map((fila, indice) => `
            <li>
              <span class="resumen-orden">${indice + 1}</span>
              <div>
                <span class="brecha-capacidad">${escapeHtml(fila.dominio)} · ${escapeHtml(fila.capacidad)}</span>
                <p class="resumen-brecha-nombre">${escapeHtml(fila.subcapacidad)}</p>
              </div>
              ${svgBullet({
                valor: fila.scoreMedio,
                objetivo: fila.targetMedio,
                etiqueta: `${fila.subcapacidad}: ${formatNumber(fila.scoreMedio)} de 5, objetivo ${formatNumber(fila.targetMedio)}`,
              })}
              <div class="resumen-gap">
                <strong>${escapeHtml(formatMedia(fila.gap))}</strong>
                <span><em style="background:${priorityColor(fila.prioridad)}"></em>${escapeHtml(fila.prioridad)}</span>
              </div>
            </li>
          `)
          .join("")}
      </ol>
    </section>
  `;
}


export function pasos(lista) {
  if (!lista.length) {
    return `
      <section class="resumen-bloque">
        <h3>Próximos pasos</h3>
        <p class="nota">
          Todavía no hay próximos pasos apuntados. Se acuerdan al cierre de cada taller, en el modo
          taller, y salen aquí y en el acta.
        </p>
      </section>
    `;
  }

  const visibles = lista.slice(0, PASOS_EN_EL_RESUMEN);
  const resto = lista.length - visibles.length;
  const acortado = visibles.some((paso) => String(paso.accion || "").trim().length > LARGO_DE_ACCION_EN_EL_RESUMEN);
  const aviso = resto
    ? `y ${resto} más en el acta de cada dominio`
    : acortado
      ? "el texto completo, en el acta de cada dominio"
      : "";

  return `
    <section class="resumen-bloque">
      <h3>Próximos pasos acordados ${aviso ? `<span>${escapeHtml(aviso)}</span>` : ""}</h3>
      <ol class="resumen-pasos">
        ${visibles
          .map((paso, indice) => {
            const detalle = [paso.dominio, paso.responsable, paso.fecha].filter(Boolean).join(" · ");

            return `
              <li>
                <span class="resumen-orden">${indice + 1}</span>
                <div>
                  <p class="resumen-paso-accion">${escapeHtml(acortar(paso.accion))}</p>
                  ${detalle ? `<span class="resumen-paso-detalle">${escapeHtml(detalle)}</span>` : ""}
                </div>
              </li>
            `;
          })
          .join("")}
      </ol>
    </section>
  `;
}


/** Por la ultima palabra entera que cabe, y con puntos suspensivos: que se vea que sigue. */
export function acortar(texto, largo = LARGO_DE_ACCION_EN_EL_RESUMEN) {
  const limpio = String(texto || "").trim();

  if (limpio.length <= largo) {
    return limpio;
  }

  const corte = limpio.slice(0, largo - 1);
  const espacio = corte.lastIndexOf(" ");

  return `${(espacio > largo / 2 ? corte.slice(0, espacio) : corte).replace(/[\s,.;:]+$/, "")}…`;
}


/**
 * Lo propio de esta diapositiva, encima de la hoja del deck. Mas apretado que
 * el deck en todo: aqui caben cuatro diapositivas en una. Medido con
 * ?comprobar=desbordes con los nueve dominios, seis pasos y las acciones mas
 * largas.
 */
function estilosDelResumen() {
  return `
    .resumen .resumen-cabecera {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10mm;
      padding-bottom: 3mm;
      margin-bottom: 3.5mm;
    }

    .resumen h2 {
      font-size: 17pt;
    }

    .resumen .titular {
      margin-top: 2mm;
      max-width: 260mm;
      padding-left: 3.5mm;
      font-size: 9.6pt;
      line-height: 1.35;
    }

    .resumen-logo {
      flex: 0 0 auto;
      max-width: 48mm;
      max-height: 16mm;
      object-fit: contain;
    }

    .resumen-pila {
      gap: 4mm;
    }

    .resumen .rejilla-kpi {
      gap: 4mm;
    }

    /* La cifra y su nota en la misma linea: la tarjeta del deck, a media altura. */
    .resumen .kpi {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 3.5mm;
      align-items: end;
      padding: 2.8mm 4mm 3mm;
      border-top-width: 1mm;
    }

    .resumen .kpi span {
      grid-column: 1 / -1;
      margin-bottom: 1.5mm;
      font-size: 6.6pt;
    }

    .resumen .kpi strong {
      font-size: 20pt;
    }

    .resumen .kpi small {
      margin: 0;
      font-size: 6.8pt;
      line-height: 1.3;
    }

    .resumen-centro {
      display: grid;
      grid-template-columns: 96mm 1fr;
      gap: 9mm;
      min-height: 0;
    }

    .resumen-derecha {
      display: flex;
      flex-direction: column;
      gap: 3.5mm;
      min-height: 0;
    }

    /* Sin encogerse: si no cabe, que se mida como desborde y no se monte encima. */
    .resumen-derecha > .resumen-bloque {
      flex: 0 0 auto;
    }

    .resumen-bloque {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .resumen-bloque h3 {
      display: flex;
      align-items: baseline;
      gap: 2.5mm;
      margin: 0 0 1.5mm;
      padding-bottom: 1.5mm;
      border-bottom: 0.7pt solid ${PALETA.linea};
      font-size: 7.2pt;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: ${PALETA.tintaSuave};
    }

    .resumen-bloque h3 span {
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: none;
      color: ${PALETA.tintaTenue};
    }

    .resumen .radar {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      width: 100%;
      object-fit: contain;
    }

    .resumen-sin-radar {
      flex: 1 1 auto;
    }

    .resumen-madurez > .nota {
      margin: 1mm 0 2mm;
      font-size: 6.8pt;
      text-align: center;
    }

    .resumen-palancas {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .resumen-palancas li {
      display: grid;
      grid-template-columns: 27mm 1fr 17mm;
      gap: 3mm;
      align-items: center;
      padding: 1mm 0;
    }

    .resumen-palanca {
      display: inline-flex;
      align-items: center;
      gap: 1.8mm;
      font-size: 7.6pt;
      font-weight: 700;
    }

    .resumen-palanca em {
      width: 2.2mm;
      height: 2.2mm;
      border-radius: 50%;
    }

    .resumen-palancas .grafico {
      height: 3mm;
    }

    .resumen-palanca-cifra {
      text-align: right;
      font-size: 8.6pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .resumen-palanca-cifra small {
      font-weight: 500;
      color: ${PALETA.tintaTenue};
    }

    .resumen-brechas,
    .resumen-pasos {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .resumen-brechas li {
      display: grid;
      grid-template-columns: 5mm 1fr 34mm 15mm;
      gap: 3.5mm;
      align-items: center;
      padding: 1.1mm 0;
      border-bottom: 0.6pt solid ${PALETA.linea};
    }

    .resumen-brechas li:last-child {
      border-bottom: 0;
    }

    .resumen-orden {
      font-size: 11pt;
      font-weight: 700;
      line-height: 1.1;
      color: ${PALETA.lineaFuerte};
      font-variant-numeric: tabular-nums;
    }

    .resumen .brecha-capacidad {
      font-size: 6.4pt;
    }

    .resumen-brecha-nombre {
      margin: 0.3mm 0 0;
      font-size: 8.4pt;
      font-weight: 600;
      line-height: 1.25;
    }

    .resumen-brechas .grafico {
      height: 3mm;
    }

    .resumen-gap {
      text-align: right;
    }

    .resumen-gap strong {
      display: block;
      font-size: 13pt;
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .resumen-gap span {
      display: inline-flex;
      align-items: center;
      gap: 1.2mm;
      margin-top: 0.8mm;
      font-size: 6.6pt;
      font-weight: 700;
      color: ${PALETA.tintaSuave};
    }

    .resumen-gap em {
      width: 1.9mm;
      height: 1.9mm;
      border-radius: 50%;
    }

    /* En columnas y no en filas: se lee de arriba abajo, como se apuntaron. */
    .resumen-pasos {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, auto);
      grid-auto-flow: column;
      gap: 2.2mm 8mm;
    }

    .resumen-pasos li {
      display: grid;
      grid-template-columns: 5mm 1fr;
      gap: 3mm;
      align-items: start;
    }

    .resumen-paso-accion {
      margin: 0;
      font-size: 8.2pt;
      font-weight: 600;
      line-height: 1.25;
    }

    .resumen-paso-detalle {
      display: block;
      margin-top: 0.4mm;
      font-size: 6.8pt;
      color: ${PALETA.tintaTenue};
    }
  `;
}
