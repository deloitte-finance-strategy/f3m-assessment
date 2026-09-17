/**
 * El Heatmap: una fila por capacidad, desplegable a sus subcapacidades.
 *
 * Primera vista que sale de app.js. Se lleva heatScoreCell() y gapClass()
 * porque no las usa nadie mas; priorityBadge() y buildFilteredEmptyState() se
 * quedan en app/celdas.js, que es de donde tiran las otras cuatro vistas.
 *
 * Lo que pinta sale de getScopedItems(), que es la unica fuente de
 * subcapacidades del dominio abierto. Leer state.items directamente daria otro
 * recuento que el de los KPIs y el roadmap, que es el descuadre que esa regla
 * existe para impedir.
 */

import { getMaturityLevelNumber, priorityFromGap } from "../../core/calculo.js?v=12";
import { escapeAttr, escapeHtml, formatNumber } from "../../core/presentacion.js?v=12";

import { LEVERS, els, expandedHeatmapCapabilities } from "../estado.js?v=12";
import { agregarPorCapacidad } from "../metricas.js?v=12";
import { getScopedItems } from "../filtros.js?v=12";
import { buildFilteredEmptyState, priorityBadge } from "../celdas.js?v=12";

export function renderHeatmap() {
  const capabilityRows = agregarPorCapacidad(getScopedItems());

  const rows = capabilityRows
    .map((entry) => {
      const isExpanded = expandedHeatmapCapabilities.has(entry.capacidad);

      const detailRows = entry.items
        .map((item, indice) => {
          const metrics = entry.metricas[indice];

          return `
            <tr class="heatmap-detail-row ${isExpanded ? "" : "is-hidden"}" data-capability-detail="${escapeAttr(entry.capacidad)}">
              <td class="heatmap-detail-capability">${escapeHtml(item.capacidad)}</td>
              <td>${escapeHtml(item.subcapacidad)}</td>
              ${LEVERS.map((lever) => heatScoreCell(item.scores[lever.key])).join("")}
              ${heatScoreCell(metrics.scoreMedio)}
              <td class="heat-cell ${gapClass(metrics.gap)}">${formatNumber(metrics.gap)}</td>
              <td>${priorityBadge(metrics.prioridad)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <tr class="heatmap-capability-row">
          <td>
            <strong>${escapeHtml(entry.capacidad)}</strong>
          </td>
          <td>
            <button
              class="heatmap-toggle"
              type="button"
              data-capability-toggle="${escapeAttr(entry.capacidad)}"
              aria-expanded="${String(isExpanded)}"
            >
              ${isExpanded ? "Ocultar subcapacidades" : `Ver subcapacidades (${entry.items.length})`}
            </button>
          </td>
          ${heatScoreCell(entry.procesos)}
          ${heatScoreCell(entry.tecnologia)}
          ${heatScoreCell(entry.organizacion)}
          ${heatScoreCell(entry.scoreMedio)}
          <td class="heat-cell ${gapClass(entry.gap)}">${formatNumber(entry.gap)}</td>
          <td>${priorityBadge(entry.prioridad)}</td>
        </tr>
        ${detailRows}
      `;
    })
    .join("");

  els.heatmapTable.innerHTML = `
    <caption class="solo-lectores">Heatmap de madurez por capacidad, desplegable a subcapacidad.</caption>

    <thead>
      <tr>
        <th scope="col">Capacidad</th>
        <th scope="col">Subcapacidades</th>
        <th scope="col" class="number">Procesos</th>
        <th scope="col" class="number">Tecnología</th>
        <th scope="col" class="number">Organización</th>
        <th scope="col" class="number">Score medio</th>
        <th scope="col" class="number">Gap vs objetivo</th>
        <th scope="col">Prioridad</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `
        <tr>
          <td colspan="8" class="table-empty-cell">
            ${buildFilteredEmptyState()}
          </td>
        </tr>
      `}
    </tbody>
  `;

  els.heatmapTable.querySelectorAll(".heatmap-toggle").forEach((button) => {
    button.addEventListener("click", handleHeatmapToggle);
  });

  updateHeatmapExpandAllButton(capabilityRows); // NUEVO: sincroniza texto Expandir/Colapsar todo

}


function handleHeatmapToggle(event) {
  const button = event.currentTarget;
  const capability = button.dataset.capabilityToggle;
  const isExpanded = button.getAttribute("aria-expanded") === "true";
  const nextExpanded = !isExpanded;

  if (nextExpanded) {
    expandedHeatmapCapabilities.add(capability);
  } else {
    expandedHeatmapCapabilities.delete(capability);
  }

  const detailRows = els.heatmapTable.querySelectorAll(
    `[data-capability-detail="${CSS.escape(capability)}"]`,
  );

  button.setAttribute("aria-expanded", String(nextExpanded));
  button.textContent = nextExpanded
    ? "Ocultar subcapacidades"
    : `Ver subcapacidades (${detailRows.length})`;

  detailRows.forEach((row) => {
    row.classList.toggle("is-hidden", !nextExpanded);
  });
}


export function handleHeatmapExpandToggleAll() {
  const capabilityRows = agregarPorCapacidad(getScopedItems());
  const visibleCapabilities = capabilityRows.map((entry) => entry.capacidad);

  if (!visibleCapabilities.length) {
    return;
  }

  const allExpanded = visibleCapabilities.every((capability) =>
    expandedHeatmapCapabilities.has(capability),
  );

  if (allExpanded) {
    visibleCapabilities.forEach((capability) => {
      expandedHeatmapCapabilities.delete(capability);
    });
  } else {
    visibleCapabilities.forEach((capability) => {
      expandedHeatmapCapabilities.add(capability);
    });
  }

  renderHeatmap();
}


function updateHeatmapExpandAllButton(capabilityRows) {
  if (!els.heatmapExpandToggle) {
    return;
  }

  const visibleCapabilities = capabilityRows.map((entry) => entry.capacidad);
  const allExpanded =
    visibleCapabilities.length > 0 &&
    visibleCapabilities.every((capability) => expandedHeatmapCapabilities.has(capability));

  els.heatmapExpandToggle.textContent = allExpanded ? "Colapsar todo" : "Expandir todo";
  els.heatmapExpandToggle.disabled = visibleCapabilities.length === 0;
}


/**
 * Una celda del heatmap. Sin puntuar es un guion, nunca un cero.
 *
 * Number(null) es 0, y 0 pasa Number.isFinite. Por eso una capacidad sin
 * ninguna subcapacidad puntuada se pintaba con un 0 en las cuatro columnas
 * numericas, y en rojo, porque 0 cae en el tramo mas bajo de la escala.
 *
 * Delante de un cliente eso afirma algo que no es cierto: que esa capacidad
 * esta evaluada y con la peor nota posible, cuando lo que pasa es que todavia
 * no se ha evaluado. La tabla resumen del Dashboard, con los mismos datos,
 * enseña un guion. Dos vistas de la misma herramienta decian cosas distintas.
 */
function heatScoreCell(value) {
  const sinValor = value === null || value === undefined || value === "";
  const number = sinValor ? NaN : Number(value);

  if (!Number.isFinite(number)) {
    return `<td class="heat-cell heat-blank">-</td>`;
  }

  // El nivel sale de getMaturityLevelNumber(), que es donde vive el redondeo
  // acotado del modelo. Aqui estaba reimplementado en linea, asi que eran dos
  // definiciones de "que nivel es un 3,5" a dos lineas de distancia.
  return `<td class="heat-cell heat-${getMaturityLevelNumber(number)}">${formatNumber(number)}</td>`;
}


/**
 * La clase de color de una celda de gap.
 *
 * Los cortes los pone priorityFromGap(), que es la regla de negocio. Estaban
 * repetidos aqui como 2 y 1 sueltos: mover el umbral de Alta en el motor habria
 * dejado el heatmap pintando de rojo un gap que la tabla llamaba Media.
 */
const CLASE_DE_GAP = {
  Alta: "gap-high",
  Media: "gap-mid",
  Baja: "gap-low",
};


function gapClass(value) {
  if (!Number.isFinite(value)) return "heat-blank";

  return CLASE_DE_GAP[priorityFromGap(value)] || "gap-low";
}
