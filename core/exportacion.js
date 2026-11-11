/**
 * El CSV que se abre en el equipo del consultor y se le envia al cliente.
 *
 * Todo lo de aqui esta hecho a proposito para Excel en espanol, y cada decision
 * arregla algo que se vio fallar. Vivia en app.js sin ninguna prueba, aunque no
 * necesita ni DOM ni estado: solo recibe filas y devuelve texto.
 */

import { getMaturityLevel } from "./calculo.js?v=37";


// Excel con configuración regional española espera punto y coma, no coma: con
// comas volcaba todas las columnas en una sola celda. csvEscape ya entrecomilla
// los campos que contienen ";", así que el separador es seguro.
export const CSV_SEPARATOR = ";";

// Marca de orden de bytes. Sin ella Excel abre el archivo como ANSI y
// "Tecnología" llega ilegible.
export const CSV_BOM = "﻿";


// Excel y LibreOffice tratan como formula cualquier celda que empiece por =, +,
// - o @. En los campos de texto libre —comentarios, responsable— eso da dos
// problemas a la vez:
//
// - Seguridad: una celda como =HYPERLINK(...) o una llamada DDE se evalua al
//   abrir el archivo, y estos CSV se abren en el equipo del consultor y se
//   envian al cliente. En un escenario compartido, cualquiera con el enlace
//   puede dejar ese comentario.
// - Presentacion: un comentario que empieza por un guion —"- Falta gobierno"—
//   se ensena hoy como #NAME? en vez de como el texto que se escribio.
//
// El apostrofo delante es la mitigacion habitual: marca la celda como texto y
// la hoja de calculo no lo muestra. Ningun campo numerico de la exportacion
// empieza por esos caracteres, asi que no les afecta.
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;


// Los numeros, con coma decimal y sin separador de miles.
//
// El resto del archivo esta hecho a proposito para Excel en espanol —el punto y
// coma y la marca de orden de bytes estan aqui por eso—, pero los numeros salian
// con punto: "3.17". Excel en espanol no lo lee como el numero 3,17, asi que las
// columnas de score, objetivo y gap llegaban como TEXTO. Quien recibia el CSV no
// podia sumarlas, ni ordenarlas, ni llevarlas a una tabla dinamica.
//
// Sin separador de miles a proposito: un punto de millar volveria a romper la
// lectura. Con scores del 1 al 5 no se llega ahi, pero no depende de eso.
const FORMATO_DE_NUMERO_CSV = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
  useGrouping: false,
});


export function csvEscape(value) {
  // Un numero se escribe como numero. Y no pasa por la proteccion de formulas,
  // que es para el texto que escribe la gente: un numero no puede ser una.
  if (typeof value === "number" && Number.isFinite(value)) {
    return FORMATO_DE_NUMERO_CSV.format(value);
  }

  const text = String(value ?? "");
  const seguro = INICIO_DE_FORMULA.test(text) ? `'${text}` : text;

  // La coma ya no obliga a entrecomillar: el separador es el punto y coma, y
  // entrecomillar "3,17" hacia que Excel volviera a tratarlo como texto.
  return /["\r\n;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}


/**
 * Como se llama cada columna en la primera fila del archivo.
 *
 * Las claves de las filas son nombres de codigo, sin tildes ni espacios, y
 * salian tal cual de cabecera: «Tecnologia», «ObjetivoOrganizacion»,
 * «ScoreMedio», «Owner». Ese archivo se le envia al cliente. Las claves no se
 * tocan —los radares leen estas mismas filas por ellas—; solo cambia lo que se
 * escribe arriba. Una columna que no este aqui sale con su clave.
 */
const TITULOS = {
  ObjetivoProcesos: "Objetivo Procesos",
  Tecnologia: "Tecnología",
  ObjetivoTecnologia: "Objetivo Tecnología",
  Organizacion: "Organización",
  ObjetivoOrganizacion: "Objetivo Organización",
  ScoreMedio: "Score medio",
  ObjetivoMedio: "Objetivo medio",
  TotalDeSubcapacidades: "Subcapacidades",
  IniciativaSugerida: "Iniciativa sugerida",
  Owner: "Responsable",
};


/** Las filas como CSV, con la cabecera tomada de la primera. */
export function toCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.map((header) => csvEscape(TITULOS[header] ?? header)).join(CSV_SEPARATOR),
  ];

  rows.forEach((row) => {
    csvRows.push(headers.map((header) => csvEscape(row[header])).join(CSV_SEPARATOR));
  });

  // Fin de línea CRLF: es lo que espera Excel.
  return CSV_BOM + csvRows.join("\r\n");
}


