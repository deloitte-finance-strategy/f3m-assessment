/**
 * El cierre del taller: la ultima pantalla del modo taller, para proyectarla
 * al terminar la sesion.
 *
 * El final de un taller se improvisaba de palabra, con la herramienta de
 * trabajo detras. Aqui sale la foto de lo que ha salido: cuanto se ha
 * puntuado, las tres subcapacidades mas lejos del objetivo, cada palanca
 * frente a su objetivo y lo que queda para la proxima sesion.
 *
 * Dice lo mismo que el acta, con las mismas funciones (fraseDelActa y
 * resumenDelActa): el cliente recibe despues por escrito la pantalla que acaba
 * de ver. Por eso, desde aqui mismo se genera el acta y se copia el correo.
 *
 * Solo pinta. Que pantalla toca y que pasa al pulsar lo decide app/taller.js.
 */

import { BRECHAS_EN_EL_CORREO, fraseDelActa, resumenDelActa } from "../informe/acta.js?v=28";
import { NIVELES_DE_LA_RUBRICA } from "../informe/preparacion.js?v=28";
import { getMaturityLevelNumber } from "../core/calculo.js?v=28";
import { escapeAttr, escapeHtml, formatMedia, formatNumber } from "../core/presentacion.js?v=28";
import { priorityBadge } from "./celdas.js?v=28";


/** Cuantas pendientes se nombran; del resto se dice cuantas son. */
const PENDIENTES_A_LA_VISTA = 4;


/**
 * `datos` es lo mismo que recibe el acta (datosDelActa() en app/informe.js),
 * con el id de cada subcapacidad para poder volver a ella. `cambiadasHoy` son
 * las que se han puntuado o cambiado desde que se abrio el modo taller.
 */
export function htmlDelCierre(datos, { cambiadasHoy = 0 } = {}) {
  const cifras = resumenDelActa(datos.subcapacidades);
  const { resumen } = cifras;
  const hayPuntuadas = resumen.evaluadas > 0;

  return `
    <div class="modo-taller-cabecera modo-taller-cierre-cabecera">
      <span class="capability-chip">Cierre del taller</span>
      <h2 id="modoTallerTitulo" tabindex="-1">Lo que ha salido de la sesión</h2>
      <p>${hayPuntuadas
        ? fraseDelActa(datos)
        : `Todavía no hay nada puntuado en ${escapeHtml(datos.domainLabel || "este dominio")}: el cierre resume lo que se puntúa en el taller.`}</p>
    </div>

    <div class="modo-taller-cierre-cifras">
      ${tarjeta(
        "Puntuadas",
        `${resumen.evaluadas}<small>/${resumen.total}</small>`,
        cambiadasHoy
          ? `${cambiadasHoy === 1 ? "una" : formatNumber(cambiadasHoy)} en esta sesión`
          : "subcapacidades",
      )}
      ${tarjeta("Nivel medio", hayPuntuadas ? formatMedia(resumen.scoreGlobal) : "—", hayPuntuadas ? escapeHtml(nombreDelNivel(resumen.scoreGlobal)) : "sin puntuar")}
      ${tarjeta("Gap medio", hayPuntuadas ? formatMedia(resumen.gapMedio) : "—", "frente al objetivo")}
      ${tarjeta("Prioridad alta", formatNumber(resumen.prioridadAlta), "con gap de 2 o más")}
    </div>

    <div class="modo-taller-cierre-columnas">
      <section>
        <h4>Más lejos del objetivo</h4>
        ${brechas(cifras.brechas.slice(0, BRECHAS_EN_EL_CORREO), hayPuntuadas)}
      </section>

      <section>
        <h4>Por palanca</h4>
        ${palancas(cifras.palancas)}
        <p class="modo-taller-cierre-nota">La barra es la media de lo puntuado; la línea, el objetivo.</p>
      </section>

      <section>
        <h4>Para la próxima sesión</h4>
        ${pendientes(cifras.pendientes)}
      </section>
    </div>
  `;
}


