/**
 * Reconocer el trabajo guardado.
 *
 * Es la costura por la que se pierde trabajo si falla, y falla en silencio: una
 * puntuacion que no casa simplemente no aparece, sin error ni aviso. Que
 * scripts/migrate_items_to_ids.py exista para reparar escenarios guardados por
 * posicion dice lo suficiente sobre lo caro que sale.
 */

import {
  capacidadVigente,
  findMatchingScenarioItem,
  getSavedField,
  getSavedScore,
  getScenarioItemsFromPayload,
  normalizeMatchKey,
  subcapacidadVigente,
  toSavedItemsArray,
} from "../core/coincidencias.js?v=30";


const CARGADOS = [
  { id: "fiscal-1-1", capacidad: "Contabilidad y provisión fiscal", subcapacidad: "1.1 Cálculo del impuesto" },
  { id: "fiscal-1-2", capacidad: "Contabilidad y provisión fiscal", subcapacidad: "1.2 Conciliación fiscal" },
  { id: "fiscal-2-1", capacidad: "Cumplimiento", subcapacidad: "2.1 Calendario de obligaciones" },
];


export const casos = [
  // ------------------------------------------------ clave de comparacion
  {
    grupo: "Clave de comparacion",
    nombre: "ignora mayusculas, acentos y espacios de sobra",
    ejecutar: (t) => {
      const esperado = "contabilidad y provision fiscal";

      t.igual(normalizeMatchKey("Contabilidad y provisión fiscal"), esperado, "acentos");
      t.igual(normalizeMatchKey("CONTABILIDAD Y PROVISION FISCAL"), esperado, "mayusculas");
      t.igual(normalizeMatchKey("  Contabilidad y provisión fiscal  "), esperado, "espacios");
    },
  },
  {
    grupo: "Clave de comparacion",
    nombre: "lo que no es texto no revienta: se queda en cadena vacia",
    ejecutar: (t) => {
      t.igual(normalizeMatchKey(null), "", "null");
      t.igual(normalizeMatchKey(undefined), "", "undefined");
      t.igual(normalizeMatchKey(0), "", "el cero no es un nombre de capacidad");
    },
  },

  // ----------------------------------------------------- campos guardados
  {
    grupo: "Campos con nombres historicos",
    nombre: "se acepta el primer alias informado, en orden",
    ejecutar: (t) => {
      t.igual(getSavedField({ owner: "Ana", Owner: "Luis" }, ["owner", "Owner"]), "Ana", "gana el primero");
      t.igual(getSavedField({ Owner: "Luis" }, ["owner", "Owner"]), "Luis", "cae al alias");
      t.igual(getSavedField({}, ["owner"]), undefined, "sin ninguno, undefined");
    },
  },
  {
    grupo: "Campos con nombres historicos",
    nombre: "un campo a null cuenta como ausente, no como valor",
    ejecutar: (t) => {
      // Importa: si null contara como valor, un owner borrado en un archivo
      // antiguo pisaria el que ya hay en pantalla.
      t.igual(getSavedField({ owner: null, Owner: "Luis" }, ["owner", "Owner"]), "Luis");
    },
  },
  {
    grupo: "Campos con nombres historicos",
    nombre: "la puntuacion se busca dentro de scores y tambien suelta",
    ejecutar: (t) => {
      t.igual(getSavedScore({ scores: { procesos: 3 } }, "procesos"), 3, "dentro de scores");
      t.igual(getSavedScore({ Procesos: 4 }, "procesos"), 4, "columna plana");
      t.igual(getSavedScore({ "Score Tecnología": 2 }, "tecnologia"), 2, "con acento y espacio");
      t.igual(getSavedScore({ Organizacion: 5 }, "organizacion"), 5, "sin acento");
      t.igual(getSavedScore({}, "procesos"), undefined, "sin nada, undefined");
    },
  },
  {
    grupo: "Campos con nombres historicos",
    nombre: "un score a null dentro de scores es un borrado, y se respeta",
    ejecutar: (t) => {
      // No cae al alias plano: dentro de un escenario de esta herramienta, que
      // una palanca este a null significa "sin puntuar", no "no se sabe".
      t.igual(getSavedScore({ scores: { procesos: null }, Procesos: 4 }, "procesos"), null);
    },
  },

  // --------------------------------------------------------- forma de items
  {
    grupo: "Items como lista o como objeto",
    nombre: "Firebase los guarda indexados por id y siguen leyendose",
    ejecutar: (t) => {
      t.igual(toSavedItemsArray([{ id: "a" }]).length, 1, "lista");
      t.igual(toSavedItemsArray({ a: { id: "a" }, b: { id: "b" } }).length, 2, "objeto");
      t.igual(toSavedItemsArray(null).length, 0, "null");
      t.igual(toSavedItemsArray("texto").length, 0, "un texto no son items");
    },
  },
  {
    grupo: "Items como lista o como objeto",
    nombre: "se encuentran en las cinco formas de payload que han existido",
    ejecutar: (t) => {
      const item = { id: "fpa-1-1" };

      t.igual(getScenarioItemsFromPayload([item], "fpa").length, 1, "payload que es la lista");
      t.igual(getScenarioItemsFromPayload({ domains: { fpa: { items: [item] } } }, "fpa").length, 1, "domains.items");
      t.igual(getScenarioItemsFromPayload({ domains: { fpa: { subcapacities: [item] } } }, "fpa").length, 1, "domains.subcapacities");
      t.igual(getScenarioItemsFromPayload({ fpa: { items: [item] } }, "fpa").length, 1, "por dominio en la raiz");
      t.igual(getScenarioItemsFromPayload({ items: [item] }, "fpa").length, 1, "un solo dominio");
      t.igual(getScenarioItemsFromPayload(null, "fpa").length, 0, "sin payload");
    },
  },
  {
    grupo: "Items como lista o como objeto",
    nombre: "un dominio que el payload no trae no devuelve los de otro",
    ejecutar: (t) => {
      const payload = { domains: { fpa: { items: [{ id: "fpa-1-1" }] } } };

      t.igual(getScenarioItemsFromPayload(payload, "fiscal").length, 0);
    },
  },

  // ------------------------------------------------------------ coincidencia
  {
    grupo: "Coincidencia de subcapacidad",
    nombre: "el id manda sobre el nombre",
    ejecutar: (t) => {
      // El nombre apunta a la 2-1 y el id a la 1-1: gana el id, que es lo
      // estable si alguien renombra una subcapacidad en los datos.
      const encontrado = findMatchingScenarioItem(CARGADOS, {
        id: "fiscal-1-1",
        capacidad: "Cumplimiento",
        subcapacidad: "2.1 Calendario de obligaciones",
      });

      t.igual(encontrado?.id, "fiscal-1-1");
    },
  },
  {
    grupo: "Coincidencia de subcapacidad",
    nombre: "sin id se cae a capacidad + subcapacidad, sin distinguir acentos",
    ejecutar: (t) => {
      const encontrado = findMatchingScenarioItem(CARGADOS, {
        capacidad: "CONTABILIDAD Y PROVISION FISCAL",
        subcapacidad: "1.2 conciliación fiscal",
      });

      t.igual(encontrado?.id, "fiscal-1-2");
    },
  },
  {
    grupo: "Coincidencia de subcapacidad",
    nombre: "hacen falta las dos: la capacidad sola no basta",
    ejecutar: (t) => {
      // "Contabilidad y provision fiscal" tiene dos subcapacidades. Quedarse
      // con la primera seria inventarse cual.
      const encontrado = findMatchingScenarioItem(CARGADOS, {
        capacidad: "Contabilidad y provisión fiscal",
      });

      t.igual(encontrado, undefined);
    },
  },
  {
    grupo: "Coincidencia de subcapacidad",
    nombre: "una fila sin nada con que comparar no casa con ninguna",
    ejecutar: (t) => {
      t.igual(findMatchingScenarioItem(CARGADOS, {}), undefined, "fila vacia");
      t.igual(findMatchingScenarioItem(CARGADOS, null), null, "sin fila");
      t.igual(findMatchingScenarioItem(null, { id: "fiscal-1-1" }), null, "sin cargados");
    },
  },
  {
    grupo: "Coincidencia de subcapacidad",
    nombre: "los nombres de campo antiguos tambien casan",
    ejecutar: (t) => {
      t.igual(
        findMatchingScenarioItem(CARGADOS, { ID: "fiscal-2-1" })?.id,
        "fiscal-2-1",
        "ID en mayusculas",
      );

      t.igual(
        findMatchingScenarioItem(CARGADOS, {
          Capability: "Cumplimiento",
          Subcapability: "2.1 Calendario de obligaciones",
        })?.id,
        "fiscal-2-1",
        "en ingles",
      );
    },
  },
  {
    grupo: "Coincidencia de subcapacidad",
    nombre: "un id que no existe no arrastra a la primera subcapacidad",
    ejecutar: (t) => {
      t.igual(findMatchingScenarioItem(CARGADOS, { id: "inventado-9-9" }), undefined);
    },
  },

  // ------------------------------------------------ capacidades renombradas
  {
    grupo: "Capacidades renombradas",
    nombre: "una subcapacidad guardada sin id con los dos nombres antiguos se reconoce",
    ejecutar: (t) => {
      // En Tesoreria cambiaron a la vez la capacidad y su subcapacidad 1.1: un
      // escenario de antes de los ids las trae las dos con el nombre viejo.
      const tesoreria = [
        { id: "tesoreria-1-1", capacidad: "Control y tratamiento contable", subcapacidad: "1.1 Gobierno del tratamiento contable de operaciones de tesorería" },
        { id: "tesoreria-1-2", capacidad: "Control y tratamiento contable", subcapacidad: "1.2 Registro, conciliación y devengo de intereses y comisiones" },
      ];

      const encontrado = findMatchingScenarioItem(tesoreria, {
        capacidad: "Contabilidad y provisión fiscal",
        subcapacidad: "1.1 Gobierno contable-fiscal de operaciones de tesorería",
      });

      t.igual(encontrado?.id, "tesoreria-1-1", "los dos nombres antiguos");

      const soloLaCapacidad = findMatchingScenarioItem(tesoreria, {
        capacidad: "Contabilidad y provisión fiscal",
        subcapacidad: "1.2 Registro, conciliación y devengo de intereses y comisiones",
      });

      t.igual(soloLaCapacidad?.id, "tesoreria-1-2", "solo la capacidad con el nombre antiguo");
    },
  },
  {
    grupo: "Capacidades renombradas",
    nombre: "la subcapacidad antigua se traduce solo donde ya no existe",
    ejecutar: (t) => {
      const antigua = "1.1 Gobierno contable-fiscal de operaciones de tesorería";
      const nueva = "1.1 Gobierno del tratamiento contable de operaciones de tesorería";

      t.igual(subcapacidadVigente(antigua, [nueva]), nueva, "Tesoreria");
      t.igual(subcapacidadVigente(antigua, [antigua, nueva]), antigua, "si sigue existiendo, es ella");
      t.igual(subcapacidadVigente(antigua, ["1.1 Cálculo del impuesto"]), undefined, "en otro dominio no es nada");
    },
  },
  {
    grupo: "Capacidades renombradas",
    nombre: "el nombre antiguo se queda en su sitio donde sigue existiendo",
    ejecutar: (t) => {
      const cargadas = ["Contabilidad y provisión fiscal", "Cumplimiento"];

      t.igual(capacidadVigente("CONTABILIDAD Y PROVISION FISCAL", cargadas), "Contabilidad y provisión fiscal", "Fiscal");
      t.igual(capacidadVigente("Contabilidad y provisión fiscal", ["Control y tratamiento contable"]), "Control y tratamiento contable", "Tesoreria");
      t.igual(capacidadVigente("Contabilidad y provisión fiscal", ["Inversiones"]), undefined, "en otro dominio no es nada");
      t.igual(capacidadVigente("", cargadas), undefined, "sin nombre");
    },
  },
];

