/**
 * El almacenamiento del navegador, que puede fallar y no es motivo para caerse.
 *
 * localStorage lanza excepcion si la cuota esta llena, si el navegador lo tiene
 * bloqueado por politica y en algunas ventanas privadas. Antes una de esas
 * excepciones tumbaba la funcion que estuviera guardando, y con ella el
 * repintado que venia detras.
 *
 * El aviso de que no se esta guardando sale UNA vez por sesion: repetirlo en
 * cada pulsacion convertiria un problema real en ruido que se aprende a
 * ignorar.
 */

import { scenarioId } from "./estado.js?v=12";
import { showNotice } from "./avisos.js?v=12";


/**
 * El almacenamiento del navegador puede fallar y no es motivo para caerse.
 *
 * Lanza excepcion si la cuota esta llena, si el navegador tiene bloqueado el
 * almacenamiento por politica o en algunas ventanas privadas. Antes la
 * escritura iba sin proteger y por delante de la de Firebase: al superar la
 * cuota, el cambio no llegaba a ninguno de los dos sitios.
 */
let avisoDeAlmacenamientoMostrado = false;




export function leerAlmacenamiento(clave) {
  try {
    return window.localStorage.getItem(clave);
  } catch (error) {
    console.warn("No se pudo leer del almacenamiento del navegador.", error);
    return null;
  }
}




export function escribirAlmacenamiento(clave, valor) {
  try {
    window.localStorage.setItem(clave, valor);
    return true;
  } catch (error) {
    console.warn("No se pudo escribir en el almacenamiento del navegador.", error);

    if (!avisoDeAlmacenamientoMostrado) {
      avisoDeAlmacenamientoMostrado = true;

      showNotice(
        "Este navegador no está guardando la copia local del escenario, probablemente por falta de " +
          "espacio o por su configuración de privacidad. " +
          (scenarioId
            ? "Los cambios siguen enviándose al escenario compartido."
            : "Exporta el escenario en JSON si no quieres perder el trabajo al cerrar."),
        "aviso",
      );
    }

    return false;
  }
}




export function borrarDeAlmacenamiento(clave) {
  try {
    window.localStorage.removeItem(clave);
    return true;
  } catch (error) {
    console.warn("No se pudo borrar del almacenamiento del navegador.", error);
    return false;
  }
}
