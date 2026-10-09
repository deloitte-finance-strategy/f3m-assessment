/**
 * El Roadmap: las iniciativas priorizadas, con responsable, estado y comentario.
 *
 * Los campos editables se guardan 600 ms despues de la ultima pulsacion. Esa
 * espera, y la cuenta de lo que queda por guardar, viven en app/edicion.js desde
 * que el comentario tambien se escribe desde el Assessment.
 */

import { ordenarPorPrioridadYGap } from "../../core/calculo.js?v=28";
import { LIMITES_DE_TEXTO } from "../../core/escenario.js?v=28";
import { escapeAttr, escapeHtml, formatMedia } from "../../core/presentacion.js?v=28";
import { buildFilteredEmptyState, priorityBadge } from "../celdas.js?v=28";
import { STATUS_OPTIONS, els, state } from "../estado.js?v=28";
import { getVisibleItems } from "../filtros.js?v=28";
import { getUsuarioActual } from "../identidad.js?v=28";
import { calculate } from "../metricas.js?v=28";
import {
  actualizarContadorDeComentario,
  contadorDeComentario,
  guardarCampoAhora,
  programarGuardado,
} from "../edicion.js?v=28";
import { getAiDataForItem } from "../subcapacidad.js?v=28";


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

  const entradas = ordenarPorPrioridadYGap(
    roadmapItems.map((item) => ({ item, metrics: calculate(item) })),
  );

  const filaDeIniciativa = ({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td class="number">${formatMedia(metrics.gap)}</td>
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
    `;

  const grupos = agruparPorOleada(entradas)
    .map((grupo) => `
      <tbody class="roadmap-oleada">
        ${cabeceraDeOleada(grupo)}
        ${grupo.entradas.map(filaDeIniciativa).join("")}
      </tbody>
    `)
    .join("");

  els.roadmapTable.innerHTML = `
    <caption class="solo-lectores">Roadmap de iniciativas, agrupado por oleada y ordenado por gap, con responsable, estado y comentarios.</caption>

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
    ${grupos || `
      <tbody>
        <tr>
          <td colspan="11" class="table-empty-cell">
            ${buildFilteredEmptyState()}
          </td>
        </tr>
      </tbody>
    `}
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
  textarea.addEventListener("input", (event) =>
    actualizarContadorDeComentario(event.currentTarget, event.currentTarget.closest("td")),
  );
  textarea.addEventListener("input", handleRoadmapFieldInput);
});

  restaurarEdicionDeRoadmap(edicionEnCurso);
  pintarRecuentoDeIniciativas(roadmapItems.length);
}


/**
 * Las oleadas en el orden en que se cuentan en un comite: primero lo urgente, y
 * lo que aun no tiene puntuacion al final, aparte, porque todavia no es una
 * iniciativa con fecha. Una oleada sin iniciativas no se ensena: una cabecera
 * con un cero debajo parece una tabla que no ha cargado.
 *
 * La oleada sale de la prioridad, asi que el orden de las filas es el de
 * siempre: agrupar solo pone nombre a los cortes que ya estaban.
 */
const OLEADAS = [
  { oleada: "Oleada 1", prioridad: "Alta" },
  { oleada: "Oleada 2", prioridad: "Media" },
  { oleada: "Oleada 3", prioridad: "Baja" },
  { oleada: "Pendiente", prioridad: "Pendiente" },
];


function agruparPorOleada(entradas) {
  // Una oleada que no fuera ninguna de las cuatro iria al grupo de pendientes y
  // no a ninguno: una fila que desaparece descuadra la cifra de iniciativas sin
  // que nada lo diga.
  const conocidas = new Set(OLEADAS.map((grupo) => grupo.oleada));
  const oleadaDe = ({ metrics }) => (conocidas.has(metrics.oleada) ? metrics.oleada : "Pendiente");

  return OLEADAS.map((grupo) => ({
    ...grupo,
    entradas: entradas.filter((entrada) => oleadaDe(entrada) === grupo.oleada),
  })).filter((grupo) => grupo.entradas.length);
}


/**
 * La fila que abre cada oleada. Es un <th scope="rowgroup">: un lector de
 * pantalla anuncia "Oleada 1" al entrar en cualquiera de sus filas, igual que
 * se ve. El texto va en un span fijo a la izquierda para que no se vaya con el
 * desplazamiento horizontal cuando la tabla esta en su caja.
 */
