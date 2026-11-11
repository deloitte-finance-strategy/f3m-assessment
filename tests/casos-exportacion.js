/**
 * El CSV que se abre en Excel y se le envia al cliente.
 *
 * Aqui casi todo protege contra algo que se vio fallar: numeros que llegaban
 * como texto, acentos ilegibles, columnas volcadas en una celda y comentarios
 * que Excel evaluaba como formulas.
 */

import {
  CSV_BOM,
  TIPO_DE_FILA,
  csvEscape,
  filasDeDominio,
  filasDelProyecto,
  filasDeResumen,
  filasDeRoadmap,
  toCsv,
} from "../core/exportacion.js?v=37";


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
  evaluadas: 3,
  total: 4,
  ...extra,
});


/** Un dominio agregado, en la forma que devuelve agregarPorDominio(). */
const dominio = (extra = {}) => ({
  id: "fiscal",
  label: "Fiscal",
  procesos: 3,
  tecnologia: 2,
  organizacion: 3.5,
  objetivoProcesos: 4,
  objetivoTecnologia: 4.2,
  objetivoOrganizacion: 4,
  scoreMedio: 2.83,
  targetMedio: 4.07,
  gap: 1.24,
  prioridad: "Media",
  evaluadas: 12,
  total: 16,
  ...extra,
});


