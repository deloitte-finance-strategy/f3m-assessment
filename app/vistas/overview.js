/**
 * El Overview: la funcion financiera entera, los nueve dominios a la vez.
 *
 * Es la unica vista que NO aplica los filtros, y es deliberado: son del dominio
 * abierto, asi que a nivel global no significan nada. Por eso lee state.domains
 * via getDominiosDelOverview() y no getScopedItems().
 */

import { masUrgentes, rankingDePalancas, resumenGlobal, unique } from "../../core/calculo.js?v=27";
import { escapeAttr, escapeHtml, formatMedia } from "../../core/presentacion.js?v=27";
import {
  celdaDeAvance,
  gapClass,
  heatScoreCell,
  kpiCard,
  priorityBadge,
  renderLeverBars,
  renderPriorityBars,
} from "../celdas.js?v=27";
import {
  DOMAINS,
  GRUPOS_DE_DOMINIO,
  LEVERS,
  els,
  state,
  syncActiveDomainState,
} from "../estado.js?v=27";
import { renderOverviewRadar } from "../graficos.js?v=27";
import { agregarPorDominio, getCapabilityTargets } from "../metricas.js?v=27";


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
      formatMedia(resumenDelOverview.scoreGlobal),
      evaluadas.length
        // Se dice "subcapacidades" y no "dominios" a proposito: si no, alguien
        // promedia a mano las nueve cifras de la tabla y no le cuadra.
        ? "Promedio de las subcapacidades puntuadas de todos los dominios"
        : "Pendiente de scoring",
      "score",
    ),
    kpiCard(
      "Gap medio vs objetivo",
      formatMedia(resumenDelOverview.gapMedio),
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
  renderLoMasUrgente(filas, entradas);
  renderOverviewRadar(filas);
}


/**
 * «Lo más urgente de la función financiera»: las diez iniciativas de prioridad
 * alta con mas gap, de cualquier dominio. Para saberlo antes habia que abrir el
 * Roadmap de los nueve uno a uno y comparar de memoria.
 *
 * Cada una es un boton que lleva a su tarjeta en el Assessment de su dominio,
 * donde estan sus scores y el porque. A donde se va lo decide app.js, que es
 * quien cambia de dominio y de vista.
 */
function renderLoMasUrgente(filas, entradas) {
  if (!els.overviewUrgentes) {
    return;
  }

  const { lista, total } = masUrgentes(entradas, 10);
  const nombreDe = new Map(filas.map((fila) => [fila.id, fila.label]));
  const evaluadas = entradas.some((entrada) => !entrada.metrics.isPending);

  if (els.overviewUrgentesNota) {
    els.overviewUrgentesNota.textContent = !total
      ? "Iniciativas de prioridad alta de todos los dominios, por gap"
      : total > lista.length
        ? `Las ${lista.length} de mayor gap, de ${total} con prioridad alta en todos los dominios. Pulsa una para verla en su dominio`
        : `${total === 1 ? "La única" : `Las ${total}`} con prioridad alta en todos los dominios, por gap. Pulsa una para verla en su dominio`;
  }

  if (!lista.length) {
    els.overviewUrgentes.innerHTML = `
      <li class="urgentes-vacio small-note">
        ${evaluadas
          ? "Ninguna subcapacidad tiene prioridad alta: ningún gap llega a 2 en lo puntuado."
          : "Todavía no hay nada puntuado. Aquí saldrán las iniciativas de prioridad alta de todos los dominios."}
      </li>
    `;
    return;
  }

  els.overviewUrgentes.innerHTML = lista
    .map(({ item, domainId, metrics }) => `
      <li>
        <button
          class="urgente"
          type="button"
          data-dominio="${escapeAttr(domainId)}"
          data-id="${escapeAttr(item.id)}"
          title="${escapeAttr(`Abrir en el Assessment de ${nombreDe.get(domainId) || domainId}`)}"
        >
          <span class="urgente-gap ${gapClass(metrics.gap)}">
            <strong>${escapeHtml(formatMedia(metrics.gap))}</strong>
            <span>gap</span>
          </span>
          <span class="urgente-cuerpo">
            <span class="urgente-donde">${escapeHtml(nombreDe.get(domainId) || domainId)} · ${escapeHtml(item.capacidad)}</span>
            <span class="urgente-titulo">${escapeHtml(item.subcapacidad)}</span>
            ${item.iniciativaSugerida
              ? `<span class="urgente-iniciativa">${escapeHtml(item.iniciativaSugerida)}</span>`
              : ""}
          </span>
        </button>
      </li>
    `)
    .join("");
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
      `Dominio con mayor brecha: ${porGap[0].label} (gap ${formatMedia(porGap[0].gap)})`,
    );
  }

  const porPalanca = rankingDePalancas(entradas.map((entrada) => entrada.item));

  if (porPalanca.length) {
    titulares.push(
      `Palanca más débil: ${porPalanca[0].label} (${formatMedia(porPalanca[0].media)})`,
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


/**
 * La tabla por dominio, con los colores del Heatmap en las medias y el gap.
 *
 * En gris era una rejilla de cifras que habia que leer una a una para saber que
 * dominio y que palanca estaban peor, que es la primera pregunta del Overview.
 * La escala es la misma del Heatmap, celda a celda, y no una propia: el mismo
 * 2,40 tiene que salir del mismo color en las dos vistas. El objetivo se queda
 * sin color porque es configuracion, no una medida.
 */
function renderOverviewSummaryTable(filas) {
  const rows = filas.map(
    (fila) => `
      <tr class="${fila.evaluadas === 0 ? "is-pending" : ""}" data-abrir-dominio="${escapeAttr(fila.id)}">
        <td>
          <button class="fila-enlace" type="button" title="Abrir el Dashboard de ${escapeAttr(fila.label)}">${escapeHtml(fila.label)}</button>
        </td>

        <td class="number">
          ${fila.capacidades}
        </td>

        ${heatScoreCell(fila.procesos, formatMedia, "number")}
        ${heatScoreCell(fila.tecnologia, formatMedia, "number")}
        ${heatScoreCell(fila.organizacion, formatMedia, "number")}
        ${heatScoreCell(fila.scoreMedio, formatMedia, "number")}

        <td class="number">
          ${formatMedia(fila.targetMedio)}
        </td>

        <td class="number heat-cell ${gapClass(fila.gap)}">
          ${formatMedia(fila.gap)}
        </td>

        <td>
          ${priorityBadge(fila.prioridad)}
        </td>

        <td class="number">
          ${celdaDeAvance(fila.evaluadas, fila.total)}
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
