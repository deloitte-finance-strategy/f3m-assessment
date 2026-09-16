/**
 * Los tres filtros, y el ambito de datos que sale de ellos.
 *
 * getScopedItems() es la UNICA fuente de subcapacidades para el dominio abierto:
 * dashboard, resumen, radares, heatmap, roadmap, CSV y PDF. Antes convivian dos
 * ambitos y el KPI decia "7 de prioridad alta" mientras el roadmap ensenaba 2 —y
 * el PDF exportado no coincidia con el Dashboard que el cliente acababa de ver.
 *
 * No hay objeto `filtros`: el DOM ES el estado. Los tres controles se leen
 * directamente, asi que no hay forma de que la pantalla y el filtro aplicado se
 * desincronicen.
 *
 * El Overview es la excepcion y no pasa por aqui: agrega los nueve dominios, y
 * estos filtros son del dominio abierto.
 */

import { escapeAttr, escapeHtml } from "../core/presentacion.js?v=11";
import { unique } from "../core/calculo.js?v=11";
import { LEVERS, els, state } from "./estado.js?v=11";
import {
  getItemEvidenceText,
  getItemObjective,
  getItemQuestions,
} from "./subcapacidad.js?v=11";
import { calculate, getCapabilityTargets } from "./metricas.js?v=11";
import { repintarTodo } from "./repintado.js?v=11";




export function populateCapacityFilter() {
  const previousCapacity = els.capacityFilter.value || "all";
  const capacities = unique(state.items.map((item) => item.capacidad));

  els.capacityFilter.innerHTML = [
    `<option value="all">Todas</option>`,
    ...capacities.map(
      (capability) =>
        `<option value="${escapeAttr(capability)}">${escapeHtml(capability)}</option>`,
    ),
  ].join("");

  const capacityStillExists =
    previousCapacity === "all" ||
    capacities.includes(previousCapacity);

  els.capacityFilter.value = capacityStillExists
    ? previousCapacity
    : "all";
}


/**
 * Que filtros hay puestos ahora mismo, con lo necesario para quitarlos uno a uno.
 */
export function getActiveFilters() {
  const filtros = [];

  if (els.capacityFilter.value && els.capacityFilter.value !== "all") {
    filtros.push({
      clave: "capacidad",
      etiqueta: "Capacidad",
      valor:
        els.capacityFilter.options[els.capacityFilter.selectedIndex]?.textContent?.trim() ||
        els.capacityFilter.value,
    });
  }

  if (els.priorityFilter.value && els.priorityFilter.value !== "all") {
    filtros.push({
      clave: "prioridad",
      etiqueta: "Prioridad",
      valor: els.priorityFilter.value,
    });
  }

  const busqueda = els.searchInput.value.trim();

  if (busqueda) {
    filtros.push({
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
    });
  }

  return filtros;
}


/**
 * Pinta los filtros activos en las tres vistas.
 *
 * Antes solo aparecia un "2 filtros activos" en el Assessment, con el detalle
 * escondido en un title: habia que pasar el raton para saber que se estaba
 * filtrando. Y el Heatmap, que tambien filtra, no decia nada. Ahora cada filtro
 * es un chip con su valor y su aspa para quitarlo suelto.
 */
export function updateActiveFiltersUi() {
  const contenedores = document.querySelectorAll("[data-active-filters]");

  if (!contenedores.length) {
    return;
  }

  const filtros = getActiveFilters();

  const html = filtros.length
    ? `
      <span class="active-filters-label">Filtrando por</span>

      ${filtros
        .map(
          (filtro) => `
            <span class="filter-chip">
              <span class="filter-chip-label">${escapeHtml(filtro.etiqueta)}:</span>
              <span class="filter-chip-value">${escapeHtml(filtro.valor)}</span>

              <button
                class="filter-chip-remove"
                type="button"
                data-remove-filter="${escapeAttr(filtro.clave)}"
                aria-label="${escapeAttr(`Quitar el filtro ${filtro.etiqueta}: ${filtro.valor}`)}"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </span>
          `,
        )
        .join("")}

      <button class="clear-filters-button" type="button" data-clear-filters>
        Limpiar todos
      </button>
    `
    : "";

  contenedores.forEach((contenedor) => {
    contenedor.hidden = !filtros.length;
    contenedor.innerHTML = html;
  });
}


