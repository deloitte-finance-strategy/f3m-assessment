/**
 * El acta del taller: el documento que el cliente recibe despues.
 *
 * Como la preparacion, sale hacia el cliente sin que nadie la mire en pantalla.
 * Aqui se comprueba que sus cifras sean las del Dashboard y del Overview, que
 * no pierda ni repita ninguna subcapacidad, que lo pendiente vaya a su sitio y
 * que lo escrito a mano —las notas del taller y el nombre del cliente— llegue
 * escapado.
 */

import { average, calcularMetricas, resumenGlobal } from "../core/calculo.js?v=27";
import { BRECHAS_EN_LA_PORTADA, documentoDeActa, resumenDelActa } from "../informe/acta.js?v=27";


const OBJETIVO_4 = { procesos: 4, tecnologia: 4, organizacion: 4 };


function subcapacidad(capacidad, nombre, scores, extra = {}) {
  const objetivos = extra.objetivos || OBJETIVO_4;

  return {
    capacidad,
    subcapacidad: nombre,
    scores,
    comentario: "",
    evidencias: "Calendario presupuestario; RACI; actas de comités",
    metricas: calcularMetricas({ scores }, objetivos),
    ...extra,
  };
}


const SIN_PUNTUAR = { procesos: null, tecnologia: null, organizacion: null };


const DOMINIO = [
  subcapacidad("Presupuestos", "1.1 Gobierno del proceso", { procesos: 1, tecnologia: 2, organizacion: 2 }, {
    comentario: "Falta un RACI firmado por dirección.",
  }),
  subcapacidad("Presupuestos", "1.2 Modelo presupuestario", { procesos: 3, tecnologia: 3, organizacion: 2 }),
  subcapacidad("Presupuestos", "1.3 Rolling forecast", SIN_PUNTUAR),
  subcapacidad("Informes", "2.1 Reporting de gestión", { procesos: 4, tecnologia: 2, organizacion: 5 }),
  subcapacidad("Informes", "2.2 Cuadro de mando", { procesos: 5, tecnologia: 5, organizacion: 5 }),
  subcapacidad("Informes", "2.3 Análisis de desviaciones", { procesos: 2, tecnologia: 1, organizacion: 3 }),
  subcapacidad("Informes", "2.4 Narrativa", { procesos: 3, tecnologia: null, organizacion: null }),
];


function cuantasVeces(texto, trozo) {
  return texto.split(trozo).length - 1;
}


