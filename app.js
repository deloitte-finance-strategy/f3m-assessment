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
} from "./core/calculo.js?v=29";

// Objetivos de madurez por capacidad y palanca: la mitad de todo gap.
import {
  createDefaultTargets,
  normalizeDomainTargets,
  serializeTargetsForFirebase,
} from "./core/objetivos.js?v=29";

// Reconocer el trabajo guardado. Si esto falla, una puntuacion no aparece y no
// se rompe nada visiblemente, que es la peor forma de fallar.
import {
  findMatchingScenarioItem,
  getSavedField,
  getSavedScore,
  getScenarioItemsFromPayload,
} from "./core/coincidencias.js?v=29";

// El CSV que se abre en Excel y se le envia al cliente.
import {
  filasDeResumen,
  filasDeRoadmap,
  toCsv,
} from "./core/exportacion.js?v=29";

// El contrato de un escenario: que campos admite Firebase y con que limites.
// Espejo de database.rules.json, para no enviar nunca algo que sera rechazado.
import {
  ESTADOS_VALIDOS,
  LIMITE_DE_CLIENTE,
  LIMITES_DE_TEXTO,
  normalizarAutoria,
  normalizarCliente,
  normalizarEscenarioParaFirebase,
  normalizarEstado,
  normalizarItemCargado,
  recortarAlLimite,
  revisarEscenario,
} from "./core/escenario.js?v=29";

// Escapado, formato y colores de marca. Los comparten la aplicacion y el
// informe PDF, que desde que vive aparte ya no puede leerlos de aqui.
import {
  COLOR_DE_PALANCA,
  escapeAttr,
  escapeHtml,
  fechaParaArchivo,
  formatNumber,
  priorityColor,
} from "./core/presentacion.js?v=29";

// El informe PDF: entra el objeto de datos, sale el documento imprimible.
import { buildEnhancedPdfReportHtml } from "./informe/pdf.js?v=29";

// La red que impide que una diapositiva recorte contenido en silencio. Se
// dispara con ?comprobar=desbordes; ver informe/desbordes.js.
import { medirDiapositivas, resumenDeDesbordes } from "./informe/desbordes.js?v=29";

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
  scenarioId,
  state,
  syncActiveDomainState,
  tarjetasConDetalleAbierto,
} from "./app/estado.js?v=29";

// El banner de avisos y el dialogo de confirmacion.
import {
  abrirDialogo,
  atraparFoco,
  ocultarAviso,
  showNotice,
  updateModalOpenState,
} from "./app/avisos.js?v=29";

// El almacenamiento del navegador, que puede fallar y no es motivo para caerse.
import {
  borrarDeAlmacenamiento,
  escribirAlmacenamiento,
  leerAlmacenamiento,
} from "./app/almacenamiento.js?v=29";

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
} from "./app/preferencias.js?v=29";

// Los seis radares de Chart.js: tres por capacidad y tres por dominio.
import {
  getOverviewRadarImagesForPdf,
  getRadarImagesForPdf,
  configurarNavegacionDeRadares,
  conRadaresAnimados,
  hayLibreriaDeGraficos,
  redimensionarRadares,
  renderCapabilityRadar,
  renderOverviewRadar,
} from "./app/graficos.js?v=29";

// El motor atado al estado: objetivos por dominio y metricas con cache.
import {
  agregarPorCapacidad,
  agregarPorDominio,
  calculate,
  getCapabilityTargets,
} from "./app/metricas.js?v=29";

// El cortacircuitos: quien necesite repintar lo pide por aqui, no al
// orquestador de vistas, para no cerrar un ciclo con el.
import { configurarRepintado } from "./app/repintado.js?v=29";

// La conexion con Firebase.
import {
  conLimiteDeEspera,
  conectarFirebase,
  createScenarioId,
  enEscenarioCompartido,
  getScenarioShareUrl,
  getScenarioShortLabel,
} from "./app/firebase.js?v=29";

// El chip de guardado, que es la unica senal permanente de si el trabajo esta
// a salvo. Va aparte de la persistencia para que la identidad pueda marcarlo
// sin que los dos modulos se importen en circulo.
import {
  hayCanalDeVuelta,
  marcarCanalDeVuelta,
  marcarEscrituraCorrecta,
  marcarFalloDeSincronia,
  updateSaveStatus,
} from "./app/indicador.js?v=29";

