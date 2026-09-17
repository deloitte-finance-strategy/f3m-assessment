/**
 * El Overview: la funcion financiera entera, los nueve dominios a la vez.
 *
 * Es la unica vista que NO aplica los filtros, y es deliberado: son del dominio
 * abierto, asi que a nivel global no significan nada. Por eso lee state.domains
 * via getDominiosDelOverview() y no getScopedItems().
 */

import { rankingDePalancas, resumenGlobal, unique } from "../../core/calculo.js?v=12";
import { escapeHtml, formatNumber } from "../../core/presentacion.js?v=12";
import { kpiCard, priorityBadge, renderLeverBars, renderPriorityBars } from "../celdas.js?v=12";
import {
  DOMAINS,
  GRUPOS_DE_DOMINIO,
  LEVERS,
  els,
  state,
  syncActiveDomainState,
} from "../estado.js?v=12";
import { renderOverviewRadar } from "../graficos.js?v=12";
import { agregarPorDominio, getCapabilityTargets } from "../metricas.js?v=12";


/**
 * Los dominios cargados, en el orden del conmutador, con sus subcapacidades.
 *
 * Se recorren los grupos del catalogo y no las claves de state.domains: el orden
 * en que terminan nueve fetch en paralelo no es el orden en que se leen los
 * dominios, y la tabla bailaria entre recargas.
 *
 * Los que no hayan podido cargarse se saltan, igual que hace
 * actualizarAvanceDeDominios(). El Overview cuenta sobre los que hay y lo dice:
 * un "8/8" honesto vale mas que un "8/9" que finge saber algo del noveno.
 */
export function getDominiosDelOverview() {
  // Los scores del dominio abierto viven en state.items hasta que alguien los
  // devuelve a state.domains. Hoy son la misma referencia; esta es la red que lo
  // garantiza si algun dia deja de serlo, como en buildScenarioPayload().
  syncActiveDomainState();

  const dominios = Object.values(DOMAINS);

  const grupos = GRUPOS_DE_DOMINIO.length
    ? GRUPOS_DE_DOMINIO
    : unique(dominios.map((dominio) => dominio.group));

  return grupos.flatMap((grupo) =>
    dominios
      .filter(
        (dominio) =>
          dominio.group === grupo && state.domains[dominio.id],
      )
      .map((dominio) => ({
        id: dominio.id,
        label: dominio.label,
        items: state.domains[dominio.id].items,
      })),
  );
}


/** describirObjetivos(), pero mirando los nueve dominios a la vez. */
function describirObjetivosDeTodos(dominios) {
  const valores = unique(
    dominios.flatMap((dominio) =>
      dominio.items.flatMap((item) => {
        const objetivos = getCapabilityTargets(
          item.capacidad,
          dominio.id,
        );

        return LEVERS.map((lever) => objetivos[lever.key]);
      }),
    ),
  ).sort((a, b) => a - b);

  if (!valores.length) {
    return null;
  }

  if (valores.length === 1) {
    return `Objetivo de madurez ${valores[0]}`;
  }

  return `Objetivos entre ${valores[0]} y ${valores[valores.length - 1]}`;
}


export function renderOverview() {
  // Un index.html cacheado de una version anterior no tiene estos nodos: GitHub
  // Pages sirve el HTML y el JS con cachés independientes, asi que la pareja
  // "HTML viejo + app.js nuevo" es un caso real y no una hipotesis. Sin esto,
  // cambiar de pestana dejaria la aplicacion a medias y en silencio.
  if (!els.overviewKpiGrid || !els.overviewSummaryTable) {
    return;
  }

  const dominios = getDominiosDelOverview();

  if (!dominios.length) {
    return;
  }

  const filas = agregarPorDominio(dominios);

  // Las subcapacidades de los nueve, cada una con su dominio y sus metricas al
  // lado. No se aplanan a secas: un item no sabe de que dominio es, y de eso
  // dependen sus objetivos y por tanto su gap.
  const entradas = filas.flatMap((fila) =>
    fila.items.map((item, indice) => ({
      item,
      domainId: fila.id,
      metrics: fila.metricas[indice],
    })),
  );

  const resumenDelOverview = resumenGlobal(entradas);

  const evaluadas = entradas.filter(
    (entrada) => !entrada.metrics.isPending,
  );

  const prioridadAlta = resumenDelOverview.prioridadAlta;

  const sinCargar = Object.keys(DOMAINS).length - filas.length;

  els.overviewSourceNote.textContent = [
    `${entradas.length} subcapacidades en ${filas.length} dominios`,
    describirObjetivosDeTodos(dominios),
    sinCargar
      ? `${sinCargar} dominio${sinCargar > 1 ? "s" : ""} sin cargar`
      : null,
    "No depende de los filtros activos",
  ]
    .filter(Boolean)
    .join(" · ");

  els.overviewKpiGrid.innerHTML = [
    kpiCard(
      "Score global F3M",
      formatNumber(resumenDelOverview.scoreGlobal),
      evaluadas.length
        // Se dice "subcapacidades" y no "dominios" a proposito: si no, alguien
        // promedia a mano las nueve cifras de la tabla y no le cuadra.
        ? "Promedio de las subcapacidades puntuadas de todos los dominios"
        : "Pendiente de scoring",
      "score",
    ),
    kpiCard(
      "Gap medio vs objetivo",
      formatNumber(resumenDelOverview.gapMedio),
      "Cada dominio contra sus propios objetivos por capacidad y palanca",
      "gap",
    ),
    kpiCard(
      "Subcapacidades puntuadas",
      `${evaluadas.length}/${entradas.length}`,
      entradas.length
        ? `${Math.round((evaluadas.length / entradas.length) * 100)}% de avance`
        : "Sin subcapacidades",
      "progress",
    ),
    kpiCard(
      "Prioridad alta",
      String(prioridadAlta),
      "Subcapacidades con gap igual o superior a 2",
      prioridadAlta > 0 ? "alert" : "neutral",
    ),
  ].join("");

  renderOverviewHeadline(filas, entradas);
  renderPriorityBars(entradas, els.overviewPriorityBars);
  renderLeverBars(
    entradas.map((entrada) => entrada.item),
    els.overviewLeverBars,
  );
  renderOverviewSummaryTable(filas);
  renderOverviewRadar(filas);
}


