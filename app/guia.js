/**
 * La guia de scoring del modo taller: la rubrica general de cada palanca,
 * la del modal «Criterios F3M», en el sitio de los cinco niveles.
 *
 * En la tarjeta del Assessment la guia es un modal, y aqui no podia serlo: lo
 * que se pregunta en la sala es «¿esto en Tecnologia es un 3 o un 4?», y un
 * modal tapaba la escala en la que se contesta. Ocupa el sitio de los niveles
 * de la subcapacidad, que son lo que se deja de leer mientras se mira la guia,
 * y la escala, las preguntas y las notas siguen debajo, a mano.
 *
 * Es una tabla con una columna por palanca, en el orden de la escala de
 * debajo, y una fila por nivel. Se probo al reves, con los niveles en columnas
 * como la pantalla de siempre, y no cabia: el checklist de cada palanca, en
 * una columna estrecha, ocupaba cuatro renglones por fila y la tabla se comia
 * la escala a 1366×768. En cada columna se marca donde esta hoy la palanca y
 * su objetivo, que es lo que se compara.
 *
 * Solo pinta. Cuando se enseña y que pasa al pulsar lo decide app/taller.js.
 */

import {
  CHECKLIST_DE_LA_RUBRICA,
  NIVELES_DE_LA_RUBRICA,
  QUE_MIDE,
  RUBRICA_GENERAL,
} from "../informe/preparacion.js?v=35";
import { escapeAttr, escapeHtml } from "../core/presentacion.js?v=35";


/** Oculta: la enseña el boton «Guía de scoring» de la banda. */
export function htmlDeLaGuia(palancas = []) {
  return `
    <section class="modo-taller-guia" id="modoTallerGuia" aria-labelledby="modoTallerGuiaTitulo" hidden>
      <table>
        <thead>
          <tr>
            <td class="modo-taller-guia-esquina">
              <strong id="modoTallerGuiaTitulo">Guía de scoring</strong>
              <small>Común a todos los dominios</small>
            </td>
            ${palancas.map(cabeceraDePalanca).join("")}
          </tr>
        </thead>
        <tbody>
          ${NIVELES_DE_LA_RUBRICA.map((nombre, posicion) => filaDeNivel(nombre, posicion + 1, palancas)).join("")}
        </tbody>
      </table>
    </section>
  `;
}


function cabeceraDePalanca(palanca) {
  const checklist = CHECKLIST_DE_LA_RUBRICA[palanca.key] || [];

  // Separados por un espacio: sin el, los puntos del checklist no tenian por
  // donde partirse y se salian de la columna.
  return `
    <th scope="col" data-palanca="${escapeAttr(palanca.key)}">
      <span class="modo-taller-guia-palanca">
        <span class="modo-taller-punto modo-taller-punto-${escapeAttr(palanca.key)}" aria-hidden="true"></span>
        ${escapeHtml(palanca.label)}
      </span>
      <span class="solo-lectores">: ${escapeHtml(QUE_MIDE[palanca.key] || "")}.</span>
      <ul class="modo-taller-guia-checklist" aria-label="Checklist">
        ${checklist.map((punto) => `<li>${escapeHtml(punto)}</li>`).join(" ")}
      </ul>
    </th>
  `;
}


function filaDeNivel(nombre, nivel, palancas) {
  return `
    <tr>
      <th scope="row" class="modo-taller-guia-nivel modo-taller-guia-nivel-${nivel}">
        <span>${nivel}</span> ${escapeHtml(nombre)}
      </th>
      ${palancas
        .map(
          (palanca) => `
            <td data-palanca="${escapeAttr(palanca.key)}" data-nivel="${nivel}">
              <span class="modo-taller-guia-marcas"></span>
              ${escapeHtml(RUBRICA_GENERAL[palanca.key]?.[nivel - 1] || "")}
            </td>
          `,
        )
        .join("")}
    </tr>
  `;
}


/**
 * Donde esta hoy cada palanca y su objetivo, en su columna. `objetivos` son
 * los de la capacidad, por palanca, y se redondean como en la escala de
 * puntuar: el recuadro de la escala y el de la guia caen en el mismo nivel.
 *
 * Devuelve las marcas que acaban de aparecer, para que solo salten esas.
 */
export function pintarMarcasDeLaGuia(guia, { scores = {}, objetivos = {} } = {}) {
  if (!guia) {
    return [];
  }

  const antes = new Set([...guia.querySelectorAll("[data-marca]")].map((marca) => marca.dataset.marca));

  guia.querySelectorAll("td[data-nivel]").forEach((celda) => {
    const palanca = celda.dataset.palanca;
    const nivel = Number(celda.dataset.nivel);
    const hoy = Number(scores[palanca]) || null;
    const objetivo = Number.isFinite(Number(objetivos[palanca])) ? Math.round(objetivos[palanca]) : null;
    const marcas = [];

    if (nivel === hoy) {
      marcas.push(`<span class="modo-taller-marca modo-taller-marca-media" data-marca="hoy:${palanca}:${nivel}">Hoy</span>`);
    }

    if (nivel === objetivo) {
      marcas.push(`<span class="modo-taller-marca modo-taller-marca-objetivo" data-marca="objetivo:${palanca}:${nivel}">Objetivo</span>`);
    }

    celda.querySelector(".modo-taller-guia-marcas").innerHTML = marcas.join("");
    celda.classList.toggle("es-hoy", nivel === hoy);
  });

  return [...guia.querySelectorAll("[data-marca]")].filter((marca) => !antes.has(marca.dataset.marca));
}
