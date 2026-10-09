/**
 * Lo que la aplicacion le pasa al informe: reunir los datos y abrir la ventana.
 *
 * El deck lo arma informe/pdf.js, que es puro. Aqui vive lo que necesita el
 * estado y el DOM: recoger las cifras del dominio y de la funcion financiera
 * entera, capturar los seis radares —que son PNG de un canvas, y un canvas
 * oculto no tiene tamano— y forzar el tema claro mientras dura la captura.
 */

import {
  PALANCAS,
  average,
  masUrgentes,
  ordenarPorPrioridadYGap,
  rankingDeBrechas,
  rankingDePalancas,
  resumenGlobal,
} from "../core/calculo.js?v=32";
import { brechasDeCasos, ordenarPorBrechas } from "../core/biblioteca.js?v=32";
import { filasDeResumen } from "../core/exportacion.js?v=32";
import { medirDiapositivas, resumenDeDesbordes } from "../informe/desbordes.js?v=32";
import { diaLegible, fechaLegible, fechaParaArchivo } from "../core/presentacion.js?v=32";
import { documentoDeActa, textoDelCorreo } from "../informe/acta.js?v=32";
import { buildEnhancedPdfReportHtml } from "../informe/pdf.js?v=32";
import { BRECHAS_EN_EL_RESUMEN, documentoDelResumen } from "../informe/resumen.js?v=32";
import { documentoDePreparacion } from "../informe/preparacion.js?v=32";
import { showNotice } from "./avisos.js?v=32";
import { getActiveDomainConfig } from "./dominios.js?v=32";
import { DOMAINS, els, state } from "./estado.js?v=32";
import { getVisibleItems } from "./filtros.js?v=32";
import { getScenarioShortLabel } from "./firebase.js?v=32";
import {
  capturarRadarDelResumen,
  getOverviewRadarImagesForPdf,
  getRadarImagesForPdf,
  redimensionarRadares,
  renderCapabilityRadar,
} from "./graficos.js?v=32";
import { agregarPorCapacidad, agregarPorDominio, calculate } from "./metricas.js?v=32";
import {
  getAiDataForItem,
  getItemEvidenceText,
  getItemObjective,
  getItemQuestions,
} from "./subcapacidad.js?v=32";
import { renderDashboard } from "./vistas/dashboard.js?v=32";
import { getOrdenDeCasosDeIa } from "./vistas/ia.js?v=32";
import { getDominiosDelOverview, renderOverview } from "./vistas/overview.js?v=32";


/**
 * Abre el informe. Del dominio abierto, como siempre, o con proyecto: true de
 * todos los dominios que tienen algo puntuado, en un solo deck.
 */
export function exportPdfReport({ proyecto = false } = {}) {
  abrirElDeck(
    proyecto ? datosDelProyecto : buildEnhancedPdfReportData,
    buildEnhancedPdfReportHtml,
    "Informe generado. En el diálogo de impresión, elige «Guardar como PDF» y activa "
      + "«Gráficos de fondo»: sin eso las portadas y el heatmap salen en blanco.",
  );
}


/**
 * El resumen de una pagina, para el comite de direccion: la funcion financiera
 * entera en una diapositiva. Sin filtros, como la parte global del informe,
 * porque es esa misma parte resumida. Ver informe/resumen.js.
 *
 * Sin nada puntuado no se pide: el menu ya lo dice y apaga el boton.
 */
export function exportarResumen() {
  if (!dominiosDelProyecto().length) {
    showNotice("Todavía no hay nada puntuado en ningún dominio: el resumen recoge lo que se puntúa.", "aviso");
    return;
  }

  abrirElDeck(
    datosDelResumen,
    documentoDelResumen,
    "Resumen generado. En el diálogo de impresión, elige «Guardar como PDF» y activa «Gráficos de fondo» "
      + "para que salgan los colores.",
  );
}


/**
 * Abre una ventana, escribe en ella lo que salga de dibujar(construir()) y la
 * manda a imprimir cuando han cargado las imagenes. La comparten el informe y
 * el resumen: los dos llevan radares capturados y los dos se miden con
 * ?comprobar=desbordes.
 */
