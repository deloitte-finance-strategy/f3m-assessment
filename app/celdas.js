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
 */

import { average } from "../core/calculo.js?v=11";
import {
  escapeAttr,
  escapeHtml,
  formatNumber,
  priorityColor,
} from "../core/presentacion.js?v=11";
import { LEVERS, els, state } from "./estado.js?v=11";
import { getScopedItems } from "./filtros.js?v=11";


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
      formatNumber(avg),
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
