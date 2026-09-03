/**
 * Pruebas del contrato de un escenario.
 *
 * Comprueban que nada que las reglas de la Realtime Database vayan a rechazar
 * pueda salir de aqui. Las reglas validan la escritura entera: un campo de mas
 * o un texto demasiado largo tumban el guardado completo, y el cambio se
 * pierde. Por eso lo que no encaja se recorta o se descarta, nunca se envia.
 *
 * Van con las del motor de calculo: /tests/ en el navegador, o
 * node tests/ejecutar.mjs desde la linea de comandos.
 */

import {
  CAMPOS_DE_AUTORIA,
  ESTADOS_VALIDOS,
  LIMITES_DE_TEXTO,
  normalizarAutoria,
  normalizarEscenarioParaFirebase,
  normalizarEstado,
  recortarAlLimite,
  revisarEscenario,
} from "../core/escenario.js";


/** Serializador de objetivos de mentira: aqui solo importa que se le llame. */
const targetsFijos = () => [
  { capacidad: "C", procesos: 4, tecnologia: 4, organizacion: 4 },
];

/** Un escenario minimo y correcto, sobre el que introducir cada problema. */
const escenarioSano = () => ({
  version: 3,
  activeDomainId: "fpa",
  updatedAt: "2026-09-03T10:00:00.000Z",
  domains: {
    fpa: {
      meta: { domainId: "fpa", targetMaturity: 4 },
      targets: [],
      items: [
        {
          id: "fpa-1-1",
          capacidad: "Presupuestos",
          subcapacidad: "1.1 Gobierno",
          scores: { procesos: 3, tecnologia: 2, organizacion: null },
          owner: "Ana",
          status: "En curso",
          comentario: "sin novedad",
        },
      ],
    },
  },
});

const normalizar = (payload) =>
  normalizarEscenarioParaFirebase(payload, targetsFijos);

const primerItem = (payload) =>
  Object.values(normalizar(payload).domains.fpa.items)[0];


