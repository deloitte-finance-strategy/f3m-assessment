/**
 * El Assessment: puntuar cada subcapacidad en las tres palancas.
 *
 * Al puntuar no se reconstruye la lista entera —eso perdia el foco y cerraba los
 * paneles de detalle abiertos—, sino que se refresca la tarjeta tocada. De ahi
 * que convivan renderAssessments() y actualizarTarjetaDeAssessment(), y que la
 * captura y restauracion de foco sean explicitas.
 *
 * El repintado se pide por app/repintado.js, nunca llamando a renderAll(): eso
 * cerraria un ciclo con el orquestador de vistas.
 */

import {
  DEFAULT_TARGET_MATURITY,
  getMaturityLevel,
  getMaturityLevelNumber,
  normalizeTargetValue,
  toScore,
  unique,
} from "../../core/calculo.js?v=31";
import { LIMITES_DE_TEXTO } from "../../core/escenario.js?v=31";
import { createDefaultTargets } from "../../core/objetivos.js?v=31";
import { escapeAttr, escapeHtml, formatMedia } from "../../core/presentacion.js?v=31";
import { abrirDialogo, showNotice } from "../avisos.js?v=31";
import {
  aiCaseCards,
  buildFilteredEmptyState,
  pintarContadorDeCasos,
  priorityBadge,
} from "../celdas.js?v=31";
import {
  DOMAINS,
  LEVERS,
  els,
  state,
  syncActiveDomainState,
  tarjetasConDetalleAbierto,
} from "../estado.js?v=31";
import {
  actualizarContadorDeComentario,
  guardarCampoAhora,
  programarGuardado,
} from "../edicion.js?v=31";
import { describirObjetivos, getVisibleItems } from "../filtros.js?v=31";
import { calculate, getCapabilityTargets } from "../metricas.js?v=31";
import {
  persistItemChange,
  persistTargetsDeDominios,
  persistTargetsDelDominioActivo,
} from "../persistencia.js?v=31";
import { comportamientoDeDesplazamiento } from "../preferencias.js?v=31";
import { repintarTodo } from "../repintado.js?v=31";
import { entrar, repintarConMovimiento, sinMovimiento } from "../movimiento.js?v=31";
import {
  getAiDataForItem,
  getItemEvidenceText,
  getItemObjective,
  getItemQuestions,
} from "../subcapacidad.js?v=31";


