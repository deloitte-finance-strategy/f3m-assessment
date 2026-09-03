/**
 * Pruebas del motor de calculo F3M.
 *
 * Cubren lo que el README y CLAUDE.md describen como reglas de negocio: gap por
 * palanca, prioridad, oleada, nivel de madurez, subcapacidades pendientes y
 * agregacion por capacidad. Si alguien cambia una regla sin querer, esto falla.
 *
 * No dependen del DOM, ni de Firebase, ni de la aplicacion: solo del motor.
 * Se ejecutan con el resto: /tests/ en el navegador, o
 * node tests/ejecutar.mjs desde la linea de comandos.
 */

import {
  DEFAULT_TARGET_MATURITY,
  agregarPorCapacidad,
  average,
  calcularMetricas,
  getMaturityLevel,
  getMaturityLevelNumber,
  normalizeTargetValue,
  oleadaDesdePrioridad,
  priorityFromGap,
  round2,
  toScore,
  unique,
} from "../core/calculo.js";


// --- utilidades de los casos ------------------------------------------------

const objetivo = (procesos, tecnologia = procesos, organizacion = procesos) => ({
  procesos,
  tecnologia,
  organizacion,
});

const sub = (capacidad, procesos, tecnologia, organizacion) => ({
  capacidad,
  subcapacidad: capacidad + " - sub",
  scores: { procesos, tecnologia, organizacion },
});

/** Las metricas de un item suelto, con el objetivo que se le pase. */
const metricas = (scores, objetivos = objetivo(4)) =>
  calcularMetricas({ capacidad: "C", scores }, objetivos);

/** Agrega con objetivos fijos, como hace la aplicacion con los suyos. */
const agregar = (items, objetivos) =>
  agregarPorCapacidad(
    items,
    (item) => calcularMetricas(item, objetivos),
    () => objetivos,
  );


// --- los casos --------------------------------------------------------------

