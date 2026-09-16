// Firebase SDK - conexión inicial
import {
  get,
  update,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// El motor de calculo F3M: reglas de negocio puras, sin DOM ni estado global.
// Vive aparte para poder probarlo sin levantar la aplicacion (ver tests/).
import {
  DEFAULT_TARGET_MATURITY,
  PALANCAS,
  average,
  getMaturityLevelNumber,
  normalizeTargetValue,
  ordenarPorPrioridadYGap,
  priorityFromGap,
  rankingDeBrechas,
  rankingDePalancas,
  resumenGlobal,
  toScore,
  unique,
} from "./core/calculo.js?v=11";

// Objetivos de madurez por capacidad y palanca: la mitad de todo gap.
import {
  createDefaultTargets,
  normalizeDomainTargets,
  serializeTargetsForFirebase,
} from "./core/objetivos.js?v=11";

// Reconocer el trabajo guardado. Si esto falla, una puntuacion no aparece y no
// se rompe nada visiblemente, que es la peor forma de fallar.
import {
  findMatchingScenarioItem,
  getSavedField,
  getSavedScore,
  getScenarioItemsFromPayload,
} from "./core/coincidencias.js?v=11";

// El CSV que se abre en Excel y se le envia al cliente.
import {
  filasDeResumen,
  filasDeRoadmap,
  toCsv,
} from "./core/exportacion.js?v=11";

// El contrato de un escenario: que campos admite Firebase y con que limites.
// Espejo de database.rules.json, para no enviar nunca algo que sera rechazado.
import {
  ESTADOS_VALIDOS,
  LIMITES_DE_TEXTO,
  normalizarAutoria,
  normalizarEscenarioParaFirebase,
  normalizarEstado,
  normalizarItemCargado,
  recortarAlLimite,
  revisarEscenario,
} from "./core/escenario.js?v=11";

// Escapado, formato y colores de marca. Los comparten la aplicacion y el
// informe PDF, que desde que vive aparte ya no puede leerlos de aqui.
import {
  COLOR_DE_PALANCA,
  escapeAttr,
  escapeHtml,
  formatNumber,
  priorityColor,
} from "./core/presentacion.js?v=11";

// El informe PDF: entra el objeto de datos, sale el documento imprimible.
import { buildEnhancedPdfReportHtml } from "./informe/pdf.js?v=11";

// La red que impide que una diapositiva recorte contenido en silencio. Se
// dispara con ?comprobar=desbordes; ver informe/desbordes.js.
import { medirDiapositivas, resumenDeDesbordes } from "./informe/desbordes.js?v=11";

// El estado compartido y las constantes que lo describen.
import {
  CASOS_DE_IA,
  CASOS_DE_IA_URL,
  CATALOGO_URL,
  DEFAULT_DOMAIN_ID,
  DOMAINS,
  GRUPOS_DE_DOMINIO,
  LEVERS,
  MODO_PRESENTACION_KEY,
  NOMBRE_STORAGE_KEY,
  STATUS_OPTIONS,
  STORAGE_KEY,
  STORAGE_KEY_BASE,
  TEMA_KEY,
  els,
  expandedHeatmapCapabilities,
  scenarioId,
  state,
  syncActiveDomainState,
  tarjetasConDetalleAbierto,
} from "./app/estado.js?v=11";

// El banner de avisos y el dialogo de confirmacion.
import {
  abrirDialogo,
  atraparFoco,
  ocultarAviso,
  showNotice,
  updateModalOpenState,
} from "./app/avisos.js?v=11";

// El almacenamiento del navegador, que puede fallar y no es motivo para caerse.
import {
  borrarDeAlmacenamiento,
  escribirAlmacenamiento,
  leerAlmacenamiento,
} from "./app/almacenamiento.js?v=11";

// Las dos preferencias de vista: el tema y la densidad.
import {
  actualizarBotonDeTema,
  alternarModoPresentacion,
  alternarTema,
  comportamientoDeDesplazamiento,
  enModoPresentacion,
  paletaDeRadar,
  restaurarModoPresentacion,
  seguirAlSistemaSiNoHayEleccion,
  tamanoDeLetraDeGrafico,
  temaActual,
} from "./app/preferencias.js?v=11";

// Los seis radares de Chart.js: tres por capacidad y tres por dominio.
import {
  getOverviewRadarImagesForPdf,
  getRadarImagesForPdf,
  hayLibreriaDeGraficos,
  redimensionarRadares,
  renderCapabilityRadar,
  renderOverviewRadar,
} from "./app/graficos.js?v=11";

// El motor atado al estado: objetivos por dominio y metricas con cache.
import {
  agregarPorCapacidad,
  agregarPorDominio,
  calculate,
  getCapabilityTargets,
} from "./app/metricas.js?v=11";

// El cortacircuitos: quien necesite repintar lo pide por aqui, no al
// orquestador de vistas, para no cerrar un ciclo con el.
import { configurarRepintado } from "./app/repintado.js?v=11";

// La conexion con Firebase.
import {
  conLimiteDeEspera,
  createScenarioId,
  firebaseAuth,
  getScenarioShareUrl,
  getScenarioShortLabel,
  scenarioDatabaseRef,
} from "./app/firebase.js?v=11";

// El chip de guardado, que es la unica senal permanente de si el trabajo esta
// a salvo. Va aparte de la persistencia para que la identidad pueda marcarlo
// sin que los dos modulos se importen en circulo.
import {
  hayCanalDeVuelta,
  marcarCanalDeVuelta,
  marcarEscrituraCorrecta,
  marcarFalloDeSincronia,
  updateSaveStatus,
} from "./app/indicador.js?v=11";

// Quien edita: la sesion anonima y el nombre que se elige.
import {
  actualizarIndicadorDeIdentidad,
  getNombreEditor,
  getUsuarioActual,
  inicializarIdentidad,
  marcaDeAutoria,
  pedirNombreEditor,
} from "./app/identidad.js?v=11";

// Un escenario como dato: leerlo, volcarlo y volver a armarlo.
import {
  applyScenarioPayload,
  applyStoredScenario,
  buildScenarioPayload,
  getStoredScenario,
  sanitizeScenarioForFirebase,
} from "./app/escenario.js?v=11";

// Los nueve dominios: catalogo, carga y conmutador.
import {
  actualizarAvanceDeDominios,
  cargarCatalogoDeCasosDeIa,
  cargarCatalogoDeDominios,
  getActiveDomainConfig,
  loadCoreDomains,
  marcarDominiosNoDisponibles,
  renderDomainSwitcher,
  setActiveDomain,
  switchDomain,
} from "./app/dominios.js?v=11";

// Los tres filtros y el ambito de datos que sale de ellos.
import {
  clearActiveFilters,
  describirObjetivos,
  getActiveFilters,
  getScopeSummary,
  getScopedItems,
  getVisibleItems,
  handleSearchInput,
  populateCapacityFilter,
  removeActiveFilter,
  updateActiveFiltersUi,
} from "./app/filtros.js?v=11";

// Leer los campos de una subcapacidad, que llegan del Excel en dos formas.
import {
  getAiDataForItem,
  getItemEvidenceText,
  getItemObjective,
  getItemQuestions,
  toList,
} from "./app/subcapacidad.js?v=11";

// Guardar y recibir: el escenario compartido, las escrituras granulares por
// ruta y la suscripcion remota.
import {
  hayEscriturasEnVuelo,
  initializeSharedScenario,
  persistItemChange,
  persistScenario,
  persistTargetsDelDominioActivo,
} from "./app/persistencia.js?v=11";

// Los fragmentos de HTML que comparten varias vistas.
import { buildFilteredEmptyState, priorityBadge } from "./app/celdas.js?v=11";

// El Heatmap, primera vista que sale de aqui.
import { handleHeatmapExpandToggleAll, renderHeatmap } from "./app/vistas/heatmap.js?v=11";

// El Overview: los nueve dominios a la vez, sin aplicar los filtros.
import { getDominiosDelOverview, renderOverview } from "./app/vistas/overview.js?v=11";

// El Dashboard: el dominio abierto, con sus KPIs y su tabla resumen.
import { buildSummaryRows, renderDashboard } from "./app/vistas/dashboard.js?v=11";

// El Assessment: puntuar cada subcapacidad en las tres palancas.
import {
  aiCaseCards,
  pintarContadorDeCasos,
  renderAssessments,
  renderCapabilityTargets,
} from "./app/vistas/assessment.js?v=11";

// El Roadmap: las iniciativas priorizadas y sus campos editables.
import { hayGuardadosPendientes, renderRoadmap } from "./app/vistas/roadmap.js?v=11";

// Los dos modales: criterios de puntuacion y ficha de caso de IA.
import { setupAiInitiativeModal, setupScoringCriteriaModal } from "./app/modales.js?v=11";

// Lo que la aplicacion le pasa al informe: datos, radares y tema claro.
import { exportPdfReport } from "./app/informe.js?v=11";


document.addEventListener("DOMContentLoaded", init);


async function init() {
  cacheElements();
  bindGlobalEvents();
  // El tema y la densidad ya vienen puestos de tema.js, que corre antes del
  // primer pintado. Aqui solo se ponen al dia los dos conmutadores, se engancha
  // el seguimiento del sistema y se le dice al modulo que repintar.
  configurarRepintado(renderAll);
  restaurarModoPresentacion();
  actualizarBotonDeTema();
  seguirAlSistemaSiNoHayEleccion();
  setInitialLoading(true); // NUEVO: muestra estado de carga mientras se inicializa la app
  showScenarioModeNotice();
  avisarDeElementosAusentes();


  try {
    // Lo primero: sin catalogo no se sabe ni que dominios hay ni de donde salen.
    await cargarCatalogoDeDominios();

    // Las fichas de los casos de IA no pueden tumbar el arranque: son metadata
    // de apoyo, y sin ellas cada caso se sigue viendo por su titulo, que es
    // exactamente lo que se enseñaba antes de que existiera el catalogo. Lo que
    // no se hace es callarselo, porque un catalogo que no carga se parece mucho
    // a un catalogo sin clasificar.
    try {
      await cargarCatalogoDeCasosDeIa();
    } catch (error) {
      console.warn(error);

      showNotice(
        "No se han podido leer las fichas de los casos de uso de IA. Se siguen viendo los "
          + "títulos, sin su descripción ni sus etiquetas.",
        "aviso",
      );
    }

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

      // Se dice explicitamente que sus datos no se tocan. Este aviso decia solo
      // "el resto funciona con normalidad", que era cierto en pantalla y falso
      // en el servidor: la siguiente escritura completa borraba la rama del
      // dominio ausente para todo el equipo. Ya no lo hace —se escribe una ruta
      // por dominio cargado— y el aviso puede prometerlo.
      showNotice(
        `No se han podido cargar estos dominios: ${nombres}. El resto funciona con normalidad y los `
          + "datos de estos no se tocarán; recarga la página para volver a intentarlo.",
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
    // El catalogo es lo unico sin lo que no se puede empezar, y su fallo mas
    // probable sigue siendo abrir el archivo con file:// en vez de servirlo.
    if (!Object.keys(DOMAINS).length) {
      showNotice(
        "No se ha podido leer la lista de dominios. Si has abierto el archivo directamente, "
          + "ábrelo a través de un servidor local: en esta carpeta, ejecuta "
          + "python -m http.server 8000 y entra en http://localhost:8000/.",
        "error",
      );

      console.error(error);
      return;
    }

    // Si ya sabemos que falta parte de la maquetacion, esa es la explicacion y
    // no un "fallo inesperado": el error que acaba de saltar es la consecuencia,
    // no la causa. El mensaje generico taparia el unico que dice que hacer.
    if (elementosAusentes.length) {
      avisarDeElementosAusentes();
      console.error(error);
      return;
    }

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
    "loadNoticeAction",
    "presentationModeButton",
    "themeButton",
    "initialLoadingState", // NUEVO: estado visual de carga inicial
    "sourceNote",
    "overviewSourceNote",
    "overviewKpiGrid",
    "overviewHeadline",
    "overviewPriorityBars",
    "overviewLeverBars",
    "overviewSummaryTable",
    "overviewRadarProcessesChart",
    "overviewRadarTechnologyChart",
    "overviewRadarOrganizationChart",
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
    "aiModalCasesCount",
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

/**
 * Los elementos que app.js esperaba encontrar y no estaban.
 *
 * Se llena al enganchar los eventos y se consulta una sola vez, desde init().
 */
const elementosAusentes = [];


/**
 * Engancha un evento anotando si el elemento falta, en vez de caerse.
 *
 * Nueve de estos enganches accedian directamente a els.<id>. Si el elemento no
 * estaba, bindGlobalEvents() lanzaba, y se llama FUERA del try de init(), asi
 * que no lo recogia nadie: la aplicacion se quedaba con el spinner de carga
 * puesto para siempre, sin mensaje y sin forma de saber por que.
 *
 * No es hipotetico. Es lo que pasa si el navegador sirve un index.html de una
 * version y un app.js de otra, que es justo el motivo por el que app.js se pide
 * con ?v=: GitHub Pages cachea cada archivo por su cuenta.
 */
function enganchar(id, evento, manejador) {
  const elemento = els[id];

  if (!elemento) {
    elementosAusentes.push(id);
    return;
  }

  elemento.addEventListener(evento, manejador);
}


/**
 * Si falta parte de la maquetacion, decirlo en vez de quedarse a medias.
 *
 * Un boton que no responde es peor que un boton que explica por que: delante de
 * un cliente, lo primero parece que la herramienta esta rota sin mas.
 *
 * Se llama desde init() y no desde bindGlobalEvents() para que el aviso salga
 * DESPUES de showScenarioModeNotice(), que si no lo taparia en los escenarios
 * compartidos.
 */
function avisarDeElementosAusentes() {
  if (!elementosAusentes.length) {
    return;
  }

  console.error(
    "Faltan elementos de la maquetacion que app.js esperaba:",
    elementosAusentes.join(", "),
  );

  showNotice(
    "Esta página se ha cargado a medias y algunos botones no van a responder. "
      + "Suele ser una versión antigua guardada en la caché del navegador: recárgala "
      + "con Ctrl+F5. Si sigue igual, avisa al equipo que la mantiene.",
    "error",
  );
}


function bindGlobalEvents() {
  enganchar("capacityFilter", "change", renderAll);
  enganchar("priorityFilter", "change", renderAll);
  enganchar("searchInput", "input", handleSearchInput);

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
  enganchar("importJsonButton", "click", () => els.scenarioFileInput?.click());
  enganchar("scenarioFileInput", "change", importScenario);
  enganchar("exportJsonButton", "click", exportScenarioJson);
  enganchar("exportCsvButton", "click", exportCsv);
  enganchar("exportPdfButton", "click", exportPdfReport);
  enganchar("resetButton", "click", resetScenario);
  enganchar("createScenarioButton", "click", createSharedScenario);
  enganchar("copyScenarioLinkButton", "click", copyScenarioLink);
  enganchar("leaveScenarioButton", "click", salirDelEscenario);
  enganchar("editorNameButton", "click", pedirNombreEditor);
  enganchar("heatmapExpandToggle", "click", handleHeatmapExpandToggleAll);
  enganchar("loadNoticeClose", "click", ocultarAviso);
  enganchar("presentationModeButton", "click", alternarModoPresentacion);
  enganchar("themeButton", "click", alternarTema);
  window.addEventListener("beforeunload", avisarSiQuedaAlgoSinGuardar);
  setupMenuDeEscenario();
  setupVistas();
  setupScoringCriteriaModal(); // NUEVO: configura modal de criterios F3M
  setupAiInitiativeModal();
  setupDomainSwitcher();
  setupBackToTopButton();
}


const VISTAS = ["overview", "dashboard", "assessment", "heatmap", "roadmap"];

let vistaActiva = "overview";


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
    const ancla = window.location.hash.slice(1);

    // Un ancla que no es una vista —el enlace de saltar al contenido— no debe
    // cambiar de pestana. vistaDesdeLaUrl() devuelve "dashboard" tanto para un
    // hash vacio como para uno desconocido, asi que sin esto pulsar "Saltar al
    // contenido" desde el Roadmap te llevaba al Dashboard.
    if (ancla && !VISTAS.includes(ancla)) {
      return;
    }

    mostrarVista(vistaDesdeLaUrl(), { actualizarUrl: false });
  });

  mostrarVista(vistaDesdeLaUrl(), { actualizarUrl: false, desplazar: false });
}


function vistaDesdeLaUrl() {
  const id = window.location.hash.slice(1);

  return VISTAS.includes(id) ? id : "overview";
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
        behavior: comportamientoDeDesplazamiento(),
        block: "start",
      });
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: comportamientoDeDesplazamiento(),
    });
  });

  window.addEventListener("scroll", updateBackToTopVisibility, {
    passive: true,
  });

  updateBackToTopVisibility();
}


