/**
 * Lo que no puede esperar a app.js: pedir los datos ya, y decirlo si la
 * aplicacion no llega a arrancar.
 *
 * Es un script clasico, sincrono en <head>, como tema.js y por lo mismo: la
 * CSP no admite scripts en linea, y `script-src 'self'` si admite un archivo.
 *
 * 1. Los tres JSON del arranque se piden desde aqui
 * -------------------------------------------------
 *
 * app.js es un modulo: no pide nada hasta que han llegado y se han ejecutado
 * todos los suyos. Pedir los tres JSON desde aqui adelanta ese viaje al
 * servidor al momento en que llega el HTML.
 *
 * Antes iban con <link rel="preload" as="fetch">, que es lo natural, y dejo de
 * servir en cuanto existio el service worker: con el activo —es decir, desde
 * la segunda visita— Chrome no casa la precarga con el fetch() de la
 * aplicacion. Pedia cada JSON dos veces y escribia seis avisos en la consola,
 * que tiene que arrancar en silencio. Comprobado en Chromium 153, no de
 * memoria. Aqui no hay nada que casar: la aplicacion recibe esta misma
 * peticion, ya en marcha (pedirDatosDelArranque(), en app/estado.js).
 *
 * Si alguna falla, se resuelve con null y la aplicacion la vuelve a pedir por
 * su cuenta: el fallo se atiende alli, con su aviso, y aqui no queda una
 * promesa rechazada sin dueno escribiendo en la consola.
 *
 * Las rutas son las de CATALOGO_URL, CASOS_DE_IA_URL y BIBLIOTECA_URL, y
 * scripts/check_module_version.py comprueba en el CI que sigan siendolo.
 *
 * 2. Si app.js no arranca, se dice
 * --------------------------------
 *
 * Un modulo que no llega —una red que lo bloquea, o un despliegue a medio
 * llegar en el que un archivo nuevo pide algo que el viejo no tiene— deja el
 * arbol de modulos sin ejecutar ENTERO. app.js no corre, asi que no puede
 * avisar de nada, y la pagina se quedaba en «Cargando los datos…» para
 * siempre, sin una palabra. Delante de un cliente no se distingue de una red
 * lenta, y se espera.
 *
 * init() marca <html data-arranque> en su primera linea. El evento `load`
 * espera a los modulos, asi que cuando llega solo hay dos posibilidades: la
 * marca esta, o la aplicacion no ha arrancado y no va a arrancar.
 */

(function () {
  var RUTAS = ["data/domains.json", "data/casos-ia.json", "data/biblioteca.json"];
  var adelantados = {};

  RUTAS.forEach(function (ruta) {
    try {
      adelantados[ruta] = window.fetch(ruta).catch(function () {
        return null;
      });
    } catch (error) {
      // Sin fetch no hay nada que adelantar; la aplicacion lo pide y lo dice.
    }
  });

  window.f3mDatosAdelantados = adelantados;


  function parrafo(clase, texto) {
    var elemento = document.createElement("p");

    elemento.className = clase;
    elemento.textContent = texto;

    return elemento;
  }


  window.addEventListener("load", function () {
    if (document.documentElement.dataset.arranque) {
      return;
    }

    var estado = document.getElementById("initialLoadingState");

    if (!estado) {
      return;
    }

    var titulo = document.createElement("h2");
    var boton = document.createElement("button");
    var texto = document.createElement("div");

    titulo.textContent = "La herramienta no ha terminado de cargar";

    boton.type = "button";
    boton.className = "primary-button";
    boton.textContent = "Recargar";
    boton.addEventListener("click", function () {
      window.location.reload();
    });

    texto.appendChild(parrafo("eyebrow", "No se ha podido abrir"));
    texto.appendChild(titulo);
    texto.appendChild(parrafo(
      "small-note",
      "Suele ser la red, o una actualización que ha llegado a medias. Recarga la página; "
        + "si sigue igual, prueba con Ctrl + F5 o con otra red. Lo que ya estaba puntuado no se ha tocado."
    ));
    texto.appendChild(boton);

    estado.textContent = "";
    estado.appendChild(texto);
    estado.classList.add("loading-state-fallo");
    estado.setAttribute("role", "alert");
    estado.hidden = false;
  });
})();