export const casos = [
  // ------------------------------------------------------------------- gap
  {
    grupo: "Gap por palanca",
    nombre: "el caso del README: objetivo 4 y scores [3, 2, 5] dan gap 1, no 0,67",
    ejecutar: (t) => {
      const m = metricas({ procesos: 3, tecnologia: 2, organizacion: 5 });

      // Gaps por palanca: 1, 2 y 0 (recortado). Promedio: 1.
      t.igual(m.gaps.procesos, 1, "gap de procesos");
      t.igual(m.gaps.tecnologia, 2, "gap de tecnologia");
      t.igual(m.gaps.organizacion, 0, "gap de organizacion, recortado a 0");
      t.igual(m.gap, 1, "gap del item");
      t.igual(m.prioridad, "Media", "prioridad");
      t.igual(m.oleada, "Oleada 2", "oleada");
      t.igual(m.scoreMedio, 3.33, "score medio");
      t.igual(m.nivel, "3 - Estandarizado", "nivel");
    },
  },
  {
    grupo: "Gap por palanca",
    nombre: "estar por encima del objetivo no compensa estar por debajo",
    ejecutar: (t) => {
      // Sin el recorte a 0, el gap medio seria (2 + (-1)) / 2 = 0,5, y la
      // prioridad bajaria de Media a Baja.
      const m = metricas({ procesos: 2, tecnologia: 5, organizacion: null });

      t.igual(m.gaps.tecnologia, 0, "la palanca por encima del objetivo aporta 0");
      t.igual(m.gap, 1, "gap del item");
      t.igual(m.prioridad, "Media", "prioridad");
    },
  },
  {
    grupo: "Gap por palanca",
    nombre: "cada palanca se mide contra SU objetivo, no contra uno unico",
    ejecutar: (t) => {
      const m = metricas(
        { procesos: 3, tecnologia: 3, organizacion: 3 },
        objetivo(3, 5, 4),
      );

      t.igual(m.gaps.procesos, 0, "objetivo 3");
      t.igual(m.gaps.tecnologia, 2, "objetivo 5");
      t.igual(m.gaps.organizacion, 1, "objetivo 4");
      t.igual(m.gap, 1, "gap del item");
      t.igual(m.targetMedio, 4, "objetivo medio");
    },
  },

  // --------------------------------------------------------- sin puntuar
  {
    grupo: "Palancas sin puntuar",
    nombre: "solo entran en los promedios las palancas con score informado",
    ejecutar: (t) => {
      const m = metricas({ procesos: 2, tecnologia: null, organizacion: null });

      t.igual(m.isPending, false, "no esta pendiente: tiene una palanca");
      t.igual(m.scoreMedio, 2, "score medio: solo procesos");
      t.igual(m.targetMedio, 4, "objetivo medio: solo el de procesos");
      t.igual(m.gap, 2, "gap: solo el de procesos");
      t.igual(m.gaps.tecnologia, null, "la palanca sin puntuar no tiene gap");
      t.igual(m.prioridad, "Alta", "prioridad");
      t.igual(m.oleada, "Oleada 1", "oleada");
    },
  },
  {
    grupo: "Palancas sin puntuar",
    nombre: "un item sin ninguna palanca puntuada queda pendiente",
    ejecutar: (t) => {
      const m = metricas({ procesos: null, tecnologia: null, organizacion: null });

      t.igual(m.isPending, true, "pendiente");
      t.igual(m.scoreMedio, null, "sin score medio");
      t.igual(m.targetMedio, null, "sin objetivo medio");
      t.igual(m.gap, null, "sin gap");
      t.igual(m.nivel, "", "sin nivel");
      t.igual(m.prioridad, "Pendiente", "no se inventa una prioridad");
      t.igual(m.oleada, "Pendiente", "no se inventa una oleada");
    },
  },
  {
    grupo: "Palancas sin puntuar",
    nombre: "un 0 o un 6 no son puntuaciones: valen como sin puntuar",
    ejecutar: (t) => {
      t.igual(toScore(0), null, "0 no es valido");
      t.igual(toScore(6), null, "6 no es valido");
      t.igual(toScore(2.5), null, "los decimales no son validos");
      t.igual(toScore(""), null, "vacio no es valido");
      t.igual(toScore(null), null, "null no es valido");
      t.igual(toScore("tres"), null, "el texto no numerico no es valido");
      t.igual(toScore("3"), 3, "el texto numerico si");
      t.igual(toScore(1), 1, "1 es el minimo");
      t.igual(toScore(5), 5, "5 es el maximo");
    },
  },

  // ----------------------------------------------------------- prioridad
  {
    grupo: "Prioridad y oleada",
    nombre: "los umbrales son gap >= 2 Alta, >= 1 Media, resto Baja",
    ejecutar: (t) => {
      t.igual(priorityFromGap(2), "Alta", "justo en 2");
      t.igual(priorityFromGap(1.99), "Media", "justo por debajo de 2");
      t.igual(priorityFromGap(1), "Media", "justo en 1");
      t.igual(priorityFromGap(0.99), "Baja", "justo por debajo de 1");
      t.igual(priorityFromGap(0), "Baja", "sin gap");
      t.igual(priorityFromGap(null), "Pendiente", "sin gap calculable");
      t.igual(priorityFromGap(NaN), "Pendiente", "NaN no es un gap");
    },
  },
  {
    grupo: "Prioridad y oleada",
    nombre: "cada prioridad cae en su oleada",
    ejecutar: (t) => {
      t.igual(oleadaDesdePrioridad("Alta"), "Oleada 1");
      t.igual(oleadaDesdePrioridad("Media"), "Oleada 2");
      t.igual(oleadaDesdePrioridad("Baja"), "Oleada 3");
      t.igual(oleadaDesdePrioridad("Pendiente"), "Pendiente");
    },
  },

  // --------------------------------------------------------------- nivel
  {
    grupo: "Nivel de madurez",
    nombre: "los cinco tramos y sus fronteras",
    ejecutar: (t) => {
      t.igual(getMaturityLevel(1), "1 - Inicial");
      t.igual(getMaturityLevel(1.49), "1 - Inicial");
      t.igual(getMaturityLevel(1.5), "2 - Estructurado");
      t.igual(getMaturityLevel(2.49), "2 - Estructurado");
      t.igual(getMaturityLevel(2.5), "3 - Estandarizado");
      t.igual(getMaturityLevel(3.49), "3 - Estandarizado");
      t.igual(getMaturityLevel(3.5), "4 - Optimizado");
      t.igual(getMaturityLevel(4.49), "4 - Optimizado");
      t.igual(getMaturityLevel(4.5), "5 - Avanzado/Referente");
      t.igual(getMaturityLevel(5), "5 - Avanzado/Referente");
    },
  },
  {
    grupo: "Nivel de madurez",
    nombre: "el nivel numerico del radar se acota entre 1 y 5",
    ejecutar: (t) => {
      t.igual(getMaturityLevelNumber(1.2), 1);
      t.igual(getMaturityLevelNumber(3.5), 4, "redondeo al alza");
      t.igual(getMaturityLevelNumber(0.2), 1, "nunca por debajo de 1");
      t.igual(getMaturityLevelNumber(9), 5, "nunca por encima de 5");
      t.igual(getMaturityLevelNumber(null), null, "sin score no hay nivel");
    },
  },

  // ----------------------------------------------------------- objetivos
  {
    grupo: "Objetivos",
    nombre: "un objetivo invalido cae al de respaldo y no rompe el calculo",
    ejecutar: (t) => {
      t.igual(normalizeTargetValue(3), 3, "entero valido");
      t.igual(normalizeTargetValue(0), DEFAULT_TARGET_MATURITY, "0 no vale");
      t.igual(normalizeTargetValue(6), DEFAULT_TARGET_MATURITY, "6 no vale");
      t.igual(normalizeTargetValue(undefined), DEFAULT_TARGET_MATURITY, "vacio");
      t.igual(normalizeTargetValue("x", 2), 2, "respaldo explicito");

      const m = metricas(
        { procesos: 1, tecnologia: null, organizacion: null },
        { procesos: "no es un numero" },
      );

      t.igual(m.gap, 3, "cae al objetivo por defecto, 4");
    },
  },

  // ---------------------------------------------------------- agregacion
  {
    grupo: "Agregacion por capacidad",
    nombre: "las medias por palanca usan todas las subcapacidades puntuadas",
    ejecutar: (t) => {
      const items = [
        sub("Presupuestos", 4, 2, null),
        sub("Presupuestos", 2, null, null),
        sub("Presupuestos", null, null, null),
      ];

      const [c] = agregar(items, objetivo(4));

      t.igual(c.procesos, 3, "media de procesos: 4 y 2");
      t.igual(c.tecnologia, 2, "media de tecnologia: un solo valor");
      t.igual(c.organizacion, null, "sin ningun valor, no hay media");
      t.igual(c.total, 3, "subcapacidades de la capacidad");
      t.igual(c.evaluadas, 2, "cuantas tienen alguna palanca puntuada");
    },
  },
  {
    grupo: "Agregacion por capacidad",
    nombre: "lo pendiente no entra en score medio, objetivo ni gap",
    ejecutar: (t) => {
      const items = [
        sub("Cierre", 2, 2, 2),
        sub("Cierre", null, null, null),
      ];

      const [c] = agregar(items, objetivo(4));

      t.igual(c.scoreMedio, 2, "score medio de la unica puntuada");
      t.igual(c.targetMedio, 4, "objetivo medio de la unica puntuada");
      t.igual(c.gap, 2, "gap de la unica puntuada");
      t.igual(c.prioridad, "Alta", "prioridad de la capacidad");
    },
  },
  {
    grupo: "Agregacion por capacidad",
    nombre: "una capacidad entera sin puntuar queda pendiente",
    ejecutar: (t) => {
      const [c] = agregar([sub("Fiscal", null, null, null)], objetivo(4));

      t.igual(c.scoreMedio, null, "sin score medio");
      t.igual(c.gap, null, "sin gap");
      t.igual(c.prioridad, "Pendiente", "no se inventa una prioridad");
      t.igual(c.evaluadas, 0, "ninguna evaluada");
      t.igual(c.total, 1, "una subcapacidad");
    },
  },
  {
    grupo: "Agregacion por capacidad",
    nombre: "cada capacidad se agrega por separado y en orden de aparicion",
    ejecutar: (t) => {
      const items = [
        sub("Presupuestos", 1, 1, 1),
        sub("Cierre", 5, 5, 5),
        sub("Presupuestos", 3, 3, 3),
      ];

      const agregadas = agregar(items, objetivo(4));

      t.igual(agregadas.length, 2, "dos capacidades");
      t.igual(agregadas[0].capacidad, "Presupuestos", "orden de aparicion");
      t.igual(agregadas[1].capacidad, "Cierre", "orden de aparicion");
      t.igual(agregadas[0].items.length, 2, "las dos de Presupuestos");
      t.igual(agregadas[0].scoreMedio, 2, "media de 1 y 3");
      t.igual(agregadas[0].gap, 2, "gaps de item 3 y 1");
      t.igual(agregadas[1].gap, 0, "por encima del objetivo, gap 0");
      t.igual(agregadas[1].prioridad, "Baja");
    },
  },
  {
    grupo: "Agregacion por capacidad",
    nombre: "el gap de la capacidad promedia gaps de item, no scores",
    ejecutar: (t) => {
      // Dos items, uno con gap 3 y otro con gap 0. El score medio de la
      // capacidad es 3, que contra objetivo 4 daria un gap de 1. El correcto
      // es 1,5, y cambia la prioridad.
      const items = [
        sub("Tesoreria", 1, 1, 1),
        sub("Tesoreria", 5, 5, 5),
      ];

      const [c] = agregar(items, objetivo(4));

      t.igual(c.scoreMedio, 3, "score medio");
      t.igual(c.gap, 1.5, "promedio de gaps de item, no 4 - scoreMedio");
      t.igual(c.prioridad, "Media");
    },
  },
  {
    grupo: "Agregacion por capacidad",
    nombre: "sin subcapacidades no hay capacidades que agregar",
    ejecutar: (t) => {
      t.igual(agregar([], objetivo(4)).length, 0);
    },
  },

  // ----------------------------------------------------------- aritmetica
  {
    grupo: "Aritmetica",
    nombre: "average ignora lo no numerico y devuelve null si no queda nada",
    ejecutar: (t) => {
      t.igual(average([1, 2, 3]), 2);
      t.igual(average([1, null, 3]), 2, "null no cuenta");
      t.igual(average([]), null, "lista vacia");
      t.igual(average([null, undefined, NaN]), null, "nada numerico");
      t.igual(average([1, 2]), 1.5, "decimales");
      t.igual(average([1, 1, 2]), 1.33, "redondeado a dos decimales");
    },
  },
  {
    grupo: "Aritmetica",
    nombre: "round2 redondea a dos decimales sin error de coma flotante",
    ejecutar: (t) => {
      t.igual(round2(1.005), 1.01, "el caso clasico de coma flotante");
      t.igual(round2(2.675), 2.68);
      t.igual(round2(3), 3);
    },
  },
  {
    grupo: "Aritmetica",
    nombre: "unique conserva el orden de aparicion",
    ejecutar: (t) => {
      t.igual(unique(["b", "a", "b", "c"]).join(","), "b,a,c");
    },
  },
];
