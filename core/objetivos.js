/**
 * Los objetivos de madurez por capacidad y palanca.
 *
 * Son la mitad de todo gap que ensena la herramienta, asi que un fallo aqui no
 * rompe nada: calcula mal. Y calcular mal en silencio, delante de un cliente,
 * es exactamente lo que este repositorio se toma en serio.
 *
 * Las tres funciones eran puras y vivian en app.js sin ninguna prueba. La de
 * serializar ademas se le INYECTABA a core/escenario.js como callback, que es
 * la dependencia del reves: el contrato de escenario tenia que pedirle a la
 * aplicacion algo que no necesita nada de ella.
 */

import {
  DEFAULT_TARGET_MATURITY,
  normalizeTargetValue,
  unique,
} from "./calculo.js?v=12";

import { normalizeMatchKey } from "./coincidencias.js?v=12";


/** Una entrada por capacidad, las tres palancas al objetivo por defecto. */
export function createDefaultTargets(items, defaultTarget = DEFAULT_TARGET_MATURITY) {
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


/**
 * Vuelca los objetivos guardados sobre los de por defecto.
 *
 * Se parte SIEMPRE de los objetivos por defecto y se pisan los que vengan, y no
 * al reves: asi una capacidad nueva en los datos aparece con su objetivo base
 * en vez de sin objetivo, y una capacidad que el escenario trae pero los datos
 * ya no tienen se ignora en vez de aparecer de la nada.
 *
 * La comparacion va por clave normalizada porque el nombre de la capacidad es
 * lo que identifica la entrada, y un escenario guardado hace meses puede
 * traerlo con otra caja o con los acentos descompuestos.
 */
export function normalizeDomainTargets(
  items,
  savedTargets = {},
  defaultTarget = DEFAULT_TARGET_MATURITY,
) {
  const targets = createDefaultTargets(items, defaultTarget);

  const savedTargetsArray = Array.isArray(savedTargets)
    ? savedTargets
    : Object.entries(savedTargets || {}).map(([capabilityKey, capabilityTargets]) => {
        // Las claves pudieron guardarse codificadas: el nombre de la capacidad
        // puede llevar caracteres que Firebase no admite en una ruta.
        let capability = capabilityKey;

        try {
          capability = decodeURIComponent(capabilityKey);
        } catch (error) {
          capability = capabilityKey;
        }

        return {
          capacidad: capabilityTargets?.capacidad || capability,
          procesos: capabilityTargets?.procesos,
          tecnologia: capabilityTargets?.tecnologia,
          organizacion: capabilityTargets?.organizacion,
        };
      });

  savedTargetsArray.forEach((savedTarget) => {
    const savedCapability = savedTarget?.capacidad;

    if (!savedCapability) {
      return;
    }

    const matchingCapability = Object.keys(targets).find(
      (capability) => normalizeMatchKey(capability) === normalizeMatchKey(savedCapability),
    );

    if (!matchingCapability) {
      return;
    }

    targets[matchingCapability] = {
      procesos: normalizeTargetValue(savedTarget.procesos, defaultTarget),
      tecnologia: normalizeTargetValue(savedTarget.tecnologia, defaultTarget),
      organizacion: normalizeTargetValue(savedTarget.organizacion, defaultTarget),
    };
  });

  return targets;
}


/**
 * Los objetivos en la forma que admiten las reglas de Firebase: una lista de
 * registros con `capacidad` y las tres palancas.
 *
 * Se normaliza otra vez a la salida aunque normalizeDomainTargets() ya lo haya
 * hecho. No es redundante: esta funcion tambien se llama con objetivos que
 * vienen de un archivo importado, y un valor fuera del 1-5 haria que las reglas
 * rechazaran la escritura ENTERA, no solo ese campo.
 */
export function serializeTargetsForFirebase(
  items,
  targets,
  defaultTarget = DEFAULT_TARGET_MATURITY,
) {
  const normalizedTargets = normalizeDomainTargets(items, targets, defaultTarget);

  return Object.entries(normalizedTargets).map(([capability, capabilityTargets]) => ({
    capacidad: capability,
    procesos: normalizeTargetValue(capabilityTargets.procesos, defaultTarget),
    tecnologia: normalizeTargetValue(capabilityTargets.tecnologia, defaultTarget),
    organizacion: normalizeTargetValue(capabilityTargets.organizacion, defaultTarget),
  }));
}