function abrirElDeck(construir, dibujar, aviso) {
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

  const reportData = conLasVistasDelInformeVisibles(construir);
  const reportHtml = dibujar(reportData);

  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();

  // La portada y los separadores son a sangre y la escala de color del heatmap
  // es informacion, no adorno. Sin "Graficos de fondo" el navegador los deja en
  // blanco y el PDF que se entrega pierde justo lo que lo hace legible. El
  // aviso se queda en la aplicacion, no en el informe: dentro saldria impreso.
  showNotice(aviso, "info");

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
 * El documento de preparacion del taller, para enviar al cliente antes.
 *
 * Del dominio abierto y con los filtros del Assessment, como el modo taller:
 * con uno de capacidad puesto, el taller y su preparacion son de esa
 * capacidad. Pero este documento sale hacia el cliente, asi que si los
 * filtros dejan algo fuera, el aviso lo dice.
 */
export function exportarPreparacion() {
  const items = getVisibleItems();

  if (!items.length) {
    showNotice("Con los filtros puestos no queda ninguna subcapacidad para el documento de preparación.", "aviso");
    return;
  }

  // En el mismo gesto del clic, como el informe, y por lo mismo.
  const ventana = window.open("", "_blank");

  if (!ventana) {
    showNotice("El navegador ha bloqueado la ventana del documento. Permite las ventanas emergentes de esta página y vuelve a pedirlo.", "aviso");
    return;
  }

  ventana.opener = null;

  const dominio = getActiveDomainConfig();

  ventana.document.open();
  ventana.document.write(documentoDePreparacion({
    cliente: state.cliente,
    logo: state.logo,
    domainLabel: dominio.label,
    domainTitle: dominio.title,
    fechaDeArchivo: fechaParaArchivo(new Date()),
    subcapacidades: items.map((item) => ({
      capacidad: item.capacidad,
      subcapacidad: item.subcapacidad,
      objetivo: getItemObjective(item),
      preguntas: getItemQuestions(item),
      evidencias: getItemEvidenceText(item),
    })),
  }));
  ventana.document.close();

  const total = state.items.length;
  const alcance = items.length < total
    ? `Lleva ${items.length} de las ${total} subcapacidades de ${dominio.label}: las que dejan los filtros. `
    : "";

  showNotice(
    `Documento de preparación generado. ${alcance}En el diálogo de impresión, elige «Guardar como PDF» `
      + "y activa «Gráficos de fondo» para que salgan los colores.",
    alcance ? "aviso" : "info",
  );

  setTimeout(() => {
    ventana.focus();
    ventana.print();
  }, 300);
}


/**
 * El acta del taller, para enviar al cliente despues: lo puntuado, las notas y
 * lo que quedo pendiente.
 *
 * Con el mismo alcance que la preparacion y el modo taller, los filtros del
 * Assessment, para que el acta de un taller de una capacidad sea de esa
 * capacidad. El cierre del modo taller pasa su propio recorrido, que se fijo al
 * abrirlo: asi el acta dice lo mismo que la pantalla que se acaba de proyectar.
 * Sin nada puntuado no hay acta que hacer: un documento con todas las cifras en
 * blanco no le sirve a nadie y parece un fallo.
 */
export function exportarActa({ items = getVisibleItems() } = {}) {
  if (!hayAlgoParaElActa(items)) {
    return;
  }

  // En el mismo gesto del clic, como el informe, y por lo mismo.
  const ventana = window.open("", "_blank");

  if (!ventana) {
    showNotice("El navegador ha bloqueado la ventana del acta. Permite las ventanas emergentes de esta página y vuelve a pedirla.", "aviso");
    return;
  }

  ventana.opener = null;

  const datos = datosDelActa(items);

  ventana.document.open();
  ventana.document.write(documentoDeActa(datos));
  ventana.document.close();

  const total = state.items.length;
  const alcance = items.length < total
    ? `Lleva ${items.length} de las ${total} subcapacidades de ${datos.domainLabel}: las que dejan los filtros. `
    : "";

  // Las notas salen tal cual se escribieron, y el acta va al cliente.
  const conNotas = items.some((item) => String(item.comentario || "").trim());

  showNotice(
    `Acta del taller generada. ${alcance}${conNotas ? "Lleva las notas del taller tal cual: revísalas antes de enviarla. " : ""}`
      + "En el diálogo de impresión, elige «Guardar como PDF» y activa «Gráficos de fondo» para que salgan los colores.",
    alcance || conNotas ? "aviso" : "info",
  );

  setTimeout(() => {
    ventana.focus();
    ventana.print();
  }, 300);
}


/**
 * El texto del correo que acompaña al acta, al portapapeles.
 *
 * El mismo alcance y las mismas cifras que el acta: el correo resume el
 * adjunto, y no puede decir otra cosa. Ver textoDelCorreo() en informe/acta.js.
 */
export async function copiarTextoDelCorreo({ items = getVisibleItems() } = {}) {
  if (!hayAlgoParaElActa(items)) {
    return;
  }

  const texto = textoDelCorreo(datosDelActa(items));

  if (await copiarAlPortapapeles(texto)) {
    showNotice("Texto del correo copiado. Pégalo en un correo nuevo y adjunta el acta: la primera línea es el asunto.", "info");
  } else {
    showNotice("El navegador no ha dejado copiar el texto. Prueba otra vez desde el botón, sin cambiar de ventana entre medias.", "error");
  }
}


function hayAlgoParaElActa(items) {
  if (items.some((item) => !calculate(item).isPending)) {
    return true;
  }

  showNotice(
    items.length < state.items.length
      ? "Con los filtros puestos no queda ninguna subcapacidad puntuada para el acta."
      : "Todavía no hay ninguna subcapacidad puntuada en este dominio: el acta recoge lo que se puntúa en el taller.",
    "aviso",
  );

  return false;
}


/** Lo que el acta, el correo y el cierre del modo taller necesitan de cada subcapacidad. */
export function datosDelActa(items) {
  const dominio = getActiveDomainConfig();
  const ahora = new Date();

  return {
    cliente: state.cliente,
    logo: state.logo,
    domainLabel: dominio.label,
    domainTitle: dominio.title,
    fecha: diaLegible(ahora),
    fechaDeArchivo: fechaParaArchivo(ahora),
    // Los que se apuntaron en el modo taller, despues del cierre.
    proximosPasos: state.proximosPasos?.[state.activeDomainId] || [],
    subcapacidades: items.map((item) => ({
      id: item.id,
      capacidad: item.capacidad,
      subcapacidad: item.subcapacidad,
      scores: item.scores,
      comentario: item.comentario,
      evidencias: getItemEvidenceText(item),
      metricas: calculate(item),
    })),
  };
}


/**
 * La API del portapapeles solo existe en un origen seguro: en GitHub Pages y
 * en localhost si, pero no en una IP de la red de la oficina servida por http.
 * Ahi se copia con execCommand, que esta obsoleto pero sigue funcionando en
 * los tres navegadores.
 */
async function copiarAlPortapapeles(texto) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Se intenta abajo.
  }

  const campo = document.createElement("textarea");
  const foco = document.activeElement;

  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();

  let copiado = false;

  try {
    copiado = document.execCommand("copy");
  } catch {
    copiado = false;
  }

  campo.remove();
  foco?.focus?.({ preventScroll: true });

  return copiado;
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
  const activeDomain = getActiveDomainConfig();

  return {
    ...datosComunes(),
    filters: getPdfActiveFiltersLabel(),
    ...datosDeDominio(activeDomain.id, getVisibleItems(), getRadarImagesForPdf()),
  };
}


