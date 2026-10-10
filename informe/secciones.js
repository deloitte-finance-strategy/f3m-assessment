/**
 * Las diapositivas del informe, una funcion por cada una.
 *
 * El informe anterior eran ocho secciones de documento dentro de pdf.js, con la
 * hoja de estilos al lado. Convertido en deck son una veintena de diapositivas y
 * ya no cabian con nada mas.
 *
 * Aqui tampoco hay DOM ni estado: entra el objeto que arma
 * buildEnhancedPdfReportData() en app.js y salen cadenas.
 *
 * El orden y la numeracion no se deciden aqui sino en informe/pdf.js, que es
 * quien conoce el deck entero. Cada seccion solo sabe pintar su cuerpo.
 */

import { average } from "../core/calculo.js?v=33";
import { normalizarLogo } from "../core/escenario.js?v=33";

import {
  COLOR_DE_PALANCA,
  escapeAttr,
  escapeHtml,
  formatMedia,
  formatNumber,
  priorityColor,
} from "../core/presentacion.js?v=33";

import { barrasHtml, estiloDeCalor, svgBullet, svgDonut, svgEscalaDeMadurez } from "./graficos.js?v=33";


/**
 * Cuantas filas caben en una diapositiva sin recortarse.
 *
 * La diapositiva mide 190mm y el cuerpo util, quitando cabecera y pie, unos
 * 128mm. Estos numeros salen de dividir esos 128mm entre lo que ocupa cada
 * fila, y son el motivo por el que paginar() existe: el informe anterior
 * truncaba a 10 y a 15 filas, y quien lo recibia creia estar viendo el roadmap
 * entero.
 *
 * Si se cambia el tamano de letra de una tabla, hay que volver a pasar
 * tests/comprobar-desbordes.js, que es quien mide de verdad.
 */
const POR_DIAPOSITIVA = {
  calor: 10,
  capacidades: 10,
  // Cinco y no seis. Con seis, la primera diapositiva del roadmap se pasaba 10
  // px y recortaba en silencio: las iniciativas sugeridas son de largo variable
  // y una que envuelve a tres lineas se come el margen. Lo encontro
  // informe/desbordes.js en su primera pasada, y estaba asi desde antes.
  //
  // Con quince filas el reparto sigue siendo de tres diapositivas —5+5+5 en vez
  // de 6+6+3—, asi que no cuesta ninguna pagina de mas y ademas quedan mejor
  // equilibradas.
  roadmap: 5,
  // Las mismas filas que el roadmap, que es la tabla a la que se parece: una
  // iniciativa sugerida de largo variable por fila.
  urgentes: 5,
  brechas: 10,
  casosDeIa: 9,
  comentarios: 6,
};


/** Reparte una lista en tandas, siempre al menos una (aunque venga vacia). */
export function paginar(filas, porTanda) {
  if (!filas.length) {
    return [[]];
  }

  const tandas = [];

  for (let desde = 0; desde < filas.length; desde += porTanda) {
    tandas.push(filas.slice(desde, desde + porTanda));
  }

  return tandas;
}


/** "2 de 3", o cadena vacia si solo hay una. */
function deTantas(indice, total) {
  return total > 1 ? `${indice + 1} de ${total}` : "";
}


// ============================================================ apertura y cierre

export function portada(data) {
  if (data.dominios) {
    return portadaDelProyecto(data);
  }

  return `
    ${logoDeLaPortada(data)}
    <p class="portada-antetitulo">Finance Strategy · F3M Assessment</p>
    <h1>Informe preliminar de madurez<b>${escapeHtml(data.domainLabel)}</b></h1>
    ${data.cliente ? `<p class="portada-cliente">${escapeHtml(data.cliente)}</p>` : ""}
    <p class="portada-bajada">
      Lectura de la función financiera, diagnóstico del dominio, brechas frente a
      objetivo, oportunidades de inteligencia artificial y roadmap de iniciativas.
    </p>

    <div class="portada-datos">
      <div><span>Dominio analizado</span><strong>${escapeHtml(data.domainTitle || data.domainLabel)}</strong></div>
      <div><span>Origen de los datos</span><strong>${escapeHtml(data.scenarioLabel)}</strong></div>
      <div><span>Filtros aplicados</span><strong>${escapeHtml(data.filters)}</strong></div>
      <div><span>Objetivo base</span><strong>${escapeHtml(String(data.targetMaturity))}</strong></div>
      <div><span>Fecha de generación</span><strong>${escapeHtml(data.generatedAt)}</strong></div>
    </div>
  `;
}


/**
 * El logo del cliente, arriba a la derecha y sobre blanco: casi todos estan
 * pensados para fondo claro, y la portada es negra. Se vuelve a comprobar aqui
 * aunque la aplicacion ya lo haga: lo que llega al src de una imagen de un
 * entregable no puede depender de que nadie se acuerde de validarlo antes.
 */
