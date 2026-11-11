/**
 * Un libro de Excel (.xlsx) de verdad, escrito a mano y sin librerias.
 *
 * El CSV se abria en Excel como una sola tabla gris: sin anchos, sin colores,
 * con los numeros a merced de la configuracion regional y con los tres niveles
 * —dominio, capacidad y subcapacidad— mezclados en las mismas filas. Un .xlsx
 * lleva todo eso dentro del archivo.
 *
 * Por que no una libreria. Las que escriben .xlsx con estilos pesan entre 500 KB
 * y 1 MB, y habria que vendorizarlas como Chart.js (ver vendor/LEEME.md). Lo que
 * esta herramienta necesita es poco y fijo: texto, numeros, unos pocos estilos,
 * anchos de columna, la primera fila fija y el filtro. Un .xlsx es un ZIP con
 * unos XML dentro, y esto son unas trescientas lineas que se prueban sin
 * navegador, como el resto de core/.
 *
 * Lo que NO hace, a proposito:
 *
 * - Comprimir. El ZIP va en modo «almacenado»: el archivo de todo el proyecto
 *   pesa unos cientos de KB, y comprimir obligaria a escribir un deflate.
 * - Formulas. Todo el texto va como texto en linea (inlineStr), nunca como
 *   formula, asi que un comentario que empiece por «=» no se evalua al abrir el
 *   archivo. En el CSV eso necesitaba el apostrofo delante; aqui no hace falta.
 * - Fechas. Ninguna columna de la exportacion las lleva.
 *
 * Uso: crearLibro({ titulo, hojas: [{ nombre, columnas, filas, fijar,
 * filtro }] }) devuelve los bytes del archivo (Uint8Array). Cada celda es un
 * valor —texto, numero o vacio— o { valor, estilo }, y cada estilo, un objeto
 * con lo que cambia frente al de por defecto (ver ESTILO_BASE).
 */


/** Lo que lleva cualquier celda: Arial 10, alineada arriba y sin relleno. */
const ESTILO_BASE = {
  negrita: false,
  tamano: 10,
  color: "1F1F1F",
  relleno: null,
  envolver: false,
  horizontal: null,
  vertical: "top",
  formato: null,
  borde: false,
};


// Caracteres que no caben en un XML 1.0 y dejarian el archivo sin abrir:
// controles y los dos no-caracteres del final del plano. Pueden llegar en un
// comentario pegado desde otro programa.
const NO_CABEN_EN_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

// Y los sustitutos sueltos: media pareja de un emoji cortado. Se busca la
// pareja entera o la mitad, y solo se quita la mitad. Sin «lookbehind» a
// proposito: un navegador que no lo entiende no carga el modulo, y con el se
// cae la aplicacion entera, no solo la exportacion.
const SUSTITUTOS = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

// Lo que Excel admite en una celda. Ningun texto de la herramienta llega, pero
// un archivo que Excel no abre es peor que un texto cortado.
const MAXIMO_POR_CELDA = 32767;


