/**
 * Los objetivos por capacidad y palanca.
 *
 * Son la mitad de todo gap que ensena la herramienta. Un fallo aqui no rompe
 * nada: calcula mal, y en silencio.
 */

import {
  createDefaultTargets,
  normalizeDomainTargets,
  serializeTargetsForFirebase,
} from "../core/objetivos.js?v=11";


const ITEMS = [
  { id: "f-1-1", capacidad: "Contabilidad y provisión fiscal" },
  { id: "f-1-2", capacidad: "Contabilidad y provisión fiscal" },
  { id: "f-2-1", capacidad: "Cumplimiento" },
];


export const casos = [
  // -------------------------------------------------------- por defecto
  {
    grupo: "Objetivos por defecto",
    nombre: "una entrada por capacidad, no por subcapacidad",
    ejecutar: (t) => {
      const targets = createDefaultTargets(ITEMS);

      t.igual(Object.keys(targets).length, 2, "dos capacidades de tres items");
      t.igual(targets["Cumplimiento"].procesos, 4, "el objetivo base");
      t.igual(targets["Cumplimiento"].tecnologia, 4);
      t.igual(targets["Cumplimiento"].organizacion, 4);
    },
  },
  {
    grupo: "Objetivos por defecto",
    nombre: "el objetivo base del dominio manda sobre el del modelo",
    ejecutar: (t) => {
      // meta.targetMaturity viaja en cada JSON de dominio: hoy los nueve lo
      // traen a 4, pero es configuracion, no una constante del modelo.
      t.igual(createDefaultTargets(ITEMS, 3)["Cumplimiento"].procesos, 3);
    },
  },
  {
    grupo: "Objetivos por defecto",
    nombre: "sin subcapacidades no hay objetivos que inventar",
    ejecutar: (t) => {
      t.igual(Object.keys(createDefaultTargets([])).length, 0);
    },
  },

  // ------------------------------------------------------ objetivos guardados
  {
    grupo: "Objetivos guardados",
    nombre: "se parte de los de por defecto y se pisan los que vengan",
    ejecutar: (t) => {
      const targets = normalizeDomainTargets(ITEMS, [
        { capacidad: "Cumplimiento", procesos: 2, tecnologia: 3, organizacion: 5 },
      ]);

      t.igual(targets["Cumplimiento"].procesos, 2, "el guardado");
      t.igual(targets["Cumplimiento"].organizacion, 5);
      t.igual(targets["Contabilidad y provisión fiscal"].procesos, 4, "la otra conserva el base");
    },
  },
  {
    grupo: "Objetivos guardados",
    nombre: "una capacidad guardada que ya no existe se ignora",
    ejecutar: (t) => {
      // Si se anadiera, apareceria en la tabla de objetivos una capacidad que
      // no tiene ninguna subcapacidad detras.
      const targets = normalizeDomainTargets(ITEMS, [
        { capacidad: "Capacidad retirada", procesos: 1 },
      ]);

      t.igual(Object.keys(targets).length, 2);
      t.igual(targets["Capacidad retirada"], undefined);
    },
  },
  {
    grupo: "Objetivos guardados",
    nombre: "casan aunque cambien mayusculas y acentos",
    ejecutar: (t) => {
      const targets = normalizeDomainTargets(ITEMS, [
        { capacidad: "CONTABILIDAD Y PROVISION FISCAL", procesos: 1 },
      ]);

      t.igual(targets["Contabilidad y provisión fiscal"].procesos, 1);
    },
  },
  {
    grupo: "Objetivos guardados",
    nombre: "tambien se aceptan indexados por capacidad, como en Firebase",
    ejecutar: (t) => {
      const targets = normalizeDomainTargets(ITEMS, {
        Cumplimiento: { procesos: 2, tecnologia: 2, organizacion: 2 },
      });

      t.igual(targets["Cumplimiento"].procesos, 2);
    },
  },
  {
    grupo: "Objetivos guardados",
    nombre: "una clave codificada se descodifica antes de comparar",
    ejecutar: (t) => {
      // El nombre de la capacidad puede llevar caracteres que Firebase no
      // admite en una ruta, asi que pudo guardarse codificado.
      const targets = normalizeDomainTargets(ITEMS, {
        [encodeURIComponent("Contabilidad y provisión fiscal")]: { procesos: 5 },
      });

      t.igual(targets["Contabilidad y provisión fiscal"].procesos, 5);
    },
  },
  {
    grupo: "Objetivos guardados",
    nombre: "un objetivo fuera del 1-5 cae al base y no rompe el calculo",
    ejecutar: (t) => {
      const targets = normalizeDomainTargets(ITEMS, [
        { capacidad: "Cumplimiento", procesos: 0, tecnologia: 9, organizacion: 2.5 },
      ]);

      t.igual(targets["Cumplimiento"].procesos, 4, "el 0 no es un objetivo");
      t.igual(targets["Cumplimiento"].tecnologia, 4, "el 9 tampoco");
      t.igual(targets["Cumplimiento"].organizacion, 4, "ni un decimal");
    },
  },
  {
    grupo: "Objetivos guardados",
    nombre: "una entrada sin capacidad no se aplica a nadie",
    ejecutar: (t) => {
      const targets = normalizeDomainTargets(ITEMS, [{ procesos: 1 }]);

      t.igual(targets["Cumplimiento"].procesos, 4);
      t.igual(targets["Contabilidad y provisión fiscal"].procesos, 4);
    },
  },

  // ------------------------------------------------------- hacia Firebase
  {
    grupo: "Objetivos hacia Firebase",
    nombre: "salen como lista de registros con capacidad y tres palancas",
    ejecutar: (t) => {
      const lista = serializeTargetsForFirebase(ITEMS, {
        Cumplimiento: { procesos: 2, tecnologia: 3, organizacion: 4 },
      });

      t.igual(lista.length, 2, "una por capacidad");

      const cumplimiento = lista.find((fila) => fila.capacidad === "Cumplimiento");

      t.igual(cumplimiento.procesos, 2);
      t.igual(cumplimiento.tecnologia, 3);
      t.igual(cumplimiento.organizacion, 4);
      t.igual(Object.keys(cumplimiento).join(","), "capacidad,procesos,tecnologia,organizacion", "sin campos de mas");
    },
  },
  {
    grupo: "Objetivos hacia Firebase",
    nombre: "un valor invalido nunca llega a las reglas",
    ejecutar: (t) => {
      // Las reglas rechazan la escritura ENTERA si un objetivo no esta entre 1
      // y 5, no solo ese campo: un archivo importado con basura tumbaria el
      // guardado del escenario completo.
      const lista = serializeTargetsForFirebase(ITEMS, [
        { capacidad: "Cumplimiento", procesos: "tres", tecnologia: null, organizacion: 99 },
      ]);

      const cumplimiento = lista.find((fila) => fila.capacidad === "Cumplimiento");

      t.igual(cumplimiento.procesos, 4);
      t.igual(cumplimiento.tecnologia, 4);
      t.igual(cumplimiento.organizacion, 4);
    },
  },
];