// Quien edita: la sesion anonima y el nombre que se elige.
import {
  actualizarIndicadorDeIdentidad,
  getNombreEditor,
  getUsuarioActual,
  inicializarIdentidad,
  marcaDeAutoria,
  pedirNombreEditor,
} from "./app/identidad.js?v=29";

// Un escenario como dato: leerlo, volcarlo y volver a armarlo.
import {
  applyScenarioPayload,
  applyStoredScenario,
  buildScenarioPayload,
  getStoredScenario,
  sanitizeScenarioForFirebase,
} from "./app/escenario.js?v=29";

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
} from "./app/dominios.js?v=29";

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
} from "./app/filtros.js?v=29";

// Leer los campos de una subcapacidad, que llegan del Excel en dos formas.
import {
  getAiDataForItem,
  getItemEvidenceText,
  getItemObjective,
  getItemQuestions,
  toList,
} from "./app/subcapacidad.js?v=29";

// Guardar y recibir: el escenario compartido, las escrituras granulares por
// ruta y la suscripcion remota.
import {
  hayEscriturasEnVuelo,
  initializeSharedScenario,
  persistCliente,
  persistItemChange,
  persistScenario,
  persistTargetsDelDominioActivo,
} from "./app/persistencia.js?v=29";

// Los fragmentos de HTML que comparten varias vistas.
import { buildFilteredEmptyState, priorityBadge } from "./app/celdas.js?v=29";

// El Heatmap, primera vista que sale de aqui.
import { handleHeatmapExpandToggleAll, renderHeatmap } from "./app/vistas/heatmap.js?v=29";

// El Overview: los nueve dominios a la vez, sin aplicar los filtros.
import { getDominiosDelOverview, renderOverview } from "./app/vistas/overview.js?v=29";

// El Dashboard: el dominio abierto, con sus KPIs y su tabla resumen.
import { buildSummaryRows, renderDashboard } from "./app/vistas/dashboard.js?v=29";

// El Assessment: puntuar cada subcapacidad en las tres palancas.
import {
  irASiguientePendiente,
  llevarALasTarjetas,
  pintarSiguientePendiente,
  renderAssessments,
  renderCapabilityTargets,
  setupSiguientePendiente,
} from "./app/vistas/assessment.js?v=29";

// El Roadmap: las iniciativas priorizadas y sus campos editables.
import { hayGuardadosPendientes } from "./app/edicion.js?v=29";
import { renderRoadmap, setupCajaDelRoadmap } from "./app/vistas/roadmap.js?v=29";

// Los dos modales: criterios de puntuacion y ficha de caso de IA.
import { setupAiInitiativeModal, setupScoringCriteriaModal } from "./app/modales.js?v=29";

// La pestana IA: el catalogo de casos y la biblioteca de documentos.
import { renderIa, setupVistaIa } from "./app/vistas/ia.js?v=29";

// La biblioteca de IA y el visor que abre «Más información».
import { cargarBiblioteca, setupVisorDeDocumentos } from "./app/biblioteca.js?v=29";

// Lo que la aplicacion le pasa al informe: datos, radares y tema claro.
import {
  copiarTextoDelCorreo,
  dominiosDelProyecto,
  exportPdfReport,
  exportarActa,
  exportarPreparacion,
  exportarResumen,
} from "./app/informe.js?v=29";

// Si el trabajo en modo local tiene una copia fuera del navegador.
import {
  anotarCopia,
  iniciarAvisoDeCopia,
  olvidarCambiosSinCopia,
  pintarAvisoDeCopia,
} from "./app/copias.js?v=29";

// Ctrl+K: ir a cualquier subcapacidad de los nueve dominios.
import { setupBuscador } from "./app/buscador.js?v=29";

// Una subcapacidad a pantalla completa, para proyectarla en el taller.
import { refrescarModoTaller, setupModoTaller } from "./app/taller.js?v=29";
import { pintarLogoEnElMenu, setupLogoDelCliente } from "./app/logo.js?v=29";

// Que se abra sin red: el service worker y el aviso de que se ha ido.
import { setupSinConexion } from "./app/sin-conexion.js?v=29";