function updateNavigationBadges() {
  if (!els.assessmentTabBadge || !els.roadmapTabBadge || !state.items.length) {
    return;
  }

  const metrics = state.items.map((item) => calculate(item));
  const scoredCount = metrics.filter((entry) => !entry.isPending).length;
  const totalCount = state.items.length;
  const highPriorityCount = metrics.filter((entry) => entry.prioridad === "Alta").length;

  // Los badges son marcas graficas, no parte del nombre del enlace: sin
  // aria-hidden, "Assessment" se anunciaba como "Assessment 12/40" y "Roadmap"
  // como "Roadmap 5 Alta", con el significado escondido en un title que ni el
  // teclado ni el tacto alcanzan. El texto que si se lee va al aria-label del
  // enlace, que es quien lo necesita.
  els.assessmentTabBadge.textContent = `${scoredCount}/${totalCount}`;
  els.assessmentTabBadge.setAttribute("aria-hidden", "true");

  els.roadmapTabBadge.textContent = `${highPriorityCount} Alta`;
  els.roadmapTabBadge.setAttribute("aria-hidden", "true");

  const avance =
    `${scoredCount} de ${totalCount} subcapacidades puntuadas en este dominio. ` +
    "No depende de los filtros activos.";

  const altas =
    `${highPriorityCount} subcapacidades de prioridad alta en este dominio. ` +
    "No depende de los filtros activos.";

  els.assessmentTabBadge.closest("a")?.setAttribute("aria-label", `Assessment · ${avance}`);
  els.roadmapTabBadge.closest("a")?.setAttribute("aria-label", `Roadmap · ${altas}`);

  els.assessmentTabBadge.title = avance;
  els.roadmapTabBadge.title = altas;

  els.roadmapTabBadge.classList.toggle("tab-badge-alert", highPriorityCount > 0);
}


