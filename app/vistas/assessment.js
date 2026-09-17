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
  getMaturityLevelNumber,
  normalizeTargetValue,
  toScore,
  unique,
} from "../../core/calculo.js?v=12";
import { createDefaultTargets } from "../../core/objetivos.js?v=12";
import { escapeAttr, escapeHtml, formatNumber } from "../../core/presentacion.js?v=12";
import { abrirDialogo, showNotice } from "../avisos.js?v=12";
import { buildFilteredEmptyState, priorityBadge } from "../celdas.js?v=12";
import {
  DOMAINS,
  LEVERS,
  els,
  state,
  syncActiveDomainState,
  tarjetasConDetalleAbierto,
} from "../estado.js?v=12";
import { describirObjetivos, getVisibleItems } from "../filtros.js?v=12";
import { calculate, getCapabilityTargets } from "../metricas.js?v=12";
import { persistItemChange, persistTargetsDelDominioActivo } from "../persistencia.js?v=12";
import { repintarTodo } from "../repintado.js?v=12";
import {
  getAiDataForItem,
  getItemEvidenceText,
  getItemObjective,
  getItemQuestions,
} from "../subcapacidad.js?v=12";


/**
 * Las dos etiquetas de un caso no estrenan familia de color, y no es una
 * limitacion: el sistema ya esta lleno. El verde, el naranja y el azul marino
 * son las palancas; el rojo, el ambar y el verde son la prioridad; el teal es
 * el nivel de madurez y el azul es el estado. Una sexta familia no significaria
 * nada y le quitaria significado a las cinco que ya lo tienen.
 *
 * Se diferencian por peso dentro de la familia neutra. El tipo de valor lleva
 * chip relleno porque es el eje que ordena la conversacion con el cliente
 * —coste, riesgo, decision o P&L—, y el tipo de IA va con borde y fondo
 * transparente porque es un calificativo tecnico.
 *
 * Y dos excepciones tonales, no cromaticas, que es lo que permite destacar sin
 * romper nada:
 *
 * - "Agéntica" en oscuro de alto contraste, porque es lo que todo el mundo
 *   pregunta ahora mismo y se busca con la vista.
 * - "Automatización" en el tratamiento mas apagado del conjunto. Es la etiqueta
 *   honesta de "esto no es IA de verdad" y no debe lucir como si lo fuera.
 */
const CLASE_DE_TIPO_DE_IA = {
  Agéntica: "es-agentica",
  Automatización: "es-automatizacion",
};


function aiCaseTag(valor, definicion, clases) {
  if (!valor) {
    return "";
  }

  const titulo = definicion ? ` title="${escapeAttr(definicion)}"` : "";

  return `<span class="${clases}"${titulo}>${escapeHtml(valor)}</span>`;
}


/** Una ficha de caso: titulo, las dos etiquetas y la frase de que hace. */
function aiCaseCard(caso) {
  const etiquetas = [
    aiCaseTag(caso.tipoValor, caso.definicionTipoValor, "ai-tag ai-tag-valor"),
    aiCaseTag(
      caso.tipoIa,
      caso.definicionTipoIa,
      `ai-tag ai-tag-ia ${CLASE_DE_TIPO_DE_IA[caso.tipoIa] || ""}`.trim(),
    ),
  ].join("");

  return `
    <li class="ai-case">
      <p class="ai-case-title">${escapeHtml(caso.titulo)}</p>
      ${etiquetas ? `<p class="ai-case-tags">${etiquetas}</p>` : ""}
      ${
        caso.descripcion
          ? `<p class="ai-case-description">${escapeHtml(caso.descripcion)}</p>`
          : ""
      }
    </li>
  `;
}


/** La lista de fichas, igual en el modal del roadmap y en la tarjeta. */
export function aiCaseCards(casos) {
  if (!casos?.length) {
    return `<p class="small-note">Sin casos de uso de IA asociados informados.</p>`;
  }

  return `<ul class="ai-case-list">${casos.map(aiCaseCard).join("")}</ul>`;
}