// Fundidos, cifras que cuentan y paneles que se despliegan.
import { activarDesplieguesSuaves, fundir } from "./app/movimiento.js?v=29";


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
  activarDesplieguesSuaves();


  try {
    // El SDK de Firebase, si esta pestana trabaja sobre un escenario
    // compartido: se pide ya, a la vez que los datos, en vez de esperar a que
    // le toque el turno a la identidad. En modo local no pide nada. El catch
    // vacio es porque aqui no se atiende el fallo: quien lo necesita vuelve a
    // llamar mas abajo y lo recibe alli, con su aviso.
    conectarFirebase().catch(() => {});

    // Las fichas de los casos de IA no pueden tumbar el arranque: son metadata
    // de apoyo, y sin ellas cada caso se sigue viendo por su titulo, que es
    // exactamente lo que se enseñaba antes de que existiera el catalogo. Lo que
    // no se hace es callarselo, porque un catalogo que no carga se parece mucho
    // a un catalogo sin clasificar.
    //
    // La biblioteca, igual y a la vez: sin ella las fichas salen sin «Más
    // información», que es lo unico que no se podria abrir.
    //
    // Se piden ANTES que el catalogo de dominios y no despues, porque no
    // dependen de el. En serie eran tres viajes al servidor uno detras de otro
    // —catalogo, fichas, dominios— y en la wifi de un cliente cada viaje se
    // nota. allSettled no rechaza nunca, asi que esperarla mas abajo no deja
    // ningun rechazo sin atender si el catalogo falla antes.
    const apoyos = Promise.allSettled([
      cargarCatalogoDeCasosDeIa(),
      cargarBiblioteca(),
    ]);

    // Sin catalogo no se sabe ni que dominios hay ni de donde salen.
    await cargarCatalogoDeDominios();

    // Los nueve dominios tambien se piden ya, mientras llegan las fichas. Los
    // avisos salen en el mismo orden que antes: primero el de las fichas.
    const dominiosCargados = loadCoreDomains();

    const [fichas, biblioteca] = await apoyos;

    if (fichas.status === "rejected") {
      console.warn(fichas.reason);

      showNotice(
        "No se han podido leer las fichas de los casos de uso de IA. Se siguen viendo los "
          + "títulos, sin su descripción ni sus etiquetas.",
        "aviso",
      );
    } else if (biblioteca.status === "rejected") {
      // Sin fichas no hay fuentes que abrir, asi que este aviso solo tiene
      // sentido si las fichas si han llegado.
      console.warn(biblioteca.reason);

      showNotice(
        "No se ha podido leer la biblioteca de IA. Los casos se siguen viendo, sin el "
          + "enlace a su documento de origen.",
        "aviso",
      );
    }

    const { cargados, fallidos } = await dominiosCargados;

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

    iniciarAvisoDeCopia({ local: !enEscenarioCompartido });

    populateCapacityFilter();

    // El primer pintado con datos: los radares de la vista de arranque crecen
    // desde el centro, como al entrar en ella.
    conRadaresAnimados(renderAll);
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
    "presentacionMenuButton",
    "presentacionMenu",
    "themeButton",
    "initialLoadingState", // NUEVO: estado visual de carga inicial
    "sourceNote",
    "overviewSourceNote",
    "overviewKpiGrid",
    "overviewHeadline",
    "overviewPriorityBars",
    "overviewLeverBars",
    "overviewSummaryTable",
    "overviewUrgentes",
    "overviewUrgentesNota",
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
    "siguientePendienteButton",
    "importJsonButton",
    "exportJsonButton",
    "exportCsvButton",
    "exportPdfButton", // NUEVO: botón de exportación PDF
    "informeMenu",
    "informeDominioButton",
    "informeDominioLabel",
    "informeProyectoButton",
    "informeProyectoNota",
    "informeResumenButton",
    "informeResumenNota",
    "informePreparacionButton",
    "informePreparacionLabel",
    "informePreparacionNota",
    "informeActaButton",
    "informeActaLabel",
    "informeActaNota",
    "informeCorreoButton",
    "informeCorreoNota",
    "resetButton",
    "scenarioMenuButton",
    "scenarioMenu",
    "scenarioMenuState",
    "clienteButton",
    "clienteLabel",
    "headerCliente",
    "createScenarioButton",
    "copyScenarioLinkButton",
    "leaveScenarioButton",
    "editorNameButton",
    "scenarioFileInput",
    "dashboardDomainTitle",
    "iaSourceNote",
    "iaKpiGrid",
    "iaBiblioteca",
    "iaLeyenda",
    "iaBuscar",
    "iaFiltroDominio",
    "iaFiltroValor",
    "iaFiltroTipoIa",
    "iaFiltroDocumento",
    "iaOrden",
    "iaCatalogoTitulo",
    "iaCatalogoRecuento",
    "iaCatalogo",
    "visorDocumento",
    "visorCerrar",
    "visorAntetitulo",
    "visorTitulo",
    "visorDatos",
    "visorContexto",
    "visorMarco",
    "visorAbrir",
    "visorDescargar",
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
  enganchar("informeDominioButton", "click", () => exportPdfReport());
  enganchar("informeProyectoButton", "click", () => exportPdfReport({ proyecto: true }));
  enganchar("informeResumenButton", "click", () => exportarResumen());
  enganchar("informePreparacionButton", "click", () => exportarPreparacion());
  enganchar("informeActaButton", "click", () => exportarActa());
  enganchar("informeCorreoButton", "click", () => copiarTextoDelCorreo());
  enganchar("resetButton", "click", resetScenario);
  enganchar("createScenarioButton", "click", createSharedScenario);
  enganchar("copyScenarioLinkButton", "click", copyScenarioLink);
  enganchar("leaveScenarioButton", "click", salirDelEscenario);
  enganchar("editorNameButton", "click", pedirNombreEditor);
  enganchar("clienteButton", "click", pedirNombreDelCliente);
  enganchar("heatmapExpandToggle", "click", handleHeatmapExpandToggleAll);
  enganchar("loadNoticeClose", "click", ocultarAviso);
  enganchar("presentationModeButton", "click", alternarModoPresentacion);
  enganchar("themeButton", "click", alternarTema);
  window.addEventListener("beforeunload", avisarSiQuedaAlgoSinGuardar);
  setupMenuDeCabecera(els.presentacionMenuButton, els.presentacionMenu);
  setupMenuDeCabecera(els.scenarioMenuButton, els.scenarioMenu, pintarAvisoDeCopia);
  setupMenuDeCabecera(els.exportPdfButton, els.informeMenu, pintarMenuDeInforme);
  setupVistas();
  setupScoringCriteriaModal(); // NUEVO: configura modal de criterios F3M
  setupAiInitiativeModal();
  setupVisorDeDocumentos();
  setupVistaIa();
  setupDomainSwitcher();
  setupNavegacionDeRadares();
  setupFilasDelOverview();
  setupFilasDelDashboard();
  setupLoMasUrgente();
  setupFilasDelHeatmap();
  setupBuscador({ alElegir: abrirTarjetaEnSuDominio });
  setupSiguientePendiente();
  setupSiguienteSinPuntuar();
  setupModoTaller({
    irAlAssessment: () => {
      if (vistaActiva !== "assessment") {
        mostrarVista("assessment");
      }
    },
  });
  setupLogoDelCliente({ alCambiarElLogo: () => renderAll() });
  setupSinConexion();
  setupAltoDePestanas();
  setupCajaDelRoadmap();
  setupBackToTopButton();
}


