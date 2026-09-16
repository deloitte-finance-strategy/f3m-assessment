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


let scoringCriteriaTrigger = null;
let aiInitiativeTrigger = null;


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


function setupScoringCriteriaModal() {
  if (!els.scoringCriteriaModal || !els.assessmentList) {
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

  // Antes de devolver el foco, no despues: mientras el modal esta abierto el
  // fondo queda inerte, y un elemento inerte no puede recibir el foco. Los
  // otros dos modales ya lo hacian en este orden.
  updateModalOpenState();

  if (scoringCriteriaTrigger?.isConnected) {
    scoringCriteriaTrigger.focus();
  }

  scoringCriteriaTrigger = null;
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
  if (!els.aiInitiativeModal || !els.roadmapTable) {
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


/**
 * Las dos etiquetas de un caso no estrenan familia de color, y no es una
 * limitacion: el sistema ya esta lleno. El verde, el naranja y el azul marino
 * son las palancas; el rojo, el ambar y el verde son la prioridad; el teal es
 * el nivel de madurez y el azul es el estado. Una sexta familia no significaria
 * nada y le quitaria significado a las cinco que ya lo tienen.
 *
 * Se diferencian por peso dentro de la familia neutra. El tipo de valor lleva
 * chip relleno porque es el eje que ordena la conversacion con el cliente
 * —coste, riesgo, decision o P&L—, y el tipo de IA va con borde y fondo
 * transparente porque es un calificativo tecnico.
 *
 * Y dos excepciones tonales, no cromaticas, que es lo que permite destacar sin
 * romper nada:
 *
 * - "Agéntica" en oscuro de alto contraste, porque es lo que todo el mundo
 *   pregunta ahora mismo y se busca con la vista.
 * - "Automatización" en el tratamiento mas apagado del conjunto. Es la etiqueta
 *   honesta de "esto no es IA de verdad" y no debe lucir como si lo fuera.
 */
const CLASE_DE_TIPO_DE_IA = {
  Agéntica: "es-agentica",
  Automatización: "es-automatizacion",
};


function aiCaseTag(valor, definicion, clases) {
  if (!valor) {
    return "";
  }

  const titulo = definicion ? ` title="${escapeAttr(definicion)}"` : "";

  return `<span class="${clases}"${titulo}>${escapeHtml(valor)}</span>`;
}


/** Una ficha de caso: titulo, las dos etiquetas y la frase de que hace. */
function aiCaseCard(caso) {
  const etiquetas = [
    aiCaseTag(caso.tipoValor, caso.definicionTipoValor, "ai-tag ai-tag-valor"),
    aiCaseTag(
      caso.tipoIa,
      caso.definicionTipoIa,
      `ai-tag ai-tag-ia ${CLASE_DE_TIPO_DE_IA[caso.tipoIa] || ""}`.trim(),
    ),
  ].join("");

  return `
    <li class="ai-case">
      <p class="ai-case-title">${escapeHtml(caso.titulo)}</p>
      ${etiquetas ? `<p class="ai-case-tags">${etiquetas}</p>` : ""}
      ${
        caso.descripcion
          ? `<p class="ai-case-description">${escapeHtml(caso.descripcion)}</p>`
          : ""
      }
    </li>
  `;
}


/** La lista de fichas, igual en el modal del roadmap y en la tarjeta. */
function aiCaseCards(casos) {
  if (!casos?.length) {
    return `<p class="small-note">Sin casos de uso de IA asociados informados.</p>`;
  }

  return `<ul class="ai-case-list">${casos.map(aiCaseCard).join("")}</ul>`;
}


/** El contador que acompaña al titulo de la seccion. */
function pintarContadorDeCasos(elemento, casos) {
  if (!elemento) {
    return;
  }

  elemento.textContent = casos.length ? String(casos.length) : "";
  elemento.hidden = !casos.length;
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
  els.aiModalCases.innerHTML = aiCaseCards(aiData.casos);
  pintarContadorDeCasos(els.aiModalCasesCount, aiData.casos);
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

function renderDashboard() {
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


function kpiCard(label, value, note, tone = "neutral") {
  return `
    <article class="kpi-card kpi-card-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>
  `;
}


// El destino es un parametro —con el de siempre por defecto— porque el Overview
// pinta las mismas barras en su propia seccion. Los llamantes del Dashboard no
// cambian: los valores por defecto se evaluan en la llamada, asi que
// getScopedItems() solo se invoca si no se pasa la lista.
function renderPriorityBars(entries, destino = els.priorityBars) {
  if (!destino) {
    return;
  }

  const counts = { Alta: 0, Media: 0, Baja: 0, Pendiente: 0 };
  entries.forEach((entry) => {
    counts[entry.metrics.prioridad] += 1;
  });
  const max = Math.max(...Object.values(counts), 1);
  destino.innerHTML = Object.entries(counts)
    .map(([label, count]) => {
      const width = Math.round((count / max) * 100);
      return barRow(label, count, width, priorityColor(label));
    })
    .join("");
}


function renderLeverBars(items = getScopedItems(), destino = els.leverBars) {
  if (!destino) {
    return;
  }

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

  destino.innerHTML = rows.join("");
}


function barRow(label, value, width, color) {
  // La barra es un grafico, y sin role ni nombre era un span vacio: un lector
  // de pantalla leia la etiqueta y la cifra sueltas, sin nada que las uniera.
  // El aria-hidden del track evita que la barra se anuncie dos veces.
  return `
    <div class="bar-row" role="img" aria-label="${escapeAttr(`${label}: ${value}`)}">
      <span class="bar-label" aria-hidden="true">${escapeHtml(label)}</span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${width}%;background:${color}"></span></span>
      <span class="bar-value" aria-hidden="true">${escapeHtml(String(value))}</span>
    </div>
  `;
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
function getDominiosDelOverview() {
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


function renderOverview() {
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

  const foco = capturarFocoDeObjetivos();

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

  restaurarFocoDeObjetivos(foco);
}


/**
 * Que selector de objetivo tiene el foco, para devolverselo tras repintar.
 *
 * Cambiar un objetivo llama a renderAll(), que reconstruye el panel entero: el
 * <select> que acaba de cambiar desaparece del DOM y el foco cae al <body>. Con
 * teclado eso obliga a volver a tabular desde el principio de la pagina despues
 * de CADA ajuste, y el panel tiene quince selectores.
 *
 * Se captura y se restaura dentro del render y no en el manejador del cambio
 * porque el panel tambien se repinta por otros caminos —una puntuacion, un
 * cambio que llega de Firebase— y el foco se perdia igual en todos ellos.
 *
 * Es el mismo patron que ya usan las tarjetas de scoring en
 * capturarFocoDeAssessment().
 */
function capturarFocoDeObjetivos() {
  const activo = document.activeElement;

  if (!activo || !els.capabilityTargetsPanel?.contains(activo)) {
    return null;
  }

  if (!activo.classList.contains("capability-target-select")) {
    return null;
  }

  return {
    capacidad: activo.dataset.capability,
    palanca: activo.dataset.lever,
  };
}


function restaurarFocoDeObjetivos(foco) {
  if (!foco?.capacidad || !foco?.palanca) {
    return;
  }

  els.capabilityTargetsPanel
    .querySelector(
      `.capability-target-select[data-capability="${CSS.escape(foco.capacidad)}"][data-lever="${CSS.escape(foco.palanca)}"]`,
    )
    ?.focus();
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

    // El bloque de casos se oculta entero cuando la subcapacidad no trae
    // ninguno, en vez de enseñar un recuadro con un "sin casos": un hueco
    // vacio en la tarjeta se lee como algo que no ha cargado.
    const bloqueDeCasos = fragment.querySelector(".ai-detail-block");
    const casos = getAiDataForItem(item)?.casos || [];

    bloqueDeCasos.hidden = !casos.length;

    if (casos.length) {
      bloqueDeCasos.querySelector(".ai-case-cards").innerHTML = aiCaseCards(casos);
      pintarContadorDeCasos(bloqueDeCasos.querySelector(".ai-case-count"), casos);
    }


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

  const rows = ordenarPorPrioridadYGap(
    roadmapItems.map((item) => ({ item, metrics: calculate(item) })),
  )
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
    <caption class="solo-lectores">Roadmap de iniciativas, ordenado por prioridad y gap, con responsable, estado y comentarios.</caption>

    <thead>
      <tr>
        <th scope="col">Capacidad</th>
        <th scope="col">Subcapacidad</th>
        <th scope="col" class="number">Gap</th>
        <th scope="col">Prioridad</th>
        <th scope="col">Iniciativa sugerida</th>
        <th scope="col">IA</th>
        <th scope="col">Oleada</th>
        <th scope="col">Responsable</th>
        <th scope="col">Estado</th>
        <th scope="col">Comentarios</th>
        <th scope="col">Último cambio</th>
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

  const esMio = getUsuarioActual()?.uid === autoria.uid;

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

  // role="status" y no aria-hidden. Era invisible para un lector de pantalla,
  // asi que quien no ve la cuenta se enteraba del limite al perderlo: se pasa
  // de 2.000, las reglas rechazan la escritura entera y el comentario no llega.
  // El aria-live es polite para no interrumpir mientras se escribe.
  return `
    <span class="roadmap-comment-count" role="status" aria-live="polite">
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
    contador.setAttribute("role", "status");
    contador.setAttribute("aria-live", "polite");
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
  if (!guardadosPendientes.size && !hayEscriturasEnVuelo()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
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


function exportPdfReport() {
  // La ventana se abre en el mismo gesto del clic: si se abriera despues, el
  // navegador la bloquearia por emergente.
  const reportWindow = window.open("", "_blank");

  // window.open(url, "_blank", "noopener") no vale aqui: devuelve null y
  // entonces no se puede escribir en la ventana. Hay que anularlo despues.
  //
  // Hoy esto no impide nada. El informe lo genera esta misma aplicacion, va
  // escapado y no lleva scripts, asi que no hay nadie que pueda usar el opener.
  // Se deja como red para el dia en que el informe incorpore algo de fuera, que
  // es justo el dia en que nadie se acordaria de anadirlo.
  if (reportWindow) {
    reportWindow.opener = null;
  }

  if (!reportWindow) {
    showNotice("El navegador ha bloqueado la ventana del informe. Permite las ventanas emergentes de esta página y vuelve a pulsar Exportar PDF.", "aviso");
    return;
  }

  const reportData = conLasVistasDelInformeVisibles(buildEnhancedPdfReportData);
  const reportHtml = buildEnhancedPdfReportHtml(reportData);

  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();

  // La portada y los separadores son a sangre y la escala de color del heatmap
  // es informacion, no adorno. Sin "Graficos de fondo" el navegador los deja en
  // blanco y el PDF que se entrega pierde justo lo que lo hace legible. El
  // aviso se queda en la aplicacion, no en el informe: dentro saldria impreso.
  showNotice(
    "Informe generado. En el diálogo de impresión, elige «Guardar como PDF» y activa "
      + "«Gráficos de fondo»: sin eso las portadas y el heatmap salen en blanco.",
    "info",
  );

  setTimeout(() => {
    // Antes de imprimir, porque el dialogo de impresion bloquea el hilo y
    // despues ya no se mide nada.
    comprobarDesbordesSiSePide(reportWindow);

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
 * Mide el informe recien escrito, si se ha pedido con ?comprobar=desbordes.
 *
 * Solo con el parametro puesto: es una comprobacion de mantenimiento, y quien
 * exporta delante de un cliente no tiene por que ver un aviso sobre pixeles.
 *
 * Se mide desde aqui y no dentro del informe porque la ventana del informe no
 * lleva scripts a proposito, y ademas hereda una CSP que no admite scripts en
 * linea. Desde aqui el documento esta a mano: lo acabamos de escribir.
 */
function comprobarDesbordesSiSePide(reportWindow) {
  const parametros = new URLSearchParams(window.location.search);

  if (parametros.get("comprobar") !== "desbordes") {
    return;
  }

  try {
    const medidas = medirDiapositivas(reportWindow.document);
    const resumen = resumenDeDesbordes(medidas);

    console.table(medidas);
    showNotice(resumen.mensaje, resumen.tono, true);
  } catch (error) {
    console.warn("No se ha podido medir el informe.", error);
  }
}


/**
 * Ejecuta algo con el Dashboard y el Overview a la vista, y los deja como estaban.
 *
 * El informe incorpora los radares capturados del canvas, y un canvas oculto no
 * tiene tamano: si se exporta desde el Roadmap sin haber pasado por el
 * Dashboard, las imagenes saldrian en blanco.
 *
 * Son los dos y no solo el Dashboard desde que el informe abre con la parte
 * global, que lleva los radares de nueve ejes del Overview. Cada uno se
 * restaura por separado: el usuario puede estar en cualquiera de las dos, y
 * dejar oculta la que estaba a la vista se lleva la pantalla por delante.
 *
 * Y se sale del modo presentacion mientras dura la captura. El informe es el
 * entregable: no puede salir de una forma u otra segun como estuviera la
 * pantalla al pulsar el boton. En modo presentacion los radares del Overview
 * van a una sola columna, asi que se capturaban a 734x480 en vez de 414x380, y
 * la diapositiva que los coloca en fila esta medida para los segundos.
 */
function conLasVistasDelInformeVisibles(accion) {
  const densidadPrevia = document.documentElement.dataset.densidad;
  const temaPrevio = document.documentElement.dataset.tema;

  if (densidadPrevia) {
    delete document.documentElement.dataset.densidad;
  }

  // Y en claro. Los radares del informe son PNG capturados del canvas, y
  // Chart.js fija sus colores al construirlos: en tema oscuro se capturaban con
  // la paleta oscura —rotulos gris claro, rejilla oscura— y acababan pegados
  // sobre una diapositiva blanca, donde no se ven.
  document.documentElement.dataset.tema = "claro";

  const vistas = [
    { seccion: document.getElementById("dashboard"), pintar: renderDashboard },
    { seccion: document.getElementById("overview"), pintar: renderOverview },
  ];

  const ocultas = vistas.filter((vista) => vista.seccion?.hidden);

  ocultas.forEach((vista) => {
    vista.seccion.hidden = false;
  });

  vistas.forEach((vista) => vista.pintar());
  redimensionarRadares();

  try {
    return accion();
  } finally {
    ocultas.forEach((vista) => {
      vista.seccion.hidden = true;
    });

    if (temaPrevio) {
      document.documentElement.dataset.tema = temaPrevio;
    } else {
      delete document.documentElement.dataset.tema;
    }

    if (densidadPrevia) {
      document.documentElement.dataset.densidad = densidadPrevia;
    }

    // Los radares quedaron construidos con la paleta y el tamano del informe:
    // hay que devolverlos a los de pantalla, o el consultor vuelve al taller
    // con tres graficos claros y encogidos sobre fondo oscuro.
    if (temaPrevio === "oscuro" || densidadPrevia) {
      vistas.forEach((vista) => vista.pintar());
      redimensionarRadares();
    }
  }
}


// Cuantas filas caben en el informe sin que deje de ser legible.
const PDF_MAX_PRIORIDADES = 10;
const PDF_MAX_ROADMAP = 15;


function buildEnhancedPdfReportData() {
  const visibleItems = getVisibleItems();
  const metrics = visibleItems.map((item) => ({ item, metrics: calculate(item) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);

  const summaryRows = buildPdfSummaryRowsFromItems(visibleItems);

  // El informe es ejecutivo: una tabla de 152 filas no se lee. Pero la poda
  // tiene que verse, porque el titulo decia "Roadmap e iniciativas sugeridas" y
  // parecia el roadmap entero.
  const evaluadasOrdenadas = ordenarPorPrioridadYGap(
    metrics.filter((entry) => !entry.metrics.isPending),
  );

  const topPriorities = evaluadasOrdenadas.slice(0, PDF_MAX_PRIORIDADES);

  const roadmapOrdenado = ordenarPorPrioridadYGap(metrics);

  const roadmapItems = roadmapOrdenado.slice(0, PDF_MAX_ROADMAP);

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
    topPrioritiesTotal: evaluadasOrdenadas.length,
    roadmapItems,
    roadmapTotal: roadmapOrdenado.length,
    commentItems,
    ...cifrasDeCabecera(metrics),
    radarImages: getRadarImagesForPdf(),

    titulares: construirTitularesDelDominio(visibleItems, metrics),
    global: construirBloqueGlobalParaInforme(),
    ia: construirCasosDeIaParaInforme(visibleItems),
  };
}


/**
 * El titular del dominio, en datos y no en texto.
 *
 * Lo redacta informe/secciones.js, que es donde se decide como suena. Aqui solo
 * se distingue "no hay nada puntuado" de "los filtros no dejan ver nada": decir
 * lo primero cuando pasa lo segundo es afirmar algo falso delante del cliente,
 * porque el trabajo esta hecho, solo que fuera del filtro.
 */
function construirTitularesDelDominio(items, metrics) {
  if (!items.length) {
    return {
      aviso:
        `Ninguna de las ${state.items.length} subcapacidades de este dominio pasa los filtros `
        + "activos al generar el informe.",
    };
  }

  const evaluadas = metrics.filter((entrada) => !entrada.metrics.isPending);

  if (!evaluadas.length) {
    return { aviso: "Todavia no hay ninguna subcapacidad puntuada en este dominio." };
  }

  const brechas = rankingDeBrechas(metrics, (entrada) => entrada.item.capacidad);
  const palancas = rankingDePalancas(items);

  return {
    mayorBrecha: brechas[0] || null,
    palancaMasDebil: palancas[0] || null,
    pendientes: metrics.length - evaluadas.length,
  };
}


/**
 * La parte global del informe: los nueve dominios, como en el Overview.
 *
 * Devuelve null si no hay ningun dominio cargado, y entonces el informe se
 * salta la parte entera en vez de abrir con tres diapositivas vacias.
 *
 * No aplica los filtros, igual que el Overview y por el mismo motivo: son del
 * dominio abierto y a nivel global no significan nada. La diapositiva lo dice
 * en pantalla para que el descuadre con la parte de dominio no se lea como un
 * fallo.
 */
function construirBloqueGlobalParaInforme() {
  const dominios = getDominiosDelOverview();

  if (!dominios.length) {
    return null;
  }

  const filas = agregarPorDominio(dominios);

  // Igual que en renderOverview(): no se aplanan a secas, porque un item no
  // sabe de que dominio es y de eso dependen sus objetivos y por tanto su gap.
  const entradas = filas.flatMap((fila) =>
    fila.items.map((item, indice) => ({
      item,
      domainId: fila.id,
      metrics: fila.metricas[indice],
    })),
  );

  const evaluadas = entradas.filter((entrada) => !entrada.metrics.isPending);

  const porGap = filas
    .filter((fila) => Number.isFinite(fila.gap))
    .sort((a, b) => b.gap - a.gap);

  const palancas = rankingDePalancas(entradas.map((entrada) => entrada.item));

  return {
    filas,
    dominios: filas.length,
    dominiosTotales: Object.keys(DOMAINS).length,
    subcapacidades: entradas.length,
    evaluadas: evaluadas.length,

    ...cifrasDeCabecera(entradas),

    titulares: evaluadas.length
      ? {
          mayorBrecha: porGap.length ? { grupo: porGap[0].label, gap: porGap[0].gap } : null,
          palancaMasDebil: palancas[0] || null,
          pendientes: entradas.length - evaluadas.length,
        }
      : { aviso: "Todavia no hay ninguna subcapacidad puntuada en ningun dominio." },

    radarImages: getOverviewRadarImagesForPdf(),
  };
}


/**
 * Los casos de uso de IA de las subcapacidades visibles, deduplicados.
 *
 * Deduplicar es lo que hace viable la seccion: Transacciones tiene unas 54
 * apariciones de solo 31 casos distintos, y sin agrupar serian cinco
 * diapositivas de fichas repetidas. Cada caso se queda con la lista de
 * subcapacidades en las que aparece, que es mas util que la repeticion.
 *
 * Devuelve null si no hay ninguno —catalogo que no cargo, o filtros que no
 * dejan pasar nada—, y entonces el informe omite la seccion entera: una
 * seccion vacia no distingue "este dominio no tiene casos" de "el catalogo no
 * llego".
 */
function construirCasosDeIaParaInforme(items) {
  const porTitulo = new Map();

  items.forEach((item) => {
    const ai = getAiDataForItem(item);

    (ai?.casos || []).forEach((caso) => {
      if (!caso?.titulo) {
        return;
      }

      if (!porTitulo.has(caso.titulo)) {
        porTitulo.set(caso.titulo, { ...caso, subcapacidades: [] });
      }

      porTitulo.get(caso.titulo).subcapacidades.push(item.subcapacidad);
    });
  });

  const casos = [...porTitulo.values()];

  if (!casos.length) {
    return null;
  }

  const agrupar = (campo, campoDeDefinicion) => {
    const grupos = new Map();

    casos.forEach((caso) => {
      const valor = caso[campo];

      if (!valor) {
        return;
      }

      if (!grupos.has(valor)) {
        grupos.set(valor, { valor, definicion: caso[campoDeDefinicion] || "", cuenta: 0 });
      }

      grupos.get(valor).cuenta += 1;
    });

    return [...grupos.values()].sort((a, b) => b.cuenta - a.cuenta);
  };

  return {
    // Primero los que aplican a mas subcapacidades: son los que mas rendimiento
    // dan por iniciativa y los que interesa ensenar si la seccion se corta.
    casos: casos.sort((a, b) => b.subcapacidades.length - a.subcapacidades.length),
    porTipoDeValor: agrupar("tipoValor", "definicionTipoValor"),
    porTipoDeIa: agrupar("tipoIa", "definicionTipoIa"),
    total: casos.length,
  };
}

/**
 * Las cuatro cifras de cabecera con los nombres que usa el informe.
 *
 * El motor las calcula; aqui solo se renombra prioridadAlta -> highCount, que
 * es el nombre con el que viajan a informe/. Antes las dos mitades del informe
 * —la global y la del dominio— las calculaban por su cuenta, con las mismas
 * cuatro expresiones copiadas.
 */
function cifrasDeCabecera(entradas) {
  const resumen = resumenGlobal(entradas);

  return {
    scoreGlobal: resumen.scoreGlobal,
    gapMedio: resumen.gapMedio,
    objetivoMedio: resumen.objetivoMedio,
    highCount: resumen.prioridadAlta,
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


/**
 * Las filas de resumen del CSV, para el ambito visible.
 *
 * Es la capa fina que conoce el estado: filasDeResumen() vive en core/ porque
 * es pura, y aqui solo se le dice sobre que subcapacidades trabajar.
 */
function buildSummaryRows() {
  return filasDeResumen(agregarPorCapacidad(getScopedItems()));
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
