/**
 * El modo taller: una subcapacidad a pantalla completa, para proyectarla.
 *
 * En un taller se proyecta durante una hora, y lo que se proyectaba era la
 * herramienta de trabajo del consultor: a 1366×768 y en Presentacion, al abrir
 * el Assessment no se veia ni una tarjeta, y los cinco niveles que se leen con
 * el cliente estaban plegados en «Ver detalle», debajo de la escala. Aqui los
 * cinco van en columnas, uno junto a otro, con cada palanca y el objetivo
 * marcados encima del nivel en el que estan.
 *
 * Es un modal mas (.modal-backdrop) y no un <dialog>, aunque el buscador si lo
 * sea. Un <dialog> abierto con showModal() va a la capa superior, por encima de
 * todo, y este ocupa la pantalla entera: taparia el chip de guardado y los
 * avisos, que son la unica señal de que una puntuacion no ha llegado. Como
 * modal, updateModalOpenState() deja el fondo inerte y el chip y los avisos se
 * quedan fuera, por delante.
 *
 * Puntuar, las notas y su guardado son los del Assessment: los mismos radios
 * (scoreControl), los mismos manejadores (conectarPuntuacion) y el mismo
 * guardado diferido de edicion.js. Lo unico propio es como se enseña.
 */

import { getMaturityLevel } from "../core/calculo.js?v=27";
import { LIMITES_DE_TEXTO } from "../core/escenario.js?v=27";
import { escapeAttr, escapeHtml, formatMedia } from "../core/presentacion.js?v=27";
import { SELECTOR_DE_MODAL_ABIERTO, atraparFoco, showNotice, updateModalOpenState } from "./avisos.js?v=27";
import { nombreDeMasInformacion } from "./biblioteca.js?v=27";
import { priorityBadge } from "./celdas.js?v=27";
import { getActiveDomainConfig } from "./dominios.js?v=27";
import {
  actualizarContadorDeComentario,
  guardarCampoAhora,
  programarGuardado,
} from "./edicion.js?v=27";
import { LEVERS, state } from "./estado.js?v=27";
import { getVisibleItems } from "./filtros.js?v=27";
import { calculate, getCapabilityTargets } from "./metricas.js?v=27";
import { repintarTodo } from "./repintado.js?v=27";
import { getAiDataForItem, getItemObjective, getItemQuestions } from "./subcapacidad.js?v=27";
import {
  conectarPuntuacion,
  enfocarPalanca,
  idDeLaTarjetaEnCurso,
  llevarALasTarjetas,
  scoreControl,
} from "./vistas/assessment.js?v=27";


let panel = null;
let cuerpo = null;
let donde = null;
let posicion = null;
let resultado = null;
let anterior = null;
let siguiente = null;

// Las subcapacidades del recorrido, fijadas al abrir. Si se recalculara en cada
// paso, con un filtro de prioridad puesto, puntuar una podria sacarla de la
// lista y «Siguiente» se saltaria la que venia detras.
let recorrido = [];
let indice = 0;
let disparador = null;


const abierto = () => Boolean(panel) && !panel.hidden;

const itemActual = () => state.items.find((item) => item.id === recorrido[indice]) || null;

const nombreDelNivel = (nivel) => (getMaturityLevel(nivel) || "").split(" - ")[1] || "";


/**
 * `irAlAssessment` lo pone app.js: el boton esta en el menu «Sesion», que se ve
 * desde cualquier vista, y el modo taller recorre las tarjetas del Assessment y
 * vuelve a ellas al salir. Se inyecta porque cambiar de vista es cosa del
 * orquestador, y importarlo de app.js cerraria un ciclo con el.
 */
export function setupModoTaller({ irAlAssessment = () => {} } = {}) {
  panel = document.getElementById("modoTaller");
  cuerpo = document.getElementById("modoTallerCuerpo");
  donde = document.getElementById("modoTallerDonde");
  posicion = document.getElementById("modoTallerPosicion");
  resultado = document.getElementById("modoTallerResultado");
  anterior = document.getElementById("modoTallerAnterior");
  siguiente = document.getElementById("modoTallerSiguiente");

  const boton = document.getElementById("modoTallerButton");

  if (!panel || !cuerpo || !boton) {
    boton?.setAttribute("hidden", "");
    return;
  }

  // Al salir, el foco va a la tarjeta. Si no la hubiera, al boton del menu y
  // no a la entrada, que se queda escondida con el menu cerrado.
  const menu = document.getElementById("scenarioMenuButton") || boton;

  boton.addEventListener("click", () => {
    irAlAssessment();
    abrirModoTaller(menu);
  });
  document.getElementById("modoTallerSalir")?.addEventListener("click", () => cerrarModoTaller());
  anterior?.addEventListener("click", () => irA(indice - 1));
  siguiente?.addEventListener("click", () => irA(indice + 1));

  document.addEventListener("keydown", alPulsarTecla);
}


