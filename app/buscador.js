/**
 * El buscador: Ctrl+K, o la lupa de la barra de pestanas, y se escribe un
 * trozo del nombre de una subcapacidad para ir a su tarjeta en cualquiera de
 * los nueve dominios.
 *
 * Es un <dialog> nativo y no uno de los modales de la herramienta: showModal()
 * ya deja el fondo inerte, atrapa el foco, cierra con Escape y lo devuelve al
 * cerrar, que es todo lo que aqui hace falta.
 *
 * A donde se va al elegir no se decide aqui: cambiar de dominio y de vista es
 * cosa del orquestador, que lo inyecta. Importarlo cerraria un ciclo con el.
 */

import { buscarSubcapacidades, trozosResaltados } from "../core/busqueda.js?v=27";
import { escapeAttr, escapeHtml, formatMedia } from "../core/presentacion.js?v=27";
import { SELECTOR_DE_MODAL_ABIERTO } from "./avisos.js?v=27";
import { calculate } from "./metricas.js?v=27";
import { getDominiosDelOverview } from "./vistas/overview.js?v=27";


let dialogo = null;
let campo = null;
let lista = null;
let pie = null;
let resultados = [];
let activo = 0;
let irA = () => {};


function resaltado(texto, consulta) {
  return trozosResaltados(texto, consulta)
    .map((trozo) => (trozo.resaltado ? `<mark>${escapeHtml(trozo.texto)}</mark>` : escapeHtml(trozo.texto)))
    .join("");
}


/** «Sin puntuar» o la media: lo que hace falta para saber si se va a puntuar o a revisar. */
function estadoDe(item, domainId) {
  const metricas = calculate(item, domainId);

  return metricas.isPending
    ? `<span class="buscador-estado buscador-estado-pendiente">Sin puntuar</span>`
    : `<span class="buscador-estado">Media ${escapeHtml(formatMedia(metricas.scoreMedio))}</span>`;
}


function marcarActivo(indice) {
  if (!resultados.length) {
    campo.removeAttribute("aria-activedescendant");
    return;
  }

  activo = (indice + resultados.length) % resultados.length;

  lista.querySelectorAll(".buscador-opcion").forEach((opcion, posicion) => {
    opcion.setAttribute("aria-selected", String(posicion === activo));
  });

  const elegida = lista.querySelector(`#buscador-opcion-${activo}`);

  campo.setAttribute("aria-activedescendant", elegida.id);
  elegida.scrollIntoView({ block: "nearest" });
}


function pintar() {
  const consulta = campo.value;
  const { resultados: encontrados, total } = buscarSubcapacidades(getDominiosDelOverview(), consulta);

  resultados = encontrados;
  campo.setAttribute("aria-expanded", String(resultados.length > 0));

  lista.innerHTML = resultados
    .map(
      ({ domainId, dominio, item }, indice) => `
        <li
          class="buscador-opcion"
          id="buscador-opcion-${indice}"
          role="option"
          aria-selected="false"
          data-indice="${indice}"
        >
          <span class="buscador-titulo">${resaltado(item.subcapacidad, consulta)}</span>
          <span class="buscador-donde">${resaltado(`${dominio} · ${item.capacidad}`, consulta)}</span>
          ${estadoDe(item, domainId)}
        </li>`,
    )
    .join("");

  lista.hidden = !resultados.length;

  if (!consulta.trim()) {
    pie.textContent = "Escribe parte del nombre de una subcapacidad, de su capacidad o de su dominio.";
  } else if (!total) {
    pie.textContent = `Nada con «${consulta.trim()}» en los nueve dominios.`;
  } else if (total > resultados.length) {
    pie.textContent = `Y ${total - resultados.length} más: añade otra palabra para afinar.`;
  } else {
    pie.textContent = "↑ ↓ para moverte · Intro para ir · Esc para cerrar";
  }

  marcarActivo(0);
}


function elegir(indice) {
  const elegido = resultados[indice];

  if (!elegido) {
    return;
  }

  dialogo.close();
  irA(elegido.domainId, elegido.item.id);
}


export function abrirBuscador() {
  if (!dialogo || dialogo.open || document.querySelector(SELECTOR_DE_MODAL_ABIERTO)) {
    return;
  }

  dialogo.showModal();

  // Se queda lo ultimo que se busco, seleccionado: escribir lo sustituye, y
  // volver a lo mismo —ir de una conciliacion a la siguiente— es un Intro.
  pintar();
  campo.focus();
  campo.select();
}


export function setupBuscador({ alElegir }) {
  dialogo = document.getElementById("buscador");
  campo = document.getElementById("buscadorCampo");
  lista = document.getElementById("buscadorResultados");
  pie = document.getElementById("buscadorPie");

  if (!dialogo || !campo || !lista || !pie || typeof dialogo.showModal !== "function") {
    document.getElementById("buscadorButton")?.setAttribute("hidden", "");
    return;
  }

  irA = alElegir;

  const atajo = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘ K" : "Ctrl K";
  const pista = document.querySelector(".tabs-buscar-atajo");

  if (pista) {
    pista.textContent = atajo;
  }

  document.getElementById("buscadorButton")?.addEventListener("click", abrirBuscador);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      abrirBuscador();
    }
  });

  campo.addEventListener("input", pintar);

  campo.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      marcarActivo(activo + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      elegir(activo);
    }
  });

  lista.addEventListener("mousemove", (event) => {
    const opcion = event.target.closest(".buscador-opcion");

    if (opcion && Number(opcion.dataset.indice) !== activo) {
      marcarActivo(Number(opcion.dataset.indice));
    }
  });

  lista.addEventListener("click", (event) => {
    const opcion = event.target.closest(".buscador-opcion");

    if (opcion) {
      elegir(Number(opcion.dataset.indice));
    }
  });

  // Un clic fuera del cuadro cae en el propio <dialog>, en su ::backdrop.
  dialogo.addEventListener("click", (event) => {
    if (event.target === dialogo) {
      dialogo.close();
    }
  });
}
