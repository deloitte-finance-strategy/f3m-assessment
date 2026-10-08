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


/**
 * Una media, siempre con dos decimales: "3,00", "2,50", "2,94".
 *
 * Con formatNumber() una columna de medias decia "3", "2,5" y "2,94" una debajo
 * de otra. Son el mismo tipo de dato con la misma precision, y escritos asi
 * parecen tres cosas distintas y no se alinean. En una tabla proyectada se nota.
 *
 * Solo para medias: scores, objetivos medios y gaps, tambien en KPIs y
 * titulares. Un score suelto de una palanca es un entero de 1 a 5 y sigue con
 * formatNumber(): "3,00" sugeriria una precision que no tiene.
 */
const FORMATO_DE_MEDIA = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMedia(value) {
  if (!Number.isFinite(value)) return "-";

  return FORMATO_DE_MEDIA.format(value);
}


const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const dosCifras = (numero) => String(numero).padStart(2, "0");


/**
 * La fecha del informe, para leerla: "4 de octubre de 2026, 11:26".
 *
 * Era toLocaleString(), que da "4/10/2026, 11:26:44": en un deck que se
 * entrega, los segundos sobran y el 4/10 se lee distinto a cada lado del
 * Atlantico.
 *
 * Se compone a mano y no con Intl.DateTimeFormat a proposito: con las mismas
 * opciones, una version de Node da "4 de octubre de 2026, 11:26" y otra
 * "4 de octubre de 2026 a las 11:26". Cada navegador trae su version, asi que
 * el informe diria la fecha de una forma u otra segun el portatil de la sala.
 */
export function fechaLegible(fecha) {
  const dia = `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;

  return `${dia}, ${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`;
}


/**
 * Cuándo pasó algo, contado desde ahora: "hace 5 minutos", "hoy a las 10:42",
 * "ayer a las 18:05", "el 6 de octubre".
 *
 * Es para el menú de Escenario, que dice cuándo se guardó la última copia: ahí
 * lo que importa es si fue esta mañana o hace una semana, no la fecha exacta.
 * Compuesto a mano por lo mismo que fechaLegible().
 */
export function cuandoFue(fecha, ahora) {
  const minutos = Math.floor((ahora - fecha) / 60000);
  const hora = `${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`;

  if (minutos < 1) {
    return "ahora mismo";
  }

  if (minutos < 60) {
    return minutos === 1 ? "hace 1 minuto" : `hace ${minutos} minutos`;
  }

  const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioDeAyer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);

  if (fecha >= inicioDeHoy) {
    return `hoy a las ${hora}`;
  }

  if (fecha >= inicioDeAyer) {
    return `ayer a las ${hora}`;
  }

  const dia = `el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;

  return fecha.getFullYear() === ahora.getFullYear() ? dia : `${dia} de ${fecha.getFullYear()}`;
}


/**
 * La misma fecha para el nombre de un archivo: "2026-10-04".
 *
 * Asi ordenan bien en una carpeta y dos informes de dias distintos no se pisan.
 * Con la fecha local, no la UTC: el informe de las 00:30 es de hoy, no de ayer.
 */
export function fechaParaArchivo(fecha) {
  return `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}`;
}