export function renderCapabilityTargets() {
  if (!els.capabilityTargetsPanel) {
    return;
  }

  const capabilities = unique(
    state.items.map((item) => item.capacidad),
  );

  if (!capabilities.length) {
    els.capabilityTargetsPanel.innerHTML = "";
    els.capabilityTargetsPanel.hidden = true;
    return;
  }

  els.capabilityTargetsPanel.hidden = false;

  const rows = capabilities
    .map((capability) => {
      const targets = getCapabilityTargets(capability);

      return `
        <div class="capability-target-row">
          <div class="capability-target-name">
            <strong>${escapeHtml(capability)}</strong>

            <span>
              Objetivo utilizado para calcular los gaps de sus subcapacidades
            </span>
          </div>

          ${LEVERS.map((lever) =>
            capabilityTargetControl(
              capability,
              lever,
              targets[lever.key],
            ),
          ).join("")}
        </div>
      `;
    })
    .join("");

  const objetivoBase = normalizeTargetValue(
    state.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  // El panel es configuracion, no evaluacion: arranca plegado para no dejar
  // quince selectores por delante de la primera subcapacidad. Si ya estaba
  // desplegado, se respeta.
  const estabaDesplegado = Boolean(
    els.capabilityTargetsPanel.querySelector(".capability-targets-details")?.open,
  );

  const foco = capturarFocoDeObjetivos();

  els.capabilityTargetsPanel.innerHTML = `
    <details class="capability-targets-details" ${estabaDesplegado ? "open" : ""}>
      <summary class="capability-targets-header">
        <div>
          <p class="eyebrow">Ambición de madurez</p>

          <h3>Objetivos por capacidad y palanca</h3>

          <p class="small-note">
            ${escapeHtml(describirObjetivos() || "")}. Define el nivel objetivo de
            Procesos, Tecnología y Organización de cada capacidad.
          </p>
        </div>

        <span class="capability-targets-toggle" aria-hidden="true"></span>
      </summary>

      <div class="capability-targets-actions">
        <button
          class="secondary-button reset-targets-button"
          type="button"
          data-reset-capability-targets
        >
          Restaurar objetivos al nivel ${objetivoBase}
        </button>
      </div>

    <div class="capability-targets-table">
      <div class="capability-targets-columns" aria-hidden="true">
        <span>Capacidad</span>

        ${LEVERS.map(
          (lever) => `
            <span class="target-column target-column-${lever.key}">
              ${escapeHtml(lever.label)}
            </span>
          `,
        ).join("")}
      </div>

      <div class="capability-targets-rows">
        ${filaParaTodas(capabilities)}
        ${rows}
      </div>
    </div>
    </details>
  `;


  els.capabilityTargetsPanel
    .querySelectorAll(".capability-target-select")
    .forEach((select) => {
      select.addEventListener(
        "change",
        handleCapabilityTargetChange,
      );
    });

  els.capabilityTargetsPanel
    .querySelectorAll("[data-objetivo-para-todas]")
    .forEach((select) => {
      select.addEventListener("change", handleObjetivoParaTodas);
    });

  els.capabilityTargetsPanel
    .querySelector("[data-objetivos-a-los-nueve]")
    ?.addEventListener("click", aplicarObjetivosALosNueve);

  els.capabilityTargetsPanel
    .querySelector("[data-reset-capability-targets]")
    ?.addEventListener(
      "click",
      resetCapabilityTargets,
    );

  restaurarFocoDeObjetivos(foco);
}


/**
 * El objetivo de una palanca si es el mismo en todas las capacidades del
 * dominio, o null si hay varios.
 */
function objetivoComun(capabilities, leverKey) {
  const valores = unique(
    capabilities.map((capability) => getCapabilityTargets(capability)[leverKey]),
  );

  return valores.length === 1 ? valores[0] : null;
}


/**
 * La primera fila del panel: un objetivo por palanca para todas las capacidades
 * del dominio a la vez.
 *
 * La ambicion se suele acordar con el cliente por palanca ("en Tecnologia nos
 * conformamos con un 3"), no capacidad a capacidad, y hasta ahora eso eran
 * entre 9 y 18 desplegables por dominio. Cuando las capacidades ya tienen
 * objetivos distintos en una palanca, su desplegable dice «Varios» en vez de
 * enseñar uno cualquiera: elegir ahi un numero los iguala todos, y eso tiene
 * que verse antes de hacerlo.
 */
function filaParaTodas(capabilities) {
  const dominio = DOMAINS[state.activeDomainId]?.label || "este dominio";

  const comunes = LEVERS.map((lever) => objetivoComun(capabilities, lever.key));

  const controles = LEVERS.map((lever, indice) => {
    const actual = comunes[indice];

    const opciones = [1, 2, 3, 4, 5]
      .map(
        (value) => `<option value="${value}" ${actual === value ? "selected" : ""}>${value}</option>`,
      )
      .join("");

    return `
      <label class="capability-target-field">
        <span class="capability-target-mobile-label">
          ${escapeHtml(lever.label)}
        </span>

        <select
          class="capability-target-select target-${lever.key} objetivo-para-todas"
          data-objetivo-para-todas="${escapeAttr(lever.key)}"
          aria-label="${escapeAttr(
            `Objetivo de ${lever.label} para todas las capacidades de ${dominio}`,
          )}"
        >
          ${actual === null ? '<option value="" selected disabled>Varios</option>' : ""}
          ${opciones}
        </select>
      </label>
    `;
  }).join("");

  // Copiar a los nueve solo tiene sentido con alguna palanca que tenga un
  // objetivo unico: si las tres dicen «Varios», no hay nada que copiar.
  const hayAlgoQueCopiar = comunes.some((valor) => valor !== null);

  return `
    <div class="capability-target-row capability-target-row-todas">
      <div class="capability-target-name">
        <strong>Todas las capacidades</strong>

        <span>
          Cambia una palanca en todo ${escapeHtml(dominio)} de una vez
        </span>

        <button
          class="objetivos-a-los-nueve"
          type="button"
          data-objetivos-a-los-nueve
          ${hayAlgoQueCopiar ? "" : "disabled"}
        >
          Usar estos objetivos en los nueve dominios
        </button>
      </div>

      ${controles}
    </div>
  `;
}


/**
 * Asegura que el dominio tiene una entrada de objetivos para cada una de sus
 * capacidades, con el objetivo base del dominio en las que no la tuvieran.
 */
function objetivosCompletos(dominio) {
  const base = normalizeTargetValue(dominio.meta?.targetMaturity, DEFAULT_TARGET_MATURITY);
  const objetivos = dominio.targets || {};

  Object.entries(createDefaultTargets(dominio.items || [], base)).forEach(
    ([capability, porDefecto]) => {
      if (!objetivos[capability]) {
        objetivos[capability] = porDefecto;
      }
    },
  );

  return objetivos;
}


function handleObjetivoParaTodas(event) {
  const select = event.currentTarget;
  const leverKey = select.dataset.objetivoParaTodas;
  const activeDomain = state.domains[state.activeDomainId];

  if (!leverKey || !activeDomain || select.value === "") {
    return;
  }

  syncActiveDomainState();

  const targetValue = normalizeTargetValue(select.value, DEFAULT_TARGET_MATURITY);

  activeDomain.targets = objetivosCompletos(activeDomain);

  const capacidades = Object.keys(activeDomain.targets);

  capacidades.forEach((capability) => {
    activeDomain.targets[capability][leverKey] = targetValue;
  });

  state.targets = activeDomain.targets;

  syncActiveDomainState();

  repintarTodo();
  persistTargetsDelDominioActivo();

  const palanca = LEVERS.find((lever) => lever.key === leverKey)?.label || leverKey;
  const dominio = DOMAINS[state.activeDomainId]?.label || "este dominio";

  showNotice(
    `${palanca}: objetivo ${targetValue} en las ${capacidades.length} capacidades de ${dominio}.`,
    "exito",
  );
}


/**
 * Copia a los nueve dominios el objetivo de cada palanca que en el dominio
 * abierto es el mismo para todas sus capacidades. Las palancas que dicen
 * «Varios» no se tocan en ningun dominio, y el dialogo lo dice antes de
 * confirmar: pisar objetivos de dominios que no estan a la vista sin avisar
 * es el tipo de cambio que nadie nota hasta que el gap ya no cuadra.
 */
async function aplicarObjetivosALosNueve() {
  const capabilities = unique(state.items.map((item) => item.capacidad));

  const aCopiar = LEVERS
    .map((lever) => ({ lever, valor: objetivoComun(capabilities, lever.key) }))
    .filter(({ valor }) => valor !== null);

  if (!aCopiar.length) {
    return;
  }

  const sinCopiar = LEVERS.filter(
    (lever) => !aCopiar.some(({ lever: copiada }) => copiada.key === lever.key),
  );

  const dominio = DOMAINS[state.activeDomainId]?.label || "este dominio";
  const dominiosCargados = Object.keys(state.domains).filter(
    (id) => state.domains[id]?.items?.length,
  );

  const parrafos = [
    `${aCopiar.map(({ lever, valor }) => `${lever.label} ${valor}`).join(", ")}, en todas las capacidades de ${
      dominiosCargados.length === 9 ? "los nueve dominios" : `los ${dominiosCargados.length} dominios cargados`
    }. Sustituye los objetivos que tuvieran.`,
  ];

  if (sinCopiar.length) {
    parrafos.push(
      `${sinCopiar.map((lever) => lever.label).join(" y ")} no se ${
        sinCopiar.length === 1 ? "toca" : "tocan"
      }: en ${dominio} ${sinCopiar.length === 1 ? "tiene" : "tienen"} objetivos distintos según la capacidad.`,
    );
  }

  parrafos.push(
    "Cambia los gaps, las prioridades y las oleadas. Si el escenario es compartido, lo verá todo el equipo.",
  );

  const confirmado = await abrirDialogo({
    eyebrow: "Ambición de madurez",
    titulo: "Usar estos objetivos en los nueve dominios",
    parrafos,
    tono: "peligro",
    confirmar: "Aplicar a todos",
  });

  if (!confirmado) {
    return;
  }

  syncActiveDomainState();

  dominiosCargados.forEach((id) => {
    const dominioDeDatos = state.domains[id];

    dominioDeDatos.targets = objetivosCompletos(dominioDeDatos);

    Object.values(dominioDeDatos.targets).forEach((objetivos) => {
      aCopiar.forEach(({ lever, valor }) => {
        objetivos[lever.key] = valor;
      });
    });
  });

  state.targets = state.domains[state.activeDomainId]?.targets || state.targets;

  syncActiveDomainState();

  repintarTodo();
  persistTargetsDeDominios(dominiosCargados);

  showNotice(
    `Objetivos aplicados en ${dominiosCargados.length === 9 ? "los nueve dominios" : `${dominiosCargados.length} dominios`}.`,
    "exito",
  );
}


/**
 * Que selector de objetivo tiene el foco, para devolverselo tras repintar.
 *
 * Cambiar un objetivo llama a repintarTodo(), que reconstruye el panel entero: el
 * <select> que acaba de cambiar desaparece del DOM y el foco cae al <body>. Con
 * teclado eso obliga a volver a tabular desde el principio de la pagina despues
 * de CADA ajuste, y el panel tiene quince selectores.
 *
 * Se captura y se restaura dentro del render y no en el manejador del cambio
 * porque el panel tambien se repinta por otros caminos —una puntuacion, un
 * cambio que llega de Firebase— y el foco se perdia igual en todos ellos.
 *
 * Es el mismo patron que ya usan las tarjetas de scoring en
 * capturarFocoDeAssessment().
 */
function capturarFocoDeObjetivos() {
  const activo = document.activeElement;

  if (!activo || !els.capabilityTargetsPanel?.contains(activo)) {
    return null;
  }

  if (activo.matches("[data-objetivos-a-los-nueve]")) {
    return { aLosNueve: true };
  }

  if (activo.dataset.objetivoParaTodas) {
    return { paraTodas: activo.dataset.objetivoParaTodas };
  }

  if (!activo.classList.contains("capability-target-select")) {
    return null;
  }

  return {
    capacidad: activo.dataset.capability,
    palanca: activo.dataset.lever,
  };
}


function restaurarFocoDeObjetivos(foco) {
  if (foco?.aLosNueve) {
    // Si tras aplicar el boton queda desactivado, el foco iria al <body>: se
    // lleva a la fila, que es donde se estaba trabajando.
    const boton = els.capabilityTargetsPanel.querySelector("[data-objetivos-a-los-nueve]");
    (boton && !boton.disabled
      ? boton
      : els.capabilityTargetsPanel.querySelector("[data-objetivo-para-todas]"))?.focus();
    return;
  }

  if (foco?.paraTodas) {
    els.capabilityTargetsPanel
      .querySelector(`[data-objetivo-para-todas="${CSS.escape(foco.paraTodas)}"]`)
      ?.focus();
    return;
  }

  if (!foco?.capacidad || !foco?.palanca) {
    return;
  }

  els.capabilityTargetsPanel
    .querySelector(
      `.capability-target-select[data-capability="${CSS.escape(foco.capacidad)}"][data-lever="${CSS.escape(foco.palanca)}"]`,
    )
    ?.focus();
}


function capabilityTargetControl(
  capability,
  lever,
  currentValue,
) {
  const options = [1, 2, 3, 4, 5]
    .map(
      (value) => `
        <option
          value="${value}"
          ${currentValue === value ? "selected" : ""}
        >
          ${value}
        </option>
      `,
    )
    .join("");

  return `
    <label class="capability-target-field">
      <span class="capability-target-mobile-label">
        ${escapeHtml(lever.label)}
      </span>

      <select
        class="capability-target-select target-${lever.key}"
        data-capability="${escapeAttr(capability)}"
        data-lever="${escapeAttr(lever.key)}"
        aria-label="${escapeAttr(
          `Objetivo de ${lever.label} para ${capability}`,
        )}"
      >
        ${options}
      </select>
    </label>
  `;
}


function handleCapabilityTargetChange(event) {
  const select = event.currentTarget;
  const capability = select.dataset.capability;
  const leverKey = select.dataset.lever;

  if (!capability || !leverKey) {
    return;
  }

  const targetValue = normalizeTargetValue(
    select.value,
    DEFAULT_TARGET_MATURITY,
  );

  const activeDomain = state.domains[state.activeDomainId];

  if (!activeDomain) {
    return;
  }

  if (!activeDomain.targets) {
    activeDomain.targets = {};
  }

  if (!activeDomain.targets[capability]) {
    activeDomain.targets[capability] = {
      procesos: DEFAULT_TARGET_MATURITY,
      tecnologia: DEFAULT_TARGET_MATURITY,
      organizacion: DEFAULT_TARGET_MATURITY,
    };
  }

  activeDomain.targets[capability][leverKey] = targetValue;
  state.targets = activeDomain.targets;

  syncActiveDomainState();

  repintarTodo();
  persistTargetsDelDominioActivo();
}


async function resetCapabilityTargets() {
  const dominio = DOMAINS[state.activeDomainId]?.label || "este dominio";

  const confirmado = await abrirDialogo({
    eyebrow: "Ambición de madurez",
    titulo: `Restaurar los objetivos de ${dominio}`,
    parrafos: [
      `Todos los objetivos de Procesos, Tecnología y Organización de este dominio volverán al nivel ${normalizeTargetValue(state.meta?.targetMaturity, DEFAULT_TARGET_MATURITY)}.`,
      "Cambia los gaps, las prioridades y las oleadas de sus subcapacidades. Si el escenario es compartido, lo verá todo el equipo.",
    ],
    tono: "peligro",
    confirmar: "Restaurar objetivos",
  });

  if (!confirmado) {
    return;
  }

  const activeDomain = state.domains[state.activeDomainId];

  if (!activeDomain) {
    return;
  }

  // El nivel del dominio, no un 4 fijo: si algun dominio declarase otro
  // objetivo base, el boton prometia una cosa y hacia otra.
  const defaultTargets = createDefaultTargets(
    state.items,
    normalizeTargetValue(state.meta?.targetMaturity, DEFAULT_TARGET_MATURITY),
  );

  activeDomain.targets = defaultTargets;
  state.targets = activeDomain.targets;

  repintarTodo();
  persistTargetsDelDominioActivo();

  showNotice(
    `Los objetivos de ${dominio} han vuelto al nivel ${normalizeTargetValue(
      state.meta?.targetMaturity,
      DEFAULT_TARGET_MATURITY,
    )}.`,
    "exito",
  );
}


export function renderAssessments() {
  const items = getVisibleItems();
  const foco = capturarFocoDeAssessment();

  if (!items.length) {
    els.assessmentList.innerHTML = buildFilteredEmptyState();
    return;
  }


  const template = document.getElementById("assessmentCardTemplate");
  els.assessmentList.innerHTML = "";

  items.forEach((item) => {
    const metrics = calculate(item);
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".assessment-card");

    card.dataset.id = item.id;
    card.dataset.capacidad = item.capacidad;

    fragment.querySelector(".capability-chip").textContent = item.capacidad;
    fragment.querySelector("h3").textContent = item.subcapacidad;
    fragment.querySelector(".card-title-block p").textContent = getItemObjective(item);

    fragment.querySelector(".score-controls").innerHTML = LEVERS.map((lever) =>
      scoreControl(item, lever),
    ).join("");

    fragment.querySelector(".score-result").innerHTML = scoreResult(metrics);


    const currentMaturityLevel = getMaturityLevelNumber(metrics.scoreMedio);

    fragment.querySelector(".maturity-list").innerHTML = Object.entries(item.maturity || {})
      .map(([level, text]) => {
        const isCurrentLevel = Number(level) === currentMaturityLevel;

        return `
          <li class="${isCurrentLevel ? "is-current-level" : ""}">
            <span>${escapeHtml(text)}</span>
            ${isCurrentLevel ? '<strong class="current-level-label">Nivel actual</strong>' : ""}
          </li>
        `;
      })
      .join("");

    fragment.querySelector(".question-list").innerHTML = getItemQuestions(item)
      .map((question) => `<li>${escapeHtml(question)}</li>`)
      .join("");

    fragment.querySelector(".evidence-text").textContent = getItemEvidenceText(item);

    // El bloque de casos se oculta entero cuando la subcapacidad no trae
    // ninguno, en vez de enseñar un recuadro con un "sin casos": un hueco
    // vacio en la tarjeta se lee como algo que no ha cargado.
    const bloqueDeCasos = fragment.querySelector(".ai-detail-block");
    const casos = getAiDataForItem(item)?.casos || [];

    bloqueDeCasos.hidden = !casos.length;

    if (casos.length) {
      bloqueDeCasos.querySelector(".ai-case-cards").innerHTML = aiCaseCards(casos);
      pintarContadorDeCasos(bloqueDeCasos.querySelector(".ai-case-count"), casos);
    }


    prepararNotasDelTaller(fragment, item);

    const details = fragment.querySelector("details");
    const summaryText = fragment.querySelector(".detail-summary-text");

    if (details && summaryText) {
      details.open = tarjetasConDetalleAbierto.has(item.id);

      summaryText.textContent = details.open
        ? "Ocultar detalle de evaluación"
        : "Ver detalle de evaluación";

      details.addEventListener("toggle", () => {
        summaryText.textContent = details.open
          ? "Ocultar detalle de evaluación"
          : "Ver detalle de evaluación";

        if (details.open) {
          tarjetasConDetalleAbierto.add(item.id);
        } else {
          tarjetasConDetalleAbierto.delete(item.id);
        }
      });
    }


  els.assessmentList.appendChild(fragment);
  });

  conectarPuntuacion(els.assessmentList);

  restaurarFocoDeAssessment(foco);
}