function cabeceraDeOleada({ oleada, prioridad, entradas }) {
  const cuantas = entradas.length === 1 ? "1 iniciativa" : `${entradas.length} iniciativas`;
  const nombre = oleada === "Pendiente" ? "Sin oleada" : oleada;
  const detalle = oleada === "Pendiente"
    ? `${cuantas} pendientes de puntuar`
    : `prioridad ${prioridad.toLowerCase()} · ${cuantas}`;

  return `
    <tr class="roadmap-oleada-cabecera roadmap-oleada-${prioridad.toLowerCase()}">
      <th colspan="11" scope="rowgroup">
        <span class="roadmap-oleada-texto">
          <strong>${escapeHtml(nombre)}</strong>
          <span>${escapeHtml(detalle)}</span>
        </span>
      </th>
    </tr>
  `;
}


/**
 * Cuantas iniciativas hay, encima de la tabla. Sin la cifra no habia forma de
 * saber si la lista acababa en la pantalla o seguia: con filtros, ademas, es
 * la confirmacion de que el Roadmap dice lo mismo que el KPI.
 */
function pintarRecuentoDeIniciativas(total) {
  const nota = document.getElementById("roadmapNote");

  if (!nota) {
    return;
  }

  const recuento = total === 1 ? "1 iniciativa" : `${total} iniciativas`;

  nota.innerHTML = `<strong>${recuento}</strong> · Agrupadas por oleada y ordenadas por gap. Respetan los filtros del Assessment.`;
}


/**
 * El Roadmap crece con la pagina cuando cabe a lo ancho, y se queda en su caja
 * cuando no.
 *
 * La caja tiene alto propio y se desplaza por dentro, que es lo que permite
 * fijar el encabezado y la primera columna cuando la tabla desborda en
 * horizontal. Pero con 20 iniciativas, a 1366 px se veian cuatro, la cuarta
 * cortada a media frase, y nada decia que hubiera mas: lo natural era bajar la
 * pagina y la pagina no tenia nada mas que ensenar.
 *
 * Cuando la tabla cabe, la caja se suelta y el encabezado se fija debajo de las
 * pestanas. Cuando no cabe —Presentacion en un portatil, o una ventana
 * estrecha— se queda como estaba: un desplazamiento horizontal con la barra al
 * fondo de tres mil pixeles de tabla no lo encuentra nadie.
 *
 * Se compara con la anchura minima de la tabla y no con la que tiene, porque
 * esa depende del modo en que este la caja, y la decision no puede depender de
 * si misma. No hay forma de preguntarselo al CSS.
 */
export function setupCajaDelRoadmap() {
  const tabla = els.roadmapTable;
  const caja = tabla?.closest(".table-wrap");

  if (!caja || typeof ResizeObserver === "undefined") {
    return;
  }

  const ajustar = () => {
    const anchoMinimo = Number.parseFloat(getComputedStyle(tabla).minWidth) || 0;
    // Sin contar la barra vertical, que solo existe en uno de los dos modos:
    // con ella, una tabla justa en el limite cambiaba de modo segun empezara.
    const anchoDisponible = caja.offsetWidth - caja.clientLeft * 2;

    // Oculta, la caja mide cero: se decide cuando se ensene.
    if (!anchoDisponible) {
      return;
    }

    caja.classList.toggle("roadmap-en-pagina", anchoMinimo <= anchoDisponible);
  };

  // Observar la tabla cubre la densidad: su anchura minima cambia con ella.
  const observador = new ResizeObserver(ajustar);

  observador.observe(caja);
  observador.observe(tabla);
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


function handleRoadmapFieldChange(event) {
  const elemento = event.target;
  const item = state.items.find((entry) => entry.id === elemento.dataset.id);
  const campo = campoDeRoadmap(elemento);

  if (!item || !campo) {
    return;
  }

  guardarCampoAhora(item, campo, elemento);
}


/** Mientras se escribe: se guarda solo, sin esperar a perder el foco. */
function handleRoadmapFieldInput(event) {
  const elemento = event.target;
  const item = state.items.find((entry) => entry.id === elemento.dataset.id);
  const campo = campoDeRoadmap(elemento);

  if (!item || !campo) {
    return;
  }

  programarGuardado(item, campo, elemento);
}
