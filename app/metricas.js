/**
 * El motor, atado al estado. Las reglas viven en core/; aqui solo se le dice
 * sobre que subcapacidad y con que objetivos.
 *
 * Las dos cachas de este modulo NO se invalidan a mano, y es deliberado: los
 * valores se recalculan siempre y la cacha solo decide si reutiliza el
 * resultado anterior. Si un score o un objetivo cambia, la comparacion falla y
 * se recalcula. No hay que acordarse de vaciar nada al tocar el estado.
 *
 * Ojo al pasar calculate() o getCapabilityTargets() a un map(): su segundo
 * argumento es el dominio, y map pasa el indice. Por eso las envuelven lambdas
 * que parecen redundantes y no lo son.
 */

import {
  DEFAULT_TARGET_MATURITY,
  agregarPorCapacidad as agregarPorCapacidadCore,
  agregarPorDominio as agregarPorDominioCore,
  calcularMetricas,
  normalizeTargetValue,
} from "../core/calculo.js?v=11";

import { DOMAINS, state } from "./estado.js?v=11";


/**
 * Objetivos de una capacidad de un dominio, devolviendo SIEMPRE la misma
 * referencia mientras los tres valores no cambien.
 *
 * Los valores se recalculan en cada llamada, asi que la funcion sigue siendo
 * exacta: la cache solo decide si reutiliza el objeto anterior o crea uno
 * nuevo. Eso permite que calculate() compare objetivos por referencia, sin
 * construir una firma de texto en cada una de sus llamadas.
 *
 * El dominio es un parametro y no state.activeDomainId porque el Overview
 * agrega los nueve a la vez: con el dominio activo de por medio, los gaps de
 * los otros ocho salian calculados contra objetivos que no eran los suyos. Y la
 * clave de la cache lo lleva por lo mismo: "Contabilidad y provision fiscal"
 * existe en Fiscal y en Tesoreria, y no tienen por que compartir objetivo.
 *
 * Nadie muta el objeto devuelto: las escrituras van a state.domains[..].targets,
 * que es el origen, no el resultado.
 */
const cacheDeObjetivos = new Map();


// Un caracter que no puede venir en un nombre de capacidad leido del Excel, para
// que la clave compuesta no se pueda confundir con otra pareja distinta.
const SEPARADOR_DE_CLAVE = "\u0000";




export function getCapabilityTargets(capability, domainId = state.activeDomainId) {
  const dominio = state.domains[domainId];

  const defaultTarget = normalizeTargetValue(
    dominio?.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  // El respaldo a state.targets solo vale para el dominio activo, del que es
  // alias. Para cualquier otro seria colar aqui el objetivo de una capacidad
  // que se llama igual pero es de otro dominio, que es justo el fallo que este
  // parametro viene a arreglar.
  const capabilityTargets =
    dominio?.targets?.[capability] ||
    (domainId === state.activeDomainId
      ? state.targets?.[capability]
      : null);

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

  const clave = `${domainId}${SEPARADOR_DE_CLAVE}${capability}`;
  const guardados = cacheDeObjetivos.get(clave);

  if (
    guardados &&
    guardados.procesos === procesos &&
    guardados.tecnologia === tecnologia &&
    guardados.organizacion === organizacion
  ) {
    return guardados;
  }

  const objetivos = { procesos, tecnologia, organizacion };
  cacheDeObjetivos.set(clave, objetivos);

  return objetivos;
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




export function calculate(item, domainId = state.activeDomainId) {
  const capabilityTargets = getCapabilityTargets(
    item.capacidad,
    domainId,
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
export function agregarPorCapacidad(items, domainId = state.activeDomainId) {
  return agregarPorCapacidadCore(
    items,
    // Envueltas, y no pasadas por referencia: el motor las recorre con map, que
    // pasa el indice como segundo argumento, y el segundo argumento de estas dos
    // es ahora el dominio. Las lambdas no son redundantes.
    (item) => calculate(item, domainId),
    (capacidad) => getCapabilityTargets(capacidad, domainId),
  );
}


/**
 * Agregacion por dominio con el estado de la aplicacion.
 *
 * Gemela de la de arriba. Las metricas y los objetivos se resuelven contra el
 * dominio de cada fila, no contra el que este abierto en el conmutador.
 */
export function agregarPorDominio(dominios) {
  return agregarPorDominioCore(
    dominios,
    (item, domainId) => calculate(item, domainId),
    (capacidad, domainId) => getCapabilityTargets(capacidad, domainId),
  );
}
