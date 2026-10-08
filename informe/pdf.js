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

import { escapeHtml } from "../core/presentacion.js?v=26";

import { getEnhancedPdfReportStyles } from "./estilos.js?v=26";

import {
  POR_DIAPOSITIVA,
  brechas,
  cierre,
  comentarios,
  deTantas,
  fichasDeIa,
  heatmap,
  indice,
  masUrgentes,
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
} from "./secciones.js?v=26";


const PARTE_GLOBAL = "La función financiera";
const PARTE_DOMINIO = "El dominio";
const PARTE_ACCION = "Hacia dónde";


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
        <title>${escapeHtml(tituloDelDocumento(data))}</title>
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
    // Con un capitulo por dominio, una linea por seccion no cabe: son unas
    // diez por dominio. El indice pasa a ser de partes, con su rango.
    cuerpo: (plan) => indice(plan, { porPartes: Boolean(data.dominios) }),
  });

  if (data.global) {
    secciones.push(...parteGlobal(data));
  }

  if (data.dominios) {
    data.dominios.forEach((dominio, indiceDeDominio) => {
      secciones.push(...capituloDelDominio({ ...data, ...dominio }, indiceDeDominio + (data.global ? 2 : 1)));
    });
  } else {
    secciones.push(...parteDelDominio(data));
    secciones.push(...parteDeAccion(data));
  }

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
  // Sin nada de prioridad alta no hay diapositiva: una que solo dijera "no hay
  // nada urgente" en un deck que se entrega parece un apartado sin terminar.
  const urgentes = data.global.urgentes?.lista?.length
    ? paginar(data.global.urgentes.lista, POR_DIAPOSITIVA.urgentes).map((tanda, indiceDeTanda, tandas) => ({
        parte: PARTE_GLOBAL,
        titulo: "Lo más urgente",
        subtitulo: deTantas(indiceDeTanda, tandas.length),
        entradilla:
          indiceDeTanda === 0
            ? "Las iniciativas de prioridad alta con más gap, de cualquiera de los dominios."
            : "",
        cuerpo: () =>
          masUrgentes(data.global.urgentes, tanda, indiceDeTanda * POR_DIAPOSITIVA.urgentes),
      }))
    : [];

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
            "Cómo está la función financiera en su conjunto, dominio a dominio, antes de entrar "
            + "al detalle. Esta parte no depende de los filtros de la herramienta.",
        }),
    },
    {
      parte: PARTE_GLOBAL,
      titulo: "Panorama F3M",
      entradilla:
        "Madurez media de la función financiera frente al objetivo configurado, y lo que hay que mirar primero.",
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
    ...urgentes,
  ];
}


/**
 * Un dominio en el informe de todo el proyecto: su diagnostico y su
 * «hacia donde» seguidos, bajo una sola parte con el nombre del dominio.
 *
 * Son las mismas diapositivas que el informe de un dominio, con dos cambios:
 * la cabecera de cada una dice de que dominio es —en un deck de cien
 * diapositivas, «El dominio» no orienta— y no hay un separador aparte para
 * la accion, que con nueve dominios serian nueve diapositivas de relleno.
 */
function capituloDelDominio(data, numeroDeParte) {
  const comun = {
    parte: data.domainLabel,
    tituloDeParte: data.domainTitle || data.domainLabel,
    dominio: data.domainLabel,
  };

  return [
    ...parteDelDominio(data, {
      ...comun,
      numero: `Parte ${numeroDeParte}`,
      texto:
        "Diagnóstico del dominio y hacia dónde: capacidades, brechas, roadmap y oportunidades de "
        + "inteligencia artificial, con todas sus subcapacidades.",
    }),
    ...parteDeAccion(data, { ...comun, sinSeparador: true }),
  ];
}


function parteDelDominio(data, opciones = {}) {
  const parte = opciones.parte || PARTE_DOMINIO;
  const numero = opciones.numero || "Parte 2";

  const secciones = [
    {
      clase: "separador slide-oscura",
      parte,
      titulo: numero,
      enIndice: false,
      cuerpo: () =>
        separador({
          numero,
          titulo: data.domainTitle || data.domainLabel,
          texto:
            opciones.texto
            || "Diagnóstico del dominio: capacidades, subcapacidades y brechas frente al objetivo, "
              + "con los filtros que estaban activos al generar el informe.",
        }),
    },
    {
      parte,
      titulo: "Resumen ejecutivo",
      entradilla: `Lectura de ${data.domainLabel} en cuatro cifras y una frase.`,
      cuerpo: () => resumenDelDominio(data),
    },
    {
      parte,
      titulo: "Perfil por palanca",
      entradilla:
        "Madurez media de Procesos, Tecnología y Organización frente a su objetivo, y reparto por prioridad.",
      cuerpo: () => perfilPorPalanca(data),
    },
    {
      parte,
      titulo: "Radar por capacidad",
      entradilla: "Las capacidades del dominio en las tres palancas, contra el objetivo de cada una.",
      cuerpo: () => radarPorCapacidad(data),
    },
  ];

  paginar(data.summaryRows, POR_DIAPOSITIVA.capacidades).forEach((tanda, indiceDeTanda, tandas) => {
    secciones.push({
      parte,
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
      parte,
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
      parte,
      titulo: "Principales brechas",
      subtitulo: deTantas(indiceDeTanda, tandas.length),
      entradilla:
        indiceDeTanda === 0
          ? recuento(data.topPriorities.length, data.topPrioritiesTotal, "subcapacidad puntuada", "subcapacidades puntuadas")
          : "",
      cuerpo: () => brechas(tanda, indiceDeTanda * POR_DIAPOSITIVA.brechas),
    });
  });

  return secciones.map((seccion) => ({ ...seccion, ...marcaDeParte(opciones) }));
}


