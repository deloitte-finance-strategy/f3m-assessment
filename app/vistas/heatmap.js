/**
 * El Heatmap: una fila por capacidad, desplegable a sus subcapacidades.
 *
 * Primera vista que sale de app.js. heatScoreCell() y gapClass() nacieron aqui
 * y se fueron a app/celdas.js cuando la tabla del Overview empezo a pintar el
 * mismo color: una escala copiada en dos vistas acaba diciendo dos cosas.
 *
 * Lo que pinta sale de getScopedItems(), que es la unica fuente de
 * subcapacidades del dominio abierto. Leer state.items directamente daria otro
 * recuento que el de los KPIs y el roadmap, que es el descuadre que esa regla
 * existe para impedir.
 */

import { escapeAttr, escapeHtml, formatMedia, formatNumber } from "../../core/presentacion.js?v=32";

import { LEVERS, els, expandedHeatmapCapabilities, state } from "../estado.js?v=32";
import { agregarPorCapacidad } from "../metricas.js?v=32";
import { getScopedItems } from "../filtros.js?v=32";
import { buildFilteredEmptyState, gapClass, heatScoreCell, priorityBadge } from "../celdas.js?v=32";
import { entrar, sinMovimiento } from "../movimiento.js?v=32";


/**
 * Lo que se vio la ultima vez que se pinto, para animar solo lo que ha
 * cambiado desde entonces: el color de cada celda y las capacidades que se han
 * desplegado. De otro dominio no sirve de nada, y se descarta.
 */
let pintadoAnterior = { dominio: null, tema: null, desplegadas: new Set() };

// Cambiar de tema cambia todos los colores a la vez, y eso no es una celda que
// se mueve: se pinta de golpe, como el resto de la pagina.
const temaActual = () => document.documentElement.dataset.tema || "";

