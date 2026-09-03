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


export function escapeAttr(value) {
  return escapeHtml(value);
}


/** Un numero para leer: sin decimales si es entero, "-" si no hay valor. */
export function formatNumber(value) {
  if (!Number.isFinite(value)) return "-";

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}
