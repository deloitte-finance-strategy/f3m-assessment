/**
 * Los nueve dominios: el catalogo, la carga y el conmutador.
 *
 * Anadir un dominio es un solo sitio —una entrada en data/domains.json— y de
 * ahi lo leen tanto scripts/convert_domains.py como este modulo. Por eso el
 * catalogo se descarga en vez de estar escrito aqui.
 *
 * Los nueve se cargan en paralelo con Promise.allSettled y no con Promise.all:
 * con all, un solo JSON inaccesible tumbaba el arranque entero y la herramienta
 * decia "no se pudo cargar el JSON de datos" con los otros ocho perfectos.
 */

import { DEFAULT_TARGET_MATURITY, normalizeTargetValue, unique } from "../core/calculo.js?v=11";
import { normalizarItemCargado } from "../core/escenario.js?v=11";
import { normalizeDomainTargets } from "../core/objetivos.js?v=11";
import { escapeAttr, escapeHtml } from "../core/presentacion.js?v=11";

import {
  CASOS_DE_IA,
  CASOS_DE_IA_URL,
  CATALOGO_URL,
  DOMAINS,
  GRUPOS_DE_DOMINIO,
  LEVERS,
  els,
  expandedHeatmapCapabilities,
  state,
  syncActiveDomainState,
} from "./estado.js?v=11";

import { comportamientoDeDesplazamiento } from "./preferencias.js?v=11";
import { repintarTodo } from "./repintado.js?v=11";
import { populateCapacityFilter } from "./filtros.js?v=11";


/**
 * Lee el catalogo de dominios y pinta el conmutador.
 *
 * Va antes que cualquier otra carga: sin catalogo no hay ni rutas de datos ni
 * botones. Si falla, la aplicacion no puede arrancar, y se dice asi.
 */
export async function cargarCatalogoDeDominios() {
  const response = await fetch(CATALOGO_URL);

  if (!response.ok) {
    throw new Error(`No se ha podido leer ${CATALOGO_URL}: ${response.status}`);
  }

  const catalogo = await response.json();

  (catalogo.domains || []).forEach((dominio) => {
    DOMAINS[dominio.id] = {
      id: dominio.id,
      label: dominio.label,
      title: dominio.title,
      group: dominio.group,
      dataUrl: dominio.dataUrl,
    };
  });

  (catalogo.groups || []).forEach((grupo) => {
    GRUPOS_DE_DOMINIO.push(grupo);
  });

  renderDomainSwitcher();
}


/**
 * Lee el catalogo de casos de uso de IA.
 *
 * Misma forma que cargarCatalogoDeDominios() y distinto trato en init(): sin
 * catalogo de dominios no hay aplicacion, y sin fichas de casos si la hay. Por
 * eso esto lanza y quien llama decide, en vez de tragarse el fallo aqui.
 */
export async function cargarCatalogoDeCasosDeIa() {
  const response = await fetch(CASOS_DE_IA_URL);

  if (!response.ok) {
    throw new Error(`No se ha podido leer ${CASOS_DE_IA_URL}: ${response.status}`);
  }

  const catalogo = await response.json();

  // La definicion de cada etiqueta va al title del chip: en una sesion, la
  // pregunta que sigue a "Agéntica" es siempre "y eso que quiere decir".
  const definiciones = new Map(
    [...(catalogo.tiposDeIa || []), ...(catalogo.tiposDeValor || [])].map((entrada) => [
      entrada.valor,
      entrada.definicion,
    ]),
  );

  (catalogo.casos || []).forEach((caso) => {
    if (!caso.titulo) {
      return;
    }

    CASOS_DE_IA.set(caso.titulo, {
      id: caso.id || "",
      titulo: caso.titulo,
      descripcion: caso.descripcion || "",
      tipoIa: caso.tipoIa || "",
      tipoValor: caso.tipoValor || "",
      definicionTipoIa: definiciones.get(caso.tipoIa) || "",
      definicionTipoValor: definiciones.get(caso.tipoValor) || "",
    });
  });
}


