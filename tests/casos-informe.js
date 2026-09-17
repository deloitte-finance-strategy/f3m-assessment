/**
 * El informe PDF: el documento que se le entrega al cliente.
 *
 * No tenia ninguna prueba, y es lo unico de esta herramienta que sale de la
 * pantalla. Aqui se comprueban las dos cosas que se pueden comprobar sin un
 * navegador que maquete:
 *
 * - Que el reparto en diapositivas no trunca ni pierde filas. Que el contenido
 *   QUEPA es otra cosa: eso lo mide informe/desbordes.js, que necesita un
 *   navegador maquetando de verdad y se dispara con ?comprobar=desbordes. De
 *   ahi solo se prueba aqui la parte que si es pura, la lectura de las medidas.
 * - Que el indice y las diapositivas dicen los mismos numeros, y que nada de lo
 *   que escribe el usuario llega sin escapar.
 */

import { buildEnhancedPdfReportHtml } from "../informe/pdf.js?v=12";
import { deTantas, paginar } from "../informe/secciones.js?v=12";
import { resumenDeDesbordes } from "../informe/desbordes.js?v=12";


/** Una subcapacidad y sus metricas, lo minimo que el informe necesita. */
function entrada(n, extra = {}) {
  return {
    item: {
      id: `d-1-${n}`,
      capacidad: "Cumplimiento",
      subcapacidad: `1.${n} Una subcapacidad`,
      scores: { procesos: 3, tecnologia: 2, organizacion: 4 },
      iniciativaSugerida: "Definir el calendario",
      owner: "",
      status: "No iniciado",
      comentario: "",
      ...extra.item,
    },
    metrics: {
      isPending: false,
      scoreMedio: 3,
      targetMedio: 4,
      nivel: "3 - Estandarizado",
      gap: 1,
      gaps: { procesos: 1, tecnologia: 2, organizacion: 0 },
      targets: { procesos: 4, tecnologia: 4, organizacion: 4 },
      prioridad: "Media",
      oleada: "Oleada 2",
      ...extra.metrics,
    },
  };
}


function filaDeResumen(nombre) {
  return {
    capacidad: nombre,
    procesos: 3,
    objetivoProcesos: 4,
    tecnologia: 2,
    objetivoTecnologia: 4,
    organizacion: 4,
    objetivoOrganizacion: 4,
    scoreMedio: 3,
    targetMedio: 4,
    gap: 1,
    prioridad: "Media",
    avance: "3/3",
  };
}


/** Los datos del informe, en la forma que arma buildEnhancedPdfReportData(). */
function datos(extra = {}) {
  const entradas = [entrada(1), entrada(2), entrada(3)];

  return {
    domainId: "fiscal",
    domainLabel: "Fiscal",
    domainTitle: "Fiscalidad",
    generatedAt: "16/09/2026, 10:00:00",
    scenarioLabel: "Copia de este navegador",
    sourceFile: "F3M_Fiscal.xlsx",
    targetMaturity: 4,
    filters: "Sin filtros",
    visibleItems: entradas.map((e) => e.item),
    metrics: entradas,
    scored: entradas,
    summaryRows: [filaDeResumen("Cumplimiento")],
    topPriorities: entradas,
    topPrioritiesTotal: entradas.length,
    roadmapItems: entradas,
    roadmapTotal: entradas.length,
    commentItems: [],
    scoreGlobal: 3,
    gapMedio: 1,
    objetivoMedio: 4,
    highCount: 0,
    radarImages: { procesos: "", tecnologia: "", organizacion: "" },
    titulares: { mayorBrecha: null, palancaMasDebil: null, pendientes: 0 },
    global: null,
    ia: null,
    ...extra,
  };
}