/**
 * Los dominios que entran en el informe de todo el proyecto: los que tienen
 * al menos una subcapacidad puntuada, en el orden del Overview.
 *
 * Los que no se han empezado se quedan fuera. Casi ningun proyecto evalua los
 * nueve, y un capitulo entero de «Pendiente» por cada uno que no se ha tocado
 * haria de un deck de cuarenta diapositivas uno de ciento cincuenta.
 */
export function dominiosDelProyecto() {
  return getDominiosDelOverview().filter((dominio) =>
    dominio.items.some((item) =>
      Object.values(item.scores || {}).some((score) => score !== null && score !== undefined),
    ),
  );
}


/**
 * Un solo deck con la parte global y un capitulo por cada dominio evaluado.
 *
 * Sin filtros, a proposito: los filtros son del dominio abierto —el de
 * capacidad ni siquiera existe en los demas—, y aplicar solo los que si
 * existen daria un capitulo filtrado y otros enteros sin que se notara. El
 * informe lo dice en la portada y en el cierre.
 *
 * Los radares de cada dominio se pintan uno detras de otro en los canvas del
 * Dashboard y se capturan, como los del dominio abierto. Chart.js va sin
 * animacion, asi que lo que se captura es el radar terminado. Al acabar se
 * vuelve a pintar el Dashboard, o se quedaria con los radares del ultimo.
 */
