/**
 * Si el trabajo en modo local tiene una copia fuera del navegador.
 *
 * Sin escenario compartido, la evaluacion entera vive en el localStorage de ese
 * portatil. Si alguien borra los datos del navegador, o se abre la herramienta
 * en otro, el trabajo no esta, y hasta ahora nada decia que no habia ninguna
 * copia. «Guardar una copia» dice ahora cuando se guardo la ultima, y si hay
 * cambios de hace mas de un dia que no estan en ninguna, el boton «Sesion»
 * lleva un punto.
 *
 * Un dia y no antes a proposito: durante el taller el trabajo esta a salvo en
 * el navegador, y un aviso que salta delante del cliente a los cinco minutos
 * de empezar acaba ignorado. Al dia siguiente es cuando una copia hace falta.
 *
 * En un escenario compartido no se dice nada: el trabajo esta en Firebase.
 */

import { cuandoFue } from "../core/presentacion.js?v=30";
import {
  borrarDeAlmacenamiento,
  escribirAlmacenamiento,
  leerAlmacenamiento,
} from "./almacenamiento.js?v=30";
import { els, state } from "./estado.js?v=30";


const CLAVE_ULTIMA_COPIA = "f3m-ultima-copia";
const CLAVE_CAMBIOS_SIN_COPIA = "f3m-cambios-sin-copia-desde";
const UN_DIA = 24 * 60 * 60 * 1000;

const TEXTO_POR_DEFECTO = "Descarga el trabajo en un archivo";

let enModoLocal = false;


function leerFecha(clave) {
  const valor = leerAlmacenamiento(clave);
  const fecha = valor ? new Date(valor) : null;

  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}


/** Si hay algo puntuado o escrito en alguno de los dominios. */
function hayTrabajo() {
  return Object.values(state.domains).some((dominio) =>
    (dominio?.items || []).some(
      (item) =>
        Object.values(item.scores || {}).some((score) => score !== null && score !== undefined) ||
        Boolean(String(item.comentario || "").trim()) ||
        Boolean(String(item.owner || "").trim()),
    ),
  );
}


/**
 * Se llama una vez al arrancar, con los datos ya aplicados.
 *
 * Un navegador con trabajo de antes de que existiera este aviso no tiene
 * apuntado desde cuando hay cambios sin copia: se cuenta desde hoy, para que
 * ese trabajo tambien acabe avisando.
 */
export function iniciarAvisoDeCopia({ local }) {
  enModoLocal = local;

  if (
    enModoLocal &&
    !leerFecha(CLAVE_ULTIMA_COPIA) &&
    !leerFecha(CLAVE_CAMBIOS_SIN_COPIA) &&
    hayTrabajo()
  ) {
    escribirAlmacenamiento(CLAVE_CAMBIOS_SIN_COPIA, new Date().toISOString());
  }

  pintarAvisoDeCopia();
}


/** Un cambio guardado en este navegador. Cuenta el primero tras la ultima copia. */
export function anotarCambioLocal() {
  if (!enModoLocal) {
    return;
  }

  if (!leerFecha(CLAVE_CAMBIOS_SIN_COPIA)) {
    escribirAlmacenamiento(CLAVE_CAMBIOS_SIN_COPIA, new Date().toISOString());
  }

  pintarAvisoDeCopia();
}


/** El trabajo ya esta en un archivo: guardado ahora, o recien abierto de uno. */
export function anotarCopia() {
  if (!enModoLocal) {
    return;
  }

  escribirAlmacenamiento(CLAVE_ULTIMA_COPIA, new Date().toISOString());
  borrarDeAlmacenamiento(CLAVE_CAMBIOS_SIN_COPIA);
  pintarAvisoDeCopia();
}


/** «Restaurar base» deja el navegador sin trabajo: no queda nada sin copia. */
export function olvidarCambiosSinCopia() {
  borrarDeAlmacenamiento(CLAVE_CAMBIOS_SIN_COPIA);
}


export function pintarAvisoDeCopia() {
  const explicacion = els.exportJsonButton?.querySelector("span:last-child");
  const ahora = new Date();

  const ultimaCopia = enModoLocal ? leerFecha(CLAVE_ULTIMA_COPIA) : null;
  const cambiosDesde = enModoLocal ? leerFecha(CLAVE_CAMBIOS_SIN_COPIA) : null;
  const avisar = Boolean(cambiosDesde) && ahora - cambiosDesde >= UN_DIA;

  if (explicacion) {
    let texto = TEXTO_POR_DEFECTO;

    if (ultimaCopia) {
      texto = `Última: ${cuandoFue(ultimaCopia, ahora)}${cambiosDesde ? ", y hay cambios después" : ""}`;
    } else if (cambiosDesde) {
      texto = "Todavía no has guardado ninguna";
    }

    explicacion.textContent = texto;
  }

  els.exportJsonButton?.classList.toggle("con-aviso-de-copia", avisar);

  if (els.scenarioMenuButton) {
    els.scenarioMenuButton.classList.toggle("con-aviso-de-copia", avisar);

    if (avisar) {
      els.scenarioMenuButton.title = "Hay cambios de hace más de un día sin ninguna copia guardada";
    } else {
      els.scenarioMenuButton.removeAttribute("title");
    }
  }
}
