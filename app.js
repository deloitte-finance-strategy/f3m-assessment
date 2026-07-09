// Firebase SDK - conexión inicial
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// Configuración de Firebase del proyecto fpa-assessment-mvp
const firebaseConfig = {
  apiKey: "AIzaSyAyHWPnALB5regOMmeR3C-vVLDTmh6fEio",
  authDomain: "fpa-assessment-mvp.firebaseapp.com",
  databaseURL: "https://fpa-assessment-mvp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fpa-assessment-mvp",
  storageBucket: "fpa-assessment-mvp.firebasestorage.app",
  messagingSenderId: "690455183937",
  appId: "1:690455183937:web:e9be8095b43f341589fcc0",
  measurementId: "G-XBHVPCJFFD",
};

// Inicialización de Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firebaseDatabase = getDatabase(firebaseApp);

console.log("Firebase conectado correctamente:", firebaseConfig.projectId);



// Escenario compartido leído desde la URL
const scenarioId = getScenarioIdFromUrl();
const scenarioDatabaseRef = scenarioId ? ref(firebaseDatabase, `scenarios/${scenarioId}`) : null;

console.log("Modo escenario compartido:", scenarioId || "modo local sin scenario");



const DATA_URL = "data/fpa_assessment.json";


const DEFAULT_DOMAIN_ID = "fpa";

const DOMAINS = {
  fpa: {
    id: "fpa",
    label: "FP&A",
    title: "Planificación y análisis financiero / FP&A",
    group: "Estratégicos y de negocio",
    dataUrl: "data/domains/fpa.json",
  },
  controlling: {
    id: "controlling",
    label: "Controlling",
    title: "Controlling",
    group: "Transaccionales y operativos",
    dataUrl: "data/domains/controlling.json",
  },
};


const STORAGE_KEY = "f3m-fpa-assessment-scenario";

const LEVERS = [
  { key: "procesos", label: "Procesos" },
  { key: "tecnologia", label: "Tecnología" },
  { key: "organizacion", label: "Organización" },
];

const PRIORITY_ORDER = {
  Alta: 1,
  Media: 2,
  Baja: 3,
  Pendiente: 4,
};

const STATUS_OPTIONS = ["No iniciado", "En curso", "Completado", "Bloqueado"];


