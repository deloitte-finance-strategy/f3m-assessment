/**
 * La apertura del taller: la primera pantalla del modo taller, simetrica al
 * cierre.
 *
 * El modo taller arrancaba en una subcapacidad, con cinco niveles que el
 * cliente aun no sabia leer, y los primeros minutos de cada sesion se iban en
 * explicar la escala de palabra. Aqui se explica con una pantalla propia: que
 * se va a ver, como se puntua y contra que objetivo.
 *
 * La escala es la rubrica general de la preparacion (RUBRICA_GENERAL), la
 * misma que el cliente recibio antes de la sesion y la del modal «Criterios
 * F3M»: tres sitios que tienen que decir lo mismo.
 *
 * Solo pinta. Cuando se enseña y que pasa al pulsar lo decide app/taller.js.
 */

import { capacidadesDePreparacion, NIVELES_DE_LA_RUBRICA, QUE_MIDE, RUBRICA_GENERAL } from "../informe/preparacion.js?v=32";
import { escapeAttr, escapeHtml, formatMedia, formatNumber } from "../core/presentacion.js?v=32";


/**
 * `items` son las subcapacidades del recorrido, con `puntuada` ya resuelto;
 * `objetivos`, la media por palanca de los objetivos de sus capacidades.
 */
export function htmlDeLaApertura({ cliente = "", dominio = "", logo = "", items = [], objetivos = {}, palancas = [] }) {
  const capacidades = capacidadesDePreparacion(items);
  const puntuadas = items.filter((item) => item.puntuada).length;
  const titulo = cliente ? `Taller de ${dominio} · ${cliente}` : `Taller de ${dominio}`;

  return `
    <div class="modo-taller-cabecera modo-taller-apertura-cabecera">
      <div>
        <span class="capability-chip">Apertura del taller</span>
        <h2 id="modoTallerTitulo" tabindex="-1">${escapeHtml(titulo)}</h2>
        <p>${frase(items.length, capacidades.length, puntuadas)}</p>
      </div>
      ${logo ? `<img class="modo-taller-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(cliente ? `Logo de ${cliente}` : "Logo del cliente")}">` : ""}
    </div>

    <div class="modo-taller-cierre-columnas modo-taller-apertura-columnas">
      <section>
        <h4>Lo que vamos a ver</h4>
        <ol class="modo-taller-apertura-capacidades">
          ${capacidades.map(capacidad).join("")}
        </ol>
      </section>

      <section>
        <h4>Cómo puntuamos</h4>
        <ol class="modo-taller-apertura-escala">
          ${NIVELES_DE_LA_RUBRICA.map((nombre, posicion) => nivel(nombre, posicion, objetivos)).join("")}
        </ol>
      </section>

      <section>
        <h4>Las tres palancas</h4>
        <div class="modo-taller-apertura-palancas">
          ${palancas.map((palanca) => filaDePalanca(palanca, objetivos[palanca.key])).join("")}
        </div>
        <p class="modo-taller-apertura-nota">${notaDelObjetivo(palancas, objetivos)}</p>
      </section>
    </div>
  `;
}


function frase(total, capacidades, puntuadas) {
  const subcapacidades = total === 1 ? "una subcapacidad" : `${formatNumber(total)} subcapacidades`;
  const deCapacidades = capacidades === 1 ? "una capacidad" : `${formatNumber(capacidades)} capacidades`;
  const yaPuntuadas = puntuadas
    ? ` ${puntuadas === total ? "Todas tienen ya" : `${puntuadas === 1 ? "Una tiene" : `${formatNumber(puntuadas)} tienen`} ya`} una primera puntuación.`
    : "";

  return `Hoy repasamos <strong>${subcapacidades}</strong> en <strong>${deCapacidades}</strong>. En cada una decimos, del 1 al 5, dónde está hoy cada palanca, y lo comparamos con el objetivo.${yaPuntuadas}`;
}


/** Cada capacidad lleva a su primera subcapacidad: el cliente puede querer empezar por otra. */
function capacidad({ nombre, numero, subcapacidades }) {
  const total = subcapacidades.length;
  const puntuadas = subcapacidades.filter((item) => item.puntuada).length;
  const detalle = puntuadas
    ? `${puntuadas}/${total} puntuadas`
    : total === 1 ? "1 subcapacidad" : `${total} subcapacidades`;

  return `
    <li>
      <button type="button" data-ir="${escapeAttr(subcapacidades[0]?.id || "")}">
        <span><strong>${escapeHtml(numero)}</strong> · ${escapeHtml(nombre)}</span>
        <small>${escapeHtml(detalle)}</small>
      </button>
    </li>
  `;
}


/** Una linea por nivel, juntando lo que dice la rubrica de cada palanca. */
function nivel(nombre, posicion, objetivos) {
  const numero = posicion + 1;
  const esObjetivo = Object.values(objetivos).some((valor) => Math.round(valor) === numero);
  const descripcion = ["procesos", "tecnologia", "organizacion"]
    .map((palanca) => RUBRICA_GENERAL[palanca][posicion])
    .join(" · ");

  return `
    <li class="${esObjetivo ? "es-objetivo" : ""}">
      <b>${numero}</b>
      <div>
        <strong>${escapeHtml(nombre)}</strong>
        <span>${escapeHtml(descripcion)}</span>
      </div>
    </li>
  `;
}


function filaDePalanca(palanca, objetivo) {
  return `
    <div>
      <span class="modo-taller-punto modo-taller-punto-${escapeAttr(palanca.key)}" aria-hidden="true"></span>
      <span><strong>${escapeHtml(palanca.label)}</strong><small>${escapeHtml(QUE_MIDE[palanca.key] || "")}</small></span>
      <span class="modo-taller-apertura-objetivo">objetivo <b>${formatObjetivo(objetivo)}</b></span>
    </div>
  `;
}


/**
 * Si las tres palancas comparten un objetivo entero, se dice cual es y como se
 * llama. Si no, que cambia: decir «el objetivo es el 4» con una capacidad en 3
 * seria lo primero que el cliente pillaria en falso.
 */
function notaDelObjetivo(palancas, objetivos) {
  const valores = palancas.map((palanca) => objetivos[palanca.key]).filter(Number.isFinite);
  const comun = valores.length && valores.every((valor) => valor === valores[0]) && Number.isInteger(valores[0])
    ? valores[0]
    : null;
  const despues = "Al terminar, el cierre del taller resume lo que ha salido, y apuntamos juntos los próximos pasos.";

  if (comun) {
    return `El objetivo es el nivel ${comun}, <strong>${escapeHtml(NIVELES_DE_LA_RUBRICA[comun - 1] || "")}</strong>. ${despues}`;
  }

  return `El objetivo cambia de una capacidad a otra: cada subcapacidad lo marca encima de su nivel. ${despues}`;
}


/** Como en el cierre: un objetivo de capacidad es un entero, y uno medio puede no serlo. */
function formatObjetivo(valor) {
  if (!Number.isFinite(valor)) {
    return "—";
  }

  return Number.isInteger(valor) ? formatNumber(valor) : formatMedia(valor);
}