/**
 * Engancha los grupos de score de un contenedor: el clic, el que lo quita y las
 * teclas. Lo usan la lista y el modo taller, que puntuan igual porque
 * comparten aplicarScore(): una sola forma de cambiar un score y de guardarlo.
 */
export function conectarPuntuacion(contenedor) {
  contenedor.querySelectorAll(".score-segmentos").forEach((grupo) => {
    grupo.addEventListener("change", handleScoreChange);
    grupo.addEventListener("click", handleScoreClick);
    grupo.addEventListener("keydown", handleScoreKeydown);
  });
}


/**
 * Lleva a unas tarjetas: la primera arriba, el foco en su primer score y todas
 * resaltadas un momento, para que se vea donde empieza y donde acaba lo que se
 * buscaba. Con teclado se puntua sin tener que buscarla.
 */
export function llevarALasTarjetas(tarjetas) {
  if (!tarjetas.length) {
    return;
  }

  tarjetas[0].scrollIntoView({
    behavior: comportamientoDeDesplazamiento(),
    block: "start",
  });
  enfocarPalanca(tarjetas[0].querySelector(".score-segmentos"), { preventScroll: true });

  tarjetas.forEach((tarjeta) => {
    tarjeta.classList.remove("tarjeta-de-llegada");
    // Forzar el reflujo reinicia la animacion si se llega dos veces seguidas.
    void tarjeta.offsetWidth;
    tarjeta.classList.add("tarjeta-de-llegada");
    tarjeta.addEventListener(
      "animationend",
      () => tarjeta.classList.remove("tarjeta-de-llegada"),
      { once: true },
    );
  });
}