export const casos = [
  // ------------------------------------------------------- que se rechaza
  {
    grupo: "Archivos que no son un escenario",
    nombre: "un archivo vacio, un numero o un texto no se aplican",
    ejecutar: (t) => {
      t.igual(revisarEscenario(null).valido, false, "null");
      t.igual(revisarEscenario(undefined).valido, false, "undefined");
      t.igual(revisarEscenario(42).valido, false, "un numero");
      t.igual(revisarEscenario("hola").valido, false, "un texto");
      t.igual(
        revisarEscenario(null).motivo.length > 0,
        true,
        "y se explica por que",
      );
    },
  },
  {
    grupo: "Archivos que no son un escenario",
    nombre: "un JSON de otra herramienta, sin subcapacidades, no se aplica",
    ejecutar: (t) => {
      const revision = revisarEscenario({ proyecto: "otro", filas: [1, 2, 3] });

      t.igual(revision.valido, false, "no es valido");
      t.igual(revision.subcapacidades, 0, "no ha encontrado subcapacidades");
    },
  },
  {
    grupo: "Archivos que no son un escenario",
    nombre: "un escenario correcto si se aplica, y se cuenta lo que trae",
    ejecutar: (t) => {
      const revision = revisarEscenario(escenarioSano());

      t.igual(revision.valido, true, "valido");
      t.igual(revision.subcapacidades, 1, "una subcapacidad");
      t.igual(revision.problemas.length, 0, "sin nada que corregir");
    },
  },
  {
    grupo: "Archivos que no son un escenario",
    nombre: "los formatos antiguos de un solo dominio se siguen aceptando",
    ejecutar: (t) => {
      const items = [{ id: "fpa-1-1", scores: { procesos: 3 } }];

      t.igual(revisarEscenario({ items }).valido, true, "items en la raiz");
      t.igual(
        revisarEscenario({ subcapacities: items }).valido,
        true,
        "subcapacities en la raiz",
      );
      t.igual(revisarEscenario(items).valido, true, "una lista suelta");
      t.igual(
        revisarEscenario({ state: { items } }).valido,
        true,
        "items dentro de state",
      );
    },
  },

  // ------------------------------------------------- que se avisa y corrige
  {
    grupo: "Lo que se corrige al importar",
    nombre: "un estado que no existe se avisa y no se aplica en silencio",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.items[0].status = "Inventado";

      const revision = revisarEscenario(payload);

      t.igual(revision.valido, true, "el archivo sigue siendo valido");
      t.igual(revision.problemas.length, 1, "un problema");
      t.igual(
        revision.problemas[0].includes("estado"),
        true,
        "y dice que va del estado",
      );
    },
  },
  {
    grupo: "Lo que se corrige al importar",
    nombre: "una puntuacion fuera del 1-5 se avisa",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.items[0].scores.procesos = 9;

      const revision = revisarEscenario(payload);

      t.igual(revision.problemas.length, 1, "un problema");
      t.igual(
        revision.problemas[0].includes("puntuacion"),
        true,
        "y dice que va de una puntuacion",
      );
    },
  },
  {
    grupo: "Lo que se corrige al importar",
    nombre: "un comentario demasiado largo se avisa antes de recortarlo",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.items[0].comentario = "x".repeat(2500);

      const revision = revisarEscenario(payload);

      t.igual(revision.problemas.length, 1, "un problema");
      t.igual(
        revision.problemas[0].includes("2000"),
        true,
        "y dice cual es el limite",
      );
    },
  },
  {
    grupo: "Lo que se corrige al importar",
    nombre: "los campos de mas se avisan, esten donde esten",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.campoExtraRaiz = 1;
      payload.domains.fpa.campoExtraDominio = 1;
      payload.domains.fpa.items[0].campoExtraItem = 1;

      const revision = revisarEscenario(payload);

      t.igual(revision.valido, true, "el archivo sigue siendo valido");
      t.igual(revision.problemas.length, 3, "uno por cada nivel");
    },
  },

  // ------------------------------------------------- que sale hacia Firebase
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "un estado que no existe no llega: se sustituye por No iniciado",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.items[0].status = "E".repeat(120);

      t.igual(primerItem(payload).status, "No iniciado");
      t.igual(normalizarEstado("En curso"), "En curso", "un estado valido pasa");
      t.igual(normalizarEstado(""), ESTADOS_VALIDOS[0], "vacio cae al primero");
      t.igual(normalizarEstado(null), ESTADOS_VALIDOS[0], "null cae al primero");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "la autoria viaja con sus tres campos y nada mas",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.items[0].lastEditedBy = {
        uid: "u1",
        nombre: "Ana",
        at: "2026-09-03T10:00:00.000Z",
        inventado: "campo que las reglas rechazan",
      };

      const autoria = primerItem(payload).lastEditedBy;

      t.igual(Object.keys(autoria).join(","), "uid,nombre,at", "solo los tres");
      t.igual(autoria.inventado, undefined, "el campo de mas no viaja");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "una autoria que no es un registro se descarta entera",
    ejecutar: (t) => {
      t.igual(normalizarAutoria("Ana"), null, "un texto no vale");
      t.igual(normalizarAutoria([1, 2]), null, "una lista no vale");
      t.igual(normalizarAutoria({}), null, "un registro vacio no vale");
      t.igual(normalizarAutoria(null), null, "null no vale");

      const payload = escenarioSano();
      payload.domains.fpa.items[0].lastEditedBy = "Ana";

      t.igual(
        primerItem(payload).lastEditedBy,
        undefined,
        "no se envia el campo",
      );
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "el nombre de quien edita se recorta al limite de las reglas",
    ejecutar: (t) => {
      const autoria = normalizarAutoria({
        uid: "u".repeat(200),
        nombre: "n".repeat(200),
        at: "a".repeat(200),
      });

      t.igual(autoria.uid.length, CAMPOS_DE_AUTORIA.uid);
      t.igual(autoria.nombre.length, CAMPOS_DE_AUTORIA.nombre);
      t.igual(autoria.at.length, CAMPOS_DE_AUTORIA.at);
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "los textos largos se recortan a lo que admiten las reglas",
    ejecutar: (t) => {
      const payload = escenarioSano();
      const item = payload.domains.fpa.items[0];
      item.owner = "o".repeat(500);
      item.comentario = "c".repeat(5000);
      item.subcapacidad = "s".repeat(500);

      const enviado = primerItem(payload);

      t.igual(enviado.owner.length, LIMITES_DE_TEXTO.owner);
      t.igual(enviado.comentario.length, LIMITES_DE_TEXTO.comentario);
      t.igual(enviado.subcapacidad.length, LIMITES_DE_TEXTO.subcapacidad);
      t.igual(recortarAlLimite("owner", null), "", "null se convierte en vacio");
      t.igual(recortarAlLimite("owner", 42), "42", "un numero se convierte");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "una puntuacion invalida viaja como null, nunca como 0 ni como 9",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.items[0].scores = {
        procesos: 9,
        tecnologia: 0,
        organizacion: "3",
      };

      const scores = primerItem(payload).scores;

      t.igual(scores.procesos, null, "9 no es valido");
      t.igual(scores.tecnologia, null, "0 no es valido");
      t.igual(scores.organizacion, 3, "el texto numerico si");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "los campos que las reglas no declaran no salen de aqui",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.campoExtraRaiz = "no";
      payload.domains.fpa.campoExtraDominio = { anidado: true };
      payload.domains.fpa.items[0].campoExtraItem = 42;

      const enviado = normalizar(payload);

      t.igual(
        Object.keys(enviado).sort().join(","),
        "activeDomainId,domains,updatedAt,version",
        "raiz",
      );
      t.igual(
        Object.keys(enviado.domains.fpa).sort().join(","),
        "items,meta,targets",
        "dominio",
      );
      t.igual(
        Object.keys(Object.values(enviado.domains.fpa.items)[0]).sort().join(","),
        "capacidad,comentario,id,owner,scores,status,subcapacidad",
        "subcapacidad",
      );
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "meta solo admite textos y numeros, no objetos anidados",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.meta = {
        domainId: "fpa",
        targetMaturity: 4,
        anidado: { no: "admitido" },
        larguisimo: "x".repeat(500),
      };

      const meta = normalizar(payload).domains.fpa.meta;

      t.igual(meta.domainId, "fpa", "el texto pasa");
      t.igual(meta.targetMaturity, 4, "el numero pasa");
      t.igual(meta.anidado, undefined, "el objeto anidado no pasa");
      t.igual(meta.larguisimo.length, 200, "el texto largo se recorta a 200");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "la version se fuerza a 3 y el escenario conserva su dominio activo",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.version = "no es un numero";

      const enviado = normalizar(payload);

      t.igual(enviado.version, 3, "version");
      t.igual(enviado.activeDomainId, "fpa", "dominio activo");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "los items se guardan con su id como clave, nunca por posicion",
    ejecutar: (t) => {
      // La forma que produce buildScenarioPayload(): indexado por id.
      const payload = escenarioSano();
      payload.domains.fpa.items = {
        "fpa-1-1": { id: "fpa-1-1", capacidad: "C", subcapacidad: "S1" },
        "fpa-2-3": { id: "fpa-2-3", capacidad: "C", subcapacidad: "S2" },
      };

      const items = normalizar(payload).domains.fpa.items;

      t.igual(Array.isArray(items), false, "no es una lista");
      t.igual(
        Object.keys(items).sort().join(","),
        "fpa-1-1,fpa-2-3",
        "las claves son los ids",
      );
      t.igual(items["fpa-2-3"].subcapacidad, "S2", "y apuntan a su item");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "una lista de items tambien sale indexada por id",
    ejecutar: (t) => {
      // Los escenarios antiguos y los archivos importados traen una lista. La
      // ruta de una escritura granular es la misma, asi que la clave tambien.
      const payload = escenarioSano();

      const items = normalizar(payload).domains.fpa.items;

      t.igual(Object.keys(items).join(","), "fpa-1-1", "clave por id");
      t.igual(items["fpa-1-1"].capacidad, "Presupuestos", "con su contenido");
    },
  },
  {
    grupo: "Lo que se envia a Firebase",
    nombre: "un item sin id utilizable se guarda por posicion antes que perderse",
    ejecutar: (t) => {
      const payload = escenarioSano();
      payload.domains.fpa.items = [
        { id: "fpa-1-1", capacidad: "C", subcapacidad: "S1" },
        { capacidad: "C", subcapacidad: "sin id" },
        { id: "con/barra", capacidad: "C", subcapacidad: "id que Firebase rechaza" },
      ];

      const items = normalizar(payload).domains.fpa.items;

      t.igual(Object.keys(items).sort().join(","), "1,2,fpa-1-1");
      t.igual(items["1"].subcapacidad, "sin id", "el que no tiene id sigue ahi");
      t.igual(
        items["2"].subcapacidad,
        "id que Firebase rechaza",
        "y el del id invalido tambien",
      );
    },
  },
];