export const casos = [
  {
    grupo: "Acta del taller",
    nombre: "las cuatro cifras son las del Dashboard, con lo pendiente fuera",
    ejecutar(t) {
      const { resumen } = resumenDelActa(DOMINIO);
      const delDashboard = resumenGlobal(DOMINIO.map((item) => ({ item, metrics: item.metricas })));

      t.igual(resumen.total, 7);
      t.igual(resumen.evaluadas, 6, "la 1.3 está pendiente");
      t.igual(resumen.scoreGlobal, delDashboard.scoreGlobal, "nivel medio");
      t.igual(resumen.gapMedio, delDashboard.gapMedio, "gap medio");
      t.igual(resumen.prioridadAlta, delDashboard.prioridadAlta, "prioridad alta");
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "cada palanca promedia lo puntuado, y su objetivo todas, como el Overview",
    ejecutar(t) {
      const items = [
        subcapacidad("A", "1.1 Uno", { procesos: 2, tecnologia: 2, organizacion: 2 }, { objetivos: { procesos: 5, tecnologia: 4, organizacion: 4 } }),
        subcapacidad("B", "2.1 Dos", { procesos: 4, tecnologia: null, organizacion: 3 }),
        subcapacidad("B", "2.2 Tres", SIN_PUNTUAR),
      ];
      const [procesos, tecnologia] = resumenDelActa(items).palancas;

      t.igual(procesos.media, 3, "la media de 2 y 4: la pendiente no cuenta como cero");
      t.igual(tecnologia.media, 2, "solo la que tiene tecnología puntuada");
      t.igual(procesos.objetivo, average([5, 4, 4]), "el objetivo cuenta también la pendiente: es configuración");
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "la portada lleva las mayores brechas, por prioridad y gap, sin las que ya están en objetivo",
    ejecutar(t) {
      const { brechas } = resumenDelActa(DOMINIO);
      const nombres = brechas.map((entrada) => entrada.item.subcapacidad);

      t.igual(brechas.length <= BRECHAS_EN_LA_PORTADA, true, "como mucho cinco");
      t.igual(nombres[0], "1.1 Gobierno del proceso", "alta y con más gap, primero");
      t.igual(nombres[1], "2.3 Análisis de desviaciones", "la otra alta, antes que las medias");
      t.igual(nombres.includes("2.2 Cuadro de mando"), false, "la que está en objetivo no es una brecha");
      t.igual(nombres.includes("1.3 Rolling forecast"), false, "ni la pendiente");

      const sinBrechas = documentoDeActa({
        domainLabel: "FP&A",
        subcapacidades: [subcapacidad("Informes", "2.2 Cuadro de mando", { procesos: 5, tecnologia: 4, organizacion: 4 })],
      });

      t.igual(sinBrechas.includes("Ninguna subcapacidad puntuada queda por debajo de su objetivo."), true);
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "cada subcapacidad sale una vez en el detalle, y lo pendiente pide su documentación",
    ejecutar(t) {
      const html = documentoDeActa({ domainLabel: "FP&A", subcapacidades: DOMINIO });

      t.igual(cuantasVeces(html, 'class="nivel"'), DOMINIO.length * 3, "tres casillas de score por subcapacidad");
      t.igual(cuantasVeces(html, "Sin puntuar</span>"), 1, "la 1.3, sin puntuar");
      t.igual(cuantasVeces(html, '<h3>1.3 Rolling forecast</h3>'), 1, "y en lo pendiente");
      t.igual(cuantasVeces(html, 'class="casilla"'), 3, "con sus tres documentos");
      t.igual(html.includes("Queda una subcapacidad para la próxima sesión."), true);
      t.igual(html.includes("<b>6 de las 7 subcapacidades</b>"), true);
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "sin nada pendiente no hay apartado de pendientes, y la frase lo cuenta entero",
    ejecutar(t) {
      const html = documentoDeActa({
        domainLabel: "FP&A",
        subcapacidades: DOMINIO.filter((item) => !item.metricas.isPending),
      });

      t.igual(html.includes("Quedó pendiente"), false);
      t.igual(html.includes("Quedan puntuadas <b>las 6 subcapacidades</b>"), true);
      t.igual(html.includes("para la próxima sesión"), false);
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "la frase nombra la palanca más madura y la más lejos de su objetivo",
    ejecutar(t) {
      const html = documentoDeActa({ domainLabel: "FP&A", subcapacidades: DOMINIO });

      // Procesos 3, Tecnología 2,6, Organización 3,4 de media, todas frente a 4.
      t.igual(html.includes("La palanca más madura es <b>Organización</b> (3,40 de media)"), true);
      t.igual(html.includes("la que más lejos queda de su objetivo es <b>Tecnología</b> (2,60 frente a 4)"), true);

      const enObjetivo = documentoDeActa({
        domainLabel: "FP&A",
        subcapacidades: [subcapacidad("Informes", "2.2 Cuadro de mando", { procesos: 5, tecnologia: 4, organizacion: 4 })],
      });

      t.igual(enObjetivo.includes("y las tres alcanzan su objetivo."), true);
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "el objetivo de cada capacidad va en su tabla, y el nivel con su nombre corto",
    ejecutar(t) {
      const html = documentoDeActa({
        domainLabel: "FP&A",
        subcapacidades: [
          subcapacidad("Informes", "2.2 Cuadro de mando", { procesos: 5, tecnologia: 5, organizacion: 5 }, {
            objetivos: { procesos: 5, tecnologia: 3, organizacion: 4 },
          }),
        ],
      });

      t.igual(html.includes("<small>Objetivo 5</small>"), true, "procesos");
      t.igual(html.includes("<small>Objetivo 3</small>"), true, "tecnología");
      t.igual(html.includes(">Avanzado</td>"), true, "«Avanzado/Referente» no cabe en la columna");
      t.igual(html.includes("Avanzado/Referente"), false);
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "las notas y el cliente llegan escapados, y el título sirve de nombre de archivo",
    ejecutar(t) {
      const html = documentoDeActa({
        cliente: "<script>alert(1)</script> A/B",
        domainLabel: "FP&A",
        fecha: "8 de octubre de 2026",
        fechaDeArchivo: "2026-10-08",
        subcapacidades: [
          subcapacidad("Informes", "2.1 <b>Reporting</b>", { procesos: 2, tecnologia: 2, organizacion: 2 }, {
            comentario: "<img src=x onerror=alert(1)> y 40 Excel",
          }),
        ],
      });

      t.igual(html.includes("<script>"), false, "ningún script del nombre del cliente");
      t.igual(html.includes("<img"), false, "ni de las notas");
      t.igual(html.includes("&lt;img src=x onerror=alert(1)&gt; y 40 Excel"), true, "la nota sale, escapada");
      t.igual(html.includes("<b>Reporting</b>"), false, "ni marcas de los datos");
      t.igual(html.includes("<b>8 de octubre de 2026</b>"), true, "con la fecha del acta");

      const titulo = /<title>([^<]*)<\/title>/.exec(html)?.[1] || "";

      t.igual(titulo.startsWith("Acta del taller F3M - "), true);
      t.igual(titulo.includes("/"), false, "sin la barra que Windows no admite");
      t.igual(titulo.endsWith("2026-10-08"), true);
    },
  },
  {
    grupo: "Acta del taller",
    nombre: "sin notas no promete notas",
    ejecutar(t) {
      const html = documentoDeActa({
        domainLabel: "FP&A",
        subcapacidades: [subcapacidad("Informes", "2.1 Reporting", { procesos: 2, tecnologia: 2, organizacion: 2 })],
      });

      t.igual(html.includes("Las notas son las que tomamos"), false);
      t.igual(html.includes("Notas del taller"), false);
    },
  },
];
