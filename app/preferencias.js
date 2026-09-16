/**
 * Las dos preferencias de vista: el tema y la densidad.
 *
 * Ninguna de las dos se aplica aqui por primera vez. tema.js las resuelve antes
 * del primer pintado, escribiendo data-tema y data-densidad en <html>, porque
 * desde un modulo la pagina llega a pintarse en claro y da un salto. Este
 * modulo es el que las CAMBIA cuando alguien pulsa un conmutador, y el que sabe
 * traducirlas a la paleta de los graficos.
 *
 * Repintar no es cosmetico en ninguno de los dos casos: los radares son canvas
 * y Chart.js fija sus colores y su tipografia al construirlos. Sin repintar, la
 * interfaz cambiaria y los seis graficos se quedarian como estaban.
 *
 * El repintado se pide por app/repintado.js y no se importa del orquestador de
 * vistas: eso cerraria un ciclo, y un ciclo que hoy funciona por como se
 * hoistean las funciones es una trampa para quien lo toque manana.
 */

import { COLOR_DE_PALANCA } from "../core/presentacion.js?v=11";
import { MODO_PRESENTACION_KEY, TEMA_KEY, els } from "./estado.js?v=11";
import { escribirAlmacenamiento, leerAlmacenamiento } from "./almacenamiento.js?v=11";
import { repintarTodo } from "./repintado.js?v=11";



/**
 * La paleta de los radares, por tema.
 *
 * Chart.js no lee CSS: sus colores van en la configuracion, asi que los tokens
 * del tema oscuro no le llegan. Y ahi no es un detalle: el azul de
 * Organizacion, #012169, sobre una tarjeta oscura es practicamente invisible.
 *
 * Los tres colores de palanca SON identidad y no cambian: lo que hay aqui son
 * las versiones aclaradas para dibujar sobre fondo oscuro, que siguen siendo
 * verde, naranja y azul y se siguen reconociendo. El informe PDF no pasa por
 * aqui —usa COLOR_DE_PALANCA directamente— porque sale claro siempre.
 */
const PALETA_DE_RADAR = {
  claro: {
    procesos: COLOR_DE_PALANCA.procesos,
    tecnologia: COLOR_DE_PALANCA.tecnologia,
    organizacion: COLOR_DE_PALANCA.organizacion,
    areaProcesos: "rgba(134, 188, 37, 0.24)",
    areaTecnologia: "rgba(237, 139, 0, 0.22)",
    areaOrganizacion: "rgba(1, 33, 105, 0.18)",
    objetivo: "#4f5952",
    leyenda: "#3a433d",
    marcas: "#5c665e",
    ejes: "#323a35",
    rejilla: "#d9dfd4",
    vertice: "#ffffff",
  },
  oscuro: {
    procesos: "#a8dc4e",
    tecnologia: "#f0a93a",
    organizacion: "#7aa6e8",
    areaProcesos: "rgba(168, 220, 78, 0.26)",
    areaTecnologia: "rgba(240, 169, 58, 0.24)",
    areaOrganizacion: "rgba(122, 166, 232, 0.22)",
    objetivo: "#b3bdb6",
    leyenda: "#cfd8d1",
    marcas: "#a2aca5",
    ejes: "#cfd8d1",
    rejilla: "#39423c",
    // El borde del vertice es del color de la TARJETA, para que el punto
    // resalte sobre el area de color. En claro es blanco; en oscuro, la
    // superficie oscura.
    vertice: "#1a201c",
  },
};


/** El tema que hay puesto, que tema.js resuelve antes del primer pintado. */
export function temaActual() {
  return document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro";
}




export function paletaDeRadar() {
  return PALETA_DE_RADAR[temaActual()];
}


/**
 * Deja el conmutador de tema diciendo lo que hay puesto.
 *
 * El tema ya esta aplicado: lo resuelve tema.js antes del primer pintado. Aqui
 * solo se pone al dia el boton, que app.js es quien conoce los elementos.
 */
export function actualizarBotonDeTema() {
  const boton = els.themeButton;

  if (!boton) {
    return;
  }

  const oscuro = temaActual() === "oscuro";

  boton.setAttribute("aria-pressed", String(oscuro));

  // El title dice de donde viene el tema, que no es lo mismo que cual es: sin
  // eleccion guardada lo pone el sistema y cambia solo si el sistema cambia.
  boton.title = leerAlmacenamiento(TEMA_KEY)
    ? "Tema elegido a mano. Vuelve a pulsarlo para cambiarlo."
    : "Sigue la preferencia del sistema hasta que lo pulses";
}


