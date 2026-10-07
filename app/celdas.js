/**
 * Los fragmentos de HTML que comparten varias vistas.
 *
 * Son cadenas y no DOM, asi que cabrian en core/. No van ahi porque core/ es el
 * motor de calculo y estas son decisiones de pantalla: que una prioridad sin
 * informar se lea "Pendiente" en vez de quedarse en blanco, como se ofrece salir
 * de un filtro que no deja nada, y la forma de una tarjeta de KPI o de una barra.
 *
 * Y no van dentro de una vista porque ninguna es de una sola: el badge y el
 * estado vacio los usan cuatro de las cinco, y los KPIs y las barras, el Dashboard
 * y el Overview. Una copia por vista es como dos pantallas de la misma herramienta
 * empiezan a decir cosas distintas con los mismos datos.
 *
 * Las fichas de los casos de IA llegaron por lo mismo: vivian en el Assessment y
 * las pedia prestadas el modal del Roadmap; con la pestana IA ya son tres sitios.
 */

import { average } from "../core/calculo.js?v=23";
import {
  escapeAttr,
  escapeHtml,
  formatMedia,
  priorityColor,
} from "../core/presentacion.js?v=23";
import { pieDeFuente } from "./biblioteca.js?v=23";
import { LEVERS, els, state } from "./estado.js?v=23";
import { getScopedItems } from "./filtros.js?v=23";


export function buildFilteredEmptyState() {
  return `
    <div class="filtered-empty-state">
      <strong>No hay resultados para los filtros actuales</strong>

      <p>
        Prueba con otros criterios o limpia los filtros para volver a mostrar
        toda la información.
      </p>

      <button
        class="clear-filters-button empty-state-clear-button"
        type="button"
        data-clear-filters
      >
        Limpiar filtros
      </button>
    </div>
  `;
}


export function priorityBadge(priority) {
  const safePriority = priority || "Pendiente";
  return `<span class="priority-badge ${safePriority.toLowerCase()}">${escapeHtml(safePriority)}</span>`;
}


export function kpiCard(label, value, note, tone = "neutral") {
  return `
    <article class="kpi-card kpi-card-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>
  `;
}


export function renderPriorityBars(entries, destino = els.priorityBars) {
  if (!destino) {
    return;
  }

  const counts = { Alta: 0, Media: 0, Baja: 0, Pendiente: 0 };
  entries.forEach((entry) => {
    counts[entry.metrics.prioridad] += 1;
  });
  const max = Math.max(...Object.values(counts), 1);
  destino.innerHTML = Object.entries(counts)
    .map(([label, count]) => {
      const width = Math.round((count / max) * 100);
      return barRow(label, count, width, priorityColor(label));
    })
    .join("");
}


export function renderLeverBars(items = getScopedItems(), destino = els.leverBars) {
  if (!destino) {
    return;
  }

  const rows = LEVERS.map((lever) => {
    const avg = average(
      items
        .map((item) => item.scores[lever.key])
        .filter((value) => Number.isFinite(value)),
    );

    const width = avg ? Math.round((avg / 5) * 100) : 0;

    return barRow(
      lever.label,
      formatMedia(avg),
      width,
      lever.color,
    );
  });

  destino.innerHTML = rows.join("");
}


function barRow(label, value, width, color) {
  // La barra es un grafico, y sin role ni nombre era un span vacio: un lector
  // de pantalla leia la etiqueta y la cifra sueltas, sin nada que las uniera.
  // El aria-hidden del track evita que la barra se anuncie dos veces.
  return `
    <div class="bar-row" role="img" aria-label="${escapeAttr(`${label}: ${value}`)}">
      <span class="bar-label" aria-hidden="true">${escapeHtml(label)}</span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${width}%;background:${color}"></span></span>
      <span class="bar-value" aria-hidden="true">${escapeHtml(String(value))}</span>
    </div>
  `;
}


/**
 * La columna «Avance» de las dos tablas resumen: la cifra y una barra al lado.
 *
 * La cifra sola obligaba a leer nueve «7/24» y hacer la cuenta para saber que
 * dominio esta terminado; la barra lo dice de un vistazo, que es lo que se
 * pregunta en un taller. La cifra se queda porque la barra no dice cuantas
 * faltan. Terminado no estrena color, solo pone la cifra en negrita: la barra
 * llena ya lo dice, y un color de "completo" seria uno mas que aprender.
 */