function logoDeLaPortada(data) {
  const logo = normalizarLogo(data.logo);

  return logo
    ? `<img class="portada-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(data.cliente ? `Logo de ${data.cliente}` : "Logo del cliente")}">`
    : "";
}


/**
 * La portada del informe de todo el proyecto: los dominios que recorre, en
 * vez de uno, y que no lleva filtros.
 */
function portadaDelProyecto(data) {
  const nombres = enumerar(data.dominios.map((dominio) => dominio.domainLabel));

  // Hasta tres nombres caben en el titulo. Con mas, el titulo dice cuantos y
  // los nombres bajan a la entradilla: nueve en letra de portada eran cuatro
  // lineas y empujaban los datos fuera de la diapositiva.
  const enElTitulo = data.dominios.length <= 3;
  const cuantos = ["", "", "", "", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Los nueve"][data.dominios.length]
    || String(data.dominios.length);

  return `
    ${logoDeLaPortada(data)}
    <p class="portada-antetitulo">Finance Strategy · F3M Assessment</p>
    <h1>Informe preliminar de madurez<b>${escapeHtml(enElTitulo ? nombres : `${cuantos} dominios`)}</b></h1>
    ${data.cliente ? `<p class="portada-cliente">${escapeHtml(data.cliente)}</p>` : ""}
    <p class="portada-bajada">
      ${enElTitulo ? "" : `${escapeHtml(nombres)}. `}Lectura de la función financiera y un capítulo por
      cada dominio evaluado: diagnóstico, brechas frente a objetivo, roadmap de iniciativas y
      oportunidades de inteligencia artificial.
    </p>

    <div class="portada-datos">
      <div><span>Dominios analizados</span><strong>${data.dominios.length} de ${escapeHtml(String(data.global?.dominiosTotales || 9))}</strong></div>
      <div><span>Origen de los datos</span><strong>${escapeHtml(data.scenarioLabel)}</strong></div>
      <div><span>Filtros aplicados</span><strong>Ninguno</strong></div>
      <div><span>Fecha de generación</span><strong>${escapeHtml(data.generatedAt)}</strong></div>
    </div>
  `;
}


/** "FP&A", "FP&A y Tesorería", "FP&A, Tesorería y Fiscal". */
function enumerar(nombres) {
  if (nombres.length <= 1) {
    return nombres.join("");
  }

  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}


/**
 * El indice, una linea por seccion y no por diapositiva.
 *
 * Una seccion que paginar() reparte en varias diapositivas llega como varias
 * entradas seguidas con el mismo titulo. Listadas tal cual, el indice decia
 * "Roadmap e iniciativas" tres veces, con tres numeros, y parecian tres
 * apartados distintos. Juntas son una linea con su rango: "16–18".
 */
export function indice(plan, { porPartes = false } = {}) {
  if (porPartes) {
    return indicePorPartes(plan);
  }

  const partes = [];

  plan
    .filter((seccion) => seccion.enIndice !== false)
    .forEach((seccion) => {
      const ultima = partes[partes.length - 1];

      if (!ultima || ultima.parte !== seccion.parte) {
        partes.push({ parte: seccion.parte, filas: [] });
      }

      const filas = partes[partes.length - 1].filas;
      const anterior = filas[filas.length - 1];

      if (anterior && anterior.titulo === seccion.titulo && anterior.hasta === seccion.numero - 1) {
        anterior.hasta = seccion.numero;
      } else {
        filas.push({ titulo: seccion.titulo, desde: seccion.numero, hasta: seccion.numero });
      }
    });

  const bloques = partes
    .map((bloque) => `
      <p class="indice-parte">${escapeHtml(bloque.parte)}</p>
      ${bloque.filas
        .map((fila) => `
          <div class="indice-fila">
            <span>${escapeHtml(fila.titulo)}</span>
            <i></i>
            <b>${fila.desde === fila.hasta ? fila.desde : `${fila.desde}–${fila.hasta}`}</b>
          </div>
        `)
        .join("")}
    `)
    .join("");

  return `<div class="indice">${bloques}</div>`;
}


/**
 * El indice del informe de todo el proyecto: un bloque por parte.
 *
 * Con un capitulo por dominio, una linea por seccion eran unas diez por
 * dominio, y con cinco dominios el indice ya no cabia en su diapositiva. Aqui
 * cada parte es una linea con su rango —que es lo que se busca en un deck
 * largo: donde empieza el dominio que interesa— y debajo, en pequeño, sus
 * secciones con su numero. Hasta cinco partes van en una columna; con mas, en
 * dos, llenando primero la de la izquierda para que se lean en orden.
 */
function indicePorPartes(plan) {
  const partes = [];

  plan
    .filter((seccion) => seccion.parte !== "Apertura" && seccion.parte !== "Cierre")
    .forEach((seccion) => {
      let parte = partes[partes.length - 1];

      if (!parte || parte.parte !== seccion.parte) {
        parte = {
          parte: seccion.parte,
          titulo: seccion.tituloDeParte || seccion.parte,
          desde: seccion.numero,
          hasta: seccion.numero,
          filas: [],
        };

        partes.push(parte);
      }

      parte.hasta = seccion.numero;

      if (seccion.enIndice === false) {
        return;
      }

      const anterior = parte.filas[parte.filas.length - 1];

      if (anterior && anterior.titulo === seccion.titulo && anterior.hasta === seccion.numero - 1) {
        anterior.hasta = seccion.numero;
      } else {
        parte.filas.push({ titulo: seccion.titulo, desde: seccion.numero, hasta: seccion.numero });
      }
    });

  const rango = ({ desde, hasta }) => (desde === hasta ? `${desde}` : `${desde}–${hasta}`);

  const bloques = partes
    .map((parte, numero) => `
      <div class="indice-bloque">
        <div class="indice-fila indice-fila-parte">
          <span>Parte ${numero + 1} · ${escapeHtml(parte.titulo)}</span>
          <i></i>
          <b>${rango(parte)}</b>
        </div>
        <p class="indice-detalle">
          ${parte.filas
            .map((fila) => `<span class="indice-entrada">${escapeHtml(fila.titulo)} <b>${rango(fila)}</b></span>`)
            .join(" · ")}
        </p>
      </div>
    `)
    .join("");

  const filasPorColumna = partes.length > 5 ? Math.ceil(partes.length / 2) : partes.length;

  return `
    <div
      class="indice indice-por-partes${partes.length > 5 ? " indice-dos-columnas" : ""}"
      style="grid-template-rows: repeat(${filasPorColumna}, auto);"
    >${bloques}</div>
  `;
}


export function separador({ numero, titulo, texto }) {
  return `
    <p class="separador-numero">${escapeHtml(numero)}</p>
    <h2>${escapeHtml(titulo)}</h2>
    <p>${escapeHtml(texto)}</p>
  `;
}


export function cierre(data) {
  if (data.dominios) {
    return cierreDelProyecto(data);
  }

  return `
    <p class="separador-numero">Alcance de este informe</p>
    <h2>Cómo leer estas cifras</h2>
    <p>
      ${escapeHtml(textoDeAlcanceGlobal(data))}
      La parte de dominio recorre ${data.visibleItems.length} subcapacidades de
      ${escapeHtml(data.domainLabel)}, de las que ${data.scored.length} están puntuadas.
    </p>
    <div class="portada-datos">
      <div><span>Filtros aplicados</span><strong>${escapeHtml(data.filters)}</strong></div>
      <div><span>Origen de los datos</span><strong>${escapeHtml(data.scenarioLabel)}</strong></div>
      <div><span>Archivo de origen</span><strong>${escapeHtml(data.sourceFile)}</strong></div>
      <div><span>Fecha de generación</span><strong>${escapeHtml(data.generatedAt)}</strong></div>
    </div>
  `;
}


function textoDeAlcanceGlobal(data) {
  return data.global
    ? `La parte global recorre ${data.global.subcapacidades} subcapacidades de ${data.global.dominios} dominios`
      + (data.global.dominios < data.global.dominiosTotales
        ? `, de los ${data.global.dominiosTotales} del modelo.`
        : ", los nueve del modelo.")
    : "Este informe no incluye la parte global: no había dominios cargados al exportarlo.";
}


function cierreDelProyecto(data) {
  const porDominio = data.dominios
    .map((dominio) => `${dominio.domainLabel}, ${dominio.scored.length} de ${dominio.visibleItems.length} puntuadas`)
    .join("; ");

  return `
    <p class="separador-numero">Alcance de este informe</p>
    <h2>Cómo leer estas cifras</h2>
    <p>
      ${escapeHtml(textoDeAlcanceGlobal(data))}
      Después, un capítulo por cada dominio con alguna subcapacidad puntuada (${escapeHtml(porDominio)}).
      Los dominios sin empezar no tienen capítulo. Ninguna parte aplica los filtros de la herramienta.
    </p>
    <div class="portada-datos">
      <div><span>Filtros aplicados</span><strong>Ninguno</strong></div>
      <div><span>Origen de los datos</span><strong>${escapeHtml(data.scenarioLabel)}</strong></div>
      <div><span>Dominios con capítulo</span><strong>${data.dominios.length}</strong></div>
      <div><span>Fecha de generación</span><strong>${escapeHtml(data.generatedAt)}</strong></div>
    </div>
  `;
}


// ====================================================== piezas que se repiten

function kpi({ etiqueta, valor, nota, alerta = false }) {
  return `
    <article class="kpi${alerta ? " kpi-alerta" : ""}">
      <span>${escapeHtml(etiqueta)}</span>
      <strong>${escapeHtml(String(valor))}</strong>
      <small>${escapeHtml(nota)}</small>
    </article>
  `;
}


export function rejillaDeKpis(tarjetas) {
  return `<div class="rejilla-kpi">${tarjetas.map(kpi).join("")}</div>`;
}


/**
 * El titular en una frase, con lo que importa en negrita.
 *
 * En pantalla los tres titulares van unidos por puntos medios, que en una linea
 * de 9pt se leen bien. Proyectados a 13pt en una diapositiva no: se leen como
 * una lista sin verbo. Aqui se redactan como frases.
 */
export function titularHtml(titulares, sujeto) {
  if (!titulares) {
    return "";
  }

  if (titulares.aviso) {
    return `<p class="titular">${escapeHtml(titulares.aviso)}</p>`;
  }

  const frases = [];

  if (titulares.mayorBrecha) {
    frases.push(
      `La mayor brecha de ${escapeHtml(sujeto)} está en <b>${escapeHtml(titulares.mayorBrecha.grupo)}</b>`
        + `, con ${escapeHtml(formatMedia(titulares.mayorBrecha.gap))} puntos frente al objetivo.`,
    );
  }

  if (titulares.palancaMasDebil) {
    frases.push(
      `La palanca más débil es <b>${escapeHtml(titulares.palancaMasDebil.label)}</b>`
        + `, en ${escapeHtml(formatMedia(titulares.palancaMasDebil.media))} sobre 5.`,
    );
  }

  if (titulares.pendientes) {
    frases.push(`Quedan <b>${titulares.pendientes}</b> subcapacidades por evaluar.`);
  } else {
    frases.push("Todas las subcapacidades están evaluadas.");
  }

  return `<p class="titular">${frases.join(" ")}</p>`;
}


function escalaHtml({ score, objetivo, nota }) {
  return `
    <div class="panel escala">
      <h3>Posición en la escala de madurez F3M</h3>
      ${svgEscalaDeMadurez({ score, objetivo })}
      ${nota ? `<p class="nota" style="margin-top:3mm;">${escapeHtml(nota)}</p>` : ""}
    </div>
  `;
}


function marcaDePrioridad(prioridad) {
  return `
    <span class="marca-prioridad">
      <em style="background:${priorityColor(prioridad)}"></em>${escapeHtml(prioridad)}
    </span>
  `;
}


function tablaVacia(columnas, mensaje) {
  return `<tr class="tabla-vacia"><td colspan="${columnas}">${escapeHtml(mensaje)}</td></tr>`;
}


function radaresHtml(radarImages, { sufijo }) {
  return `
    <div class="rejilla-3">
      ${[
        ["Procesos", radarImages?.procesos, COLOR_DE_PALANCA.procesos],
        ["Tecnología", radarImages?.tecnologia, COLOR_DE_PALANCA.tecnologia],
        ["Organización", radarImages?.organizacion, COLOR_DE_PALANCA.organizacion],
      ]
        .map(([titulo, imagen, color]) => `
          <article class="panel panel-claro">
            <p class="radar-titulo"><em style="background:${color}"></em>${escapeHtml(titulo)}</p>
            ${
              imagen
                ? `<img class="radar" src="${escapeAttr(imagen)}" alt="Radar de ${escapeAttr(titulo)} ${escapeAttr(sufijo)}">`
                : `<p class="nota">No se pudo capturar el gráfico de ${escapeHtml(titulo)}.</p>`
            }
          </article>
        `)
        .join("")}
    </div>
  `;
}


// ================================================= parte 1 · funcion financiera

/**
 * Las cuatro cifras de la funcion financiera. Las comparten el panorama del
 * informe y el resumen de una pagina, para que no puedan decir cosas distintas.
 */
export function kpisDeLaFuncionFinanciera(global) {
  return [
    {
      etiqueta: "Score global F3M",
      valor: formatMedia(global.scoreGlobal),
      nota: "Promedio de las subcapacidades puntuadas de todos los dominios",
    },
    {
      etiqueta: "Gap medio vs objetivo",
      valor: formatMedia(global.gapMedio),
      nota: "Contra los objetivos definidos por capacidad y palanca",
    },
    {
      etiqueta: "Subcapacidades puntuadas",
      valor: `${global.evaluadas}/${global.subcapacidades}`,
      nota: global.subcapacidades
        ? `${Math.round((global.evaluadas / global.subcapacidades) * 100)}% de avance`
        : "Sin subcapacidades cargadas",
    },
    {
      etiqueta: "Prioridad alta",
      valor: String(global.highCount),
      nota: "Subcapacidades con gap igual o superior a 2",
      alerta: global.highCount > 0,
    },
  ];
}


export function panoramaGlobal(data) {
  const global = data.global;

  return `
    <div class="pila">
    ${rejillaDeKpis(kpisDeLaFuncionFinanciera(global))}

    <div class="rejilla-panorama crece">
      ${escalaHtml({
        score: global.scoreGlobal,
        objetivo: global.objetivoMedio,
        nota: "El marcador es el score global; la línea discontinua, el objetivo medio configurado.",
      })}
      ${titularHtml(global.titulares, "la función financiera")}
    </div>

    ${notaDeAlcanceGlobal(global)}
    </div>
  `;
}


/**
 * Que ambito esta mirando la parte global.
 *
 * Dice dos cosas que el informe no puede callar. Que no aplica los filtros
 * —es deliberado: los filtros son del dominio abierto y a nivel global no
 * significan nada— porque si no, el descuadre con la parte de dominio se lee
 * como un fallo. Y sobre cuantos dominios habla, porque con ocho cargados de
 * nueve las cifras son otras y nadie lo adivinaria.
 */
function notaDeAlcanceGlobal(global) {
  const partes = [
    `${global.subcapacidades} subcapacidades en ${global.dominios} dominios`,
    "No depende de los filtros activos de la herramienta",
  ];

  if (global.dominios < global.dominiosTotales) {
    partes.splice(
      1,
      0,
      `${global.dominiosTotales - global.dominios} dominio(s) sin cargar al generar el informe`,
    );
  }

  return `<p class="nota-alcance">${escapeHtml(partes.join(" · "))}</p>`;
}


export function rankingDeDominios(data) {
  const filas = [...data.global.filas].sort(
    (a, b) => (Number.isFinite(b.gap) ? b.gap : -1) - (Number.isFinite(a.gap) ? a.gap : -1),
  );

  const cuerpo = filas
    .map((fila) => {
      const esActivo = fila.id === data.domainId;

      return `
        <tr${esActivo ? ' style="background:#F0F5E6;"' : ""}>
          <td class="principal">${escapeHtml(fila.label)}${esActivo ? " ·" : ""}</td>
          <td class="celda-grafico">
            ${svgBullet({
              valor: fila.scoreMedio,
              objetivo: fila.targetMedio,
              etiqueta: `${fila.label}: ${formatNumber(fila.scoreMedio)} de 5, objetivo ${formatNumber(fila.targetMedio)}`,
            })}
          </td>
          <td class="num">${escapeHtml(formatMedia(fila.scoreMedio))}</td>
          <td class="num">${escapeHtml(formatMedia(fila.targetMedio))}</td>
          <td class="num">${escapeHtml(formatMedia(fila.gap))}</td>
          <td>${marcaDePrioridad(fila.prioridad)}</td>
          <td class="num">${fila.evaluadas}/${fila.total}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="tabla">
      <thead>
        <tr>
          <th style="width:17%;">Dominio</th>
          <th style="width:30%;">Madurez frente a objetivo</th>
          <th class="num" style="width:9%;">Score</th>
          <th class="num" style="width:10%;">Objetivo</th>
          <th class="num" style="width:8%;">Gap</th>
          <th style="width:14%;">Prioridad</th>
          <th class="num" style="width:12%;">Avance</th>
        </tr>
      </thead>
      <tbody>
        ${cuerpo || tablaVacia(7, "No hay dominios cargados.")}
      </tbody>
    </table>
    <p class="nota" style="margin-top:4mm;">
      Ordenados por brecha descendente. La barra es la madurez media del dominio y la marca vertical, su objetivo medio.
      ${data.global.filas.some((fila) => fila.id === data.domainId) ? "El dominio de este informe va señalado." : ""}
    </p>
  `;
}


/**
 * Lo mas urgente de la funcion financiera: las mismas iniciativas que el
 * Overview, de cualquier dominio. 'desde' es cuantas van en diapositivas
 * anteriores, para numerar seguido.
 */
export function masUrgentes(urgentes, tanda, desde) {
  const cuerpo = tanda
    .map((fila, indice) => `
      <tr>
        <td class="num">${desde + indice + 1}</td>
        <td>
          <span class="brecha-capacidad">${escapeHtml(fila.dominio)} · ${escapeHtml(fila.capacidad)}</span>
          <span class="principal">${escapeHtml(fila.subcapacidad)}</span>
        </td>
        <td class="num">${escapeHtml(formatMedia(fila.gap))}</td>
        <td>${escapeHtml(fila.iniciativa || "-")}</td>
      </tr>
    `)
    .join("");

  const cuantas = urgentes.total > urgentes.lista.length
    ? `Las ${urgentes.lista.length} de mayor gap, de ${urgentes.total} subcapacidades con prioridad alta en toda la función financiera.`
    : `${urgentes.total === 1 ? "La única subcapacidad" : `Las ${urgentes.total} subcapacidades`} con prioridad alta en toda la función financiera.`;

  return `
    <table class="tabla">
      <thead>
        <tr>
          <th class="num" style="width:5%;">#</th>
          <th style="width:33%;">Subcapacidad</th>
          <th class="num" style="width:8%;">Gap</th>
          <th style="width:54%;">Iniciativa sugerida</th>
        </tr>
      </thead>
      <tbody>
        ${cuerpo}
      </tbody>
    </table>
    <p class="nota" style="margin-top:4mm;">
      ${escapeHtml(cuantas)} No dependen de los filtros de la herramienta.
    </p>
  `;
}


export function radarGlobal(data) {
  return `
    ${radaresHtml(data.global.radarImages, { sufijo: "por dominio" })}
    <p class="nota" style="margin-top:4mm;">
      Nueve ejes, uno por dominio. La línea continua es la madurez actual y la discontinua, el objetivo configurado.
      Un dominio sin puntuar no se dibuja: su eje queda vacío.
    </p>
  `;
}


// ============================================================ parte 2 · dominio

export function resumenDelDominio(data) {
  return `
    <div class="pila">
    ${rejillaDeKpis([
      {
        etiqueta: "Score del dominio",
        valor: formatMedia(data.scoreGlobal),
        nota: data.scored.length
          ? "Promedio de las subcapacidades puntuadas"
          : "Pendiente de scoring",
      },
      {
        etiqueta: "Gap medio vs objetivo",
        valor: formatMedia(data.gapMedio),
        nota: "Contra los objetivos definidos por capacidad y palanca",
      },
      {
        etiqueta: "Subcapacidades puntuadas",
        valor: `${data.scored.length}/${data.visibleItems.length}`,
        nota: data.visibleItems.length
          ? `${Math.round((data.scored.length / data.visibleItems.length) * 100)}% de avance`
          : "Ninguna subcapacidad pasa los filtros",
      },
      {
        etiqueta: "Prioridad alta",
        valor: String(data.highCount),
        nota: "Subcapacidades con gap igual o superior a 2",
        alerta: data.highCount > 0,
      },
    ])}

    <div class="rejilla-panorama crece">
      ${escalaHtml({
        score: data.scoreGlobal,
        objetivo: data.objetivoMedio,
        nota: `Madurez media de ${data.domainLabel} frente a su objetivo medio.`,
      })}
      ${titularHtml(data.titulares, `${data.domainLabel}`)}
    </div>
    </div>
  `;
}


export function perfilPorPalanca(data) {
  const palancas = [
    ["Procesos", "procesos", COLOR_DE_PALANCA.procesos],
    ["Tecnología", "tecnologia", COLOR_DE_PALANCA.tecnologia],
    ["Organización", "organizacion", COLOR_DE_PALANCA.organizacion],
  ];

  const anillos = palancas
    .map(([titulo, clave, color]) => {
      const media = average(
        data.visibleItems.map((item) => item.scores[clave]).filter(Number.isFinite),
      );

      const objetivo = average(
        data.metrics.map((entrada) => entrada.metrics.targets?.[clave]).filter(Number.isFinite),
      );

      const gap = Number.isFinite(media) && Number.isFinite(objetivo)
        ? Math.max(0, objetivo - media)
        : null;

      return `
        <article class="panel panel-claro anillo">
          <p class="radar-titulo"><em style="background:${color}"></em>${escapeHtml(titulo)}</p>
          ${svgDonut({ valor: media, objetivo, color, titulo })}
          <p class="nota" style="margin-top:3mm; text-align:center;">
            Brecha de ${escapeHtml(formatMedia(gap))} puntos
          </p>
        </article>
      `;
    })
    .join("");

  const prioridades = ["Alta", "Media", "Baja"].map((prioridad) => ({
    etiqueta: prioridad,
    valor: data.metrics.filter((entrada) => entrada.metrics.prioridad === prioridad).length,
    color: priorityColor(prioridad),
  }));

  prioridades.push({
    etiqueta: "Pendiente",
    valor: data.metrics.filter((entrada) => entrada.metrics.isPending).length,
    color: priorityColor("Pendiente"),
  });

  return `
    <div class="rejilla-3">${anillos}</div>

    <div class="panel" style="margin-top:6mm;">
      <h3>Subcapacidades por prioridad</h3>
      ${barrasHtml(prioridades, { maximo: Math.max(...prioridades.map((fila) => fila.valor), 1) })}
    </div>
  `;
}


export function radarPorCapacidad(data) {
  return `
    ${radaresHtml(data.radarImages, { sufijo: "por capacidad" })}
    <p class="nota" style="margin-top:4mm;">
      Un eje por capacidad de ${escapeHtml(data.domainLabel)}. La línea continua es la madurez actual y la discontinua, el objetivo.
    </p>
  `;
}


export function resumenPorCapacidad(filas) {
  const cuerpo = filas
    .map((fila) => `
      <tr>
        <td class="principal">${escapeHtml(fila.capacidad)}</td>
        <td class="celda-grafico">
          ${svgBullet({
            valor: fila.scoreMedio,
            objetivo: fila.targetMedio,
            etiqueta: `${fila.capacidad}: ${formatNumber(fila.scoreMedio)} de 5, objetivo ${formatNumber(fila.targetMedio)}`,
          })}
        </td>
        <td class="num">${escapeHtml(formatMedia(fila.procesos))}</td>
        <td class="num">${escapeHtml(formatMedia(fila.tecnologia))}</td>
        <td class="num">${escapeHtml(formatMedia(fila.organizacion))}</td>
        <td class="num">${escapeHtml(formatMedia(fila.scoreMedio))}</td>
        <td class="num">${escapeHtml(formatMedia(fila.targetMedio))}</td>
        <td class="num">${escapeHtml(formatMedia(fila.gap))}</td>
        <td>${marcaDePrioridad(fila.prioridad)}</td>
        <td class="num">${escapeHtml(fila.avance)}</td>
      </tr>
    `)
    .join("");

  return `
    <table class="tabla">
      <thead>
        <tr>
          <th style="width:18%;">Capacidad</th>
          <th style="width:16%;">Frente a objetivo</th>
          <th class="num">Proc.</th>
          <th class="num">Tecn.</th>
          <th class="num">Org.</th>
          <th class="num">Score</th>
          <th class="num">Objetivo</th>
          <th class="num">Gap</th>
          <th style="width:12%;">Prioridad</th>
          <th class="num">Avance</th>
        </tr>
      </thead>
      <tbody>
        ${cuerpo || tablaVacia(10, "No hay datos para los filtros actuales.")}
      </tbody>
    </table>
  `;
}


export function heatmap(entradas) {
  const cuerpo = entradas
    .map(({ item, metrics }) => `
      <tr>
        <td class="celda-nombre">
          <b>${escapeHtml(item.capacidad)}</b>
          ${escapeHtml(item.subcapacidad)}
        </td>
        <td class="celda-calor" style="${estiloDeCalor(item.scores.procesos)}">${escapeHtml(formatNumber(item.scores.procesos))}</td>
        <td class="celda-calor" style="${estiloDeCalor(item.scores.tecnologia)}">${escapeHtml(formatNumber(item.scores.tecnologia))}</td>
        <td class="celda-calor" style="${estiloDeCalor(item.scores.organizacion)}">${escapeHtml(formatNumber(item.scores.organizacion))}</td>
        <td class="celda-calor" style="${estiloDeCalor(metrics.scoreMedio)}">${escapeHtml(formatMedia(metrics.scoreMedio))}</td>
        <td class="celda-fin">${escapeHtml(formatMedia(metrics.gap))}</td>
        <td class="celda-fin">${marcaDePrioridad(metrics.prioridad)}</td>
      </tr>
    `)
    .join("");

  return `
    <table class="rejilla-calor">
      <thead>
        <tr>
          <th style="width:36%;">Subcapacidad</th>
          <th class="col-dato" style="width:9%;">Procesos</th>
          <th class="col-dato" style="width:9%;">Tecnología</th>
          <th class="col-dato" style="width:9%;">Organización</th>
          <th class="col-dato" style="width:9%;">Score medio</th>
          <th class="col-dato" style="width:8%;">Gap</th>
          <th class="col-dato" style="width:14%;">Prioridad</th>
        </tr>
      </thead>
      <tbody>
        ${cuerpo || tablaVacia(7, "No hay subcapacidades para los filtros actuales.")}
      </tbody>
    </table>
  `;
}


export function brechas(entradas, desde) {
  if (!entradas.length) {
    return `<p class="nota">No hay subcapacidades puntuadas para los filtros actuales.</p>`;
  }

  const tarjetas = entradas
    .map(({ item, metrics }, indice) => `
      <article class="brecha">
        <span class="brecha-orden">${desde + indice + 1}</span>
        <div>
          <span class="brecha-capacidad">${escapeHtml(item.capacidad)}</span>
          <p class="brecha-titulo">${escapeHtml(item.subcapacidad)}</p>
          ${svgBullet({
            valor: metrics.scoreMedio,
            objetivo: metrics.targetMedio,
            etiqueta: `${item.subcapacidad}: ${formatNumber(metrics.scoreMedio)} de 5, objetivo ${formatNumber(metrics.targetMedio)}`,
          })}
          <p class="nota" style="margin-top:1.4mm;">
            Gap ${escapeHtml(formatMedia(metrics.gap))} · ${escapeHtml(metrics.prioridad)} · ${escapeHtml(metrics.oleada)}
          </p>
        </div>
      </article>
    `)
    .join("");

  return `<div class="brechas">${tarjetas}</div>`;
}


// ============================================================ parte 3 · roadmap

const COLOR_DE_OLEADA = {
  "Oleada 1": { fondo: "#F7DDDA", texto: "#7D1F19" },
  "Oleada 2": { fondo: "#FBE9CC", texto: "#7A4700" },
  "Oleada 3": { fondo: "#E2EFD4", texto: "#315D11" },
  Pendiente: { fondo: "#EDEFEC", texto: "#78817A" },
};


function chipDeOleada(oleada) {
  const color = COLOR_DE_OLEADA[oleada] || COLOR_DE_OLEADA.Pendiente;

  return `<span class="chip-oleada" style="background:${color.fondo}; color:${color.texto};">${escapeHtml(oleada)}</span>`;
}


export function roadmap(entradas) {
  const cuerpo = entradas
    .map(({ item, metrics }) => `
      <tr>
        <td>
          <span class="brecha-capacidad">${escapeHtml(item.capacidad)}</span>
          <span class="principal">${escapeHtml(item.subcapacidad)}</span>
        </td>
        <td>${chipDeOleada(metrics.oleada)}</td>
        <td>${marcaDePrioridad(metrics.prioridad)}</td>
        <td>${escapeHtml(item.iniciativaSugerida)}</td>
        <td>${escapeHtml(item.owner || "-")}</td>
        <td>${escapeHtml(item.status || "-")}</td>
      </tr>
    `)
    .join("");

  return `
    <table class="tabla">
      <thead>
        <tr>
          <th style="width:22%;">Subcapacidad</th>
          <th style="width:9%;">Oleada</th>
          <th style="width:11%;">Prioridad</th>
          <th style="width:36%;">Iniciativa sugerida</th>
          <th style="width:11%;">Responsable</th>
          <th style="width:11%;">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${cuerpo || tablaVacia(6, "No hay iniciativas para los filtros actuales.")}
      </tbody>
    </table>
  `;
}


// ================================================================ casos de IA

/**
 * Las dos excepciones tonales de las etiquetas de tipo de IA.
 *
 * Son las mismas que en app.js y por el mismo motivo: "Agentica" en alto
 * contraste porque es lo que todo el mundo pregunta, y "Automatizacion" en el
 * tratamiento mas apagado porque es la etiqueta honesta de "esto no es IA de
 * verdad" y no debe lucir como si lo fuera.
 */
const CLASE_DE_TIPO_DE_IA = {
  Agentica: "es-agentica",
  Agéntica: "es-agentica",
  Automatizacion: "es-automatizacion",
  Automatización: "es-automatizacion",
};


export function panoramaDeIa(ia, data) {
  const barras = (grupos) =>
    barrasHtml(
      grupos.map((grupo) => ({
        etiqueta: grupo.valor,
        valor: grupo.cuenta,
        color: "#2F3A31",
        texto: String(grupo.cuenta),
      })),
      { maximo: Math.max(...grupos.map((grupo) => grupo.cuenta), 1) },
    );

  return `
    <div class="rejilla-2">
      <div class="panel">
        <h3>Por tipo de valor</h3>
        ${barras(ia.porTipoDeValor)}
      </div>
      <div class="panel">
        <h3>Por tipo de inteligencia artificial</h3>
        ${barras(ia.porTipoDeIa)}
      </div>
    </div>

    <div class="panel panel-claro" style="margin-top:6mm;">
      <h3>Qué significa cada tipo de valor</h3>
      <div class="leyenda">
        ${ia.porTipoDeValor
          .map((grupo) => `
            <div>
              <b>${escapeHtml(grupo.valor)}</b>
              <span>${escapeHtml(grupo.definicion || "")}</span>
            </div>
          `)
          .join("")}
      </div>
    </div>

    <p class="nota" style="margin-top:4mm;">
      ${escapeHtml(
        `${ia.total} casos de uso distintos aplican a las subcapacidades de ${data.domainLabel} que pasan los filtros activos. `
          + "Un mismo caso puede aplicar a varias subcapacidades y se cuenta una sola vez.",
      )}
    </p>
  `;
}


export function fichasDeIa(casos) {
  if (!casos.length) {
    return `<p class="nota">No hay casos de uso de IA para los filtros actuales.</p>`;
  }

  const tarjetas = casos
    .map((caso) => {
      const claseIa = CLASE_DE_TIPO_DE_IA[caso.tipoIa] || "";

      const etiquetas = [
        caso.tipoValor
          ? `<span class="etiqueta etiqueta-valor">${escapeHtml(caso.tipoValor)}</span>`
          : "",
        caso.tipoIa
          ? `<span class="etiqueta etiqueta-ia ${claseIa}">${escapeHtml(caso.tipoIa)}</span>`
          : "",
      ].join("");

      return `
        <article class="tarjeta">
          ${etiquetas ? `<div class="etiquetas">${etiquetas}</div>` : ""}
          <h4>${escapeHtml(caso.titulo)}</h4>
          ${caso.descripcion ? `<p>${escapeHtml(caso.descripcion)}</p>` : ""}
          ${
            caso.subcapacidades?.length
              ? `<p class="nota" style="margin-top:2.4mm;">${escapeHtml(
                  caso.subcapacidades.length === 1
                    ? caso.subcapacidades[0]
                    : `${caso.subcapacidades.length} subcapacidades`,
                )}</p>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  return `<div class="tarjetas">${tarjetas}</div>`;
}


// ============================================================== comentarios

export function comentarios(items) {
  if (!items.length) {
    return `<p class="nota">No hay comentarios registrados para los filtros actuales.</p>`;
  }

  const tarjetas = items
    .map((item) => `
      <article class="tarjeta">
        <span class="tarjeta-origen">${escapeHtml(item.capacidad)}</span>
        <h4>${escapeHtml(item.subcapacidad)}</h4>
        <p>${escapeHtml(item.comentario)}</p>
      </article>
    `)
    .join("");

  return `<div class="tarjetas">${tarjetas}</div>`;
}


export { POR_DIAPOSITIVA, deTantas };
