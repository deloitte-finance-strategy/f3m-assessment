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

import { getMaturityLevel } from "../core/calculo.js?v=29";
import { LIMITES_DE_TEXTO } from "../core/escenario.js?v=29";
import { escapeAttr, escapeHtml, formatMedia } from "../core/presentacion.js?v=29";
import { SELECTOR_DE_MODAL_ABIERTO, atraparFoco, showNotice, updateModalOpenState } from "./avisos.js?v=29";
import { nombreDeMasInformacion } from "./biblioteca.js?v=29";
import { priorityBadge } from "./celdas.js?v=29";
import { htmlDeLaApertura } from "./apertura.js?v=29";
import { htmlDelCierre, revelarElCierre } from "./cierre.js?v=29";
import { sinMovimiento } from "./movimiento.js?v=29";
import {
  conectarLosPasos,
  guardarLosPasosPendientes,
  htmlDeLosPasos,
  pasosDelDominio,
  seEstaEscribiendoUnPaso,
} from "./proximos-pasos.js?v=29";
import { avanceDeDominio, getActiveDomainConfig, switchDomain } from "./dominios.js?v=29";
import {
  actualizarContadorDeComentario,
  guardarCampoAhora,
  programarGuardado,
} from "./edicion.js?v=29";
import { DOMAINS, GRUPOS_DE_DOMINIO, LEVERS, state } from "./estado.js?v=29";
import { capacidadesDePreparacion } from "../informe/preparacion.js?v=29";
import { getVisibleItems } from "./filtros.js?v=29";
import { copiarTextoDelCorreo, datosDelActa, exportarActa } from "./informe.js?v=29";
import { calculate, getCapabilityTargets } from "./metricas.js?v=29";
import { repintarTodo } from "./repintado.js?v=29";
import { getAiDataForItem, getItemObjective, getItemQuestions } from "./subcapacidad.js?v=29";
import {
  conectarPuntuacion,
  enfocarPalanca,
  idDeLaTarjetaEnCurso,
  llevarALasTarjetas,
  scoreControl,
} from "./vistas/assessment.js?v=29";


let panel = null;
let cuerpo = null;
let donde = null;
let posicion = null;
let resultado = null;
let anterior = null;
let siguiente = null;
let selectorDeDominio = null;
let menuDelEquipo = null;
let menuDelIndice = null;

// Antes de la primera subcapacidad va la apertura, y despues de la ultima, el
// cierre y los proximos pasos: el indice va de APERTURA a recorrido.length + 1.
const APERTURA = -1;

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

const enApertura = () => indice === APERTURA;

// Y despues del cierre, los proximos pasos acordados.
const enPasos = () => recorrido.length > 0 && indice === recorrido.length + 1;

const ultimaPosicion = () => recorrido.length + 1;

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
  posicion = document.getElementById("modoTallerPosicionTexto");
  resultado = document.getElementById("modoTallerResultado");
  anterior = document.getElementById("modoTallerAnterior");
  siguiente = document.getElementById("modoTallerSiguiente");
  selectorDeDominio = document.getElementById("modoTallerDominio");

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
  cuerpo.addEventListener("click", alPulsarEnElCuerpo);
  cuerpo.addEventListener("animationend", (event) => {
    if (event.target === cuerpo) {
      cuerpo.classList.remove(...CLASES_DE_ENTRADA);
    }
  });
  setupMenusDeLaBarra();
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

  // Se empieza por la apertura salvo que se viniera de una tarjeta mas alla
  // de la primera: entonces la sesion ya estaba en marcha.
  const enCurso = recorrido.indexOf(idDeLaTarjetaEnCurso());

  indice = enCurso > 0 ? enCurso : APERTURA;
  disparador = desde;
  puntuacionesAlEmpezar.clear();
  anotarPuntuacionesAlEmpezar();

  panel.hidden = false;
  updateModalOpenState();
  pintar();
  animarLaEntrada(0);
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

  // Lo que quedaba por guardar se guarda ya, y la lista se repinta para que
  // la tarjeta enseñe lo escrito aqui.
  guardarLoQueQueda();

  // Desde el cierre y los pasos se vuelve a la ultima subcapacidad, y desde
  // la apertura, a la primera.
  const ultimo = recorrido[Math.min(Math.max(indice, 0), recorrido.length - 1)];

  cerrarMenusDeLaBarra();
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

  // Con un cambio de otra persona del escenario compartido, la apertura y el
  // cierre se repintan enteros: no tienen nada que se este escribiendo. Los
  // pasos si, y mientras se escriben manda la pantalla.
  if (enApertura() || enCierre() || enPasos()) {
    if (!enPasos() || !seEstaEscribiendoUnPaso()) {
      pintar({ enfocar: false });
    }

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

  pintarMarcas(item, { animar: true });
  pintarResultado(item, { animar: true });
  pintarAvanceDeDominios();
}


