/**
 * Los campos de texto de una subcapacidad: guardar mientras se escribe.
 *
 * Nacio en el Roadmap y salio de alli cuando el comentario empezo a escribirse
 * tambien desde el Assessment, como notas del taller. Es el mismo campo en los
 * dos sitios, y tiene que guardarse igual: con una copia por vista, una de las
 * dos acabaria sin el freno de cierre o sin el recorte al limite de las reglas.
 *
 * Un campo se guarda 600 ms despues de la ultima pulsacion, asi que aqui se
 * lleva la cuenta de lo que queda por guardar: cerrar la pestana justo despues
 * de escribir lo perdia sin dejar rastro. app.js la consulta por
 * hayGuardadosPendientes() para frenar el cierre.
 */

import { LIMITES_DE_TEXTO, recortarAlLimite } from "../core/escenario.js?v=23";
import { persistItemChange } from "./persistencia.js?v=23";


const GUARDADO_DIFERIDO_MS = 600;


const guardadosPendientes = new Map();


/** Al soltar el campo: se guarda ya, y lo que estuviera esperando sobra. */
export function guardarCampoAhora(item, campo, elemento) {
  cancelarGuardadoDiferido(item.id, campo);

  // maxlength solo frena lo que teclea el usuario. Un valor que llegue de un
  // escenario importado puede superar el límite y hacer que Firebase rechace la
  // escritura entera, así que se recorta también aquí.
  const valor = recortarAlLimite(campo, elemento.value);

  if (valor !== elemento.value) {
    elemento.value = valor;
  }

  guardarCampo(item, campo, valor);
}


/** Mientras se escribe: se guarda solo, sin esperar a perder el foco. */
export function programarGuardado(item, campo, elemento) {
  const clave = `${item.id}:${campo}`;

  window.clearTimeout(guardadosPendientes.get(clave));

  guardadosPendientes.set(
    clave,
    window.setTimeout(() => {
      guardadosPendientes.delete(clave);
      guardarCampo(item, campo, recortarAlLimite(campo, elemento.value));
    }, GUARDADO_DIFERIDO_MS),
  );
}


function cancelarGuardadoDiferido(itemId, campo) {
  const clave = `${itemId}:${campo}`;

  window.clearTimeout(guardadosPendientes.get(clave));
  guardadosPendientes.delete(clave);
}


/** Guarda un campo de la subcapacidad, si de verdad ha cambiado. */
function guardarCampo(item, campo, valor) {
  // Sin esta comprobacion, salir de un campo que no se ha tocado provocaba una
  // escritura completa en localStorage y otra en Firebase.
  if (item[campo] === valor) {
    return;
  }

  item[campo] = valor;

  persistItemChange(item.id, campo, valor);
}


/** Si queda algo escrito y sin guardar. Lo consulta el freno de cierre. */
export function hayGuardadosPendientes() {
  return guardadosPendientes.size > 0;
}


/**
 * Cuánto queda de comentario, visible solo al acercarse al límite.
 *
 * Sin esto, pasarse de los 2.000 caracteres que admiten las reglas hacía que
 * Firebase rechazara la escritura sin que se notara.
 */
export function contadorDeComentario(item) {
  const usados = (item.comentario || "").length;
  const limite = LIMITES_DE_TEXTO.comentario;

  if (usados < limite * 0.9) {
    return "";
  }

  // role="status" y no aria-hidden. Era invisible para un lector de pantalla,
  // asi que quien no ve la cuenta se enteraba del limite al perderlo: se pasa
  // de 2.000, las reglas rechazan la escritura entera y el comentario no llega.
  // El aria-live es polite para no interrumpir mientras se escribe.
  return `
    <span class="roadmap-comment-count" role="status" aria-live="polite">
      ${usados} / ${limite}
    </span>
  `;
}


/** Mantiene visible cuánto queda de comentario mientras se escribe. */
export function actualizarContadorDeComentario(textarea, contenedor) {
  if (!contenedor) {
    return;
  }

  const limite = LIMITES_DE_TEXTO.comentario;
  const usados = textarea.value.length;
  let contador = contenedor.querySelector(".roadmap-comment-count");

  if (usados < limite * 0.9) {
    contador?.remove();
    return;
  }

  if (!contador) {
    contador = document.createElement("span");
    contador.className = "roadmap-comment-count";
    contador.setAttribute("role", "status");
    contador.setAttribute("aria-live", "polite");
    contenedor.appendChild(contador);
  }

  contador.textContent = `${usados} / ${limite}`;
  contador.classList.toggle("is-at-limit", usados >= limite);
}
