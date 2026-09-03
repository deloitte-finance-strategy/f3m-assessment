/**
 * El informe PDF: de los datos ya recogidos al HTML que se imprime.
 *
 * Eran unas 770 lineas dentro de app.js, hojas de estilo incluidas como cadena,
 * mezcladas con el resto de la aplicacion. Aqui no hay DOM ni estado global:
 * entra un objeto de datos —el que arma buildEnhancedPdfReportData() en
 * app.js, que es quien si conoce el estado— y sale el documento entero.
 *
 * El enfoque no cambia: ventana nueva y window.print(), sin dependencias.
 */

import { average } from "../core/calculo.js";

import {
  COLOR_DE_MARCA,
  COLOR_DE_MARCA_LEGIBLE,
  COLOR_DE_PALANCA,
  escapeAttr,
  escapeHtml,
  formatNumber,
  priorityColor,
} from "../core/presentacion.js";


export function buildEnhancedPdfReportHtml(data) {
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Informe ${escapeHtml(data.domainLabel)} Assessment</title>
        <style>
          ${getEnhancedPdfReportStyles()}
        </style>
      </head>
      <body>
        <main class="pdf-report">
          ${buildPdfEnhancedCover(data)}
          ${buildPdfEnhancedExecutiveSummary(data)}
          ${buildPdfEnhancedVisualSummarySection(data)}
          ${buildPdfEnhancedRadarSection(data)}
          ${buildPdfEnhancedSummarySection(data)}
          ${buildPdfEnhancedHeatmapSection(data)}
          ${buildPdfEnhancedPrioritiesSection(data)}
          ${buildPdfEnhancedRoadmapSection(data)}
          ${buildPdfEnhancedCommentsSection(data)}
        </main>
      </body>
    </html>
  `;
}


function buildPdfEnhancedCover(data) {
  return `
    <section class="pdf-page pdf-cover">
      <div class="pdf-cover-accent"></div>
      <p class="pdf-eyebrow">Finance Strategy · F3M Assessment</p>
        <h1>Informe preliminar de madurez · ${escapeHtml(data.domainLabel)}</h1>
      <p class="pdf-subtitle">
        Resultados del assessment, gaps principales, visualizaciones y roadmap de iniciativas sugeridas.
      </p>

      <div class="pdf-meta-grid">
        <div>
          <span>Dominio analizado</span>
          <strong>${escapeHtml(data.domainLabel)}</strong>
        </div>
        <div>
          <span>Fecha de generación</span>
          <strong>${escapeHtml(data.generatedAt)}</strong>
        </div>
        <div>
          <span>Origen de los datos</span>
          <strong>${escapeHtml(data.scenarioLabel)}</strong>
        </div>
        <div>
          <span>Filtros aplicados</span>
          <strong>${escapeHtml(data.filters)}</strong>
        </div>
        <div>
          <span>Objetivo base</span>
          <strong>${escapeHtml(String(data.targetMaturity))}</strong>
        </div>
      </div>
    </section>
  `;
}


function buildPdfEnhancedExecutiveSummary(data) {
  return `
    <section class="pdf-page">
      <h2>1. Resumen ejecutivo</h2>
      <p class="pdf-intro">
        Este informe resume la lectura actual del assessment del dominio
        ${escapeHtml(data.domainLabel)}. Los resultados reflejan los filtros activos
        en la herramienta en el momento de la exportación.
      </p>

      <div class="pdf-kpi-grid">
        <article>
          <span>Score global</span>
          <strong>${escapeHtml(formatNumber(data.scoreGlobal))}</strong>
        </article>
        <article>
          <span>Gap medio</span>
          <strong>${escapeHtml(formatNumber(data.gapMedio))}</strong>
        </article>
        <article>
          <span>Subcapacidades puntuadas</span>
          <strong>${data.scored.length}/${data.visibleItems.length}</strong>
        </article>
        <article>
          <span>Prioridad alta</span>
          <strong>${data.highCount}</strong>
        </article>
      </div>
    </section>
  `;
}


function buildPdfEnhancedVisualSummarySection(data) {
  const priorityRows = buildPdfPriorityBars(data);
  const leverRows = buildPdfLeverBars(data);

  return `
    <section class="pdf-page">
      <h2>2. Visualización ejecutiva</h2>
      <p class="pdf-intro">
        Resumen visual de prioridades y puntuación promedio por palanca, calculado sobre los datos visibles según los filtros activos.
      </p>

      <div class="pdf-visual-grid">
        <article class="pdf-visual-card">
          <h3>Prioridad por subcapacidad</h3>
          <div class="pdf-bars">
            ${priorityRows}
          </div>
        </article>

        <article class="pdf-visual-card">
          <h3>Promedio por palanca</h3>
          <div class="pdf-bars">
            ${leverRows}
          </div>
        </article>
      </div>
    </section>
  `;
}

function buildPdfPriorityBars(data) {
  const counts = {
    Alta: data.metrics.filter((entry) => entry.metrics.prioridad === "Alta").length,
    Media: data.metrics.filter((entry) => entry.metrics.prioridad === "Media").length,
    Baja: data.metrics.filter((entry) => entry.metrics.prioridad === "Baja").length,
    Pendiente: data.metrics.filter((entry) => entry.metrics.isPending).length,
  };

  const maxValue = Math.max(...Object.values(counts), 1);

  return Object.entries(counts)
    .map(([label, value]) => buildPdfBarRow(label, value, maxValue, getPdfPriorityColor(label)))
    .join("");
}

function buildPdfLeverBars(data) {
  const procesos = average(
    data.visibleItems.map((item) => item.scores.procesos).filter(Number.isFinite),
  );
  const tecnologia = average(
    data.visibleItems.map((item) => item.scores.tecnologia).filter(Number.isFinite),
  );
  const organizacion = average(
    data.visibleItems.map((item) => item.scores.organizacion).filter(Number.isFinite),
  );

  const rows = [
    ["Procesos", procesos, COLOR_DE_PALANCA.procesos],
    ["Tecnología", tecnologia, COLOR_DE_PALANCA.tecnologia],
    ["Organización", organizacion, COLOR_DE_PALANCA.organizacion],
  ];

  return rows
    .map(([label, value, color]) => buildPdfBarRow(label, value ?? 0, 5, color, formatNumber(value)))
    .join("");
}

function buildPdfBarRow(label, value, maxValue, color, displayValue = value) {
  const width = maxValue ? Math.max(0, Math.min(100, (value / maxValue) * 100)) : 0;

  return `
    <div class="pdf-bar-row">
      <div class="pdf-bar-label">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(displayValue))}</strong>
      </div>
      <div class="pdf-bar-track">
        <div class="pdf-bar-fill" style="width:${width}%; background:${color};"></div>
      </div>
    </div>
  `;
}

function getPdfPriorityColor(priority) {
  return priorityColor(priority);
}



function buildPdfEnhancedRadarSection(data) {
  const radarCards = [
    { title: "Procesos", image: data.radarImages.procesos, color: COLOR_DE_PALANCA.procesos },
    { title: "Tecnología", image: data.radarImages.tecnologia, color: COLOR_DE_PALANCA.tecnologia },
    { title: "Organización", image: data.radarImages.organizacion, color: COLOR_DE_PALANCA.organizacion },
  ]
    .map((radar) => `
      <article class="pdf-radar-card">
        <h3>
          <span style="background:${radar.color}"></span>
          ${escapeHtml(radar.title)}
        </h3>
        ${buildPdfRadarImageHtml(radar)}
      </article>
    `)
    .join("");

  return `
    <section class="pdf-page">
      <h2>3. Radar por capacidad</h2>
      <p class="pdf-intro">
        Vista comparativa de las puntuaciones promedio por capacidad para Procesos, Tecnología y Organización.
      </p>
      <div class="pdf-radar-grid">
        ${radarCards}
      </div>
    </section>
  `;
}

function buildPdfRadarImageHtml(radar) {
  if (!radar.image) {
    return `<p class="pdf-muted">No se pudo capturar el gráfico ${escapeHtml(radar.title)}.</p>`;
  }

  return `
    <img
      class="pdf-radar-image"
      src="${escapeAttr(radar.image)}"
      alt="Radar de ${escapeAttr(radar.title)} por capacidad"
    >
  `;
}



function buildPdfEnhancedSummarySection(data) {
  const rows = data.summaryRows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.capacidad)}</td>
        <td class="num">${escapeHtml(formatNumber(row.procesos))}</td>
        <td class="num">${escapeHtml(formatNumber(row.tecnologia))}</td>
        <td class="num">${escapeHtml(formatNumber(row.organizacion))}</td>
        <td class="num">
          ${escapeHtml(formatNumber(row.scoreMedio))}
        </td>

        <td class="num">
          ${escapeHtml(formatNumber(row.targetMedio))}
        </td>

        <td class="num">
          ${escapeHtml(formatNumber(row.gap))}
        </td>
        <td>${escapeHtml(row.prioridad)}</td>
        <td class="num">${escapeHtml(row.avance)}</td>
      </tr>
    `)
    .join("");

  return `
    <section class="pdf-page">
      <h2>4. Resumen por capacidad</h2>
      <table class="pdf-table">
        <thead>
          <tr>
            <th>Capacidad</th>
            <th>Procesos</th>
            <th>Tecnología</th>
            <th>Organización</th>
            <th>Score medio</th>
            <th>Objetivo medio</th>
            <th>Gap vs objetivo</th>
            <th>Prioridad</th>
            <th>Avance</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="9">No hay datos para los filtros actuales.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function buildPdfEnhancedHeatmapSection(data) {
  const rows = data.metrics
    .map(({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td class="heat ${pdfHeatClass(item.scores.procesos)}">${escapeHtml(formatNumber(item.scores.procesos))}</td>
        <td class="heat ${pdfHeatClass(item.scores.tecnologia)}">${escapeHtml(formatNumber(item.scores.tecnologia))}</td>
        <td class="heat ${pdfHeatClass(item.scores.organizacion)}">${escapeHtml(formatNumber(item.scores.organizacion))}</td>
        <td class="heat ${pdfHeatClass(metrics.scoreMedio)}">${escapeHtml(formatNumber(metrics.scoreMedio))}</td>
        <td class="num">${escapeHtml(formatNumber(metrics.gap))}</td>
        <td>${escapeHtml(metrics.prioridad)}</td>
      </tr>
    `)
    .join("");

  return `
    <section class="pdf-page">
      <h2>5. Heatmap por subcapacidad</h2>
      <p class="pdf-intro">
        Vista detallada de madurez por subcapacidad y por pilar, respetando los filtros activos de la herramienta.
      </p>
      <table class="pdf-table pdf-heatmap pdf-compact-table">
        <thead>
          <tr>
            <th>Capacidad</th>
            <th>Subcapacidad</th>
            <th>Procesos</th>
            <th>Tecnología</th>
            <th>Organización</th>
            <th>Score medio</th>
            <th>Gap</th>
            <th>Prioridad</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8">No hay datos para los filtros actuales.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function pdfHeatClass(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "heat-blank";
  }

  if (number < 1.5) return "heat-1";
  if (number < 2.5) return "heat-2";
  if (number < 3.5) return "heat-3";
  if (number < 4.5) return "heat-4";
  return "heat-5";
}

function buildPdfEnhancedPrioritiesSection(data) {
  const rows = data.topPriorities
    .map(({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td class="num">${escapeHtml(formatNumber(metrics.scoreMedio))}</td>
        <td class="num">${escapeHtml(formatNumber(metrics.gap))}</td>
        <td>${escapeHtml(metrics.prioridad)}</td>
        <td>${escapeHtml(metrics.oleada)}</td>
      </tr>
    `)
    .join("");

  return `
    <section class="pdf-page">
      <h2>6. Principales prioridades y gaps</h2>
      <table class="pdf-table">
        <thead>
          <tr>
            <th>Capacidad</th>
            <th>Subcapacidad</th>
            <th>Score</th>
            <th>Gap</th>
            <th>Prioridad</th>
            <th>Oleada</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6">No hay prioridades para los filtros actuales.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function buildPdfEnhancedRoadmapSection(data) {
  const rows = data.roadmapItems
    .map(({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td>${escapeHtml(metrics.prioridad)}</td>
        <td>${escapeHtml(metrics.oleada)}</td>
        <td>${escapeHtml(item.iniciativaSugerida)}</td>
        <td>${escapeHtml(item.owner || "-")}</td>
        <td>${escapeHtml(item.status || "-")}</td>
      </tr>
    `)
    .join("");

  return `
    <section class="pdf-page">
      <h2>7. Roadmap e iniciativas sugeridas</h2>
      <p class="pdf-intro">
        Roadmap filtrado según la vista actual de la herramienta, priorizado por gap y criticidad.
      </p>
      <table class="pdf-table pdf-roadmap">
        <thead>
          <tr>
            <th>Capacidad</th>
            <th>Subcapacidad</th>
            <th>Prioridad</th>
            <th>Oleada</th>
            <th>Iniciativa sugerida</th>
            <th>Responsable</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7">No hay iniciativas para los filtros actuales.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function buildPdfEnhancedCommentsSection(data) {
  if (!data.commentItems.length) {
    return `
      <section class="pdf-page">
        <h2>8. Comentarios y hallazgos</h2>
        <p class="pdf-muted">No hay comentarios registrados para los filtros actuales.</p>
      </section>
    `;
  }

  const cards = data.commentItems
    .map((item) => `
      <article class="pdf-comment-card">
        <h3>${escapeHtml(item.capacidad)}</h3>
        <p><strong>${escapeHtml(item.subcapacidad)}</strong></p>
        <p>${escapeHtml(item.comentario)}</p>
      </article>
    `)
    .join("");

  return `
    <section class="pdf-page">
      <h2>8. Comentarios y hallazgos</h2>
      <div class="pdf-comments-grid">
        ${cards}
      </div>
    </section>
  `;
}

function getEnhancedPdfReportStyles() {
  return `
    @page {
      size: A4 landscape;
      margin: 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #161a18;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #f3f5f0;
      line-height: 1.42;
      font-size: 10pt;
    }

    .pdf-report {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
      background: #ffffff;
    }

    .pdf-page {
      page-break-after: always;
      break-after: page;
      padding: 10mm 0;
    }

    .pdf-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .pdf-cover {
      min-height: 170mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    .pdf-cover-accent {
      width: 110px;
      height: 9px;
      margin-bottom: 26px;
      background: ${COLOR_DE_MARCA};
      border-radius: 999px;
    }

    .pdf-eyebrow {
      margin: 0 0 10px;
      color: ${COLOR_DE_MARCA_LEGIBLE};
      font-size: 10.5pt;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 16px;
      max-width: 820px;
      font-size: 32pt;
      line-height: 1.08;
    }

    h2 {
      margin: 0 0 14px;
      padding-bottom: 8px;
      border-bottom: 3px solid ${COLOR_DE_MARCA};
      font-size: 18pt;
    }

    h3 {
      margin: 0 0 10px;
      font-size: 12pt;
    }

    .pdf-subtitle,
    .pdf-intro,
    .pdf-muted {
      color: #5c665e;
      font-size: 10.5pt;
    }

    .pdf-meta-grid,
    .pdf-kpi-grid {
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }

    .pdf-meta-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .pdf-kpi-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .pdf-meta-grid div,
    .pdf-kpi-grid article,
    .pdf-visual-card,
    .pdf-radar-card,
    .pdf-comment-card {
      padding: 14px;
      border: 1px solid #d9dfd4;
      border-radius: 10px;
      background: #f8faf5;
    }

    .pdf-meta-grid span,
    .pdf-kpi-grid span {
      display: block;
      margin-bottom: 7px;
      color: #5c665e;
      font-size: 8.5pt;
      font-weight: 900;
      text-transform: uppercase;
    }

    .pdf-meta-grid strong,
    .pdf-kpi-grid strong {
      display: block;
      font-size: 15pt;
    }

    .pdf-meta-grid strong {
      font-size: 11pt;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .pdf-kpi-grid strong {
      font-size: 15pt;
    }

    .pdf-visual-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-top: 16px;
    }

    .pdf-bars {
      display: grid;
      gap: 12px;
    }

    .pdf-bar-row {
      display: grid;
      gap: 5px;
    }

    .pdf-bar-label {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 9.5pt;
      font-weight: 800;
    }

    .pdf-bar-track {
      height: 13px;
      border-radius: 999px;
      background: #e7ece2;
      overflow: hidden;
    }

    .pdf-bar-fill {
      height: 100%;
      border-radius: 999px;
    }

    .pdf-radar-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 14px;
    }

    .pdf-radar-card {
      background: #ffffff;
    }

    .pdf-radar-card h3 {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .pdf-radar-card h3 span {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
    }


    .pdf-radar-card img,
    .pdf-radar-image {
      width: 100%;
      max-height: 105mm;
      object-fit: contain;
      display: block;
    }


    .pdf-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 12px;
      font-size: 8.8pt;
      background: #ffffff;
    }

    .pdf-table th,
    .pdf-table td {
      border: 1px solid #d9dfd4;
      padding: 6px 7px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    .pdf-table th {
      background: #eef2e9;
      font-size: 8pt;
      font-weight: 900;
      text-transform: uppercase;
    }

    .pdf-compact-table {
      font-size: 8.2pt;
    }

    .pdf-table .num {
      text-align: right;
    }

    .pdf-heatmap .heat {
      text-align: center;
      font-weight: 900;
    }

    .heat-blank {
      background: #eef0ed;
      color: #4f5952;
    }

    .heat-1 {
      background: #f9d2cc;
      color: #7d1f19;
    }

    .heat-2 {
      background: #ffe5ba;
      color: #7a4700;
    }

    .heat-3 {
      background: #f4efb5;
      color: #504b00;
    }

    .heat-4 {
      background: #d9edc3;
      color: #315d11;
    }

    .heat-5 {
      background: #bfe1ce;
      color: #0f5132;
    }

    .pdf-roadmap th:nth-child(5),
    .pdf-roadmap td:nth-child(5) {
      width: 32%;
    }

    .pdf-comments-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 14px;
    }

    .pdf-comment-card {
      font-size: 9pt;
    }

    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
      body {
        background: #ffffff;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .pdf-report {
        max-width: none;
        padding: 0;
      }

      .pdf-page {
        padding: 5mm 0;
      }
    }
  `;
}
