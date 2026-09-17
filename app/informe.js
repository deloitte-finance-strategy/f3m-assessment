/**
 * Lo que la aplicacion le pasa al informe: reunir los datos y abrir la ventana.
 *
 * El deck lo arma informe/pdf.js, que es puro. Aqui vive lo que necesita el
 * estado y el DOM: recoger las cifras del dominio y de la funcion financiera
 * entera, capturar los seis radares —que son PNG de un canvas, y un canvas
 * oculto no tiene tamano— y forzar el tema claro mientras dura la captura.
 */

import {
  ordenarPorPrioridadYGap,
  rankingDeBrechas,
  rankingDePalancas,
  resumenGlobal,
} from "../core/calculo.js?v=12";
import { medirDiapositivas, resumenDeDesbordes } from "../informe/desbordes.js?v=12";
import { buildEnhancedPdfReportHtml } from "../informe/pdf.js?v=12";
import { showNotice } from "./avisos.js?v=12";
import { getActiveDomainConfig } from "./dominios.js?v=12";
import { DOMAINS, els, state } from "./estado.js?v=12";
import { getVisibleItems } from "./filtros.js?v=12";
import { getScenarioShortLabel } from "./firebase.js?v=12";
import {
  getOverviewRadarImagesForPdf,
  getRadarImagesForPdf,
  redimensionarRadares,
} from "./graficos.js?v=12";
import { agregarPorCapacidad, agregarPorDominio, calculate } from "./metricas.js?v=12";
import { getAiDataForItem } from "./subcapacidad.js?v=12";
import { renderDashboard } from "./vistas/dashboard.js?v=12";
import { getDominiosDelOverview, renderOverview } from "./vistas/overview.js?v=12";
import { get } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";


export function exportPdfReport() {
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