/**
 * Empieza donde se estaba trabajando, con las subcapacidades que se ven en el
 * Assessment: con un filtro de capacidad puesto, el taller es de esa capacidad.
 */
export function abrirModoTaller(desde = null) {
  if (!panel || abierto() || document.querySelector(SELECTOR_DE_MODAL_ABIERTO)) {
    return;
  }

  recorrido = getVisibleItems().map((item) => item.id);

  if (!recorrido.length) {
    showNotice(
      state.items.length
        ? "Con los filtros puestos no queda ninguna subcapacidad para el modo taller."
        : "Este dominio no tiene subcapacidades cargadas: no hay nada que enseñar en el modo taller.",
      "aviso",
    );
    return;
  }

  indice = Math.max(0, recorrido.indexOf(idDeLaTarjetaEnCurso()));
  disparador = desde;

  panel.hidden = false;
  updateModalOpenState();
  pintar();
}


/**
 * Al salir se vuelve a la lista, en la tarjeta de la ultima subcapacidad vista:
 * es donde se quedo el taller.
 *
 * `volver: false` es para cuando lo cierra un repintado —la subcapacidad ha
 * desaparecido—: ahi no se puede pedir otro repintado sin volver a entrar aqui.
 */
export function cerrarModoTaller({ volver = true } = {}) {
  if (!abierto()) {
    return;
  }

  // Lo que quedaba por guardar de las notas se guarda ya, y la lista se
  // repinta para que la tarjeta enseñe lo escrito aqui.
  const notas = cuerpo.querySelector(".modo-taller-notas");
  const item = itemActual();

  if (notas && item) {
    guardarCampoAhora(item, "comentario", notas);
  }

  const ultimo = recorrido[indice];

  panel.hidden = true;
  cuerpo.innerHTML = "";
  updateModalOpenState();

  if (!volver) {
    return;
  }

  repintarTodo();

  const tarjeta = document.querySelector(`.assessment-card[data-id="${CSS.escape(ultimo || "")}"]`);

  if (tarjeta) {
    llevarALasTarjetas([tarjeta]);
  } else if (disparador?.isConnected) {
    disparador.focus();
  }

  disparador = null;
}


/**
 * Lo llama renderAll() en cada repintado: tras puntuar aqui, y tambien cuando
 * llega el cambio de otra persona del escenario compartido. Actualiza en su
 * sitio, sin reconstruir nada, para no quitarle el foco a quien puntua.
 */
export function refrescarModoTaller() {
  if (!abierto()) {
    return;
  }

  const item = itemActual();

  if (!item) {
    cerrarModoTaller({ volver: false });
    return;
  }

  cuerpo.querySelectorAll(".score-radio").forEach((radio) => {
    radio.checked = item.scores[radio.dataset.lever] === Number(radio.value);
  });

  const notas = cuerpo.querySelector(".modo-taller-notas");

  // Lo que se esta escribiendo no se pisa: el guardado diferido lo envia enseguida.
  if (notas && document.activeElement !== notas && notas.value !== (item.comentario || "")) {
    notas.value = item.comentario || "";
  }

  pintarMarcas(item);
  pintarResultado(item);
}


function irA(nuevo) {
  if (nuevo < 0 || nuevo >= recorrido.length || nuevo === indice) {
    return;
  }

  const notas = cuerpo.querySelector(".modo-taller-notas");
  const item = itemActual();

  if (notas && item) {
    guardarCampoAhora(item, "comentario", notas);
  }

  indice = nuevo;
  pintar();
}


