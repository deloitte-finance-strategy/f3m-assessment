/**
 * Leer los campos de una subcapacidad.
 *
 * Son cuatro accesores de nada, pero los usan la busqueda, la tarjeta de
 * assessment, el modal de criterios y el informe, asi que no pueden vivir en
 * ninguno de ellos sin que los demas tengan que importarselo.
 *
 * Existen porque los datos vienen del Excel y un mismo campo puede llegar como
 * texto o como lista: toList() acepta las dos formas y devuelve siempre una.
 */

import { CASOS_DE_IA } from "./estado.js?v=11";




export function toList(value, separator = "\n") {
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



export function getItemObjective(item) {
  return item.objetivoEvaluacion || item.objetivo || "";
}



export function getItemQuestions(item) {
  return toList(item.preguntasClave || item.preguntas || item.questions);
}



export function getItemEvidenceText(item) {
  return item.evidencias || item.evidence || "";
}


/**
 * Cruza cada titulo de ai.cases con su ficha del catalogo.
 *
 * Si un titulo no esta en el catalogo se devuelve solo el titulo, sin texto de
 * relleno: una ficha sin etiquetas dice la verdad —ese caso no esta
 * clasificado— y un "sin clasificar" inventado no. Que eso no ocurra es trabajo
 * de scripts/check_domains_sync.py, que cruza las dos listas en cada PR.
 */
function fichasDeCasosDeIa(cases) {
  return String(cases || "")
    .split(";")
    .map((titulo) => titulo.trim())
    .filter(Boolean)
    .map((titulo) => CASOS_DE_IA.get(titulo) || { titulo });
}


/**
 * Datos de IA de una subcapacidad, si los trae.
 *
 * Habia un respaldo por nombre de capacidad con los casos de FP&A. Nunca se
 * usaba: las 152 subcapacidades traen su propio bloque ai desde el Excel, y para
 * los otros ocho dominios los nombres de capacidad no coincidian de todas
 * formas.
 *
 * Devuelve el bloque ai con un campo mas, `casos`: la cadena de ai.cases ya
 * partida y cruzada con las fichas del catalogo. Se cruza aqui y no al cargar
 * los dominios porque el catalogo de casos puede no haber llegado, y entonces
 * lo que se pinta es el titulo solo.
 */
export function getAiDataForItem(item) {
  if (item?.ai?.cases || item?.ai?.advanced) {
    return { ...item.ai, casos: fichasDeCasosDeIa(item.ai.cases) };
  }

  return null;
}