export function renderHeatmap() {
  const capabilityRows = agregarPorCapacidad(getScopedItems());

  const rows = capabilityRows
    .map((entry) => {
      const isExpanded = expandedHeatmapCapabilities.has(entry.capacidad);

      const detailRows = entry.items
        .map((item, indice) => {
          const metrics = entry.metricas[indice];

          return `
            <tr
              class="heatmap-detail-row ${isExpanded ? "" : "is-hidden"}"
              data-capability-detail="${escapeAttr(entry.capacidad)}"
              data-fila="s:${escapeAttr(item.id || item.subcapacidad)}"
              ${item.id ? `data-abrir-subcapacidad="${escapeAttr(item.id)}"` : ""}
            >
              <td class="heatmap-detail-capability">${escapeHtml(item.capacidad)}</td>
              <td>${item.id
                ? `<button class="fila-enlace" type="button" title="Abrir su tarjeta en el Assessment">${escapeHtml(item.subcapacidad)}</button>`
                : escapeHtml(item.subcapacidad)}</td>
              ${LEVERS.map((lever) => heatScoreCell(item.scores[lever.key], formatNumber)).join("")}
              ${heatScoreCell(metrics.scoreMedio)}
              <td class="heat-cell ${gapClass(metrics.gap)}">${formatMedia(metrics.gap)}</td>
              <td>${priorityBadge(metrics.prioridad)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <tr class="heatmap-capability-row" data-fila="c:${escapeAttr(entry.capacidad)}">
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
          <td class="heat-cell ${gapClass(entry.gap)}">${formatMedia(entry.gap)}</td>
          <td>${priorityBadge(entry.prioridad)}</td>
        </tr>
        ${detailRows}
      `;
    })
    .join("");

  const coloresDeAntes = pintadoAnterior.dominio === state.activeDomainId && pintadoAnterior.tema === temaActual()
    ? leerColores()
    : new Map();
  const desplegadasAntes = pintadoAnterior.dominio === state.activeDomainId
    ? pintadoAnterior.desplegadas
    : new Set(expandedHeatmapCapabilities);

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

  fundirLosColoresQueCambian(coloresDeAntes);

  // «Expandir todo» repinta la tabla: lo recien desplegado entra igual que al
  // abrir una capacidad sola.
  capabilityRows
    .filter(({ capacidad }) => expandedHeatmapCapabilities.has(capacidad) && !desplegadasAntes.has(capacidad))
    .forEach(({ capacidad }) => desplegarFilas(filasDe(capacidad)));

  pintadoAnterior = {
    dominio: state.activeDomainId,
    tema: temaActual(),
    desplegadas: new Set(expandedHeatmapCapabilities),
  };

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

  pintadoAnterior.desplegadas = new Set(expandedHeatmapCapabilities);

  if (nextExpanded) {
    detailRows.forEach((row) => row.classList.remove("is-hidden"));
    desplegarFilas(detailRows);
    return;
  }

  plegarFilas(detailRows, () => !expandedHeatmapCapabilities.has(capability));
}


function filasDe(capacidad) {
  return els.heatmapTable.querySelectorAll(`[data-capability-detail="${CSS.escape(capacidad)}"]`);
}


/**
 * Las subcapacidades entran una detras de otra, bajando unos pixeles: lo de
 * debajo se aparta y se ve de donde salen. Una tabla no anima su alto —sus
 * filas no tienen uno propio que transicionar—, asi que es la entrada de cada
 * fila la que hace de despliegue. Con muchas, el escalonado se corta: la
 * ultima no puede tardar medio segundo en llegar.
 */
function desplegarFilas(filas) {
  [...filas].forEach((fila, indice) => {
    entrar(fila, { duracion: 220, retraso: Math.min(indice, 8) * 28, desplazamiento: -6 });
  });
}


/** Se funden antes de ocultarse. Si a mitad se vuelve a desplegar, se quedan. */
function plegarFilas(filas, siguePlegada) {
  const lista = [...filas];

  if (sinMovimiento() || !lista[0]?.animate) {
    lista.forEach((fila) => fila.classList.add("is-hidden"));
    return;
  }

  Promise.all(lista.map((fila) => fila.animate(
    [{ opacity: 1 }, { opacity: 0, translate: "0 -4px" }],
    { duration: 160, easing: "ease-in" },
  ).finished.catch(() => {}))).then(() => {
    if (siguePlegada()) {
      lista.forEach((fila) => fila.classList.add("is-hidden"));
    }
  });
}


/** El fondo y la letra de cada celda de color, por fila y columna. */
function leerColores() {
  const colores = new Map();

  els.heatmapTable.querySelectorAll("tr[data-fila]").forEach((fila) => {
    fila.querySelectorAll(".heat-cell").forEach((celda, indice) => {
      const estilo = getComputedStyle(celda);

      colores.set(`${fila.dataset.fila}|${indice}`, { fondo: estilo.backgroundColor, letra: estilo.color });
    });
  });

  return colores;
}


/**
 * Una celda que cambia de nivel funde su color del de antes al nuevo, en vez
 * de cambiarlo de golpe: con un compañero puntuando en el escenario
 * compartido, se ve que celda se ha movido sin buscarla.
 */
function fundirLosColoresQueCambian(antes) {
  if (!antes.size || sinMovimiento()) {
    return;
  }

  els.heatmapTable.querySelectorAll("tr[data-fila]").forEach((fila) => {
    if (fila.classList.contains("is-hidden")) {
      return;
    }

    fila.querySelectorAll(".heat-cell").forEach((celda, indice) => {
      const previo = antes.get(`${fila.dataset.fila}|${indice}`);

      if (!previo || !celda.animate) {
        return;
      }

      const estilo = getComputedStyle(celda);

      if (estilo.backgroundColor === previo.fondo && estilo.color === previo.letra) {
        return;
      }

      celda.animate(
        [
          { backgroundColor: previo.fondo, color: previo.letra },
          { backgroundColor: estilo.backgroundColor, color: estilo.color },
        ],
        { duration: 420, easing: "ease-out" },
      );
    });
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