/**
 * Las tres clases de fila comparten columnas a proposito.
 *
 * El archivo lleva el resumen por capacidad y el detalle por subcapacidad en la
 * misma tabla —y el de todo el proyecto, ademas, una fila por dominio—,
 * distinguidos por la primera columna. Para que Excel las lea como una sola
 * tabla, todas tienen que declarar EXACTAMENTE las mismas claves y en el mismo
 * orden: toCsv() toma la cabecera de la primera fila, asi que una clave de
 * menos en el resumen desplazaria todas las columnas del detalle.
 */
const COLUMNAS = [
  "Tipo",
  "Dominio",
  "Capacidad",
  "Subcapacidad",
  "Puntuadas",
  "TotalDeSubcapacidades",
  "Procesos",
  "ObjetivoProcesos",
  "Tecnologia",
  "ObjetivoTecnologia",
  "Organizacion",
  "ObjetivoOrganizacion",
  "ScoreMedio",
  "ObjetivoMedio",
  "Nivel",
  "Gap",
  "Prioridad",
  "Oleada",
  "IniciativaSugerida",
  "Owner",
  "Estado",
  "Comentarios",
];


/**
 * Lo que dice la primera columna de cada fila.
 *
 * Decia «Resumen» y «Roadmap», que no dicen de que es la fila: la de «Roadmap»
 * lleva las puntuaciones de una subcapacidad, no solo su iniciativa. Con el
 * nombre de lo que es, filtrar la columna en Excel se explica solo.
 */
export const TIPO_DE_FILA = {
  dominio: "Dominio",
  capacidad: "Capacidad",
  subcapacidad: "Subcapacidad",
};


/** Una fila con las columnas del archivo en su orden, y el resto en blanco. */
function fila(valores) {
  const salida = {};

  COLUMNAS.forEach((columna) => {
    salida[columna] = valores[columna] ?? "";
  });

  return salida;
}


/**
 * Las filas de dominio, una por cada uno, desde agregarPorDominio(). Solo las
 * lleva el archivo de todo el proyecto: son la tabla del Overview.
 *
 * El objetivo de cada palanca es la media de los de sus capacidades, asi que
 * puede no ser entero («4,2»). Es el mismo que dibuja el radar del Overview.
 */
export function filasDeDominio(dominios) {
  return dominios.map((dominio) =>
    fila({
      Tipo: TIPO_DE_FILA.dominio,
      Dominio: dominio.label,

      Puntuadas: dominio.evaluadas,
      TotalDeSubcapacidades: dominio.total,

      Procesos: dominio.procesos ?? "",
      ObjetivoProcesos: dominio.objetivoProcesos ?? "",

      Tecnologia: dominio.tecnologia ?? "",
      ObjetivoTecnologia: dominio.objetivoTecnologia ?? "",

      Organizacion: dominio.organizacion ?? "",
      ObjetivoOrganizacion: dominio.objetivoOrganizacion ?? "",

      ScoreMedio: dominio.scoreMedio ?? "",
      ObjetivoMedio: dominio.targetMedio ?? "",
      Nivel: getMaturityLevel(dominio.scoreMedio) ?? "",

      Gap: dominio.gap ?? "",
      Prioridad: dominio.prioridad,
    }),
  );
}