function parteDeAccion(data, opciones = {}) {
  const parte = opciones.parte || PARTE_ACCION;

  const secciones = opciones.sinSeparador
    ? []
    : [
        {
          clase: "separador slide-oscura",
          parte,
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
      parte,
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
      parte,
      titulo: "Panorama de IA",
      entradilla: `Los casos de uso de inteligencia artificial que aplican a ${data.domainLabel}, por tipo de valor y por tipo de IA.`,
      cuerpo: () => panoramaDeIa(data.ia, data),
    });

    paginar(data.ia.casos, POR_DIAPOSITIVA.casosDeIa).forEach((tanda, indiceDeTanda, tandas) => {
      secciones.push({
        parte,
        titulo: "Oportunidades de IA",
        subtitulo: deTantas(indiceDeTanda, tandas.length),
        entradilla:
          indiceDeTanda === 0
            ? (data.ia.orden === "prioridad"
                ? "Primero las que atacan las brechas más altas de este dominio, con su tipo de IA y de valor."
                : "Cada ficha lleva sus dos etiquetas: qué tipo de IA es y qué tipo de valor mueve.")
            : "",
        cuerpo: () => fichasDeIa(tanda),
      });
    });
  }

  // Sin comentarios no hay diapositiva: una pagina que solo dice "no hay
  // comentarios" en un deck que se entrega parece un apartado sin terminar.
  paginar(data.commentItems, POR_DIAPOSITIVA.comentarios).forEach((tanda, indiceDeTanda, tandas) => {
    if (!tanda.length) {
      return;
    }

    secciones.push({
      parte,
      titulo: "Comentarios y hallazgos",
      subtitulo: deTantas(indiceDeTanda, tandas.length),
      entradilla: indiceDeTanda === 0 ? "Lo anotado durante las sesiones de scoring." : "",
      cuerpo: () => comentarios(tanda),
    });
  });

  return secciones.map((seccion) => ({ ...seccion, ...marcaDeParte(opciones) }));
}


/**
 * Lo que una seccion necesita saber del capitulo al que pertenece: el titulo
 * largo para el indice por partes y el dominio para el pie. En el informe de
 * un dominio no lleva nada, y el pie dice el dominio de siempre.
 */
function marcaDeParte(opciones) {
  const marca = {};

  if (opciones.tituloDeParte) {
    marca.tituloDeParte = opciones.tituloDeParte;
  }

  if (opciones.dominio) {
    marca.dominio = opciones.dominio;
  }

  return marca;
}


/**
 * El titulo de la ventana del informe, que es tambien el nombre que propone
 * "Guardar como PDF". Con la fecha, dos informes del mismo dominio no se pisan
 * en la carpeta de descargas y se ordenan solos.
 */
function tituloDelDocumento(data) {
  // Con el cliente delante, que es como se busca un informe en la carpeta. Sin
  // los caracteres que Windows no admite en un nombre: un cliente "A/B" haria
  // que el dialogo de guardar propusiera una carpeta que no existe.
  const partes = [data.cliente, data.proyecto ? "Proyecto" : data.domainLabel]
    .filter(Boolean)
    .map((parte) => String(parte).replace(/[<>:"/\\|?*]+/g, " ").trim())
    .join(" - ");

  return data.fechaDeArchivo
    ? `Informe F3M - ${partes} - ${data.fechaDeArchivo}`
    : `Informe ${partes} · F3M Assessment`;
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
      <span><strong>F3M Assessment</strong>${data.cliente ? ` · ${escapeHtml(data.cliente)}` : ""} · ${escapeHtml(seccion.dominio || data.domainLabel)}</span>
      <span>${escapeHtml(data.generatedAt)}</span>
      <span class="slide-pie-numero">${seccion.numero} / ${plan.length}</span>
    </footer>
  `;
}