function renderAll(opciones = {}) {
  // El Overview agrega state.domains y no state.items: es la unica vista que
  // sigue teniendo algo que ensenar cuando el dominio abierto se queda sin
  // subcapacidades. Por eso va antes del corte de abajo, que las otras cuatro
  // necesitan porque todas leen el dominio activo.
  if (vistaActiva === "overview") {
    renderOverview();
  }

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


// El destino es un parametro —con el de siempre por defecto— porque el Overview
// pinta las mismas barras en su propia seccion. Los llamantes del Dashboard no
// cambian: los valores por defecto se evaluan en la llamada, asi que
// getScopedItems() solo se invoca si no se pasa la lista.


/* ---------------------------------------------------------------- Overview --
 *
 * La vista que agrega los nueve dominios. Tres cosas la separan del Dashboard,
 * y las tres son deliberadas:
 *
 * 1. No lee state.items ni getScopedItems(), sino state.domains entero. Es la
 *    excepcion a la regla del ambito unico, y existe porque su pregunta es otra:
 *    no "como esta este dominio" sino "como esta la funcion financiera".
 * 2. No aplica los filtros. Son del dominio abierto —el desplegable de capacidad
 *    se rellena con las capacidades del activo—, asi que a nivel global no
 *    significan nada. La nota de ambito lo dice en pantalla para que nadie lea
 *    el descuadre con el Dashboard como un fallo.
 * 3. Cada dominio se calcula contra SUS objetivos, no contra los del activo.
 */


// Cuanto se espera desde la ultima pulsacion antes de guardar. Con "change" a
// secas, un texto sin terminar de escribir no llegaba a guardarse nunca.


/**
 * Frena el cierre de la pestana si hay algo escrito y sin guardar.
 *
 * Los campos del Roadmap se guardan 600 ms despues de la ultima pulsacion.
 * Cerrar la pestana justo despues de escribir un comentario —o de que Firebase
 * acepte la escritura, que tampoco es instantaneo— lo perdia sin dejar rastro.
 *
 * El navegador ignora el texto que se le pase y enseña el suyo; lo unico que
 * cuenta es preventDefault(). Y solo se interrumpe si de verdad queda algo:
 * un dialogo de "¿seguro que quieres salir?" en cada cierre es ruido que se
 * aprende a ignorar, y entonces ya no frena nada.
 */
function avisarSiQuedaAlgoSinGuardar(event) {
  if (!hayGuardadosPendientes() && !hayEscriturasEnVuelo()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}


/**
 * Tope de tamano del archivo a importar.
 *
 * Un escenario completo de los nueve dominios no llega al megabyte. El limite
 * no esta para acotar escenarios de verdad, sino para que elegir el archivo
 * equivocado —un volcado, un video— no congele la pestana dentro de
 * readAsText(), que es sincrono para el hilo de pintado una vez arranca.
 */
const LIMITE_DE_IMPORTACION_BYTES = 8 * 1024 * 1024;


/** El archivo como texto, o un rechazo. FileReader no devuelve promesas. */
function leerArchivoComoTexto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.onload = () => resolve(reader.result);

    reader.readAsText(file);
  });
}