/**
 * Cambia el dominio de toda la herramienta, no solo el del taller: al salir,
 * el Assessment esta en el dominio en el que se termino. Como al pulsar el
 * conmutador, los filtros del dominio anterior se quitan —el de capacidad ni
 * existe en el nuevo—, asi que el recorrido son todas sus subcapacidades.
 *
 * Empieza por la apertura del dominio nuevo y no por «la ultima tocada», que
 * es de otro dominio: es otro taller, con otras capacidades.
 * El foco se queda en el selector: con las flechas del teclado, un <select>
 * cerrado cambia de opcion a cada pulsacion, y quitarle el foco al primer
 * cambio dejaba a quien recorre la lista en el dominio de al lado.
 */
async function cambiarDeDominio(domainId) {
  if (!abierto() || !domainId || domainId === state.activeDomainId) {
    return;
  }

  guardarLoQueQueda();

  cambiandoDeDominio = true;
  cerrarMenusDeLaBarra();

  let cambiado = false;

  try {
    await switchDomain(domainId);
    cambiado = true;
  } catch (error) {
    console.error(error);
    showNotice("No se ha podido abrir ese dominio. Sigues en el que estabas.", "error");
  } finally {
    cambiandoDeDominio = false;
  }

  // Si el cambio fallo, se sigue donde se estaba.
  if (cambiado) {
    recorrido = getVisibleItems().map((entrada) => entrada.id);
    indice = APERTURA;
    anotarPuntuacionesAlEmpezar();
  }

  if (!recorrido.length) {
    cerrarModoTaller({ volver: false });
    repintarTodo();
    showNotice("Este dominio no tiene subcapacidades cargadas: no hay nada que enseñar en el modo taller.", "aviso");
    return;
  }

  pintar({ enfocar: false });
  animarLaEntrada(0);
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


// De la apertura a los proximos pasos, que van detras del cierre.
function irA(nuevo) {
  if (nuevo < APERTURA || nuevo > ultimaPosicion() || nuevo === indice) {
    return;
  }

  guardarLoQueQueda();

  const sentido = Math.sign(nuevo - indice);

  indice = nuevo;
  pintar();
  animarLaEntrada(sentido);
}


const CLASES_DE_ENTRADA = ["entra-adelante", "entra-atras", "entra"];


/**
 * Un fundido corto al cambiar de pantalla, que llega del lado hacia el que se
 * va: hacia delante entra por la derecha, hacia atras por la izquierda, y al
 * abrir o al cambiar de dominio solo funde. Sin el, «Siguiente» cambiaba la
 * pantalla de golpe y, proyectado, se leia como una web y no como una
 * presentacion.
 *
 * Corto a proposito, 220 ms: el foco ya esta en la primera palanca y se puede
 * puntuar mientras entra, sin esperar a que termine.
 */
function animarLaEntrada(sentido) {
  cuerpo.classList.remove(...CLASES_DE_ENTRADA);

  if (sinMovimiento()) {
    return;
  }

  // Leer el ancho obliga al navegador a aplicar la retirada antes de volver a
  // poner la clase; sin esto, dos «Siguiente» seguidos no se animaban.
  void cuerpo.offsetWidth;
  cuerpo.classList.add(sentido > 0 ? "entra-adelante" : sentido < 0 ? "entra-atras" : "entra");

  if (enCierre()) {
    revelarElCierre(cuerpo);
  }
}


/** Las notas de la subcapacidad o los pasos a medio escribir, antes de dejar la pantalla. */
function guardarLoQueQueda() {
  const notas = cuerpo.querySelector(".modo-taller-notas");
  const item = itemActual();

  if (notas && item) {
    guardarCampoAhora(item, "comentario", notas);
  }

  if (enPasos()) {
    guardarLosPasosPendientes();
  }
}


function pintar({ enfocar = true } = {}) {
  pintarIndiceSiEstaAbierto();

  if (enApertura()) {
    pintarApertura({ enfocar });
    return;
  }

  if (enCierre()) {
    pintarCierre({ enfocar });
    return;
  }

  if (enPasos()) {
    pintarPasos({ enfocar });
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

  anterior.hidden = false;
  anterior.disabled = false;
  anterior.innerHTML = indice === 0
    ? `<span aria-hidden="true">←</span> Apertura`
    : `<span aria-hidden="true">←</span> Anterior`;
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
 * La primera pantalla: que se va a ver, como se puntua y contra que objetivo.
 * Ver app/apertura.js. «Empezar» lleva a la primera subcapacidad.
 */
function pintarApertura({ enfocar = true } = {}) {
  const items = itemsDelRecorrido();

  donde.textContent = state.cliente || "";
  pintarSelectorDeDominio();

  cuerpo.innerHTML = htmlDeLaApertura({
    cliente: state.cliente,
    dominio: getActiveDomainConfig()?.label || "",
    logo: state.logo,
    items: items.map((item) => ({ ...item, puntuada: !calculate(item).isPending })),
    objetivos: objetivosMedios(items),
    palancas: LEVERS,
  });
  resultado.innerHTML = "";

  posicion.textContent = "Apertura";
  anterior.hidden = true;
  siguiente.hidden = false;
  siguiente.innerHTML = `Empezar <span aria-hidden="true">→</span>`;

  if (enfocar) {
    cuerpo.querySelector("#modoTallerTitulo")?.focus({ preventScroll: true });
  }
}


/**
 * La media por palanca de los objetivos de las capacidades del recorrido. Con
 * los de por defecto es un 4 redondo; con objetivos por capacidad, lo que la
 * apertura dice tiene que salir de lo que se va a puntuar.
 */
function objetivosMedios(items) {
  return Object.fromEntries(
    LEVERS.map((lever) => {
      const valores = items
        .map((item) => Number(getCapabilityTargets(item.capacidad)[lever.key]))
        .filter(Number.isFinite);
      const media = valores.length ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length : NaN;

      return [lever.key, Math.round(media * 100) / 100];
    }),
  );
}


/**
 * Lo que ha salido de la sesion, con las mismas cifras que el acta. Ver
 * app/cierre.js. En el pie, «Anterior» vuelve a las subcapacidades y
 * «Siguiente» lleva a los proximos pasos. El acta y el correo no estan aqui
 * sino en «Para el equipo», en la barra de arriba: se proyecta para el cliente
 * y son de uso interno.
 */
function pintarCierre({ enfocar = true } = {}) {
  const datos = datosDelActa(itemsDelRecorrido());

  donde.textContent = state.cliente || "";
  pintarSelectorDeDominio();

  cuerpo.innerHTML = htmlDelCierre(datos, { cambiadasHoy: cambiadasEnEstaSesion() });
  resultado.innerHTML = "";

  posicion.textContent = "Cierre del taller";
  anterior.hidden = false;
  anterior.disabled = false;
  anterior.innerHTML = `<span aria-hidden="true">←</span> Volver a las subcapacidades`;
  siguiente.hidden = false;
  siguiente.innerHTML = `Próximos pasos <span aria-hidden="true">→</span>`;

  // Al titulo y no a un boton: lo primero que se oye es de que va la pantalla,
  // y con el raton no se ve ningun anillo de foco.
  if (enfocar) {
    cuerpo.querySelector("#modoTallerTitulo")?.focus({ preventScroll: true });
  }
}


/**
 * La ultima pantalla: los proximos pasos acordados, que salen en el acta y en
 * el correo. Ver app/proximos-pasos.js.
 */
function pintarPasos({ enfocar = true } = {}) {
  const domainId = state.activeDomainId;

  donde.textContent = state.cliente || "";
  pintarSelectorDeDominio();

  cuerpo.innerHTML = htmlDeLosPasos({
    pasos: pasosDelDominio(domainId),
    dominio: getActiveDomainConfig()?.label || "",
  });
  conectarLosPasos(cuerpo, domainId);
  resultado.innerHTML = "";

  posicion.textContent = "Próximos pasos";
  anterior.hidden = false;
  anterior.disabled = false;
  anterior.innerHTML = `<span aria-hidden="true">←</span> Cierre del taller`;
  siguiente.hidden = true;

  // Al titulo, como en el cierre, y no al primer campo: con el cursor en un
  // campo, Re Pág no vuelve atrás, y es la tecla del mando de presentación.
  if (enfocar) {
    cuerpo.querySelector("#modoTallerTitulo")?.focus({ preventScroll: true });
  }
}


/** En la apertura y en el cierre, cada capacidad, brecha o pendiente lleva a su subcapacidad. */
function alPulsarEnElCuerpo(event) {
  if (!enApertura() && !enCierre()) {
    return;
  }

  const ir = event.target.closest("[data-ir]");
  const destino = ir ? recorrido.indexOf(ir.dataset.ir) : -1;

  if (destino >= 0) {
    irA(destino);
  }
}


/**
 * Los dos menus de la barra: el indice («3 de 20») y «Para el equipo».
 *
 * No usan el menu de la cabecera de app.js: con uno abierto, Escape tiene que
 * cerrarlo a el y no al modo taller, y las flechas tienen que moverse por sus
 * opciones y no pasar de subcapacidad por detras. Eso lo decide alPulsarTecla().
 */
const menusDeLaBarra = [];


function crearMenuDeLaBarra(boton, menu, { alAbrir = () => {}, trasAbrir = () => {} } = {}) {
  if (!boton || !menu) {
    return null;
  }

  const control = {
    boton,
    menu,
    abierto: () => !menu.hidden,
    abrir(abrir) {
      if (abrir) {
        menusDeLaBarra.filter((otro) => otro !== control).forEach((otro) => otro.abrir(false));
        alAbrir();
      }

      menu.hidden = !abrir;
      boton.setAttribute("aria-expanded", String(abrir));

      if (abrir) {
        trasAbrir();
      }
    },
  };

  boton.addEventListener("click", (event) => {
    event.stopPropagation();
    control.abrir(menu.hidden);
  });

  menusDeLaBarra.push(control);
  return control;
}


const menuAbierto = () => menusDeLaBarra.find((menu) => menu.abierto()) || null;

function cerrarMenusDeLaBarra() {
  menusDeLaBarra.forEach((menu) => menu.abrir(false));
}


function setupMenusDeLaBarra() {
  menuDelIndice = crearMenuDeLaBarra(
    document.getElementById("modoTallerPosicion"),
    document.getElementById("modoTallerIndice"),
    { alAbrir: pintarIndice, trasAbrir: enfocarLaActualDelIndice },
  );

  menuDelEquipo = crearMenuDeLaBarra(
    document.getElementById("modoTallerEquipoBoton"),
    document.getElementById("modoTallerEquipo"),
    { alAbrir: pintarMenuDelEquipo },
  );

  menuDelIndice?.menu.addEventListener("click", (event) => {
    const destino = event.target.closest("[data-posicion]");

    if (destino) {
      menuDelIndice.abrir(false);
      irA(Number(destino.dataset.posicion));
    }
  });

  menuDelEquipo?.menu.addEventListener("click", (event) => {
    const accion = event.target.closest("[data-equipo]:not(:disabled)")?.dataset.equipo;

    if (!accion) {
      return;
    }

    menuDelEquipo.abrir(false);

    // El mismo recorrido que la pantalla, y no los filtros de ahora: el acta y
    // el correo tienen que decir lo que se acaba de proyectar.
    if (accion === "acta") {
      exportarActa({ items: itemsDelRecorrido() });
    } else if (accion === "correo") {
      copiarTextoDelCorreo({ items: itemsDelRecorrido() });
    }
  });

  document.addEventListener("click", (event) => {
    menusDeLaBarra
      .filter((menu) => menu.abierto() && !menu.menu.parentElement.contains(event.target))
      .forEach((menu) => menu.abrir(false));
  });
}


/**
 * El indice del recorrido, agrupado por capacidad y con un punto en las ya
 * puntuadas: lo que hace falta para decidir a donde saltar. Con la apertura
 * arriba y el cierre abajo, que tambien son paradas del recorrido.
 */
function pintarIndice() {
  if (!menuDelIndice) {
    return;
  }

  const items = recorrido
    .map((id, posicionEnElRecorrido) => {
      const item = state.items.find((entrada) => entrada.id === id);

      return item ? { ...item, posicionEnElRecorrido, puntuada: !calculate(item).isPending } : null;
    })
    .filter(Boolean);
  const puntuadas = items.filter((item) => item.puntuada).length;

  const parada = (posicionEnElRecorrido, texto) => `
    <button
      class="modo-taller-indice-item modo-taller-indice-parada"
      type="button"
      data-posicion="${posicionEnElRecorrido}"
      ${posicionEnElRecorrido === indice ? `aria-current="step"` : ""}
    >${escapeHtml(texto)}</button>
  `;

  menuDelIndice.menu.innerHTML = `
    <p class="header-menu-title">Recorrido del taller</p>
    ${parada(APERTURA, "Apertura del taller")}
    ${capacidadesDePreparacion(items)
      .map(
        (capacidad) => `
          <p class="modo-taller-indice-capacidad">${escapeHtml(capacidad.numero)} · ${escapeHtml(capacidad.nombre)}</p>
          ${capacidad.subcapacidades
            .map(
              (item) => `
                <button
                  class="modo-taller-indice-item"
                  type="button"
                  data-posicion="${item.posicionEnElRecorrido}"
                  ${item.posicionEnElRecorrido === indice ? `aria-current="step"` : ""}
                >
                  <i class="${item.puntuada ? "puntuada" : ""}" aria-hidden="true"></i>
                  <span>${escapeHtml(item.subcapacidad)}</span>
                  <span class="solo-lectores">${item.puntuada ? ", puntuada" : ", sin puntuar"}</span>
                </button>
              `,
            )
            .join("")}
        `,
      )
      .join("")}
    ${parada(recorrido.length, "Cierre del taller")}
    ${parada(ultimaPosicion(), textoDeLosPasos())}
    <p class="modo-taller-indice-pie">${puntuadas} de ${items.length} puntuadas</p>
  `;
}


/** Con cuantos hay apuntados: desde el indice se ve si ya se han acordado. */
function textoDeLosPasos() {
  const cuantos = pasosDelDominio(state.activeDomainId).length;

  return cuantos ? `Próximos pasos · ${cuantos}` : "Próximos pasos";
}


/** Si el indice esta abierto al cambiar de pantalla, que marque la nueva. */
function pintarIndiceSiEstaAbierto() {
  if (menuDelIndice?.abierto()) {
    pintarIndice();
  }
}


/** Con el indice abierto, el foco va a donde se esta, y las flechas siguen desde ahi. */
function enfocarLaActualDelIndice() {
  const actual = menuDelIndice?.menu.querySelector("[aria-current]") || menuDelIndice?.menu.querySelector("button");

  actual?.focus({ preventScroll: true });
  actual?.scrollIntoView({ block: "center" });
}


/** Las flechas arriba y abajo, de opcion en opcion, sin salirse del menu. */
function moverseEnElMenu(menu, paso) {
  const opciones = [...menu.querySelectorAll("button:not(:disabled)")];
  const actual = opciones.indexOf(document.activeElement);
  const siguienteOpcion = opciones[Math.min(opciones.length - 1, Math.max(0, actual + paso))];

  siguienteOpcion?.focus();
}


/**
 * Lo que dice «Para el equipo» se decide al abrirlo: sin nada puntuado en el
 * recorrido no hay acta que pedir, igual que en el menu del PDF.
 */
function pintarMenuDelEquipo() {
  const hayPuntuadas = itemsDelRecorrido().some((item) => !calculate(item).isPending);

  menuDelEquipo.menu.querySelectorAll("[data-equipo]").forEach((opcion) => {
    opcion.disabled = !hayPuntuadas;
  });
  menuDelEquipo.menu.querySelectorAll("[data-equipo-nota]").forEach((nota, posicionDeLaNota) => {
    nota.textContent = hayPuntuadas
      ? NOTAS_DEL_EQUIPO[posicionDeLaNota]
      : "Todavía no hay nada puntuado en este recorrido";
  });
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
function pintarMarcas(item, { animar = false } = {}) {
  const objetivos = getCapabilityTargets(item.capacidad);
  const objetivosIguales = new Set(LEVERS.map((lever) => Math.round(objetivos[lever.key]))).size === 1;

  // Las que ya estaban no se mueven: solo la palanca que acaba de llegar a su
  // nivel entra con un salto corto, que es donde se mira al puntuar.
  const antes = new Set([...cuerpo.querySelectorAll(".modo-taller-marca[data-marca]")].map((marca) => marca.dataset.marca));

  cuerpo.querySelectorAll(".modo-taller-marcas").forEach((contenedor) => {
    const nivel = Number(contenedor.dataset.nivel);
    const aqui = LEVERS.filter((lever) => item.scores[lever.key] === nivel);
    const objetivoAqui = LEVERS.filter((lever) => Math.round(objetivos[lever.key]) === nivel);

    const marcas = aqui.map(
      (lever) => `
        <span class="modo-taller-marca" data-marca="${lever.key}:${nivel}">
          <span class="modo-taller-punto modo-taller-punto-${lever.key}" aria-hidden="true"></span>
          ${escapeHtml(lever.label)}
        </span>
      `,
    );

    if (objetivoAqui.length) {
      const de = objetivosIguales ? "" : ` · ${objetivoAqui.map((lever) => lever.label).join(", ")}`;

      marcas.push(`<span class="modo-taller-marca modo-taller-marca-objetivo" data-marca="objetivo:${nivel}">Objetivo${escapeHtml(de)}</span>`);
    }

    contenedor.innerHTML = marcas.join("");

    if (animar) {
      contenedor.querySelectorAll(".modo-taller-marca[data-marca]").forEach((marca) => {
        marca.classList.toggle("recien", !antes.has(marca.dataset.marca));
      });
    }
    contenedor.closest(".modo-taller-nivel")?.classList.toggle("tiene-palancas", aqui.length > 0);
  });
}


// Lo ultimo que dijo el pie, para saber desde donde contar al puntuar.
let ultimoResultado = null;
let cuentaDelResultado = 0;


function pintarResultado(item, { animar = false } = {}) {
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

  const previo = ultimoResultado?.id === item.id ? ultimoResultado : null;

  ultimoResultado = {
    id: item.id,
    isPending: metricas.isPending,
    scoreMedio: metricas.scoreMedio,
    gap: metricas.gap,
    prioridad: metricas.prioridad,
  };

  window.cancelAnimationFrame(cuentaDelResultado);
  resultado.removeAttribute("aria-busy");

  resultado.innerHTML = metricas.isPending
    ? `<span class="modo-taller-sin-puntuar">Sin puntuar</span>`
    : `
      <span>Score medio <strong data-cifra="scoreMedio">${escapeHtml(formatMedia(metricas.scoreMedio))}</strong></span>
      <span>Gap <strong data-cifra="gap">${escapeHtml(formatMedia(metricas.gap))}</strong></span>
      <span>Prioridad ${priorityBadge(metricas.prioridad)}</span>
    `;

  if (!animar || !previo || sinMovimiento()) {
    return;
  }

  // Recien puntuada: el resultado aparece, no cuenta desde la nada.
  if (previo.isPending && !metricas.isPending) {
    resultado.classList.remove("aparece");
    void resultado.offsetWidth;
    resultado.classList.add("aparece");
    return;
  }

  if (metricas.isPending) {
    return;
  }

  if (previo.prioridad !== metricas.prioridad) {
    resultado.querySelector(".priority-badge")?.classList.add("cambia");
  }

  contarLasCifras(previo, metricas);
}


/**
 * El score medio y el gap cuentan del valor de antes al nuevo, en un tercio de
 * segundo: el numero que cambia se ve cambiar, y desde el fondo de la sala se
 * sabe que algo se ha movido sin leerlo. Mientras cuenta, la region se marca
 * ocupada, para que un lector de pantalla anuncie solo el valor final.
 */
function contarLasCifras(desde, hasta) {
  const cifras = ["scoreMedio", "gap"]
    .map((clave) => ({
      elemento: resultado.querySelector(`[data-cifra="${clave}"]`),
      desde: desde[clave],
      hasta: hasta[clave],
    }))
    .filter(({ elemento, desde: inicio, hasta: fin }) =>
      elemento && Number.isFinite(inicio) && Number.isFinite(fin) && Math.abs(fin - inicio) >= 0.005);

  if (!cifras.length) {
    return;
  }

  const duracion = 320;
  const inicio = performance.now();

  resultado.setAttribute("aria-busy", "true");
  cifras.forEach(({ elemento }) => elemento.classList.add("cambia"));

  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / duracion);
    const suave = 1 - (1 - avance) ** 3;

    cifras.forEach(({ elemento, desde: de, hasta: a }) => {
      elemento.textContent = formatMedia(de + (a - de) * suave);
    });

    if (avance < 1) {
      cuentaDelResultado = window.requestAnimationFrame(paso);
    } else {
      resultado.removeAttribute("aria-busy");
    }
  };

  cuentaDelResultado = window.requestAnimationFrame(paso);
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

  // Con un menu de la barra abierto, Escape lo cierra a el y no al modo
  // taller, y las flechas se mueven por sus opciones.
  const menu = menuAbierto();

  if (menu && event.key === "Escape") {
    event.preventDefault();
    menu.abrir(false);
    menu.boton.focus();
  } else if (menu && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    event.preventDefault();
    moverseEnElMenu(menu.menu, event.key === "ArrowDown" ? 1 : -1);
  } else if (menu && ["PageDown", "PageUp", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
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
