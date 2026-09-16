/**
 * Decide el tema y la densidad ANTES de que la pagina pinte.
 *
 * Se carga sincrono en <head>, sin defer y sin type="module", y por eso es un
 * archivo tan corto: todo lo que se ponga aqui retrasa el primer pintado.
 *
 * Por que aqui y no en app.js. app.js es un modulo, asi que se ejecuta despues
 * de analizar el HTML: la pagina llega a pintarse en claro y da un salto a
 * oscuro. Con un taller proyectado, ese salto lo ve la sala entera.
 *
 * Y por que un archivo y no un <script> en linea, que seria lo natural para
 * algo de diez lineas: la CSP de index.html no admite scripts en linea —es la
 * directiva que cierra la inyeccion de codigo— y `script-src 'self'` si admite
 * un archivo del propio origen.
 *
 * Que el tema salga resuelto en un atributo ahorra ademas escribir los cuarenta
 * y tantos colores del tema oscuro dos veces en la hoja de estilos: una para la
 * consulta de medios y otra para la eleccion explicita.
 *
 * Todo va dentro de un try: leer localStorage lanza excepcion en algunas
 * ventanas privadas y con el almacenamiento bloqueado por politica, y quedarse
 * sin arrancar por no poder leer una preferencia seria absurdo.
 */

(function () {
  var raiz = document.documentElement;

  function leer(clave) {
    try {
      return window.localStorage.getItem(clave);
    } catch (error) {
      return null;
    }
  }

  function prefiereOscuro() {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (error) {
      return false;
    }
  }

  // Sin eleccion guardada manda el sistema. Con eleccion guardada manda ella,
  // en los dos sentidos: quien pone claro con el sistema en oscuro lo hace a
  // proposito.
  var guardado = leer("f3m-tema");

  var oscuro =
    guardado === "oscuro" || (guardado !== "claro" && prefiereOscuro());

  raiz.dataset.tema = oscuro ? "oscuro" : "claro";

  // La densidad viene por el mismo camino y por el mismo motivo: si el taller
  // de ayer quedo en modo presentacion, la pantalla no debe empezar pequena.
  if (leer("f3m-modo-presentacion") === "1") {
    raiz.dataset.densidad = "presentacion";
  }
})();