/**
 * Que dominios de los cargados va a reemplazar este archivo, por su nombre.
 *
 * applyScenarioPayload() salta los dominios que no estan en memoria, asi que la
 * lista honesta es la interseccion, no las claves del archivo.
 */
function dominiosQueReemplazaElArchivo(payload) {
  return Object.keys(payload?.domains || {})
    .filter((domainId) => state.domains[domainId])
    .map((domainId) => DOMAINS[domainId]?.label || domainId);
}


/**
 * Importar es la acción más destructiva de la herramienta.
 *
 * Reemplaza de golpe los dominios que traiga el archivo, y en un escenario
 * compartido lo hace para todo el mundo. De ahi el orden: primero se lee y se
 * revisa el archivo, luego se dice EN EL DIALOGO que dominios va a reemplazar,
 * y solo entonces se pide escribir SUSTITUIR. Antes la confirmacion iba primero
 * —y solo en modo compartido—, asi que en local no habia ninguna red, y si el
 * archivo no casaba con nada se informaba igualmente de que todo habia ido bien.
 */
async function importScenario(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  // Todo lo que sigue termina devolviendo el input a su sitio: sin esto, elegir
  // el mismo archivo otra vez despues de cancelar no dispara ningun evento.
  try {
    if (file.size > LIMITE_DE_IMPORTACION_BYTES) {
      showNotice(
        `El archivo ${file.name} ocupa demasiado para ser un escenario de esta herramienta. ` +
          "Comprueba que es el JSON que exportaste con Escenario → Guardar una copia.",
        "error",
      );

      return;
    }

    // Se lee y se revisa ANTES de preguntar nada.
    //
    // Antes la confirmacion iba primero, asi que se escribia SUSTITUIR y solo
    // despues se descubria que el archivo no valia. Y de paso permite decir en
    // el dialogo QUE dominios se van a reemplazar, que es justo lo que se
    // necesita saber para decidir.
    let texto;

    // No poder abrir el archivo y que el archivo no sea un escenario son dos
    // problemas distintos, con dos arreglos distintos. Compartian un try, asi
    // que un archivo movido o sin permisos se anunciaba como "tiene que ser un
    // JSON exportado desde esta herramienta", que no lleva a ninguna parte.
    try {
      texto = await leerArchivoComoTexto(file);
    } catch (error) {
      console.error(error);

      showNotice(
        "No se ha podido leer el archivo. Comprueba que sigue disponible y vuelve a intentarlo.",
        "error",
      );

      return;
    }

    let payload;

    try {
      payload = JSON.parse(texto);
    } catch (error) {
      console.error(error);

      showNotice(
        "El archivo no se ha podido leer como escenario. Tiene que ser un JSON exportado con " +
          "Exportar JSON desde esta misma herramienta.",
        "error",
      );

      return;
    }

    const revision = revisarEscenario(payload);

    if (!revision.valido) {
      showNotice(
        `No se ha importado nada. ${revision.motivo}`,
        "error",
      );

      return;
    }

    const dominios = dominiosQueReemplazaElArchivo(payload);

    if (!dominios.length) {
      showNotice(
        "El archivo se ha leído, pero no trae ningún dominio de los que hay cargados, así que no se " +
          "ha cambiado nada. Comprueba que es un escenario exportado desde F3M Assessment.",
        "aviso",
      );

      return;
    }

    // La confirmacion ya no depende del modo. Vivia dentro de
    // `if (scenarioDatabaseRef)`, asi que en local —donde no hay ninguna red y
    // el unico respaldo es el propio navegador— se reemplazaba el trabajo de
    // los nueve dominios sin preguntar.
    const compartido = Boolean(scenarioDatabaseRef);

    const confirmado = await abrirDialogo({
      eyebrow: "Acción irreversible",
      titulo: compartido
        ? "Sustituir el escenario compartido"
        : "Sustituir el trabajo de este navegador",
      parrafos: [
        `Vas a reemplazar el contenido de ${dominios.length === 1 ? "este dominio" : "estos dominios"} con el del archivo ${file.name}: ${dominios.join(", ")}.`,
        compartido
          ? "Afecta a todas las personas que trabajen con este enlace: sus puntuaciones, comentarios y estados quedarán reemplazados por los del archivo."
          : "Se reemplazan las puntuaciones, los comentarios y los estados guardados en este navegador.",
        "No se puede deshacer. Si quieres conservar lo que hay ahora, expórtalo antes con el botón de abajo.",
      ],
      tono: "peligro",
      confirmar: compartido ? "Sustituir el escenario" : "Sustituir el trabajo",
      confirmacionEscrita: "SUSTITUIR",
      accionSecundaria: {
        texto: "Exportar JSON antes",
        alHacerClic: exportScenarioJson,
      },
    });

    if (!confirmado) {
      return;
    }

    const resultado = applyScenarioPayload(payload, {
      seguirDominioDelEscenario: true,
    });

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
  } finally {
    event.target.value = "";
  }
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
  const roadmapRows = filasDeRoadmap(
    getScopedItems().map((item) => ({ item, metrics: calculate(item) })),
  );

  const activeDomain = getActiveDomainConfig();
  const domainFileName = toSafeFileName(activeDomain.id || activeDomain.label);

  downloadFile(
    `f3m_${domainFileName}_assessment_export.csv`,
    toCsv([...buildSummaryRows(), ...roadmapRows]),
    "text/csv;charset=utf-8",
  );
}


