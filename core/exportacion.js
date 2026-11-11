/**
 * El CSV que se abre en el equipo del consultor y se le envia al cliente.
 *
 * Todo lo de aqui esta hecho a proposito para Excel en espanol, y cada decision
 * arregla algo que se vio fallar. Vivia en app.js sin ninguna prueba, aunque no
 * necesita ni DOM ni estado: solo recibe filas y devuelve texto.
 */

import { titulosDeCasos } from "./biblioteca.js?v=38";
import { getMaturityLevel } from "./calculo.js?v=38";
import { COLOR_DE_OLEADA, colorDeCalor } from "./presentacion.js?v=38";


// Excel con configuración regional española espera punto y coma, no coma: con
// comas volcaba todas las columnas en una sola celda. csvEscape ya entrecomilla
// los campos que contienen ";", así que el separador es seguro.
export const CSV_SEPARATOR = ";";

// Marca de orden de bytes. Sin ella Excel abre el archivo como ANSI y
// "Tecnología" llega ilegible.
export const CSV_BOM = "﻿";


// Excel y LibreOffice tratan como formula cualquier celda que empiece por =, +,
// - o @. En los campos de texto libre —comentarios, responsable— eso da dos
// problemas a la vez:
//
// - Seguridad: una celda como =HYPERLINK(...) o una llamada DDE se evalua al
//   abrir el archivo, y estos CSV se abren en el equipo del consultor y se
//   envian al cliente. En un escenario compartido, cualquiera con el enlace
//   puede dejar ese comentario.
// - Presentacion: un comentario que empieza por un guion —"- Falta gobierno"—
//   se ensena hoy como #NAME? en vez de como el texto que se escribio.
//
// El apostrofo delante es la mitigacion habitual: marca la celda como texto y
// la hoja de calculo no lo muestra. Ningun campo numerico de la exportacion
// empieza por esos caracteres, asi que no les afecta.
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;


// Los numeros, con coma decimal y sin separador de miles.
//
// El resto del archivo esta hecho a proposito para Excel en espanol —el punto y
// coma y la marca de orden de bytes estan aqui por eso—, pero los numeros salian
// con punto: "3.17". Excel en espanol no lo lee como el numero 3,17, asi que las
// columnas de score, objetivo y gap llegaban como TEXTO. Quien recibia el CSV no
// podia sumarlas, ni ordenarlas, ni llevarlas a una tabla dinamica.
//
// Sin separador de miles a proposito: un punto de millar volveria a romper la
// lectura. Con scores del 1 al 5 no se llega ahi, pero no depende de eso.
const FORMATO_DE_NUMERO_CSV = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
  useGrouping: false,
});


export function csvEscape(value) {
  // Un numero se escribe como numero. Y no pasa por la proteccion de formulas,
  // que es para el texto que escribe la gente: un numero no puede ser una.
  if (typeof value === "number" && Number.isFinite(value)) {
    return FORMATO_DE_NUMERO_CSV.format(value);
  }

  const text = String(value ?? "");
  const seguro = INICIO_DE_FORMULA.test(text) ? `'${text}` : text;

  // La coma ya no obliga a entrecomillar: el separador es el punto y coma, y
  // entrecomillar "3,17" hacia que Excel volviera a tratarlo como texto.
  return /["\r\n;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}


/**
 * Como se llama cada columna en la primera fila del archivo.
 *
 * Las claves de las filas son nombres de codigo, sin tildes ni espacios, y
 * salian tal cual de cabecera: «Tecnologia», «ObjetivoOrganizacion»,
 * «ScoreMedio», «Owner». Ese archivo se le envia al cliente. Las claves no se
 * tocan —los radares leen estas mismas filas por ellas—; solo cambia lo que se
 * escribe arriba. Una columna que no este aqui sale con su clave.
 */
const TITULOS = {
  ObjetivoProcesos: "Objetivo Procesos",
  Tecnologia: "Tecnología",
  ObjetivoTecnologia: "Objetivo Tecnología",
  Organizacion: "Organización",
  ObjetivoOrganizacion: "Objetivo Organización",
  ScoreMedio: "Score medio",
  ObjetivoMedio: "Objetivo medio",
  TotalDeSubcapacidades: "Subcapacidades",
  IniciativaSugerida: "Iniciativa sugerida",
  Owner: "Responsable",
  CasosDeIa: "Casos de IA",
};


/** Las filas como CSV, con la cabecera tomada de la primera. */
export function toCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.map((header) => csvEscape(TITULOS[header] ?? header)).join(CSV_SEPARATOR),
  ];

  rows.forEach((row) => {
    csvRows.push(headers.map((header) => csvEscape(row[header])).join(CSV_SEPARATOR));
  });

  // Fin de línea CRLF: es lo que espera Excel.
  return CSV_BOM + csvRows.join("\r\n");
}


