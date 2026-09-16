/**
 * Los fragmentos de HTML que comparten varias vistas.
 *
 * Son cadenas y no DOM, asi que cabrian en core/. No van ahi porque core/ es
 * el motor de calculo y estas dos son decisiones de pantalla: que una prioridad
 * sin informar se lea "Pendiente" en vez de quedarse en blanco, y como se ofrece
 * salir de un filtro que no deja nada.
 *
 * Y no van dentro de una vista porque las usan cuatro de las cinco. Una copia
 * por vista es como dos pantallas de la misma herramienta empiezan a decir cosas
 * distintas con los mismos datos.
 */

import { escapeHtml } from "../core/presentacion.js?v=11";

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
