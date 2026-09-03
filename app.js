// Firebase SDK - conexión inicial
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// El motor de calculo F3M: reglas de negocio puras, sin DOM ni estado global.
// Vive aparte para poder probarlo sin levantar la aplicacion (ver tests/).
import {
  DEFAULT_TARGET_MATURITY,
  PALANCAS,
  agregarPorCapacidad as agregarPorCapacidadCore,
  average,
  calcularMetricas,
  getMaturityLevel,
  getMaturityLevelNumber,
  normalizeTargetValue,
  toScore,
  unique,
} from "./core/calculo.js";

// El contrato de un escenario: que campos admite Firebase y con que limites.
// Espejo de database.rules.json, para no enviar nunca algo que sera rechazado.
import {
  ESTADOS_VALIDOS,
  LIMITES_DE_TEXTO,
  normalizarAutoria,
  normalizarEscenarioParaFirebase,
  normalizarEstado,
  recortarAlLimite,
  revisarEscenario,
} from "./core/escenario.js";

// Escapado, formato y colores de marca. Los comparten la aplicacion y el
// informe PDF, que desde que vive aparte ya no puede leerlos de aqui.
import {
  COLOR_DE_PALANCA,
  escapeAttr,
  escapeHtml,
  formatNumber,
  priorityColor,
} from "./core/presentacion.js";

// El informe PDF: entra el objeto de datos, sale el documento imprimible.
import { buildEnhancedPdfReportHtml } from "./informe/pdf.js";

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
const firebaseAuth = getAuth(firebaseApp);

console.log("Firebase conectado correctamente:", firebaseConfig.projectId);



// Escenario compartido leído desde la URL
const scenarioId = getScenarioIdFromUrl();
const scenarioDatabaseRef = scenarioId ? ref(firebaseDatabase, `scenarios/${scenarioId}`) : null;

console.log("Modo escenario compartido:", scenarioId ? "escenario compartido" : "modo local sin scenario");



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
  transacciones: {
    id: "transacciones",
    label: "Transacciones",
    title: "Transacciones",
    group: "Transaccionales y operativos",
    dataUrl: "data/domains/transacciones.json",
  },
  "finanzas-negocio": {
    id: "finanzas-negocio",
    label: "Finanzas de negocio",
    title: "Finanzas de negocio",
    group: "Estratégicos y de negocio",
    dataUrl: "data/domains/finanzas-negocio.json",
  },
    "auditoria-interna": {
    id: "auditoria-interna",
    label: "Auditoría Interna",
    title: "Auditoría Interna",
    group: "Técnicos y especializados",
    dataUrl: "data/domains/auditoria-interna.json",
  },
    "finanzas-estrategicas": {
    id: "finanzas-estrategicas",
    label: "Finanzas Estratégicas",
    title: "Finanzas Estratégicas",
    group: "Estratégicos y de negocio",
    dataUrl: "data/domains/finanzas-estrategicas.json",
  },
    "relacion-inversores": {
    id: "relacion-inversores",
    label: "Relación con Inversores",
    title: "Relación con Inversores",
    group: "Técnicos y especializados",
    dataUrl: "data/domains/relacion-inversores.json",
  },

  tesoreria: {
    id: "tesoreria",
    label: "Tesorería",
    title: "Tesorería",
    group: "Técnicos y especializados",
    dataUrl: "data/domains/tesoreria.json",
  },

  fiscal: {
    id: "fiscal",
    label: "Fiscal",
    title: "Fiscal",
    group: "Técnicos y especializados",
    dataUrl: "data/domains/fiscal.json",
  },
};


const STORAGE_KEY = "f3m-fpa-assessment-scenario";


// Las palancas las define el motor; aqui solo se les pone el color de marca.
const LEVERS = PALANCAS.map((palanca) => ({
  ...palanca,
  color: COLOR_DE_PALANCA[palanca.key],
}));

const PRIORITY_ORDER = {
  Alta: 1,
  Media: 2,
  Baja: 3,
  Pendiente: 4,
};

// Los estados y los limites de longitud de los campos editables los define el
// contrato del escenario, que es el espejo de database.rules.json.
const STATUS_OPTIONS = ESTADOS_VALIDOS;


const state = {
  activeDomainId: DEFAULT_DOMAIN_ID,
  domains: {},
  meta: null,
  items: [],
  targets: {},
};


let capabilityRadarCharts = {
  procesos: null,
  tecnologia: null,
  organizacion: null,
};


const expandedHeatmapCapabilities = new Set(); // NUEVO: mantiene abiertas las capacidades desplegadas del heatmap entre renders

// Que tarjetas tienen desplegado "Ver detalle". Cada repintado de la lista las
// reconstruye desde la plantilla, con el detalle cerrado: quien abria los
// niveles de madurez para decidir entre un 3 y un 4 se los encontraba cerrados
// justo despues de puntuar.
const tarjetasConDetalleAbierto = new Set();


let isApplyingRemoteScenario = false; // NUEVO: evita guardar de vuelta mientras estamos cargando datos remotos
let pendingScenarioWrites = 0;
let snapshotRemotoPendiente = null; // Snapshot que llegó mientras guardábamos, para aplicarlo después

const NOMBRE_STORAGE_KEY = "f3m-nombre-editor";

// Identidad de quien edita. Queda a null si la autenticación no está disponible:
// la app debe seguir funcionando aunque Anonymous Auth no esté activado en la consola.
let usuarioActual = null;

let scoringCriteriaTrigger = null;
let aiInitiativeTrigger = null;


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

  const items = data.subcapacities.map(normalizeItem);

  const defaultTarget = normalizeTargetValue(
    data.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  state.domains[domainId] = {
    meta: data.meta,
    items,
    targets: normalizeDomainTargets(
      items,
      data.targets,
      defaultTarget,
    ),
  };

  return state.domains[domainId];
}

/**
 * Carga los nueve dominios sin que uno estropee a los demas.
 *
 * Con Promise.all, un solo JSON inaccesible hacia caer init() entero y la
 * herramienta mostraba "no se pudo cargar el JSON de datos" aunque los otros
 * ocho dominios estuvieran perfectos.
 */
async function loadCoreDomains() {
  const ids = Object.keys(DOMAINS);

  const resultados = await Promise.allSettled(
    ids.map((domainId) => loadDomainData(domainId)),
  );

  const fallidos = ids.filter((_, i) => resultados[i].status === "rejected");

  resultados.forEach((resultado, i) => {
    if (resultado.status === "rejected") {
      console.error(`No se pudo cargar el dominio ${ids[i]}.`, resultado.reason);
    }
  });

  return {
    cargados: ids.filter((id) => state.domains[id]),
    fallidos,
  };
}


/** Deja sin usar los botones de los dominios que no han podido cargarse. */
function marcarDominiosNoDisponibles(fallidos) {
  fallidos.forEach((domainId) => {
    const boton = document.querySelector(`[data-domain-id="${CSS.escape(domainId)}"]`);

    if (!boton) {
      return;
    }

    boton.disabled = true;
    boton.classList.add("is-disabled");
    boton.title = "Este dominio no se ha podido cargar. Recarga la página para volver a intentarlo.";
  });
}



function syncActiveDomainState() {
  if (!state.activeDomainId || !state.domains[state.activeDomainId]) {
    return;
  }

  state.domains[state.activeDomainId].items = state.items;
  state.domains[state.activeDomainId].meta = state.meta;
  state.domains[state.activeDomainId].targets = state.targets;
}



