/**
 * El chip de guardado: la unica senal permanente de si el trabajo esta a salvo.
 *
 * Va aparte de la persistencia por un motivo de reparto, no de estetica: la
 * identidad tambien tiene que poder marcar un fallo —"este navegador no ha
 * podido identificarse"— y la persistencia necesita la identidad. Con el chip
 * dentro de la persistencia, los dos modulos se importarian en circulo.
 *
 * Aqui vive tambien `canalDeVueltaVivo`, porque es lo que decide QUE dice el
 * chip cuando una escritura funciona: "Guardado" y "Guardado, sin recibir" no
 * son lo mismo, y confundirlos fue el fallo mas caro que ha tenido esta
 * herramienta.
 */

import { els } from "./estado.js?v=11";
import { showNotice } from "./avisos.js?v=11";
import { scenarioDatabaseRef } from "./firebase.js?v=11";


// Para retirar el chip de guardado cuando el estado ya no pide nada.
let temporizadorDelChip = null;


// Si hay canal de vuelta desde Firebase, es decir, si onValue esta vivo.
//
// No es un detalle interno: separa "guardado" de "guardado Y recibiendo". Las
// escrituras suben por su cuenta aunque la suscripcion este muerta, asi que sin
// esta bandera el chip se ponia verde mientras los cambios del resto del equipo
// no llegaban. Quien puntuaba creia estar colaborando y estaba pisando trabajo
// ajeno sin verlo.
//
// Tres estados, no dos: null es "todavia no lo sabemos" y solo false dispara el
// aviso. Con un booleano a secas, el arranque contaba como canal muerto y una
// puntuacion muy temprana salia marcada como "sin recibir" sin motivo.
let canalDeVueltaVivo = null;




export function updateSaveStatus(status, message, detalle = "") {
  if (!els.saveStatus) {
    return;
  }

  els.saveStatus.hidden = false;
  els.saveStatus.className = `save-status ${status || ""}`.trim();
  els.saveStatus.textContent = message;

  // El detalle explica qué ha pasado, qué implica y qué puede hacer el usuario.
  // No cabe en el chip, así que va también al tooltip; desde que
  // marcarFalloDeSincronia() lo publica en el banner, el tooltip dejó de ser el
  // único sitio donde se podía leer.
  if (detalle) {
    els.saveStatus.title = detalle;
  } else {
    els.saveStatus.removeAttribute("title");
  }

  // El chip verde se retira solo. Se quedaba puesto indefinidamente sobre la
  // esquina inferior derecha, asi que salia en cualquier captura de pantalla y
  // en cualquier proyeccion. Los estados que piden algo —error, parcial— y el
  // de "guardando" no se van: ahi el chip es la unica senal que hay.
  window.clearTimeout(temporizadorDelChip);

  if (status === "saved") {
    temporizadorDelChip = window.setTimeout(() => {
      els.saveStatus.hidden = true;
    }, 4000);
  }
}


/**
 * Un guardado que falla no puede parecerse a uno que funciona.
 *
 * Antes todos los caminos de error terminaban en "Guardado local ✓" y en verde:
 * con la conexión caída o con las reglas rechazando un campo, el consultor creía
 * que el escenario estaba sincronizado cuando no lo estaba.
 *
 * El detalle sale tambien en el banner, no solo en el tooltip del chip. En el
 * chip solo cabe "Se ha perdido la conexion"; el "tus cambios siguen guardados
 * aqui" —que es justo lo que calma en mitad de una sesion— vivia en un `title`,
 * invisible por teclado y en tactil. `avisar: false` es para los llamantes que
 * ya publican su propio aviso, mas corto y adaptado a su caso.
 */
export function marcarFalloDeSincronia(mensaje, detalle, { avisar = true } = {}) {
  updateSaveStatus("error", mensaje, detalle);

  if (avisar && detalle) {
    showNotice(detalle, "error");
  }
}


/**
 * El chip despues de una escritura que ha ido bien.
 *
 * Que la escritura funcione no significa estar sincronizado: sube por su cuenta
 * aunque onValue este muerto. Antes cualquier `update()` con exito ponia
 * "Guardado ✓" en verde sin condiciones, y eso borraba el aviso rojo anterior:
 * bastaba tocar un score para que la herramienta volviera a decir que todo iba
 * bien mientras no llegaba nada del resto del equipo.
 */
export function marcarEscrituraCorrecta() {
  if (!scenarioDatabaseRef) {
    updateSaveStatus("saved", "Guardado local ✓");
    return;
  }

  if (canalDeVueltaVivo === false) {
    updateSaveStatus(
      "parcial",
      "Guardado, sin recibir",
      "Tu cambio ha subido al escenario compartido, pero esta pestaña no está recibiendo los cambios del resto " +
        "del equipo, así que puede que no estés viendo lo último. Usa «Reconectar» en el aviso.",
    );

    return;
  }

  updateSaveStatus("saved", "Guardado ✓");
}


/**
 * Le dice al chip si hay canal de vuelta desde Firebase.
 *
 * Lo llama la persistencia: es ella quien sabe si onValue esta entregando. El
 * chip solo necesita el dato para no decir "Guardado" cuando el cambio ha
 * subido pero no baja nada.
 */
export function marcarCanalDeVuelta(vivo) {
  canalDeVueltaVivo = vivo;
}


/** Si hay canal de vuelta. null mientras todavia no se sabe. */
export function hayCanalDeVuelta() {
  return canalDeVueltaVivo;
}