// Cuantas filas caben en el informe sin que deje de ser legible.


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

  // El diálogo promete "un escenario nuevo con los datos que tienes ahora", y
  // hasta aquí era mentira: STORAGE_KEY lleva el id del escenario
  // (`STORAGE_KEY_BASE:<id>`), así que al navegar a ?scenario=<nuevo> la clave
  // pasaba a una que nadie había escrito nunca. La aplicación arrancaba vacía,
  // no encontraba copia local, y subía ese vacío a Firebase: el escenario se
  // creaba de verdad, pero sin un solo dato. Con un assessment entero puntuado
  // detrás, eso es la sesión de taller tirada a la basura.
  //
  // Dejamos la copia de ahora escrita en la clave del escenario nuevo antes de
  // saltar. Al recargar, applyStoredScenario() la encuentra y
  // initializeSharedScenario() la sube como payload inicial. La copia de la
  // clave base se queda intacta a propósito: es a la que se vuelve al salir
  // del escenario.
  const preparado = escribirAlmacenamiento(
    `${STORAGE_KEY_BASE}:${nuevoId}`,
    JSON.stringify(buildScenarioPayload()),
  );

  if (!preparado) {
    // Sin esa copia el escenario nace en blanco, que es justo lo que se venía
    // a arreglar. Mejor no crearlo que crearlo vacío y que alguien reparta el
    // enlace creyendo que lleva el assessment dentro.
    showNotice(
      "No se ha podido preparar el escenario compartido en este navegador, así que no se ha creado: "
        + "habría salido sin ninguno de tus datos. Exporta una copia y vuelve a intentarlo.",
      "aviso",
    );
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
