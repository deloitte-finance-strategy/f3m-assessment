/**
 * Los proximos pasos acordados: la pantalla que sigue al cierre del taller.
 *
 * El acta llevaba una tabla de proximos pasos en blanco, para rellenarla a
 * mano despues, y los compromisos se cerraban por correo dias mas tarde. Aqui
 * se apuntan en la sala, proyectados, delante de quien los asume: que se va a
 * hacer, quien y cuando. Salen ya rellenos en el acta y en el texto del correo.
 *
 * Son del dominio, como el acta: state.proximosPasos[domainId]. Mientras se
 * escribe manda la pantalla —cada pulsacion la vuelve a leer entera— y el
 * estado la sigue. Una fila en blanco no se guarda.
 *
 * Pinta y guarda. Cuando se enseña lo decide app/taller.js.
 */

import { LIMITES_DE_PASO, MAXIMO_DE_PASOS, normalizarPaso } from "../core/escenario.js?v=31";
import { escapeAttr, escapeHtml, formatNumber } from "../core/presentacion.js?v=31";
import { guardarYaLoPendienteDe, programarGuardadoDe } from "./edicion.js?v=31";
import { state } from "./estado.js?v=31";
import { persistProximosPasos } from "./persistencia.js?v=31";


const CAMPOS = [
  { campo: "accion", nombre: "qué se va a hacer", ejemplo: "Qué se va a hacer…" },
  { campo: "responsable", nombre: "quién", ejemplo: "Quién" },
  { campo: "fecha", nombre: "cuándo", ejemplo: "Cuándo" },
];


// El dominio de la pantalla que esta abierta: lo pendiente se guarda en el
// suyo aunque se cambie de dominio justo despues.
let dominioDeLaPantalla = null;

const claveDe = (domainId) => `proximosPasos:${domainId}`;


/** Los pasos guardados de un dominio, o una lista vacia. */
export function pasosDelDominio(domainId) {
  return state.proximosPasos?.[domainId] || [];
}


export function htmlDeLosPasos({ pasos = [], dominio = "" }) {
  // Sin ninguno, una fila en blanco: la pantalla invita a escribir, no a buscar un boton.
  const filas = pasos.length ? pasos : [{}];

  return `
    <div class="modo-taller-cabecera">
      <span class="capability-chip">Cierre del taller</span>
      <h2 id="modoTallerTitulo" tabindex="-1">Próximos pasos acordados</h2>
      <p>Lo que se apunte aquí, delante de todos, sale en el acta con su responsable y su fecha, y en el texto del correo.</p>
    </div>

    <div class="modo-taller-pasos" role="group" aria-label="${escapeAttr(`Próximos pasos de ${dominio}`)}">
      <div class="modo-taller-pasos-cabeza" aria-hidden="true">
        <span></span>
        ${CAMPOS.map(({ nombre }) => `<span>${escapeHtml(nombre.charAt(0).toUpperCase() + nombre.slice(1))}</span>`).join("")}
        <span></span>
      </div>
      <ol class="modo-taller-pasos-lista">
        ${filas.map((paso, posicion) => fila(paso, posicion)).join("")}
      </ol>
      <p class="modo-taller-pasos-pie">
        <button class="modo-taller-pasos-anadir" type="button" data-pasos="anadir">
          <span aria-hidden="true">+</span> Añadir otro paso
        </button>
        <span class="modo-taller-pasos-tope" hidden>${escapeHtml(`Como mucho ${formatNumber(MAXIMO_DE_PASOS)} pasos: los que caben en la pantalla.`)}</span>
      </p>
    </div>
  `;
}


function fila(paso = {}, posicion = 0) {
  const numero = posicion + 1;

  return `
    <li class="modo-taller-pasos-fila">
      <span class="modo-taller-pasos-numero" aria-hidden="true">${numero}</span>
      ${CAMPOS.map(
        ({ campo, nombre, ejemplo }) => `
          <input
            class="modo-taller-pasos-${campo}"
            type="text"
            data-campo="${campo}"
            maxlength="${LIMITES_DE_PASO[campo]}"
            placeholder="${escapeAttr(ejemplo)}"
            aria-label="${escapeAttr(`Paso ${numero}: ${nombre}`)}"
            value="${escapeAttr(paso[campo] || "")}"
            autocomplete="off"
          >
        `,
      ).join("")}
      <button class="modo-taller-pasos-quitar" type="button" data-pasos="quitar" aria-label="${escapeAttr(`Quitar el paso ${numero}`)}">
        <span aria-hidden="true">×</span>
      </button>
    </li>
  `;
}


/**
 * Escuchas sobre la pantalla recien pintada. Van en el bloque de los pasos y
 * no en el cuerpo del modo taller, que se reutiliza de una pantalla a otra:
 * ahi se irian sumando a cada visita.
 */