/**
 * Las tres clases de fila comparten columnas a proposito.
 *
 * El archivo lleva el resumen por capacidad y el detalle por subcapacidad en la
 * misma tabla —y el de todo el proyecto, ademas, una fila por dominio—,
 * distinguidos por la primera columna. Para que Excel las lea como una sola
 * tabla, todas tienen que declarar EXACTAMENTE las mismas claves y en el mismo
 * orden: toCsv() toma la cabecera de la primera fila, asi que una clave de
 * menos en el resumen desplazaria todas las columnas del detalle.
 */
const COLUMNAS = [
  "Tipo",
  "Dominio",
  "Capacidad",
  "Subcapacidad",
  "Puntuadas",
  "TotalDeSubcapacidades",
  "Procesos",
  "ObjetivoProcesos",
  "Tecnologia",
  "ObjetivoTecnologia",
  "Organizacion",
  "ObjetivoOrganizacion",
  "ScoreMedio",
  "ObjetivoMedio",
  "Nivel",
  "Gap",
  "Prioridad",
  "Oleada",
  "IniciativaSugerida",
  "Owner",
  "Estado",
  "Comentarios",
  // Al final y no junto a la iniciativa, a proposito: quien tenga una
  // plantilla montada sobre el orden de antes solo ve una columna mas.
  "CasosDeIa",
];


/**
 * Lo que dice la primera columna de cada fila.
 *
 * Decia «Resumen» y «Roadmap», que no dicen de que es la fila: la de «Roadmap»
 * lleva las puntuaciones de una subcapacidad, no solo su iniciativa. Con el
 * nombre de lo que es, filtrar la columna en Excel se explica solo.
 */
export const TIPO_DE_FILA = {
  dominio: "Dominio",
  capacidad: "Capacidad",
  subcapacidad: "Subcapacidad",
};


/** Una fila con las columnas del archivo en su orden, y el resto en blanco. */
function fila(valores) {
  const salida = {};

  COLUMNAS.forEach((columna) => {
    salida[columna] = valores[columna] ?? "";
  });

  return salida;
}


/**
 * Las filas de dominio, una por cada uno, desde agregarPorDominio(). Solo las
 * lleva el archivo de todo el proyecto: son la tabla del Overview.
 *
 * El objetivo de cada palanca es la media de los de sus capacidades, asi que
 * puede no ser entero («4,2»). Es el mismo que dibuja el radar del Overview.
 */
export function filasDeDominio(dominios) {
  return dominios.map((dominio) =>
    fila({
      Tipo: TIPO_DE_FILA.dominio,
      Dominio: dominio.label,

      Puntuadas: dominio.evaluadas,
      TotalDeSubcapacidades: dominio.total,

      Procesos: dominio.procesos ?? "",
      ObjetivoProcesos: dominio.objetivoProcesos ?? "",

      Tecnologia: dominio.tecnologia ?? "",
      ObjetivoTecnologia: dominio.objetivoTecnologia ?? "",

      Organizacion: dominio.organizacion ?? "",
      ObjetivoOrganizacion: dominio.objetivoOrganizacion ?? "",

      ScoreMedio: dominio.scoreMedio ?? "",
      ObjetivoMedio: dominio.targetMedio ?? "",
      Nivel: getMaturityLevel(dominio.scoreMedio) ?? "",

      Gap: dominio.gap ?? "",
      Prioridad: dominio.prioridad,
    }),
  );
}