const VISTAS = ["overview", "dashboard", "assessment", "heatmap", "roadmap", "ia"];

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

  const esOtraVista = id !== vistaActiva;

  vistaActiva = id;

  VISTAS.forEach((vista) => {
    const seccion = document.getElementById(vista);

    if (seccion) {
      seccion.hidden = vista !== id;
    }
  });

  // El nombre del dominio en la barra de pestanas sobra en las dos vistas que
  // no dependen de el; el CSS lo esconde leyendo esto.
  document.querySelector(".tabs")?.setAttribute("data-vista", id);

  document.querySelectorAll(".tabs a").forEach((enlace) => {
    const esActiva = enlace.getAttribute("href") === `#${id}`;

    enlace.classList.toggle("active", esActiva);
    enlace.setAttribute("aria-current", esActiva ? "page" : "false");
  });

  if (actualizarUrl) {
    // replaceState y no el hash directo: cambiar el hash provocaria un salto.
    window.history.replaceState(null, "", `#${id}`);
  }

  // Al cambiar de pestana, la vista nueva entra con un fundido y sus radares
  // crecen desde el centro. Volver a pulsar la misma pestana no anima nada:
  // no ha cambiado lo que se ve.
  if (esOtraVista) {
    fundir(document.getElementById(id));
    conRadaresAnimados(renderAll);
  } else {
    renderAll();
  }

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
 * Pulsar un eje de radar lleva a lo que ese eje representa.
 *
 * En el Overview cada eje es un dominio, y se abre su Dashboard: la misma
 * lectura, un nivel mas abajo. En el Dashboard cada eje es una capacidad, y se
 * abre el Assessment en sus subcapacidades, que es donde se puntua. Antes se
 * abria el Heatmap, pero en un taller lo que se quiere al ver una capacidad
 * floja es ponerse a puntuarla.
 *
 * Se lleva hasta sus tarjetas y no se filtra el Assessment, y eso es a
 * proposito: un filtro de capacidad puesto sin querer cambia luego KPIs,
 * roadmap, CSV y PDF, y en un taller nadie se acuerda de quitarlo.
 *
 * Vive aqui porque cambiar de vista y de dominio es cosa del orquestador; los
 * radares lo reciben inyectado.
 */
