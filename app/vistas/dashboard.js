/**
 * El Dashboard: el dominio abierto, con sus KPIs, titulares y tabla resumen.
 *
 * Lee getScopedItems(), asi que si respeta los filtros. El descuadre con el
 * Overview cuando hay uno puesto no es un fallo: son dos preguntas distintas, y
 * las dos vistas lo dicen en pantalla.
 */

import { rankingDeBrechas, rankingDePalancas, resumenGlobal } from "../../core/calculo.js?v=11";
import { filasDeResumen } from "../../core/exportacion.js?v=11";
import { escapeHtml, formatNumber } from "../../core/presentacion.js?v=11";
import {
  buildFilteredEmptyState,
  kpiCard,
  priorityBadge,
  renderLeverBars,
  renderPriorityBars,
} from "../celdas.js?v=11";
import { els, state } from "../estado.js?v=11";
import { getScopedItems } from "../filtros.js?v=11";
import { renderCapabilityRadar } from "../graficos.js?v=11";
import { agregarPorCapacidad, calculate } from "../metricas.js?v=11";


export function renderDashboard() {
  const items = getScopedItems();
  const metrics = items.map((item) => ({ item, metrics: calculate(item) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);
  const { scoreGlobal, gapMedio, prioridadAlta: highCount } = resumenGlobal(metrics);


els.kpiGrid.innerHTML = [
  kpiCard(
    "Score global dominio",
    formatNumber(scoreGlobal),
    scored.length
      ? "Promedio de subcapacidades puntuadas"
      : "Pendiente de scoring",
    "score",
  ),
  kpiCard(
    "Gap medio vs objetivo",
    formatNumber(gapMedio),
    "Calculado con los objetivos definidos por capacidad y palanca",
    "gap",
  ),
  kpiCard(
    "Subcapacidades puntuadas",
    `${scored.length}/${items.length}`,
    items.length
      ? `${Math.round((scored.length / items.length) * 100)}% de avance`
      : "Sin subcapacidades en la vista",
    "progress",
  ),
  kpiCard(
    "Prioridad alta",
    String(highCount),
    "Subcapacidades con gap igual o superior a 2",
    highCount > 0 ? "alert" : "neutral",
  ),
].join("");


  renderTitularesEjecutivos(items, metrics);
  renderPriorityBars(metrics);
  renderLeverBars();
  renderSummaryTable();
  renderCapabilityRadar(buildSummaryRows()); // NUEVO: actualiza radar al recalcular dashboard
}


/**
 * Los tres titulares que resumen el dominio en una frase.
 *
 * Todo esto estaba calculado y repartido entre cuatro KPIs, dos graficos de
 * barras, una tabla y tres radares: habia que deducirlo. Para explicar el
 * dominio en dos minutos hace falta poder leerlo.
 */
function renderTitularesEjecutivos(items, metrics) {
  if (!els.dashboardHeadline) {
    return;
  }

  const evaluadas = metrics.filter((entrada) => !entrada.metrics.isPending);

  // "No hay nada puntuado" y "los filtros no dejan ver nada" son dos cosas
  // distintas, y decir la primera cuando pasa la segunda es afirmar algo falso
  // delante del cliente: el trabajo esta hecho, solo que fuera del filtro.
  //
  // renderAll() ya sale antes si el dominio no tiene subcapacidades, asi que
  // aqui una lista vacia solo puede venir de un filtro.
  if (!items.length) {
    els.dashboardHeadline.hidden = false;
    els.dashboardHeadline.textContent =
      `Ninguna de las ${state.items.length} subcapacidades de este dominio pasa los filtros activos. `
        + "Quita alguno para volver a ver el resumen.";
    return;
  }

  if (!evaluadas.length) {
    els.dashboardHeadline.hidden = false;
    els.dashboardHeadline.textContent =
      "Todavía no hay ninguna subcapacidad puntuada: empieza por la pestaña Assessment.";
    return;
  }

  const titulares = [];

  // Capacidad con mayor brecha y palanca mas floja. El calculo vive en
  // core/calculo.js porque el Overview y el informe PDF hacen el mismo con
  // distinto sujeto, y eran tres copias.
  const porCapacidad = rankingDeBrechas(metrics, (entrada) => entrada.item.capacidad);

  if (porCapacidad.length) {
    titulares.push(
      `Mayor brecha: ${porCapacidad[0].grupo} (gap ${formatNumber(porCapacidad[0].gap)})`,
    );
  }

  const porPalanca = rankingDePalancas(items);

  if (porPalanca.length) {
    titulares.push(
      `Palanca más débil: ${porPalanca[0].label} (${formatNumber(porPalanca[0].media)})`,
    );
  }

  // Lo que queda por evaluar
  const pendientes = metrics.length - evaluadas.length;

  titulares.push(
    pendientes
      ? `Quedan ${pendientes} subcapacidades por evaluar`
      : "Todas las subcapacidades están evaluadas",
  );

  els.dashboardHeadline.hidden = false;
  els.dashboardHeadline.textContent = titulares.join(" · ");
}


function renderSummaryTable() {
  const rows = agregarPorCapacidad(getScopedItems()).map(
    (capacidad) => `
      <tr class="${capacidad.evaluadas === 0 ? "is-pending" : ""}">
        <td>${escapeHtml(capacidad.capacidad)}</td>

        <td class="number">
          ${formatNumber(capacidad.procesos)}
        </td>

        <td class="number">
          ${formatNumber(capacidad.tecnologia)}
        </td>

        <td class="number">
          ${formatNumber(capacidad.organizacion)}
        </td>

        <td class="number">
          ${formatNumber(capacidad.scoreMedio)}
        </td>

        <td class="number">
          ${formatNumber(capacidad.targetMedio)}
        </td>

        <td class="number">
          ${formatNumber(capacidad.gap)}
        </td>

        <td>
          ${priorityBadge(capacidad.prioridad)}
        </td>

        <td class="number">
          ${capacidad.evaluadas}/${capacidad.total}
        </td>
      </tr>
    `,
  );

  els.summaryTable.innerHTML = `
    <caption class="solo-lectores">Resumen por capacidad: medias por palanca, score medio, objetivo, gap y prioridad.</caption>

    <thead>
      <tr>
        <th scope="col">Capacidad</th>
        <th scope="col" class="number">Procesos</th>
        <th scope="col" class="number">Tecnología</th>
        <th scope="col" class="number">Organización</th>
        <th scope="col" class="number">Score medio</th>
        <th scope="col" class="number">Objetivo medio</th>
        <th scope="col" class="number">Gap vs objetivo</th>
        <th scope="col">Prioridad</th>
        <th scope="col" class="number">Avance</th>
      </tr>
    </thead>

    <tbody>
      ${rows.join("") || `
        <tr>
          <td colspan="9" class="table-empty-cell">
            ${buildFilteredEmptyState()}
          </td>
        </tr>
      `}
    </tbody>
  `;
}


/**
 * Las filas de resumen del CSV, para el ambito visible.
 *
 * Es la capa fina que conoce el estado: filasDeResumen() vive en core/ porque
 * es pura, y aqui solo se le dice sobre que subcapacidades trabajar.
 */
export function buildSummaryRows() {
  return filasDeResumen(agregarPorCapacidad(getScopedItems()));
}