const AI_INITIATIVES_BY_CAPABILITY = {
  "Presupuestos y previsiones": {
    subcapacidad: "1.1-1.4",
    cases:
      "Develop guided workflows for creating budgets; On demand forecasting and scenario modeling; AI-supported budget allocation",
    advanced:
      "Planificación driver-based, rolling forecast, escenarios automatizados y workflows colaborativos",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Informes de gestión del rendimiento": {
    subcapacidad: "2.1-2.4",
    cases:
      "Mgmt Reporting Actuals Plan Variance + Commentary; Generate account variance analysis and intelligent explanations; FinanceAI Insights Platform",
    advanced:
      "Reporting automatizado con commentary, insights, alertas y explicación de desviaciones",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Evaluación business case": {
    subcapacidad: "3.1-3.4",
    cases: "Summarize and score project proposals; Project-level recommendations",
    advanced:
      "Scoring de iniciativas, priorización dinámica y seguimiento de beneficios",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Información y apoyo a la toma de decisiones": {
    subcapacidad: "4.1-4.4",
    cases:
      "Perform analysis and investigation and provide insights on demand; Data access for all; Enterprise-wide data search and access",
    advanced:
      "Decision intelligence, insights predictivos y autoservicio gobernado",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Planificación largo plazo": {
    subcapacidad: "5.1-5.4",
    cases:
      "Generate investing strategies; Identify patterns to predict future financial performance; Integrated business planning",
    advanced:
      "Planificación estratégica continua, simulación avanzada y asignación dinámica de recursos",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
};


const state = {
  activeDomainId: DEFAULT_DOMAIN_ID,
  domains: {},
  meta: null,
  items: [],
};


let capabilityRadarCharts = {
  procesos: null,
  tecnologia: null,
  organizacion: null,
};


const expandedHeatmapCapabilities = new Set(); // NUEVO: mantiene abiertas las capacidades desplegadas del heatmap entre renders


let isApplyingRemoteScenario = false; // NUEVO: evita guardar de vuelta mientras estamos cargando datos remotos


const els = {};

document.addEventListener("DOMContentLoaded", init);


async function loadDomainData(domainId) {
  if (state.domains[domainId]) {
    return state.domains[domainId];
  }

  const domain = DOMAINS[domainId];

  if (!domain) {
    throw new Error(`Dominio no configurado: ${domainId}`);
  }

  const response = await fetch(domain.dataUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${domain.dataUrl}`);
  }

  const data = await response.json();

  state.domains[domainId] = {
    meta: data.meta,
    items: data.subcapacities.map(normalizeItem),
  };

  return state.domains[domainId];
}

async function loadCoreDomains() {
  await Promise.all(Object.keys(DOMAINS).map((domainId) => loadDomainData(domainId)));
}

function setActiveDomain(domainId) {
  const domainData = state.domains[domainId];

  if (!domainData) {
    throw new Error(`Dominio no cargado: ${domainId}`);
  }

  state.activeDomainId = domainId;
  state.meta = domainData.meta;
  state.items = domainData.items;

  updateActiveDomainUi();
}

async function switchDomain(domainId) {
  await loadDomainData(domainId);
  setActiveDomain(domainId);
  populateCapacityFilter();
  renderAll();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function updateActiveDomainUi() {
  const domain = DOMAINS[state.activeDomainId];

  document.querySelectorAll("[data-domain-id]").forEach((button) => {
    button.classList.toggle("active", button.dataset.domainId === state.activeDomainId);
  });

  const title = document.getElementById("activeDomainTitle");

  if (title && domain) {
    title.textContent = domain.title;
  }

  const label = document.getElementById("activeDomainLabel");

  if (label && domain) {
    label.textContent = domain.label;
  }
}


async function init() {
  cacheElements();
  bindGlobalEvents();
  setInitialLoading(true); // NUEVO: muestra estado de carga mientras se inicializa la app
  showScenarioModeNotice();


    try {
        await loadCoreDomains();
        setActiveDomain(DEFAULT_DOMAIN_ID);

        if (!scenarioId) {
          applyStoredScenario();
        }


    await initializeSharedScenario();

    populateCapacityFilter();
    renderAll();
  } catch (error) {
    showNotice(
      "No se pudo cargar el JSON de datos. Abre esta carpeta con un servidor local simple, por ejemplo: python -m http.server 8000, y entra en http://localhost:8000/.",
      true,
    );
    console.error(error);
  } finally {
    setInitialLoading(false); // NUEVO: oculta el estado de carga al terminar, incluso si hay error
  }
}


function cacheElements() {
  [
    "loadNotice",
    "initialLoadingState", // NUEVO: estado visual de carga inicial
    "sourceNote",
    "kpiGrid",
    "priorityBars",
    "leverBars",
    "summaryTable",
    "capabilityRadarProcessesChart",
    "capabilityRadarTechnologyChart",
    "capabilityRadarOrganizationChart",
    "capacityFilter",
    "priorityFilter",
    "searchInput",
    "assessmentList",
    "heatmapTable",
    "heatmapExpandToggle",
    "roadmapTable",
    "assessmentTabBadge",
    "roadmapTabBadge",
    "aiInitiativeModal",
    "closeAiInitiativeModalButton",
    "aiModalCapability",
    "aiModalSubcapability",
    "aiModalCases",
    "aiModalAdvanced",
    "aiModalSource",
    "scoringCriteriaModal", // NUEVO: modal de criterios F3M
    "closeScoringCriteriaModalButton", // NUEVO: botón cerrar modal
    "saveStatus", // NUEVO: indicador visual de guardado
    "importJsonButton",
    "exportJsonButton",
    "exportCsvButton",
    "exportPdfButton", // NUEVO: botón de exportación PDF
    "resetButton",
    "scenarioFileInput",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindGlobalEvents() {
  els.capacityFilter.addEventListener("change", renderAll);
  els.priorityFilter.addEventListener("change", renderAll);
  els.searchInput.addEventListener("input", renderAll);
  els.importJsonButton.addEventListener("click", () => els.scenarioFileInput.click());
  els.scenarioFileInput.addEventListener("change", importScenario);
  els.exportJsonButton.addEventListener("click", exportScenarioJson);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.exportPdfButton.addEventListener("click", exportPdfReport); // NUEVO: genera informe imprimible/PDF
  els.resetButton.addEventListener("click", resetScenario);
  els.heatmapExpandToggle?.addEventListener("click", handleHeatmapExpandToggleAll);
  setupActiveTabObserver(); // NUEVO: marca automáticamente la pestaña activa según la sección visible
  setupScoringCriteriaModal(); // NUEVO: configura modal de criterios F3M
  setupAiInitiativeModal();

    function setupDomainSwitcher() {
    document.querySelectorAll("[data-domain-id]").forEach((button) => {
      button.addEventListener("click", () => {
        switchDomain(button.dataset.domainId);
      });
    });
  }
}

function normalizeItem(item) {
  return {
    ...item,
    scores: {
      procesos: toScore(item.scores?.procesos),
      tecnologia: toScore(item.scores?.tecnologia),
      organizacion: toScore(item.scores?.organizacion),
    },
    owner: item.owner || "",
    status: item.status || "No iniciado",
    comentario: item.comentario || item.comentariosHallazgos || "",
  };
}

function toScore(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
}

function calculate(item) {
  const values = LEVERS.map((lever) => item.scores[lever.key]).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return {
      isPending: true,
      scoreMedio: null,
      nivel: "",
      gap: null,
      prioridad: "Pendiente",
      oleada: "Pendiente",
    };
  }

  const scoreMedio = round2(values.reduce((sum, value) => sum + value, 0) / values.length);
  const nivel = getMaturityLevel(scoreMedio);
  const gap = round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
  const prioridad = gap >= 2 ? "Alta" : gap >= 1 ? "Media" : "Baja";
  const oleada = prioridad === "Alta" ? "Oleada 1" : prioridad === "Media" ? "Oleada 2" : "Oleada 3";

  return {
    isPending: false,
    scoreMedio,
    nivel,
    gap,
    prioridad,
    oleada,
  };
}

function getMaturityLevel(score) {
  if (score < 1.5) return "1 - Inicial";
  if (score < 2.5) return "2 - Estructurado";
  if (score < 3.5) return "3 - Estandarizado";
  if (score < 4.5) return "4 - Optimizado";
  return "5 - Avanzado/Referente";
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}


function setupActiveTabObserver() {
  const tabLinks = [...document.querySelectorAll(".tabs a")]; // MODIFICADO: obtiene los links de navegación
  const sections = tabLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean); // MODIFICADO: evita errores si alguna sección no existe

  if (!tabLinks.length || !sections.length) {
    return;
  }

  const setActiveTab = (sectionId) => {
    tabLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${sectionId}`;
      link.classList.toggle("active", isActive);
    });
  };

  const updateActiveTab = () => {
    const scrollPosition = window.scrollY + 130; // MODIFICADO: compensa header/tabs sticky

    let currentSectionId = sections[0].id;

    sections.forEach((section) => {
      if (section.offsetTop <= scrollPosition) {
        currentSectionId = section.id;
      }
    });

    setActiveTab(currentSectionId);
  };

  window.addEventListener("scroll", updateActiveTab, { passive: true }); // MODIFICADO: actualiza al hacer scroll
  window.addEventListener("resize", updateActiveTab); // MODIFICADO: recalcula si cambia el tamaño de pantalla

  updateActiveTab(); // MODIFICADO: estado inicial al cargar
}


function setInitialLoading(isLoading) {
  if (!els.initialLoadingState) {
    return;
  }

  els.initialLoadingState.hidden = !isLoading;
}


function setupScoringCriteriaModal() {
  if (!els.scoringCriteriaModal) {
    return;
  }

  els.assessmentList.addEventListener("click", (event) => {
    const button = event.target.closest(".scoring-criteria-button");

    if (!button) {
      return;
    }

    openScoringCriteriaModal();
  });

  els.closeScoringCriteriaModalButton?.addEventListener("click", closeScoringCriteriaModal);

  els.scoringCriteriaModal.addEventListener("click", (event) => {
    if (event.target === els.scoringCriteriaModal) {
      closeScoringCriteriaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.scoringCriteriaModal.hidden) {
      closeScoringCriteriaModal();
    }
  });

  els.scoringCriteriaModal.querySelectorAll(".criteria-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateScoringCriteriaTab(tab.dataset.criteriaTab);
    });
  });
}

function openScoringCriteriaModal() {
  els.scoringCriteriaModal.hidden = false;
  activateScoringCriteriaTab("procesos");
  els.closeScoringCriteriaModalButton?.focus();
}

function closeScoringCriteriaModal() {
  els.scoringCriteriaModal.hidden = true;
}