function setupNavegacionDeRadares() {
  configurarNavegacionDeRadares({
    abrirDominio: abrirDominioEnSuDashboard,
    abrirCapacidad: abrirCapacidadEnElAssessment,
  });
}


/**
 * Las tarjetas de una capacidad van seguidas, asi que basta con llegar a la
 * primera. Se resaltan todas un momento para que se vea donde empieza y donde
 * acaba, y el foco va a su primer score: con teclado se puntua sin buscarla.
 */
function abrirCapacidadEnElAssessment(capacidad) {
  mostrarVista("assessment");

  llevarALasTarjetas(
    [...els.assessmentList.querySelectorAll(".assessment-card")].filter(
      (tarjeta) => tarjeta.dataset.capacidad === capacidad,
    ),
  );
}


async function abrirDominioEnSuDashboard(domainId) {
  try {
    await switchDomain(domainId);
    mostrarVista("dashboard");
  } catch (error) {
    showNotice(`No se ha podido abrir el dominio ${DOMAINS[domainId]?.label || domainId}. Recarga la página e inténtalo de nuevo.`, "error");
    console.error(error);
  }
}


/**
 * La tabla «Resumen por dominio» del Overview lleva al mismo sitio que el eje
 * del radar: pulsar una fila abre el Dashboard de ese dominio. Era lo primero
 * que se intentaba en un taller, y no pasaba nada.
 *
 * Se escucha en la tabla y no en cada fila porque la tabla se repinta entera.
 * La fila entera se puede pulsar con raton; con teclado, el nombre del dominio
 * es un boton, que es lo que recibe el foco y lo que anuncia un lector.
 */
function setupFilasDelOverview() {
  els.overviewSummaryTable?.addEventListener("click", (event) => {
    const fila = event.target.closest("tr[data-abrir-dominio]");

    // Quien esta seleccionando una cifra para copiarla no quiere irse.
    if (!fila || String(window.getSelection?.() || "")) {
      return;
    }

    abrirDominioEnSuDashboard(fila.dataset.abrirDominio);
  });
}


/**
 * En el Heatmap, pulsar una subcapacidad abre su tarjeta en el Assessment,
 * resaltada y con el foco en su primer score: lo que se ve en rojo en la tabla
 * se puntua o se revisa sin buscarlo. Como las filas del Overview, se pulsa la
 * fila entera con raton y el nombre con teclado.
 *
 * Es del dominio abierto, asi que switchDomain() no hace nada y no se quita
 * ningun filtro: el Heatmap ya ensena solo lo que dejan pasar.
 */
function setupFilasDelHeatmap() {
  els.heatmapTable?.addEventListener("click", (event) => {
    const fila = event.target.closest("tr[data-abrir-subcapacidad]");

    if (!fila || String(window.getSelection?.() || "")) {
      return;
    }

    abrirTarjetaEnSuDominio(state.activeDomainId, fila.dataset.abrirSubcapacidad);
  });
}


/**
 * «Lo más urgente» del Overview: cada iniciativa abre el Assessment de su
 * dominio en su tarjeta, resaltada y con el foco en su primer score, como al
 * llegar desde un radar.
 *
 * Si los filtros del Assessment la esconden, se dice: llevar a una lista en la
 * que no esta, sin explicacion, parece que el boton no funciona. Los filtros no
 * se quitan solos, por lo mismo que en los radares: un filtro que cambia sin
 * que nadie lo toque cambia despues KPIs, roadmap, CSV y PDF.
 */
function setupLoMasUrgente() {
  els.overviewUrgentes?.addEventListener("click", (event) => {
    const boton = event.target.closest("button.urgente");

    if (boton) {
      abrirTarjetaEnSuDominio(boton.dataset.dominio, boton.dataset.id);
    }
  });
}


/**
 * Una subcapacidad de cualquier dominio, en su tarjeta del Assessment. Lo usan
 * «Lo más urgente» y el buscador.
 *
 * Sin tocar los filtros, como los radares: si uno la esconde, se dice, en vez
 * de quitarlo y cambiar con el KPIs, roadmap, CSV y PDF sin que se note.
 */
