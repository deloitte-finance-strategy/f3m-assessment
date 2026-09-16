/**
 * Hablarle al usuario: el banner de avisos y el dialogo de confirmacion.
 *
 * Los dos sustituyen a algo del navegador que no servia. El banner vivia dentro
 * de <main>, a la altura 0 de una pagina de casi 10.000 px, asi que cualquier
 * mensaje lanzado desde el Roadmap era invisible. Y el dialogo sustituye a
 * confirm() y prompt(), que no se pueden explicar ni pedir que se escriba una
 * palabra antes de borrar el trabajo de nueve dominios.
 */

import { els } from "./estado.js?v=11";
import { escapeHtml } from "../core/presentacion.js?v=11";


/**
 * Lo que queda detras de un modal abierto.
 *
 * Los avisos y el chip de guardado se quedan fuera a proposito: son regiones
 * live y tienen que poder anunciar un fallo de guardado aunque haya un modal
 * delante. Los tres modales son hijos directos de <body>, asi que ninguno cae
 * dentro de lo que se marca como inerte.
 */
const REGIONES_DE_FONDO = [
  ".app-header",
  ".app-shell",
  ".back-to-top-button",
  ".skip-link",
];


/**
 * Deja el fondo inerte mientras hay un modal abierto.
 *
 * El foco ya estaba atrapado con atraparFoco(), pero eso solo frena al
 * tabulador. Con un lector de pantalla, el cursor virtual seguia recorriendo las
 * 152 subcapacidades de detras como si el modal no existiera, y desde ahi no hay
 * forma de saber que hay un dialogo esperando una confirmacion.
 *
 * atraparFoco() se mantiene: inert no esta en navegadores antiguos y ahi sigue
 * siendo lo unico que retiene el tabulador.
 */
export function updateModalOpenState() {
  const hasOpenModal =
    !els.scoringCriteriaModal?.hidden ||
    !els.aiInitiativeModal?.hidden ||
    !els.dialogModal?.hidden;

  document.body.classList.toggle("modal-open", hasOpenModal);

  REGIONES_DE_FONDO.forEach((selector) => {
    const region = document.querySelector(selector);

    if (region) {
      region.inert = hasOpenModal;
    }
  });
}




const ICONO_POR_TIPO = {
  exito: "✓",
  info: "i",
  aviso: "!",
  error: "!",
};




let temporizadorDeAviso = null;


// Manejador del boton de accion del aviso, guardado para poder retirarlo.
let accionDeAvisoActual = null;


/**
 * Muestra un aviso donde se pueda leer y con el tono que le corresponde.
 *
 * Antes el aviso vivia dentro de <main>, a la altura 0 de una pagina de casi
 * 10.000 px: cualquier mensaje lanzado desde el Roadmap era invisible. Y usaba
 * el mismo amarillo de advertencia tanto para "Escenario importado" como para
 * "No se pudo aplicar el escenario remoto".
 */
export function showNotice(message, tipo = "info", persistente = null, accion = null) {
  if (!els.loadNotice) {
    return;
  }

  // Los errores y las advertencias no se van solos: quien esta en una sesion
  // con cliente no puede perderselos por mirar a otro lado siete segundos.
  const seQueda =
    persistente === null ? tipo === "error" || tipo === "aviso" : persistente;

  els.loadNoticeText.textContent = message;
  els.loadNoticeIcon.textContent = ICONO_POR_TIPO[tipo] || ICONO_POR_TIPO.info;
  els.loadNotice.className = `notice notice-${tipo}`;
  els.loadNotice.hidden = false;

  ponerAccionDeAviso(accion);

  window.clearTimeout(temporizadorDeAviso);

  if (seQueda) {
    return;
  }

  temporizadorDeAviso = window.setTimeout(() => {
    els.loadNotice.hidden = true;
  }, 7000);
}


/**
 * Pone —o quita— el boton de accion del aviso.
 *
 * El manejador se guarda aparte para poder retirarlo: sin eso, cada aviso con
 * accion dejaba un listener encima del anterior y un clic disparaba todos los
 * que hubieran pasado por ahi.
 */
function ponerAccionDeAviso(accion) {
  const boton = els.loadNoticeAction;

  if (!boton) {
    return;
  }

  if (accionDeAvisoActual) {
    boton.removeEventListener("click", accionDeAvisoActual);
    accionDeAvisoActual = null;
  }

  if (!accion?.texto || typeof accion.alHacerClic !== "function") {
    boton.hidden = true;
    boton.textContent = "";
    return;
  }

  accionDeAvisoActual = accion.alHacerClic;

  boton.textContent = accion.texto;
  boton.hidden = false;
  boton.addEventListener("click", accionDeAvisoActual);
}




export function ocultarAviso() {
  window.clearTimeout(temporizadorDeAviso);
  ponerAccionDeAviso(null);
  els.loadNotice.hidden = true;
}


/**
 * Dialogo propio, en sustitucion de window.confirm y window.prompt.
 *
 * Los dialogos nativos ensenan el origen de la pagina ("127.0.0.1:8777 dice:"),
 * no se pueden disenar y desentonan delante de un cliente. Ademas no permiten
 * exigir una confirmacion proporcional al riesgo ni ofrecer una accion
 * alternativa como "exportar antes de borrar".
 *
 * Devuelve false si se cancela; true si se confirma; y el texto del campo
 * cuando se ha pedido uno.
 */