/**
 * «Siguiente sin puntuar», en la barra de pestanas junto al dominio.
 *
 * Lo que falta se buscaba recorriendo las tarjetas o con el filtro «Pendiente»,
 * y ese filtro cambia tambien KPIs, roadmap, CSV y PDF si se olvida quitarlo.
 * El boton no toca los filtros: cuenta y recorre lo que hay en pantalla.
 *
 * "Sin puntuar" es lo mismo que en la pestana Assessment y en la etiqueta
 * Pendiente: ninguna palanca puntuada. Sin filtros, su cifra y la de la
 * pestana cuadran. Lo llama renderAll() en cualquier vista, porque el boton se
 * ve en todas las del dominio y no solo en el Assessment.
 */
export function pintarSiguientePendiente() {
  const boton = els.siguientePendienteButton;

  if (!boton) {
    return;
  }

  const quedan = getVisibleItems().filter((item) => calculate(item).isPending).length;

  boton.hidden = !quedan;

  const cuenta = boton.querySelector(".siguiente-pendiente-cuenta");

  if (cuenta) {
    cuenta.textContent = String(quedan);
  }

  const texto =
    `Ir a la siguiente subcapacidad sin puntuar · ${quedan === 1 ? "queda 1" : `quedan ${quedan}`}`;

  boton.setAttribute("aria-label", texto);
  boton.title = texto;
}