async function abrirTarjetaEnSuDominio(domainId, itemId) {
  try {
    await switchDomain(domainId);
  } catch (error) {
    showNotice(`No se ha podido abrir el dominio ${DOMAINS[domainId]?.label || domainId}. Recarga la página e inténtalo de nuevo.`, "error");
    console.error(error);
    return;
  }

  mostrarVista("assessment");

  const tarjeta = els.assessmentList.querySelector(
    `.assessment-card[data-id="${CSS.escape(itemId)}"]`,
  );

  if (tarjeta) {
    llevarALasTarjetas([tarjeta]);
    return;
  }

  showNotice(
    "Esa subcapacidad no se ve con los filtros activos del Assessment. Quítalos para llegar a ella.",
    "aviso",
  );
}


/**
 * «Siguiente sin puntuar», en la barra de pestanas: desde cualquier vista del
 * dominio lleva al Assessment y alli a la proxima subcapacidad pendiente, con
 * el foco en su primer score. Vive aqui y no en la vista porque cambiar de
 * pestana es cosa del orquestador.
 */
function setupSiguienteSinPuntuar() {
  els.siguientePendienteButton?.addEventListener("click", () => {
    if (vistaActiva !== "assessment") {
      mostrarVista("assessment");
    }

    irASiguientePendiente();
  });
}


/**
 * La tabla «Resumen por capacidad» del Dashboard lleva al mismo sitio que el
 * eje del radar: las subcapacidades de esa capacidad en el Assessment. Es la
 * pareja de la tabla del Overview, y se resuelve igual.
 */
function setupFilasDelDashboard() {
  els.summaryTable?.addEventListener("click", (event) => {
    const fila = event.target.closest("tr[data-abrir-capacidad]");

    if (!fila || String(window.getSelection?.() || "")) {
      return;
    }

    abrirCapacidadEnElAssessment(fila.dataset.abrirCapacidad);
  });
}


/**
 * Lo que se queda fijo debajo de las pestanas —el encabezado del Roadmap, una
 * tarjeta a la que se llega desde un radar— necesita saber cuanto miden. No es
 * un numero fijo: cambia con la densidad, con la letra y si las pestanas pasan
 * a dos lineas en una ventana estrecha.
 */
function setupAltoDePestanas() {
  const pestanas = document.querySelector(".tabs");

  if (!pestanas || typeof ResizeObserver === "undefined") {
    return;
  }

  new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      "--alto-pestanas",
      `${pestanas.offsetHeight}px`,
    );
  }).observe(pestanas);
}


/**
 * Los dos menus de la cabecera: Escenario y Exportar PDF.
 *
 * La cabecera tenia nueve botones en fila, cuatro de ellos hablando de JSON.
 * Todo lo que no es exportar para el cliente paso al menu Escenario: son
 * acciones que se usan una vez por sesion, y ahi caben con una linea que
 * explique que hacen. El PDF tiene el suyo desde que hay dos informes, el del
 * dominio y el de todo el proyecto.
 */
const cierresDeMenus = [];


