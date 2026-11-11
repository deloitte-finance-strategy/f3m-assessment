/**
 * «Exportar Excel»: los datos del dominio abierto o los de todo el proyecto, en
 * un Excel de verdad (.xlsx) o, para quien lo necesite, en el CSV de siempre.
 *
 * El Excel y el CSV salen de las mismas filas —las de core/exportacion.js—, asi
 * que no pueden decir cosas distintas: el Excel solo las reparte en una hoja por
 * nivel y les da formato. El CSV se queda para las plantillas que ya existan
 * montadas sobre el, y para quien quiera los datos sin nada mas.
 *
 * Vivia en app.js. Salio de ahi al nacer el Excel, porque lo nuevo nace en app/.
 */

import { agregarPorCapacidad, agregarPorDominio, calculate } from "./metricas.js?v=38";
import { els, state } from "./estado.js?v=38";
import { getActiveDomainConfig } from "./dominios.js?v=38";
import { getActiveFilters, getScopeSummary, getScopedItems } from "./filtros.js?v=38";
import { getDominiosDelOverview } from "./vistas/overview.js?v=38";
import { showNotice } from "./avisos.js?v=38";

import {
  filasDeResumen,
  filasDeRoadmap,
  filasDelProyecto,
  hojaDePortada,
  hojasDeDatos,
  toCsv,
} from "../core/exportacion.js?v=38";

import { crearLibro } from "../core/xlsx.js?v=38";
import { enLetra, fechaLegible, fechaParaArchivo, losDominios } from "../core/presentacion.js?v=38";


const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TIPO_CSV = "text/csv;charset=utf-8";


/**
 * Lo que va entre «F3M» y la fecha en el nombre de un archivo.
 *
 * Solo se quitan los caracteres que Windows no admite en un nombre de archivo:
 * el «&» de FP&A si vale, y es como se llama el dominio.
 */
