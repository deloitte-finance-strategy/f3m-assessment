/**
 * Sin conexion: registrar el service worker y decir cuando se va la red.
 *
 * sw.js guarda en el navegador lo que hace falta para abrir la herramienta sin
 * red, y aqui solo se registra. Se registra al terminar de cargar la pagina, y
 * no antes: la primera vez guarda el codigo, los datos y unos 6 MB de PDF, y
 * eso no puede competir con el arranque.
 *
 * El aviso dice lo que de verdad pasa, que depende de dos cosas: si la pagina
 * ya esta guardada —la primera visita aun no lo esta— y si se trabaja en un
 * escenario compartido, que sin red no llega al resto del equipo.
 */

import { ocultarAvisoSiDice, showNotice } from "./avisos.js?v=28";
import { enEscenarioCompartido } from "./firebase.js?v=28";


let avisoDado = "";


export function setupSinConexion() {
  window.addEventListener("load", () => {
    registrar();

    if (!navigator.onLine) {
      avisarDeQueNoHayRed();
    }
  });

  window.addEventListener("offline", avisarDeQueNoHayRed);
  window.addEventListener("online", avisarDeQueVuelveLaRed);
}


/**
 * Solo en un origen seguro, que es donde existe: GitHub Pages y localhost. En
 * una IP de la oficina servida por http no hay service worker, y la
 * herramienta funciona como siempre.
 */
function registrar() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("No se ha podido preparar la herramienta para funcionar sin conexión.", error);
  });
}


function avisarDeQueNoHayRed() {
  avisoDado = textoSinRed();
  showNotice(avisoDado, "aviso");
}


/** Solo si el aviso de la red sigue a la vista: si otro lo ha sustituido, ese manda. */
function avisarDeQueVuelveLaRed() {
  if (!avisoDado) {
    return;
  }

  const anterior = avisoDado;

  avisoDado = "";
  ocultarAvisoSiDice(anterior);

  if (document.getElementById("loadNotice")?.hidden) {
    showNotice("Vuelve a haber conexión.", "info");
  }
}


function textoSinRed() {
  if (enEscenarioCompartido) {
    return "Sin conexión con el escenario compartido. Lo que hagas se guarda en este navegador, y el chip de "
      + "guardado dirá en rojo lo que no llegue al resto del equipo.";
  }

  // controller existe cuando la pagina la ha servido el service worker: es
  // decir, cuando ya esta guardada y se puede recargar sin red.
  if (navigator.serviceWorker?.controller) {
    return "Sin conexión. La herramienta sigue funcionando porque está guardada en este navegador, con los nueve "
      + "dominios y los documentos de la biblioteca. Lo que puntúes se guarda aquí.";
  }

  return "Sin conexión. Puedes seguir puntuando y se guarda en este navegador, pero no recargues la página hasta "
    + "que vuelva la red.";
}