/** Quita un solo filtro sin tocar los demas. */
export function removeActiveFilter(clave) {
  if (clave === "capacidad") {
    els.capacityFilter.value = "all";
  } else if (clave === "prioridad") {
    els.priorityFilter.value = "all";
  } else if (clave === "busqueda") {
    window.clearTimeout(temporizadorDeBusqueda);
    els.searchInput.value = "";
  } else {
    return;
  }

  repintarTodo();
}


// Cada pulsacion lanzaba un renderAll completo, radares de Chart.js incluidos:
// escribir ocho letras costaba 235 ms de trabajo bloqueante y se notaba al
// teclear. Con una pausa corta, ocho pulsaciones son un solo repintado.
const BUSQUEDA_DIFERIDA_MS = 200;




let temporizadorDeBusqueda = null;




export function handleSearchInput() {
  window.clearTimeout(temporizadorDeBusqueda);

  temporizadorDeBusqueda = window.setTimeout(() => {
    repintarTodo();
  }, BUSQUEDA_DIFERIDA_MS);
}




export function clearActiveFilters() {
  window.clearTimeout(temporizadorDeBusqueda);

  els.capacityFilter.value = "all";
  els.priorityFilter.value = "all";
  els.searchInput.value = "";

  repintarTodo();
}


/**
 * Las subcapacidades sobre las que trabaja TODA la herramienta.
 *
 * Antes convivían dos ámbitos: Dashboard, resumen, radares y CSV calculaban
 * sobre state.items, mientras que Heatmap, Roadmap y el PDF lo hacían sobre las
 * filtradas. Con un filtro puesto, el KPI decía "7 de prioridad alta" y el
 * Roadmap enseñaba 2 — y el PDF exportado no coincidía con el Dashboard que el
 * cliente acababa de ver en pantalla.
 *
 * Ahora hay un único ámbito. getVisibleItems() se mantiene como alias para no
 * tocar las llamadas existentes.
 */
export function getScopedItems() {
  return getVisibleItems();
}


/**
 * Resume el objetivo de madurez del dominio en una frase honesta.
 *
 * La cabecera afirmaba "Objetivo de madurez 4" leyendo meta.targetMaturity, un
 * valor unico del JSON. Pero el objetivo se configura por capacidad y por
 * palanca en el panel que hay justo debajo, asi que en cuanto alguien tocaba
 * uno, la cabecera mentia.
 */
export function describirObjetivos() {
  const valores = unique(
    state.items.flatMap((item) => {
      const objetivos = getCapabilityTargets(item.capacidad);
      return LEVERS.map((lever) => objetivos[lever.key]);
    }),
  ).sort((a, b) => a - b);

  if (!valores.length) {
    return null;
  }

  if (valores.length === 1) {
    return `Objetivo de madurez ${valores[0]}`;
  }

  return `Objetivos entre ${valores[0]} y ${valores[valores.length - 1]}`;
}


/** Si hay filtros activos, cuántas subcapacidades quedan dentro y fuera. */
export function getScopeSummary() {
  const total = state.items.length;
  const visibles = getScopedItems().length;

  return {
    total,
    visibles,
    hayFiltros: visibles !== total,
  };
}


/**
 * El texto sobre el que busca el buscador, armado una sola vez por
 * subcapacidad.
 *
 * Sale de campos que vienen del JSON y no se editan nunca, asi que basta con
 * guardarlo. Antes se recomponia —ocho campos, un toList por preguntas, un join
 * y un toLowerCase— para cada item y en cada una de las llamadas a
 * getVisibleItems, incluso cuando el buscador estaba vacio.
 */
const cacheDeTextoBuscable = new WeakMap();




function getTextoBuscable(item) {
  const guardado = cacheDeTextoBuscable.get(item);

  if (guardado !== undefined) {
    return guardado;
  }

  const texto = [
    item.capacidad,
    item.subcapacidad,
    getItemObjective(item),
    getItemQuestions(item).join(" "),
    getItemEvidenceText(item),
    item.iniciativaSugerida,
    item.ai?.cases,
    item.ai?.advanced,
  ]
    .join(" ")
    .toLowerCase();

  cacheDeTextoBuscable.set(item, texto);

  return texto;
}




export function getVisibleItems() {
  const capacity = els.capacityFilter.value;
  const priority = els.priorityFilter.value;
  const query = els.searchInput.value.trim().toLowerCase();

  return state.items.filter((item) => {
    if (capacity !== "all" && item.capacidad !== capacity) {
      return false;
    }

    if (priority !== "all" && calculate(item).prioridad !== priority) {
      return false;
    }

    return !query || getTextoBuscable(item).includes(query);
  });
}
