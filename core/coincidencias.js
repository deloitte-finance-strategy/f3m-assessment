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
 * Las capacidades que han cambiado de nombre, con el nombre que tenian.
 *
 * El nombre de la capacidad es lo que identifica sus objetivos guardados, y la
 * red de las subcapacidades guardadas sin id. Renombrar una en el Excel sin
 * apuntarlo aqui no rompe nada visiblemente: los objetivos que el equipo hubiera
 * ajustado vuelven al de por defecto, en silencio, y el gap cambia.
 *
 * `dominio` documenta de donde es, pero no hace falta para resolverla: el
 * nombre antiguo solo se traduce si NO existe tal cual entre las capacidades
 * cargadas y el nuevo SI. "Contabilidad y provisión fiscal" sigue existiendo en
 * Fiscal, y ahi se reconoce por su nombre y nunca se traduce.
 */
export const CAPACIDADES_RENOMBRADAS = [
  {
    dominio: "tesoreria",
    antes: "Contabilidad y provisión fiscal",
    ahora: "Control y tratamiento contable",
  },
];


/**
 * Lo mismo para las subcapacidades, con una diferencia: aqui el nombre solo es
 * la red de las guardadas SIN id. Las que tienen id —todo lo guardado desde que
 * existen— se reconocen por el, y el id sale del prefijo "1.1" del nombre en
 * scripts/convert_domains.py: renombrar sin tocar ese prefijo no lo cambia.
 */
export const SUBCAPACIDADES_RENOMBRADAS = [
  {
    dominio: "tesoreria",
    antes: "1.1 Gobierno contable-fiscal de operaciones de tesorería",
    ahora: "1.1 Gobierno del tratamiento contable de operaciones de tesorería",
  },
];


/**
 * El nombre, de entre los cargados, que corresponde a uno guardado: por su
 * nombre, o por el que tuvo segun `renombrados`. Devuelve el nombre tal como
 * esta cargado, o undefined si no corresponde a ninguno.
 */
function nombreVigente(nombreGuardado, nombresCargados, renombrados) {
  const clave = normalizeMatchKey(nombreGuardado);

  if (!clave || !Array.isArray(nombresCargados)) {
    return undefined;
  }

  const buscar = (claveBuscada) => nombresCargados.find(
    (nombre) => normalizeMatchKey(nombre) === claveBuscada,
  );

  const exacto = buscar(clave);

  if (exacto !== undefined) {
    return exacto;
  }

  for (const renombrado of renombrados) {
    if (normalizeMatchKey(renombrado.antes) === clave) {
      const actual = buscar(normalizeMatchKey(renombrado.ahora));

      if (actual !== undefined) {
        return actual;
      }
    }
  }

  return undefined;
}


export function capacidadVigente(nombreGuardado, capacidadesCargadas) {
  return nombreVigente(nombreGuardado, capacidadesCargadas, CAPACIDADES_RENOMBRADAS);
}


export function subcapacidadVigente(nombreGuardado, subcapacidadesCargadas) {
  return nombreVigente(nombreGuardado, subcapacidadesCargadas, SUBCAPACIDADES_RENOMBRADAS);
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
 * lo bastante especifica: un nombre de capacidad puede repetirse entre dominios,
 * pero esta busqueda ya viene acotada al dominio.
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

  // Las dos pudieron guardarse con un nombre que ya no tienen: se traducen al
  // vigente antes de comparar (ver CAPACIDADES_RENOMBRADAS y su hermana).
  const capacidadActual = normalizeMatchKey(
    capacidadVigente(savedCapability, items.map((item) => item.capacidad)) ?? savedCapability,
  );

  const subcapacidadActual = normalizeMatchKey(
    subcapacidadVigente(savedSubcapability, items.map((item) => item.subcapacidad)) ?? savedSubcapability,
  );

  return items.find((item) => (
    normalizeMatchKey(item.capacidad) === capacidadActual &&
    normalizeMatchKey(item.subcapacidad) === subcapacidadActual
  ));
}