export function partesDelNombre(...partes) {
  return partes
    .filter(Boolean)
    .map((parte) => String(parte).replace(/[<>:"/\\|?*]+/g, " ").trim())
    .filter(Boolean)
    .join(" - ");
}


/**
 * El nombre del archivo, con el mismo patron que el PDF: «Datos F3M - Acme -
 * FP&A - 2026-10-05.xlsx», con el cliente si lo hay. Antes era siempre
 * «f3m_fpa_assessment_export.csv», y la segunda exportacion del dia pisaba a la
 * primera o salia como «(1)».
 */
function nombreDeDatos(dominio, fecha, extension) {
  return `Datos F3M - ${partesDelNombre(state.cliente, dominio || "Dominio")} - ${fechaParaArchivo(fecha)}.${extension}`;
}


export function descargarArchivo(filename, content, type) {
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


/** «los seis dominios» → «Los seis dominios», para empezar una frase. */
function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}


// ============================================================== las filas

/** Las del dominio abierto: el resumen por capacidad y una por subcapacidad. */
function filasDelDominio(items, dominio) {
  return [
    ...filasDeResumen(agregarPorCapacidad(items), dominio),
    ...filasDeRoadmap(items.map((item) => ({ item, metrics: calculate(item) })), dominio),
  ];
}


/**
 * Las de todo el proyecto: los dominios que aplican al cliente, sin filtros.
 *
 * Sin filtros por lo mismo que el informe de todo el proyecto: son del dominio
 * abierto, y aplicar solo los que existen en los demas daria unos dominios
 * filtrados y otros enteros sin que se notara. A diferencia del informe,
 * lleva tambien los dominios sin empezar: en una hoja de calculo no estorban
 * —se filtran— y lo pendiente tambien es un dato del proyecto.
 */
function filasDeTodoElProyecto(dominios) {
  const resumenes = agregarPorDominio(dominios);

  return filasDelProyecto(
    dominios.map((dominio, indice) => ({
      label: dominio.label || dominio.id,
      resumen: resumenes[indice],
      capacidades: agregarPorCapacidad(dominio.items, dominio.id),
      entradas: dominio.items.map((item) => ({ item, metrics: calculate(item, dominio.id) })),
    })),
  );
}


// ================================================================ el menu

/**
 * Lo que dice el menu al abrirlo: de que dominio es el primer archivo y
 * cuantas subcapacidades lleva cada uno.
 *
 * El del dominio lleva lo que dejan los filtros, como todo lo del dominio
 * abierto, y este archivo se envia: el menu lo dice antes de descargarlo.
 */
export function pintarMenuDeDatos() {
  const dominio = getActiveDomainConfig();
  const alcance = getScopeSummary();
  const dominios = getDominiosDelOverview();
  const delProyecto = dominios.reduce((suma, uno) => suma + uno.items.length, 0);
  const nombre = dominio.label || "este dominio";

  if (els.excelDominioLabel) {
    els.excelDominioLabel.textContent = `Excel de ${nombre}`;
  }

  if (els.csvDominioLabel) {
    els.csvDominioLabel.textContent = `CSV de ${nombre}`;
  }

  [els.excelDominioButton, els.csvDominioButton].forEach((boton) => {
    if (boton) {
      boton.disabled = !alcance.visibles;
    }
  });

  if (els.excelDominioNota) {
    els.excelDominioNota.textContent = !alcance.visibles
      ? "Los filtros no dejan ninguna subcapacidad"
      : alcance.hayFiltros
        ? `Solo ${alcance.visibles === 1 ? "la subcapacidad que dejan" : `las ${alcance.visibles} subcapacidades que dejan`} los filtros, de ${alcance.total}`
        : `Una hoja por capacidad y otra por subcapacidad, con sus ${alcance.total} subcapacidades`;
  }

  [els.excelProyectoButton, els.csvProyectoButton].forEach((boton) => {
    if (boton) {
      boton.disabled = !delProyecto;
    }
  });

  if (els.excelProyectoNota) {
    els.excelProyectoNota.textContent = dominios.length === 1
      ? "Solo aplica un dominio: es el mismo archivo, sin filtros"
      : `${capitalizar(losDominios(dominios.length))}, sin filtros: una hoja por dominio, capacidad y subcapacidad`;
  }
}


// =========================================================== la portada

const COMO_SE_CALCULA =
  "Score medio: la media de las palancas puntuadas. Gap: el objetivo medio menos el score medio, "
  + "nunca menos de cero. Prioridad: gap de 2 o más, Alta; de 1 a 2, Media; por debajo, Baja. "
  + "Oleada: Alta, 1; Media, 2; Baja, 3.";


function portada({ queLleva, alcance, hojas }) {
  return hojaDePortada({
    titulo: `F3M Assessment${state.cliente ? ` · ${state.cliente}` : ""}`,
    subtitulo: "Diagnóstico de madurez de la función financiera · Deloitte Finance Strategy",
    lineas: [
      ["Qué lleva", queLleva],
      ["Alcance", alcance],
      ["Generado", fechaLegible(new Date())],
      ["Hojas", hojas],
      ["Cómo se calcula", COMO_SE_CALCULA],
    ],
  });
}


function textoDeAlcance(alcance) {
  if (!alcance.hayFiltros) {
    return `Las ${alcance.total} subcapacidades del dominio, sin filtros.`;
  }

  const filtros = getActiveFilters().map((filtro) => `${filtro.etiqueta}: ${filtro.valor}`).join(" · ");

  return `${alcance.visibles === 1 ? "La subcapacidad que dejan" : `Las ${alcance.visibles} subcapacidades que dejan`} los filtros, de ${alcance.total}`
    + `${filtros ? ` (${filtros})` : ""}. Las medias de capacidad cuentan solo esas.`;
}


// ============================================================ descargas

/**
 * Los datos del dominio abierto: el resumen por capacidad y una fila por
 * subcapacidad, con los filtros activos. `formato` es "xlsx" o "csv".
 */
export function exportarDatosDelDominio({ formato = "xlsx" } = {}) {
  const config = getActiveDomainConfig();
  const dominio = config.label || config.id;
  const items = getScopedItems();

  // Con los filtros sin dejar nada se descargaba un archivo vacio, de cero
  // bytes, que Excel abre en blanco sin decir por que.
  if (!items.length) {
    showNotice("Los filtros no dejan ninguna subcapacidad: no hay nada que exportar. Quita algún filtro y vuelve a pedirlo.", "warning");
    return;
  }

  const filas = filasDelDominio(items, dominio);
  const alcance = getScopeSummary();

  if (formato === "csv") {
    descargarArchivo(nombreDeDatos(dominio, new Date(), "csv"), toCsv(filas), TIPO_CSV);
  } else {
    descargarArchivo(
      nombreDeDatos(dominio, new Date(), "xlsx"),
      crearLibro({
        titulo: `Datos F3M · ${dominio}`,
        hojas: [
          portada({
            queLleva: `Los datos de ${config.title || dominio}: el resumen por capacidad y el detalle por subcapacidad.`,
            alcance: textoDeAlcance(alcance),
            hojas: "Capacidades: una fila por capacidad, con las medias de sus subcapacidades. "
              + "Subcapacidades: una fila por subcapacidad, con sus scores, la iniciativa sugerida, el responsable, "
              + "las notas del taller y los casos de IA.",
          }),
          ...hojasDeDatos(filas),
        ],
      }),
      TIPO_XLSX,
    );
  }

  // El archivo se envia, y quien lo recibe no sabe que le faltan filas.
  if (alcance.hayFiltros) {
    showNotice(
      `El ${formato === "csv" ? "CSV" : "Excel"} de ${dominio} lleva ${alcance.visibles === 1 ? "la subcapacidad que dejan" : `las ${alcance.visibles} subcapacidades que dejan`} los filtros, de ${alcance.total}.`,
      "info",
    );
  }
}


/** Los datos de todo el proyecto, en un solo archivo y sin filtros. */
export function exportarDatosDelProyecto({ formato = "xlsx" } = {}) {
  const dominios = getDominiosDelOverview();
  const filas = filasDeTodoElProyecto(dominios);

  if (!filas.length) {
    showNotice("Todavía no hay datos que exportar.", "warning");
    return;
  }

  if (formato === "csv") {
    descargarArchivo(nombreDeDatos("Proyecto", new Date(), "csv"), toCsv(filas), TIPO_CSV);
    return;
  }

  const excluidos = state.dominiosExcluidos.length;

  descargarArchivo(
    nombreDeDatos("Proyecto", new Date(), "xlsx"),
    crearLibro({
      titulo: "Datos F3M · Todo el proyecto",
      hojas: [
        portada({
          queLleva: `${dominios.length === 1 ? "Los datos del único dominio que aplica al cliente" : `Los datos de ${losDominios(dominios.length)}${excluidos ? " que aplican al cliente" : " de la función financiera"}`}: `
            + "por dominio, por capacidad y por subcapacidad.",
          alcance: "Sin filtros: todas las subcapacidades de cada dominio, también las que aún no se han puntuado."
            + (excluidos === 1 ? " Un dominio no aplica al cliente y no sale." : "")
            + (excluidos > 1 ? ` ${capitalizar(enLetra(excluidos))} dominios no aplican al cliente y no salen.` : ""),
          hojas: "Dominios: una fila por dominio, la tabla del Overview. Capacidades: una fila por capacidad. "
            + "Subcapacidades: una fila por subcapacidad, con sus scores, la iniciativa sugerida, el responsable, "
            + "las notas del taller y los casos de IA.",
        }),
        ...hojasDeDatos(filas),
      ],
    }),
    TIPO_XLSX,
  );
}
