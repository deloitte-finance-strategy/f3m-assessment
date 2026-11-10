/**
 * Imprimir la pantalla (Ctrl+P), que no es el informe.
 *
 * El entregable es el informe en PDF. Pero en una reunion alguien pulsa Ctrl+P
 * para llevarse el Heatmap o el Roadmap en papel, y lo que salia era la
 * pantalla tal cual: la cabecera, el conmutador y las pestanas en cada hoja,
 * «Saltar al contenido» arriba, y las tablas cortadas por la derecha. Lo que
 * se quita y como se recoloca esta en el bloque `@media print` de styles.css;
 * aqui va lo que el CSS no puede hacer solo.
 *
 * - **Se imprime en claro y con la letra normal**, se este como se este. En
 *   oscuro el papel salia con texto gris claro sobre blanco, y los radares
 *   —que Chart.js pinta con colores fijos— con rotulos que no se leen. Es el
 *   mismo motivo por el que el informe sale claro siempre. Al cerrar el
 *   dialogo de impresion todo vuelve a como estaba.
 * - **Una linea arriba dice de quien es y de cuando**: el cliente, el dominio
 *   y la fecha. En pantalla eso lo dicen la cabecera y el conmutador, que en
 *   papel no salen.
 *
 * El repintado se pide por app/repintado.js, como todo lo de app/: importarlo
 * de app.js cerraria un ciclo con el orquestador.
 */

import { diaLegible } from "../core/presentacion.js?v=36";

import { DOMAINS, state } from "./estado.js?v=36";
import { redimensionarRadares } from "./graficos.js?v=36";
import { repintarTodo } from "./repintado.js?v=36";


// Las dos vistas que hablan de la funcion financiera entera y no del dominio
// abierto: en ellas el nombre del dominio no dice nada de lo que se imprime.
const VISTAS_SIN_DOMINIO = ["overview", "ia"];


let antes = null;


export function setupImpresion() {
  window.addEventListener("beforeprint", prepararLaImpresion);
  window.addEventListener("afterprint", volverALaPantalla);
}


function prepararLaImpresion() {
  pintarLaCabecera();

  // Dos beforeprint seguidos sin afterprint entre medias —pasa en algun
  // navegador— no deben guardar como «lo de antes» el estado ya cambiado.
  if (antes) {
    return;
  }

  const raiz = document.documentElement;

  antes = { tema: raiz.dataset.tema, densidad: raiz.dataset.densidad };

  if (antes.tema === "claro" && !antes.densidad) {
    return;
  }

  raiz.dataset.tema = "claro";
  delete raiz.dataset.densidad;

  repintarConSuTamano();
}


/**
 * Repinta, y deja los radares a la medida de la pagina de ahora.
 *
 * Chart.js se entera de que su caja ha cambiado un momento despues, y aqui no
 * hay despues: el navegador saca la foto para imprimir en cuanto termina este
 * manejador. Sin pedirselo, al imprimir con «Letra grande» los radares salian
 * con el lienzo de la letra grande y los rotulos de la normal, diminutos.
 */
function repintarConSuTamano() {
  repintarTodo();
  redimensionarRadares();
}


function volverALaPantalla() {
  if (!antes) {
    return;
  }

  const raiz = document.documentElement;
  const cambio = antes.tema !== "claro" || Boolean(antes.densidad);

  if (antes.tema) {
    raiz.dataset.tema = antes.tema;
  }

  if (antes.densidad) {
    raiz.dataset.densidad = antes.densidad;
  }

  antes = null;

  if (cambio) {
    repintarConSuTamano();
  }
}


function pintarLaCabecera() {
  const cabecera = document.getElementById("cabeceraDeImpresion");

  if (!cabecera) {
    return;
  }

  const vista = document.querySelector(".tabs")?.dataset.vista;
  const dominio = VISTAS_SIN_DOMINIO.includes(vista)
    ? "Función financiera"
    : DOMAINS[state.activeDomainId]?.label;

  // textContent, no innerHTML: el nombre del cliente lo escribe quien use la
  // herramienta, y en un escenario compartido, cualquiera con el enlace.
  cabecera.querySelector("[data-impresion-de]").textContent = [
    "F3M Assessment",
    state.cliente,
    dominio,
  ].filter(Boolean).join(" · ");

  cabecera.querySelector("[data-impresion-cuando]").textContent = diaLegible(new Date());
}