/** La ultima tarjeta en la que se ha trabajado, para seguir desde ella. */
let ultimaTarjetaTocada = null;


/** Recuerda la ultima tarjeta tocada. El clic del boton lo engancha app.js. */
export function setupSiguientePendiente() {
  els.assessmentList?.addEventListener("focusin", (event) => {
    ultimaTarjetaTocada = event.target.closest(".assessment-card")?.dataset.id || null;
  });
}


/**
 * La siguiente se cuenta desde donde se esta trabajando: despues de la ultima
 * tarjeta tocada si sigue en pantalla, y si no desde la primera que se ve. Al
 * llegar al final vuelve a empezar por arriba, como un buscador.
 */
export function irASiguientePendiente() {
  const tarjetas = [...els.assessmentList.querySelectorAll(".assessment-card")];
  const porId = new Map(state.items.map((item) => [item.id, item]));
  const pendiente = (tarjeta) => {
    const item = porId.get(tarjeta.dataset.id);

    return Boolean(item) && calculate(item).isPending;
  };

  const { indice, esLaTocada } = tarjetaEnCurso(tarjetas);
  const desde = esLaTocada ? indice + 1 : indice;

  const destino = [...tarjetas.slice(desde), ...tarjetas.slice(0, desde)].find(pendiente);

  if (destino) {
    llevarALasTarjetas([destino]);
  }
}


