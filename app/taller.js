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

import { getMaturityLevel } from "../core/calculo.js?v=28";
import { LIMITES_DE_TEXTO } from "../core/escenario.js?v=28";
import { escapeAttr, escapeHtml, formatMedia } from "../core/presentacion.js?v=28";
import { SELECTOR_DE_MODAL_ABIERTO, atraparFoco, showNotice, updateModalOpenState } from "./avisos.js?v=28";
import { nombreDeMasInformacion } from "./biblioteca.js?v=28";
import { priorityBadge } from "./celdas.js?v=28";
import { htmlDelCierre } from "./cierre.js?v=28";
import { avanceDeDominio, switchDomain } from "./dominios.js?v=28";
import {
  actualizarContadorDeComentario,
  guardarCampoAhora,
  programarGuardado,
} from "./edicion.js?v=28";
import { DOMAINS, GRUPOS_DE_DOMINIO, LEVERS, state } from "./estado.js?v=28";
import { getVisibleItems } from "./filtros.js?v=28";
import { copiarTextoDelCorreo, datosDelActa, exportarActa } from "./informe.js?v=28";
import { calculate, getCapabilityTargets } from "./metricas.js?v=28";
import { repintarTodo } from "./repintado.js?v=28";
import { getAiDataForItem, getItemObjective, getItemQuestions } from "./subcapacidad.js?v=28";
import {
  conectarPuntuacion,
  enfocarPalanca,
  idDeLaTarjetaEnCurso,
  llevarALasTarjetas,
  scoreControl,
} from "./vistas/assessment.js?v=28";


let panel = null;
let cuerpo = null;
let donde = null;
let posicion = null;
let resultado = null;
let anterior = null;
let siguiente = null;
let selectorDeDominio = null;
let botonDelEquipo = null;
let menuDelEquipo = null;

// Las subcapacidades del recorrido, fijadas al abrir. Si se recalculara en cada
// paso, con un filtro de prioridad puesto, puntuar una podria sacarla de la
// lista y «Siguiente» se saltaria la que venia detras.
let recorrido = [];
let indice = 0;
let disparador = null;

// Mientras se cambia de dominio desde aqui, el repintado que lo acompaña no
// encuentra la subcapacidad de antes y cerraria el modo taller.
let cambiandoDeDominio = false;

// Las puntuaciones de cada subcapacidad cuando entro en el recorrido, para que
// el cierre diga cuantas se han puntuado en esta sesion. Por dominio e id: los
// ids salen del prefijo «1.1» y se repiten de un dominio a otro.
const puntuacionesAlEmpezar = new Map();


const abierto = () => Boolean(panel) && !panel.hidden;

const itemActual = () => state.items.find((item) => item.id === recorrido[indice]) || null;

// Despues de la ultima subcapacidad viene el cierre del taller: indice === recorrido.length.
const enCierre = () => recorrido.length > 0 && indice === recorrido.length;

const itemsDelRecorrido = () =>
  recorrido.map((id) => state.items.find((item) => item.id === id)).filter(Boolean);

const huellaDePuntuacion = (item) => JSON.stringify(LEVERS.map((lever) => item.scores[lever.key] ?? null));

const nombreDelNivel = (nivel) => (getMaturityLevel(nivel) || "").split(" - ")[1] || "";