/**
 * Los tres titulares del Overview.
 *
 * Hermana de renderTitularesEjecutivos() y no la misma funcion: alli el sujeto
 * es la capacidad y hay un mensaje entero para cuando los filtros no dejan ver
 * nada, que aqui seria falso. Unificarlas costaria dos condicionales de modo.
 *
 * Lo que si comparten es el calculo, que vive en core/calculo.js desde que el
 * informe PDF necesito el mismo y habria sido la tercera copia. La brecha por
 * dominio no pasa por rankingDeBrechas(): aqui ya viene promediada en `filas`
 * por agregarPorDominio(), y volver a calcularla desde las subcapacidades seria
 * hacer dos veces lo mismo con dos codigos distintos.
 */
function renderOverviewHeadline(filas, entradas) {
  if (!els.overviewHeadline) {
    return;
  }

  const evaluadas = entradas.filter(
    (entrada) => !entrada.metrics.isPending,
  );

  if (!evaluadas.length) {
    els.overviewHeadline.hidden = false;
    els.overviewHeadline.textContent =
      "Todavía no hay ninguna subcapacidad puntuada en ningún dominio: "
        + "empieza por la pestaña Assessment.";
    return;
  }

  const titulares = [];

  const porGap = filas
    .filter((fila) => Number.isFinite(fila.gap))
    .sort((a, b) => b.gap - a.gap);

  if (porGap.length) {
    titulares.push(
      `Dominio con mayor brecha: ${porGap[0].label} (gap ${formatNumber(porGap[0].gap)})`,
    );
  }

  const porPalanca = rankingDePalancas(entradas.map((entrada) => entrada.item));

  if (porPalanca.length) {
    titulares.push(
      `Palanca más débil: ${porPalanca[0].label} (${formatNumber(porPalanca[0].media)})`,
    );
  }

  const pendientes = entradas.length - evaluadas.length;

  const aMedias = filas.filter(
    (fila) => fila.evaluadas < fila.total,
  ).length;

  titulares.push(
    pendientes
      ? `Quedan ${pendientes} subcapacidades por evaluar en ${aMedias} dominios`
      : "Todos los dominios están evaluados por completo",
  );

  els.overviewHeadline.hidden = false;
  els.overviewHeadline.textContent = titulares.join(" · ");
}


function renderOverviewSummaryTable(filas) {
  const rows = filas.map(
    (fila) => `
      <tr class="${fila.evaluadas === 0 ? "is-pending" : ""}">
        <td>${escapeHtml(fila.label)}</td>

        <td class="number">
          ${fila.capacidades}
        </td>

        <td class="number">
          ${formatNumber(fila.procesos)}
        </td>

        <td class="number">
          ${formatNumber(fila.tecnologia)}
        </td>

        <td class="number">
          ${formatNumber(fila.organizacion)}
        </td>

        <td class="number">
          ${formatNumber(fila.scoreMedio)}
        </td>

        <td class="number">
          ${formatNumber(fila.targetMedio)}
        </td>

        <td class="number">
          ${formatNumber(fila.gap)}
        </td>

        <td>
          ${priorityBadge(fila.prioridad)}
        </td>

        <td class="number">
          ${fila.evaluadas}/${fila.total}
        </td>
      </tr>
    `,
  );

  // Sin estado vacio: renderOverview() ya sale antes si no hay ningun dominio
  // cargado, y aqui no hay filtros que puedan dejar la tabla a cero.
  els.overviewSummaryTable.innerHTML = `
    <caption class="solo-lectores">Resumen por dominio: capacidades, medias por palanca, score medio, objetivo, gap y prioridad.</caption>

    <thead>
      <tr>
        <th scope="col">Dominio</th>
        <th scope="col" class="number">Capacidades</th>
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
      ${rows.join("")}
    </tbody>
  `;
}