/** La subcapacidad en la que se esta trabajando, para abrir ahi el modo taller. */
export function idDeLaTarjetaEnCurso() {
  const tarjetas = [...els.assessmentList.querySelectorAll(".assessment-card")];

  return tarjetas[tarjetaEnCurso(tarjetas).indice]?.dataset.id || null;
}


/**
 * Donde se esta trabajando: la ultima tarjeta tocada si sigue a la vista, y si
 * no la primera que se ve. «Siguiente sin puntuar» sigue desde despues de ella
 * y el modo taller empieza en ella.
 */
function tarjetaEnCurso(tarjetas) {
  const arriba = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--alto-pestanas"),
  ) || 0;
  const seVe = (tarjeta) => {
    const caja = tarjeta.getBoundingClientRect();

    return caja.bottom > arriba && caja.top < window.innerHeight;
  };

  const tocada = tarjetas.findIndex((tarjeta) => tarjeta.dataset.id === ultimaTarjetaTocada);

  if (tocada >= 0 && seVe(tarjetas[tocada])) {
    return { indice: tocada, esLaTocada: true };
  }

  return { indice: Math.max(0, tarjetas.findIndex(seVe)), esLaTocada: false };
}


/**
 * Las notas del taller de una tarjeta: su texto, su guardado y la marca "Con
 * notas" del resumen, para saber sin abrir el detalle que hay algo escrito.
 */
function prepararNotasDelTaller(fragment, item) {
  const notas = fragment.querySelector(".notas-taller");
  const marca = fragment.querySelector(".detail-summary-notas");
  const bloque = fragment.querySelector(".notas-detail-block");

  if (!notas) {
    return;
  }

  notas.value = item.comentario || "";
  notas.dataset.id = item.id;
  notas.maxLength = LIMITES_DE_TEXTO.comentario;
  notas.setAttribute("aria-label", `Notas del taller de ${item.subcapacidad}`);

  const marcar = () => {
    if (marca) {
      marca.hidden = !notas.value.trim();
    }
  };

  marcar();

  notas.addEventListener("input", () => {
    marcar();
    actualizarContadorDeComentario(notas, bloque);
    programarGuardado(item, "comentario", notas);
  });

  notas.addEventListener("change", () => guardarCampoAhora(item, "comentario", notas));
}


/** Que control de la tarjeta tiene el foco, para devolverselo tras repintar. */
function capturarFocoDeAssessment() {
  const activo = document.activeElement;

  if (!activo || !els.assessmentList?.contains(activo)) {
    return null;
  }

  // Las notas se repintan con la lista, por ejemplo al llegar un cambio de otra
  // persona del escenario. Lo que se esta escribiendo se devuelve tal cual esta
  // en pantalla, con el cursor donde estaba: el guardado diferido lo envia
  // poco despues, y perderlo a media frase en un taller no tiene arreglo.
  if (activo.classList.contains("notas-taller")) {
    return {
      id: activo.dataset.id,
      notas: activo.value,
      inicio: activo.selectionStart,
      fin: activo.selectionEnd,
    };
  }

  if (!activo.classList.contains("score-radio")) {
    return null;
  }

  return { id: activo.dataset.id, palanca: activo.dataset.lever };
}


function restaurarFocoDeAssessment(foco) {
  if (!foco) {
    return;
  }

  if (foco.notas !== undefined) {
    const notas = els.assessmentList.querySelector(
      `.notas-taller[data-id="${CSS.escape(foco.id)}"]`,
    );

    if (notas) {
      notas.value = foco.notas;
      notas.focus();
      notas.setSelectionRange(foco.inicio, foco.fin);
    }

    return;
  }

  enfocarPalanca(
    els.assessmentList.querySelector(
      `.score-segmentos[data-id="${CSS.escape(foco.id)}"][data-lever="${CSS.escape(foco.palanca)}"]`,
    ),
  );
}


/**
 * Pone el foco en una palanca: en su score si lo tiene, y si no en el 1.
 *
 * Es donde el navegador lo pondria al llegar tabulando a un grupo de radios, y
 * lo usa tambien llevarALasTarjetas(), al llegar desde un radar, una fila,
 * «Lo mas urgente» o «Siguiente sin puntuar».
 */
export function enfocarPalanca(grupo, opciones) {
  const destino =
    grupo?.querySelector(".score-radio:checked") || grupo?.querySelector(".score-radio");

  destino?.focus(opciones);
}