export function celdaDeAvance(evaluadas, total) {
  const porcentaje = total ? Math.round((evaluadas / total) * 100) : 0;
  const completo = total > 0 && evaluadas >= total;

  return `
    <span class="avance${completo ? " avance-completo" : ""}">
      <span class="avance-pista" aria-hidden="true"><span class="avance-relleno" style="width:${porcentaje}%"></span></span>
      <span class="avance-cifra">${evaluadas}/${total}</span>
    </span>
  `;
}


/**
 * Las dos etiquetas de un caso no estrenan familia de color, y no es una
 * limitacion: el sistema ya esta lleno. El verde, el naranja y el azul marino
 * son las palancas; el rojo, el ambar y el verde son la prioridad; el teal es
 * el nivel de madurez y el azul es el estado. Una sexta familia no significaria
 * nada y le quitaria significado a las cinco que ya lo tienen.
 *
 * Se diferencian por peso dentro de la familia neutra. El tipo de valor lleva
 * chip relleno porque es el eje que ordena la conversacion con el cliente
 * —coste, riesgo, decision o P&L—, y el tipo de IA va con borde y fondo
 * transparente porque es un calificativo tecnico.
 *
 * Y dos excepciones tonales, no cromaticas, que es lo que permite destacar sin
 * romper nada:
 *
 * - "Agéntica" en oscuro de alto contraste, porque es lo que todo el mundo
 *   pregunta ahora mismo y se busca con la vista.
 * - "Automatización" en el tratamiento mas apagado del conjunto. Es la etiqueta
 *   honesta de "esto no es IA de verdad" y no debe lucir como si lo fuera.
 */
const CLASE_DE_TIPO_DE_IA = {
  Agéntica: "es-agentica",
  Automatización: "es-automatizacion",
};


/**
 * Las clases del chip de cada etiqueta. Las usan la ficha y la leyenda de la
 * pestana IA, que tienen que pintar el mismo chip: si cada una llevara su copia,
 * una etiqueta nueva podria salir destacada en las fichas y apagada en la
 * leyenda que la explica.
 */
export const CLASES_DE_TIPO_DE_VALOR = "ai-tag ai-tag-valor";

export function clasesDeTipoDeIa(valor) {
  return `ai-tag ai-tag-ia ${CLASE_DE_TIPO_DE_IA[valor] || ""}`.trim();
}


function aiCaseTag(valor, definicion, clases) {
  if (!valor) {
    return "";
  }

  const titulo = definicion ? ` title="${escapeAttr(definicion)}"` : "";

  return `<span class="${clases}"${titulo}>${escapeHtml(valor)}</span>`;
}


/**
 * Una ficha de caso: titulo, las dos etiquetas, la frase de que hace y, si se
 * sabe, el documento del que sale, con el boton que lo abre.
 *
 * 'donde' solo lo trae la pestana IA. En la tarjeta y en el modal la ficha ya
 * esta dentro de una subcapacidad; suelta en el catalogo, lo primero que se
 * pregunta de un caso es en que parte del modelo aparece.
 */
function aiCaseCard(caso, donde = "") {
  const etiquetas = [
    aiCaseTag(caso.tipoValor, caso.definicionTipoValor, CLASES_DE_TIPO_DE_VALOR),
    aiCaseTag(caso.tipoIa, caso.definicionTipoIa, clasesDeTipoDeIa(caso.tipoIa)),
  ].join("");

  return `
    <li class="ai-case">
      <p class="ai-case-title">${escapeHtml(caso.titulo)}</p>
      ${etiquetas ? `<p class="ai-case-tags">${etiquetas}</p>` : ""}
      ${
        caso.descripcion
          ? `<p class="ai-case-description">${escapeHtml(caso.descripcion)}</p>`
          : ""
      }
      ${donde ? `<p class="ai-case-donde">${escapeHtml(donde)}</p>` : ""}
      ${pieDeFuente(caso)}
    </li>
  `;
}


/**
 * La lista de fichas, igual en la tarjeta, en el modal del roadmap y en la
 * pestana IA. 'donde', si llega, es una funcion caso -> texto.
 */
export function aiCaseCards(casos, { donde } = {}) {
  if (!casos?.length) {
    return `<p class="small-note">Sin casos de uso de IA asociados informados.</p>`;
  }

  const fichas = casos.map((caso) => aiCaseCard(caso, donde ? donde(caso) : ""));

  return `<ul class="ai-case-list">${fichas.join("")}</ul>`;
}


/** El contador que acompaña al titulo de la seccion. */
export function pintarContadorDeCasos(elemento, casos) {
  if (!elemento) {
    return;
  }

  elemento.textContent = casos.length ? String(casos.length) : "";
  elemento.hidden = !casos.length;
}