const cuentaDeDiapositivas = (html) => (html.match(/<section class="slide/g) || []).length;


export const casos = [
  // -------------------------------------------------------------- paginar
  {
    grupo: "Reparto en diapositivas",
    nombre: "reparte en tandas del tamano pedido, sin perder filas",
    ejecutar: (t) => {
      const filas = [1, 2, 3, 4, 5, 6, 7];
      const tandas = paginar(filas, 3);

      t.igual(tandas.length, 3, "tres tandas");
      t.igual(tandas[0].length, 3);
      t.igual(tandas[2].length, 1, "la ultima va incompleta");
      t.igual(tandas.flat().join(","), filas.join(","), "ni se pierde ni se reordena nada");
    },
  },
  {
    grupo: "Reparto en diapositivas",
    nombre: "una lista vacia sigue dando una tanda",
    ejecutar: (t) => {
      // Si devolviera cero tandas, la seccion desapareceria del deck y el
      // indice prometeria una diapositiva que no existe.
      t.igual(paginar([], 5).length, 1);
      t.igual(paginar([], 5)[0].length, 0);
    },
  },
  {
    grupo: "Reparto en diapositivas",
    nombre: "una lista justo del tamano de la tanda no genera una vacia detras",
    ejecutar: (t) => {
      t.igual(paginar([1, 2, 3], 3).length, 1);
    },
  },
  {
    grupo: "Reparto en diapositivas",
    nombre: "con una sola tanda no se rotula, que \"1 de 1\" es ruido",
    ejecutar: (t) => {
      t.igual(deTantas(0, 1), "");
    },
  },
  {
    grupo: "Reparto en diapositivas",
    nombre: "con varias se numera desde 1, no desde el indice del array",
    ejecutar: (t) => {
      // Recibe el indice, y el rotulo lo lee una persona en el titulo de la
      // diapositiva: empezar en 0 daria un "0 de 3" en el entregable.
      t.igual(deTantas(0, 3), "1 de 3");
      t.igual(deTantas(2, 3), "3 de 3");
    },
  },
  {
    grupo: "Reparto en diapositivas",
    nombre: "el rotulo cuadra con lo que devuelve paginar",
    ejecutar: (t) => {
      // Los dos van juntos en cada seccion larga. Si el total no sale de
      // tandas.length, el deck promete mas diapositivas de las que trae.
      const tandas = paginar([1, 2, 3, 4, 5, 6, 7], 3);
      const rotulos = tandas.map((_, indice) => deTantas(indice, tandas.length));

      t.igual(rotulos.join(" · "), "1 de 3 · 2 de 3 · 3 de 3");
    },
  },

  // ---------------------------------------------------------------- el deck
  {
    grupo: "El deck",
    nombre: "arranca por la portada y termina por el cierre",
    ejecutar: (t) => {
      const html = buildEnhancedPdfReportHtml(datos());

      t.igual(html.includes('<section class="slide portada'), true, "portada");
      t.igual(html.includes('<section class="slide cierre'), true, "cierre");
      t.igual(html.includes("<title>Informe Fiscal · F3M Assessment</title>"), true, "titulo");
    },
  },
  {
    grupo: "El deck",
    nombre: "el ultimo numero de pie coincide con el total de diapositivas",
    ejecutar: (t) => {
      // El pie dice "N / total". Si el plan y el dibujo se contaran por
      // separado, el deck acabaria en "21 / 23" sin que nadie lo notara.
      const html = buildEnhancedPdfReportHtml(datos());
      const total = cuentaDeDiapositivas(html);
      const numeros = [...html.matchAll(/slide-pie-numero">(\d+) \/ (\d+)</g)];

      t.igual(numeros.length > 0, true, "hay numeros de pie");
      t.igual(Number(numeros[numeros.length - 1][2]), total, "el total del pie");
      t.igual(Number(numeros[numeros.length - 1][1]) <= total, true, "ningun numero pasa del total");
    },
  },
  {
    grupo: "El deck",
    nombre: "sin parte global el deck es mas corto, y sigue cuadrando",
    ejecutar: (t) => {
      // data.global es null cuando no hay nueve dominios cargados.
      const conGlobal = buildEnhancedPdfReportHtml(
        datos({
          global: {
            filas: [],
            dominios: 9,
            dominiosTotales: 9,
            subcapacidades: 152,
            evaluadas: 130,
            scoreGlobal: 2.5,
            gapMedio: 1.5,
            objetivoMedio: 4,
            highCount: 35,
            titulares: { mayorBrecha: null, palancaMasDebil: null, pendientes: 22 },
            radarImages: { procesos: "", tecnologia: "", organizacion: "" },
          },
        }),
      );

      const sinGlobal = buildEnhancedPdfReportHtml(datos());

      t.igual(cuentaDeDiapositivas(conGlobal) > cuentaDeDiapositivas(sinGlobal), true, "la global anade diapositivas");
    },
  },
  {
    grupo: "El deck",
    nombre: "un roadmap largo se reparte, no se trunca",
    ejecutar: (t) => {
      // POR_DIAPOSITIVA.roadmap es 6: quince filas tienen que ocupar tres
      // diapositivas, no una recortada a seis.
      const muchas = Array.from({ length: 15 }, (_, i) => entrada(i + 1));

      const html = buildEnhancedPdfReportHtml(
        datos({ metrics: muchas, scored: muchas, roadmapItems: muchas, roadmapTotal: 15 }),
      );

      t.igual(html.includes("1.15 Una subcapacidad"), true, "la ultima fila esta en el documento");
    },
  },

  // ------------------------------------------------------------- escapado
  {
    grupo: "Escapado del informe",
    nombre: "el texto que escribe el usuario no llega como HTML",
    ejecutar: (t) => {
      // El comentario es texto libre de 2.000 caracteres y en un escenario
      // compartido lo puede escribir cualquiera con el enlace. Sale integro en
      // el PDF que se entrega, asi que no puede llevar etiquetas dentro.
      const veneno = '<img src=x onerror="alert(1)">';

      const html = buildEnhancedPdfReportHtml(
        datos({
          commentItems: [
            {
              capacidad: veneno,
              subcapacidad: "1.1 Una subcapacidad",
              comentario: veneno,
            },
          ],
        }),
      );

      t.igual(html.includes("<img src=x"), false, "no queda ninguna etiqueta viva");
      t.igual(html.includes("&lt;img src=x"), true, "sale escapado");
    },
  },
  {
    grupo: "Escapado del informe",
    nombre: "tampoco en la portada, que lleva el nombre del dominio",
    ejecutar: (t) => {
      const html = buildEnhancedPdfReportHtml(
        datos({ domainLabel: "<script>x</script>", domainTitle: "<script>x</script>" }),
      );

      t.igual(html.includes("<script>x</script>"), false);
    },
  },

  // ---------------------------------------------------- medida de desbordes
  {
    grupo: "Desbordes del deck",
    nombre: "una diapositiva que se recorta se anuncia como error",
    ejecutar: (t) => {
      const resumen = resumenDeDesbordes([
        { numero: 1, titulo: "Portada", sobra: -40 },
        { numero: 2, titulo: "Heatmap", sobra: 18 },
      ]);

      t.igual(resumen.hayDesbordes, true);
      t.igual(resumen.tono, "error");
      t.igual(resumen.mensaje.includes("Heatmap (18 px)"), true, "dice cual y cuanto");
      t.igual(resumen.mensaje.includes("1 de 2"), true, "y cuantas de cuantas");
    },
  },
  {
    grupo: "Desbordes del deck",
    nombre: "un pixel de margen no cuenta como desborde",
    ejecutar: (t) => {
      // getBoundingClientRect() y el maquetado del navegador redondean distinto:
      // marcar diferencias de menos de un pixel daria un falso positivo en cada
      // pasada, y una alarma que siempre suena se ignora.
      t.igual(resumenDeDesbordes([{ numero: 1, titulo: "A", sobra: 1 }]).hayDesbordes, false);
      t.igual(resumenDeDesbordes([{ numero: 1, titulo: "A", sobra: 2 }]).hayDesbordes, true);
    },
  },
  {
    grupo: "Desbordes del deck",
    nombre: "si todo cabe, se dice cual es la mas justa y cuanto le queda",
    ejecutar: (t) => {
      const resumen = resumenDeDesbordes([
        { numero: 1, titulo: "Portada", sobra: -120 },
        { numero: 2, titulo: "Roadmap", sobra: -7 },
      ]);

      t.igual(resumen.hayDesbordes, false);
      t.igual(resumen.tono, "exito");
      t.igual(resumen.mensaje.includes("«Roadmap»"), true, "la mas justa");
      t.igual(resumen.mensaje.includes("7 px de margen"), true, "en positivo, que es lo que queda");
    },
  },
  {
    grupo: "Desbordes del deck",
    nombre: "sin diapositivas que medir se dice que no se ha medido nada",
    ejecutar: (t) => {
      // Que no haya nada que medir no puede leerse como "todo cabe".
      const resumen = resumenDeDesbordes([]);

      t.igual(resumen.hayDesbordes, false);
      t.igual(resumen.tono, "aviso");
      t.igual(resumen.mensaje.includes("ninguna diapositiva"), true);
    },
  },

  // --------------------------------------------------------- sin contenido
  {
    grupo: "El deck sin datos",
    nombre: "un dominio sin nada puntuado sigue generando un deck entero",
    ejecutar: (t) => {
      const html = buildEnhancedPdfReportHtml(
        datos({
          visibleItems: [],
          metrics: [],
          scored: [],
          summaryRows: [],
          topPriorities: [],
          topPrioritiesTotal: 0,
          roadmapItems: [],
          roadmapTotal: 0,
          scoreGlobal: null,
          gapMedio: null,
          objetivoMedio: null,
        }),
      );

      t.igual(cuentaDeDiapositivas(html) > 0, true, "hay diapositivas");
      t.igual(html.includes('<section class="slide cierre'), true, "y llega al cierre");
    },
  },
];