/**
 * Las cinco opciones de una palanca, como botones y no como desplegable.
 *
 * El desplegable pedia dos clics por palanca —abrir y elegir—, seis por
 * subcapacidad y unos novecientos en un assessment completo, y solo enseñaba
 * "1, 2, 3, 4, 5": para saber que era un 3 habia que abrir el detalle. Ahora es
 * un clic, el numero elegido se ve desde el fondo de la sala con el color del
 * heatmap, y al pasar el raton cada opcion dice que significa ese nivel en esta
 * subcapacidad.
 *
 * Son radios de verdad, con el mismo nombre por palanca, y no botones sueltos:
 * asi el grupo es una sola parada al tabular y las flechas lo recorren, como
 * hacia el desplegable. Quitar una puntuacion, que antes era "Sin puntuar", es
 * volver a pulsar la elegida, o Suprimir con el teclado.
 */
export function scoreControl(item, lever, { prefijo = "score", objetivo = null } = {}) {
  const current = item.scores[lever.key];
  // El nombre agrupa los radios en todo el documento, no dentro de su
  // contenedor: el modo taller pinta la misma palanca encima de la lista y,
  // con el mismo nombre, marcar un score alli desmarcaba el de la tarjeta.
  const nombre = `${prefijo}-${item.id}-${lever.key}`;

  const opciones = [1, 2, 3, 4, 5]
    .map((value) => {
      const nivel = (getMaturityLevel(value) || String(value)).replace(" - ", " · ");
      const criterio = item.maturity?.[value] || item.maturity?.[String(value)];
      const esObjetivo = value === objetivo;
      const ayuda = [nivel, esObjetivo ? "objetivo" : null].filter(Boolean).join(" · ");

      return `
        <label
          class="score-opcion score-opcion-${value}${esObjetivo ? " es-objetivo" : ""}"
          title="${escapeAttr(criterio ? `${ayuda}: ${criterio}` : ayuda)}"
        >
          <input
            class="score-radio"
            type="radio"
            name="${escapeAttr(nombre)}"
            value="${value}"
            data-id="${escapeAttr(item.id)}"
            data-lever="${lever.key}"
            aria-label="${escapeAttr(ayuda)}"
            ${current === value ? "checked" : ""}
          >
          <span aria-hidden="true">${value}</span>
        </label>
      `;
    })
    .join("");

  return `
    <div class="score-field">
      <span class="score-field-label" aria-hidden="true">${escapeHtml(lever.label)}</span>
      <div
        class="score-segmentos"
        role="radiogroup"
        data-id="${escapeAttr(item.id)}"
        data-lever="${lever.key}"
        aria-label="${escapeAttr(`${lever.label} de ${item.subcapacidad}`)}"
      >
        ${opciones}
      </div>
    </div>
  `;
}


function scoreResult(metrics) {
  if (metrics.isPending) {
    return `
      <div class="score-summary score-summary-pending">
        <div class="score-summary-header">
          ${priorityBadge("Pendiente")}
        </div>

        <div class="score-summary-main">
          <strong>-</strong>
          <span>Score medio</span>
        </div>

        <p class="score-summary-note">Pendiente de scoring</p>
      </div>
    `;
  }

  return `
    <div class="score-summary score-summary-${metrics.prioridad.toLowerCase()}">
      <div class="score-summary-header">
        ${priorityBadge(metrics.prioridad)}

        <span class="score-summary-wave">
          ${escapeHtml(metrics.oleada)}
        </span>
      </div>

      <div class="score-summary-main">
        <strong>${formatMedia(metrics.scoreMedio)}</strong>
        <span>Score medio</span>
      </div>

      <div class="score-summary-target">
        Objetivo medio:
        <strong>${formatMedia(metrics.targetMedio)}</strong>
      </div>

      <div class="score-summary-details">
        <span>
          <strong>${formatMedia(metrics.gap)}</strong>
          Gap
        </span>

        <span class="level-badge">
          ${escapeHtml(metrics.nivel)}
        </span>
      </div>
    </div>
  `;
}


function handleScoreChange(event) {
  const radio = event.target;

  if (!radio.classList?.contains("score-radio")) {
    return;
  }

  aplicarScore(radio.dataset.id, radio.dataset.lever, toScore(radio.value));
}


/**
 * Pulsar la opcion que ya estaba elegida la quita. Un radio no avisa de eso con
 * "change", porque para el no ha cambiado nada, asi que se mira en el clic
 * comparando con el estado: si coinciden, es que ya estaba puesta.
 *
 * El segundo clic de un doble clic no cuenta (event.detail lleva la cuenta de
 * clics seguidos). Sin esto, quien hace doble clic por costumbre ponia el 3 y
 * lo quitaba en el mismo gesto, y la palanca se quedaba sin puntuar sin que
 * nadie lo notara. Para quitar un score basta un clic suelto, o Suprimir.
 */
function handleScoreClick(event) {
  const radio = event.target;

  if (!radio.classList?.contains("score-radio") || event.detail > 1) {
    return;
  }

  const item = state.items.find((entry) => entry.id === radio.dataset.id);

  if (item && item.scores[radio.dataset.lever] === toScore(radio.value)) {
    radio.checked = false;
    aplicarScore(radio.dataset.id, radio.dataset.lever, null);
  }
}