function setupMenuDeCabecera(boton, panel, alAbrir) {
  if (!boton || !panel) {
    return;
  }

  const menu = boton.closest(".header-menu");

  const abrir = (abierto) => {
    panel.hidden = !abierto;
    boton.setAttribute("aria-expanded", String(abierto));
  };

  const cerrar = () => abrir(false);

  cierresDeMenus.push(cerrar);

  boton.addEventListener("click", (event) => {
    event.stopPropagation();

    // Lo que dice el menu se escribe al abrirlo: «Última: hace 5 minutos» o
    // cuantos dominios hay evaluados tienen que ser los de ahora.
    if (panel.hidden) {
      alAbrir?.();

      // Con dos menus en la cabecera, abrir uno cierra el otro. El clic no
      // llega al documento —se para arriba—, asi que no lo haria solo.
      cierresDeMenus.filter((otro) => otro !== cerrar).forEach((otro) => otro());
    }

    abrir(panel.hidden);
  });

  // Elegir una opcion cierra el menu antes de que se abra su dialogo.
  panel.addEventListener("click", (event) => {
    if (event.target.closest(".header-menu-item")) {
      abrir(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!panel.hidden && !menu?.contains(event.target)) {
      abrir(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      abrir(false);
      boton.focus();
    }
  });
}


/**
 * El menu del PDF dice que dominio sale en el primero y cuantos en el de todo
 * el proyecto. Sin ninguno puntuado, el del proyecto no se puede pedir: seria
 * un deck sin un solo capitulo.
 */
function pintarMenuDeInforme() {
  const dominio = getActiveDomainConfig();
  const evaluados = dominiosDelProyecto().length;

  if (els.informeDominioLabel) {
    els.informeDominioLabel.textContent = `Informe de ${dominio.label || "este dominio"}`;
  }

  if (els.informeProyectoButton) {
    els.informeProyectoButton.disabled = !evaluados;
  }

  // El resumen es de la funcion financiera entera: le basta un dominio con algo.
  if (els.informeResumenButton) {
    els.informeResumenButton.disabled = !evaluados;
  }

  if (els.informeResumenNota) {
    els.informeResumenNota.textContent = evaluados
      ? "La función financiera en una hoja, para el comité de dirección"
      : "Cuando haya algo puntuado en algún dominio";
  }

  // La preparacion lleva lo que dejan los filtros, y va al cliente: el menu lo
  // dice antes de generarla, no solo el aviso de despues.
  const alcance = getScopeSummary();

  if (els.informePreparacionLabel) {
    els.informePreparacionLabel.textContent = `Preparación del taller de ${dominio.label || "este dominio"}`;
  }

  if (els.informePreparacionNota) {
    els.informePreparacionNota.textContent = alcance.hayFiltros
      ? `Solo ${alcance.visibles === 1 ? "la subcapacidad que dejan" : `las ${alcance.visibles} subcapacidades que dejan`} los filtros, para enviar al cliente`
      : "Preguntas y documentación para enviar al cliente antes de la sesión";
  }

  // El acta necesita algo puntuado: sin nada, saldria con todas las cifras en
  // blanco, y el menu lo dice antes de pedirla.
  const puntuadas = getVisibleItems().filter((item) => !calculate(item).isPending).length;

  if (els.informeActaLabel) {
    els.informeActaLabel.textContent = `Acta del taller de ${dominio.label || "este dominio"}`;
  }

  if (els.informeActaButton) {
    els.informeActaButton.disabled = !puntuadas;
  }

  // El correo acompaña al acta: sin acta, tampoco hay correo.
  if (els.informeCorreoButton) {
    els.informeCorreoButton.disabled = !puntuadas;
  }

  if (els.informeCorreoNota) {
    els.informeCorreoNota.textContent = puntuadas
      ? "Un resumen del acta, listo para pegar en el correo que la acompaña"
      : "Cuando haya algo puntuado, para acompañar al acta";
  }

  if (els.informeActaNota) {
    els.informeActaNota.textContent = !puntuadas
      ? alcance.hayFiltros
        ? "Con los filtros puestos no queda nada puntuado"
        : "Todavía no hay ninguna subcapacidad puntuada"
      : alcance.hayFiltros
        ? `Solo ${alcance.visibles === 1 ? "la subcapacidad que dejan" : `las ${alcance.visibles} subcapacidades que dejan`} los filtros, con sus notas`
        : "Lo puntuado y las notas de la sesión, para enviar al cliente después";
  }

  if (els.informeProyectoNota) {
    els.informeProyectoNota.textContent = !evaluados
      ? "Todavía no hay ningún dominio puntuado"
      : evaluados === 1
        ? "La función financiera y el único dominio evaluado, sin filtros"
        : `La función financiera y los ${evaluados} dominios evaluados, sin filtros`;
  }
}


/**
 * Para quien es el trabajo: en el titulo, en la pestana del navegador y en el
 * menu. Sin nombre, la cabecera es la de siempre y el menu invita a ponerlo.
 */
function pintarCliente() {
  const cliente = state.cliente;

  if (els.headerCliente) {
    els.headerCliente.textContent = cliente;
    els.headerCliente.title = cliente;
    els.headerCliente.hidden = !cliente;
  }

  document.title = cliente ? `F3M Assessment · ${cliente}` : "F3M Assessment";

  if (els.clienteLabel) {
    els.clienteLabel.textContent = cliente
      ? `Cliente: ${cliente}`
      : "Poner el nombre del cliente";
  }
}


async function pedirNombreDelCliente() {
  const nombre = await abrirDialogo({
    eyebrow: "Escenario",
    titulo: "Nombre del cliente",
    parrafos: [
      "Saldrá en la cabecera, en la portada y en el pie de cada diapositiva del informe, y en el nombre del PDF, del CSV y de las copias.",
      scenarioId
        ? "Es del escenario compartido: lo verá todo el equipo que tenga el enlace."
        : "Se guarda con el trabajo de este navegador y viaja en las copias que guardes.",
    ],
    campo: {
      etiqueta: "Cliente",
      valor: state.cliente,
      placeholder: "Por ejemplo, Industrias Acme",
      maxLength: LIMITE_DE_CLIENTE,
    },
    confirmar: "Guardar nombre",
  });

  if (nombre === false) {
    return;
  }

  const limpio = normalizarCliente(nombre);

  if (limpio === state.cliente) {
    return;
  }

  state.cliente = limpio;
  pintarCliente();
  persistCliente();
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
  // Antes que nada: el nombre llega tambien con los cambios de otras personas
  // del escenario, y no depende de la vista ni del dominio abierto. El logo,
  // igual.
  pintarCliente();
  pintarLogoEnElMenu();

  // El Overview agrega state.domains y no state.items: es la unica vista que
  // sigue teniendo algo que ensenar cuando el dominio abierto se queda sin
  // subcapacidades. Por eso va antes del corte de abajo, que las otras cuatro
  // necesitan porque todas leen el dominio activo.
  if (vistaActiva === "overview") {
    renderOverview();
  }

  // La pestana IA tampoco depende del dominio abierto: el catalogo de casos es
  // el mismo para los nueve.
  if (vistaActiva === "ia") {
    renderIa();
  }

  // Su boton esta en la barra de pestanas, a la vista desde cualquier pestana
  // del dominio, asi que se cuenta en cada repintado y no solo en el Assessment.
  pintarSiguientePendiente();

  // Va antes del corte: si el dominio se queda sin subcapacidades, el modo
  // taller tiene que enterarse para cerrarse.
  refrescarModoTaller();

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
    const compartido = enEscenarioCompartido;

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
        texto: "Guardar una copia antes",
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

    // Lo que hay ahora es lo que dice el archivo: ya tiene copia.
    anotarCopia();

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

/**
 * El nombre del CSV, con el mismo patron que el PDF: «Datos F3M - Acme - FP&A -
 * 2026-10-05.csv», con el cliente si lo hay. Antes era siempre
 * «f3m_fpa_assessment_export.csv», y la segunda exportacion del dia pisaba a la
 * primera o salia como «(1)».
 */
function nombreDelCsv(dominio, fecha) {
  return `Datos F3M - ${partesDelNombre(state.cliente, dominio || "Dominio")} - ${fechaParaArchivo(fecha)}.csv`;
}


/**
 * Lo que va entre «F3M» y la fecha en el nombre de un archivo.
 *
 * Solo se quitan los caracteres que Windows no admite en un nombre de archivo:
 * el «&» de FP&A si vale, y es como se llama el dominio.
 */
function partesDelNombre(...partes) {
  return partes
    .filter(Boolean)
    .map((parte) => String(parte).replace(/[<>:"/\\|?*]+/g, " ").trim())
    .filter(Boolean)
    .join(" - ");
}


/**
 * La copia se llamaba siempre «f3m_multidomain_assessment_scenario.json»: con
 * dos clientes en la carpeta de descargas no habia forma de saber cual era cual
 * sin abrirlas. Ahora lleva el cliente y la fecha, como el PDF y el CSV.
 */
function exportScenarioJson() {
  const nombre = partesDelNombre("Copia F3M", state.cliente, fechaParaArchivo(new Date()));

  downloadFile(
    `${nombre}.json`,
    JSON.stringify(buildScenarioPayload(), null, 2),
    "application/json",
  );

  anotarCopia();
}


function exportCsv() {
  const roadmapRows = filasDeRoadmap(
    getScopedItems().map((item) => ({ item, metrics: calculate(item) })),
  );

  const activeDomain = getActiveDomainConfig();

  downloadFile(
    nombreDelCsv(activeDomain.label || activeDomain.id, new Date()),
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
      "Si quieres conservarlos, guarda antes una copia con el botón de abajo.",
    ],
    tono: "peligro",
    confirmar: "Borrar la evaluación",
    confirmacionEscrita: "BORRAR",
    accionSecundaria: {
      texto: "Guardar una copia antes",
      alHacerClic: exportScenarioJson,
    },
  });

  if (!confirmado) {
    return;
  }

  borrarDeAlmacenamiento(STORAGE_KEY);
  olvidarCambiosSinCopia();
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