/**
 * Las filas de resumen, una por capacidad, desde agregarPorCapacidad().
 *
 * `dominio` es el nombre del dominio al que pertenecen. Va en todas las filas,
 * tambien en el archivo de un solo dominio: quien junta en una hoja los datos
 * de varios necesita saber de cual es cada fila, y antes solo lo decia el
 * nombre del archivo.
 */
export function filasDeResumen(capacidades, dominio = "") {
  return capacidades.map((capacidad) =>
    fila({
      Tipo: TIPO_DE_FILA.capacidad,
      Dominio: dominio,
      Capacidad: capacidad.capacidad,

      // Lo que la tabla del Dashboard dice en «Avance» y el archivo callaba.
      Puntuadas: capacidad.evaluadas ?? "",
      TotalDeSubcapacidades: capacidad.total ?? "",

      Procesos: capacidad.procesos ?? "",
      ObjetivoProcesos: capacidad.objetivos.procesos,

      Tecnologia: capacidad.tecnologia ?? "",
      ObjetivoTecnologia: capacidad.objetivos.tecnologia,

      Organizacion: capacidad.organizacion ?? "",
      ObjetivoOrganizacion: capacidad.objetivos.organizacion,

      ScoreMedio: capacidad.scoreMedio ?? "",
      ObjetivoMedio: capacidad.targetMedio ?? "",

      // La guarda de "sin score" vive dentro de getMaturityLevel().
      Nivel: getMaturityLevel(capacidad.scoreMedio) ?? "",

      Gap: capacidad.gap ?? "",
      Prioridad: capacidad.prioridad,
    }),
  );
}


/** Las filas de detalle, una por subcapacidad, desde [{ item, metrics }]. */
export function filasDeRoadmap(entradas, dominio = "") {
  return entradas.map(({ item, metrics }) =>
    fila({
      Tipo: TIPO_DE_FILA.subcapacidad,
      Dominio: dominio,
      Capacidad: item.capacidad,
      Subcapacidad: item.subcapacidad,

      Procesos: item.scores.procesos ?? "",
      ObjetivoProcesos: metrics.targets.procesos,

      Tecnologia: item.scores.tecnologia ?? "",
      ObjetivoTecnologia: metrics.targets.tecnologia,

      Organizacion: item.scores.organizacion ?? "",
      ObjetivoOrganizacion: metrics.targets.organizacion,

      ScoreMedio: metrics.scoreMedio ?? "",
      ObjetivoMedio: metrics.targetMedio ?? "",
      Nivel: metrics.nivel ?? "",
      Gap: metrics.gap ?? "",

      Prioridad: metrics.prioridad,
      Oleada: metrics.oleada,
      IniciativaSugerida: item.iniciativaSugerida,
      Owner: item.owner,
      Estado: item.status,
      Comentarios: item.comentario,

      // Los titulos, como los lee la pestana IA: la misma lectura de ai.cases
      // que cuenta las apariciones, asi que el archivo y la pantalla no pueden
      // partirlos de forma distinta.
      CasosDeIa: titulosDeCasos(item.ai?.cases).join("; "),
    }),
  );
}


/**
 * El archivo de todo el proyecto: los dominios, sus capacidades y sus
 * subcapacidades, en ese orden.
 *
 * Por clase de fila y no dominio a dominio, a proposito: asi lo primero que se
 * ve al abrirlo es la tabla del Overview, y debajo, cada vez con mas detalle,
 * lo mismo que lleva el archivo de un dominio. En Excel se separan filtrando
 * la primera columna.
 *
 * Recibe, por dominio, { label, resumen, capacidades, entradas }: la fila de
 * agregarPorDominio(), las de agregarPorCapacidad() y [{ item, metrics }].
 */
export function filasDelProyecto(dominios) {
  return [
    ...filasDeDominio(dominios.map((dominio) => ({ ...dominio.resumen, label: dominio.label }))),
    ...dominios.flatMap((dominio) => filasDeResumen(dominio.capacidades, dominio.label)),
    ...dominios.flatMap((dominio) => filasDeRoadmap(dominio.entradas, dominio.label)),
  ];
}



// ======================================================== el Excel (.xlsx)