export function conectarLosPasos(contenedor, domainId) {
  const bloque = contenedor.querySelector(".modo-taller-pasos");

  if (!bloque) {
    return;
  }

  dominioDeLaPantalla = domainId;
  pintarElTope(bloque);

  bloque.addEventListener("input", (event) => {
    if (event.target.matches("[data-campo]") && leerLaPantalla(bloque, domainId)) {
      programarGuardadoDe(claveDe(domainId), () => persistProximosPasos(domainId));
    }
  });

  // Al soltar el campo se guarda ya, sin esperar.
  bloque.addEventListener("change", () => guardarLosPasosPendientes());

  bloque.addEventListener("click", (event) => {
    const accion = event.target.closest("[data-pasos]")?.dataset.pasos;

    if (accion === "anadir") {
      anadirFila(bloque);
    } else if (accion === "quitar") {
      quitarFila(bloque, event.target.closest(".modo-taller-pasos-fila"), domainId);
    }
  });

  // Intro pasa al paso siguiente, y en el ultimo abre otro: en la sala se
  // dictan uno detras de otro.
  bloque.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches("[data-campo]") || event.isComposing) {
      return;
    }

    event.preventDefault();

    const filaActual = event.target.closest(".modo-taller-pasos-fila");
    const siguiente = filaActual?.nextElementSibling;

    if (siguiente) {
      siguiente.querySelector("[data-campo]")?.focus();
    } else if ([...filaActual.querySelectorAll("[data-campo]")].some((campo) => campo.value.trim())) {
      anadirFila(bloque);
    }
  });
}


/** Lo que quedara por guardar de la pantalla, ya. Lo llama el modo taller al salir de ella. */
export function guardarLosPasosPendientes() {
  if (dominioDeLaPantalla) {
    const domainId = dominioDeLaPantalla;

    guardarYaLoPendienteDe(claveDe(domainId), () => persistProximosPasos(domainId));
  }
}


/** Si la pantalla tiene el foco: entonces un repintado borraria lo que se esta escribiendo. */
export function seEstaEscribiendoUnPaso() {
  return Boolean(document.activeElement?.closest?.(".modo-taller-pasos"));
}


/**
 * Pasa al estado lo que dice la pantalla. Devuelve si ha cambiado algo: un
 * espacio de mas al final no merece una escritura.
 */
function leerLaPantalla(bloque, domainId) {
  const pasos = [...bloque.querySelectorAll(".modo-taller-pasos-fila")]
    .map((filaDelPaso) =>
      normalizarPaso(
        Object.fromEntries(
          [...filaDelPaso.querySelectorAll("[data-campo]")].map((campo) => [campo.dataset.campo, campo.value]),
        ),
      ),
    )
    .filter(Boolean)
    .slice(0, MAXIMO_DE_PASOS);

  const antes = JSON.stringify(pasosDelDominio(domainId));

  if (JSON.stringify(pasos) === antes) {
    return false;
  }

  if (pasos.length) {
    state.proximosPasos[domainId] = pasos;
  } else {
    delete state.proximosPasos[domainId];
  }

  return true;
}


function anadirFila(bloque) {
  const lista = bloque.querySelector(".modo-taller-pasos-lista");
  const filas = lista.querySelectorAll(".modo-taller-pasos-fila");

  if (filas.length >= MAXIMO_DE_PASOS) {
    return;
  }

  lista.insertAdjacentHTML("beforeend", fila({}, filas.length));
  pintarElTope(bloque);
  lista.lastElementChild?.querySelector("[data-campo]")?.focus();
}


/**
 * Sin confirmar: lo que se quita es una linea que se acaba de escribir delante
 * de todos, y se vuelve a escribir en un momento. El foco pasa a la fila que
 * ocupa su sitio, o a «Añadir otro paso» si era la ultima.
 */
function quitarFila(bloque, filaDelPaso, domainId) {
  if (!filaDelPaso) {
    return;
  }

  const lista = bloque.querySelector(".modo-taller-pasos-lista");
  const posicion = [...lista.children].indexOf(filaDelPaso);

  filaDelPaso.remove();

  // La ultima no se quita del todo: se queda en blanco, lista para escribir.
  if (!lista.children.length) {
    lista.insertAdjacentHTML("beforeend", fila({}, 0));
  }

  renumerar(lista);
  pintarElTope(bloque);

  if (leerLaPantalla(bloque, domainId)) {
    programarGuardadoDe(claveDe(domainId), () => persistProximosPasos(domainId));
  }

  // Quitar no es escribir: no hay mas pulsaciones que esperar.
  guardarLosPasosPendientes();

  const destino = lista.children[posicion] || lista.lastElementChild;

  destino?.querySelector("[data-campo]")?.focus();
}


function renumerar(lista) {
  [...lista.children].forEach((filaDelPaso, posicion) => {
    const numero = posicion + 1;

    filaDelPaso.querySelector(".modo-taller-pasos-numero").textContent = numero;
    filaDelPaso.querySelectorAll("[data-campo]").forEach((campo) => {
      const { nombre } = CAMPOS.find((entrada) => entrada.campo === campo.dataset.campo);

      campo.setAttribute("aria-label", `Paso ${numero}: ${nombre}`);
    });
    filaDelPaso.querySelector("[data-pasos='quitar']")?.setAttribute("aria-label", `Quitar el paso ${numero}`);
  });
}


function pintarElTope(bloque) {
  const lleno = bloque.querySelectorAll(".modo-taller-pasos-fila").length >= MAXIMO_DE_PASOS;
  const anadir = bloque.querySelector("[data-pasos='anadir']");
  const tope = bloque.querySelector(".modo-taller-pasos-tope");

  if (anadir) {
    anadir.hidden = lleno;
  }

  if (tope) {
    tope.hidden = !lleno;
  }
}
