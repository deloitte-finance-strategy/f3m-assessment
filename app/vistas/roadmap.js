/**
 * El Roadmap: las iniciativas priorizadas, con responsable, estado y comentario.
 *
 * Los campos editables se guardan 600 ms despues de la ultima pulsacion, asi que
 * lleva su propia cuenta de guardados en vuelo: cerrar la pestana justo despues
 * de escribir un comentario lo perdia sin dejar rastro. app.js la consulta por
 * hayGuardadosPendientes() para frenar el cierre.
 */

import { ordenarPorPrioridadYGap } from "../../core/calculo.js?v=11";
import { LIMITES_DE_TEXTO, recortarAlLimite } from "../../core/escenario.js?v=11";
import { escapeAttr, escapeHtml, formatNumber } from "../../core/presentacion.js?v=11";
import { buildFilteredEmptyState, priorityBadge } from "../celdas.js?v=11";
import { STATUS_OPTIONS, els, state } from "../estado.js?v=11";
import { getVisibleItems } from "../filtros.js?v=11";
import { getUsuarioActual } from "../identidad.js?v=11";
import { calculate } from "../metricas.js?v=11";
import { persistItemChange } from "../persistencia.js?v=11";
import { getAiDataForItem } from "../subcapacidad.js?v=11";
import { get } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";


function getWaveShortLabel(wave) {
  const match = String(wave || "").match(/\d+/);

  return match ? match[0] : "-";
}