function pintar() {
  const item = itemActual();

  if (!item) {
    cerrarModoTaller({ volver: false });
    return;
  }

  const objetivos = getCapabilityTargets(item.capacidad);
  const dominio = getActiveDomainConfig();
  const casos = getAiDataForItem(item)?.casos || [];

  donde.textContent = [dominio.label, state.cliente].filter(Boolean).join(" · ");

  cuerpo.innerHTML = `
    <div class="modo-taller-cabecera">
      <span class="capability-chip">${escapeHtml(item.capacidad)}</span>
      <h2 id="modoTallerTitulo">${escapeHtml(item.subcapacidad)}</h2>
      <p>${escapeHtml(getItemObjective(item))}</p>
    </div>

    <ol class="modo-taller-niveles">
      ${[1, 2, 3, 4, 5]
        .map(
          (nivel) => `
            <li class="modo-taller-nivel modo-taller-nivel-${nivel}">
              <h3><span>${nivel}</span> ${escapeHtml(nombreDelNivel(nivel))}</h3>
              <div class="modo-taller-marcas" data-nivel="${nivel}"></div>
              <p>${escapeHtml(item.maturity?.[nivel] || item.maturity?.[String(nivel)] || "")}</p>
            </li>
          `,
        )
        .join("")}
    </ol>

    <div class="modo-taller-palancas">
      ${LEVERS.map(
        (lever) => `
          <div class="modo-taller-palanca">
            <span class="modo-taller-punto modo-taller-punto-${lever.key}" aria-hidden="true"></span>
            ${scoreControl(item, lever, { prefijo: "taller", objetivo: Math.round(objetivos[lever.key]) })}
          </div>
        `,
      ).join("")}
    </div>

    <div class="modo-taller-apoyo${casos.length ? " con-ia" : ""}">
      <section>
        <h4>Preguntas clave</h4>
        <ul>${getItemQuestions(item).map((pregunta) => `<li>${escapeHtml(pregunta)}</li>`).join("")}</ul>
      </section>

      <section class="modo-taller-notas-bloque">
        <h4><label for="modoTallerNotas">Notas del taller</label></h4>
        <textarea
          class="modo-taller-notas"
          id="modoTallerNotas"
          maxlength="${LIMITES_DE_TEXTO.comentario}"
          placeholder="Por qué esta puntuación, qué evidencias se han visto…"
        ></textarea>
      </section>

      ${columnaDeIa(casos)}
    </div>
  `;

  const notas = cuerpo.querySelector(".modo-taller-notas");
  const bloque = cuerpo.querySelector(".modo-taller-notas-bloque");

  notas.value = item.comentario || "";
  notas.addEventListener("input", () => {
    actualizarContadorDeComentario(notas, bloque);
    programarGuardado(item, "comentario", notas);
  });
  notas.addEventListener("change", () => guardarCampoAhora(item, "comentario", notas));

  conectarPuntuacion(cuerpo);

  pintarMarcas(item);
  pintarResultado(item);

  anterior.disabled = indice === 0;
  siguiente.disabled = indice === recorrido.length - 1;

  // Con el foco en la primera palanca, las teclas 1 a 5 ya puntuan.
  enfocarPalanca(cuerpo.querySelector(".score-segmentos"), { preventScroll: true });
}


/**
 * Los casos de IA de la subcapacidad, en una tercera columna junto a las
 * preguntas y las notas: la conversacion de «y esto, ¿como lo haria la IA?»
 * sale sola al puntuar, y asi se contesta sin salir de la pantalla.
 *
 * Va el titulo y nada mas, y el titulo es el boton que abre su documento en
 * el visor, encima del modo taller (Escape cierra solo el visor). Las fichas
 * del Assessment no caben: con sus etiquetas y su pie, en una franja aparte,
 * los niveles se quedaban con la mitad de su alto y la pantalla se desplazaba
 * en una de cada tres subcapacidades. La frase de que hace el caso y sus dos
 * etiquetas quedan en el title, para quien pase el raton.
 */
function columnaDeIa(casos) {
  if (!casos.length) {
    return "";
  }

  return `
    <section class="modo-taller-ia">
      <h4>Casos de IA</h4>
      <ul>${casos.map(casoDeIa).join("")}</ul>
    </section>
  `;
}