/**
 * `irAlAssessment` lo pone app.js: el boton esta en el menu «Presentacion», que se ve
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
  selectorDeDominio = document.getElementById("modoTallerDominio");
  botonDelEquipo = document.getElementById("modoTallerEquipoBoton");
  menuDelEquipo = document.getElementById("modoTallerEquipo");

  const boton = document.getElementById("modoTallerButton");

  if (!panel || !cuerpo || !boton) {
    boton?.setAttribute("hidden", "");
    return;
  }

  // Al salir, el foco va a la tarjeta. Si no la hubiera, al boton del menu y
  // no a la entrada, que se queda escondida con el menu cerrado.
  const menu = document.getElementById("presentacionMenuButton") || boton;

  boton.addEventListener("click", () => {
    irAlAssessment();
    abrirModoTaller(menu);
  });
  document.getElementById("modoTallerSalir")?.addEventListener("click", () => cerrarModoTaller());
  anterior?.addEventListener("click", () => irA(indice - 1));
  siguiente?.addEventListener("click", () => irA(indice + 1));
  cuerpo.addEventListener("click", alPulsarEnElCierre);
  setupMenuDelEquipo();
  selectorDeDominio?.addEventListener("change", () => cambiarDeDominio(selectorDeDominio.value));

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
  puntuacionesAlEmpezar.clear();
  anotarPuntuacionesAlEmpezar();

  panel.hidden = false;
  updateModalOpenState();
  pintar();
  apartarElChipDelPie(true);
}


/**
 * El chip de guardado sale abajo a la derecha, justo encima de «Siguiente», y
 * sale cada vez que se puntua: es decir, en el momento exacto en que se va a
 * pulsar «Siguiente». Durante sus cuatro segundos, el clic se lo llevaba el
 * chip. Con el modo taller abierto sube por encima del pie, sobre la esquina
 * de las columnas de abajo, que es la parte con menos texto de la pantalla.
 */