/**
 * Las columnas de cada hoja del Excel: una hoja por nivel.
 *
 * El CSV mete los tres niveles en una sola tabla, con las mismas columnas para
 * todos, y por eso las filas de dominio llevaban en blanco la capacidad, la
 * iniciativa y el responsable. En el Excel cada nivel va en su hoja y con lo
 * que tiene sentido en el: sin la columna «Tipo», que ya es el nombre de la
 * hoja.
 */
const PALANCAS_Y_OBJETIVOS = [
  "Procesos",
  "ObjetivoProcesos",
  "Tecnologia",
  "ObjetivoTecnologia",
  "Organizacion",
  "ObjetivoOrganizacion",
];

const RESULTADO = ["ScoreMedio", "ObjetivoMedio", "Nivel", "Gap", "Prioridad"];

export const COLUMNAS_POR_HOJA = {
  dominio: ["Dominio", "Puntuadas", "TotalDeSubcapacidades", ...PALANCAS_Y_OBJETIVOS, ...RESULTADO],
  capacidad: ["Dominio", "Capacidad", "Puntuadas", "TotalDeSubcapacidades", ...PALANCAS_Y_OBJETIVOS, ...RESULTADO],
  subcapacidad: [
    "Dominio",
    "Capacidad",
    "Subcapacidad",
    ...PALANCAS_Y_OBJETIVOS,
    ...RESULTADO,
    "Oleada",
    "IniciativaSugerida",
    "Owner",
    "Estado",
    "Comentarios",
    "CasosDeIa",
  ],
};

const NOMBRE_DE_HOJA = {
  dominio: "Dominios",
  capacidad: "Capacidades",
  subcapacidad: "Subcapacidades",
};


// La prioridad, con el chip de su oleada: Alta y Oleada 1 son la misma
// urgencia, y en la hoja se leen igual.
const COLOR_DE_PRIORIDAD_EN_CHIP = {
  Alta: COLOR_DE_OLEADA["Oleada 1"],
  Media: COLOR_DE_OLEADA["Oleada 2"],
  Baja: COLOR_DE_OLEADA["Oleada 3"],
  Pendiente: COLOR_DE_OLEADA.Pendiente,
};

/**
 * Ancho y forma de cada columna. El ancho va en caracteres, que es como lo
 * mide Excel; lo que es texto largo se parte en lineas dentro de la celda.
 */
const FORMA_DE_COLUMNA = {
  Dominio: { ancho: 18 },
  Capacidad: { ancho: 30, envolver: true },
  Subcapacidad: { ancho: 44, envolver: true },
  Puntuadas: { ancho: 11, tipo: "entero" },
  TotalDeSubcapacidades: { ancho: 15, tipo: "entero" },
  Procesos: { ancho: 10, tipo: "numero", dePalanca: true },
  ObjetivoProcesos: { ancho: 11, tipo: "numero", dePalanca: true },
  Tecnologia: { ancho: 11, tipo: "numero", dePalanca: true },
  ObjetivoTecnologia: { ancho: 11, tipo: "numero", dePalanca: true },
  Organizacion: { ancho: 12, tipo: "numero", dePalanca: true },
  ObjetivoOrganizacion: { ancho: 12, tipo: "numero", dePalanca: true },
  ScoreMedio: { ancho: 10, tipo: "numero", calor: true },
  ObjetivoMedio: { ancho: 10, tipo: "numero" },
  Nivel: { ancho: 21 },
  Gap: { ancho: 8, tipo: "numero" },
  Prioridad: { ancho: 11, chip: COLOR_DE_PRIORIDAD_EN_CHIP },
  Oleada: { ancho: 11, chip: COLOR_DE_OLEADA },
  IniciativaSugerida: { ancho: 58, envolver: true },
  Owner: { ancho: 24, envolver: true },
  Estado: { ancho: 13 },
  Comentarios: { ancho: 58, envolver: true },
  CasosDeIa: { ancho: 52, envolver: true },
};

const sinAlmohadilla = (color) => String(color || "").replace("#", "").toUpperCase();


/**
 * El estilo de una celda segun su columna, su nivel y lo que dice.
 *
 * Las medias van siempre con dos decimales, para que la columna se lea
 * alineada. El score y el objetivo de una palanca en una subcapacidad no son
 * medias sino lo que se eligio, un 3, y con dos decimales decian «3,00»: van
 * con el formato general, que enseña el 3 como 3 y un objetivo de 3,5 entero.
 */