/**
 * Las filas de resumen, una por capacidad, desde agregarPorCapacidad().
 *
 * `dominio` es el nombre del dominio al que pertenecen. Va en todas las filas,
 * tambien en el archivo de un solo dominio: quien junta en una hoja los datos
 * de varios necesita saber de cual es cada fila, y antes solo lo decia el
 * nombre del archivo.
 */
export function filasDeResumen(capacidades, dominio = "") {
  return capacidades.map((capacidad) =>
    fila({
      Tipo: TIPO_DE_FILA.capacidad,
      Dominio: dominio,
      Capacidad: capacidad.capacidad,

      // Lo que la tabla del Dashboard dice en «Avance» y el archivo callaba.
      Puntuadas: capacidad.evaluadas ?? "",
      TotalDeSubcapacidades: capacidad.total ?? "",

      Procesos: capacidad.procesos ?? "",
      ObjetivoProcesos: capacidad.objetivos.procesos,

      Tecnologia: capacidad.tecnologia ?? "",
      ObjetivoTecnologia: capacidad.objetivos.tecnologia,

      Organizacion: capacidad.organizacion ?? "",
      ObjetivoOrganizacion: capacidad.objetivos.organizacion,

      ScoreMedio: capacidad.scoreMedio ?? "",
      ObjetivoMedio: capacidad.targetMedio ?? "",

      // La guarda de "sin score" vive dentro de getMaturityLevel().
      Nivel: getMaturityLevel(capacidad.scoreMedio) ?? "",

      Gap: capacidad.gap ?? "",
      Prioridad: capacidad.prioridad,
    }),
  );
}


/** Las filas de detalle, una por subcapacidad, desde [{ item, metrics }]. */
export function filasDeRoadmap(entradas, dominio = "") {
  return entradas.map(({ item, metrics }) =>
    fila({
      Tipo: TIPO_DE_FILA.subcapacidad,
      Dominio: dominio,
      Capacidad: item.capacidad,
      Subcapacidad: item.subcapacidad,

      Procesos: item.scores.procesos ?? "",
      ObjetivoProcesos: metrics.targets.procesos,

      Tecnologia: item.scores.tecnologia ?? "",
      ObjetivoTecnologia: metrics.targets.tecnologia,

      Organizacion: item.scores.organizacion ?? "",
      ObjetivoOrganizacion: metrics.targets.organizacion,

      ScoreMedio: metrics.scoreMedio ?? "",
      ObjetivoMedio: metrics.targetMedio ?? "",
      Nivel: metrics.nivel ?? "",
      Gap: metrics.gap ?? "",

      Prioridad: metrics.prioridad,
      Oleada: metrics.oleada,
      IniciativaSugerida: item.iniciativaSugerida,
      Owner: item.owner,
      Estado: item.status,
      Comentarios: item.comentario,
    }),
  );
}


/**
 * El archivo de todo el proyecto: los dominios, sus capacidades y sus
 * subcapacidades, en ese orden.
 *
 * Por clase de fila y no dominio a dominio, a proposito: asi lo primero que se
 * ve al abrirlo es la tabla del Overview, y debajo, cada vez con mas detalle,
 * lo mismo que lleva el archivo de un dominio. En Excel se separan filtrando
 * la primera columna.
 *
 * Recibe, por dominio, { label, resumen, capacidades, entradas }: la fila de
 * agregarPorDominio(), las de agregarPorCapacidad() y [{ item, metrics }].
 */
export function filasDelProyecto(dominios) {
  return [
    ...filasDeDominio(dominios.map((dominio) => ({ ...dominio.resumen, label: dominio.label }))),
    ...dominios.flatMap((dominio) => filasDeResumen(dominio.capacidades, dominio.label)),
    ...dominios.flatMap((dominio) => filasDeRoadmap(dominio.entradas, dominio.label)),
  ];
}