function casoDeIa(caso) {
  const resumen = [caso.descripcion, [caso.tipoValor, caso.tipoIa].filter(Boolean).join(" · ")]
    .filter(Boolean)
    .join("\n");
  const titulo = resumen ? ` title="${escapeAttr(resumen)}"` : "";
  const nombre = nombreDeMasInformacion(caso);

  if (!nombre) {
    return `<li${titulo}>${escapeHtml(caso.titulo)}</li>`;
  }

  return `
    <li${titulo}>
      <button
        class="modo-taller-caso"
        type="button"
        data-mas-informacion="${escapeAttr(caso.id)}"
        aria-label="${escapeAttr(nombre)}"
      >${escapeHtml(caso.titulo)}</button>
    </li>
  `;
}


/**
 * Encima de cada nivel, las palancas que estan en el y el objetivo. Es lo que
 * se mira en la sala: donde estamos, palanca a palanca, y a donde hay que
 * llegar. El nivel resaltado de «Ver detalle» es el de la media, y con
 * Procesos en 1 y Tecnologia en 3 no dice ni lo uno ni lo otro.
 */
function pintarMarcas(item) {
  const objetivos = getCapabilityTargets(item.capacidad);
  const objetivosIguales = new Set(LEVERS.map((lever) => Math.round(objetivos[lever.key]))).size === 1;

  cuerpo.querySelectorAll(".modo-taller-marcas").forEach((contenedor) => {
    const nivel = Number(contenedor.dataset.nivel);
    const aqui = LEVERS.filter((lever) => item.scores[lever.key] === nivel);
    const objetivoAqui = LEVERS.filter((lever) => Math.round(objetivos[lever.key]) === nivel);

    const marcas = aqui.map(
      (lever) => `
        <span class="modo-taller-marca">
          <span class="modo-taller-punto modo-taller-punto-${lever.key}" aria-hidden="true"></span>
          ${escapeHtml(lever.label)}
        </span>
      `,
    );

    if (objetivoAqui.length) {
      const de = objetivosIguales ? "" : ` · ${objetivoAqui.map((lever) => lever.label).join(", ")}`;

      marcas.push(`<span class="modo-taller-marca modo-taller-marca-objetivo">Objetivo${escapeHtml(de)}</span>`);
    }

    contenedor.innerHTML = marcas.join("");
    contenedor.closest(".modo-taller-nivel")?.classList.toggle("tiene-palancas", aqui.length > 0);
  });
}


function pintarResultado(item) {
  const metricas = calculate(item);
  const pendientes = recorrido
    .map((id) => state.items.find((entrada) => entrada.id === id))
    .filter((entrada) => entrada && calculate(entrada).isPending).length;

  posicion.textContent = [
    `${indice + 1} de ${recorrido.length}`,
    pendientes ? `${pendientes} sin puntuar` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  resultado.innerHTML = metricas.isPending
    ? `<span class="modo-taller-sin-puntuar">Sin puntuar</span>`
    : `
      <span>Score medio <strong>${escapeHtml(formatMedia(metricas.scoreMedio))}</strong></span>
      <span>Gap <strong>${escapeHtml(formatMedia(metricas.gap))}</strong></span>
      <span>Prioridad ${priorityBadge(metricas.prioridad)}</span>
    `;
}


/**
 * Escape sale. AvPag y RePag pasan de una a otra desde cualquier sitio: son
 * las teclas que mandan los mandos de presentacion. Las flechas tambien, salvo
 * dentro de una palanca, donde ya cambian el score, o escribiendo una nota.
 */
function alPulsarTecla(event) {
  if (!abierto() || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  // Un modal abierto por encima, como el dialogo de confirmacion, manda el.
  const encima = [...document.querySelectorAll(SELECTOR_DE_MODAL_ABIERTO)].some((modal) => modal !== panel);

  if (encima) {
    return;
  }

  const escribiendo = event.target.closest?.("textarea, input:not(.score-radio)");
  const enPalanca = event.target.classList?.contains("score-radio");

  if (event.key === "Escape") {
    event.preventDefault();
    cerrarModoTaller();
  } else if (event.key === "PageDown" && !escribiendo) {
    event.preventDefault();
    irA(indice + 1);
  } else if (event.key === "PageUp" && !escribiendo) {
    event.preventDefault();
    irA(indice - 1);
  } else if (event.key === "ArrowRight" && !escribiendo && !enPalanca) {
    event.preventDefault();
    irA(indice + 1);
  } else if (event.key === "ArrowLeft" && !escribiendo && !enPalanca) {
    event.preventDefault();
    irA(indice - 1);
  } else if (event.key === "Tab") {
    atraparFoco(event, panel);
  }
}