/**
 * Con el foco en una palanca, las teclas 1 a 5 la puntuan y Suprimir o
 * Retroceso la dejan sin puntuar. Las flechas ya las trae el grupo de radios.
 */
function handleScoreKeydown(event) {
  const grupo = event.currentTarget;
  const { id, lever } = grupo.dataset;

  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (/^[1-5]$/.test(event.key)) {
    event.preventDefault();

    const radio = grupo.querySelector(`.score-radio[value="${event.key}"]`);

    if (radio && !radio.checked) {
      radio.checked = true;
      radio.focus();
      aplicarScore(id, lever, Number(event.key));
    }

    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();

    const marcado = grupo.querySelector(".score-radio:checked");

    if (marcado) {
      marcado.checked = false;
      aplicarScore(id, lever, null);
    }
  }
}


function aplicarScore(itemId, leverKey, score) {
  const item = state.items.find((entry) => entry.id === itemId);

  if (!item || item.scores[leverKey] === score) {
    return;
  }

  // Con un filtro de prioridad puesto, puntuar puede sacar la subcapacidad de
  // la lista. Solo en ese caso hay que reconstruirla.
  const visiblesAntes = getVisibleItems().map((entry) => entry.id).join("|");

  item.scores[leverKey] = score;

  syncActiveDomainState();

  const visiblesDespues = getVisibleItems().map((entry) => entry.id).join("|");
  const mismaLista = visiblesAntes === visiblesDespues;

  repintarTodo({ saltarAssessments: mismaLista });

  if (mismaLista) {
    actualizarTarjetaDeAssessment(item, { animar: true, palanca: leverKey });
  }

  persistItemChange(item.id, `scores/${leverKey}`, score);
}


/**
 * Al puntuar en la tarjeta se ve que ha movido la respuesta, como en el modo
 * taller: el numero elegido entra con un pequeno salto, el score medio, el
 * objetivo y el gap cuentan del valor de antes al nuevo, y la prioridad late
 * si cambia. La primera palanca de una pendiente no cuenta desde la nada: el
 * resumen aparece.
 *
 * Solo aqui, al puntuar: cuando la tarjeta se repinta por otro motivo —un
 * filtro, un cambio que llega del escenario compartido— no se mueve nada.
 */
function moverElResultado(card, resultado, metrics, palanca) {
  const prioridadAntes = resultado.querySelector(".priority-badge")?.textContent.trim();
  const estabaPendiente = Boolean(resultado.querySelector(".score-summary-pending"));

  repintarConMovimiento(resultado, () => {
    resultado.innerHTML = scoreResult(metrics);
  }, { selectorDeCifras: estabaPendiente || metrics.isPending ? "" : ".score-summary strong" });

  if (sinMovimiento()) {
    return;
  }

  const elegido = palanca
    ? card.querySelector(`.score-segmentos[data-lever="${CSS.escape(palanca)}"] .score-radio:checked + span`)
    : null;

  elegido?.animate?.(
    [{ scale: "0.82" }, { scale: "1.08", offset: 0.6 }, { scale: "1" }],
    { duration: 260, easing: "ease-out" },
  );

  if (estabaPendiente !== metrics.isPending) {
    entrar(resultado.querySelector(".score-summary"), { duracion: 240, desplazamiento: 4 });
    return;
  }

  const insignia = resultado.querySelector(".priority-badge");

  if (insignia && insignia.textContent.trim() !== prioridadAntes) {
    insignia.animate?.(
      [{ scale: "1" }, { scale: "1.16", offset: 0.35 }, { scale: "1" }],
      { duration: 420, easing: "ease-out" },
    );
  }
}


/**
 * Refresca una sola tarjeta en su sitio.
 *
 * Reconstruir la lista entera cerraba todos los detalles abiertos y mandaba el
 * foco al body: con teclado habia que volver a tabular desde el principio
 * despues de cada puntuacion.
 */
function actualizarTarjetaDeAssessment(item, { animar = false, palanca = null } = {}) {
  const card = els.assessmentList.querySelector(
    `.assessment-card[data-id="${CSS.escape(item.id)}"]`,
  );

  if (!card) {
    return;
  }

  const metrics = calculate(item);
  const resultado = card.querySelector(".score-result");

  if (!animar) {
    resultado.innerHTML = scoreResult(metrics);
  } else {
    moverElResultado(card, resultado, metrics, palanca);
  }

  // El nivel de madurez resaltado cambia con el score medio.
  const nivelActual = getMaturityLevelNumber(metrics.scoreMedio);

  card.querySelectorAll(".maturity-list li").forEach((li, indice) => {
    const esActual = indice + 1 === nivelActual;

    li.classList.toggle("is-current-level", esActual);

    const etiqueta = li.querySelector(".current-level-label");

    if (esActual && !etiqueta) {
      const nueva = document.createElement("strong");
      nueva.className = "current-level-label";
      nueva.textContent = "Nivel actual";
      li.appendChild(nueva);
    } else if (!esActual && etiqueta) {
      etiqueta.remove();
    }
  });
}