function datosDelProyecto() {
  const dominios = dominiosDelProyecto().map((dominio) => {
    renderCapabilityRadar(filasDeResumen(agregarPorCapacidad(dominio.items, dominio.id)));

    return datosDeDominio(dominio.id, dominio.items, getRadarImagesForPdf());
  });

  renderDashboard();

  return {
    ...datosComunes(),
    proyecto: true,
    filters: "Ninguno: el informe del proyecto incluye todas las subcapacidades",
    domainLabel: "Proyecto completo",
    domainTitle: dominios.map((dominio) => dominio.domainLabel).join(" · "),
    dominios,
  };
}


/**
 * Lo que lleva el resumen de una pagina: la parte global del informe, con sus
 * mismas cifras, mas las brechas mayores y los proximos pasos de todos los
 * dominios.
 *
 * El radar se dibuja aparte (capturarRadarDelResumen()): los tres del
 * Overview, reducidos a un tercio de media hoja, dejaban los nombres de los
 * dominios ilegibles.
 */
function datosDelResumen() {
  const comunes = datosComunes();
  const dominios = getDominiosDelOverview();
  const nombreDe = new Map(dominios.map((dominio) => [dominio.id, dominio.label]));

  return {
    ...comunes,
    radar: comunes.global ? capturarRadarDelResumen(comunes.global.filas) : "",
    pasos: dominios.flatMap((dominio) =>
      (state.proximosPasos?.[dominio.id] || []).map((paso) => ({ ...paso, dominio: nombreDe.get(dominio.id) })),
    ),
  };
}


/** Lo que es igual en cualquier informe: para quien, cuando y de donde. */
function datosComunes() {
  const ahora = new Date();

  return {
    cliente: state.cliente,
    logo: state.logo,
    generatedAt: fechaLegible(ahora),
    fechaDeArchivo: fechaParaArchivo(ahora),
    // Nunca el identificador completo: este informe se envía al cliente.
    scenarioLabel: getScenarioShortLabel(),
    global: construirBloqueGlobalParaInforme(),
  };
}


/**
 * Las cifras de un dominio para su parte del informe.
 *
 * Recibe el dominio en vez de leer el abierto: el informe del proyecto la
 * llama una vez por dominio, y calculate() sin dominio usaria los objetivos
 * del abierto para todos, que es justo el error que la resolucion por dominio
 * existe para evitar.
 */