function setActiveDomain(domainId) {
  const domainData = state.domains[domainId];

  if (!domainData) {
    throw new Error(`Dominio no cargado: ${domainId}`);
  }

  const defaultTarget = normalizeTargetValue(
    domainData.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  domainData.targets = normalizeDomainTargets(
    domainData.items,
    domainData.targets,
    defaultTarget,
  );

  state.activeDomainId = domainId;
  state.meta = domainData.meta;
  state.items = domainData.items;
  state.targets = domainData.targets;

  updateActiveDomainUi();


}



function resetDomainViewState() {
  if (els.capacityFilter) {
    els.capacityFilter.value = "all";
  }

  if (els.priorityFilter) {
    els.priorityFilter.value = "all";
  }

  if (els.searchInput) {
    els.searchInput.value = "";
  }

  expandedHeatmapCapabilities.clear();
}


async function switchDomain(domainId) {
  if (domainId === state.activeDomainId) {
    return;
  }

  syncActiveDomainState();

  await loadDomainData(domainId);
  setActiveDomain(domainId);

  populateCapacityFilter();
  resetDomainViewState();
  renderAll();

  const domainSwitcher = document.querySelector(".domain-switcher");

  if (domainSwitcher) {
    domainSwitcher.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } else {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
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

  if (els.dashboardDomainTitle && domain) {
  els.dashboardDomainTitle.textContent = `Lectura del dominio ${domain.label}`;
  }

}


async function init() {
  cacheElements();
  bindGlobalEvents();
  setInitialLoading(true); // NUEVO: muestra estado de carga mientras se inicializa la app
  showScenarioModeNotice();


  try {
    const { cargados, fallidos } = await loadCoreDomains();

    // Ningún dominio disponible: casi siempre es que se ha abierto el archivo
    // con file:// en vez de servirlo, que es lo único que el usuario puede
    // arreglar por su cuenta.
    if (!cargados.length) {
      showNotice(
        "No se han podido cargar los datos del assessment. Si has abierto el archivo directamente, "
          + "ábrelo a través de un servidor local: en esta carpeta, ejecuta "
          + "python -m http.server 8000 y entra en http://localhost:8000/.",
        "error",
      );

      return;
    }

    if (fallidos.length) {
      marcarDominiosNoDisponibles(fallidos);

      const nombres = fallidos.map((id) => DOMAINS[id]?.label || id).join(", ");

      showNotice(
        `No se han podido cargar estos dominios: ${nombres}. El resto funciona con normalidad; `
          + "recarga la página para volver a intentarlo.",
        "aviso",
      );
    }

    setActiveDomain(
      state.domains[DEFAULT_DOMAIN_ID] ? DEFAULT_DOMAIN_ID : cargados[0],
    );

    /* La copia local se carga siempre, también en escenarios compartidos */
    applyStoredScenario();

    // Antes de sincronizar: así el primer cambio ya sale atribuido.
    await inicializarIdentidad();

    await initializeSharedScenario();

    populateCapacityFilter();
    renderAll();
  } catch (error) {
    // Hasta aquí solo se llega por un fallo inesperado: los dominios y la
    // sincronizacion ya se gestionan por su cuenta. Antes cualquier error,
    // incluido el almacenamiento bloqueado, se explicaba como si fuera un
    // problema de servidor local.
    showNotice(
      "La herramienta no ha podido arrancar del todo. Recarga la página; si vuelve a ocurrir, "
        + "avisa al equipo que la mantiene.",
      "error",
    );

    console.error(error);
  } finally {
    setInitialLoading(false); // NUEVO: oculta el estado de carga al terminar, incluso si hay error
  }
}


function cacheElements() {
  [
    "loadNotice",
    "loadNoticeText",
    "loadNoticeIcon",
    "loadNoticeClose",
    "initialLoadingState", // NUEVO: estado visual de carga inicial
    "sourceNote",
    "kpiGrid",
    "dashboardHeadline",
    "priorityBars",
    "leverBars",
    "summaryTable",
    "capabilityRadarProcessesChart",
    "capabilityRadarTechnologyChart",
    "capabilityRadarOrganizationChart",
    "capacityFilter",
    "priorityFilter",
    "searchInput",
    "capabilityTargetsPanel",
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
    "dialogModal",
    "dialogIcon",
    "dialogEyebrow",
    "dialogTitle",
    "dialogMessage",
    "dialogFieldWrap",
    "dialogFieldLabel",
    "dialogField",
    "dialogSecondary",
    "dialogCancel",
    "dialogConfirm",
    "scoringCriteriaModal", // NUEVO: modal de criterios F3M
    "closeScoringCriteriaModalButton", // NUEVO: botón cerrar modal
    "criteriaSubcapability",
    "criteriaSubcapabilityTitle",
    "criteriaSubcapabilityLevels",
    "saveStatus", // NUEVO: indicador visual de guardado
    "backToTopButton",
    "importJsonButton",
    "exportJsonButton",
    "exportCsvButton",
    "exportPdfButton", // NUEVO: botón de exportación PDF
    "resetButton",
    "scenarioMenuButton",
    "scenarioMenu",
    "scenarioMenuState",
    "createScenarioButton",
    "copyScenarioLinkButton",
    "leaveScenarioButton",
    "editorNameButton",
    "scenarioFileInput",
    "dashboardDomainTitle",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindGlobalEvents() {
  els.capacityFilter.addEventListener("change", renderAll);
  els.priorityFilter.addEventListener("change", renderAll);
  els.searchInput.addEventListener("input", handleSearchInput);

  document.addEventListener("click", (event) => {
    const clearButton = event.target.closest("[data-clear-filters]");

    if (clearButton) {
      clearActiveFilters();
      return;
    }

    const removeButton = event.target.closest("[data-remove-filter]");

    if (removeButton) {
      removeActiveFilter(removeButton.dataset.removeFilter);
    }
  });
  els.importJsonButton.addEventListener("click", () => els.scenarioFileInput.click());
  els.scenarioFileInput.addEventListener("change", importScenario);
  els.exportJsonButton.addEventListener("click", exportScenarioJson);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.exportPdfButton.addEventListener("click", exportPdfReport); // NUEVO: genera informe imprimible/PDF
  els.resetButton.addEventListener("click", resetScenario);
  els.createScenarioButton?.addEventListener("click", createSharedScenario);
  els.copyScenarioLinkButton?.addEventListener("click", copyScenarioLink);
  els.leaveScenarioButton?.addEventListener("click", salirDelEscenario);
  els.editorNameButton?.addEventListener("click", pedirNombreEditor);
  els.heatmapExpandToggle?.addEventListener("click", handleHeatmapExpandToggleAll);
  els.loadNoticeClose?.addEventListener("click", ocultarAviso);
  setupMenuDeEscenario();
  setupVistas();
  setupScoringCriteriaModal(); // NUEVO: configura modal de criterios F3M
  setupAiInitiativeModal();
  setupDomainSwitcher();
  setupBackToTopButton();
}



function createDefaultTargets(items, defaultTarget = DEFAULT_TARGET_MATURITY) {
  const targets = {};

  unique(items.map((item) => item.capacidad)).forEach((capability) => {
    targets[capability] = {
      procesos: defaultTarget,
      tecnologia: defaultTarget,
      organizacion: defaultTarget,
    };
  });

  return targets;
}



function normalizeDomainTargets(
  items,
  savedTargets = {},
  defaultTarget = DEFAULT_TARGET_MATURITY,
) {
  const targets = createDefaultTargets(
    items,
    defaultTarget,
  );

  const savedTargetsArray = Array.isArray(savedTargets)
    ? savedTargets
    : Object.entries(savedTargets || {}).map(
        ([capabilityKey, capabilityTargets]) => {
          let capability = capabilityKey;

          try {
            capability = decodeURIComponent(
              capabilityKey,
            );
          } catch (error) {
            capability = capabilityKey;
          }

          return {
            capacidad:
              capabilityTargets?.capacidad ||
              capability,
            procesos:
              capabilityTargets?.procesos,
            tecnologia:
              capabilityTargets?.tecnologia,
            organizacion:
              capabilityTargets?.organizacion,
          };
        },
      );

  savedTargetsArray.forEach((savedTarget) => {
    const savedCapability =
      savedTarget?.capacidad;

    if (!savedCapability) {
      return;
    }

    const matchingCapability =
      Object.keys(targets).find(
        (capability) =>
          normalizeMatchKey(capability) ===
          normalizeMatchKey(savedCapability),
      );

    if (!matchingCapability) {
      return;
    }

    targets[matchingCapability] = {
      procesos: normalizeTargetValue(
        savedTarget.procesos,
        defaultTarget,
      ),
      tecnologia: normalizeTargetValue(
        savedTarget.tecnologia,
        defaultTarget,
      ),
      organizacion: normalizeTargetValue(
        savedTarget.organizacion,
        defaultTarget,
      ),
    };
  });

  return targets;
}



function serializeTargetsForFirebase(
  items,
  targets,
  defaultTarget = DEFAULT_TARGET_MATURITY,
) {
  const normalizedTargets =
    normalizeDomainTargets(
      items,
      targets,
      defaultTarget,
    );

  return Object.entries(
    normalizedTargets,
  ).map(
    ([capability, capabilityTargets]) => ({
      capacidad: capability,

      procesos: normalizeTargetValue(
        capabilityTargets.procesos,
        defaultTarget,
      ),

      tecnologia: normalizeTargetValue(
        capabilityTargets.tecnologia,
        defaultTarget,
      ),

      organizacion: normalizeTargetValue(
        capabilityTargets.organizacion,
        defaultTarget,
      ),
    }),
  );
}



/**
 * Deja el escenario con exactamente lo que admiten las reglas de Firebase.
 *
 * Antes copiaba con spread las claves de la raiz y de cada dominio, asi que un
 * campo que las reglas no declaran viajaba igualmente y hacia que rechazaran la
 * escritura ENTERA. Ahora se construye desde cero con los campos permitidos.
 */
function sanitizeScenarioForFirebase(payload) {
  return normalizarEscenarioParaFirebase(
    payload,
    (items, targets, meta) =>
      serializeTargetsForFirebase(
        items,
        targets,
        normalizeTargetValue(
          meta?.targetMaturity,
          DEFAULT_TARGET_MATURITY,
        ),
      ),
  );
}



/**
 * Objetivos de una capacidad, devolviendo SIEMPRE la misma referencia mientras
 * los tres valores no cambien.
 *
 * Los valores se recalculan en cada llamada, asi que la funcion sigue siendo
 * exacta: la cache solo decide si reutiliza el objeto anterior o crea uno
 * nuevo. Eso permite que calculate() compare objetivos por referencia, sin
 * construir una firma de texto en cada una de sus llamadas.
 *
 * Nadie muta el objeto devuelto: las escrituras van a state.domains[..].targets,
 * que es el origen, no el resultado.
 */
const cacheDeObjetivos = new Map();

function getCapabilityTargets(capability) {
  const defaultTarget = normalizeTargetValue(
    state.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  const activeDomainTargets =
    state.domains[state.activeDomainId]?.targets;

  const capabilityTargets =
    activeDomainTargets?.[capability] ||
    state.targets?.[capability];

  const procesos = normalizeTargetValue(
    capabilityTargets?.procesos,
    defaultTarget,
  );

  const tecnologia = normalizeTargetValue(
    capabilityTargets?.tecnologia,
    defaultTarget,
  );

  const organizacion = normalizeTargetValue(
    capabilityTargets?.organizacion,
    defaultTarget,
  );

  const guardados = cacheDeObjetivos.get(capability);

  if (
    guardados &&
    guardados.procesos === procesos &&
    guardados.tecnologia === tecnologia &&
    guardados.organizacion === organizacion
  ) {
    return guardados;
  }

  const objetivos = { procesos, tecnologia, organizacion };
  cacheDeObjetivos.set(capability, objetivos);

  return objetivos;
}



function normalizeItem(item) {
  return {
    ...item,
    scores: {
      procesos: toScore(item.scores?.procesos),
      tecnologia: toScore(item.scores?.tecnologia),
      organizacion: toScore(item.scores?.organizacion),
    },
    owner: recortarAlLimite("owner", item.owner || ""),
    status: item.status || "No iniciado",
    comentario: recortarAlLimite(
      "comentario",
      item.comentario || item.comentariosHallazgos || "",
    ),
  };
}

/**
 * Metricas de una subcapacidad.
 *
 * El resultado depende solo de los tres scores del item y de los tres
 * objetivos de su capacidad, asi que se guarda hasta que alguno de esos seis
 * valores cambia. No hay que invalidar la cache a mano en ningun sitio: si un
 * score o un objetivo cambia, la comparacion falla y se recalcula.
 *
 * Antes se llamaba ocho veces por item y render —una por vista, mas las de
 * getVisibleItems— repitiendo exactamente el mismo trabajo.
 */
const cacheDeCalculo = new WeakMap();

function calculate(item) {
  const capabilityTargets = getCapabilityTargets(
    item.capacidad,
  );

  const guardado = cacheDeCalculo.get(item);

  if (
    guardado &&
    guardado.objetivos === capabilityTargets &&
    guardado.procesos === item.scores.procesos &&
    guardado.tecnologia === item.scores.tecnologia &&
    guardado.organizacion === item.scores.organizacion
  ) {
    return guardado.metricas;
  }

  const metricas = calcularMetricas(item, capabilityTargets);

  cacheDeCalculo.set(item, {
    objetivos: capabilityTargets,
    procesos: item.scores.procesos,
    tecnologia: item.scores.tecnologia,
    organizacion: item.scores.organizacion,
    metricas,
  });

  return metricas;
}


/**
 * Agregacion por capacidad con el estado de la aplicacion.
 *
 * La aritmetica esta en el motor; aqui solo se le dice de donde salen las
 * metricas —de calculate(), con cache— y los objetivos de cada capacidad.
 */
function agregarPorCapacidad(items) {
  return agregarPorCapacidadCore(
    items,
    calculate,
    getCapabilityTargets,
  );
}


const VISTAS = ["dashboard", "assessment", "heatmap", "roadmap"];

let vistaActiva = "dashboard";


/**
 * Las cuatro pestanas eran anclas dentro de una sola pagina de casi 10.000 px:
 * pulsar "Roadmap" hacia un scroll de ocho pantallas, no cambiaba de vista.
 * Ademas obligaba a repintar las cuatro secciones en cada cambio, estuvieran o
 * no a la vista.
 *
 * Ahora solo se pinta y se muestra la seccion activa. El enlace directo
 * (#roadmap) se sigue respetando, y sin JavaScript las cuatro quedan visibles,
 * que es el comportamiento anterior.
 */
function setupVistas() {
  const enlaces = [...document.querySelectorAll(".tabs a")];

  if (!enlaces.length) {
    return;
  }

  enlaces.forEach((enlace) => {
    enlace.addEventListener("click", (event) => {
      event.preventDefault();
      mostrarVista(enlace.getAttribute("href").slice(1));
    });
  });

  // Alguien puede llegar con un enlace directo, o usar atras y adelante.
  window.addEventListener("hashchange", () => {
    mostrarVista(vistaDesdeLaUrl(), { actualizarUrl: false });
  });

  mostrarVista(vistaDesdeLaUrl(), { actualizarUrl: false, desplazar: false });
}


function vistaDesdeLaUrl() {
  const id = window.location.hash.slice(1);

  return VISTAS.includes(id) ? id : "dashboard";
}


function mostrarVista(id, { actualizarUrl = true, desplazar = true } = {}) {
  if (!VISTAS.includes(id)) {
    return;
  }

  vistaActiva = id;

  VISTAS.forEach((vista) => {
    const seccion = document.getElementById(vista);

    if (seccion) {
      seccion.hidden = vista !== id;
    }
  });

  document.querySelectorAll(".tabs a").forEach((enlace) => {
    const esActiva = enlace.getAttribute("href") === `#${id}`;

    enlace.classList.toggle("active", esActiva);
    enlace.setAttribute("aria-current", esActiva ? "page" : "false");
  });

  if (actualizarUrl) {
    // replaceState y no el hash directo: cambiar el hash provocaria un salto.
    window.history.replaceState(null, "", `#${id}`);
  }

  renderAll();

  if (desplazar) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}


function setInitialLoading(isLoading) {
  if (!els.initialLoadingState) {
    return;
  }

  els.initialLoadingState.hidden = !isLoading;
}


function updateModalOpenState() {
  const hasOpenModal =
    !els.scoringCriteriaModal?.hidden ||
    !els.aiInitiativeModal?.hidden ||
    !els.dialogModal?.hidden;

  document.body.classList.toggle("modal-open", hasOpenModal);
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

      scoringCriteriaTrigger = button;
      openScoringCriteriaModal(button.closest(".assessment-card")?.dataset.id);
  });

  els.closeScoringCriteriaModalButton?.addEventListener("click", closeScoringCriteriaModal);

  els.scoringCriteriaModal.addEventListener("click", (event) => {
    if (event.target === els.scoringCriteriaModal) {
      closeScoringCriteriaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (els.scoringCriteriaModal.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeScoringCriteriaModal();
      return;
    }

    // Sin esto el tabulador se escapaba al contenido de detras, que sigue ahi.
    if (event.key === "Tab") {
      atraparFoco(event, els.scoringCriteriaModal);
    }
  });

  const tabs = [...els.scoringCriteriaModal.querySelectorAll(".criteria-tab")];

  tabs.forEach((tab, indice) => {
    tab.addEventListener("click", () => {
      activateScoringCriteriaTab(tab.dataset.criteriaTab);
    });

    // Un grupo de pestanas se recorre con las flechas, no con el tabulador.
    tab.addEventListener("keydown", (event) => {
      const salto = { ArrowRight: 1, ArrowLeft: -1, Home: -indice, End: tabs.length - 1 - indice }[
        event.key
      ];

      if (salto === undefined) {
        return;
      }

      event.preventDefault();

      const siguiente = tabs[(indice + salto + tabs.length) % tabs.length];

      activateScoringCriteriaTab(siguiente.dataset.criteriaTab);
      siguiente.focus();
    });
  });
}

/**
 * Abre la guia de evaluacion con los niveles de la subcapacidad que se esta
 * puntuando.
 *
 * El modal ensenaba la misma rubrica generica para las 152 subcapacidades de los
 * nueve dominios. Justo cuando hay que decidir si algo es un 3 o un 4, lo que
 * hace falta es la descripcion de esa subcapacidad, que hasta ahora vivia en
 * otro sitio: la lista de niveles de la tarjeta.
 */
function openScoringCriteriaModal(itemId) {
  pintarNivelesDeLaSubcapacidad(itemId);

  els.scoringCriteriaModal.hidden = false;
  activateScoringCriteriaTab("procesos");
  els.closeScoringCriteriaModalButton?.focus();
  updateModalOpenState();
}


function pintarNivelesDeLaSubcapacidad(itemId) {
  const item = state.items.find((entrada) => entrada.id === itemId);
  const niveles = Object.entries(item?.maturity || {});

  if (!item || !niveles.length) {
    els.criteriaSubcapability.hidden = true;
    return;
  }

  const metrics = calculate(item);
  const nivelActual = getMaturityLevelNumber(metrics.scoreMedio);

  els.criteriaSubcapabilityTitle.textContent = item.subcapacidad;

  els.criteriaSubcapabilityLevels.innerHTML = niveles
    .map(([nivel, texto]) => {
      const esActual = Number(nivel) === nivelActual;

      return `
        <li class="${esActual ? "is-current-level" : ""}">
          <strong>Nivel ${escapeHtml(nivel)}</strong>
          <span>${escapeHtml(texto)}</span>
          ${esActual ? '<em class="current-level-label">Nivel actual</em>' : ""}
        </li>
      `;
    })
    .join("");

  els.criteriaSubcapability.hidden = false;
}

function closeScoringCriteriaModal() {
  els.scoringCriteriaModal.hidden = true;

  if (scoringCriteriaTrigger?.isConnected) {
    scoringCriteriaTrigger.focus();
  }

  scoringCriteriaTrigger = null;
  updateModalOpenState();
}

function activateScoringCriteriaTab(tabKey) {
  els.scoringCriteriaModal.querySelectorAll(".criteria-tab").forEach((tab) => {
    const isActive = tab.dataset.criteriaTab === tabKey;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
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

    aiInitiativeTrigger = button;
    openAiInitiativeModal(button.dataset.id);
  });

  els.closeAiInitiativeModalButton?.addEventListener("click", closeAiInitiativeModal);

  els.aiInitiativeModal.addEventListener("click", (event) => {
    if (event.target === els.aiInitiativeModal) {
      closeAiInitiativeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (els.aiInitiativeModal.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeAiInitiativeModal();
      return;
    }

    if (event.key === "Tab") {
      atraparFoco(event, els.aiInitiativeModal);
    }
  });
}



function setupDomainSwitcher() {
  const switcher = document.querySelector(".domain-switcher");

  if (!switcher) {
    return;
  }

  switcher.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-domain-id]");

    if (!button || button.disabled) {
      return;
    }

    const domainId = button.dataset.domainId;

    if (!domainId || domainId === state.activeDomainId) {
      return;
    }

    try {
      await switchDomain(domainId);
    } catch (error) {
      showNotice(`No se ha podido abrir el dominio ${DOMAINS[domainId]?.label || domainId}. Recarga la página e inténtalo de nuevo.`, "error");
      console.error(error);
    }
  });
}


/**
 * La cabecera tenia nueve botones en fila, cuatro de ellos hablando de JSON.
 *
 * Todo lo que no es exportar para el cliente pasa a un menu: son acciones que
 * se usan una vez por sesion, no en cada momento, y ahi caben con una linea que
 * explique que hacen.
 */
function setupMenuDeEscenario() {
  if (!els.scenarioMenuButton || !els.scenarioMenu) {
    return;
  }

  const abrir = (abierto) => {
    els.scenarioMenu.hidden = !abierto;
    els.scenarioMenuButton.setAttribute("aria-expanded", String(abierto));
  };

  els.scenarioMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    abrir(els.scenarioMenu.hidden);
  });

  // Elegir una opcion cierra el menu antes de que se abra su dialogo.
  els.scenarioMenu.addEventListener("click", (event) => {
    if (event.target.closest(".header-menu-item")) {
      abrir(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!els.scenarioMenu.hidden && !event.target.closest(".header-menu")) {
      abrir(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.scenarioMenu.hidden) {
      abrir(false);
      els.scenarioMenuButton.focus();
    }
  });
}


/** Deja claro en el menu sobre que se esta trabajando. */
function actualizarEstadoDelMenu() {
  if (!els.scenarioMenuState) {
    return;
  }

  els.scenarioMenuState.textContent = scenarioId
    ? getScenarioShortLabel()
    : "Copia de este navegador";
}


function setupBackToTopButton() {
  if (!els.backToTopButton) {
    return;
  }

  const updateBackToTopVisibility = () => {
    els.backToTopButton.hidden = window.scrollY < 500;
  };

  els.backToTopButton.addEventListener("click", () => {
    const domainSwitcher = document.querySelector(".domain-switcher");

    if (domainSwitcher) {
      domainSwitcher.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  window.addEventListener("scroll", updateBackToTopVisibility, {
    passive: true,
  });

  updateBackToTopVisibility();
}


/**
 * Datos de IA de una subcapacidad, si los trae.
 *
 * Habia un respaldo por nombre de capacidad con los casos de FP&A. Nunca se
 * usaba: las 152 subcapacidades traen su propio bloque ai desde el Excel, y para
 * los otros ocho dominios los nombres de capacidad no coincidian de todas
 * formas.
 */
function getAiDataForItem(item) {
  if (item?.ai?.cases || item?.ai?.advanced) {
    return item.ai;
  }

  return null;
}

function openAiInitiativeModal(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);

  if (!item) {
    showNotice("No se ha encontrado la subcapacidad asociada a esta iniciativa de IA.", "error");
    return;
  }

  const aiData = getAiDataForItem(item);

  if (!aiData) {
    showNotice("Esta subcapacidad no tiene ninguna iniciativa de IA asociada.", "info");
    return;
  }

  els.aiModalCapability.textContent = item.capacidad;
  els.aiModalSubcapability.textContent = `Subcapacidad relacionada: ${item.subcapacidad}`;
  els.aiModalCases.textContent = aiData.cases || "Sin casos AI asociados informados.";
  els.aiModalAdvanced.textContent = aiData.advanced || "Sin aplicación avanzada informada.";
  els.aiModalSource.textContent = aiData.source ? `Fuente: ${aiData.source}` : "";

  els.aiInitiativeModal.hidden = false;
  els.closeAiInitiativeModalButton?.focus();
  updateModalOpenState();
}

function closeAiInitiativeModal() {
  els.aiInitiativeModal.hidden = true;
  updateModalOpenState();

  if (aiInitiativeTrigger?.isConnected) {
    aiInitiativeTrigger.focus();
  }

  aiInitiativeTrigger = null;
}



/**
 * Cuantas subcapacidades tiene puntuadas cada dominio.
 *
 * En un encargo multidominio es la pregunta constante: por donde vamos. El
 * conmutador ensenaba nueve botones iguales y el unico contador que habia,
 * el de la pestana Assessment, solo hablaba del dominio abierto.
 *
 * Se cuentan las que tienen alguna palanca informada, sin pasar por calculate:
 * los objetivos son los del dominio activo y darian gaps equivocados para los
 * demas.
 */
function actualizarAvanceDeDominios() {
  Object.entries(DOMAINS).forEach(([domainId]) => {
    const boton = document.querySelector(`[data-domain-id="${CSS.escape(domainId)}"]`);
    const dominio = state.domains[domainId];

    if (!boton || !dominio) {
      return;
    }

    const total = dominio.items.length;

    const puntuadas = dominio.items.filter((item) =>
      LEVERS.some((lever) => Number.isFinite(item.scores[lever.key])),
    ).length;

    let contador = boton.querySelector(".domain-progress");

    if (!contador) {
      contador = document.createElement("span");
      contador.className = "domain-progress";
      boton.appendChild(contador);
    }

    contador.textContent = `${puntuadas}/${total}`;
    contador.classList.toggle("sin-empezar", puntuadas === 0);
    contador.classList.toggle("completo", puntuadas === total && total > 0);

    boton.title =
      puntuadas === 0
        ? "Sin empezar"
        : `${puntuadas} de ${total} subcapacidades puntuadas`;
  });
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
  els.assessmentTabBadge.title =
    `${scoredCount} de ${totalCount} subcapacidades puntuadas en este dominio. ` +
    "No depende de los filtros activos.";

  els.roadmapTabBadge.textContent = `${highPriorityCount} Alta`;
  els.roadmapTabBadge.title =
    `${highPriorityCount} subcapacidades de prioridad alta en este dominio. ` +
    "No depende de los filtros activos.";

  els.roadmapTabBadge.classList.toggle("tab-badge-alert", highPriorityCount > 0);
}



function renderAll(opciones = {}) {
  if (!state.items.length) {
    return;
  }

  const ambito = getScopeSummary();

  els.sourceNote.textContent = [
    `${ambito.total} subcapacidades en ${unique(state.items.map((item) => item.capacidad)).length} capacidades`,
    describirObjetivos(),
    ambito.hayFiltros
      ? `Mostrando ${ambito.visibles} de ${ambito.total} por los filtros activos`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  els.sourceNote.classList.toggle("has-scope-filter", ambito.hayFiltros);

  updateActiveFiltersUi();

  // Solo se pinta lo que se esta viendo. Las otras tres secciones estan
  // ocultas: repintarlas era trabajo tirado en cada cambio de score.
  if (vistaActiva === "dashboard") {
    renderDashboard();
  }

  if (vistaActiva === "assessment") {
    renderCapabilityTargets();

    // Al puntuar no hace falta reconstruir la lista entera: basta con refrescar
    // la tarjeta tocada, que es lo que evita perder el foco y el detalle abierto.
    if (!opciones.saltarAssessments) {
      renderAssessments();
    }
  }

  if (vistaActiva === "heatmap") {
    renderHeatmap();
  }

  if (vistaActiva === "roadmap") {
    renderRoadmap();
  }

  // Los badges miden el dominio entero, asi que se actualizan siempre.
  updateNavigationBadges();
  actualizarAvanceDeDominios();
}


function populateCapacityFilter() {
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
function getActiveFilters() {
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
function updateActiveFiltersUi() {
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
function removeActiveFilter(clave) {
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

  renderAll();
}


// Cada pulsacion lanzaba un renderAll completo, radares de Chart.js incluidos:
// escribir ocho letras costaba 235 ms de trabajo bloqueante y se notaba al
// teclear. Con una pausa corta, ocho pulsaciones son un solo repintado.
const BUSQUEDA_DIFERIDA_MS = 200;

let temporizadorDeBusqueda = null;


function handleSearchInput() {
  window.clearTimeout(temporizadorDeBusqueda);

  temporizadorDeBusqueda = window.setTimeout(() => {
    renderAll();
  }, BUSQUEDA_DIFERIDA_MS);
}


function clearActiveFilters() {
  window.clearTimeout(temporizadorDeBusqueda);

  els.capacityFilter.value = "all";
  els.priorityFilter.value = "all";
  els.searchInput.value = "";

  renderAll();
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
function getScopedItems() {
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
function describirObjetivos() {
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
function getScopeSummary() {
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


function getVisibleItems() {
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

function renderDashboard() {
  const items = getScopedItems();
  const metrics = items.map((item) => ({ item, metrics: calculate(item) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);
  const scoreGlobal = average(scored.map((entry) => entry.metrics.scoreMedio));
  const gapMedio = average(scored.map((entry) => entry.metrics.gap));
  const highCount = scored.filter((entry) => entry.metrics.prioridad === "Alta").length;


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
  renderCapabilityRadar(); // NUEVO: actualiza radar al recalcular dashboard
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

  if (!evaluadas.length) {
    els.dashboardHeadline.hidden = false;
    els.dashboardHeadline.textContent =
      "Todavía no hay ninguna subcapacidad puntuada: empieza por la pestaña Assessment.";
    return;
  }

  const titulares = [];

  // Capacidad con mayor brecha
  const porCapacidad = unique(items.map((item) => item.capacidad))
    .map((capacidad) => ({
      capacidad,
      gap: average(
        evaluadas
          .filter((entrada) => entrada.item.capacidad === capacidad)
          .map((entrada) => entrada.metrics.gap),
      ),
    }))
    .filter((fila) => Number.isFinite(fila.gap))
    .sort((a, b) => b.gap - a.gap);

  if (porCapacidad.length) {
    titulares.push(
      `Mayor brecha: ${porCapacidad[0].capacidad} (gap ${formatNumber(porCapacidad[0].gap)})`,
    );
  }

  // Palanca mas floja del dominio
  const porPalanca = LEVERS.map((lever) => ({
    label: lever.label,
    media: average(
      items.map((item) => item.scores[lever.key]).filter(Number.isFinite),
    ),
  }))
    .filter((fila) => Number.isFinite(fila.media))
    .sort((a, b) => a.media - b.media);

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


function kpiCard(label, value, note, tone = "neutral") {
  return `
    <article class="kpi-card kpi-card-${tone}">
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
  const items = getScopedItems();

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
  const rows = agregarPorCapacidad(getScopedItems()).map(
    (capacidad) => `
      <tr>
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
    <thead>
      <tr>
        <th>Capacidad</th>
        <th class="number">Procesos</th>
        <th class="number">Tecnología</th>
        <th class="number">Organización</th>
        <th class="number">Score medio</th>
        <th class="number">Objetivo medio</th>
        <th class="number">Gap vs objetivo</th>
        <th>Prioridad</th>
        <th class="number">Avance</th>
      </tr>
    </thead>

    <tbody>
      ${rows.join("")}
    </tbody>
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
    targetValues: radarData.objetivoProcesos,
    color: COLOR_DE_PALANCA.procesos,
    backgroundColor: "rgba(134, 188, 37, 0.24)",
    radarData,
  });

  renderSingleCapabilityRadar({
    key: "tecnologia",
    canvas: els.capabilityRadarTechnologyChart,
    label: "Tecnología",
    values: radarData.tecnologia,
    targetValues: radarData.objetivoTecnologia,
    color: COLOR_DE_PALANCA.tecnologia,
    backgroundColor: "rgba(237, 139, 0, 0.22)",
    radarData,
  });

  renderSingleCapabilityRadar({
    key: "organizacion",
    canvas: els.capabilityRadarOrganizationChart,
    label: "Organización",
    values: radarData.organizacion,
    targetValues: radarData.objetivoOrganizacion,
    color: COLOR_DE_PALANCA.organizacion,
    backgroundColor: "rgba(1, 33, 105, 0.18)",
    radarData,
  });
}



function renderSingleCapabilityRadar({
  key,
  canvas,
  label,
  values,
  targetValues,
  color,
  backgroundColor,
  radarData,
}) {
  if (!canvas) {
    return;
  }

  const chartData = {
    labels: radarData.displayLabels,

    datasets: [
      {
        label: `${label} actual`,
        data: values,
        fill: true,
        backgroundColor,
        borderColor: color,
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#ffffff",
        pointHoverBorderColor: color,
        order: 2,
      },
      {
        label: `${label} objetivo`,
        data: targetValues,
        fill: false,
        borderColor: "#4f5952",
        borderWidth: 2.25,
        borderDash: [7, 5],
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#4f5952",
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#4f5952",
        pointHoverBorderColor: "#ffffff",
        order: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,

    layout: {
      padding: 4,
    },

    plugins: {
      legend: {
        display: true,
        position: "bottom",

        labels: {
          usePointStyle: true,
          pointStyle: "line",
          boxWidth: 28,
          boxHeight: 8,
          padding: 16,
          color: "#3a433d",

          font: {
            size: 11,
            weight: "700",
          },
        },
      },

      tooltip: {
        callbacks: {
          title: (items) => {
            const index = items[0]?.dataIndex ?? 0;

            return radarData.originalLabels[index] || "";
          },

          label: (context) => {
            return `${context.dataset.label}: ${formatNumber(
              context.parsed.r,
            )}`;
          },
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
    originalLabels: rows.map(
      (row) => row.Capacidad,
    ),

    displayLabels: rows.map(
      (row) => getRadarShortLabel(row.Capacidad),
    ),

    procesos: rows.map(
      (row) => toRadarNumber(row.Procesos),
    ),

    objetivoProcesos: rows.map(
      (row) => toRadarNumber(row.ObjetivoProcesos),
    ),

    tecnologia: rows.map(
      (row) => toRadarNumber(row.Tecnologia),
    ),

    objetivoTecnologia: rows.map(
      (row) => toRadarNumber(row.ObjetivoTecnologia),
    ),

    organizacion: rows.map(
      (row) => toRadarNumber(row.Organizacion),
    ),

    objetivoOrganizacion: rows.map(
      (row) => toRadarNumber(row.ObjetivoOrganizacion),
    ),
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


function buildFilteredEmptyState() {
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



function renderCapabilityTargets() {
  if (!els.capabilityTargetsPanel) {
    return;
  }

  const capabilities = unique(
    state.items.map((item) => item.capacidad),
  );

  if (!capabilities.length) {
    els.capabilityTargetsPanel.innerHTML = "";
    els.capabilityTargetsPanel.hidden = true;
    return;
  }

  els.capabilityTargetsPanel.hidden = false;

  const rows = capabilities
    .map((capability) => {
      const targets = getCapabilityTargets(capability);

      return `
        <div class="capability-target-row">
          <div class="capability-target-name">
            <strong>${escapeHtml(capability)}</strong>

            <span>
              Objetivo utilizado para calcular los gaps de sus subcapacidades
            </span>
          </div>

          ${LEVERS.map((lever) =>
            capabilityTargetControl(
              capability,
              lever,
              targets[lever.key],
            ),
          ).join("")}
        </div>
      `;
    })
    .join("");

  const objetivoBase = normalizeTargetValue(
    state.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  // El panel es configuracion, no evaluacion: arranca plegado para no dejar
  // quince selectores por delante de la primera subcapacidad. Si ya estaba
  // desplegado, se respeta.
  const estabaDesplegado = Boolean(
    els.capabilityTargetsPanel.querySelector(".capability-targets-details")?.open,
  );

  els.capabilityTargetsPanel.innerHTML = `
    <details class="capability-targets-details" ${estabaDesplegado ? "open" : ""}>
      <summary class="capability-targets-header">
        <div>
          <p class="eyebrow">Ambición de madurez</p>

          <h3>Objetivos por capacidad y palanca</h3>

          <p class="small-note">
            ${escapeHtml(describirObjetivos() || "")}. Define el nivel objetivo de
            Procesos, Tecnología y Organización de cada capacidad.
          </p>
        </div>

        <span class="capability-targets-toggle" aria-hidden="true"></span>
      </summary>

      <div class="capability-targets-actions">
        <button
          class="secondary-button reset-targets-button"
          type="button"
          data-reset-capability-targets
        >
          Restaurar objetivos al nivel ${objetivoBase}
        </button>
      </div>

    <div class="capability-targets-table">
      <div class="capability-targets-columns" aria-hidden="true">
        <span>Capacidad</span>

        ${LEVERS.map(
          (lever) => `
            <span class="target-column target-column-${lever.key}">
              ${escapeHtml(lever.label)}
            </span>
          `,
        ).join("")}
      </div>

      <div class="capability-targets-rows">
        ${rows}
      </div>
    </div>
    </details>
  `;



  els.capabilityTargetsPanel
    .querySelectorAll(".capability-target-select")
    .forEach((select) => {
      select.addEventListener(
        "change",
        handleCapabilityTargetChange,
      );
    });

  els.capabilityTargetsPanel
    .querySelector("[data-reset-capability-targets]")
    ?.addEventListener(
      "click",
      resetCapabilityTargets,
    );
}

function capabilityTargetControl(
  capability,
  lever,
  currentValue,
) {
  const options = [1, 2, 3, 4, 5]
    .map(
      (value) => `
        <option
          value="${value}"
          ${currentValue === value ? "selected" : ""}
        >
          ${value}
        </option>
      `,
    )
    .join("");

  return `
    <label class="capability-target-field">
      <span class="capability-target-mobile-label">
        ${escapeHtml(lever.label)}
      </span>

      <select
        class="capability-target-select target-${lever.key}"
        data-capability="${escapeAttr(capability)}"
        data-lever="${escapeAttr(lever.key)}"
        aria-label="${escapeAttr(
          `Objetivo de ${lever.label} para ${capability}`,
        )}"
      >
        ${options}
      </select>
    </label>
  `;
}



function handleCapabilityTargetChange(event) {
  const select = event.currentTarget;
  const capability = select.dataset.capability;
  const leverKey = select.dataset.lever;

  if (!capability || !leverKey) {
    return;
  }

  const targetValue = normalizeTargetValue(
    select.value,
    DEFAULT_TARGET_MATURITY,
  );

  const activeDomain = state.domains[state.activeDomainId];

  if (!activeDomain) {
    return;
  }

  if (!activeDomain.targets) {
    activeDomain.targets = {};
  }

  if (!activeDomain.targets[capability]) {
    activeDomain.targets[capability] = {
      procesos: DEFAULT_TARGET_MATURITY,
      tecnologia: DEFAULT_TARGET_MATURITY,
      organizacion: DEFAULT_TARGET_MATURITY,
    };
  }

  activeDomain.targets[capability][leverKey] = targetValue;
  state.targets = activeDomain.targets;

  syncActiveDomainState();

  renderAll();
  persistTargetsDelDominioActivo();
}



async function resetCapabilityTargets() {
  const dominio = DOMAINS[state.activeDomainId]?.label || "este dominio";

  const confirmado = await abrirDialogo({
    eyebrow: "Ambición de madurez",
    titulo: `Restaurar los objetivos de ${dominio}`,
    parrafos: [
      `Todos los objetivos de Procesos, Tecnología y Organización de este dominio volverán al nivel ${normalizeTargetValue(state.meta?.targetMaturity, DEFAULT_TARGET_MATURITY)}.`,
      "Cambia los gaps, las prioridades y las oleadas de sus subcapacidades. Si el escenario es compartido, lo verá todo el equipo.",
    ],
    tono: "peligro",
    confirmar: "Restaurar objetivos",
  });

  if (!confirmado) {
    return;
  }

  const activeDomain = state.domains[state.activeDomainId];

  if (!activeDomain) {
    return;
  }

  // El nivel del dominio, no un 4 fijo: si algun dominio declarase otro
  // objetivo base, el boton prometia una cosa y hacia otra.
  const defaultTargets = createDefaultTargets(
    state.items,
    normalizeTargetValue(state.meta?.targetMaturity, DEFAULT_TARGET_MATURITY),
  );

  activeDomain.targets = defaultTargets;
  state.targets = activeDomain.targets;

  renderAll();
  persistTargetsDelDominioActivo();

  showNotice(
    `Los objetivos de ${dominio} han vuelto al nivel ${normalizeTargetValue(
      state.meta?.targetMaturity,
      DEFAULT_TARGET_MATURITY,
    )}.`,
    "exito",
  );
}


function renderAssessments() {
  const items = getVisibleItems();
  const foco = capturarFocoDeAssessment();

  if (!items.length) {
    els.assessmentList.innerHTML = buildFilteredEmptyState();
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


    const currentMaturityLevel = getMaturityLevelNumber(metrics.scoreMedio);

    fragment.querySelector(".maturity-list").innerHTML = Object.entries(item.maturity || {})
      .map(([level, text]) => {
        const isCurrentLevel = Number(level) === currentMaturityLevel;

        return `
          <li class="${isCurrentLevel ? "is-current-level" : ""}">
            <span>${escapeHtml(text)}</span>
            ${isCurrentLevel ? '<strong class="current-level-label">Nivel actual</strong>' : ""}
          </li>
        `;
      })
      .join("");

    fragment.querySelector(".question-list").innerHTML = getItemQuestions(item)
      .map((question) => `<li>${escapeHtml(question)}</li>`)
      .join("");

    fragment.querySelector(".evidence-text").textContent = getItemEvidenceText(item);


    const details = fragment.querySelector("details");
    const summaryText = fragment.querySelector(".detail-summary-text");

    if (details && summaryText) {
      details.open = tarjetasConDetalleAbierto.has(item.id);

      summaryText.textContent = details.open
        ? "Ocultar detalle de evaluación"
        : "Ver detalle de evaluación";

      details.addEventListener("toggle", () => {
        summaryText.textContent = details.open
          ? "Ocultar detalle de evaluación"
          : "Ver detalle de evaluación";

        if (details.open) {
          tarjetasConDetalleAbierto.add(item.id);
        } else {
          tarjetasConDetalleAbierto.delete(item.id);
        }
      });
    }


  els.assessmentList.appendChild(fragment);
  });

  els.assessmentList.querySelectorAll(".score-select").forEach((select) => {
    select.addEventListener("change", handleScoreChange);
  });

  restaurarFocoDeAssessment(foco);
}


/** Que selector de score tiene el foco, para devolverselo tras repintar. */
function capturarFocoDeAssessment() {
  const activo = document.activeElement;

  if (!activo || !els.assessmentList?.contains(activo)) {
    return null;
  }

  if (!activo.classList.contains("score-select")) {
    return null;
  }

  return { id: activo.dataset.id, palanca: activo.dataset.lever };
}


function restaurarFocoDeAssessment(foco) {
  if (!foco) {
    return;
  }

  els.assessmentList
    .querySelector(
      `.score-select[data-id="${CSS.escape(foco.id)}"][data-lever="${CSS.escape(foco.palanca)}"]`,
    )
    ?.focus();
}


function getScoreSelectClass(score) {
  return Number.isInteger(score)
    ? `score-value-${score}`
    : "score-value-empty";
}


function scoreControl(item, lever) {
  const current = item.scores[lever.key];
  const options = [`<option value="">Sin puntuar</option>`]
    .concat([1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${current === value ? "selected" : ""}>${value}</option>`))
    .join("");
  return `
    <label class="score-field">
      <span>${escapeHtml(lever.label)}</span>
      <select
        class="score-select ${getScoreSelectClass(current)}"
        data-id="${escapeAttr(item.id)}"
        data-lever="${lever.key}"
        aria-label="${escapeAttr(`${lever.label} de ${item.subcapacidad}`)}"
      >
        ${options}
      </select>
    </label>
  `;
}


function scoreResult(metrics) {
  if (metrics.isPending) {
    return `
      <div class="score-summary score-summary-pending">
        <div class="score-summary-header">
          ${priorityBadge("Pendiente")}
        </div>

        <div class="score-summary-main">
          <strong>-</strong>
          <span>Score medio</span>
        </div>

        <p class="score-summary-note">Pendiente de scoring</p>
      </div>
    `;
  }

  return `
    <div class="score-summary score-summary-${metrics.prioridad.toLowerCase()}">
      <div class="score-summary-header">
        ${priorityBadge(metrics.prioridad)}

        <span class="score-summary-wave">
          ${escapeHtml(metrics.oleada)}
        </span>
      </div>

      <div class="score-summary-main">
        <strong>${formatNumber(metrics.scoreMedio)}</strong>
        <span>Score medio</span>
      </div>

      <div class="score-summary-target">
        Objetivo medio:
        <strong>${formatNumber(metrics.targetMedio)}</strong>
      </div>

      <div class="score-summary-details">
        <span>
          <strong>${formatNumber(metrics.gap)}</strong>
          Gap
        </span>

        <span class="level-badge">
          ${escapeHtml(metrics.nivel)}
        </span>
      </div>
    </div>
  `;
}


function handleScoreChange(event) {
  const item = state.items.find(
    (entry) => entry.id === event.target.dataset.id,
  );

  if (!item) {
    return;
  }

  const leverKey = event.target.dataset.lever;
  const score = toScore(event.target.value);

  // Con un filtro de prioridad puesto, puntuar puede sacar la subcapacidad de
  // la lista. Solo en ese caso hay que reconstruirla.
  const visiblesAntes = getVisibleItems().map((entry) => entry.id).join("|");

  item.scores[leverKey] = score;

  syncActiveDomainState();

  const visiblesDespues = getVisibleItems().map((entry) => entry.id).join("|");
  const mismaLista = visiblesAntes === visiblesDespues;

  renderAll({ saltarAssessments: mismaLista });

  if (mismaLista) {
    actualizarTarjetaDeAssessment(item);
  }

  persistItemChange(item.id, `scores/${leverKey}`, score);
}


/**
 * Refresca una sola tarjeta en su sitio.
 *
 * Reconstruir la lista entera cerraba todos los detalles abiertos y mandaba el
 * foco al body: con teclado habia que volver a tabular desde el principio
 * despues de cada puntuacion.
 */
function actualizarTarjetaDeAssessment(item) {
  const card = els.assessmentList.querySelector(
    `.assessment-card[data-id="${CSS.escape(item.id)}"]`,
  );

  if (!card) {
    return;
  }

  const metrics = calculate(item);

  card.querySelector(".score-result").innerHTML = scoreResult(metrics);

  // El color del borde de cada selector depende de su valor.
  card.querySelectorAll(".score-select").forEach((select) => {
    select.className = `score-select ${getScoreSelectClass(
      item.scores[select.dataset.lever],
    )}`;
  });

  // Y el nivel de madurez resaltado cambia con el score medio.
  const nivelActual = getMaturityLevelNumber(metrics.scoreMedio);

  card.querySelectorAll(".maturity-list li").forEach((li, indice) => {
    const esActual = indice + 1 === nivelActual;

    li.classList.toggle("is-current-level", esActual);

    const etiqueta = li.querySelector(".current-level-label");

    if (esActual && !etiqueta) {
      const nueva = document.createElement("strong");
      nueva.className = "current-level-label";
      nueva.textContent = "Nivel actual";
      li.appendChild(nueva);
    } else if (!esActual && etiqueta) {
      etiqueta.remove();
    }
  });
}


function renderHeatmap() {
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
    <thead>
      <tr>
        <th>Capacidad</th>
        <th>Subcapacidades</th>
        <th class="number">Procesos</th>
        <th class="number">Tecnología</th>
        <th class="number">Organización</th>
        <th class="number">Score medio</th>
        <th class="number">Gap vs objetivo</th>
        <th>Prioridad</th>
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


function handleHeatmapExpandToggleAll() {
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


function getWaveShortLabel(wave) {
  const match = String(wave || "").match(/\d+/);

  return match ? match[0] : "-";
}


function renderRoadmap() {
  // Repintar la tabla borra los campos editables. Si alguien esta escribiendo
  // un comentario en ese momento, su texto desaparece sin aviso: los campos
  // solo guardaban al perder el foco. Se anota lo que hay en curso para
  // devolverlo después.
  const edicionEnCurso = capturarEdicionDeRoadmap();

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
          ${
            // Sin datos, el boton abria un aviso y nada mas: mejor no ofrecerlo.
            getAiDataForItem(item)
              ? `
                <button
                  class="roadmap-ai-button"
                  type="button"
                  data-id="${escapeAttr(item.id)}"
                  aria-label="${escapeAttr(`Ver la iniciativa de IA de ${item.subcapacidad}`)}"
                >
                  IA
                </button>
              `
              : `<span class="small-note">-</span>`
          }
        </td>

        <td class="roadmap-wave-cell">
          <span
            class="status-chip roadmap-wave"
            title="${escapeAttr(metrics.oleada)}"
            aria-label="${escapeAttr(metrics.oleada)}"
          >
            ${escapeHtml(getWaveShortLabel(metrics.oleada))}
          </span>
        </td>

        <td>
          <input
            class="inline-input roadmap-owner"
            data-id="${escapeAttr(item.id)}"
            value="${escapeAttr(item.owner)}"
            maxlength="${LIMITES_DE_TEXTO.owner}"
            placeholder="Responsable"
            aria-label="${escapeAttr(`Responsable de ${item.subcapacidad}`)}"
          >
        </td>
        <td>${statusSelect(item)}</td>
        <td>
          <textarea
            class="roadmap-comment"
            data-id="${escapeAttr(item.id)}"
            maxlength="${LIMITES_DE_TEXTO.comentario}"
            placeholder="Comentarios"
            aria-label="${escapeAttr(`Comentarios de ${item.subcapacidad}`)}"
          >${escapeHtml(item.comentario)}</textarea>
          ${contadorDeComentario(item)}
        </td>
        <td class="roadmap-authorship">${celdaDeAutoria(item)}</td>
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
        <th>Responsable</th>
        <th>Estado</th>
        <th>Comentarios</th>
        <th>Último cambio</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `
        <tr>
          <td colspan="11" class="table-empty-cell">
            ${buildFilteredEmptyState()}
          </td>
        </tr>
      `}
    </tbody>
  `;

  els.roadmapTable.querySelectorAll(".roadmap-owner").forEach((input) => {
  input.addEventListener("change", handleRoadmapFieldChange);
  input.addEventListener("input", handleRoadmapFieldInput);
});

els.roadmapTable.querySelectorAll(".roadmap-status").forEach((select) => {
  select.addEventListener("change", handleRoadmapFieldChange);
});

els.roadmapTable.querySelectorAll(".roadmap-comment").forEach((textarea) => {
  textarea.addEventListener("change", handleRoadmapFieldChange);
  textarea.addEventListener("input", actualizarContadorDeComentario);
  textarea.addEventListener("input", handleRoadmapFieldInput);
});

  restaurarEdicionDeRoadmap(edicionEnCurso);
}


/** A que campo de la subcapacidad corresponde un control del Roadmap. */
function campoDeRoadmap(elemento) {
  if (elemento.classList.contains("roadmap-owner")) return "owner";
  if (elemento.classList.contains("roadmap-status")) return "status";
  if (elemento.classList.contains("roadmap-comment")) return "comentario";

  return null;
}


const CLASE_POR_CAMPO = {
  owner: "roadmap-owner",
  status: "roadmap-status",
  comentario: "roadmap-comment",
};


/** Que se esta editando ahora mismo en el Roadmap, si es que hay algo. */
function capturarEdicionDeRoadmap() {
  const activo = document.activeElement;

  if (!activo || !els.roadmapTable?.contains(activo)) {
    return null;
  }

  const campo = campoDeRoadmap(activo);

  if (!campo || !activo.dataset.id) {
    return null;
  }

  return {
    id: activo.dataset.id,
    campo,
    valor: activo.value,
    // Los <select> no tienen cursor de texto.
    inicio: activo.selectionStart ?? null,
    fin: activo.selectionEnd ?? null,
  };
}


/**
 * Devuelve el foco, el texto y la posición del cursor tras repintar.
 *
 * Se restaura el valor que había en pantalla y no el del estado: si el repintado
 * viene de un cambio remoto, lo que estaba escribiendo esta persona no puede
 * perderse por el camino. El guardado diferido lo envía poco después.
 */
function restaurarEdicionDeRoadmap(edicion) {
  if (!edicion) {
    return;
  }

  const destino = els.roadmapTable.querySelector(
    `.${CLASE_POR_CAMPO[edicion.campo]}[data-id="${CSS.escape(edicion.id)}"]`,
  );

  if (!destino) {
    return;
  }

  destino.value = edicion.valor;
  destino.focus();

  if (edicion.inicio !== null && typeof destino.setSelectionRange === "function") {
    try {
      destino.setSelectionRange(edicion.inicio, edicion.fin);
    } catch (error) {
      // Algunos tipos de campo no admiten seleccion; no es motivo de fallo.
    }
  }
}


/** Quién tocó por última vez esta subcapacidad, si consta. */
function celdaDeAutoria(item) {
  const autoria = item.lastEditedBy;

  if (!autoria || !autoria.nombre) {
    return `<span class="small-note">-</span>`;
  }

  const cuando = Date.parse(autoria.at || "");

  const fecha = Number.isFinite(cuando)
    ? new Date(cuando).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const esMio = usuarioActual && autoria.uid === usuarioActual.uid;

  return `
    <span
      class="authorship-chip${esMio ? " authorship-mine" : ""}"
      title="${escapeAttr(fecha ? `${autoria.nombre} · ${fecha}` : autoria.nombre)}"
    >
      ${escapeHtml(esMio ? "Tú" : autoria.nombre)}
    </span>
    ${fecha ? `<span class="small-note authorship-date">${escapeHtml(fecha)}</span>` : ""}
  `;
}


/**
 * Cuánto queda de comentario, visible solo al acercarse al límite.
 *
 * Sin esto, pasarse de los 2.000 caracteres que admiten las reglas hacía que
 * Firebase rechazara la escritura sin que se notara.
 */
function contadorDeComentario(item) {
  const usados = (item.comentario || "").length;
  const limite = LIMITES_DE_TEXTO.comentario;

  if (usados < limite * 0.9) {
    return "";
  }

  return `
    <span class="roadmap-comment-count" aria-hidden="true">
      ${usados} / ${limite}
    </span>
  `;
}


function statusSelect(item) {
  return `
    <select
      class="inline-input roadmap-status"
      data-id="${escapeAttr(item.id)}"
      aria-label="${escapeAttr(`Estado de ${item.subcapacidad}`)}"
    >
      ${STATUS_OPTIONS.map((status) => `<option value="${escapeAttr(status)}" ${item.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
    </select>
  `;
}

/** Mantiene visible cuánto queda de comentario mientras se escribe. */
function actualizarContadorDeComentario(event) {
  const textarea = event.currentTarget;
  const celda = textarea.closest("td");

  if (!celda) {
    return;
  }

  const limite = LIMITES_DE_TEXTO.comentario;
  const usados = textarea.value.length;
  let contador = celda.querySelector(".roadmap-comment-count");

  if (usados < limite * 0.9) {
    contador?.remove();
    return;
  }

  if (!contador) {
    contador = document.createElement("span");
    contador.className = "roadmap-comment-count";
    contador.setAttribute("aria-hidden", "true");
    celda.appendChild(contador);
  }

  contador.textContent = `${usados} / ${limite}`;
  contador.classList.toggle("is-at-limit", usados >= limite);
}


// Cuanto se espera desde la ultima pulsacion antes de guardar. Con "change" a
// secas, un texto sin terminar de escribir no llegaba a guardarse nunca.
const GUARDADO_DIFERIDO_MS = 600;

const guardadosPendientes = new Map();


function handleRoadmapFieldChange(event) {
  const elemento = event.target;
  const item = state.items.find((entry) => entry.id === elemento.dataset.id);
  const campo = campoDeRoadmap(elemento);

  if (!item || !campo) {
    return;
  }

  cancelarGuardadoDiferido(item.id, campo);

  // maxlength solo frena lo que teclea el usuario. Un valor que llegue de un
  // escenario importado puede superar el límite y hacer que Firebase rechace la
  // escritura entera, así que se recorta también aquí.
  const valor = recortarAlLimite(campo, elemento.value);

  if (valor !== elemento.value) {
    elemento.value = valor;
  }

  guardarCampoDeRoadmap(item, campo, valor);
}


/** Mientras se escribe: se guarda solo, sin esperar a perder el foco. */
function handleRoadmapFieldInput(event) {
  const elemento = event.target;
  const item = state.items.find((entry) => entry.id === elemento.dataset.id);
  const campo = campoDeRoadmap(elemento);

  if (!item || !campo) {
    return;
  }

  const clave = `${item.id}:${campo}`;

  window.clearTimeout(guardadosPendientes.get(clave));

  guardadosPendientes.set(
    clave,
    window.setTimeout(() => {
      guardadosPendientes.delete(clave);
      guardarCampoDeRoadmap(item, campo, recortarAlLimite(campo, elemento.value));
    }, GUARDADO_DIFERIDO_MS),
  );
}


function cancelarGuardadoDiferido(itemId, campo) {
  const clave = `${itemId}:${campo}`;

  window.clearTimeout(guardadosPendientes.get(clave));
  guardadosPendientes.delete(clave);
}


/** Guarda un campo del Roadmap, si de verdad ha cambiado. */
function guardarCampoDeRoadmap(item, campo, valor) {
  // Sin esta comprobacion, salir de un campo que no se ha tocado provocaba una
  // escritura completa en localStorage y otra en Firebase.
  if (item[campo] === valor) {
    return;
  }

  item[campo] = valor;

  persistItemChange(item.id, campo, valor);
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

/**
 * El almacenamiento del navegador puede fallar y no es motivo para caerse.
 *
 * Lanza excepcion si la cuota esta llena, si el navegador tiene bloqueado el
 * almacenamiento por politica o en algunas ventanas privadas. Antes la
 * escritura iba sin proteger y por delante de la de Firebase: al superar la
 * cuota, el cambio no llegaba a ninguno de los dos sitios.
 */
let avisoDeAlmacenamientoMostrado = false;

function leerAlmacenamiento(clave) {
  try {
    return window.localStorage.getItem(clave);
  } catch (error) {
    console.warn("No se pudo leer del almacenamiento del navegador.", error);
    return null;
  }
}


function escribirAlmacenamiento(clave, valor) {
  try {
    window.localStorage.setItem(clave, valor);
    return true;
  } catch (error) {
    console.warn("No se pudo escribir en el almacenamiento del navegador.", error);

    if (!avisoDeAlmacenamientoMostrado) {
      avisoDeAlmacenamientoMostrado = true;

      showNotice(
        "Este navegador no está guardando la copia local del escenario, probablemente por falta de " +
          "espacio o por su configuración de privacidad. " +
          (scenarioDatabaseRef
            ? "Los cambios siguen enviándose al escenario compartido."
            : "Exporta el escenario en JSON si no quieres perder el trabajo al cerrar."),
        "aviso",
      );
    }

    return false;
  }
}


function borrarDeAlmacenamiento(clave) {
  try {
    window.localStorage.removeItem(clave);
    return true;
  } catch (error) {
    console.warn("No se pudo borrar del almacenamiento del navegador.", error);
    return false;
  }
}


function getStoredScenario() {
  const stored = leerAlmacenamiento(STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn(
      "No se pudo leer el escenario guardado localmente.",
      error,
    );

    return null;
  }
}

// getScenarioTimestamp / isScenarioNewer se han retirado: comparar marcas de tiempo
// para decidir qué versión gana dejó de tener sentido al escribir por rutas
// concretas. Además los relojes de cada equipo no son fiables, así que la
// comparación descartaba cambios ajenos de forma arbitraria.

function readScenarioFromFirebase(timeoutMs = 8000) {
  const firebaseRead = get(scenarioDatabaseRef);

  const timeout = new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(
        new Error(
          "Tiempo de espera agotado al leer Firebase",
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([
    firebaseRead,
    timeout,
  ]);
}



async function initializeSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  const localScenario = getStoredScenario();

  try {
    const snapshot = await readScenarioFromFirebase();

    const remoteScenario = snapshot.exists()
      ? snapshot.val()
      : null;

    if (!remoteScenario) {
      const initialPayload =
        localScenario || buildScenarioPayload();

      escribirAlmacenamiento(
        STORAGE_KEY,
        JSON.stringify(initialPayload),
      );

      try {
        await saveScenarioToFirebase(
          initialPayload,
        );

        updateSaveStatus(
          "saved",
          "Guardado ✓",
        );
      } catch (error) {
        console.warn(
          "El escenario se ha guardado localmente, pero no se ha podido crear en Firebase.",
          error,
        );

        marcarFalloDeSincronia(
          "No se ha creado el escenario compartido",
          "Tus datos están guardados en este navegador, pero el escenario compartido no ha llegado a crearse: " +
            "quien abra el enlace no verá nada. Comprueba la conexión y vuelve a intentarlo.",
        );
      }

      subscribeToSharedScenario();
      return;
    }

    // En un escenario compartido la fuente de verdad es Firebase. Antes, si la
    // copia local parecía más reciente, se subía entera y eso borraba los cambios
    // que otras personas hubieran hecho mientras tanto. Ahora se aplica siempre lo
    // remoto: cada edición propia ya sube al instante por su ruta concreta.
    isApplyingRemoteScenario = true;

    try {
      applyScenarioPayload(remoteScenario);

      escribirAlmacenamiento(
        STORAGE_KEY,
        JSON.stringify(remoteScenario),
      );

      populateCapacityFilter();
      renderAll();
    } finally {
      isApplyingRemoteScenario = false;
    }

    updateSaveStatus(
      "saved",
      "Sincronizado ✓",
    );

    subscribeToSharedScenario();
  } catch (error) {
    isApplyingRemoteScenario = false;
    pendingScenarioWrites = 0;

    console.warn(
      "Firebase no está disponible. Se conserva la copia local.",
      error,
    );

    marcarFalloDeSincronia(
      "Sin conexión con el escenario compartido",
      "No se ha podido conectar con el escenario compartido. Estás trabajando sobre la copia de este navegador " +
        "y tus cambios no le llegan al resto del equipo. Si vas a trabajar así, exporta una copia antes de cerrar.",
    );

    showNotice(
      "No se ha podido conectar con el escenario compartido. Tus cambios se guardan en este navegador, "
        + "pero el resto del equipo no los ve.",
      "aviso",
    );
  }
}



function subscribeToSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  onValue(
    scenarioDatabaseRef,
    (snapshot) => {
      const remoteScenario = snapshot.val();

      if (!remoteScenario) {
        return;
      }

      // Mientras hay una escritura nuestra en vuelo, el snapshot puede ser
      // anterior a nuestro cambio y provocaría un parpadeo. Antes se descartaba
      // y se perdía para siempre; ahora se aparca y se aplica al terminar.
      if (pendingScenarioWrites > 0) {
        snapshotRemotoPendiente = remoteScenario;
        return;
      }

      aplicarEscenarioRemoto(remoteScenario);
    },
    (error) => {
      console.warn(
        "Se perdió la conexión con Firebase.",
        error,
      );

      marcarFalloDeSincronia(
        "Se ha perdido la conexión",
        "Se ha perdido la conexión con el escenario compartido. Tus cambios se siguen guardando en este navegador, " +
          "pero no le llegan al resto del equipo. Recarga la página cuando vuelvas a tener conexión.",
      );
    },
  );
}


/**
 * Aplica un snapshot que llegó mientras guardábamos.
 *
 * Antes se comparaban marcas de tiempo para decidir si valía la pena aplicarlo,
 * pero como cada edición local ponía `updatedAt` a "ahora", los cambios de otras
 * personas quedaban sistemáticamente descartados. En un escenario compartido la
 * fuente de verdad es Firebase, así que se aplica siempre.
 */
function aplicarSnapshotPendiente() {
  if (pendingScenarioWrites > 0 || !snapshotRemotoPendiente) {
    return;
  }

  const pendiente = snapshotRemotoPendiente;
  snapshotRemotoPendiente = null;

  aplicarEscenarioRemoto(pendiente);
}


function aplicarEscenarioRemoto(remoteScenario) {
  try {
    isApplyingRemoteScenario = true;

    applyScenarioPayload(remoteScenario);

    escribirAlmacenamiento(
      STORAGE_KEY,
      JSON.stringify(remoteScenario),
    );

    populateCapacityFilter();
    renderAll();

    updateSaveStatus("saved", "Sincronizado ✓");
  } catch (error) {
    console.error(
      "No se pudo aplicar el escenario remoto.",
      error,
    );

    showNotice(
      "Ha llegado un cambio del escenario compartido que no se ha podido aplicar. Recarga la página "
        + "para ponerte al día.",
      "error",
    );
  } finally {
    isApplyingRemoteScenario = false;
  }
}



function updateSaveStatus(status, message, detalle = "") {
  if (!els.saveStatus) {
    return;
  }

  els.saveStatus.hidden = false;
  els.saveStatus.className = `save-status ${status || ""}`.trim();
  els.saveStatus.textContent = message;

  // El detalle explica qué ha pasado, qué implica y qué puede hacer el usuario.
  // No cabe en el chip, así que va al tooltip.
  if (detalle) {
    els.saveStatus.title = detalle;
  } else {
    els.saveStatus.removeAttribute("title");
  }
}


/**
 * Un guardado que falla no puede parecerse a uno que funciona.
 *
 * Antes todos los caminos de error terminaban en "Guardado local ✓" y en verde:
 * con la conexión caída o con las reglas rechazando un campo, el consultor creía
 * que el escenario estaba sincronizado cuando no lo estaba.
 */
function marcarFalloDeSincronia(mensaje, detalle) {
  updateSaveStatus("error", mensaje, detalle);
}



function saveScenarioToFirebase(
  payload,
  timeoutMs = 8000,
) {
  if (!scenarioDatabaseRef) {
    return Promise.resolve();
  }

  const sanitizedPayload =
    sanitizeScenarioForFirebase(payload);

  let timeoutId;

  const firebaseSave = set(
    scenarioDatabaseRef,
    sanitizedPayload,
  );

  const timeout = new Promise(
    (_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(
          new Error(
            "Tiempo de espera agotado al guardar en Firebase",
          ),
        );
      }, timeoutMs);
    },
  );

  return Promise.race([
    firebaseSave,
    timeout,
  ]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}



/**
 * Guarda solo las rutas que han cambiado, en lugar del escenario completo.
 *
 * Escribir el payload entero hacía que dos personas editando dominios distintos
 * se borrasen el trabajo mutuamente: la última en guardar sobrescribía todo.
 * Con rutas concretas, dos cambios sobre campos distintos ya no colisionan.
 *
 * `rutas` usa claves relativas al escenario, por ejemplo:
 *   { "domains/fpa/items/fpa-1-2/scores/procesos": 3 }
 */
function persistGranularChange(rutas) {
  syncActiveDomainState();

  // La copia local sigue guardándose entera: es una caché, no la fuente de verdad.
  escribirAlmacenamiento(
    STORAGE_KEY,
    JSON.stringify(buildScenarioPayload()),
  );

  if (!scenarioDatabaseRef) {
    updateSaveStatus("saved", "Guardado local ✓");
    return;
  }

  if (isApplyingRemoteScenario) {
    return;
  }

  pendingScenarioWrites += 1;
  updateSaveStatus("saving", "Guardando...");

  const carga = {
    ...rutas,
    updatedAt: new Date().toISOString(),
  };

  update(scenarioDatabaseRef, carga)
    .then(() => {
      updateSaveStatus("saved", "Guardado ✓");
    })
    .catch((error) => {
      console.warn(
        "No se pudo guardar el cambio en Firebase. Se conserva la copia local.",
        error,
      );

      marcarFalloDeSincronia(
        "El último cambio no se ha compartido",
        "El cambio está guardado en este navegador, pero no se ha podido enviar al escenario compartido y el resto " +
          "del equipo no lo ve. Comprueba la conexión y vuelve a hacer el cambio.",
      );
    })
    .finally(() => {
      pendingScenarioWrites = Math.max(0, pendingScenarioWrites - 1);
      aplicarSnapshotPendiente();
    });
}


/** Ruta de un campo de subcapacidad dentro del escenario. */
function rutaDeItem(itemId, campo) {
  return `domains/${state.activeDomainId}/items/${itemId}/${campo}`;
}


/**
 * Cambio sobre una subcapacidad, acompañado de quién lo hizo.
 *
 * La autoría va en la misma escritura que el dato: si fueran dos escrituras
 * separadas, una podría fallar y dejar el cambio atribuido a quien no fue.
 */
function persistItemChange(itemId, campo, valor) {
  const rutas = {
    [rutaDeItem(itemId, campo)]: valor,
  };

  const autoria = marcaDeAutoria();

  if (autoria) {
    rutas[rutaDeItem(itemId, "lastEditedBy")] = autoria;
  }

  persistGranularChange(rutas);
}


/**
 * Objetivos del dominio activo, en el formato que se guarda en Firebase.
 *
 * Los objetivos se escriben por dominio y no por capacidad porque la clave sería
 * el nombre de la capacidad, que puede contener caracteres que Firebase no admite
 * en una ruta. Aun así el alcance es mucho menor que reescribir todo el escenario.
 */
function persistTargetsDelDominioActivo() {
  const activeDomain = state.domains[state.activeDomainId];

  if (!activeDomain) {
    return;
  }

  persistGranularChange({
    [`domains/${state.activeDomainId}/targets`]: serializeTargetsForFirebase(
      activeDomain.items,
      activeDomain.targets,
      normalizeTargetValue(
        activeDomain.meta?.targetMaturity,
        DEFAULT_TARGET_MATURITY,
      ),
    ),
  });
}


function persistScenario() {
  syncActiveDomainState();

  const payload = buildScenarioPayload();

  escribirAlmacenamiento(
    STORAGE_KEY,
    JSON.stringify(payload),
  );

  if (!scenarioDatabaseRef) {
    updateSaveStatus(
      "saved",
      "Guardado local ✓",
    );

    return;
  }

  if (isApplyingRemoteScenario) {
    return;
  }

  pendingScenarioWrites += 1;

  updateSaveStatus(
    "saving",
    "Guardando...",
  );

  saveScenarioToFirebase(
    payload,
    8000,
  )
    .then(() => {
      updateSaveStatus(
        "saved",
        "Guardado ✓",
      );
    })
    .catch((error) => {
      console.warn(
        "Firebase no respondió. Se conserva el guardado local.",
        error,
      );

      marcarFalloDeSincronia(
        "Los cambios no se han compartido",
        "Los cambios están guardados en este navegador, pero no se han podido enviar al escenario compartido. " +
          "Comprueba la conexión y vuelve a intentarlo.",
      );
    })
    .finally(() => {
      pendingScenarioWrites = Math.max(
        0,
        pendingScenarioWrites - 1,
      );
    });
}



function applyStoredScenario() {
  const stored = leerAlmacenamiento(STORAGE_KEY);

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





function getSavedField(savedItem, fieldNames) {
  for (const fieldName of fieldNames) {
    if (savedItem?.[fieldName] !== undefined && savedItem?.[fieldName] !== null) {
      return savedItem[fieldName];
    }
  }

  return undefined;
}

function getSavedScore(savedItem, leverKey) {
  const scoreFieldMap = {
    procesos: ["procesos", "Procesos", "Score Procesos", "ScoreProcesos"],
    tecnologia: ["tecnologia", "Tecnologia", "Tecnología", "Score Tecnología", "Score Tecnologia", "ScoreTecnologia"],
    organizacion: ["organizacion", "Organizacion", "Organización", "Score Organización", "Score Organizacion", "ScoreOrganizacion"],
  };

  if (savedItem?.scores?.[leverKey] !== undefined) {
    return savedItem.scores[leverKey];
  }

  return getSavedField(savedItem, scoreFieldMap[leverKey] || []);
}

function toSavedItemsArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object") {
    return Object.values(value);
  }

  return [];
}



function getScenarioTargetsFromPayload(payload, domainId) {
  if (!payload || !domainId) {
    return {};
  }

  if (payload.domains?.[domainId]?.targets) {
    return payload.domains[domainId].targets;
  }

  if (payload[domainId]?.targets) {
    return payload[domainId].targets;
  }

  if (
    domainId === "fpa" &&
    payload.targets &&
    !payload.domains
  ) {
    return payload.targets;
  }

  return {};
}



function getScenarioItemsFromPayload(payload, domainId) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload.domains?.[domainId]?.items) {
    return toSavedItemsArray(payload.domains[domainId].items);
  }

  if (payload.domains?.[domainId]?.subcapacities) {
    return toSavedItemsArray(payload.domains[domainId].subcapacities);
  }

  if (payload[domainId]?.items) {
    return toSavedItemsArray(payload[domainId].items);
  }

  if (payload.items) {
    return toSavedItemsArray(payload.items);
  }

  if (payload.subcapacities) {
    return toSavedItemsArray(payload.subcapacities);
  }

  if (payload.state?.items) {
    return toSavedItemsArray(payload.state.items);
  }

  return [];
}

function findMatchingScenarioItem(items, savedItem) {
  if (!savedItem) {
    return null;
  }

  const savedId = savedItem.id || savedItem.ID || savedItem.Id;
  const byId = items.find((item) => item.id === savedId);

  if (byId) {
    return byId;
  }

  const savedCapability = normalizeMatchKey(
    savedItem.capacidad || savedItem.Capacidad || savedItem.capacity || savedItem.Capability,
  );

  const savedSubcapability = normalizeMatchKey(
    savedItem.subcapacidad || savedItem.Subcapacidad || savedItem.subcapacity || savedItem.Subcapability,
  );

  return items.find((item) => (
    normalizeMatchKey(item.capacidad) === savedCapability &&
    normalizeMatchKey(item.subcapacidad) === savedSubcapability
  ));
}

function applyScenarioItemsToDomain(domainId, savedItems) {
  const domain = state.domains[domainId];

  if (!domain || !Array.isArray(savedItems)) {
    return {
      matched: 0,
      total: savedItems?.length || 0,
    };
  }

  let matched = 0;

  savedItems.forEach((savedItem) => {
    const item = findMatchingScenarioItem(domain.items, savedItem);

    if (!item) {
      return;
    }

    matched += 1;

    const procesos = getSavedScore(savedItem, "procesos");
    const tecnologia = getSavedScore(savedItem, "tecnologia");
    const organizacion = getSavedScore(savedItem, "organizacion");

    if (procesos !== undefined) {
      item.scores.procesos = toScore(procesos);
    }

    if (tecnologia !== undefined) {
      item.scores.tecnologia = toScore(tecnologia);
    }

    if (organizacion !== undefined) {
      item.scores.organizacion = toScore(organizacion);
    }

    const owner = getSavedField(savedItem, ["owner", "Owner"]);
    const status = getSavedField(savedItem, ["status", "Estado", "estado"]);
    const comentario = getSavedField(savedItem, ["comentario", "Comentarios", "Comentarios / hallazgos", "comments"]);

    if (owner !== undefined) {
      item.owner = recortarAlLimite("owner", owner);
    }

    if (status !== undefined) {
      // Las reglas admiten cualquier texto de 40 caracteres, pero la
      // herramienta solo sabe pintar cuatro estados: un valor de fuera dejaba
      // el select en blanco, y si era largo tumbaba la escritura entera.
      item.status = normalizarEstado(status);
    }

    if (comentario !== undefined) {
      item.comentario = recortarAlLimite("comentario", comentario);
    }

    // Las reglas de autoria declaran "$otroCampoAutoria": false: un campo
    // inventado dentro de lastEditedBy tumbaba tambien la escritura entera.
    const autoria = normalizarAutoria(savedItem.lastEditedBy);

    if (autoria) {
      item.lastEditedBy = autoria;
    }
  });

  return {
    matched,
    total: savedItems.length,
  };
}

/**
 * Vuelca un escenario guardado sobre los datos cargados.
 *
 * Devuelve cuántas subcapacidades ha reconocido: sin ese dato, una importación
 * que no casaba con nada terminaba igualmente en "Escenario importado
 * correctamente".
 */
function applyScenarioPayload(payload) {
  const resultado = { aplicadas: 0, total: 0, dominios: 0 };

  if (!payload) {
    return resultado;
  }

  if (payload.domains) {
    Object.keys(payload.domains).forEach((domainId) => {
      const domain = state.domains[domainId];

      if (!domain) {
        return;
      }

      const result = applyScenarioItemsToDomain(
        domainId,
        getScenarioItemsFromPayload(payload, domainId),
      );

      const defaultTarget = normalizeTargetValue(
        domain.meta?.targetMaturity,
        DEFAULT_TARGET_MATURITY,
      );

      domain.targets = normalizeDomainTargets(
        domain.items,
        getScenarioTargetsFromPayload(payload, domainId),
        defaultTarget,
      );

      resultado.aplicadas += result.matched;
      resultado.total += result.total;
      resultado.dominios += 1;

      console.log(
        `Escenario aplicado en ${domainId}: ${result.matched}/${result.total}`,
      );
    });

    if (payload.activeDomainId && state.domains[payload.activeDomainId]) {
      setActiveDomain(payload.activeDomainId);
    } else if (state.domains[state.activeDomainId]) {
      setActiveDomain(state.activeDomainId);
    }

    return resultado;
  }

  const legacyItems = getScenarioItemsFromPayload(payload, "fpa");
  const result = applyScenarioItemsToDomain("fpa", legacyItems);

  const fpaDomain = state.domains.fpa;

  if (fpaDomain) {
    const defaultTarget = normalizeTargetValue(
      fpaDomain.meta?.targetMaturity,
      DEFAULT_TARGET_MATURITY,
    );

    fpaDomain.targets = normalizeDomainTargets(
      fpaDomain.items,
      getScenarioTargetsFromPayload(payload, "fpa"),
      defaultTarget,
    );
  }

  resultado.aplicadas = result.matched;
  resultado.total = result.total;
  resultado.dominios = 1;

  console.log(
    `Escenario antiguo aplicado en FP&A: ${result.matched}/${result.total}`,
  );

  if (state.activeDomainId === "fpa") {
    setActiveDomain("fpa");
  }

  return resultado;
}




function buildScenarioPayload() {
  syncActiveDomainState();

  const domainsPayload = {};

  Object.entries(state.domains).forEach(([domainId, domain]) => {
    domainsPayload[domainId] = {
      meta: domain.meta,

      targets: serializeTargetsForFirebase(
        domain.items,
        domain.targets,
        normalizeTargetValue(
          domain.meta?.targetMaturity,
          DEFAULT_TARGET_MATURITY,
        ),
      ),

      // Indexamos por id y no por posición: las escrituras granulares apuntan a
      // rutas como items/fpa-1-2/scores/procesos, que deben seguir siendo válidas
      // aunque más adelante se añadan o reordenen subcapacidades.
      items: Object.fromEntries(
        domain.items.map((item) => [
          item.id,
          {
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

            // Se conserva para que una escritura completa (importar, restaurar)
            // no borre la autoría registrada por las escrituras granulares.
            ...(item.lastEditedBy ? { lastEditedBy: item.lastEditedBy } : {}),
          },
        ]),
      ),
    };
  });

  return {
    version: 3,
    activeDomainId: state.activeDomainId,
    updatedAt: new Date().toISOString(),
    domains: domainsPayload,
  };
}



/**
 * Importar es la acción más destructiva de la herramienta.
 *
 * En un escenario compartido escribe el payload completo, así que reemplaza los
 * nueve dominios para todo el mundo. Antes lo hacia sin preguntar y, si el
 * archivo no casaba con nada, informaba igualmente de que todo había ido bien.
 */
async function importScenario(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  if (scenarioDatabaseRef) {
    const confirmado = await abrirDialogo({
      eyebrow: "Acción irreversible",
      titulo: "Sustituir el escenario compartido",
      parrafos: [
        `Vas a reemplazar el contenido del escenario compartido con el del archivo ${file.name}.`,
        "Afecta a los nueve dominios y a todas las personas que trabajen con este enlace: sus puntuaciones, comentarios y estados quedarán reemplazados por los del archivo.",
        "No se puede deshacer. Si quieres conservar lo que hay ahora, expórtalo antes con el botón de abajo.",
      ],
      tono: "peligro",
      confirmar: "Sustituir el escenario",
      confirmacionEscrita: "SUSTITUIR",
      accionSecundaria: {
        texto: "Exportar JSON antes",
        alHacerClic: exportScenarioJson,
      },
    });

    if (!confirmado) {
      event.target.value = "";
      return;
    }
  }

  const reader = new FileReader();

  reader.onerror = () => {
    showNotice(
      "No se ha podido leer el archivo. Comprueba que sigue disponible y vuelve a intentarlo.",
      "error",
    );

    event.target.value = "";
  };

  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);

      // Se revisa ANTES de aplicar nada. Un archivo que no es un escenario ya
      // no llega a tocar los datos cargados, y lo que si se puede arreglar al
      // vuelo se cuenta en vez de corregirse en silencio.
      const revision = revisarEscenario(payload);

      if (!revision.valido) {
        showNotice(
          `No se ha importado nada. ${revision.motivo}`,
          "error",
        );

        return;
      }

      const resultado = applyScenarioPayload(payload);

      if (!resultado.aplicadas) {
        showNotice(
          "El archivo se ha leído, pero ninguna de sus subcapacidades coincide con las de esta " +
            "herramienta, así que no se ha cambiado nada. Comprueba que es un escenario exportado " +
            "desde F3M Assessment.",
          "aviso",
        );

        return;
      }

      escribirAlmacenamiento(STORAGE_KEY, JSON.stringify(buildScenarioPayload()));

      populateCapacityFilter();
      renderAll();
      persistScenario();

      const parciales =
        resultado.aplicadas < resultado.total
          ? ` ${resultado.total - resultado.aplicadas} del archivo no corresponden a ninguna subcapacidad y se han ignorado.`
          : "";

      const corregido = revision.problemas.length
        ? ` Se ha corregido lo siguiente al importar: ${revision.problemas.join("; ")}.`
        : "";

      showNotice(
        `Escenario importado: ${resultado.aplicadas} subcapacidades actualizadas en ` +
          `${resultado.dominios} ${resultado.dominios === 1 ? "dominio" : "dominios"}.${parciales}${corregido}`,
        revision.problemas.length ? "aviso" : "exito",
      );
    } catch (error) {
      showNotice(
        "El archivo no se ha podido leer como escenario. Tiene que ser un JSON exportado con " +
          "Exportar JSON desde esta misma herramienta.",
        "error",
      );

      console.error(error);
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}


function getActiveDomainConfig() {
  return DOMAINS[state.activeDomainId] || {
    id: state.activeDomainId || "domain",
    label: state.meta?.domainLabel || "Dominio",
    title: state.meta?.domainTitle || "Dominio",
  };
}

function toSafeFileName(value) {
  return String(value || "domain")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}


function exportScenarioJson() {
  downloadFile(
    "f3m_multidomain_assessment_scenario.json",
    JSON.stringify(buildScenarioPayload(), null, 2),
    "application/json",
  );
}


function exportCsv() {
  const summaryRows = buildSummaryRows();
  const roadmapRows = getScopedItems()
    .map((item) => {
      const metrics = calculate(item);
      return {
        Tipo: "Roadmap",
        Capacidad: item.capacidad,
        Subcapacidad: item.subcapacidad,
        Procesos: item.scores.procesos ?? "",
        ObjetivoProcesos:
          metrics.targets.procesos,

        Tecnologia: item.scores.tecnologia ?? "",
        ObjetivoTecnologia:
          metrics.targets.tecnologia,

        Organizacion: item.scores.organizacion ?? "",
        ObjetivoOrganizacion:
          metrics.targets.organizacion,

        ScoreMedio: metrics.scoreMedio ?? "",
        ObjetivoMedio: metrics.targetMedio ?? "",
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
    
  const activeDomain = getActiveDomainConfig();
  const domainFileName = toSafeFileName(activeDomain.id || activeDomain.label);

  downloadFile(
    `f3m_${domainFileName}_assessment_export.csv`,
    toCsv([...summaryRows, ...roadmapRows]),
    "text/csv;charset=utf-8",
  );
}


function exportPdfReport() {
  // La ventana se abre en el mismo gesto del clic: si se abriera despues, el
  // navegador la bloquearia por emergente.
  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    showNotice("El navegador ha bloqueado la ventana del informe. Permite las ventanas emergentes de esta página y vuelve a pulsar Exportar PDF.", "aviso");
    return;
  }

  const reportData = conElDashboardVisible(buildEnhancedPdfReportData);
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


/**
 * Ejecuta algo con el Dashboard a la vista y lo deja como estaba.
 *
 * El informe incorpora los radares capturados del canvas, y un canvas oculto no
 * tiene tamano: si se exporta desde el Roadmap sin haber pasado por el
 * Dashboard, las imagenes saldrian en blanco.
 */
function conElDashboardVisible(accion) {
  const seccion = document.getElementById("dashboard");
  const estabaOculto = seccion?.hidden;

  if (estabaOculto) {
    seccion.hidden = false;
  }

  renderDashboard();

  try {
    return accion();
  } finally {
    if (estabaOculto) {
      seccion.hidden = true;
    }
  }
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
  const activeDomain = getActiveDomainConfig();

  return {
    domainId: activeDomain.id,
    domainLabel: activeDomain.label,
    domainTitle: activeDomain.title,
    generatedAt: new Date().toLocaleString("es-ES"),
    // Nunca el identificador completo: este informe se envía al cliente.
    scenarioLabel: getScenarioShortLabel(),
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
  return agregarPorCapacidad(items).map((capacidad) => ({
    capacidad: capacidad.capacidad,
    procesos: capacidad.procesos,
    objetivoProcesos: capacidad.objetivos.procesos,
    tecnologia: capacidad.tecnologia,
    objetivoTecnologia: capacidad.objetivos.tecnologia,
    organizacion: capacidad.organizacion,
    objetivoOrganizacion: capacidad.objetivos.organizacion,
    scoreMedio: capacidad.scoreMedio,
    targetMedio: capacidad.targetMedio,
    gap: capacidad.gap,
    prioridad: capacidad.prioridad,
    avance: `${capacidad.evaluadas}/${capacidad.total}`,
  }));
}


function getPdfActiveFiltersLabel() {
  const filters = [];

  if (els.capacityFilter?.value && els.capacityFilter.value !== "all") {
    const capacityLabel =
      els.capacityFilter.options[els.capacityFilter.selectedIndex]?.textContent ||
      els.capacityFilter.value;

    filters.push(`Capacidad: ${capacityLabel}`);
  }

  if (els.priorityFilter?.value && els.priorityFilter.value !== "all") {
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


function buildSummaryRows() {
  return agregarPorCapacidad(getScopedItems()).map((capacidad) => ({
    Tipo: "Resumen",
    Capacidad: capacidad.capacidad,
    Subcapacidad: "",

    Procesos: capacidad.procesos ?? "",
    ObjetivoProcesos: capacidad.objetivos.procesos,

    Tecnologia: capacidad.tecnologia ?? "",
    ObjetivoTecnologia: capacidad.objetivos.tecnologia,

    Organizacion: capacidad.organizacion ?? "",
    ObjetivoOrganizacion: capacidad.objetivos.organizacion,

    ScoreMedio: capacidad.scoreMedio ?? "",
    ObjetivoMedio: capacidad.targetMedio ?? "",

    Nivel:
      capacidad.scoreMedio === null
        ? ""
        : getMaturityLevel(capacidad.scoreMedio),

    Gap: capacidad.gap ?? "",
    Prioridad: capacidad.prioridad,
    Oleada: "",
    IniciativaSugerida: "",
    Owner: "",
    Estado: "",
    Comentarios: "",
  }));
}



// Excel con configuración regional española espera punto y coma, no coma: con
// comas volcaba todas las columnas en una sola celda. csvEscape ya entrecomilla
// los campos que contienen ";", así que el separador es seguro.
const CSV_SEPARATOR = ";";

// Marca de orden de bytes. Sin ella Excel abre el archivo como ANSI y
// "Tecnología" llega ilegible.
const CSV_BOM = "\uFEFF";

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(CSV_SEPARATOR)];

  rows.forEach((row) => {
    csvRows.push(
      headers.map((header) => csvEscape(row[header])).join(CSV_SEPARATOR),
    );
  });

  // Fin de línea CRLF: es lo que espera Excel.
  return CSV_BOM + csvRows.join("\r\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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


/**
 * "Restaurar base" borra la copia de este navegador.
 *
 * En modo local eso es toda la evaluacion, de los nueve dominios, sin copia en
 * ningun otro sitio y sin forma de recuperarla. Era un solo clic sobre un
 * confirm del navegador con "Aceptar" a un tabulador de distancia, asi que
 * ahora hay que escribir la palabra y se ofrece exportar antes, ahi mismo.
 *
 * En un escenario compartido el efecto es otro: los datos vuelven a bajar de
 * Firebase enseguida, asi que en la practica no cambia nada.
 */
async function resetScenario() {
  if (scenarioId) {
    const seguir = await abrirDialogo({
      eyebrow: "Escenario compartido",
      titulo: "Restaurar la copia de este navegador",
      parrafos: [
        "Estás trabajando en un escenario compartido, así que esto no borra el escenario: solo la copia local, que se volverá a descargar al recargar la pagina.",
        "En la práctica no cambiará nada. Para volver de verdad a los datos base, abre la herramienta sin el parámetro ?scenario= en la dirección.",
      ],
      confirmar: "Restaurar de todos modos",
    });

    if (!seguir) {
      return;
    }

    borrarDeAlmacenamiento(STORAGE_KEY);
    window.location.reload();
    return;
  }

  const confirmado = await abrirDialogo({
    eyebrow: "Acción irreversible",
    titulo: "Borrar toda la evaluación de este navegador",
    parrafos: [
      "Se borrarán todas las puntuaciones, comentarios, responsables y estados de los nueve dominios.",
      "Estos datos solo existen en este navegador: no hay copia en ningún otro sitio y no se pueden recuperar.",
      "Si quieres conservarlos, expórtalos antes con el botón de abajo.",
    ],
    tono: "peligro",
    confirmar: "Borrar la evaluación",
    confirmacionEscrita: "BORRAR",
    accionSecundaria: {
      texto: "Exportar JSON antes",
      alHacerClic: exportScenarioJson,
    },
  });

  if (!confirmado) {
    return;
  }

  borrarDeAlmacenamiento(STORAGE_KEY);
  window.location.reload();
}


/**
 * Dialogo propio, en sustitucion de window.confirm y window.prompt.
 *
 * Los dialogos nativos ensenan el origen de la pagina ("127.0.0.1:8777 dice:"),
 * no se pueden disenar y desentonan delante de un cliente. Ademas no permiten
 * exigir una confirmacion proporcional al riesgo ni ofrecer una accion
 * alternativa como "exportar antes de borrar".
 *
 * Devuelve false si se cancela; true si se confirma; y el texto del campo
 * cuando se ha pedido uno.
 */
let cerrarDialogoActual = null;

function abrirDialogo({
  eyebrow = "",
  titulo,
  parrafos = [],
  tono = "neutro",
  confirmar = "Continuar",
  cancelar = "Cancelar",
  campo = null,
  confirmacionEscrita = null,
  accionSecundaria = null,
}) {
  return new Promise((resolve) => {
    const disparador = document.activeElement;

    els.dialogEyebrow.textContent = eyebrow;
    els.dialogEyebrow.hidden = !eyebrow;
    els.dialogTitle.textContent = titulo;
    els.dialogIcon.textContent = tono === "peligro" ? "!" : "?";

    els.dialogMessage.innerHTML = parrafos
      .map((texto) => `<p>${escapeHtml(texto)}</p>`)
      .join("");

    els.dialogModal.className = `modal-backdrop dialog-${tono}`;
    els.dialogConfirm.textContent = confirmar;
    els.dialogCancel.textContent = cancelar;

    // Campo de texto: sirve tanto para pedir un dato como para exigir que se
    // escriba una palabra antes de dejar confirmar.
    const pideTexto = Boolean(campo) || Boolean(confirmacionEscrita);

    els.dialogFieldWrap.hidden = !pideTexto;
    els.dialogField.value = campo?.valor || "";
    els.dialogField.maxLength = campo?.maxLength || 120;
    els.dialogField.placeholder = campo?.placeholder || "";
    els.dialogFieldLabel.textContent =
      campo?.etiqueta ||
      (confirmacionEscrita ? `Escribe ${confirmacionEscrita} para confirmar` : "");

    els.dialogSecondary.hidden = !accionSecundaria;
    els.dialogSecondary.textContent = accionSecundaria?.texto || "";

    const validar = () => {
      if (!confirmacionEscrita) {
        return;
      }

      els.dialogConfirm.disabled =
        els.dialogField.value.trim().toUpperCase() !==
        confirmacionEscrita.toUpperCase();
    };

    els.dialogConfirm.disabled = Boolean(confirmacionEscrita);
    validar();

    const alConfirmar = () => terminar(campo ? els.dialogField.value : true);
    const alCancelar = () => terminar(false);

    const alPulsarTecla = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        alCancelar();
        return;
      }

      if (event.key === "Enter" && pideTexto && !els.dialogConfirm.disabled) {
        event.preventDefault();
        alConfirmar();
        return;
      }

      if (event.key === "Tab") {
        atraparFoco(event, els.dialogModal);
      }
    };

    const alPulsarFondo = (event) => {
      // Un clic fuera no puede cancelar algo destructivo por accidente.
      if (event.target === els.dialogModal && tono !== "peligro") {
        alCancelar();
      }
    };

    const alPulsarSecundaria = () => accionSecundaria?.alHacerClic();

    function terminar(resultado) {
      els.dialogModal.hidden = true;
      els.dialogConfirm.removeEventListener("click", alConfirmar);
      els.dialogCancel.removeEventListener("click", alCancelar);
      els.dialogSecondary.removeEventListener("click", alPulsarSecundaria);
      els.dialogField.removeEventListener("input", validar);
      els.dialogModal.removeEventListener("click", alPulsarFondo);
      document.removeEventListener("keydown", alPulsarTecla, true);

      cerrarDialogoActual = null;
      updateModalOpenState();

      if (disparador?.isConnected) {
        disparador.focus();
      }

      resolve(resultado);
    }

    cerrarDialogoActual = alCancelar;

    els.dialogConfirm.addEventListener("click", alConfirmar);
    els.dialogCancel.addEventListener("click", alCancelar);
    els.dialogSecondary.addEventListener("click", alPulsarSecundaria);
    els.dialogField.addEventListener("input", validar);
    els.dialogModal.addEventListener("click", alPulsarFondo);
    document.addEventListener("keydown", alPulsarTecla, true);

    els.dialogModal.hidden = false;
    updateModalOpenState();

    // El foco entra en el dialogo: al campo si lo hay, y si no a Cancelar, que
    // es la opcion segura.
    if (pideTexto) {
      els.dialogField.focus();
      els.dialogField.select();
    } else {
      els.dialogCancel.focus();
    }
  });
}


/** Mantiene el tabulador dentro del modal mientras esta abierto. */
function atraparFoco(event, contenedor) {
  const focusables = [...contenedor.querySelectorAll(
    'button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.offsetParent !== null);

  if (!focusables.length) {
    return;
  }

  const primero = focusables[0];
  const ultimo = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === primero) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault();
    primero.focus();
  }
}


const ICONO_POR_TIPO = {
  exito: "✓",
  info: "i",
  aviso: "!",
  error: "!",
};

let temporizadorDeAviso = null;


/**
 * Muestra un aviso donde se pueda leer y con el tono que le corresponde.
 *
 * Antes el aviso vivia dentro de <main>, a la altura 0 de una pagina de casi
 * 10.000 px: cualquier mensaje lanzado desde el Roadmap era invisible. Y usaba
 * el mismo amarillo de advertencia tanto para "Escenario importado" como para
 * "No se pudo aplicar el escenario remoto".
 */
function showNotice(message, tipo = "info", persistente = null) {
  if (!els.loadNotice) {
    return;
  }

  // Los errores y las advertencias no se van solos: quien esta en una sesion
  // con cliente no puede perderselos por mirar a otro lado siete segundos.
  const seQueda =
    persistente === null ? tipo === "error" || tipo === "aviso" : persistente;

  els.loadNoticeText.textContent = message;
  els.loadNoticeIcon.textContent = ICONO_POR_TIPO[tipo] || ICONO_POR_TIPO.info;
  els.loadNotice.className = `notice notice-${tipo}`;
  els.loadNotice.hidden = false;

  window.clearTimeout(temporizadorDeAviso);

  if (seQueda) {
    return;
  }

  temporizadorDeAviso = window.setTimeout(() => {
    els.loadNotice.hidden = true;
  }, 7000);
}


function ocultarAviso() {
  window.clearTimeout(temporizadorDeAviso);
  els.loadNotice.hidden = true;
}



function getScenarioIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawScenarioId = params.get("scenario");

  if (!rawScenarioId) {
    return null;
  }

  const cleanScenarioId = rawScenarioId.trim();

  // Permitimos letras, números, guiones y guiones bajos para evitar rutas raras en Firebase.
  // El mínimo es 20 caracteres: el enlace es la única credencial del escenario, así que un id
  // corto o inventado a mano sería adivinable y expondría el assessment completo.
  const isValidScenarioId = /^[a-zA-Z0-9_-]{20,120}$/.test(cleanScenarioId);

  if (!isValidScenarioId) {
    console.warn(
      "Scenario ID inválido (mínimo 20 caracteres, solo letras, números, '-' y '_'). Se usará modo local:",
      cleanScenarioId,
    );
    return null;
  }

  return cleanScenarioId;
}


// Genera un identificador aleatorio de 128 bits. No usamos Math.random porque es predecible
// y aquí el identificador es lo único que protege el escenario.
function createScenarioId() {
  const uuid = crypto.randomUUID();
  return `f3m-${uuid}`;
}


async function createSharedScenario() {
  const nuevoId = createScenarioId();

  const confirmado = await abrirDialogo({
    eyebrow: "Escenario compartido",
    titulo: "Crear un escenario compartido",
    parrafos: [
      "Se creará un escenario nuevo con los datos que tienes ahora, y pasarás a trabajar sobre él.",
      "Cualquiera con el enlace podrá verlo y editarlo, sin contraseña. El enlace es la única credencial: trátalo como tal y no lo publiques en documentos ni tickets.",
    ],
    confirmar: "Crear escenario",
  });

  if (!confirmado) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("scenario", nuevoId);
  window.location.assign(url.toString());
}


/**
 * Se podia entrar en un escenario compartido con un boton, pero no salir.
 *
 * Habia que editar la direccion a mano y quitar el parametro. "Restaurar base"
 * no servia, y su propio mensaje lo explicaba en cinco lineas.
 */
async function salirDelEscenario() {
  const confirmado = await abrirDialogo({
    eyebrow: "Escenario compartido",
    titulo: "Salir del escenario compartido",
    parrafos: [
      "Volverás a trabajar sobre la copia de este navegador. El escenario compartido no se toca: sigue ahí y puedes volver con su enlace.",
      "Copia el enlace antes de salir si no lo tienes guardado en otro sitio.",
    ],
    confirmar: "Salir del escenario",
    accionSecundaria: {
      texto: "Copiar enlace antes",
      alHacerClic: copyScenarioLink,
    },
  });

  if (!confirmado) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("scenario");
  window.location.assign(url.toString());
}


function showScenarioModeNotice() {
  if (!scenarioId) {
    return;
  }

  // Los identificadores son aleatorios y largos, así que copiarlos a mano no es viable.
  if (els.copyScenarioLinkButton) {
    els.copyScenarioLinkButton.hidden = false;
  }

  if (els.leaveScenarioButton) {
    els.leaveScenarioButton.hidden = false;
  }

  actualizarEstadoDelMenu();

  if (els.createScenarioButton) {
    // Ya se esta en uno: crear otro desde aqui solo confunde.
    els.createScenarioButton.hidden = true;
  }

  // Antes se imprimía el identificador completo, que es la credencial del
  // escenario: quedaba a la vista en cualquier pantalla compartida.
  showNotice(
    "Escenario compartido activo. Los cambios se guardan solos y los ve cualquiera que abra este mismo enlace. " +
      "Usa el botón Copiar enlace para compartirlo.",
    "info",
  );

}


/**
 * Autentica de forma anónima para tener un identificador estable de quien edita.
 *
 * "Anónima" quiere decir sin pedir credenciales: Firebase asigna un uid propio a
 * cada navegador. Sirve para atribuir cambios y, más adelante, para exigir
 * `auth != null` en las reglas.
 *
 * Si falla (por ejemplo si Anonymous Auth no está habilitado en la consola) se
 * continúa sin identidad. Es preferible perder la atribución a que la
 * herramienta deje de funcionar por un ajuste que no está en este repositorio.
 */
async function inicializarIdentidad() {
  if (!scenarioDatabaseRef) {
    return;
  }

  try {
    const credencial = await signInAnonymously(firebaseAuth);

    usuarioActual = {
      uid: credencial.user.uid,
      nombre: getNombreEditor(),
    };
  } catch (error) {
    console.warn(
      "No se pudo autenticar de forma anónima. Se continúa sin identidad; " +
        "revisa que Anonymous Auth esté habilitado en la consola de Firebase.",
      error,
    );

    usuarioActual = null;
  }

  actualizarIndicadorDeIdentidad();
}


function getNombreEditor() {
  return (leerAlmacenamiento(NOMBRE_STORAGE_KEY) || "").trim();
}


function setNombreEditor(nombre) {
  const limpio = (nombre || "").trim().slice(0, 60);

  if (limpio) {
    escribirAlmacenamiento(NOMBRE_STORAGE_KEY, limpio);
  } else {
    borrarDeAlmacenamiento(NOMBRE_STORAGE_KEY);
  }

  if (usuarioActual) {
    usuarioActual.nombre = limpio;
  }

  actualizarIndicadorDeIdentidad();
}


async function pedirNombreEditor() {
  const nombre = await abrirDialogo({
    eyebrow: "Atribución de cambios",
    titulo: "Tu nombre en este escenario",
    parrafos: [
      "Así aparecerás en la columna Último cambio del Roadmap cuando edites algo. Solo se guarda en este navegador.",
    ],
    campo: {
      etiqueta: "Nombre",
      valor: getNombreEditor(),
      placeholder: "Nombre y apellido",
      maxLength: 60,
    },
    confirmar: "Guardar nombre",
  });

  if (nombre === false) {
    return; // Cancelado: no tocamos nada
  }

  setNombreEditor(nombre);
  renderAll();
}


function actualizarIndicadorDeIdentidad() {
  const boton = els.editorNameButton;

  if (!boton) {
    return;
  }

  // Solo tiene sentido en un escenario compartido: en modo local no hay a quién atribuir.
  boton.hidden = !scenarioDatabaseRef;

  const nombre = getNombreEditor();

  boton.textContent = nombre
    ? `Editas como: ${nombre}`
    : "Poner mi nombre";

  boton.classList.toggle("sin-nombre", !nombre);
}


/** Datos de atribución que acompañan a cada cambio, si hay identidad disponible. */
function marcaDeAutoria() {
  if (!usuarioActual) {
    return null;
  }

  return {
    uid: usuarioActual.uid,
    nombre: usuarioActual.nombre || "Sin nombre",
    at: new Date().toISOString(),
  };
}


/**
 * Forma abreviada del identificador, para enseñarla sin comprometerlo.
 *
 * El enlace es la única credencial del escenario, así que el identificador
 * completo no puede aparecer ni en pantalla compartida ni en un PDF que se
 * envía al cliente. Cuatro caracteres bastan para distinguir dos escenarios
 * abiertos a la vez y no permiten reconstruir el enlace.
 */
function getScenarioShortLabel() {
  if (!scenarioId) {
    return "Modo local";
  }

  return `Escenario compartido · …${scenarioId.slice(-4)}`;
}


function getScenarioShareUrl() {
  // Construimos la URL a partir del id y no de location.href para no arrastrar
  // otros parámetros que hubiera en la barra de direcciones.
  return `${window.location.origin}${window.location.pathname}?scenario=${scenarioId}`;
}


async function copyScenarioLink() {
  if (!scenarioId) {
    return;
  }

  const url = getScenarioShareUrl();

  try {
    await navigator.clipboard.writeText(url);

    showNotice(
      "Enlace copiado. Trátalo como una credencial: cualquiera que lo tenga puede ver y editar este escenario.",
      "exito",
    );
  } catch (error) {
    console.warn("No se pudo copiar al portapapeles.", error);

    showNotice(
      `No se ha podido copiar solo. Copia este enlace a mano: ${url}`,
      "aviso",
    );
  }
}