/** El contador que acompaña al titulo de la seccion. */
export function pintarContadorDeCasos(elemento, casos) {
  if (!elemento) {
    return;
  }

  elemento.textContent = casos.length ? String(casos.length) : "";
  elemento.hidden = !casos.length;
}


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
    .querySelector("[data-reset-capability-targets]")
    ?.addEventListener(
      "click",
      resetCapabilityTargets,
    );

  restaurarFocoDeObjetivos(foco);
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

  if (!activo.classList.contains("capability-target-select")) {
    return null;
  }

  return {
    capacidad: activo.dataset.capability,
    palanca: activo.dataset.lever,
  };
}


function restaurarFocoDeObjetivos(foco) {
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

  els.assessmentList.querySelectorAll(".score-select").forEach((select) => {
    select.addEventListener("change", handleScoreChange);
  });

  restaurarFocoDeAssessment(foco);
}


/** Que selector de score tiene el foco, para devolverselo tras repintar. */
function capturarFocoDeAssessment() {
  const activo = document.activeElement;

  if (!activo || !els.assessmentList?.contains(activo)) {
    return null;
  }

  if (!activo.classList.contains("score-select")) {
    return null;
  }

  return { id: activo.dataset.id, palanca: activo.dataset.lever };
}


function restaurarFocoDeAssessment(foco) {
  if (!foco) {
    return;
  }

  els.assessmentList
    .querySelector(
      `.score-select[data-id="${CSS.escape(foco.id)}"][data-lever="${CSS.escape(foco.palanca)}"]`,
    )
    ?.focus();
}


function getScoreSelectClass(score) {
  return Number.isInteger(score)
    ? `score-value-${score}`
    : "score-value-empty";
}


function scoreControl(item, lever) {
  const current = item.scores[lever.key];
  const options = [`<option value="">Sin puntuar</option>`]
    .concat([1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${current === value ? "selected" : ""}>${value}</option>`))
    .join("");
  return `
    <label class="score-field">
      <span>${escapeHtml(lever.label)}</span>
      <select
        class="score-select ${getScoreSelectClass(current)}"
        data-id="${escapeAttr(item.id)}"
        data-lever="${lever.key}"
        aria-label="${escapeAttr(`${lever.label} de ${item.subcapacidad}`)}"
      >
        ${options}
      </select>
    </label>
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
        <strong>${formatNumber(metrics.scoreMedio)}</strong>
        <span>Score medio</span>
      </div>

      <div class="score-summary-target">
        Objetivo medio:
        <strong>${formatNumber(metrics.targetMedio)}</strong>
      </div>

      <div class="score-summary-details">
        <span>
          <strong>${formatNumber(metrics.gap)}</strong>
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
  const item = state.items.find(
    (entry) => entry.id === event.target.dataset.id,
  );

  if (!item) {
    return;
  }

  const leverKey = event.target.dataset.lever;
  const score = toScore(event.target.value);

  // Con un filtro de prioridad puesto, puntuar puede sacar la subcapacidad de
  // la lista. Solo en ese caso hay que reconstruirla.
  const visiblesAntes = getVisibleItems().map((entry) => entry.id).join("|");

  item.scores[leverKey] = score;

  syncActiveDomainState();

  const visiblesDespues = getVisibleItems().map((entry) => entry.id).join("|");
  const mismaLista = visiblesAntes === visiblesDespues;

  repintarTodo({ saltarAssessments: mismaLista });

  if (mismaLista) {
    actualizarTarjetaDeAssessment(item);
  }

  persistItemChange(item.id, `scores/${leverKey}`, score);
}


/**
 * Refresca una sola tarjeta en su sitio.
 *
 * Reconstruir la lista entera cerraba todos los detalles abiertos y mandaba el
 * foco al body: con teclado habia que volver a tabular desde el principio
 * despues de cada puntuacion.
 */
function actualizarTarjetaDeAssessment(item) {
  const card = els.assessmentList.querySelector(
    `.assessment-card[data-id="${CSS.escape(item.id)}"]`,
  );

  if (!card) {
    return;
  }

  const metrics = calculate(item);

  card.querySelector(".score-result").innerHTML = scoreResult(metrics);

  // El color del borde de cada selector depende de su valor.
  card.querySelectorAll(".score-select").forEach((select) => {
    select.className = `score-select ${getScoreSelectClass(
      item.scores[select.dataset.lever],
    )}`;
  });

  // Y el nivel de madurez resaltado cambia con el score medio.
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
