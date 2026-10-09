/**
 * La preparacion del taller: el documento que el cliente recibe antes.
 *
 * Es lo primero que sale de la herramienta hacia el cliente, y sale sin que
 * nadie lo mire en pantalla: se genera, se guarda en PDF y se envia. Aqui se
 * comprueba que no pierda ni repita ninguna subcapacidad, que no lleve una
 * sola puntuacion, que lo escrito a mano llegue escapado y que la escala que
 * explica sea la misma que la herramienta ensena en «Criterios F3M».
 */

import {
  NIVELES_DE_LA_RUBRICA,
  RUBRICA_GENERAL,
  capacidadesDePreparacion,
  documentoDePreparacion,
  listaDeEvidencias,
} from "../informe/preparacion.js?v=28";


const RAIZ = new URL("../", import.meta.url);


/** Lee un archivo de texto del repositorio, en Node y en el navegador. */
async function leerTexto(nombre) {
  const url = new URL(nombre, RAIZ);

  if (typeof window === "undefined") {
    const { readFileSync } = await import("node:fs");
    return readFileSync(url, "utf8");
  }

  const respuesta = await fetch(url);

  if (!respuesta.ok) {
    throw new Error(`No se pudo leer ${nombre}: ${respuesta.status}`);
  }

  return respuesta.text();
}


const indexHtml = await leerTexto("index.html");


function subcapacidad(capacidad, nombre, extra = {}) {
  return {
    capacidad,
    subcapacidad: nombre,
    objetivo: `Evaluar ${nombre}`,
    preguntas: ["¿Existe calendario?", "¿Hay responsables?"],
    evidencias: "Calendario presupuestario; RACI; actas de comités",
    ...extra,
  };
}


const DOMINIO = [
  subcapacidad("Presupuestos", "1.1 Gobierno del proceso"),
  subcapacidad("Presupuestos", "1.2 Modelo presupuestario"),
  subcapacidad("Informes", "2.1 Reporting de gestión"),
  subcapacidad("Presupuestos", "1.3 Rolling forecast"),
];


function cuantasVeces(texto, trozo) {
  return texto.split(trozo).length - 1;
}