/** Los botones del conmutador, agrupados como dice el catalogo. */
export function renderDomainSwitcher() {
  const contenedor = document.querySelector(".domain-groups");

  if (!contenedor) {
    return;
  }

  const dominios = Object.values(DOMAINS);

  const grupos = GRUPOS_DE_DOMINIO.length
    ? GRUPOS_DE_DOMINIO
    : unique(dominios.map((dominio) => dominio.group));

  contenedor.innerHTML = grupos
    .map((grupo) => {
      const botones = dominios
        .filter((dominio) => dominio.group === grupo)
        .map(
          (dominio) => `
            <button
              class="domain-button${dominio.id === state.activeDomainId ? " active" : ""}"
              type="button"
              data-domain-id="${escapeAttr(dominio.id)}"
              ${dominio.id === state.activeDomainId ? 'aria-current="true"' : ""}
            ><span class="domain-button-label">${escapeHtml(dominio.label)}</span></button>
          `,
        )
        .join("");

      return `
        <div class="domain-group">
          <span>${escapeHtml(grupo)}</span>
          ${botones}
        </div>
      `;
    })
    .join("");
}




async function loadDomainData(domainId) {
  if (state.domains[domainId]) {
    return state.domains[domainId];
  }

  const domain = DOMAINS[domainId];

  if (!domain) {
    throw new Error(`Dominio no configurado: ${domainId}`);
  }

  const response = await fetch(domain.dataUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${domain.dataUrl}`);
  }

  const data = await response.json();

  const items = data.subcapacities.map(normalizarItemCargado);

  const defaultTarget = normalizeTargetValue(
    data.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  state.domains[domainId] = {
    meta: data.meta,
    items,
    targets: normalizeDomainTargets(
      items,
      data.targets,
      defaultTarget,
    ),
  };

  return state.domains[domainId];
}


/**
 * Carga los nueve dominios sin que uno estropee a los demas.
 *
 * Con Promise.all, un solo JSON inaccesible hacia caer init() entero y la
 * herramienta mostraba "no se pudo cargar el JSON de datos" aunque los otros
 * ocho dominios estuvieran perfectos.
 */
export async function loadCoreDomains() {
  const ids = Object.keys(DOMAINS);

  const resultados = await Promise.allSettled(
    ids.map((domainId) => loadDomainData(domainId)),
  );

  const fallidos = ids.filter((_, i) => resultados[i].status === "rejected");

  resultados.forEach((resultado, i) => {
    if (resultado.status === "rejected") {
      console.error(`No se pudo cargar el dominio ${ids[i]}.`, resultado.reason);
    }
  });

  return {
    cargados: ids.filter((id) => state.domains[id]),
    fallidos,
  };
}


/** Deja sin usar los botones de los dominios que no han podido cargarse. */
export function marcarDominiosNoDisponibles(fallidos) {
  fallidos.forEach((domainId) => {
    const boton = document.querySelector(`[data-domain-id="${CSS.escape(domainId)}"]`);

    if (!boton) {
      return;
    }

    boton.disabled = true;
    boton.classList.add("is-disabled");
    boton.title = "Este dominio no se ha podido cargar. Recarga la página para volver a intentarlo.";
  });
}




export function setActiveDomain(domainId) {
  const domainData = state.domains[domainId];

  if (!domainData) {
    throw new Error(`Dominio no cargado: ${domainId}`);
  }

  const defaultTarget = normalizeTargetValue(
    domainData.meta?.targetMaturity,
    DEFAULT_TARGET_MATURITY,
  );

  domainData.targets = normalizeDomainTargets(
    domainData.items,
    domainData.targets,
    defaultTarget,
  );

  state.activeDomainId = domainId;
  state.meta = domainData.meta;
  state.items = domainData.items;
  state.targets = domainData.targets;

  updateActiveDomainUi();


}




function resetDomainViewState() {
  if (els.capacityFilter) {
    els.capacityFilter.value = "all";
  }

  if (els.priorityFilter) {
    els.priorityFilter.value = "all";
  }

  if (els.searchInput) {
    els.searchInput.value = "";
  }

  expandedHeatmapCapabilities.clear();
}




export async function switchDomain(domainId) {
  if (domainId === state.activeDomainId) {
    return;
  }

  syncActiveDomainState();

  await loadDomainData(domainId);
  setActiveDomain(domainId);

  populateCapacityFilter();
  resetDomainViewState();
  repintarTodo();

  const domainSwitcher = document.querySelector(".domain-switcher");

  if (domainSwitcher) {
    domainSwitcher.scrollIntoView({
      behavior: comportamientoDeDesplazamiento(),
      block: "start",
    });
  } else {
    window.scrollTo({
      top: 0,
      behavior: comportamientoDeDesplazamiento(),
    });
  }
}




function updateActiveDomainUi() {
  const domain = DOMAINS[state.activeDomainId];

  document.querySelectorAll("[data-domain-id]").forEach((button) => {
    const esElAbierto = button.dataset.domainId === state.activeDomainId;

    button.classList.toggle("active", esElAbierto);

    // Cual esta abierto se decia SOLO con una clase, es decir, solo en verde.
    // Con lector de pantalla no habia forma de saber en que dominio se estaba.
    if (esElAbierto) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const title = document.getElementById("activeDomainTitle");

  if (title && domain) {
    title.textContent = domain.title;
  }

  const label = document.getElementById("activeDomainLabel");

  if (label && domain) {
    label.textContent = domain.label;
  }

  if (els.dashboardDomainTitle && domain) {
  els.dashboardDomainTitle.textContent = `Lectura del dominio ${domain.label}`;
  }

}


/**
 * Cuantas subcapacidades tiene puntuadas cada dominio.
 *
 * En un encargo multidominio es la pregunta constante: por donde vamos. El
 * conmutador ensenaba nueve botones iguales y el unico contador que habia,
 * el de la pestana Assessment, solo hablaba del dominio abierto.
 *
 * Se cuentan las que tienen alguna palanca informada, sin pasar por calculate:
 * los objetivos son los del dominio activo y darian gaps equivocados para los
 * demas.
 */
export function actualizarAvanceDeDominios() {
  Object.entries(DOMAINS).forEach(([domainId]) => {
    const boton = document.querySelector(`[data-domain-id="${CSS.escape(domainId)}"]`);
    const dominio = state.domains[domainId];

    if (!boton || !dominio) {
      return;
    }

    const total = dominio.items.length;

    const puntuadas = dominio.items.filter((item) =>
      LEVERS.some((lever) => Number.isFinite(item.scores[lever.key])),
    ).length;

    let contador = boton.querySelector(".domain-progress");

    if (!contador) {
      contador = document.createElement("span");
      contador.className = "domain-progress";
      boton.appendChild(contador);
    }

    contador.textContent = `${puntuadas}/${total}`;
    contador.classList.toggle("sin-empezar", puntuadas === 0);
    contador.classList.toggle("completo", puntuadas === total && total > 0);

    const avance =
      puntuadas === 0
        ? "sin empezar"
        : `${puntuadas} de ${total} subcapacidades puntuadas`;

    // El contador se pinta pero no se lee: al meterlo dentro del boton, su
    // nombre accesible pasaba a ser "Controlling12/40", sin separador y sin
    // decir que son esos dos numeros. Ahora el nombre lo pone el aria-label y
    // el "12/40" visible queda como lo que es, una marca grafica.
    contador.setAttribute("aria-hidden", "true");

    boton.setAttribute(
      "aria-label",
      `${DOMAINS[domainId]?.label || domainId}, ${avance}`,
    );

    boton.title = puntuadas === 0 ? "Sin empezar" : avance;
  });
}




export function getActiveDomainConfig() {
  return DOMAINS[state.activeDomainId] || {
    id: state.activeDomainId || "domain",
    label: state.meta?.domainLabel || "Dominio",
    title: state.meta?.domainTitle || "Dominio",
  };
}
