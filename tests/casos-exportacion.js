/**
 * El CSV que se abre en Excel y se le envia al cliente.
 *
 * Aqui casi todo protege contra algo que se vio fallar: numeros que llegaban
 * como texto, acentos ilegibles, columnas volcadas en una celda y comentarios
 * que Excel evaluaba como formulas.
 */

import {
  CSV_BOM,
  csvEscape,
  filasDeResumen,
  filasDeRoadmap,
  toCsv,
} from "../core/exportacion.js?v=11";


/** Una capacidad agregada, en la forma que devuelve agregarPorCapacidad(). */
const capacidad = (extra = {}) => ({
  capacidad: "Cumplimiento",
  procesos: 3,
  tecnologia: 2,
  organizacion: 4,
  scoreMedio: 3,
  targetMedio: 4,
  gap: 1,
  prioridad: "Media",
  objetivos: { procesos: 4, tecnologia: 4, organizacion: 4 },
  ...extra,
});


export const casos = [
  // -------------------------------------------------- numeros para Excel
  {
    grupo: "Numeros para Excel en espanol",
    nombre: "coma decimal, para que Excel los lea como numeros y no como texto",
    ejecutar: (t) => {
      // Con punto llegaban como TEXTO: no se podian sumar, ni ordenar, ni
      // llevar a una tabla dinamica.
      t.igual(csvEscape(3.17), "3,17");
      t.igual(csvEscape(2), "2");
      t.igual(csvEscape(0), "0", "el cero es un numero, no un vacio");
    },
  },
  {
    grupo: "Numeros para Excel en espanol",
    nombre: "sin separador de miles, que volveria a romper la lectura",
    ejecutar: (t) => {
      t.igual(csvEscape(1234.5), "1234,5");
    },
  },
  {
    grupo: "Numeros para Excel en espanol",
    nombre: "lo que no es un numero finito se trata como texto",
    ejecutar: (t) => {
      t.igual(csvEscape(NaN), "NaN");
      t.igual(csvEscape(null), "", "null es celda vacia");
      t.igual(csvEscape(undefined), "", "undefined tambien");
    },
  },

  // ------------------------------------------------ inyeccion de formulas
  {
    grupo: "Inyeccion de formulas",
    nombre: "una celda que empieza por =, +, - o @ se marca como texto",
    ejecutar: (t) => {
      // Se evaluarian al abrir el archivo, y estos CSV se abren en el equipo
      // del consultor y se le envian al cliente. En un escenario compartido,
      // cualquiera con el enlace puede dejar ese comentario.
      t.igual(csvEscape("=HYPERLINK(http://x)"), "'=HYPERLINK(http://x)");
      t.igual(csvEscape("+1"), "'+1");
      t.igual(csvEscape("@SUM(A1)"), "'@SUM(A1)");
      t.igual(csvEscape("\tcon tabulador"), "'\tcon tabulador");
    },
  },
  {
    grupo: "Inyeccion de formulas",
    nombre: "un comentario que empieza por guion sale como se escribio",
    ejecutar: (t) => {
      // Sin esto, "- Falta gobierno" se ensenaba como #NAME?.
      t.igual(csvEscape("- Falta gobierno"), "'- Falta gobierno");
    },
  },
  {
    grupo: "Inyeccion de formulas",
    nombre: "un numero negativo no pasa por la proteccion: es un numero",
    ejecutar: (t) => {
      t.igual(csvEscape(-1.5), "-1,5");
    },
  },

  // ----------------------------------------------------------- entrecomillado
  {
    grupo: "Entrecomillado",
    nombre: "se entrecomilla por punto y coma, comillas y saltos de linea",
    ejecutar: (t) => {
      t.igual(csvEscape("a;b"), '"a;b"', "el separador");
      t.igual(csvEscape('dijo "hola"'), '"dijo ""hola"""', "comillas dobladas");
      t.igual(csvEscape("dos\nlineas"), '"dos\nlineas"', "salto de linea");
    },
  },
  {
    grupo: "Entrecomillado",
    nombre: "la coma NO obliga a entrecomillar",
    ejecutar: (t) => {
      // Entrecomillar "3,17" hacia que Excel volviera a tratarlo como texto,
      // que es justo lo que la coma decimal venia a arreglar.
      t.igual(csvEscape("3,17"), "3,17");
    },
  },

  // ------------------------------------------------------------- el archivo
  {
    grupo: "El archivo",
    nombre: "empieza por la marca de orden de bytes y separa con CRLF",
    ejecutar: (t) => {
      // Sin la marca, Excel abre el archivo como ANSI y "Tecnología" llega
      // ilegible.
      const csv = toCsv([{ a: 1, b: 2 }]);

      t.igual(csv.startsWith(CSV_BOM), true, "marca de orden de bytes");
      t.igual(csv.slice(1), "a;b\r\n1;2", "cabecera y fila, con CRLF");
    },
  },
  {
    grupo: "El archivo",
    nombre: "sin filas no se genera archivo",
    ejecutar: (t) => {
      t.igual(toCsv([]), "");
    },
  },

  // ---------------------------------------------------------- las dos filas
  {
    grupo: "Las dos clases de fila",
    nombre: "resumen y detalle declaran las MISMAS columnas y en el mismo orden",
    ejecutar: (t) => {
      // toCsv() toma la cabecera de la primera fila: una clave de menos en el
      // resumen desplazaria todas las columnas del detalle una posicion.
      const resumen = filasDeResumen([capacidad()])[0];

      const detalle = filasDeRoadmap([
        {
          item: {
            capacidad: "Cumplimiento",
            subcapacidad: "2.1 Calendario",
            scores: { procesos: 3, tecnologia: 2, organizacion: 4 },
            iniciativaSugerida: "Definir calendario",
            owner: "Ana",
            status: "En curso",
            comentario: "",
          },
          metrics: {
            targets: { procesos: 4, tecnologia: 4, organizacion: 4 },
            scoreMedio: 3,
            targetMedio: 4,
            nivel: "3 - Estandarizado",
            gap: 1,
            prioridad: "Media",
            oleada: "Oleada 2",
          },
        },
      ])[0];

      t.igual(Object.keys(detalle).join("|"), Object.keys(resumen).join("|"));
    },
  },
  {
    grupo: "Las dos clases de fila",
    nombre: "el resumen deja en blanco lo que es de subcapacidad",
    ejecutar: (t) => {
      const fila = filasDeResumen([capacidad()])[0];

      t.igual(fila.Tipo, "Resumen");
      t.igual(fila.Subcapacidad, "");
      t.igual(fila.Oleada, "");
      t.igual(fila.Owner, "");
      t.igual(fila.Nivel, "3 - Estandarizado", "el nivel si sale");
    },
  },
  {
    grupo: "Las dos clases de fila",
    nombre: "una capacidad sin puntuar sale vacia, no a cero",
    ejecutar: (t) => {
      // Un 0 se leeria como "evaluada y con la peor nota posible", que es
      // distinto de "todavia no se ha evaluado".
      const fila = filasDeResumen([
        capacidad({
          procesos: null,
          tecnologia: null,
          organizacion: null,
          scoreMedio: null,
          targetMedio: null,
          gap: null,
          prioridad: "Pendiente",
        }),
      ])[0];

      t.igual(fila.Procesos, "");
      t.igual(fila.ScoreMedio, "");
      t.igual(fila.Gap, "");
      t.igual(fila.Nivel, "", "sin score no se inventa un nivel");
      t.igual(fila.Prioridad, "Pendiente");
    },
  },
  {
    grupo: "Las dos clases de fila",
    nombre: "el objetivo del detalle sale de las metricas, no del item",
    ejecutar: (t) => {
      const fila = filasDeRoadmap([
        {
          item: {
            capacidad: "C",
            subcapacidad: "S",
            scores: { procesos: null, tecnologia: null, organizacion: null },
            iniciativaSugerida: "",
            owner: "",
            status: "No iniciado",
            comentario: "",
          },
          metrics: {
            targets: { procesos: 2, tecnologia: 3, organizacion: 5 },
            scoreMedio: null,
            targetMedio: null,
            nivel: "",
            gap: null,
            prioridad: "Pendiente",
            oleada: "Pendiente",
          },
        },
      ])[0];

      t.igual(fila.ObjetivoProcesos, 2);
      t.igual(fila.ObjetivoTecnologia, 3);
      t.igual(fila.ObjetivoOrganizacion, 5);
      t.igual(fila.Procesos, "", "sin puntuar, vacio");
    },
  },
];