/** Los dos botones del pie del cierre: lo que se hace justo despues de la sesion. */
export function accionesDelCierre(datos) {
  const apagado = resumenDelActa(datos.subcapacidades).resumen.evaluadas ? "" : " disabled";

  return `
    <button class="modo-taller-accion" type="button" data-cierre="acta"${apagado}>Acta del taller</button>
    <button class="modo-taller-accion" type="button" data-cierre="correo"${apagado}>Copiar el texto del correo</button>
  `;
}


function tarjeta(titulo, cifra, detalle) {
  return `
    <div class="modo-taller-cierre-kpi">
      <span>${titulo}</span>
      <b>${cifra}</b>
      <small>${detalle}</small>
    </div>
  `;
}


function nombreDelNivel(score) {
  return NIVELES_DE_LA_RUBRICA[getMaturityLevelNumber(score) - 1] || "";
}


/**
 * Cada una es un boton que vuelve a su subcapacidad: la pregunta natural al
 * verlas en la sala es «¿y esa por que?», y la respuesta esta en sus notas.
 */
function brechas(lista, hayPuntuadas) {
  if (!lista.length) {
    return `<p class="modo-taller-cierre-vacio">${hayPuntuadas
      ? "Ninguna subcapacidad puntuada queda por debajo de su objetivo."
      : "Aparecerán al puntuar."}</p>`;
  }

  return `
    <ol class="modo-taller-cierre-brechas">
      ${lista.map(({ item, metrics }) => `
        <li>
          <button type="button" data-ir="${escapeAttr(item.id || "")}">
            <span class="modo-taller-cierre-sub">${escapeHtml(item.subcapacidad)}</span>
            <span class="modo-taller-cierre-meta">
              ${escapeHtml(item.capacidad)} · gap <strong>${formatMedia(metrics.gap)}</strong>
              ${priorityBadge(metrics.prioridad)}
            </span>
          </button>
        </li>
      `).join("")}
    </ol>
  `;
}


function palancas(lista) {
  return lista.map((palanca) => {
    const conMedia = Number.isFinite(palanca.media);

    return `
      <div class="modo-taller-cierre-palanca">
        <span class="modo-taller-cierre-palanca-nombre">
          <span class="modo-taller-punto modo-taller-punto-${escapeAttr(palanca.key)}" aria-hidden="true"></span>
          ${escapeHtml(palanca.label)}
        </span>
        <span class="modo-taller-cierre-pista" aria-hidden="true">
          <span class="modo-taller-cierre-valor modo-taller-punto-${escapeAttr(palanca.key)}" style="width:${conMedia ? (palanca.media / 5) * 100 : 0}%"></span>
          <span class="modo-taller-cierre-objetivo" style="left:${(palanca.objetivo / 5) * 100}%"></span>
        </span>
        <span class="modo-taller-cierre-cifra">${conMedia
          ? `<strong>${formatMedia(palanca.media)}</strong> de ${formatObjetivo(palanca.objetivo)}`
          : "Sin puntuar"}</span>
      </div>
    `;
  }).join("");
}


/** Como en el acta: un objetivo de capacidad es un entero, y uno medio puede no serlo. */
function formatObjetivo(valor) {
  return Number.isInteger(valor) ? formatNumber(valor) : formatMedia(valor);
}


function pendientes(lista) {
  if (!lista.length) {
    return `<p class="modo-taller-cierre-vacio">Nada pendiente: todo lo de este taller está puntuado.</p>`;
  }

  const resto = lista.length - PENDIENTES_A_LA_VISTA;

  return `
    <p class="modo-taller-cierre-cuantas">
      <strong>${formatNumber(lista.length)}</strong> ${lista.length === 1 ? "subcapacidad sin puntuar" : "subcapacidades sin puntuar"}
    </p>
    <ul class="modo-taller-cierre-pendientes">
      ${lista.slice(0, PENDIENTES_A_LA_VISTA).map(({ item }) => `
        <li><button type="button" data-ir="${escapeAttr(item.id || "")}">${escapeHtml(item.subcapacidad)}</button></li>
      `).join("")}
      ${resto > 0 ? `<li class="modo-taller-cierre-mas">y ${formatNumber(resto)} más</li>` : ""}
    </ul>
  `;
}