/** Una subcapacidad con sus metricas, en la forma [{ item, metrics }]. */
const entrada = (extra = {}) => ({
  item: {
    capacidad: "Cumplimiento",
    subcapacidad: "2.1 Calendario",
    scores: { procesos: 3, tecnologia: 2, organizacion: 4 },
    iniciativaSugerida: "Definir calendario",
    owner: "Ana",
    status: "En curso",
    comentario: "",
    ...extra,
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

      t.igual(fila.Tipo, "Capacidad", "la fila dice lo que es");
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

  // ------------------------------------------------- lo que lee el cliente
  {
    grupo: "Lo que lee el cliente",
    nombre: "la cabecera sale con tildes y espacios, no con nombres de codigo",
    ejecutar: (t) => {
      // Salia «Tecnologia», «ObjetivoOrganizacion», «ScoreMedio» y «Owner», y
      // ese archivo se le envia al cliente.
      const cabecera = toCsv(filasDeResumen([capacidad()], "Fiscal")).slice(1).split("\r\n")[0];

      t.igual(
        cabecera,
        "Tipo;Dominio;Capacidad;Subcapacidad;Puntuadas;Subcapacidades;"
          + "Procesos;Objetivo Procesos;Tecnología;Objetivo Tecnología;Organización;Objetivo Organización;"
          + "Score medio;Objetivo medio;Nivel;Gap;Prioridad;Oleada;Iniciativa sugerida;Responsable;Estado;Comentarios",
      );
    },
  },
  {
    grupo: "Lo que lee el cliente",
    nombre: "las claves de las filas no cambian: los radares las leen",
    ejecutar: (t) => {
      const fila = filasDeResumen([capacidad()])[0];

      t.igual(fila.Tecnologia, 2);
      t.igual(fila.ObjetivoTecnologia, 4);
      t.igual(fila.Capacidad, "Cumplimiento");
    },
  },
  {
    grupo: "Lo que lee el cliente",
    nombre: "cada fila dice de que dominio es, y sin dominio queda en blanco",
    ejecutar: (t) => {
      // Antes solo lo decia el nombre del archivo: al juntar dos en una hoja
      // ya no se sabia de cual era cada fila.
      t.igual(filasDeResumen([capacidad()], "Fiscal")[0].Dominio, "Fiscal");
      t.igual(filasDeRoadmap([entrada()], "Fiscal")[0].Dominio, "Fiscal");
      t.igual(filasDeResumen([capacidad()])[0].Dominio, "");
    },
  },
  {
    grupo: "Lo que lee el cliente",
    nombre: "el resumen dice cuantas subcapacidades hay puntuadas, como la tabla",
    ejecutar: (t) => {
      const resumen = filasDeResumen([capacidad()])[0];

      t.igual(resumen.Puntuadas, 3);
      t.igual(resumen.TotalDeSubcapacidades, 4);
      t.igual(filasDeRoadmap([entrada()])[0].Puntuadas, "", "en una subcapacidad no aplica");
    },
  },
  {
    grupo: "Lo que lee el cliente",
    nombre: "una capacidad sin nada puntuado dice 0 puntuadas, no un vacio",
    ejecutar: (t) => {
      const fila = filasDeResumen([capacidad({ evaluadas: 0 })])[0];

      t.igual(fila.Puntuadas, 0);
      t.igual(toCsv([fila]).split("\r\n")[1].split(";")[4], "0");
    },
  },

  // --------------------------------------------------- todo el proyecto
  {
    grupo: "El archivo de todo el proyecto",
    nombre: "la fila de dominio lleva las cifras del Overview",
    ejecutar: (t) => {
      const fila = filasDeDominio([dominio()])[0];

      t.igual(fila.Tipo, TIPO_DE_FILA.dominio);
      t.igual(fila.Dominio, "Fiscal");
      t.igual(fila.Capacidad, "");
      t.igual(fila.Puntuadas, 12);
      t.igual(fila.TotalDeSubcapacidades, 16);
      t.igual(fila.ObjetivoTecnologia, 4.2, "el objetivo medio de la palanca, aunque no sea entero");
      t.igual(fila.Nivel, "3 - Estandarizado");
      t.igual(fila.Gap, 1.24);
      t.igual(fila.Prioridad, "Media");
    },
  },
  {
    grupo: "El archivo de todo el proyecto",
    nombre: "un dominio sin empezar sale vacio y pendiente, no a cero",
    ejecutar: (t) => {
      const fila = filasDeDominio([
        dominio({
          procesos: null,
          tecnologia: null,
          organizacion: null,
          scoreMedio: null,
          targetMedio: null,
          gap: null,
          prioridad: "Pendiente",
          evaluadas: 0,
        }),
      ])[0];

      t.igual(fila.ScoreMedio, "");
      t.igual(fila.Nivel, "");
      t.igual(fila.Gap, "");
      t.igual(fila.Puntuadas, 0);
      t.igual(fila.Prioridad, "Pendiente");
      t.igual(fila.ObjetivoProcesos, 4, "el objetivo es configuracion: sale aunque no haya nada puntuado");
    },
  },
  {
    grupo: "El archivo de todo el proyecto",
    nombre: "primero los dominios, despues las capacidades y despues las subcapacidades",
    ejecutar: (t) => {
      const filas = filasDelProyecto([
        {
          label: "Fiscal",
          resumen: dominio(),
          capacidades: [capacidad(), capacidad({ capacidad: "Precios de transferencia" })],
          entradas: [entrada()],
        },
        {
          label: "Tesorería",
          resumen: dominio({ id: "tesoreria", label: "Tesorería" }),
          capacidades: [capacidad({ capacidad: "Liquidez" })],
          entradas: [entrada({ capacidad: "Liquidez", subcapacidad: "1.1 Posición" }), entrada({ capacidad: "Liquidez", subcapacidad: "1.2 Previsión" })],
        },
      ]);

      t.igual(
        filas.map((fila) => `${fila.Tipo[0]}:${fila.Dominio}`).join(" "),
        "D:Fiscal D:Tesorería C:Fiscal C:Fiscal C:Tesorería S:Fiscal S:Tesorería S:Tesorería",
      );
    },
  },
  {
    grupo: "El archivo de todo el proyecto",
    nombre: "todas sus filas tienen las mismas columnas, o Excel las desplazaria",
    ejecutar: (t) => {
      const filas = filasDelProyecto([
        { label: "Fiscal", resumen: dominio(), capacidades: [capacidad()], entradas: [entrada()] },
      ]);

      const columnas = filas.map((fila) => Object.keys(fila).join("|"));

      t.igual(new Set(columnas).size, 1);
      t.igual(toCsv(filas).split("\r\n").every((linea) => linea.split(";").length === 22), true);
    },
  },
  {
    grupo: "El archivo de todo el proyecto",
    nombre: "sin dominios no hay filas",
    ejecutar: (t) => {
      t.igual(filasDelProyecto([]).length, 0);
    },
  },
];