/**
 * Aplica un tema y repinta.
 *
 * Repintar no es cosmetico: los radares son canvas y Chart.js no lee CSS, asi
 * que sus colores se fijan al construirlos. Sin esto, la interfaz cambiaria de
 * tema y los seis graficos se quedarian con la paleta anterior.
 */
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema === "oscuro" ? "oscuro" : "claro";

  actualizarBotonDeTema();
  repintarTodo();
}


/* ------------------------------------------------------------------ tema */


export function alternarTema() {
  const siguiente = temaActual() === "oscuro" ? "claro" : "oscuro";

  escribirAlmacenamiento(TEMA_KEY, siguiente);
  aplicarTema(siguiente);
}


/**
 * Sigue al sistema mientras no haya una eleccion guardada.
 *
 * Quien no ha tocado el boton espera que la herramienta acompane a su sistema,
 * tambien si lo cambia con la pestana abierta. Quien si lo ha tocado espera lo
 * contrario: que se quede como lo dejo.
 */
export function seguirAlSistemaSiNoHayEleccion() {
  if (!window.matchMedia) {
    return;
  }

  const consulta = window.matchMedia("(prefers-color-scheme: dark)");

  const alCambiar = (evento) => {
    if (leerAlmacenamiento(TEMA_KEY)) {
      return;
    }

    aplicarTema(evento.matches ? "oscuro" : "claro");
  };

  // addEventListener en MediaQueryList es lo moderno; addListener es lo que
  // entienden Safari antiguos, y esta herramienta se abre en el portatil que
  // haya en la sala.
  if (consulta.addEventListener) {
    consulta.addEventListener("change", alCambiar);
  } else if (consulta.addListener) {
    consulta.addListener(alCambiar);
  }
}


/** Si la herramienta esta en modo presentacion, para proyectarla en sala. */
export function enModoPresentacion() {
  return document.documentElement.dataset.densidad === "presentacion";
}


/**
 * Tamano de letra de los radares.
 *
 * Chart.js no lee CSS: sus tipografias van en la configuracion, asi que el
 * modo presentacion no le llega por los tokens como al resto. Sin esto, los
 * nueve ejes del radar global se quedaban en 11 px mientras la tabla de al lado
 * crecia un 20%, que es peor que no agrandar nada.
 *
 * Sube a 13 y no a 15, que es lo que pedia la proporcion. El ancho del lienzo
 * lo fija la rejilla de tres columnas y NO crece con el modo, asi que a 15 px
 * los rotulos de un solo eje se salian: "Estrategicas" y "Auditoria Interna"
 * aparecian cortados por la mitad. Un rotulo recortado en un radar proyectado
 * es justo el fallo que este modo venia a evitar. La legibilidad la pone
 * sobre todo el lienzo, que si crece de 380 a 480 px.
 */
export function tamanoDeLetraDeGrafico() {
  return enModoPresentacion() ? 13 : 11;
}


/**
 * Aplica el modo presentacion, sin repintar.
 *
 * Se llama tambien en el arranque, antes de que haya nada que repintar, de ahi
 * que la decision de llamar a renderAll() sea de quien alterna.
 */
function aplicarModoPresentacion(activo) {
  if (activo) {
    document.documentElement.dataset.densidad = "presentacion";
  } else {
    delete document.documentElement.dataset.densidad;
  }

  els.presentationModeButton?.setAttribute("aria-pressed", String(Boolean(activo)));
}


/* ---------------------------------------------------------- presentacion */


export function alternarModoPresentacion() {
  const activo = !enModoPresentacion();

  aplicarModoPresentacion(activo);
  escribirAlmacenamiento(MODO_PRESENTACION_KEY, activo ? "1" : "0");

  // Repintar es obligatorio, no cosmetico: los radares son canvas y su
  // tipografia se fija al construirlos, asi que la tabla se agrandaria y los
  // tres graficos de al lado se quedarian como estaban.
  repintarTodo();
}


/**
 * Pone el conmutador de presentacion al dia.
 *
 * El atributo ya lo escribio tema.js antes del primer pintado; esto solo repite
 * la lectura para dejar el aria-pressed en su sitio. Se conserva la llamada a
 * aplicarModoPresentacion() y no se lee el atributo directamente para que el
 * estado siga saliendo de un unico sitio, la preferencia guardada.
 */
export function restaurarModoPresentacion() {
  aplicarModoPresentacion(leerAlmacenamiento(MODO_PRESENTACION_KEY) === "1");
}


/**
 * Como desplazarse: suave, salvo que el sistema pida lo contrario.
 *
 * El CSS ya anula las transiciones con prefers-reduced-motion, pero un
 * scrollTo({ behavior: "smooth" }) escrito en JavaScript no lo mira: hay que
 * preguntarlo aqui.
 */
export function comportamientoDeDesplazamiento() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