function activateScoringCriteriaTab(tabKey) {
  els.scoringCriteriaModal.querySelectorAll(".criteria-tab").forEach((tab) => {
    const isActive = tab.dataset.criteriaTab === tabKey;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  els.scoringCriteriaModal.querySelectorAll(".criteria-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.criteriaPanel === tabKey);
  });
}


function setupAiInitiativeModal() {
  if (!els.aiInitiativeModal) {
    return;
  }

  els.roadmapTable.addEventListener("click", (event) => {
    const button = event.target.closest(".roadmap-ai-button");

    if (!button) {
      return;
    }

    openAiInitiativeModal(button.dataset.capability);
  });

  els.closeAiInitiativeModalButton?.addEventListener("click", closeAiInitiativeModal);

  els.aiInitiativeModal.addEventListener("click", (event) => {
    if (event.target === els.aiInitiativeModal) {
      closeAiInitiativeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.aiInitiativeModal.hidden) {
      closeAiInitiativeModal();
    }
  });
}

function openAiInitiativeModal(capability) {
  const initiative = AI_INITIATIVES_BY_CAPABILITY[capability];

  if (!initiative) {
    showNotice("No hay iniciativa IA asociada a esta capacidad.", true);
    return;
  }

  els.aiModalCapability.textContent = capability;
  els.aiModalSubcapability.textContent = `Subcapacidades relacionadas: ${initiative.subcapacidad}`;
  els.aiModalCases.textContent = initiative.cases;
  els.aiModalAdvanced.textContent = initiative.advanced;
  els.aiModalSource.textContent = `Fuente: ${initiative.source}`;

  els.aiInitiativeModal.hidden = false;
  els.closeAiInitiativeModalButton?.focus();
}

function closeAiInitiativeModal() {
  els.aiInitiativeModal.hidden = true;
}


function updateNavigationBadges() {
  if (!els.assessmentTabBadge || !els.roadmapTabBadge || !state.items.length) {
    return;
  }

  const metrics = state.items.map((item) => calculate(item));
  const scoredCount = metrics.filter((entry) => !entry.isPending).length;
  const totalCount = state.items.length;
  const highPriorityCount = metrics.filter((entry) => entry.prioridad === "Alta").length;

  els.assessmentTabBadge.textContent = `${scoredCount}/${totalCount}`;
  els.roadmapTabBadge.textContent = `${highPriorityCount} Alta`;

  els.roadmapTabBadge.classList.toggle("tab-badge-alert", highPriorityCount > 0);
}



function renderAll() {
  if (!state.items.length) return;
  els.sourceNote.textContent = `Fuente: ${state.meta.sourceFile} · Objetivo de madurez ${state.meta.targetMaturity}`;
  renderDashboard();
  renderAssessments();
  renderHeatmap();
  renderRoadmap();
  updateNavigationBadges();
}

function populateCapacityFilter() {
  const capacities = unique(state.items.map((item) => item.capacidad));
  els.capacityFilter.innerHTML = [
    `<option value="all">Todas</option>`,
    ...capacities.map((capability) => `<option value="${escapeAttr(capability)}">${escapeHtml(capability)}</option>`),
  ].join("");
}

function getVisibleItems() {
  const capacity = els.capacityFilter.value;
  const priority = els.priorityFilter.value;
  const query = els.searchInput.value.trim().toLowerCase();

  return state.items.filter((item) => {
    const metrics = calculate(item);
    const matchesCapacity = capacity === "all" || item.capacidad === capacity;
    const matchesPriority = priority === "all" || metrics.prioridad === priority;
    const haystack = [
      item.capacidad,
      item.subcapacidad,
      item.objetivoEvaluacion,
      item.preguntasClave,
      item.evidencias,
      item.iniciativaSugerida,
    ]
      .join(" ")
      .toLowerCase();
    return matchesCapacity && matchesPriority && (!query || haystack.includes(query));
  });
}

function renderDashboard() {
  const metrics = state.items.map((item) => ({ item, metrics: calculate(item) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);
  const scoreGlobal = average(scored.map((entry) => entry.metrics.scoreMedio));
  const gapMedio = average(scored.map((entry) => entry.metrics.gap));
  const highCount = scored.filter((entry) => entry.metrics.prioridad === "Alta").length;

  els.kpiGrid.innerHTML = [
    kpiCard("Score global dominio", formatNumber(scoreGlobal), scored.length ? "Promedio de subcapacidades puntuadas" : "Pendiente de scoring"),
    kpiCard("Gap medio vs objetivo", formatNumber(gapMedio), `Objetivo actual: ${state.meta.targetMaturity} - Optimizado`),
    kpiCard("Subcapacidades puntuadas", `${scored.length}/${state.items.length}`, `${Math.round((scored.length / state.items.length) * 100)}% de avance`),
    kpiCard("Prioridad alta", String(highCount), "Subcapacidades con gap igual o superior a 2"),
  ].join("");

  renderPriorityBars(metrics);
  renderLeverBars();
  renderSummaryTable();
  renderCapabilityRadar(); // NUEVO: actualiza radar al recalcular dashboard
}

function kpiCard(label, value, note) {
  return `
    <article class="kpi-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>
  `;
}

function renderPriorityBars(entries) {
  const counts = { Alta: 0, Media: 0, Baja: 0, Pendiente: 0 };
  entries.forEach((entry) => {
    counts[entry.metrics.prioridad] += 1;
  });
  const max = Math.max(...Object.values(counts), 1);
  els.priorityBars.innerHTML = Object.entries(counts)
    .map(([label, count]) => {
      const width = Math.round((count / max) * 100);
      return barRow(label, count, width, priorityColor(label));
    })
    .join("");
}

function renderLeverBars() {
  const rows = LEVERS.map((lever) => {
    const avg = average(state.items.map((item) => item.scores[lever.key]).filter((value) => Number.isFinite(value)));
    const width = avg ? Math.round((avg / 5) * 100) : 0;
    return barRow(lever.label, formatNumber(avg), width, "#007c89");
  });
  els.leverBars.innerHTML = rows.join("");
}

function barRow(label, value, width, color) {
  return `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${width}%;background:${color}"></span></span>
      <span class="bar-value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function renderSummaryTable() {
  const capacities = unique(state.items.map((item) => item.capacidad));
  const rows = capacities.map((capability) => {
    const items = state.items.filter((item) => item.capacidad === capability);
    const entries = items.map((item) => ({ item, metrics: calculate(item) }));
    const scored = entries.filter((entry) => !entry.metrics.isPending);
    const scoreMedio = average(scored.map((entry) => entry.metrics.scoreMedio));
    const gap = scoreMedio === null ? null : round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
    const prioridad = priorityFromGap(gap);
    return `
      <tr>
        <td>${escapeHtml(capability)}</td>
        <td class="number">${formatNumber(average(items.map((item) => item.scores.procesos).filter(Number.isFinite)))}</td>
        <td class="number">${formatNumber(average(items.map((item) => item.scores.tecnologia).filter(Number.isFinite)))}</td>
        <td class="number">${formatNumber(average(items.map((item) => item.scores.organizacion).filter(Number.isFinite)))}</td>
        <td class="number">${formatNumber(scoreMedio)}</td>
        <td class="number">${formatNumber(gap)}</td>
        <td>${priorityBadge(prioridad)}</td>
        <td class="number">${scored.length}/${items.length}</td>
      </tr>
    `;
  });

  els.summaryTable.innerHTML = `
    <thead>
      <tr>
        <th>Capacidad</th>
        <th class="number">Procesos</th>
        <th class="number">Tecnología</th>
        <th class="number">Organización</th>
        <th class="number">Score medio</th>
        <th class="number">Gap</th>
        <th>Prioridad</th>
        <th class="number">Avance</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  `;
}



function renderCapabilityRadar() {
  if (typeof Chart === "undefined") {
    return;
  }

  const radarData = buildCapabilityRadarData();

  renderSingleCapabilityRadar({
  key: "procesos",
  canvas: els.capabilityRadarProcessesChart,
  label: "Procesos",
  values: radarData.procesos,
  color: "#86BC25",
  backgroundColor: "rgba(134, 188, 37, 0.24)",
  radarData,
});

renderSingleCapabilityRadar({
  key: "tecnologia",
  canvas: els.capabilityRadarTechnologyChart,
  label: "Tecnología",
  values: radarData.tecnologia,
  color: "#ED8B00",
  backgroundColor: "rgba(237, 139, 0, 0.22)",
  radarData,
});

renderSingleCapabilityRadar({
  key: "organizacion",
  canvas: els.capabilityRadarOrganizationChart,
  label: "Organización",
  values: radarData.organizacion,
  color: "#012169",
  backgroundColor: "rgba(1, 33, 105, 0.18)",
  radarData,
});
}

function renderSingleCapabilityRadar({ key, canvas, label, values, color, backgroundColor, radarData }) {
  if (!canvas) {
    return;
  }

  const chartData = {
    labels: radarData.displayLabels,
    datasets: [
      {
        label,
        data: values,
        fill: true,
        backgroundColor,
        borderColor: color,
        pointBackgroundColor: color,
        pointBorderColor: "#ffffff",
        pointHoverBackgroundColor: "#ffffff",
        pointHoverBorderColor: color,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 4,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const index = items[0]?.dataIndex ?? 0;
            return radarData.originalLabels[index] || "";
          },
          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.r)}`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
          backdropColor: "transparent",
          color: "#5c665e",
          font: {
            size: 11,
            weight: "700",
          },
        },
        pointLabels: {
          color: "#323a35",
          padding: 8,
          font: {
            size: 11,
            weight: "800",
          },
        },
        grid: {
          color: "#d9dfd4",
        },
        angleLines: {
          color: "#d9dfd4",
        },
      },
    },
    elements: {
      line: {
        borderWidth: 2.5,
      },
      point: {
        radius: 3.5,
        hoverRadius: 6,
      },
    },
  };

  if (capabilityRadarCharts[key]) {
    capabilityRadarCharts[key].data = chartData;
    capabilityRadarCharts[key].options = chartOptions;
    capabilityRadarCharts[key].update();
    return;
  }

  capabilityRadarCharts[key] = new Chart(canvas, {
    type: "radar",
    data: chartData,
    options: chartOptions,
  });
}