function apartarElChipDelPie(abierto) {
  const pie = panel.querySelector(".modo-taller-pie");

  document.documentElement.classList.toggle("en-modo-taller", abierto);
  document.documentElement.style.setProperty("--pie-del-taller", `${abierto && pie ? pie.offsetHeight : 0}px`);
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

  // Desde el cierre, se vuelve a la ultima subcapacidad del recorrido.
  const ultimo = recorrido[Math.min(indice, recorrido.length - 1)];

  abrirMenuDelEquipo(false);
  panel.hidden = true;
  cuerpo.innerHTML = "";
  updateModalOpenState();
  apartarElChipDelPie(false);

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
  if (!abierto() || cambiandoDeDominio) {
    return;
  }

  // Con un cambio de otra persona del escenario compartido, el cierre se
  // repinta entero: no tiene nada que se este escribiendo.
  if (enCierre()) {
    pintarCierre({ enfocar: false });
    pintarAvanceDeDominios();
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
  pintarAvanceDeDominios();
}


/**
 * Cambia el dominio de toda la herramienta, no solo el del taller: al salir,
 * el Assessment esta en el dominio en el que se termino. Como al pulsar el
 * conmutador, los filtros del dominio anterior se quitan —el de capacidad ni
 * existe en el nuevo—, asi que el recorrido son todas sus subcapacidades.
 *
 * Empieza por la primera y no por «la ultima tocada», que es de otro dominio.
 * El foco se queda en el selector: con las flechas del teclado, un <select>
 * cerrado cambia de opcion a cada pulsacion, y quitarle el foco al primer
 * cambio dejaba a quien recorre la lista en el dominio de al lado.
 */
async function cambiarDeDominio(domainId) {
  if (!abierto() || !domainId || domainId === state.activeDomainId) {
    return;
  }

  const notas = cuerpo.querySelector(".modo-taller-notas");
  const item = itemActual();

  if (notas && item) {
    guardarCampoAhora(item, "comentario", notas);
  }

  cambiandoDeDominio = true;

  try {
    await switchDomain(domainId);
  } catch (error) {
    console.error(error);
    showNotice("No se ha podido abrir ese dominio. Sigues en el que estabas.", "error");
  } finally {
    cambiandoDeDominio = false;
  }

  // Si el cambio fallo, se sigue en la misma subcapacidad; si no, no esta en
  // el dominio nuevo y se empieza por la primera.
  const antes = recorrido[indice];

  recorrido = getVisibleItems().map((entrada) => entrada.id);
  indice = Math.max(0, recorrido.indexOf(antes));
  anotarPuntuacionesAlEmpezar();

  if (!recorrido.length) {
    cerrarModoTaller({ volver: false });
    repintarTodo();
    showNotice("Este dominio no tiene subcapacidades cargadas: no hay nada que enseñar en el modo taller.", "aviso");
    return;
  }

  pintar({ enfocar: false });
}


/** La huella de las que aun no estaban, sin pisar las que ya estaban: volver a un dominio no reinicia su cuenta. */
function anotarPuntuacionesAlEmpezar() {
  recorrido.forEach((id) => {
    const clave = `${state.activeDomainId}:${id}`;
    const item = state.items.find((entrada) => entrada.id === id);

    if (item && !puntuacionesAlEmpezar.has(clave)) {
      puntuacionesAlEmpezar.set(clave, huellaDePuntuacion(item));
    }
  });
}


function cambiadasEnEstaSesion() {
  return itemsDelRecorrido().filter(
    (item) => puntuacionesAlEmpezar.get(`${state.activeDomainId}:${item.id}`) !== huellaDePuntuacion(item),
  ).length;
}


// Hasta recorrido.length, que es el cierre.
function irA(nuevo) {
  if (nuevo < 0 || nuevo > recorrido.length || nuevo === indice) {
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


function pintar({ enfocar = true } = {}) {
  if (enCierre()) {
    pintarCierre({ enfocar });
    return;
  }

  const item = itemActual();

  if (!item) {
    cerrarModoTaller({ volver: false });
    return;
  }

  const objetivos = getCapabilityTargets(item.capacidad);
  const casos = getAiDataForItem(item)?.casos || [];

  donde.textContent = state.cliente || "";
  pintarSelectorDeDominio();

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
  anterior.innerHTML = `<span aria-hidden="true">←</span> Anterior`;
  siguiente.hidden = false;

  // Despues de la ultima no se acaba el recorrido: viene el cierre.
  siguiente.innerHTML = indice === recorrido.length - 1
    ? `Cierre del taller <span aria-hidden="true">→</span>`
    : `Siguiente <span aria-hidden="true">→</span>`;

  // Con el foco en la primera palanca, las teclas 1 a 5 ya puntuan.
  if (enfocar) {
    enfocarPalanca(cuerpo.querySelector(".score-segmentos"), { preventScroll: true });
  }
}


/**
 * La ultima pantalla: lo que ha salido de la sesion, con las mismas cifras que
 * el acta. Ver app/cierre.js. En el pie, «Anterior» vuelve a las
 * subcapacidades. El acta y el correo no estan aqui sino en «Para el equipo»,
 * en la barra de arriba: se proyecta para el cliente y son de uso interno.
 */
function pintarCierre({ enfocar = true } = {}) {
  const datos = datosDelActa(itemsDelRecorrido());

  donde.textContent = state.cliente || "";
  pintarSelectorDeDominio();

  cuerpo.innerHTML = htmlDelCierre(datos, { cambiadasHoy: cambiadasEnEstaSesion() });
  resultado.innerHTML = "";

  posicion.textContent = "Cierre del taller";
  anterior.disabled = false;
  anterior.innerHTML = `<span aria-hidden="true">←</span> Volver a las subcapacidades`;
  siguiente.hidden = true;

  // Al titulo y no a un boton: lo primero que se oye es de que va la pantalla,
  // y con el raton no se ve ningun anillo de foco.
  if (enfocar) {
    cuerpo.querySelector("#modoTallerTitulo")?.focus({ preventScroll: true });
  }
}


function alPulsarEnElCierre(event) {
  if (!enCierre()) {
    return;
  }

  const ir = event.target.closest("[data-ir]");
  const destino = ir ? recorrido.indexOf(ir.dataset.ir) : -1;

  if (destino >= 0) {
    irA(destino);
  }
}


/**
 * «Para el equipo», en la barra: el acta y el correo. Estaban en el pie del
 * cierre, como los dos botones mas llamativos de la pantalla que se proyecta,
 * y son de uso interno. Aqui se ven solo si se buscan, y sirven desde
 * cualquier subcapacidad, no solo al terminar.
 *
 * No usa el menu de la cabecera de app.js: Escape tiene que cerrar el menu y
 * no el modo taller, y eso lo decide alPulsarTecla().
 */
function setupMenuDelEquipo() {
  if (!botonDelEquipo || !menuDelEquipo) {
    return;
  }

  botonDelEquipo.addEventListener("click", (event) => {
    event.stopPropagation();
    abrirMenuDelEquipo(menuDelEquipo.hidden);
  });

  menuDelEquipo.addEventListener("click", (event) => {
    const accion = event.target.closest("[data-equipo]:not(:disabled)")?.dataset.equipo;

    if (!accion) {
      return;
    }

    abrirMenuDelEquipo(false);

    // El mismo recorrido que la pantalla, y no los filtros de ahora: el acta y
    // el correo tienen que decir lo que se acaba de proyectar.
    if (accion === "acta") {
      exportarActa({ items: itemsDelRecorrido() });
    } else if (accion === "correo") {
      copiarTextoDelCorreo({ items: itemsDelRecorrido() });
    }
  });

  document.addEventListener("click", (event) => {
    if (!menuDelEquipo.hidden && !menuDelEquipo.parentElement.contains(event.target)) {
      abrirMenuDelEquipo(false);
    }
  });
}


function abrirMenuDelEquipo(abrir) {
  if (!botonDelEquipo || !menuDelEquipo) {
    return;
  }

  // Lo que dice se decide al abrirlo: sin nada puntuado en el recorrido no hay
  // acta que pedir, igual que en el menu del PDF.
  if (abrir) {
    const hayPuntuadas = itemsDelRecorrido().some((item) => !calculate(item).isPending);

    menuDelEquipo.querySelectorAll("[data-equipo]").forEach((opcion) => {
      opcion.disabled = !hayPuntuadas;
    });
    menuDelEquipo.querySelectorAll("[data-equipo-nota]").forEach((nota, posicionDeLaNota) => {
      nota.textContent = hayPuntuadas
        ? NOTAS_DEL_EQUIPO[posicionDeLaNota]
        : "Todavía no hay nada puntuado en este recorrido";
    });
  }

  menuDelEquipo.hidden = !abrir;
  botonDelEquipo.setAttribute("aria-expanded", String(abrir));
}


const NOTAS_DEL_EQUIPO = [
  "Lo puntuado en este recorrido y sus notas, para enviar al cliente",
  "El resumen del acta, listo para pegar en el correo",
];


/**
 * Los nueve dominios, agrupados como en el conmutador y con su avance, que es
 * la pregunta de quien decide a cual pasar: cual queda por hacer. Los que no
 * se pudieron cargar salen, pero apagados.
 */
function pintarSelectorDeDominio() {
  if (!selectorDeDominio) {
    return;
  }

  const dominios = Object.values(DOMAINS);
  const grupos = GRUPOS_DE_DOMINIO.length ? GRUPOS_DE_DOMINIO : [...new Set(dominios.map((dominio) => dominio.group))];

  selectorDeDominio.innerHTML = grupos
    .map((grupo) => {
      const opciones = dominios
        .filter((dominio) => dominio.group === grupo)
        .map(
          (dominio) => `
            <option
              value="${escapeAttr(dominio.id)}"
              ${dominio.id === state.activeDomainId ? "selected" : ""}
              ${state.domains[dominio.id] ? "" : "disabled"}
            >${escapeHtml(textoDeDominio(dominio))}</option>
          `,
        )
        .join("");

      return opciones ? `<optgroup label="${escapeAttr(grupo)}">${opciones}</optgroup>` : "";
    })
    .join("");
}


/**
 * Al puntuar cambia el avance del dominio abierto. Se reescribe el texto de
 * cada opcion en su sitio: reconstruir la lista con ella desplegada la cerraria.
 */
function pintarAvanceDeDominios() {
  selectorDeDominio?.querySelectorAll("option").forEach((opcion) => {
    const dominio = DOMAINS[opcion.value];
    const texto = dominio ? textoDeDominio(dominio) : opcion.textContent;

    if (opcion.textContent !== texto) {
      opcion.textContent = texto;
    }
  });
}


function textoDeDominio(dominio) {
  if (!state.domains[dominio.id]) {
    return `${dominio.label} · no disponible`;
  }

  const { puntuadas, total } = avanceDeDominio(dominio.id);

  return `${dominio.label} · ${puntuadas}/${total}`;
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

  // Un <select> tambien: con el foco en el de dominio, las flechas cambian de dominio.
  const escribiendo = event.target.closest?.("textarea, select, input:not(.score-radio)");
  const enPalanca = event.target.classList?.contains("score-radio");

  if (event.key === "Escape" && menuDelEquipo && !menuDelEquipo.hidden) {
    // Con el menu del equipo abierto, Escape cierra el menu y no el modo taller.
    event.preventDefault();
    abrirMenuDelEquipo(false);
    botonDelEquipo.focus();
  } else if (event.key === "Escape") {
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