export function renderRoadmap() {
  // Repintar la tabla borra los campos editables. Si alguien esta escribiendo
  // un comentario en ese momento, su texto desaparece sin aviso: los campos
  // solo guardaban al perder el foco. Se anota lo que hay en curso para
  // devolverlo después.
  const edicionEnCurso = capturarEdicionDeRoadmap();

  const roadmapItems = getVisibleItems(); // Roadmap respeta filtros activos

  const rows = ordenarPorPrioridadYGap(
    roadmapItems.map((item) => ({ item, metrics: calculate(item) })),
  )
    .map(({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td class="number">${formatNumber(metrics.gap)}</td>
        <td>${priorityBadge(metrics.prioridad)}</td>
        <td>${escapeHtml(item.iniciativaSugerida)}</td>
        <td>
          ${
            // Sin datos, el boton abria un aviso y nada mas: mejor no ofrecerlo.
            getAiDataForItem(item)
              ? `
                <button
                  class="roadmap-ai-button"
                  type="button"
                  data-id="${escapeAttr(item.id)}"
                  aria-label="${escapeAttr(`Ver la iniciativa de IA de ${item.subcapacidad}`)}"
                >
                  IA
                </button>
              `
              : `<span class="small-note">-</span>`
          }
        </td>

        <td class="roadmap-wave-cell">
          <span
            class="status-chip roadmap-wave"
            title="${escapeAttr(metrics.oleada)}"
            aria-label="${escapeAttr(metrics.oleada)}"
          >
            ${escapeHtml(getWaveShortLabel(metrics.oleada))}
          </span>
        </td>

        <td>
          <input
            class="inline-input roadmap-owner"
            data-id="${escapeAttr(item.id)}"
            value="${escapeAttr(item.owner)}"
            maxlength="${LIMITES_DE_TEXTO.owner}"
            placeholder="Responsable"
            aria-label="${escapeAttr(`Responsable de ${item.subcapacidad}`)}"
          >
        </td>
        <td>${statusSelect(item)}</td>
        <td>
          <textarea
            class="roadmap-comment"
            data-id="${escapeAttr(item.id)}"
            maxlength="${LIMITES_DE_TEXTO.comentario}"
            placeholder="Comentarios"
            aria-label="${escapeAttr(`Comentarios de ${item.subcapacidad}`)}"
          >${escapeHtml(item.comentario)}</textarea>
          ${contadorDeComentario(item)}
        </td>
        <td class="roadmap-authorship">${celdaDeAutoria(item)}</td>
      </tr>
    `)
    .join("");

  els.roadmapTable.innerHTML = `
    <caption class="solo-lectores">Roadmap de iniciativas, ordenado por prioridad y gap, con responsable, estado y comentarios.</caption>

    <thead>
      <tr>
        <th scope="col">Capacidad</th>
        <th scope="col">Subcapacidad</th>
        <th scope="col" class="number">Gap</th>
        <th scope="col">Prioridad</th>
        <th scope="col">Iniciativa sugerida</th>
        <th scope="col">IA</th>
        <th scope="col">Oleada</th>
        <th scope="col">Responsable</th>
        <th scope="col">Estado</th>
        <th scope="col">Comentarios</th>
        <th scope="col">Último cambio</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `
        <tr>
          <td colspan="11" class="table-empty-cell">
            ${buildFilteredEmptyState()}
          </td>
        </tr>
      `}
    </tbody>
  `;

  els.roadmapTable.querySelectorAll(".roadmap-owner").forEach((input) => {
  input.addEventListener("change", handleRoadmapFieldChange);
  input.addEventListener("input", handleRoadmapFieldInput);
});

els.roadmapTable.querySelectorAll(".roadmap-status").forEach((select) => {
  select.addEventListener("change", handleRoadmapFieldChange);
});

els.roadmapTable.querySelectorAll(".roadmap-comment").forEach((textarea) => {
  textarea.addEventListener("change", handleRoadmapFieldChange);
  textarea.addEventListener("input", actualizarContadorDeComentario);
  textarea.addEventListener("input", handleRoadmapFieldInput);
});

  restaurarEdicionDeRoadmap(edicionEnCurso);
}


/** A que campo de la subcapacidad corresponde un control del Roadmap. */
function campoDeRoadmap(elemento) {
  if (elemento.classList.contains("roadmap-owner")) return "owner";
  if (elemento.classList.contains("roadmap-status")) return "status";
  if (elemento.classList.contains("roadmap-comment")) return "comentario";

  return null;
}


const CLASE_POR_CAMPO = {
  owner: "roadmap-owner",
  status: "roadmap-status",
  comentario: "roadmap-comment",
};


/** Que se esta editando ahora mismo en el Roadmap, si es que hay algo. */
function capturarEdicionDeRoadmap() {
  const activo = document.activeElement;

  if (!activo || !els.roadmapTable?.contains(activo)) {
    return null;
  }

  const campo = campoDeRoadmap(activo);

  if (!campo || !activo.dataset.id) {
    return null;
  }

  return {
    id: activo.dataset.id,
    campo,
    valor: activo.value,
    // Los <select> no tienen cursor de texto.
    inicio: activo.selectionStart ?? null,
    fin: activo.selectionEnd ?? null,
  };
}


/**
 * Devuelve el foco, el texto y la posición del cursor tras repintar.
 *
 * Se restaura el valor que había en pantalla y no el del estado: si el repintado
 * viene de un cambio remoto, lo que estaba escribiendo esta persona no puede
 * perderse por el camino. El guardado diferido lo envía poco después.
 */
function restaurarEdicionDeRoadmap(edicion) {
  if (!edicion) {
    return;
  }

  const destino = els.roadmapTable.querySelector(
    `.${CLASE_POR_CAMPO[edicion.campo]}[data-id="${CSS.escape(edicion.id)}"]`,
  );

  if (!destino) {
    return;
  }

  destino.value = edicion.valor;
  destino.focus();

  if (edicion.inicio !== null && typeof destino.setSelectionRange === "function") {
    try {
      destino.setSelectionRange(edicion.inicio, edicion.fin);
    } catch (error) {
      // Algunos tipos de campo no admiten seleccion; no es motivo de fallo.
    }
  }
}


/** Quién tocó por última vez esta subcapacidad, si consta. */
function celdaDeAutoria(item) {
  const autoria = item.lastEditedBy;

  if (!autoria || !autoria.nombre) {
    return `<span class="small-note">-</span>`;
  }

  const cuando = Date.parse(autoria.at || "");

  const fecha = Number.isFinite(cuando)
    ? new Date(cuando).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const esMio = getUsuarioActual()?.uid === autoria.uid;

  return `
    <span
      class="authorship-chip${esMio ? " authorship-mine" : ""}"
      title="${escapeAttr(fecha ? `${autoria.nombre} · ${fecha}` : autoria.nombre)}"
    >
      ${escapeHtml(esMio ? "Tú" : autoria.nombre)}
    </span>
    ${fecha ? `<span class="small-note authorship-date">${escapeHtml(fecha)}</span>` : ""}
  `;
}


/**
 * Cuánto queda de comentario, visible solo al acercarse al límite.
 *
 * Sin esto, pasarse de los 2.000 caracteres que admiten las reglas hacía que
 * Firebase rechazara la escritura sin que se notara.
 */
function contadorDeComentario(item) {
  const usados = (item.comentario || "").length;
  const limite = LIMITES_DE_TEXTO.comentario;

  if (usados < limite * 0.9) {
    return "";
  }

  // role="status" y no aria-hidden. Era invisible para un lector de pantalla,
  // asi que quien no ve la cuenta se enteraba del limite al perderlo: se pasa
  // de 2.000, las reglas rechazan la escritura entera y el comentario no llega.
  // El aria-live es polite para no interrumpir mientras se escribe.
  return `
    <span class="roadmap-comment-count" role="status" aria-live="polite">
      ${usados} / ${limite}
    </span>
  `;
}


function statusSelect(item) {
  return `
    <select
      class="inline-input roadmap-status"
      data-id="${escapeAttr(item.id)}"
      aria-label="${escapeAttr(`Estado de ${item.subcapacidad}`)}"
    >
      ${STATUS_OPTIONS.map((status) => `<option value="${escapeAttr(status)}" ${item.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
    </select>
  `;
}


/** Mantiene visible cuánto queda de comentario mientras se escribe. */
function actualizarContadorDeComentario(event) {
  const textarea = event.currentTarget;
  const celda = textarea.closest("td");

  if (!celda) {
    return;
  }

  const limite = LIMITES_DE_TEXTO.comentario;
  const usados = textarea.value.length;
  let contador = celda.querySelector(".roadmap-comment-count");

  if (usados < limite * 0.9) {
    contador?.remove();
    return;
  }

  if (!contador) {
    contador = document.createElement("span");
    contador.className = "roadmap-comment-count";
    contador.setAttribute("role", "status");
    contador.setAttribute("aria-live", "polite");
    celda.appendChild(contador);
  }

  contador.textContent = `${usados} / ${limite}`;
  contador.classList.toggle("is-at-limit", usados >= limite);
}


const GUARDADO_DIFERIDO_MS = 600;


const guardadosPendientes = new Map();


function handleRoadmapFieldChange(event) {
  const elemento = event.target;
  const item = state.items.find((entry) => entry.id === elemento.dataset.id);
  const campo = campoDeRoadmap(elemento);

  if (!item || !campo) {
    return;
  }

  cancelarGuardadoDiferido(item.id, campo);

  // maxlength solo frena lo que teclea el usuario. Un valor que llegue de un
  // escenario importado puede superar el límite y hacer que Firebase rechace la
  // escritura entera, así que se recorta también aquí.
  const valor = recortarAlLimite(campo, elemento.value);

  if (valor !== elemento.value) {
    elemento.value = valor;
  }

  guardarCampoDeRoadmap(item, campo, valor);
}


/** Mientras se escribe: se guarda solo, sin esperar a perder el foco. */
function handleRoadmapFieldInput(event) {
  const elemento = event.target;
  const item = state.items.find((entry) => entry.id === elemento.dataset.id);
  const campo = campoDeRoadmap(elemento);

  if (!item || !campo) {
    return;
  }

  const clave = `${item.id}:${campo}`;

  window.clearTimeout(guardadosPendientes.get(clave));

  guardadosPendientes.set(
    clave,
    window.setTimeout(() => {
      guardadosPendientes.delete(clave);
      guardarCampoDeRoadmap(item, campo, recortarAlLimite(campo, elemento.value));
    }, GUARDADO_DIFERIDO_MS),
  );
}


function cancelarGuardadoDiferido(itemId, campo) {
  const clave = `${itemId}:${campo}`;

  window.clearTimeout(guardadosPendientes.get(clave));
  guardadosPendientes.delete(clave);
}


/** Guarda un campo del Roadmap, si de verdad ha cambiado. */
function guardarCampoDeRoadmap(item, campo, valor) {
  // Sin esta comprobacion, salir de un campo que no se ha tocado provocaba una
  // escritura completa en localStorage y otra en Firebase.
  if (item[campo] === valor) {
    return;
  }

  item[campo] = valor;

  persistItemChange(item.id, campo, valor);
}


/** Si queda algo escrito y sin guardar. Lo consulta el freno de cierre. */
export function hayGuardadosPendientes() {
  return guardadosPendientes.size > 0;
}