function datosDeDominio(domainId, items, radarImages) {
  const config = DOMAINS[domainId] || getActiveDomainConfig();
  const meta = (domainId === state.activeDomainId ? state.meta : state.domains[domainId]?.meta) || {};
  const total = state.domains[domainId]?.items?.length ?? items.length;

  const metrics = items.map((item) => ({ item, metrics: calculate(item, domainId) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);

  // El informe es ejecutivo: una tabla de 152 filas no se lee. Pero la poda
  // tiene que verse, porque el titulo decia "Roadmap e iniciativas sugeridas" y
  // parecia el roadmap entero.
  const evaluadasOrdenadas = ordenarPorPrioridadYGap(scored);
  const roadmapOrdenado = ordenarPorPrioridadYGap(metrics);

  return {
    domainId,
    domainLabel: config.label,
    domainTitle: config.title,
    sourceFile: meta.sourceFile || "-",
    targetMaturity: meta.targetMaturity || "-",
    visibleItems: items,
    metrics,
    scored,
    summaryRows: buildPdfSummaryRowsFromItems(items, domainId),
    topPriorities: evaluadasOrdenadas.slice(0, PDF_MAX_PRIORIDADES),
    topPrioritiesTotal: evaluadasOrdenadas.length,
    roadmapItems: roadmapOrdenado.slice(0, PDF_MAX_ROADMAP),
    roadmapTotal: roadmapOrdenado.length,
    commentItems: items.filter((item) => item.comentario?.trim()),
    ...cifrasDeCabecera(metrics),
    radarImages,

    titulares: construirTitularesDelDominio(items, metrics, total),
    ia: construirCasosDeIaParaInforme(items, domainId),
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
function construirTitularesDelDominio(items, metrics, total) {
  if (!items.length) {
    return {
      aviso:
        `Ninguna de las ${total} subcapacidades de este dominio pasa los filtros `
        + "activos al generar el informe.",
    };
  }

  const evaluadas = metrics.filter((entrada) => !entrada.metrics.isPending);

  if (!evaluadas.length) {
    return { aviso: "Todavía no hay ninguna subcapacidad puntuada en este dominio." };
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

  // Las mismas diez que el Overview, con la funcion que usa el Overview.
  const urgentes = masUrgentes(entradas, 10);
  const nombreDe = new Map(filas.map((fila) => [fila.id, fila.label]));

  // Las mayores brechas con el criterio del acta: lo puntuado que no llega a su
  // objetivo, por prioridad y gap. Las primeras coinciden con «Lo mas urgente»
  // mientras haya cinco de prioridad alta.
  const brechas = ordenarPorPrioridadYGap(evaluadas.filter((entrada) => entrada.metrics.gap > 0));

  // Cada palanca frente a su objetivo, como en el acta: la media de los
  // scores puntuados y la de los objetivos de todas las subcapacidades.
  const palancasFrenteAlObjetivo = PALANCAS.map((palanca) => ({
    key: palanca.key,
    label: palanca.label,
    media: average(entradas.map((entrada) => entrada.item.scores?.[palanca.key]).filter(Number.isFinite)),
    objetivo: average(entradas.map((entrada) => entrada.metrics.targets?.[palanca.key]).filter(Number.isFinite)),
  }));

  return {
    filas,
    palancas: palancasFrenteAlObjetivo,
    brechas: {
      total: brechas.length,
      lista: brechas.slice(0, BRECHAS_EN_EL_RESUMEN).map(({ item, domainId, metrics }) => ({
        dominio: nombreDe.get(domainId) || domainId,
        capacidad: item.capacidad,
        subcapacidad: item.subcapacidad,
        scoreMedio: metrics.scoreMedio,
        targetMedio: metrics.targetMedio,
        gap: metrics.gap,
        prioridad: metrics.prioridad,
      })),
    },
    urgentes: {
      total: urgentes.total,
      lista: urgentes.lista.map(({ item, domainId, metrics }) => ({
        dominio: nombreDe.get(domainId) || domainId,
        capacidad: item.capacidad,
        subcapacidad: item.subcapacidad,
        gap: metrics.gap,
        iniciativa: item.iniciativaSugerida,
      })),
    },
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
      : { aviso: "Todavía no hay ninguna subcapacidad puntuada en ningún dominio." },

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
function construirCasosDeIaParaInforme(items, domainId) {
  const porTitulo = new Map();

  // Donde aparece cada caso, con su subcapacidad: lo que necesita el orden por
  // prioridad del cliente, con la misma forma que en la pestana IA.
  const apariciones = new Map();

  items.forEach((item) => {
    const ai = getAiDataForItem(item);

    (ai?.casos || []).forEach((caso) => {
      if (!caso?.titulo) {
        return;
      }

      if (!porTitulo.has(caso.titulo)) {
        porTitulo.set(caso.titulo, { ...caso, subcapacidades: [] });
        apariciones.set(caso.titulo, []);
      }

      porTitulo.get(caso.titulo).subcapacidades.push(item.subcapacidad);
      apariciones.get(caso.titulo).push({ item });
    });
  });

  // Primero los que aplican a mas subcapacidades: son los que mas rendimiento
  // dan por iniciativa y los que interesa ensenar si la seccion se corta.
  let casos = [...porTitulo.values()].sort(
    (a, b) => b.subcapacidades.length - a.subcapacidades.length,
  );

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

  // Con el orden por prioridad del cliente elegido en la pestana IA, el informe
  // lo sigue: primero lo que ataca las brechas altas de este dominio. Si nada
  // ataca una brecha alta o media, se queda el orden de siempre, y la
  // diapositiva no dice que este ordenada por algo que no ha movido nada.
  let orden = "aplicacion";

  if (getOrdenDeCasosDeIa() === "prioridad") {
    const brechas = brechasDeCasos(apariciones, (aparicion) => calculate(aparicion.item, domainId));

    if ([...brechas.values()].some((brecha) => brecha.altas || brecha.medias)) {
      casos = ordenarPorBrechas(casos, brechas);
      orden = "prioridad";
    }
  }

  return {
    casos,
    orden,
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


function buildPdfSummaryRowsFromItems(items, domainId) {
  return agregarPorCapacidad(items, domainId).map((capacidad) => ({
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