export function escaparXml(texto) {
  return String(texto ?? "")
    .replace(NO_CABEN_EN_XML, "")
    .replace(SUSTITUTOS, (pareja) => (pareja.length === 2 ? pareja : ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


/**
 * El nombre de una hoja como lo acepta Excel: sin \ / ? * [ ] :, sin
 * apostrofo al principio o al final y con 31 caracteres como mucho. Repetido,
 * lleva un numero detras.
 */
export function nombreDeHoja(nombre, usados = new Set()) {
  const limpio = String(nombre ?? "")
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/^'+|'+$/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Hoja";

  let candidato = limpio.slice(0, 31);

  for (let numero = 2; usados.has(candidato.toLowerCase()); numero += 1) {
    const sufijo = ` (${numero})`;
    candidato = `${limpio.slice(0, 31 - sufijo.length)}${sufijo}`;
  }

  usados.add(candidato.toLowerCase());
  return candidato;
}


/** «A», «B»… «Z», «AA»: la letra de la columna i, contando desde 0. */
export function letraDeColumna(indice) {
  let resto = indice + 1;
  let letras = "";

  while (resto > 0) {
    const cifra = (resto - 1) % 26;
    letras = String.fromCharCode(65 + cifra) + letras;
    resto = Math.floor((resto - 1) / 26);
  }

  return letras;
}


// ============================================================== estilos

/**
 * Los estilos que usa el libro, cada uno con su numero de cellXfs.
 *
 * Excel no guarda estilos por celda sino una tabla de combinaciones —fuente,
 * relleno, borde, formato de numero, alineacion— y cada celda apunta a una.
 * Aqui se arma esa tabla con las combinaciones que de verdad aparecen.
 */
class TablaDeEstilos {
  constructor() {
    this.fuentes = [];
    this.rellenos = ["none", "gray125"]; // Los dos primeros son obligatorios.
    this.formatos = [];
    this.combinaciones = [];
    this.indices = new Map();
    this.indiceDe({});
  }

  indiceDe(estilo = {}) {
    const completo = { ...ESTILO_BASE, ...estilo };
    const clave = JSON.stringify(completo);

    if (!this.indices.has(clave)) {
      this.indices.set(clave, this.combinaciones.length);
      this.combinaciones.push({
        fuente: this.indiceEnLista(this.fuentes, `${completo.negrita}|${completo.tamano}|${completo.color}`),
        relleno: completo.relleno ? this.indiceEnLista(this.rellenos, completo.relleno) : 0,
        formato: completo.formato ? 164 + this.indiceEnLista(this.formatos, completo.formato) : 0,
        borde: completo.borde ? 1 : 0,
        alineacion: completo,
      });
    }

    return this.indices.get(clave);
  }

  indiceEnLista(lista, valor) {
    const indice = lista.indexOf(valor);

    if (indice >= 0) {
      return indice;
    }

    lista.push(valor);
    return lista.length - 1;
  }

  xml() {
    const fuentes = this.fuentes.map((clave) => {
      const [negrita, tamano, color] = clave.split("|");

      return `<font>${negrita === "true" ? "<b/>" : ""}<sz val="${tamano}"/><color rgb="FF${color}"/><name val="Arial"/><family val="2"/></font>`;
    });

    const rellenos = this.rellenos.map((relleno) =>
      relleno === "none" || relleno === "gray125"
        ? `<fill><patternFill patternType="${relleno}"/></fill>`
        : `<fill><patternFill patternType="solid"><fgColor rgb="FF${relleno}"/><bgColor indexed="64"/></patternFill></fill>`,
    );

    const formatos = this.formatos.map(
      (formato, indice) => `<numFmt numFmtId="${164 + indice}" formatCode="${escaparXml(formato)}"/>`,
    );

    const combinaciones = this.combinaciones.map(({ fuente, relleno, formato, borde, alineacion }) => {
      const atributos = [
        alineacion.horizontal ? `horizontal="${alineacion.horizontal}"` : "",
        alineacion.vertical ? `vertical="${alineacion.vertical}"` : "",
        alineacion.envolver ? 'wrapText="1"' : "",
      ].filter(Boolean).join(" ");

      return `<xf numFmtId="${formato}" fontId="${fuente}" fillId="${relleno}" borderId="${borde}" xfId="0"`
        + `${formato ? ' applyNumberFormat="1"' : ""} applyFont="1"${relleno ? ' applyFill="1"' : ""}`
        + `${borde ? ' applyBorder="1"' : ""} applyAlignment="1"><alignment ${atributos}/></xf>`;
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + (formatos.length ? `<numFmts count="${formatos.length}">${formatos.join("")}</numFmts>` : "")
      + `<fonts count="${fuentes.length}">${fuentes.join("")}</fonts>`
      + `<fills count="${rellenos.length}">${rellenos.join("")}</fills>`
      + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
      + '<border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right>'
      + '<top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + `<cellXfs count="${combinaciones.length}">${combinaciones.join("")}</cellXfs>`
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + "</styleSheet>";
  }
}


// =============================================================== hojas

function celdaXml(referencia, celda, estilos) {
  const { valor, estilo } = celda !== null && typeof celda === "object" ? celda : { valor: celda, estilo: null };
  const s = estilos.indiceDe(estilo || {});
  const atributoDeEstilo = s ? ` s="${s}"` : "";

  if (typeof valor === "number" && Number.isFinite(valor)) {
    return `<c r="${referencia}"${atributoDeEstilo}><v>${valor}</v></c>`;
  }

  const texto = valor === null || valor === undefined ? "" : String(valor).slice(0, MAXIMO_POR_CELDA);

  if (!texto) {
    return s ? `<c r="${referencia}"${atributoDeEstilo}/>` : "";
  }

  return `<c r="${referencia}"${atributoDeEstilo} t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`;
}


function hojaXml(hoja, estilos) {
  const columnas = hoja.columnas || [];
  const filas = [
    ...(hoja.cabecera === false ? [] : [columnas.map((columna) => ({ valor: columna.titulo, estilo: hoja.estiloDeCabecera }))]),
    ...(hoja.filas || []),
  ];
  const ancho = Math.max(columnas.length, ...filas.map((fila) => fila.length), 1);
  const ultima = `${letraDeColumna(ancho - 1)}${Math.max(filas.length, 1)}`;

  const fijarFilas = hoja.fijar?.filas || 0;
  const fijarColumnas = hoja.fijar?.columnas || 0;
  const esquina = `${letraDeColumna(fijarColumnas)}${fijarFilas + 1}`;
  const panel = fijarFilas && fijarColumnas ? "bottomRight" : fijarFilas ? "bottomLeft" : "topRight";
  const vista = fijarFilas || fijarColumnas
    ? `<pane${fijarColumnas ? ` xSplit="${fijarColumnas}"` : ""}${fijarFilas ? ` ySplit="${fijarFilas}"` : ""} topLeftCell="${esquina}" activePane="${panel}" state="frozen"/>`
      + `<selection pane="${panel}" activeCell="${esquina}" sqref="${esquina}"/>`
    : "";

  const anchos = columnas.some((columna) => columna.ancho)
    ? `<cols>${columnas
        .map((columna, indice) => columna.ancho
          ? `<col min="${indice + 1}" max="${indice + 1}" width="${columna.ancho}" customWidth="1"/>`
          : "")
        .join("")}</cols>`
    : "";

  const cuerpo = filas
    .map((fila, indiceDeFila) => {
      const numero = indiceDeFila + 1;
      const alto = indiceDeFila === 0 && hoja.altoDeCabecera ? ` ht="${hoja.altoDeCabecera}" customHeight="1"` : "";
      const celdas = fila.map((celda, indice) => celdaXml(`${letraDeColumna(indice)}${numero}`, celda, estilos)).join("");

      return `<row r="${numero}"${alto}>${celdas}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    + `<dimension ref="A1:${ultima}"/>`
    + `<sheetViews><sheetView workbookViewId="0"${hoja.sinCuadricula ? ' showGridLines="0"' : ""}>${vista}</sheetView></sheetViews>`
    + '<sheetFormatPr defaultRowHeight="13.2"/>'
    + anchos
    + `<sheetData>${cuerpo}</sheetData>`
    + (hoja.filtro && filas.length > 1 ? `<autoFilter ref="A1:${ultima}"/>` : "")
    + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
    + '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    + "</worksheet>";
}


// ================================================================= ZIP

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    tabla[n] = c >>> 0;
  }

  return tabla;
})();


export function crc32(bytes) {
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = TABLA_CRC[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}


/**
 * Un ZIP sin comprimir con los archivos dados ({ nombre, bytes }).
 *
 * La fecha de cada archivo es la minima del formato, 1 de enero de 1980: no se
 * lee en ningun sitio y asi el mismo libro da siempre los mismos bytes, que es
 * lo que permite probarlo.
 */
export function crearZip(archivos) {
  const codificador = new TextEncoder();
  const partes = [];
  const central = [];
  let desplazamiento = 0;

  const cabecera = (tamano) => {
    const buffer = new ArrayBuffer(tamano);
    return { buffer, vista: new DataView(buffer) };
  };

  archivos.forEach(({ nombre, bytes }) => {
    const nombreEnBytes = codificador.encode(nombre);
    const crc = crc32(bytes);
    const local = cabecera(30);

    local.vista.setUint32(0, 0x04034b50, true);
    local.vista.setUint16(4, 20, true);       // version necesaria
    local.vista.setUint16(6, 0x0800, true);   // nombres en UTF-8
    local.vista.setUint16(8, 0, true);        // almacenado, sin comprimir
    local.vista.setUint16(10, 0, true);       // hora
    local.vista.setUint16(12, 0x21, true);    // 1980-01-01
    local.vista.setUint32(14, crc, true);
    local.vista.setUint32(18, bytes.length, true);
    local.vista.setUint32(22, bytes.length, true);
    local.vista.setUint16(26, nombreEnBytes.length, true);
    local.vista.setUint16(28, 0, true);

    partes.push(new Uint8Array(local.buffer), nombreEnBytes, bytes);

    const registro = cabecera(46);

    registro.vista.setUint32(0, 0x02014b50, true);
    registro.vista.setUint16(4, 20, true);
    registro.vista.setUint16(6, 20, true);
    registro.vista.setUint16(8, 0x0800, true);
    registro.vista.setUint16(10, 0, true);
    registro.vista.setUint16(12, 0, true);
    registro.vista.setUint16(14, 0x21, true);
    registro.vista.setUint32(16, crc, true);
    registro.vista.setUint32(20, bytes.length, true);
    registro.vista.setUint32(24, bytes.length, true);
    registro.vista.setUint16(28, nombreEnBytes.length, true);
    registro.vista.setUint32(42, desplazamiento, true);

    central.push(new Uint8Array(registro.buffer), nombreEnBytes);
    desplazamiento += 30 + nombreEnBytes.length + bytes.length;
  });

  const tamanoCentral = central.reduce((suma, parte) => suma + parte.length, 0);
  const final = cabecera(22);

  final.vista.setUint32(0, 0x06054b50, true);
  final.vista.setUint16(8, archivos.length, true);
  final.vista.setUint16(10, archivos.length, true);
  final.vista.setUint32(12, tamanoCentral, true);
  final.vista.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, new Uint8Array(final.buffer)];
  const salida = new Uint8Array(todo.reduce((suma, parte) => suma + parte.length, 0));
  let posicion = 0;

  todo.forEach((parte) => {
    salida.set(parte, posicion);
    posicion += parte.length;
  });

  return salida;
}


// =============================================================== libro

/**
 * Los bytes del .xlsx.
 *
 * `hojas` es [{ nombre, columnas: [{ titulo, ancho }], filas: [[celda]],
 * fijar: { filas, columnas }, filtro, cabecera, estiloDeCabecera,
 * altoDeCabecera, sinCuadricula }].
 */
export function crearLibro({ titulo = "", autor = "F3M Assessment", hojas = [] } = {}) {
  const codificador = new TextEncoder();
  const estilos = new TablaDeEstilos();
  const usados = new Set();
  const lista = (hojas.length ? hojas : [{ nombre: "Hoja", filas: [] }]).map((hoja) => ({
    ...hoja,
    nombre: nombreDeHoja(hoja.nombre, usados),
  }));

  const xmlDeHojas = lista.map((hoja) => hojaXml(hoja, estilos));

  const filtros = lista
    .map((hoja, indice) => {
      const filas = (hoja.cabecera === false ? 0 : 1) + (hoja.filas || []).length;
      const ancho = Math.max((hoja.columnas || []).length, 1);

      return hoja.filtro && filas > 1
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${indice}" hidden="1">'${escaparXml(hoja.nombre.replace(/'/g, "''"))}'!$A$1:$${letraDeColumna(ancho - 1)}$${filas}</definedName>`
        : "";
    })
    .join("");

  const archivos = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + lista.map((_, indice) => `<Override PartName="/xl/worksheets/sheet${indice + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + "</Types>",
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + "</Relationships>",
    ],
    [
      "docProps/core.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">`
        + `<dc:title>${escaparXml(titulo)}</dc:title><dc:creator>${escaparXml(autor)}</dc:creator>`
        + "</cp:coreProperties>",
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
        + '<bookViews><workbookView activeTab="0"/></bookViews>'
        + `<sheets>${lista.map((hoja, indice) => `<sheet name="${escaparXml(hoja.nombre)}" sheetId="${indice + 1}" r:id="rId${indice + 1}"/>`).join("")}</sheets>`
        + (filtros ? `<definedNames>${filtros}</definedNames>` : "")
        + "</workbook>",
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + lista.map((_, indice) => `<Relationship Id="rId${indice + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${indice + 1}.xml"/>`).join("")
        + `<Relationship Id="rId${lista.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
        + "</Relationships>",
    ],
    ...xmlDeHojas.map((xml, indice) => [`xl/worksheets/sheet${indice + 1}.xml`, xml]),
    // Al final: la tabla de estilos se ha ido llenando al escribir las hojas.
    ["xl/styles.xml", estilos.xml()],
  ];

  return crearZip(archivos.map(([nombre, texto]) => ({ nombre, bytes: codificador.encode(texto) })));
}