let cerrarDialogoActual = null;




export function abrirDialogo({
  eyebrow = "",
  titulo,
  parrafos = [],
  tono = "neutro",
  confirmar = "Continuar",
  cancelar = "Cancelar",
  campo = null,
  confirmacionEscrita = null,
  accionSecundaria = null,
}) {
  return new Promise((resolve) => {
    const disparador = document.activeElement;

    els.dialogEyebrow.textContent = eyebrow;
    els.dialogEyebrow.hidden = !eyebrow;
    els.dialogTitle.textContent = titulo;
    els.dialogIcon.textContent = tono === "peligro" ? "!" : "?";

    els.dialogMessage.innerHTML = parrafos
      .map((texto) => `<p>${escapeHtml(texto)}</p>`)
      .join("");

    els.dialogModal.className = `modal-backdrop dialog-${tono}`;

    // alertdialog solo cuando de verdad es una alerta. El marcado lo traia
    // fijo, asi que "Poner mi nombre" —un campo de texto sin ninguna urgencia—
    // se anunciaba con el mismo enfasis que "vas a borrar el trabajo de los
    // nueve dominios", y ese enfasis deja de significar nada si vale para todo.
    els.dialogModal.setAttribute(
      "role",
      tono === "peligro" ? "alertdialog" : "dialog",
    );

    els.dialogConfirm.textContent = confirmar;
    els.dialogCancel.textContent = cancelar;

    // Campo de texto: sirve tanto para pedir un dato como para exigir que se
    // escriba una palabra antes de dejar confirmar.
    const pideTexto = Boolean(campo) || Boolean(confirmacionEscrita);

    els.dialogFieldWrap.hidden = !pideTexto;
    els.dialogField.value = campo?.valor || "";
    els.dialogField.maxLength = campo?.maxLength || 120;
    els.dialogField.placeholder = campo?.placeholder || "";
    els.dialogFieldLabel.textContent =
      campo?.etiqueta ||
      (confirmacionEscrita ? `Escribe ${confirmacionEscrita} para confirmar` : "");

    els.dialogSecondary.hidden = !accionSecundaria;
    els.dialogSecondary.textContent = accionSecundaria?.texto || "";

    const validar = () => {
      if (!confirmacionEscrita) {
        return;
      }

      els.dialogConfirm.disabled =
        els.dialogField.value.trim().toUpperCase() !==
        confirmacionEscrita.toUpperCase();
    };

    els.dialogConfirm.disabled = Boolean(confirmacionEscrita);
    validar();

    const alConfirmar = () => terminar(campo ? els.dialogField.value : true);
    const alCancelar = () => terminar(false);

    const alPulsarTecla = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        alCancelar();
        return;
      }

      if (event.key === "Enter" && pideTexto && !els.dialogConfirm.disabled) {
        event.preventDefault();
        alConfirmar();
        return;
      }

      if (event.key === "Tab") {
        atraparFoco(event, els.dialogModal);
      }
    };

    const alPulsarFondo = (event) => {
      // Un clic fuera no puede cancelar algo destructivo por accidente.
      if (event.target === els.dialogModal && tono !== "peligro") {
        alCancelar();
      }
    };

    const alPulsarSecundaria = () => accionSecundaria?.alHacerClic();

    function terminar(resultado) {
      els.dialogModal.hidden = true;
      els.dialogConfirm.removeEventListener("click", alConfirmar);
      els.dialogCancel.removeEventListener("click", alCancelar);
      els.dialogSecondary.removeEventListener("click", alPulsarSecundaria);
      els.dialogField.removeEventListener("input", validar);
      els.dialogModal.removeEventListener("click", alPulsarFondo);
      document.removeEventListener("keydown", alPulsarTecla, true);

      cerrarDialogoActual = null;
      updateModalOpenState();

      if (disparador?.isConnected) {
        disparador.focus();
      }

      resolve(resultado);
    }

    cerrarDialogoActual = alCancelar;

    els.dialogConfirm.addEventListener("click", alConfirmar);
    els.dialogCancel.addEventListener("click", alCancelar);
    els.dialogSecondary.addEventListener("click", alPulsarSecundaria);
    els.dialogField.addEventListener("input", validar);
    els.dialogModal.addEventListener("click", alPulsarFondo);
    document.addEventListener("keydown", alPulsarTecla, true);

    els.dialogModal.hidden = false;
    updateModalOpenState();

    // El foco entra en el dialogo: al campo si lo hay, y si no a Cancelar, que
    // es la opcion segura.
    if (pideTexto) {
      els.dialogField.focus();
      els.dialogField.select();
    } else {
      els.dialogCancel.focus();
    }
  });
}


/** Mantiene el tabulador dentro del modal mientras esta abierto. */
export function atraparFoco(event, contenedor) {
  const focusables = [...contenedor.querySelectorAll(
    'button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.offsetParent !== null);

  if (!focusables.length) {
    return;
  }

  const primero = focusables[0];
  const ultimo = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === primero) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault();
    primero.focus();
  }
}