function estiloDeCelda(clave, valor, nivel) {
  const forma = FORMA_DE_COLUMNA[clave] || {};
  const estilo = { borde: true, envolver: Boolean(forma.envolver) };

  if (forma.tipo === "numero") {
    estilo.formato = forma.dePalanca && nivel === "subcapacidad" ? null : "0.00";
    estilo.horizontal = "center";
  } else if (forma.tipo === "entero") {
    estilo.formato = "0";
    estilo.horizontal = "center";
  }

  // El score medio con el color de su nivel, el mismo del heatmap: una
  // columna que se lee de un vistazo, como la pantalla.
  if (forma.calor && typeof valor === "number") {
    const { fondo, texto } = colorDeCalor(valor);
    estilo.relleno = sinAlmohadilla(fondo);
    estilo.color = sinAlmohadilla(texto);
    estilo.negrita = true;
  }

  // Prioridad y oleada en su color, como los chips del informe.
  if (forma.chip && valor) {
    const color = forma.chip[valor];

    if (color) {
      estilo.relleno = sinAlmohadilla(color.fondo);
      estilo.color = sinAlmohadilla(color.texto);
    }

    estilo.negrita = true;
    estilo.horizontal = "center";
  }

  return estilo;
}


const ESTILO_DE_CABECERA = {
  negrita: true,
  color: "FFFFFF",
  relleno: "2B2B2B",
  envolver: true,
  vertical: "center",
  borde: true,
};


/**
 * Las hojas del Excel a partir de las filas del CSV: una por cada nivel que
 * traigan, en el orden dominio, capacidad, subcapacidad.
 *
 * Sale de las mismas filas que el CSV, y no de otro recorrido, para que los dos
 * archivos no puedan decir cosas distintas: el Excel solo las reparte y les da
 * formato. Un valor vacio se queda vacio, no en cero.
 */
export function hojasDeDatos(filas) {
  return Object.entries(TIPO_DE_FILA)
    .map(([nivel, tipo]) => {
      const columnas = COLUMNAS_POR_HOJA[nivel];
      const delNivel = filas.filter((filaDelCsv) => filaDelCsv.Tipo === tipo);

      return {
        nombre: NOMBRE_DE_HOJA[nivel],
        columnas: columnas.map((clave) => ({
          clave,
          titulo: TITULOS[clave] ?? clave,
          ancho: FORMA_DE_COLUMNA[clave]?.ancho,
        })),
        filas: delNivel.map((filaDelCsv) =>
          columnas.map((clave) => {
            const valor = filaDelCsv[clave];
            const vacio = valor === "" || valor === null || valor === undefined;

            return { valor: vacio ? null : valor, estilo: estiloDeCelda(clave, valor, nivel) };
          }),
        ),
        // Los nombres se quedan a la vista al desplazarse a la derecha.
        fijar: { filas: 1, columnas: nivel === "subcapacidad" ? 3 : nivel === "capacidad" ? 2 : 1 },
        filtro: true,
        estiloDeCabecera: ESTILO_DE_CABECERA,
        altoDeCabecera: 30,
      };
    })
    .filter((hoja) => hoja.filas.length);
}


/**
 * La primera hoja: de quien es el archivo y que lleva cada hoja.
 *
 * `lineas` es [[etiqueta, texto]]. El archivo se reenvia, y quien lo abre no
 * ha visto la herramienta: sin esto no sabria si lleva filtros ni de cuando es.
 */
export function hojaDePortada({ titulo, subtitulo = "", lineas = [] }) {
  return {
    nombre: "Portada",
    cabecera: false,
    sinCuadricula: true,
    columnas: [{ ancho: 22 }, { ancho: 90 }],
    filas: [
      [{ valor: titulo, estilo: { negrita: true, tamano: 16 } }],
      ...(subtitulo ? [[{ valor: subtitulo, estilo: { color: "5F6368" } }]] : []),
      [],
      ...lineas.map(([etiqueta, texto]) => [
        { valor: etiqueta, estilo: { negrita: true } },
        { valor: texto, estilo: { envolver: true } },
      ]),
    ],
  };
}
