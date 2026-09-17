/**
 * El informe: de los datos ya recogidos al documento que se imprime.
 *
 * Eran unas 770 lineas dentro de app.js, hojas de estilo incluidas como cadena.
 * Despues fue un archivo con ocho secciones de documento. Ahora es un deck, y
 * el reparto es otro: aqui queda **solo el orden** —que diapositivas, en que
 * parte y con que numero—, y el resto vive al lado.
 *
 *   informe/secciones.js  una funcion por diapositiva
 *   informe/graficos.js   las primitivas SVG
 *   informe/estilos.js    la paleta y la hoja
 *
 * Aqui no hay DOM ni estado global: entra el objeto que arma
 * buildEnhancedPdfReportData() en app.js —que es quien si conoce el estado— y
 * sale el documento entero.
 *
 * El enfoque de siempre: ventana nueva y window.print(), sin dependencias.
 *
 * El tamano de pagina es 338x190mm, la diapositiva 16:9 de PowerPoint. El
 * informe se proyecta a pantalla completa y se inserta en una presentacion sin
 * reescalar, que es lo mas cerca de una ppt sin generar una ppt.
 */

import { escapeHtml } from "../core/presentacion.js?v=12";

import { getEnhancedPdfReportStyles } from "./estilos.js?v=12";

import {
  POR_DIAPOSITIVA,
  brechas,
  cierre,
  comentarios,
  deTantas,
  fichasDeIa,
  heatmap,
  indice,
  panoramaDeIa,
  panoramaGlobal,
  paginar,
  perfilPorPalanca,
  portada,
  radarGlobal,
  radarPorCapacidad,
  rankingDeDominios,
  resumenDelDominio,
  resumenPorCapacidad,
  roadmap,
  separador,
} from "./secciones.js?v=12";


const PARTE_GLOBAL = "La funcion financiera";
const PARTE_DOMINIO = "El dominio";
const PARTE_ACCION = "Hacia donde";


