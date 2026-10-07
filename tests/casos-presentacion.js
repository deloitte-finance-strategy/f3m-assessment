/**
 * Pruebas de core/presentacion.js: como se escriben los numeros y como se
 * escapa el texto que llega de fuera.
 *
 * Son las dos cosas del modulo que se ven en pantalla y en el PDF que se
 * entrega al cliente, y no tenian ninguna prueba.
 *
 * Van con las del motor de calculo y las del contrato de escenario: /tests/ en
 * el navegador, o node tests/ejecutar.mjs desde la linea de comandos.
 */

import { escapeAttr, escapeHtml, fechaLegible, fechaParaArchivo, formatMedia, formatNumber } from "../core/presentacion.js?v=22";


export const casos = [
  // --------------------------------------------------------------- numeros
  {
    grupo: "Numeros en espanol",
    nombre: "el separador decimal es la coma, no el punto",
    ejecutar: (t) => {
      t.igual(formatNumber(3.17), "3,17", "dos decimales");
      t.igual(formatNumber(3.5), "3,5", "un decimal");
      t.igual(formatNumber(0.67), "0,67", "menor que uno");
    },
  },
  {
    grupo: "Numeros en espanol",
    nombre: "un entero se escribe sin decimales",
    ejecutar: (t) => {
      t.igual(formatNumber(4), "4", "objetivo por defecto");
      t.igual(formatNumber(0), "0", "cero es un valor, no un vacio");
      t.igual(formatNumber(5), "5", "score maximo");
    },
  },
  {
    grupo: "Numeros en espanol",
    nombre: "no se rellena con ceros a la derecha",
    ejecutar: (t) => {
      // 3.10 y 4.00 son 3.1 y 4 para JavaScript; lo que importa es que no
      // salgan como "3,10" ni "4,00".
      t.igual(formatNumber(3.1), "3,1", "un solo decimal significativo");
      t.igual(formatNumber(4.0), "4", "sin parte decimal");
      t.igual(formatNumber(2.2), "2,2", "media de palanca tipica");
    },
  },
  {
    grupo: "Numeros en espanol",
    nombre: "una media lleva siempre dos decimales, para que una columna se alinee",
    ejecutar: (t) => {
      t.igual(formatMedia(3), "3,00", "entera");
      t.igual(formatMedia(2.5), "2,50", "un decimal");
      t.igual(formatMedia(2.94), "2,94", "dos decimales");
      t.igual(formatMedia(1.666666), "1,67", "se redondea igual que formatNumber");
      t.igual(formatMedia(0), "0,00", "cero es un valor, no un vacio");
      t.igual(formatMedia(null), "-", "sin puntuar sigue siendo un guion");
      t.igual(formatMedia(NaN), "-", "NaN tambien");
    },
  },
  {
    grupo: "Numeros en espanol",
    nombre: "se redondea a dos decimales, que es lo que calcula el motor",
    ejecutar: (t) => {
      t.igual(formatNumber(3.333333), "3,33", "hacia abajo");
      t.igual(formatNumber(1.666666), "1,67", "hacia arriba");
    },
  },
  {
    grupo: "Numeros en espanol",
    nombre: "lo que no es un numero se ensena como guion, nunca como cero",
    ejecutar: (t) => {
      // Una subcapacidad sin puntuar vale null, y un cero ahi seria mentira:
      // significaria "evaluado con la peor nota" en vez de "sin evaluar".
      t.igual(formatNumber(null), "-", "sin puntuar");
      t.igual(formatNumber(undefined), "-", "campo ausente");
      t.igual(formatNumber(NaN), "-", "resultado no numerico");
      t.igual(formatNumber(Infinity), "-", "division por cero");
      t.igual(formatNumber("3.17"), "-", "un texto no es un numero");
    },
  },

  // ---------------------------------------------------------------- fechas
  {
    grupo: "Fechas del informe",
    nombre: "se leen con el mes en letra y sin segundos",
    ejecutar: (t) => {
      t.igual(fechaLegible(new Date(2026, 9, 4, 9, 5, 44)), "4 de octubre de 2026, 09:05");
      t.igual(fechaLegible(new Date(2026, 0, 31, 23, 0)), "31 de enero de 2026, 23:00", "enero es el mes 0");
      t.igual(fechaLegible(new Date(2026, 11, 1, 0, 7)), "1 de diciembre de 2026, 00:07", "y diciembre el 11");
    },
  },
  {
    grupo: "Fechas del informe",
    nombre: "en el nombre de archivo van al reves, con ceros, y en hora local",
    ejecutar: (t) => {
      t.igual(fechaParaArchivo(new Date(2026, 0, 5, 0, 30)), "2026-01-05", "la medianoche y media sigue siendo ese dia");
      t.igual(fechaParaArchivo(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
    },
  },

  // --------------------------------------------------------------- escapado
  {
    grupo: "Escapado de texto",
    nombre: "los caracteres que abren etiquetas no llegan al HTML",
    ejecutar: (t) => {
      t.igual(
        escapeHtml("<script>alert(1)</script>"),
        "&lt;script&gt;alert(1)&lt;/script&gt;",
        "etiqueta completa",
      );
      t.igual(escapeHtml("a & b"), "a &amp; b", "ampersand");
      t.igual(escapeHtml('comilla " doble'), "comilla &quot; doble", "comilla doble");
      t.igual(escapeHtml("comilla ' simple"), "comilla &#039; simple", "comilla simple");
    },
  },
  {
    grupo: "Escapado de texto",
    nombre: "el ampersand se escapa primero, para no escapar dos veces",
    ejecutar: (t) => {
      // Si & se sustituyera despues de <, "&lt;" acabaria como "&amp;lt;" y en
      // pantalla se leeria "&lt;" en vez de "<".
      t.igual(escapeHtml("<"), "&lt;", "menor que");
      t.igual(escapeHtml("&lt;"), "&amp;lt;", "algo ya escapado se escapa entero");
    },
  },
  {
    grupo: "Escapado de texto",
    nombre: "un valor ausente se escapa como cadena vacia, no como 'null'",
    ejecutar: (t) => {
      t.igual(escapeHtml(null), "", "null");
      t.igual(escapeHtml(undefined), "", "undefined");
      t.igual(escapeHtml(0), "0", "el cero si es un valor");
      t.igual(escapeAttr(null), "", "escapeAttr se comporta igual");
    },
  },
];
