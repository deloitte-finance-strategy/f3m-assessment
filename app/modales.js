/**
 * Los dos modales: los criterios de puntuacion F3M y la ficha de un caso de IA.
 *
 * Guardan quien los abrio para devolverle el foco al cerrar. Sin eso, cerrar con
 * Escape dejaba el foco en el <body> y quien navega con teclado tenia que
 * recorrer la pagina entera para volver a donde estaba.
 */

import { getMaturityLevelNumber } from "../core/calculo.js?v=12";
import { escapeHtml } from "../core/presentacion.js?v=12";
import { atraparFoco, showNotice, updateModalOpenState } from "./avisos.js?v=12";
import { els, state } from "./estado.js?v=12";
import { calculate } from "./metricas.js?v=12";
import { getAiDataForItem } from "./subcapacidad.js?v=12";
import { aiCaseCards, pintarContadorDeCasos } from "./vistas/assessment.js?v=12";


let scoringCriteriaTrigger = null;


let aiInitiativeTrigger = null;


export function setupScoringCriteriaModal() {
  if (!els.scoringCriteriaModal || !els.assessmentList) {
    return;
  }

  els.assessmentList.addEventListener("click", (event) => {
    const button = event.target.closest(".scoring-criteria-button");

      if (!button) {
        return;
      }

      scoringCriteriaTrigger = button;
      openScoringCriteriaModal(button.closest(".assessment-card")?.dataset.id);
  });

  els.closeScoringCriteriaModalButton?.addEventListener("click", closeScoringCriteriaModal);

  els.scoringCriteriaModal.addEventListener("click", (event) => {
    if (event.target === els.scoringCriteriaModal) {
      closeScoringCriteriaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (els.scoringCriteriaModal.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeScoringCriteriaModal();
      return;
    }

    // Sin esto el tabulador se escapaba al contenido de detras, que sigue ahi.
    if (event.key === "Tab") {
      atraparFoco(event, els.scoringCriteriaModal);
    }
  });

  const tabs = [...els.scoringCriteriaModal.querySelectorAll(".criteria-tab")];

  tabs.forEach((tab, indice) => {
    tab.addEventListener("click", () => {
      activateScoringCriteriaTab(tab.dataset.criteriaTab);
    });

    // Un grupo de pestanas se recorre con las flechas, no con el tabulador.
    tab.addEventListener("keydown", (event) => {
      const salto = { ArrowRight: 1, ArrowLeft: -1, Home: -indice, End: tabs.length - 1 - indice }[
        event.key
      ];

      if (salto === undefined) {
        return;
      }

      event.preventDefault();

      const siguiente = tabs[(indice + salto + tabs.length) % tabs.length];

      activateScoringCriteriaTab(siguiente.dataset.criteriaTab);
      siguiente.focus();
    });
  });
}


/**
 * Abre la guia de evaluacion con los niveles de la subcapacidad que se esta
 * puntuando.
 *
 * El modal ensenaba la misma rubrica generica para las 152 subcapacidades de los
 * nueve dominios. Justo cuando hay que decidir si algo es un 3 o un 4, lo que
 * hace falta es la descripcion de esa subcapacidad, que hasta ahora vivia en
 * otro sitio: la lista de niveles de la tarjeta.
 */
function openScoringCriteriaModal(itemId) {
  pintarNivelesDeLaSubcapacidad(itemId);

  els.scoringCriteriaModal.hidden = false;
  activateScoringCriteriaTab("procesos");
  els.closeScoringCriteriaModalButton?.focus();
  updateModalOpenState();
}


function pintarNivelesDeLaSubcapacidad(itemId) {
  const item = state.items.find((entrada) => entrada.id === itemId);
  const niveles = Object.entries(item?.maturity || {});

  if (!item || !niveles.length) {
    els.criteriaSubcapability.hidden = true;
    return;
  }

  const metrics = calculate(item);
  const nivelActual = getMaturityLevelNumber(metrics.scoreMedio);

  els.criteriaSubcapabilityTitle.textContent = item.subcapacidad;

  els.criteriaSubcapabilityLevels.innerHTML = niveles
    .map(([nivel, texto]) => {
      const esActual = Number(nivel) === nivelActual;

      return `
        <li class="${esActual ? "is-current-level" : ""}">
          <strong>Nivel ${escapeHtml(nivel)}</strong>
          <span>${escapeHtml(texto)}</span>
          ${esActual ? '<em class="current-level-label">Nivel actual</em>' : ""}
        </li>
      `;
    })
    .join("");

  els.criteriaSubcapability.hidden = false;
}


function closeScoringCriteriaModal() {
  els.scoringCriteriaModal.hidden = true;

  // Antes de devolver el foco, no despues: mientras el modal esta abierto el
  // fondo queda inerte, y un elemento inerte no puede recibir el foco. Los
  // otros dos modales ya lo hacian en este orden.
  updateModalOpenState();

  if (scoringCriteriaTrigger?.isConnected) {
    scoringCriteriaTrigger.focus();
  }

  scoringCriteriaTrigger = null;
}


function activateScoringCriteriaTab(tabKey) {
  els.scoringCriteriaModal.querySelectorAll(".criteria-tab").forEach((tab) => {
    const isActive = tab.dataset.criteriaTab === tabKey;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  els.scoringCriteriaModal.querySelectorAll(".criteria-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.criteriaPanel === tabKey);
  });
}


export function setupAiInitiativeModal() {
  if (!els.aiInitiativeModal || !els.roadmapTable) {
    return;
  }

  els.roadmapTable.addEventListener("click", (event) => {
    const button = event.target.closest(".roadmap-ai-button");

    if (!button) {
      return;
    }

    aiInitiativeTrigger = button;
    openAiInitiativeModal(button.dataset.id);
  });

  els.closeAiInitiativeModalButton?.addEventListener("click", closeAiInitiativeModal);

  els.aiInitiativeModal.addEventListener("click", (event) => {
    if (event.target === els.aiInitiativeModal) {
      closeAiInitiativeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (els.aiInitiativeModal.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeAiInitiativeModal();
      return;
    }

    if (event.key === "Tab") {
      atraparFoco(event, els.aiInitiativeModal);
    }
  });
}


function openAiInitiativeModal(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);

  if (!item) {
    showNotice("No se ha encontrado la subcapacidad asociada a esta iniciativa de IA.", "error");
    return;
  }

  const aiData = getAiDataForItem(item);

  if (!aiData) {
    showNotice("Esta subcapacidad no tiene ninguna iniciativa de IA asociada.", "info");
    return;
  }

  els.aiModalCapability.textContent = item.capacidad;
  els.aiModalSubcapability.textContent = `Subcapacidad relacionada: ${item.subcapacidad}`;
  els.aiModalCases.innerHTML = aiCaseCards(aiData.casos);
  pintarContadorDeCasos(els.aiModalCasesCount, aiData.casos);
  els.aiModalAdvanced.textContent = aiData.advanced || "Sin aplicación avanzada informada.";
  els.aiModalSource.textContent = aiData.source ? `Fuente: ${aiData.source}` : "";

  els.aiInitiativeModal.hidden = false;
  els.closeAiInitiativeModalButton?.focus();
  updateModalOpenState();
}


function closeAiInitiativeModal() {
  els.aiInitiativeModal.hidden = true;
  updateModalOpenState();

  if (aiInitiativeTrigger?.isConnected) {
    aiInitiativeTrigger.focus();
  }

  aiInitiativeTrigger = null;
}