export function buildEnhancedPdfReportHtml(data) {
  const plan = planDelDeck(data);

  plan.forEach((seccion, indiceDeSeccion) => {
    seccion.numero = indiceDeSeccion + 1;
  });

  const diapositivas = plan
    .map((seccion) => dibujarDiapositiva(seccion, plan, data))
    .join("");

  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Informe ${escapeHtml(data.domainLabel)} · F3M Assessment</title>
        <style>${getEnhancedPdfReportStyles()}</style>
      </head>
      <body>${diapositivas}</body>
    </html>
  `;
}


/**
 * El deck entero como lista, antes de dibujar nada.
 *
 * Se arma primero y se dibuja despues porque el indice necesita los numeros de
 * las demas diapositivas, y esos no se saben hasta que la lista esta completa:
 * las secciones largas se reparten en varias y cuantas salgan depende de los
 * filtros y del dominio.
 */
function planDelDeck(data) {
  const secciones = [];

  secciones.push({
    clase: "portada slide-oscura",
    parte: "Apertura",
    titulo: "Portada",
    enIndice: false,
    cuerpo: () => portada(data),
  });

  secciones.push({
    parte: "Apertura",
    titulo: "Contenidos",
    enIndice: false,
    cuerpo: (plan) => indice(plan),
  });

  if (data.global) {
    secciones.push(...parteGlobal(data));
  }

  secciones.push(...parteDelDominio(data));
  secciones.push(...parteDeAccion(data));

  secciones.push({
    clase: "cierre slide-oscura",
    parte: "Cierre",
    titulo: "Alcance de este informe",
    enIndice: false,
    cuerpo: () => cierre(data),
  });

  return secciones;
}


function parteGlobal(data) {
  return [
    {
      clase: "separador slide-oscura",
      parte: PARTE_GLOBAL,
      titulo: "Parte 1",
      enIndice: false,
      cuerpo: () =>
        separador({
          numero: "Parte 1",
          titulo: PARTE_GLOBAL,
          texto:
            "Como esta la funcion financiera en su conjunto, dominio a dominio, antes de entrar "
            + "al detalle. Esta parte no depende de los filtros de la herramienta.",
        }),
    },
    {
      parte: PARTE_GLOBAL,
      titulo: "Panorama F3M",
      entradilla:
        "Madurez media de la funcion financiera frente al objetivo configurado, y lo que hay que mirar primero.",
      cuerpo: () => panoramaGlobal(data),
    },
    {
      parte: PARTE_GLOBAL,
      titulo: "Ranking de dominios",
      entradilla:
        "Los dominios ordenados por brecha. La barra es la madurez media y la marca vertical, el objetivo.",
      cuerpo: () => rankingDeDominios(data),
    },
    {
      parte: PARTE_GLOBAL,
      titulo: "Radar por dominio",
      entradilla: "Madurez actual frente a objetivo en las tres palancas, con un eje por dominio.",
      cuerpo: () => radarGlobal(data),
    },
  ];
}


function parteDelDominio(data) {
  const secciones = [
    {
      clase: "separador slide-oscura",
      parte: PARTE_DOMINIO,
      titulo: "Parte 2",
      enIndice: false,
      cuerpo: () =>
        separador({
          numero: "Parte 2",
          titulo: data.domainTitle || data.domainLabel,
          texto:
            "Diagnostico del dominio: capacidades, subcapacidades y brechas frente al objetivo, "
            + "con los filtros que estaban activos al generar el informe.",
        }),
    },
    {
      parte: PARTE_DOMINIO,
      titulo: "Resumen ejecutivo",
      entradilla: `Lectura de ${data.domainLabel} en cuatro cifras y una frase.`,
      cuerpo: () => resumenDelDominio(data),
    },
    {
      parte: PARTE_DOMINIO,
      titulo: "Perfil por palanca",
      entradilla:
        "Madurez media de Procesos, Tecnologia y Organizacion frente a su objetivo, y reparto por prioridad.",
      cuerpo: () => perfilPorPalanca(data),
    },
    {
      parte: PARTE_DOMINIO,
      titulo: "Radar por capacidad",
      entradilla: "Las capacidades del dominio en las tres palancas, contra el objetivo de cada una.",
      cuerpo: () => radarPorCapacidad(data),
    },
  ];

  paginar(data.summaryRows, POR_DIAPOSITIVA.capacidades).forEach((tanda, indiceDeTanda, tandas) => {
    secciones.push({
      parte: PARTE_DOMINIO,
      titulo: "Resumen por capacidad",
      subtitulo: deTantas(indiceDeTanda, tandas.length),
      entradilla:
        indiceDeTanda === 0
          ? "Medias por palanca, score frente a objetivo y avance del scoring, capacidad a capacidad."
          : "",
      cuerpo: () => resumenPorCapacidad(tanda),
    });
  });

  paginar(data.metrics, POR_DIAPOSITIVA.calor).forEach((tanda, indiceDeTanda, tandas) => {
    secciones.push({
      parte: PARTE_DOMINIO,
      titulo: "Heatmap por subcapacidad",
      subtitulo: deTantas(indiceDeTanda, tandas.length),
      entradilla:
        indiceDeTanda === 0
          ? "Madurez celda a celda. Del rojo al verde, los mismos cinco niveles del modelo F3M."
          : "",
      cuerpo: () => heatmap(tanda),
    });
  });

  paginar(data.topPriorities, POR_DIAPOSITIVA.brechas).forEach((tanda, indiceDeTanda, tandas) => {
    secciones.push({
      parte: PARTE_DOMINIO,
      titulo: "Principales brechas",
      subtitulo: deTantas(indiceDeTanda, tandas.length),
      entradilla:
        indiceDeTanda === 0
          ? recuento(data.topPriorities.length, data.topPrioritiesTotal, "subcapacidad puntuada", "subcapacidades puntuadas")
          : "",
      cuerpo: () => brechas(tanda, indiceDeTanda * POR_DIAPOSITIVA.brechas),
    });
  });

  return secciones;
}


function parteDeAccion(data) {
  const secciones = [
    {
      clase: "separador slide-oscura",
      parte: PARTE_ACCION,
      titulo: "Parte 3",
      enIndice: false,
      cuerpo: () =>
        separador({
          numero: "Parte 3",
          titulo: PARTE_ACCION,
          texto:
            "Las iniciativas que cierran las brechas, repartidas en oleadas, y las oportunidades "
            + "de inteligencia artificial que aplican a este dominio.",
        }),
    },
  ];

  paginar(data.roadmapItems, POR_DIAPOSITIVA.roadmap).forEach((tanda, indiceDeTanda, tandas) => {
    secciones.push({
      parte: PARTE_ACCION,
      titulo: "Roadmap e iniciativas",
      subtitulo: deTantas(indiceDeTanda, tandas.length),
      entradilla:
        indiceDeTanda === 0
          ? "Priorizado por brecha y criticidad. "
            + recuento(data.roadmapItems.length, data.roadmapTotal, "subcapacidad", "subcapacidades")
          : "",
      cuerpo: () => roadmap(tanda),
    });
  });

  // Sin catalogo de casos no se pinta una seccion vacia: no habria forma de
  // distinguir "este dominio no tiene casos" de "el catalogo no cargo".
  if (data.ia?.total) {
    secciones.push({
      parte: PARTE_ACCION,
      titulo: "Panorama de IA",
      entradilla: `Los casos de uso de inteligencia artificial que aplican a ${data.domainLabel}, por tipo de valor y por tipo de IA.`,
      cuerpo: () => panoramaDeIa(data.ia, data),
    });

    paginar(data.ia.casos, POR_DIAPOSITIVA.casosDeIa).forEach((tanda, indiceDeTanda, tandas) => {
      secciones.push({
        parte: PARTE_ACCION,
        titulo: "Oportunidades de IA",
        subtitulo: deTantas(indiceDeTanda, tandas.length),
        entradilla:
          indiceDeTanda === 0
            ? "Cada ficha lleva sus dos etiquetas: que tipo de IA es y que tipo de valor mueve."
            : "",
        cuerpo: () => fichasDeIa(tanda),
      });
    });
  }

  paginar(data.commentItems, POR_DIAPOSITIVA.comentarios).forEach((tanda, indiceDeTanda, tandas) => {
    secciones.push({
      parte: PARTE_ACCION,
      titulo: "Comentarios y hallazgos",
      subtitulo: deTantas(indiceDeTanda, tandas.length),
      entradilla: indiceDeTanda === 0 ? "Lo anotado durante las sesiones de scoring." : "",
      cuerpo: () => comentarios(tanda),
    });
  });

  return secciones;
}


/**
 * Cuantas filas se ensenan de cuantas hay.
 *
 * Las secciones largas ya no se truncan —se reparten en varias diapositivas—,
 * pero el roadmap y las brechas siguen llegando podados desde app.js, y sus
 * titulos no lo decian: quien recibia el PDF creia estar viendo el roadmap
 * entero y le salian otras cuentas que en pantalla.
 */
function recuento(mostradas, total, singular, plural) {
  if (!Number.isFinite(total) || total <= mostradas) {
    return `${total || mostradas} ${(total || mostradas) === 1 ? singular : plural}.`;
  }

  return `Las ${mostradas} primeras de ${total} ${plural}, ordenadas por prioridad y gap.`;
}


function dibujarDiapositiva(seccion, plan, data) {
  const esAsangre = Boolean(seccion.clase);

  return `
    <section class="slide${seccion.clase ? ` ${seccion.clase}` : ""}">
      ${esAsangre ? "" : cabecera(seccion)}
      <div class="slide-cuerpo">${seccion.cuerpo(plan)}</div>
      ${esAsangre ? "" : pie(seccion, plan, data)}
    </section>
  `;
}


function cabecera(seccion) {
  return `
    <header class="slide-cabecera">
      <p class="slide-antetitulo">
        <b>${String(seccion.numero).padStart(2, "0")}</b>
        <span>${escapeHtml(seccion.parte)}</span>
        <i></i>
      </p>
      <h2>${escapeHtml(seccion.titulo)}${seccion.subtitulo ? ` <span style="font-weight:300;">· ${escapeHtml(seccion.subtitulo)}</span>` : ""}</h2>
      ${seccion.entradilla ? `<p class="slide-entradilla">${escapeHtml(seccion.entradilla)}</p>` : ""}
    </header>
  `;
}


function pie(seccion, plan, data) {
  return `
    <footer class="slide-pie">
      <span><strong>F3M Assessment</strong> · ${escapeHtml(data.domainLabel)}</span>
      <span>${escapeHtml(data.generatedAt)}</span>
      <span class="slide-pie-numero">${seccion.numero} / ${plan.length}</span>
    </footer>
  `;
}
