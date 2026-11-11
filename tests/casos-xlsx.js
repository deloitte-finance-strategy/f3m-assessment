/**
 * El Excel de la exportacion, escrito a mano en core/xlsx.js.
 *
 * Un .xlsx que Excel no abre no da un error amable: dice que el archivo esta
 * danado y ofrece «recuperarlo». Estas pruebas leen el ZIP de vuelta, sin
 * librerias, y miran lo que suele romperlo: la suma de control de cada archivo,
 * el XML con caracteres que no admite, los nombres de hoja prohibidos y el texto
 * que podria acabar evaluandose como formula.
 */

import { crc32, crearLibro, escaparXml, letraDeColumna, nombreDeHoja } from "../core/xlsx.js?v=38";


/** Los archivos de un ZIP almacenado, { nombre: texto }, leyendo sus cabeceras. */
function leerZip(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decodificador = new TextDecoder();
  const archivos = {};
  const errores = [];
  let posicion = 0;

  while (vista.getUint32(posicion, true) === 0x04034b50) {
    const metodo = vista.getUint16(posicion + 8, true);
    const crc = vista.getUint32(posicion + 14, true);
    const tamano = vista.getUint32(posicion + 18, true);
    const largoDelNombre = vista.getUint16(posicion + 26, true);
    const extra = vista.getUint16(posicion + 28, true);
    const nombre = decodificador.decode(bytes.subarray(posicion + 30, posicion + 30 + largoDelNombre));
    const inicio = posicion + 30 + largoDelNombre + extra;
    const contenido = bytes.subarray(inicio, inicio + tamano);

    if (metodo !== 0) errores.push(`${nombre}: comprimido`);
    if (crc32(contenido) !== crc) errores.push(`${nombre}: suma de control`);

    archivos[nombre] = decodificador.decode(contenido);
    posicion = inicio + tamano;
  }

  // Y el directorio central tiene que decir cuantos hay.
  const fin = bytes.length - 22;

  if (vista.getUint32(fin, true) !== 0x06054b50) errores.push("sin final de directorio");
  if (vista.getUint16(fin + 10, true) !== Object.keys(archivos).length) errores.push("cuenta del directorio");

  return { archivos, errores };
}


const libroDePrueba = () =>
  crearLibro({
    titulo: "Datos F3M · FP&A",
    hojas: [
      {
        nombre: "Subcapacidades",
        columnas: [{ titulo: "Subcapacidad", ancho: 40 }, { titulo: "Score medio", ancho: 10 }, { titulo: "Comentarios" }],
        filas: [
          ["1.1 Gobierno", { valor: 3.17, estilo: { formato: "0.00", relleno: "F1EDB2" } }, "=HYPERLINK(\"http://x\")"],
          ["1.2 Drivers", null, "Nota <con> & \"comillas\"\u0001 y 😀"],
        ],
        fijar: { filas: 1, columnas: 1 },
        filtro: true,
        estiloDeCabecera: { negrita: true, color: "FFFFFF", relleno: "2B2B2B" },
      },
    ],
  });


export const casos = [
  {
    grupo: "El Excel por dentro",
    nombre: "la suma de control es la del estandar",
    ejecutar: (t) => {
      // El valor de comprobacion de CRC-32 que publica la norma.
      t.igual(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "es un ZIP sin errores, con las piezas que pide Excel",
    ejecutar: (t) => {
      const { archivos, errores } = leerZip(libroDePrueba());

      t.igual(errores.join(" | "), "");
      t.igual(
        Object.keys(archivos).sort().join(" "),
        "[Content_Types].xml _rels/.rels docProps/core.xml xl/_rels/workbook.xml.rels xl/styles.xml xl/workbook.xml xl/worksheets/sheet1.xml",
      );
      t.igual(archivos["[Content_Types].xml"].includes('PartName="/xl/worksheets/sheet1.xml"'), true);
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "el mismo libro da siempre los mismos bytes",
    ejecutar: (t) => {
      const a = libroDePrueba();
      const b = libroDePrueba();

      t.igual(a.length, b.length);
      t.igual(a.every((byte, i) => byte === b[i]), true);
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "los numeros van como numeros y el texto como texto, nunca como formula",
    ejecutar: (t) => {
      const hoja = leerZip(libroDePrueba()).archivos["xl/worksheets/sheet1.xml"];

      t.igual(/<c r="B2" s="\d+"><v>3.17<\/v><\/c>/.test(hoja), true, "3,17 es un numero");
      t.igual(hoja.includes("<f>"), false, "ninguna formula");
      t.igual(hoja.includes('t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;)</t>'), true);
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "el texto se escapa y pierde lo que un XML no admite, pero no los emojis",
    ejecutar: (t) => {
      const hoja = leerZip(libroDePrueba()).archivos["xl/worksheets/sheet1.xml"];

      t.igual(hoja.includes("Nota &lt;con&gt; &amp; &quot;comillas&quot; y 😀"), true);
      t.igual(hoja.includes("\u0001"), false);
      t.igual(escaparXml("a\uD800b"), "ab", "un sustituto suelto se quita");
      t.igual(escaparXml("😀"), "😀", "una pareja entera se queda");
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "una celda vacia no escribe nada, y una vacia con estilo solo su estilo",
    ejecutar: (t) => {
      const hoja = leerZip(libroDePrueba()).archivos["xl/worksheets/sheet1.xml"];

      t.igual(hoja.includes('r="B3"'), false);
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "la primera fila y la primera columna se quedan fijas, con filtro",
    ejecutar: (t) => {
      const { archivos } = leerZip(libroDePrueba());
      const hoja = archivos["xl/worksheets/sheet1.xml"];

      t.igual(hoja.includes('<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>'), true);
      t.igual(hoja.includes('<autoFilter ref="A1:C3"/>'), true);
      t.igual(archivos["xl/workbook.xml"].includes("'Subcapacidades'!$A$1:$C$3"), true, "el nombre que Excel espera para el filtro");
      t.igual(hoja.includes('<col min="1" max="1" width="40" customWidth="1"/>'), true);
      t.igual(hoja.indexOf("<sheetData>") < hoja.indexOf("<autoFilter"), true, "en el orden que exige el formato");
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "los estilos se guardan una vez cada uno, con los dos rellenos obligatorios delante",
    ejecutar: (t) => {
      const estilos = leerZip(libroDePrueba()).archivos["xl/styles.xml"];

      t.igual(estilos.indexOf('patternType="none"') < estilos.indexOf('patternType="gray125"'), true);
      t.igual((estilos.match(/rgb="FFF1EDB2"/g) || []).length, 1);
      t.igual(estilos.includes('<numFmt numFmtId="164" formatCode="0.00"/>'), true);
      t.igual(estilos.includes('<name val="Arial"/>'), true);
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "los nombres de hoja que Excel no admite se arreglan, y no se repiten",
    ejecutar: (t) => {
      const usados = new Set();

      t.igual(nombreDeHoja("Datos: FP&A / [2026]?", usados), "Datos FP&A 2026");
      t.igual(nombreDeHoja("Un nombre larguísimo que pasa de treinta y un caracteres", usados).length, 31);
      t.igual(nombreDeHoja("datos fp&a 2026", usados), "datos fp&a 2026 (2)");
      t.igual(nombreDeHoja("", usados), "Hoja");
    },
  },
  {
    grupo: "El Excel por dentro",
    nombre: "las columnas pasan de la Z a la AA",
    ejecutar: (t) => {
      t.igual([0, 25, 26, 27, 51, 52].map(letraDeColumna).join(" "), "A Z AA AB AZ BA");
    },
  },
];