export const casos = [
  {
    grupo: "Preparación del taller",
    nombre: "la documentación se parte por punto y coma, con mayúscula y sin huecos",
    ejecutar(t) {
      const lista = listaDeEvidencias("Calendario presupuestario; RACI;  actas de comités.;; risk assessment ");

      t.igual(lista.length, 4, "cuatro documentos, sin el vacío");
      t.igual(lista[0], "Calendario presupuestario");
      t.igual(lista[1], "RACI", "las siglas se quedan como están");
      t.igual(lista[2], "Actas de comités", "mayúscula inicial y sin el punto final");
      t.igual(lista[3], "Risk assessment");
      t.igual(listaDeEvidencias("").length, 0, "sin documentación, ninguna casilla");
      t.igual(listaDeEvidencias(undefined).length, 0);
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "agrupa por capacidad sin perder ni repetir ninguna subcapacidad",
    ejecutar(t) {
      const capacidades = capacidadesDePreparacion(DOMINIO);

      t.igual(capacidades.length, 2);
      t.igual(capacidades[0].nombre, "Presupuestos", "en el orden en que llegan");
      t.igual(capacidades[0].subcapacidades.length, 3, "la 1.3 se une a las suyas aunque llegue después");
      t.igual(capacidades[1].subcapacidades.length, 1);
      t.igual(
        capacidades.reduce((suma, capacidad) => suma + capacidad.subcapacidades.length, 0),
        DOMINIO.length,
        "las cuatro, ni una más ni una menos",
      );
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "el número de la capacidad sale del prefijo, también con un filtro puesto",
    ejecutar(t) {
      const solo = capacidadesDePreparacion([subcapacidad("Informes", "3.1 Reporting de gestión")]);

      t.igual(solo[0].numero, "3", "la tercera capacidad no se numera «1» por ir sola");

      const sinPrefijo = capacidadesDePreparacion([subcapacidad("Informes", "Reporting de gestión")]);

      t.igual(sinPrefijo[0].numero, "1", "sin prefijo, por su posición");
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "cada subcapacidad sale una vez, con sus preguntas y sus casillas",
    ejecutar(t) {
      const html = documentoDePreparacion({ domainLabel: "FP&A", domainTitle: "Planificación", subcapacidades: DOMINIO });

      DOMINIO.forEach((item) => {
        t.igual(cuantasVeces(html, `<h3>${item.subcapacidad}</h3>`), 1, item.subcapacidad);
      });

      t.igual(cuantasVeces(html, 'class="casilla"'), 12, "tres documentos por cuatro subcapacidades");
      t.igual(html.includes("las <b>4 subcapacidades</b>"), true, "la presentación cuenta las que van");
      t.igual(html.includes("(8 en total)"), true, "y las preguntas");
      t.igual(html.includes("agrupadas en 2 capacidades"), true);
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "con una sola capacidad lo dice con su nombre y sin índice",
    ejecutar(t) {
      const html = documentoDePreparacion({
        domainLabel: "FP&A",
        subcapacidades: [subcapacidad("Informes", "2.1 Reporting de gestión")],
      });

      t.igual(html.includes("<b>una subcapacidad</b> de Informes, dentro de FP&amp;A"), true);
      t.igual(html.includes("Qué veremos"), false, "un índice de una línea no dice nada");
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "no lleva ninguna puntuación aunque la subcapacidad las tenga",
    ejecutar(t) {
      const html = documentoDePreparacion({
        domainLabel: "FP&A",
        subcapacidades: [subcapacidad("Informes", "2.1 Reporting", {
          scores: { procesos: 1, tecnologia: 2, organizacion: 3 },
          comentario: "Nota interna del equipo",
        })],
      });

      t.igual(html.includes("Nota interna del equipo"), false, "las notas del taller son del equipo");
      t.igual(/Gap|Prioridad|Oleada|Score medio/.test(html), false, "ni gap, ni prioridad, ni oleada");
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "lo que escribe el usuario llega escapado, y el título sirve de nombre de archivo",
    ejecutar(t) {
      const html = documentoDePreparacion({
        cliente: "<script>alert(1)</script> A/B",
        domainLabel: "FP&A",
        fechaDeArchivo: "2026-10-08",
        subcapacidades: [subcapacidad("Informes", "2.1 <b>Reporting</b>")],
      });

      t.igual(html.includes("<script>"), false, "ningún script del nombre del cliente");
      t.igual(html.includes("<b>Reporting</b>"), false, "ni marcas de los datos");
      t.igual(html.includes("Asistentes por parte de &lt;script&gt;"), true);

      const titulo = /<title>([^<]*)<\/title>/.exec(html)?.[1] || "";

      t.igual(titulo.includes("/"), false, "sin la barra que Windows no admite");
      t.igual(titulo.endsWith("2026-10-08"), true, "con la fecha al final");
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "sin cliente, el hueco de asistentes no se queda a medias",
    ejecutar(t) {
      const html = documentoDePreparacion({ domainLabel: "FP&A", subcapacidades: DOMINIO });

      t.igual(html.includes("Asistentes por parte de la organización"), true);
    },
  },
  {
    grupo: "Preparación del taller",
    nombre: "la escala es la misma que enseña «Criterios F3M» en la herramienta",
    ejecutar(t) {
      Object.entries(RUBRICA_GENERAL).forEach(([palanca, niveles]) => {
        t.igual(niveles.length, 5, `${palanca}: cinco niveles`);

        const panel = new RegExp(`id="criteriaPanel-${palanca}"[\\s\\S]*?<ol class="criteria-levels">([\\s\\S]*?)</ol>`)
          .exec(indexHtml)?.[1] || "";

        niveles.forEach((texto, posicion) => {
          t.igual(
            panel.includes(`<strong>Nivel ${posicion + 1} - ${NIVELES_DE_LA_RUBRICA[posicion]}:</strong> ${texto}</li>`),
            true,
            `${palanca}, nivel ${posicion + 1}: «${texto}»`,
          );
        });
      });
    },
  },
];
