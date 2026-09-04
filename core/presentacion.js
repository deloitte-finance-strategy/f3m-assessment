/**
 * Lo que comparten la aplicacion y el informe PDF para pintar: escapado,
 * formato de numeros y los colores de marca.
 *
 * Son funciones y constantes puras, sin DOM ni estado. Estaban en app.js y el
 * informe las usaba desde el mismo ambito de modulo; al sacar el informe a su
 * propio archivo tenian que dejar de estar en uno de los dos.
 */


/**
 * Identidad de palanca. Estos tres colores solo significan una cosa: de que
 * palanca estamos hablando. No deben usarse para nada mas.
 */
export const COLOR_DE_PALANCA = {
  procesos: "#86BC25",
  tecnologia: "#ED8B00",
  organizacion: "#012169",
};


/**
 * El acento de marca comparte valor con el verde de Procesos, pero no es lo
 * mismo: aqui significa "Deloitte", no "palanca de Procesos". Se nombra aparte
 * para que se pueda cambiar uno sin arrastrar el otro.
 */
export const COLOR_DE_MARCA = "#86BC25";


/**
 * El verde de marca para texto pequeno sobre fondo claro.
 *
 * #86BC25 sobre blanco da 2,27:1, muy por debajo del 4,5:1 que pide WCAG AA. En
 * el informe eso afectaba al antetitulo de la portada, que es lo primero que lee
 * el cliente. Este da 6,02:1 y es el mismo verde oscuro que usa la aplicacion.
 */
export const COLOR_DE_MARCA_LEGIBLE = "#3E6F11";


export const COLOR_DE_PRIORIDAD = {
  Alta: "#bb3128",
  Media: "#c87900",
  Baja: "#3e6f11",
  Pendiente: "#8a9189",
};


export function priorityColor(priority) {
  return COLOR_DE_PRIORIDAD[priority] || COLOR_DE_PRIORIDAD.Pendiente;
}


export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/**
 * El mismo escapado que escapeHtml, con otro nombre.
 *
 * No es un descuido que sea un alias: en un atributo entrecomillado hace falta
 * exactamente eso y nada mas, y el nombre documenta la intencion en los sitios
 * donde se usa.
 *
 * Lo que NO hace es validar el esquema de una URL. En informe/pdf.js se usa
 * sobre el src de los radares, que sale de canvas.toDataURL() y por tanto es
 * siempre un data: nuestro. Si algun dia un href o un src llega de fuera, esto
 * no basta.
 */
export function escapeAttr(value) {
  return escapeHtml(value);
}


/**
 * Un numero para leer, en espanol: coma decimal, sin decimales si es entero y
 * "-" cuando no hay valor.
 *
 * La aplicacion esta en espanol y se ensena a clientes espanoles, pero escribia
 * "3.17" donde se escribe "3,17". Salia asi en los KPIs, la tabla resumen, el
 * heatmap, el roadmap y el PDF que se entrega.
 *
 * De paso desaparece un apano fragil. Antes era toFixed(2) y dos replace: uno
 * para quitar el cero final de "3.10" y otro para el ".0" de "4.00". Funcionaba,
 * pero por como estaban escritas las expresiones, no porque el redondeo lo
 * garantizara. Intl.NumberFormat hace lo mismo sin trucos: recorta a dos
 * decimales, no deja ceros de relleno y pone la coma.
 *
 * El formateador se crea una sola vez: construirlo es caro y esto se llama
 * cientos de veces por repintado.
 */
const FORMATO_DE_NUMERO = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

export function formatNumber(value) {
  if (!Number.isFinite(value)) return "-";

  return FORMATO_DE_NUMERO.format(value);
}
