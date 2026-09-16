/**
 * Reconocer el trabajo guardado.
 *
 * Este modulo decide si una subcapacidad de un escenario —de Firebase, de la
 * copia local o de un JSON importado— corresponde a alguna de las que hay
 * cargadas. Es la costura por la que se pierde el trabajo si falla: cuando una
 * fila no casa, no se rompe nada visiblemente, simplemente esa puntuacion no
 * aparece. Y esa es la peor forma de fallar.
 *
 * No es hipotetico: scripts/migrate_items_to_ids.py existe precisamente para
 * reparar escenarios que se guardaron por posicion antes de que hubiera ids.
 *
 * Vivia en app.js, sin una sola prueba, aunque no toca el DOM ni el estado.
 */


/**
 * La forma con la que se comparan dos textos: sin mayusculas, sin acentos y sin
 * espacios de mas. "Contabilidad y provisión fiscal" y "CONTABILIDAD Y
 * PROVISION FISCAL" son la misma capacidad, y un escenario exportado hace dos
 * versiones puede traer cualquiera de las dos.
 */
export function normalizeMatchKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}


/**
 * Busca el primer campo que venga informado, de una lista de nombres posibles.
 *
 * Los escenarios antiguos traian los campos con otros nombres —y con acentos, y
 * en mayusculas—, asi que cada campo se busca por sus alias conocidos.
 */
export function getSavedField(savedItem, fieldNames) {
  for (const fieldName of fieldNames) {
    if (savedItem?.[fieldName] !== undefined && savedItem?.[fieldName] !== null) {
      return savedItem[fieldName];
    }
  }

  return undefined;
}


const ALIAS_DE_SCORE = {
  procesos: ["procesos", "Procesos", "Score Procesos", "ScoreProcesos"],
  tecnologia: ["tecnologia", "Tecnologia", "Tecnología", "Score Tecnología", "Score Tecnologia", "ScoreTecnologia"],
  organizacion: ["organizacion", "Organizacion", "Organización", "Score Organización", "Score Organizacion", "ScoreOrganizacion"],
};


/** La puntuacion de una palanca, este dentro de `scores` o suelta en la fila. */
export function getSavedScore(savedItem, leverKey) {
  if (savedItem?.scores?.[leverKey] !== undefined) {
    return savedItem.scores[leverKey];
  }

  return getSavedField(savedItem, ALIAS_DE_SCORE[leverKey] || []);
}


/**
 * Los items como lista, vengan como lista o indexados por id.
 *
 * Firebase guarda `items` como objeto —las escrituras granulares apuntan a
 * rutas como items/fpa-1-2/scores/procesos— y los JSON antiguos como array.
 */
export function toSavedItemsArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object") {
    return Object.values(value);
  }

  return [];
}


/** Los items de un dominio dentro de un payload, con sus formas historicas. */
export function getScenarioItemsFromPayload(payload, domainId) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload.domains?.[domainId]?.items) {
    return toSavedItemsArray(payload.domains[domainId].items);
  }

  if (payload.domains?.[domainId]?.subcapacities) {
    return toSavedItemsArray(payload.domains[domainId].subcapacities);
  }

  if (payload[domainId]?.items) {
    return toSavedItemsArray(payload[domainId].items);
  }

  if (payload.items) {
    return toSavedItemsArray(payload.items);
  }

  if (payload.subcapacities) {
    return toSavedItemsArray(payload.subcapacities);
  }

  return [];
}


/**
 * La subcapacidad cargada que corresponde a una guardada.
 *
 * Primero por id, que es lo que usan las escrituras granulares y lo unico
 * estable si se reordenan o se anaden subcapacidades. Si no hay id —escenarios
 * anteriores a que existieran— cae a la pareja capacidad + subcapacidad, que es
 * lo bastante especifica: "Contabilidad y provision fiscal" aparece en Fiscal y
 * en Tesoreria, pero esta busqueda ya viene acotada al dominio.
 */
export function findMatchingScenarioItem(items, savedItem) {
  if (!savedItem || !Array.isArray(items)) {
    return null;
  }

  const savedId = savedItem.id || savedItem.ID || savedItem.Id;
  const byId = savedId ? items.find((item) => item.id === savedId) : undefined;

  if (byId) {
    return byId;
  }

  const savedCapability = normalizeMatchKey(
    savedItem.capacidad || savedItem.Capacidad || savedItem.capacity || savedItem.Capability,
  );

  const savedSubcapability = normalizeMatchKey(
    savedItem.subcapacidad || savedItem.Subcapacidad || savedItem.subcapacity || savedItem.Subcapability,
  );

  // Sin ninguno de los dos no hay con que comparar, y un empate entre dos
  // cadenas vacias no es una coincidencia. Hoy no llega a pasar —toda
  // subcapacidad cargada trae capacidad y subcapacidad—, pero esta funcion
  // decide si el trabajo de una sesion se reconoce o se pierde, y el dia que
  // reciba una lista rara es mejor que no reconozca nada a que reconozca lo
  // que no es.
  if (!savedCapability && !savedSubcapability) {
    return undefined;
  }

  return items.find((item) => (
    normalizeMatchKey(item.capacidad) === savedCapability &&
    normalizeMatchKey(item.subcapacidad) === savedSubcapability
  ));
}