function buildCapabilityRadarData() {
  const rows = buildSummaryRows();

  return {
    originalLabels: rows.map((row) => row.Capacidad),
    displayLabels: rows.map((row) => getRadarShortLabel(row.Capacidad)),
    procesos: rows.map((row) => toRadarNumber(row.Procesos)),
    tecnologia: rows.map((row) => toRadarNumber(row.Tecnologia)),
    organizacion: rows.map((row) => toRadarNumber(row.Organizacion)),
  };
}

function toRadarNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}


function getRadarShortLabel(label) {
  const shortLabels = {
    "Presupuestos y previsiones": ["Presupuestos", "y previsiones"],
    "Informes de gestión del rendimiento": ["Informes", "gestión"],
    "Evaluación business case": ["Business", "case"],
    "Información y apoyo a la toma de decisiones": ["Apoyo", "decisiones"],
    "Planificación largo plazo": ["Planificación", "largo plazo"],
  };

  return shortLabels[label] || wrapRadarLabel(label);
}


function wrapRadarLabel(label) {
  const words = String(label).split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > 18) {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function toList(value, separator = "\n") {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (value === null || value === undefined) {
    return [];
  }

  return String(value)
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getItemObjective(item) {
  return item.objetivoEvaluacion || item.objetivo || "";
}

function getItemQuestions(item) {
  return toList(item.preguntasClave || item.preguntas || item.questions);
}

function getItemEvidenceText(item) {
  return item.evidencias || item.evidence || "";
}


function renderAssessments() {
  const items = getVisibleItems();

  if (!items.length) {
    els.assessmentList.innerHTML = `<div class="empty-state">No hay subcapacidades que coincidan con los filtros actuales.</div>`;
    return;
  }

  const template = document.getElementById("assessmentCardTemplate");
  els.assessmentList.innerHTML = "";

  items.forEach((item) => {
    const metrics = calculate(item);
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".assessment-card");

    card.dataset.id = item.id;

    fragment.querySelector(".capability-chip").textContent = item.capacidad;
    fragment.querySelector("h3").textContent = item.subcapacidad;
    fragment.querySelector(".card-title-block p").textContent = getItemObjective(item);

    fragment.querySelector(".score-controls").innerHTML = LEVERS.map((lever) =>
      scoreControl(item, lever),
    ).join("");

    fragment.querySelector(".score-result").innerHTML = scoreResult(metrics);

    fragment.querySelector(".maturity-list").innerHTML = Object.entries(item.maturity || {})
      .map(([, text]) => `<li>${escapeHtml(text)}</li>`)
      .join("");

    fragment.querySelector(".question-list").innerHTML = getItemQuestions(item)
      .map((question) => `<li>${escapeHtml(question)}</li>`)
      .join("");

    fragment.querySelector(".evidence-text").textContent = getItemEvidenceText(item);

    els.assessmentList.appendChild(fragment);
  });

  els.assessmentList.querySelectorAll(".score-select").forEach((select) => {
    select.addEventListener("change", handleScoreChange);
  });
}

function scoreControl(item, lever) {
  const current = item.scores[lever.key];
  const options = [`<option value="">Sin puntuar</option>`]
    .concat([1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${current === value ? "selected" : ""}>${value}</option>`))
    .join("");
  return `
    <label class="score-field">
      <span>${escapeHtml(lever.label)}</span>
      <select class="score-select" data-id="${escapeAttr(item.id)}" data-lever="${lever.key}">
        ${options}
      </select>
    </label>
  `;
}

function scoreResult(metrics) {
  if (metrics.isPending) {
    return `
      ${priorityBadge("Pendiente")}
      <span class="metric-line"><strong>-</strong> score medio</span>
      <span class="metric-line">Pendiente de scoring</span>
    `;
  }

  return `
    ${priorityBadge(metrics.prioridad)}
    <span class="metric-line"><strong>${formatNumber(metrics.scoreMedio)}</strong> score medio</span>
    <span class="metric-line"><strong>${formatNumber(metrics.gap)}</strong> gap · ${escapeHtml(metrics.oleada)}</span>
    <span class="level-badge">${escapeHtml(metrics.nivel)}</span>
  `;
}

function handleScoreChange(event) {
  const item = state.items.find((entry) => entry.id === event.target.dataset.id);
  item.scores[event.target.dataset.lever] = toScore(event.target.value);
  persistScenario();
  renderAll();
}


function renderHeatmap() {
  const visibleItems = getVisibleItems();
  const capabilityRows = buildHeatmapCapabilityRows(visibleItems);

  const rows = capabilityRows
    .map((entry) => {
      const isExpanded = expandedHeatmapCapabilities.has(entry.capability);

      const detailRows = entry.items
        .map((item) => {
          const metrics = calculate(item);

          return `
            <tr class="heatmap-detail-row ${isExpanded ? "" : "is-hidden"}" data-capability-detail="${escapeAttr(entry.capability)}">
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
            <strong>${escapeHtml(entry.capability)}</strong>
          </td>
          <td>
            <button
              class="heatmap-toggle"
              type="button"
              data-capability-toggle="${escapeAttr(entry.capability)}"
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
    <thead>
      <tr>
        <th>Capacidad</th>
        <th>Subcapacidades</th>
        <th class="number">Procesos</th>
        <th class="number">Tecnología</th>
        <th class="number">Organización</th>
        <th class="number">Score medio</th>
        <th class="number">Gap</th>
        <th>Prioridad</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="8">No hay datos para los filtros actuales.</td></tr>`}
    </tbody>
  `;

  els.heatmapTable.querySelectorAll(".heatmap-toggle").forEach((button) => {
    button.addEventListener("click", handleHeatmapToggle);
  });

  updateHeatmapExpandAllButton(capabilityRows); // NUEVO: sincroniza texto Expandir/Colapsar todo

}


function buildHeatmapCapabilityRows(items) {
  const capabilities = unique(items.map((item) => item.capacidad));

  return capabilities.map((capability) => {
    const capabilityItems = items.filter((item) => item.capacidad === capability);
    const calculatedItems = capabilityItems.map((item) => calculate(item));
    const scoredItems = calculatedItems.filter((metrics) => !metrics.isPending);

    const procesos = average(
      capabilityItems.map((item) => item.scores.procesos).filter(Number.isFinite),
    );

    const tecnologia = average(
      capabilityItems.map((item) => item.scores.tecnologia).filter(Number.isFinite),
    );

    const organizacion = average(
      capabilityItems.map((item) => item.scores.organizacion).filter(Number.isFinite),
    );

    const scoreMedio = average(scoredItems.map((metrics) => metrics.scoreMedio));
    const gap = scoreMedio === null ? null : round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
    const prioridad = priorityFromGap(gap);

    return {
      capability,
      items: capabilityItems,
      procesos,
      tecnologia,
      organizacion,
      scoreMedio,
      gap,
      prioridad,
    };
  });
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


function handleHeatmapExpandToggleAll() {
  const capabilityRows = buildHeatmapCapabilityRows(getVisibleItems());
  const visibleCapabilities = capabilityRows.map((entry) => entry.capability);

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

  const visibleCapabilities = capabilityRows.map((entry) => entry.capability);
  const allExpanded =
    visibleCapabilities.length > 0 &&
    visibleCapabilities.every((capability) => expandedHeatmapCapabilities.has(capability));

  els.heatmapExpandToggle.textContent = allExpanded ? "Colapsar todo" : "Expandir todo";
  els.heatmapExpandToggle.disabled = visibleCapabilities.length === 0;
}


function renderRoadmap() {
  const roadmapItems = getVisibleItems(); // Roadmap respeta filtros activos

  const rows = roadmapItems
    .map((item) => ({ item, metrics: calculate(item) }))
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.metrics.prioridad] - PRIORITY_ORDER[b.metrics.prioridad];

      if (priorityDiff) {
        return priorityDiff;
      }

      return (b.metrics.gap || 0) - (a.metrics.gap || 0);
    })
    .map(({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td class="number">${formatNumber(metrics.gap)}</td>
        <td>${priorityBadge(metrics.prioridad)}</td>
        <td>${escapeHtml(item.iniciativaSugerida)}</td>
        <td>
          <button
            class="roadmap-ai-button"
            type="button"
            data-capability="${escapeAttr(item.capacidad)}"
            aria-label="Ver iniciativa IA para ${escapeAttr(item.capacidad)}"
          >
            IA
          </button>
        </td>
        <td><span class="status-chip">${escapeHtml(metrics.oleada)}</span></td>
        <td>
          <input
            class="inline-input roadmap-owner"
            data-id="${escapeAttr(item.id)}"
            value="${escapeAttr(item.owner)}"
            placeholder="Owner"
          >
        </td>
        <td>${statusSelect(item)}</td>
        <td>
          <textarea
            class="roadmap-comment"
            data-id="${escapeAttr(item.id)}"
            placeholder="Comentarios"
          >${escapeHtml(item.comentario)}</textarea>
        </td>
      </tr>
    `)
    .join("");

  els.roadmapTable.innerHTML = `
    <thead>
      <tr>
        <th>Capacidad</th>
        <th>Subcapacidad</th>
        <th class="number">Gap</th>
        <th>Prioridad</th>
        <th>Iniciativa sugerida</th>
        <th>IA</th>
        <th>Oleada</th>
        <th>Owner</th>
        <th>Estado</th>
        <th>Comentarios</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="10">No hay iniciativas para los filtros actuales.</td></tr>`}
    </tbody>
  `;

  els.roadmapTable.querySelectorAll(".roadmap-owner").forEach((input) => {
    input.addEventListener("input", handleRoadmapFieldChange);
  });

  els.roadmapTable.querySelectorAll(".roadmap-status").forEach((select) => {
    select.addEventListener("change", handleRoadmapFieldChange);
  });

  els.roadmapTable.querySelectorAll(".roadmap-comment").forEach((textarea) => {
    textarea.addEventListener("input", handleRoadmapFieldChange);
  });
}


function statusSelect(item) {
  return `
    <select class="inline-input roadmap-status" data-id="${escapeAttr(item.id)}">
      ${STATUS_OPTIONS.map((status) => `<option value="${escapeAttr(status)}" ${item.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
    </select>
  `;
}

function handleRoadmapFieldChange(event) {
  const item = state.items.find((entry) => entry.id === event.target.dataset.id);
  if (event.target.classList.contains("roadmap-owner")) item.owner = event.target.value;
  if (event.target.classList.contains("roadmap-status")) item.status = event.target.value;
  if (event.target.classList.contains("roadmap-comment")) item.comentario = event.target.value;
  persistScenario();
}

function heatScoreCell(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return `<td class="heat-cell heat-blank">-</td>`;
  }
  return `<td class="heat-cell heat-${Math.max(1, Math.min(5, Math.round(number)))}">${formatNumber(number)}</td>`;
}

function gapClass(value) {
  if (!Number.isFinite(value)) return "heat-blank";
  if (value >= 2) return "gap-high";
  if (value >= 1) return "gap-mid";
  return "gap-low";
}

function priorityBadge(priority) {
  const safePriority = priority || "Pendiente";
  return `<span class="priority-badge ${safePriority.toLowerCase()}">${escapeHtml(safePriority)}</span>`;
}

function priorityColor(priority) {
  if (priority === "Alta") return "#bb3128";
  if (priority === "Media") return "#c87900";
  if (priority === "Baja") return "#3e6f11";
  return "#8a9189";
}

function priorityFromGap(gap) {
  if (!Number.isFinite(gap)) return "Pendiente";
  if (gap >= 2) return "Alta";
  if (gap >= 1) return "Media";
  return "Baja";
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return round2(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}

function unique(values) {
  return [...new Set(values)];
}


async function initializeSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  try {
    const snapshot = await get(scenarioDatabaseRef);

    if (snapshot.exists()) {
      isApplyingRemoteScenario = true;

      applyScenarioPayload(snapshot.val());

      isApplyingRemoteScenario = false;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildScenarioPayload()));
      populateCapacityFilter();
      renderAll();

      showNotice(`Escenario compartido cargado: ${scenarioId}`);
      updateSaveStatus("saved", "Sincronizado ✓");
    } else {
      await set(scenarioDatabaseRef, buildScenarioPayload());

      showNotice(`Escenario compartido creado: ${scenarioId}`);
      updateSaveStatus("saved", "Guardado ✓");
    }

    subscribeToSharedScenario();
  } catch (error) {
    isApplyingRemoteScenario = false;

    showNotice("No se pudo conectar con el escenario compartido. Se mantiene el modo local.", true);
    updateSaveStatus("saved", "Guardado ✓");
    console.error(error);
  }
}


function subscribeToSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  onValue(scenarioDatabaseRef, (snapshot) => {
    const remoteScenario = snapshot.val();

    if (!remoteScenario) {
      return;
    }

    try {
      isApplyingRemoteScenario = true;

      applyScenarioPayload(remoteScenario);

      isApplyingRemoteScenario = false;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildScenarioPayload()));
      populateCapacityFilter();
      renderAll();
      updateSaveStatus("saved", "Sincronizado ✓");
    } catch (error) {
      isApplyingRemoteScenario = false;

      console.error("No se pudo aplicar el escenario remoto.", error);
      showNotice("No se pudo aplicar el escenario remoto.", true);
    }
  });
}


function updateSaveStatus(status, message) {
  if (!els.saveStatus) {
    return;
  }

  els.saveStatus.className = `save-status ${status || ""}`.trim();
  els.saveStatus.textContent = message;
}



function persistScenario() {
  const payload = buildScenarioPayload();

  updateSaveStatus("saving", "Guardando…"); // NUEVO: feedback inmediato

  // Modo local: guardado solo en este navegador
  if (!scenarioDatabaseRef) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    updateSaveStatus("saved", "Guardado ✓"); // NUEVO: confirmación en modo local
    return;
  }

  // Modo compartido: guardado en Firebase
  if (!isApplyingRemoteScenario) {
    set(scenarioDatabaseRef, payload)
      .then(() => {
        updateSaveStatus("saved", "Guardado ✓"); // NUEVO: confirmación tras guardar en Firebase
      })
      .catch((error) => {
        updateSaveStatus("error", "Error al guardar"); // NUEVO: feedback si Firebase falla
        showNotice("No se pudo guardar el escenario compartido en Firebase.", true);
        console.error(error);
      });
  }
}


function applyStoredScenario() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return;
  }

  try {
    const payload = JSON.parse(stored);
    applyScenarioPayload(payload);
  } catch (error) {
    console.warn("No se pudo aplicar el escenario local.", error);
  }
}


function normalizeMatchKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findMatchingScenarioItem(items, savedItem) {
  if (!savedItem) {
    return null;
  }

  const byId = items.find((item) => item.id === savedItem.id);

  if (byId) {
    return byId;
  }

  const savedCapability = normalizeMatchKey(savedItem.capacidad || savedItem.Capacidad);
  const savedSubcapability = normalizeMatchKey(savedItem.subcapacidad || savedItem.Subcapacidad);

  return items.find((item) => {
    return (
      normalizeMatchKey(item.capacidad) === savedCapability &&
      normalizeMatchKey(item.subcapacidad) === savedSubcapability
    );
  });
}

function getScenarioItemsFromPayload(payload, domainId) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload.domains?.[domainId]?.items) {
    return payload.domains[domainId].items;
  }

  if (payload.items) {
    return payload.items;
  }

  if (payload.subcapacities) {
    return payload.subcapacities;
  }

  return [];
}

function applyScenarioItemsToDomain(domainId, savedItems) {
  const domain = state.domains[domainId];

  if (!domain || !Array.isArray(savedItems)) {
    return;
  }

  savedItems.forEach((savedItem) => {
    const item = findMatchingScenarioItem(domain.items, savedItem);

    if (!item) {
      return;
    }

    if (savedItem.scores) {
      item.scores.procesos = toScore(savedItem.scores.procesos);
      item.scores.tecnologia = toScore(savedItem.scores.tecnologia);
      item.scores.organizacion = toScore(savedItem.scores.organizacion);
    }

    if (savedItem.owner !== undefined) {
      item.owner = savedItem.owner;
    }

    if (savedItem.status !== undefined) {
      item.status = savedItem.status;
    }

    if (savedItem.comentario !== undefined) {
      item.comentario = savedItem.comentario;
    }
  });
}

function applyScenarioPayload(payload) {
  if (!payload) {
    return;
  }

  // Nuevo formato multidominio
  if (payload.domains) {
    Object.keys(payload.domains).forEach((domainId) => {
      applyScenarioItemsToDomain(domainId, getScenarioItemsFromPayload(payload, domainId));
    });

    if (payload.activeDomainId && state.domains[payload.activeDomainId]) {
      setActiveDomain(payload.activeDomainId);
    }

    return;
  }

  // Formato antiguo monodominio: asumimos que pertenece a FP&A
  applyScenarioItemsToDomain("fpa", getScenarioItemsFromPayload(payload, "fpa"));

  if (state.activeDomainId === "fpa") {
    setActiveDomain("fpa");
  }
}



function buildScenarioPayload() {
  if (state.activeDomainId && state.domains[state.activeDomainId]) {
    state.domains[state.activeDomainId].items = state.items;
  }

  const domainsPayload = {};

  Object.entries(state.domains).forEach(([domainId, domain]) => {
    domainsPayload[domainId] = {
      meta: domain.meta,
      items: domain.items.map((item) => ({
        id: item.id,
        capacidad: item.capacidad,
        subcapacidad: item.subcapacidad,
        scores: {
          procesos: item.scores.procesos,
          tecnologia: item.scores.tecnologia,
          organizacion: item.scores.organizacion,
        },
        owner: item.owner,
        status: item.status,
        comentario: item.comentario,
      })),
    };
  });

  return {
    version: 2,
    activeDomainId: state.activeDomainId,
    updatedAt: new Date().toISOString(),
    domains: domainsPayload,
  };
}



function importScenario(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);

      applyScenarioPayload(payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildScenarioPayload()));

      populateCapacityFilter();
      renderAll();
      persistScenario();

      showNotice("Escenario importado correctamente.");
      updateSaveStatus("saved", "Guardado ✓");
    } catch (error) {
      showNotice("El archivo no parece un escenario válido para este MVP.", true);
      console.error(error);
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}


function exportScenarioJson() {
  downloadFile(
    "f3m_fpa_assessment_scenario.json",
    JSON.stringify(buildScenarioPayload(), null, 2),
    "application/json",
  );
}

function exportCsv() {
  const summaryRows = buildSummaryRows();
  const roadmapRows = state.items
    .map((item) => {
      const metrics = calculate(item);
      return {
        Tipo: "Roadmap",
        Capacidad: item.capacidad,
        Subcapacidad: item.subcapacidad,
        Procesos: item.scores.procesos ?? "",
        Tecnologia: item.scores.tecnologia ?? "",
        Organizacion: item.scores.organizacion ?? "",
        ScoreMedio: metrics.scoreMedio ?? "",
        Nivel: metrics.nivel,
        Gap: metrics.gap ?? "",
        Prioridad: metrics.prioridad,
        Oleada: metrics.oleada,
        IniciativaSugerida: item.iniciativaSugerida,
        Owner: item.owner,
        Estado: item.status,
        Comentarios: item.comentario,
      };
    });
  downloadFile("f3m_fpa_assessment_export.csv", toCsv([...summaryRows, ...roadmapRows]), "text/csv;charset=utf-8");
}


function exportPdfReport() {
  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    showNotice("El navegador ha bloqueado la ventana del informe. Permite pop-ups para exportar el PDF.", true);
    return;
  }

  const reportData = buildEnhancedPdfReportData();
  const reportHtml = buildEnhancedPdfReportHtml(reportData);

  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();

  setTimeout(() => {
    const images = [...reportWindow.document.images];

    if (!images.length) {
      reportWindow.focus();
      reportWindow.print();
      return;
    }

    Promise.all(
      images.map((image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      }),
    ).then(() => {
      reportWindow.focus();
      reportWindow.print();
    });
  }, 900);
}


function buildEnhancedPdfReportData() {
  const visibleItems = getVisibleItems();
  const metrics = visibleItems.map((item) => ({ item, metrics: calculate(item) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);

  const summaryRows = buildPdfSummaryRowsFromItems(visibleItems);

  const topPriorities = [...metrics]
    .filter((entry) => !entry.metrics.isPending)
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.metrics.prioridad] - PRIORITY_ORDER[b.metrics.prioridad];

      if (priorityDiff) {
        return priorityDiff;
      }

      return (b.metrics.gap || 0) - (a.metrics.gap || 0);
    })
    .slice(0, 10);

  const roadmapItems = [...metrics]
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.metrics.prioridad] - PRIORITY_ORDER[b.metrics.prioridad];

      if (priorityDiff) {
        return priorityDiff;
      }

      return (b.metrics.gap || 0) - (a.metrics.gap || 0);
    })
    .slice(0, 15);

  const commentItems = visibleItems.filter((item) => item.comentario?.trim());

  return {
    generatedAt: new Date().toLocaleString("es-ES"),
    scenarioLabel: scenarioId || "Modo local",
    sourceFile: state.meta?.sourceFile || "-",
    targetMaturity: state.meta?.targetMaturity || "-",
    filters: getPdfActiveFiltersLabel(),
    visibleItems,
    metrics,
    scored,
    summaryRows,
    topPriorities,
    roadmapItems,
    commentItems,
    scoreGlobal: average(scored.map((entry) => entry.metrics.scoreMedio)),
    gapMedio: average(scored.map((entry) => entry.metrics.gap)),
    highCount: scored.filter((entry) => entry.metrics.prioridad === "Alta").length,
    radarImages: getRadarImagesForPdf(),
  };
}

function buildPdfSummaryRowsFromItems(items) {
  const capabilities = unique(items.map((item) => item.capacidad));
  const targetMaturity = state.meta?.targetMaturity ?? 4;

  return capabilities.map((capability) => {
    const capabilityItems = items.filter((item) => item.capacidad === capability);
    const calculatedItems = capabilityItems.map((item) => calculate(item));
    const scoredItems = calculatedItems.filter((metrics) => !metrics.isPending);

    const procesos = average(
      capabilityItems.map((item) => item.scores.procesos).filter(Number.isFinite),
    );

    const tecnologia = average(
      capabilityItems.map((item) => item.scores.tecnologia).filter(Number.isFinite),
    );

    const organizacion = average(
      capabilityItems.map((item) => item.scores.organizacion).filter(Number.isFinite),
    );

    const scoreMedio = average(scoredItems.map((metrics) => metrics.scoreMedio));
    const gap = scoreMedio === null ? null : round2(Math.max(0, targetMaturity - scoreMedio));
    const prioridad = priorityFromGap(gap);

    return {
      capacidad: capability,
      procesos,
      tecnologia,
      organizacion,
      scoreMedio,
      gap,
      prioridad,
      avance: `${scoredItems.length}/${capabilityItems.length}`,
    };
  });
}

function getPdfActiveFiltersLabel() {
  const filters = [];

  if (els.capacityFilter?.value) {
    filters.push(`Capacidad: ${els.capacityFilter.value}`);
  }

  if (els.priorityFilter?.value) {
    filters.push(`Prioridad: ${els.priorityFilter.value}`);
  }

  if (els.searchInput?.value?.trim()) {
    filters.push(`Búsqueda: ${els.searchInput.value.trim()}`);
  }

  return filters.length ? filters.join(" · ") : "Sin filtros activos";
}

function getRadarImagesForPdf() {
  return {
    procesos: getCanvasImageDataUrl(els.capabilityRadarProcessesChart),
    tecnologia: getCanvasImageDataUrl(els.capabilityRadarTechnologyChart),
    organizacion: getCanvasImageDataUrl(els.capabilityRadarOrganizationChart),
  };
}

function getCanvasImageDataUrl(canvas) {
  if (!canvas) {
    return "";
  }

  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("No se pudo capturar el gráfico para el PDF.", error);
    return "";
  }
}

function buildEnhancedPdfReportHtml(data) {
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Informe FP&A Assessment</title>
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
      <p class="pdf-eyebrow">Finance Strategy · FP&A Assessment</p>
      <h1>Informe preliminar de madurez FP&A</h1>
      <p class="pdf-subtitle">
        Resultados del assessment, gaps principales, visualizaciones y roadmap de iniciativas sugeridas.
      </p>

      <div class="pdf-meta-grid">
        <div>
          <span>Fecha de generación</span>
          <strong>${escapeHtml(data.generatedAt)}</strong>
        </div>
        <div>
          <span>Escenario</span>
          <strong>${escapeHtml(data.scenarioLabel)}</strong>
        </div>
        <div>
          <span>Filtros aplicados</span>
          <strong>${escapeHtml(data.filters)}</strong>
        </div>
        <div>
          <span>Objetivo de madurez</span>
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
        Este informe resume la lectura actual del assessment FP&A. Los resultados reflejan los filtros activos
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
    ["Procesos", procesos, "#86BC25"],
    ["Tecnología", tecnologia, "#ED8B00"],
    ["Organización", organizacion, "#012169"],
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
  if (priority === "Alta") return "#BB3128";
  if (priority === "Media") return "#ED8B00";
  if (priority === "Baja") return "#86BC25";
  return "#737A74";
}



function buildPdfEnhancedRadarSection(data) {
  const radarCards = [
    { title: "Procesos", image: data.radarImages.procesos, color: "#86BC25" },
    { title: "Tecnología", image: data.radarImages.tecnologia, color: "#ED8B00" },
    { title: "Organización", image: data.radarImages.organizacion, color: "#012169" },
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
        <td class="num">${escapeHtml(formatNumber(row.scoreMedio))}</td>
        <td class="num">${escapeHtml(formatNumber(row.gap))}</td>
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
            <th>Gap</th>
            <th>Prioridad</th>
            <th>Avance</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8">No hay datos para los filtros actuales.</td></tr>`}
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
            <th>Owner</th>
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
      <h2>7. Comentarios y hallazgos</h2>
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
      background: #86BC25;
      border-radius: 999px;
    }

    .pdf-eyebrow {
      margin: 0 0 10px;
      color: #86BC25;
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
      border-bottom: 3px solid #86BC25;
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
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 24px;
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
      color: #737a74;
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





function buildSummaryRows() {
  return unique(state.items.map((item) => item.capacidad)).map((capability) => {
    const items = state.items.filter((item) => item.capacidad === capability);
    const scored = items.map(calculate).filter((metrics) => !metrics.isPending);
    const scoreMedio = average(scored.map((metrics) => metrics.scoreMedio));
    const gap = scoreMedio === null ? null : round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
    return {
      Tipo: "Resumen",
      Capacidad: capability,
      Subcapacidad: "",
      Procesos: average(items.map((item) => item.scores.procesos).filter(Number.isFinite)) ?? "",
      Tecnologia: average(items.map((item) => item.scores.tecnologia).filter(Number.isFinite)) ?? "",
      Organizacion: average(items.map((item) => item.scores.organizacion).filter(Number.isFinite)) ?? "",
      ScoreMedio: scoreMedio ?? "",
      Nivel: scoreMedio === null ? "" : getMaturityLevel(scoreMedio),
      Gap: gap ?? "",
      Prioridad: priorityFromGap(gap),
      Oleada: "",
      IniciativaSugerida: "",
      Owner: "",
      Estado: "",
      Comentarios: "",
    };
  });
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(",")];
  rows.forEach((row) => {
    csvRows.push(headers.map((header) => csvEscape(row[header])).join(","));
  });
  return csvRows.join("\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


function resetScenario() {
  const confirmed = window.confirm(
    "¿Seguro que quieres restaurar la base? Se perderán los cambios guardados localmente en este navegador.",
  ); // NUEVO: pide confirmación antes de borrar datos locales

  if (!confirmed) {
    return; // NUEVO: si el usuario cancela, no se borra nada
  }

  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}


function showNotice(message, persistent = false) {
  els.loadNotice.textContent = message;
  els.loadNotice.hidden = false;
  if (persistent) return;
  window.setTimeout(() => {
    if (els.loadNotice.textContent === message) {
      els.loadNotice.hidden = true;
    }
  }, 7000);
}



function getScenarioIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawScenarioId = params.get("scenario");

  if (!rawScenarioId) {
    return null;
  }

  const cleanScenarioId = rawScenarioId.trim();

  // Permitimos letras, números, guiones y guiones bajos para evitar rutas raras en Firebase
  const isValidScenarioId = /^[a-zA-Z0-9_-]{6,120}$/.test(cleanScenarioId);

  if (!isValidScenarioId) {
    console.warn("Scenario ID inválido. Se usará modo local:", cleanScenarioId);
    return null;
  }

  return cleanScenarioId;
}


function showScenarioModeNotice() {
  if (!scenarioId) {
    return;
  }

  showNotice(
    `Escenario compartido activo: ${scenarioId}. Los cambios se guardan automáticamente y se sincronizan con cualquier navegador que use este mismo enlace.`,
  ); // MODIFICADO: el mensaje refleja que Firebase ya guarda y sincroniza datos

}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
