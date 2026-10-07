/**
 * La pestana IA: los casos de uso de IA del modelo y la biblioteca de los
 * documentos de los que salen.
 *
 * Como el Overview, no depende del dominio abierto ni de los filtros del
 * Assessment: el catalogo es el mismo para los nueve dominios y sus filtros son
 * suyos. Por eso se pinta antes del corte de renderAll(), y por eso su nota de
 * ambito lo dice en pantalla.
 *
 * Nada de lo que ensena depende de las puntuaciones, asi que no se repinta con
 * cada score: renderAll() llega aqui muchas veces por sesion y casi nunca con
 * algo nuevo. Repintar cien fichas sin motivo le quitaba el foco a quien estaba
 * sobre un «Más información» cuando entraba un cambio de otro consultor.
 */

import {
  UNIDADES,
  aparicionesDeCasos,
  contarPorCampo,
  filtrarCasos,
  resumenDeFuentes,
  titulosDeCasos,
} from "../../core/biblioteca.js?v=23";
import { escapeAttr, escapeHtml } from "../../core/presentacion.js?v=23";
import { fuentesDelCaso } from "../biblioteca.js?v=23";
import {
  CLASES_DE_TIPO_DE_VALOR,
  aiCaseCards,
  clasesDeTipoDeIa,
  kpiCard,
} from "../celdas.js?v=23";
import { BIBLIOTECA, CASOS_DE_IA, ETIQUETAS_DE_CASOS, els } from "../estado.js?v=23";
import { comportamientoDeDesplazamiento } from "../preferencias.js?v=23";
import { getDominiosDelOverview } from "./overview.js?v=23";


const FILTROS_VACIOS = { texto: "", dominio: "", tipoValor: "", tipoIa: "", documento: "" };

/** Los filtros del catalogo. Se conservan al cambiar de pestana. */
const filtros = { ...FILTROS_VACIOS };

/** Lo que se calcula una vez por catalogo: casos, apariciones y resumen. */
let contexto = null;

let firmaDeLaVista = "";
let firmaDelCatalogo = "";


/** "a", "a y b", "a, b y c". */
function enumerar(partes) {
  if (partes.length < 2) {
    return partes.join("");
  }

  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}


function plural(cuantos, singular, pluralDe = `${singular}s`) {
  return `${cuantos} ${cuantos === 1 ? singular : pluralDe}`;
}


/**
 * Los casos del catalogo, con sus fuentes ya comprobadas contra la biblioteca.
 *
 * Comprobadas aqui y no al cargar porque la biblioteca y el catalogo llegan por
 * separado: una fuente que apunta a un documento que no ha cargado no puede
 * contar como localizada, ni ofrecerse en el filtro por documento.
 */
function prepararContexto(dominios) {
  const casos = [...CASOS_DE_IA.values()].map((caso) => ({
    ...caso,
    fuentes: fuentesDelCaso(caso),
  }));

  const apariciones = aparicionesDeCasos(dominios);

  return {
    casos,
    dominios,
    apariciones,
    resumen: resumenDeFuentes(casos),
  };
}


export function renderIa() {
  // Un index.html cacheado de antes de esta pestana no tiene estos nodos.
  if (!els.iaKpiGrid || !els.iaCatalogo) {
    return;
  }

  const dominios = getDominiosDelOverview();

  // Antes de que carguen los dominios no hay nada que contar: setupVistas()
  // repinta al arrancar, con la carga aun en marcha, y sin esto la pestana
  // ensenaba "no se ha podido leer" debajo del aviso de carga.
  if (!dominios.length) {
    return;
  }

  const firma = [
    CASOS_DE_IA.size,
    BIBLIOTECA.size,
    dominios.map((dominio) => dominio.id).join(","),
  ].join("|");

  if (firma !== firmaDeLaVista) {
    firmaDeLaVista = firma;
    firmaDelCatalogo = "";
    contexto = prepararContexto(dominios);

    pintarResumen();
    pintarBiblioteca();
    pintarLeyenda();
    pintarOpcionesDeFiltro();
  }

  pintarCatalogo();
}


function pintarResumen() {
  const { casos, dominios, apariciones, resumen } = contexto;

  const totalDeApariciones = [...apariciones.values()].reduce(
    (suma, lista) => suma + lista.length,
    0,
  );

  // Con titulosDeCasos(), la misma lectura de ai.cases que da las apariciones:
  // un ai.cases con solo separadores no puede contar como subcapacidad con casos
  // y a la vez no aportar ninguna aparicion.
  const subcapacidadesConCasos = dominios.reduce(
    (suma, dominio) =>
      suma + dominio.items.filter((item) => titulosDeCasos(item?.ai?.cases).length).length,
    0,
  );

  const dominiosConCasos = new Set(
    [...apariciones.values()].flat().map((aparicion) => aparicion.domainId),
  ).size;

  els.iaSourceNote.textContent =
    "Común a los nueve dominios: no cambia con el dominio abierto ni con los filtros del Assessment.";

  const notaDeFuentes = resumen.conFuente
    ? [
        `${resumen.exactas} en su página o diapositiva exacta`,
        resumen.aproximadas ? `${resumen.aproximadas} en la de su área` : "",
      ]
        .filter(Boolean)
        .join(" y ")
    : BIBLIOTECA.size
      ? "Ningún caso trae todavía su documento de origen"
      : "La biblioteca no ha cargado";

  els.iaKpiGrid.innerHTML = [
    kpiCard(
      "Casos de uso de IA",
      String(casos.length),
      casos.length
        ? "Cada uno con su tipo de IA y su tipo de valor"
        : "No se han podido leer las fichas de los casos",
      "neutral",
    ),
    kpiCard(
      "Apariciones en el modelo",
      String(totalDeApariciones),
      `En ${plural(subcapacidadesConCasos, "subcapacidad", "subcapacidades")} de ${plural(
        dominiosConCasos,
        "dominio",
      )}`,
      "neutral",
    ),
    kpiCard(
      "Con su fuente localizada",
      resumen.conFuente === casos.length
        ? String(resumen.conFuente)
        : `${resumen.conFuente} de ${casos.length}`,
      notaDeFuentes,
      "progress",
    ),
    kpiCard(
      "Documentos en la biblioteca",
      String(BIBLIOTECA.size),
      BIBLIOTECA.size ? extensionDeLaBiblioteca() : "No se ha podido leer la biblioteca",
      "neutral",
    ),
  ].join("");
}


/** "190 páginas y 19 diapositivas": lo que hay que leer, por unidad. */
function extensionDeLaBiblioteca() {
  const porUnidad = new Map();

  BIBLIOTECA.forEach((documento) => {
    porUnidad.set(documento.unidad, (porUnidad.get(documento.unidad) || 0) + documento.total);
  });

  return enumerar(
    [...porUnidad].map(([unidad, total]) =>
      plural(total, UNIDADES[unidad].singular, UNIDADES[unidad].plural),
    ),
  );
}


function pintarBiblioteca() {
  if (!els.iaBiblioteca) {
    return;
  }

  if (!BIBLIOTECA.size) {
    els.iaBiblioteca.innerHTML = `
      <p class="small-note biblioteca-vacia">
        No se ha podido leer la biblioteca de documentos. Los casos se siguen viendo, sin
        el enlace a su documento de origen; recarga la página para volver a intentarlo.
      </p>
    `;
    return;
  }

  els.iaBiblioteca.innerHTML = [...BIBLIOTECA.values()]
    .map((documento) => tarjetaDeDocumento(documento))
    .join("");
}


function tarjetaDeDocumento(documento) {
  const casos = contexto.resumen.porDocumento.get(documento.id) || 0;
  const unidad = UNIDADES[documento.unidad];

  const datos = [
    documento.autor,
    documento.fecha,
    documento.idioma ? `En ${documento.idioma.toLowerCase()}` : "",
    plural(documento.total, unidad.singular, unidad.plural),
  ].filter(Boolean);

  const textoDeDescarga = `Descargar el ${documento.formato}`;

  return `
    <article class="biblioteca-documento">
      <div class="biblioteca-documento-cabecera">
        <span class="biblioteca-formato" aria-hidden="true">${escapeHtml(
          documento.formato === "PowerPoint" ? "PPT" : documento.formato,
        )}</span>
        <div>
          <h4>${escapeHtml(documento.titulo)}</h4>
          <p class="biblioteca-datos">${escapeHtml(datos.join(" · "))}</p>
        </div>
      </div>

      ${
        documento.descripcion
          ? `<p class="biblioteca-descripcion">${escapeHtml(documento.descripcion)}</p>`
          : ""
      }

      <p class="biblioteca-uso">
        ${
          casos
            ? `Fuente de <strong>${casos}</strong> ${casos === 1 ? "caso" : "casos"} del catálogo`
            : "Ningún caso del catálogo apunta todavía a este documento"
        }
      </p>

      <div class="biblioteca-acciones">
        <button
          class="biblioteca-boton es-principal"
          type="button"
          data-abrir-documento="${escapeAttr(documento.id)}"
          aria-label="${escapeAttr(`Abrir ${documento.titulo} aquí`)}"
        >
          Abrir aquí
        </button>

        ${
          casos
            ? `
              <button
                class="biblioteca-boton"
                type="button"
                data-ver-casos-de="${escapeAttr(documento.id)}"
                aria-label="${escapeAttr(
                  casos === 1
                    ? `Ver el caso que sale de ${documento.titulo}`
                    : `Ver los ${casos} casos que salen de ${documento.titulo}`,
                )}"
              >
                Ver sus ${plural(casos, "caso")}
              </button>
            `
            : ""
        }

        <a
          class="biblioteca-enlace"
          href="${escapeAttr(documento.archivo)}"
          target="_blank"
          rel="noopener"
          aria-label="${escapeAttr(`Abrir ${documento.titulo} en una pestaña nueva`)}"
        >
          En una pestaña nueva
        </a>

        <a
          class="biblioteca-enlace"
          href="${escapeAttr(documento.original)}"
          download="${escapeAttr(documento.nombreDeDescarga)}"
          aria-label="${escapeAttr(`${textoDeDescarga}: ${documento.titulo}`)}"
        >
          ${escapeHtml(textoDeDescarga)}
        </a>
      </div>
    </article>
  `;
}


/**
 * Que quiere decir cada etiqueta. En una sesion, la pregunta que sigue a
 * "Agéntica" es siempre "y eso que es", y el title del chip no se ve en una
 * pantalla tactil ni proyectado.
 */
function pintarLeyenda() {
  if (!els.iaLeyenda) {
    return;
  }

  const bloque = (titulo, entradas, clases) => `
    <div class="ia-leyenda-bloque">
      <h4>${escapeHtml(titulo)}</h4>
      <dl>
        ${entradas
          .map(
            (entrada) => `
              <div>
                <dt><span class="${clases(entrada.valor)}">${escapeHtml(entrada.valor)}</span></dt>
                <dd>${escapeHtml(entrada.definicion)}</dd>
              </div>
            `,
          )
          .join("")}
      </dl>
    </div>
  `;

  els.iaLeyenda.innerHTML = [
    bloque("Tipo de valor", ETIQUETAS_DE_CASOS.tiposDeValor, () => CLASES_DE_TIPO_DE_VALOR),
    bloque("Tipo de IA", ETIQUETAS_DE_CASOS.tiposDeIa, clasesDeTipoDeIa),
  ].join("");
}


function opcion(valor, texto, cuantos) {
  const etiqueta = cuantos === undefined ? texto : `${texto} (${cuantos})`;

  return `<option value="${escapeAttr(valor)}">${escapeHtml(etiqueta)}</option>`;
}


/**
 * Las opciones de los cuatro desplegables, con cuantos casos hay detras de
 * cada una. Se cuentan sobre el catalogo entero y no sobre lo ya filtrado: si
 * el numero cambiara con cada filtro, la lista bailaria mientras se elige.
 */
function pintarOpcionesDeFiltro() {
  const { casos, dominios, apariciones, resumen } = contexto;

  const casosPorDominio = new Map();

  apariciones.forEach((lista) => {
    new Set(lista.map((aparicion) => aparicion.domainId)).forEach((domainId) => {
      casosPorDominio.set(domainId, (casosPorDominio.get(domainId) || 0) + 1);
    });
  });

  rellenar(els.iaFiltroDominio, [
    opcion("", "Todos los dominios"),
    ...dominios
      .filter((dominio) => casosPorDominio.get(dominio.id))
      .map((dominio) => opcion(dominio.id, dominio.label, casosPorDominio.get(dominio.id))),
  ]);

  const porEtiqueta = (lista, campo) => {
    const cuentas = contarPorCampo(casos, campo);
    const declarados = lista.map((entrada) => entrada.valor);

    // Primero en el orden del catalogo, y despues cualquier valor que usen los
    // casos sin estar declarado, que no deberia haber pero no se esconde.
    return [...declarados, ...[...cuentas.keys()].filter((valor) => !declarados.includes(valor))]
      .filter((valor) => cuentas.get(valor))
      .map((valor) => opcion(valor, valor, cuentas.get(valor)));
  };

  rellenar(els.iaFiltroValor, [
    opcion("", "Todos"),
    ...porEtiqueta(ETIQUETAS_DE_CASOS.tiposDeValor, "tipoValor"),
  ]);

  rellenar(els.iaFiltroTipoIa, [
    opcion("", "Todos"),
    ...porEtiqueta(ETIQUETAS_DE_CASOS.tiposDeIa, "tipoIa"),
  ]);

  rellenar(els.iaFiltroDocumento, [
    opcion("", "Todos"),
    ...[...BIBLIOTECA.values()]
      .filter((documento) => resumen.porDocumento.get(documento.id))
      .map((documento) =>
        opcion(documento.id, documento.tituloCorto, resumen.porDocumento.get(documento.id)),
      ),
  ]);

  // Un filtro que ya no tiene opcion —un dominio que no ha cargado esta vez—
  // se suelta, en vez de dejar el catalogo vacio sin que se vea por que.
  [
    [els.iaFiltroDominio, "dominio"],
    [els.iaFiltroValor, "tipoValor"],
    [els.iaFiltroTipoIa, "tipoIa"],
    [els.iaFiltroDocumento, "documento"],
  ].forEach(([select, clave]) => {
    if (select && ![...select.options].some((entrada) => entrada.value === filtros[clave])) {
      filtros[clave] = "";
    }
  });

  sincronizarControles();
}


function rellenar(select, opciones) {
  if (select) {
    select.innerHTML = opciones.join("");
  }
}


/** Los controles dicen lo que dicen los filtros, tambien cuando cambian por codigo. */
function sincronizarControles() {
  if (els.iaBuscar && els.iaBuscar.value !== filtros.texto) {
    els.iaBuscar.value = filtros.texto;
  }

  [
    [els.iaFiltroDominio, "dominio"],
    [els.iaFiltroValor, "tipoValor"],
    [els.iaFiltroTipoIa, "tipoIa"],
    [els.iaFiltroDocumento, "documento"],
  ].forEach(([select, clave]) => {
    if (select) {
      select.value = filtros[clave];
    }
  });
}


function hayFiltros() {
  // Un buscador con solo espacios no filtra, asi que tampoco cuenta.
  return Object.keys(FILTROS_VACIOS).some((clave) => String(filtros[clave]).trim() !== "");
}


/** "En 5 subcapacidades: FP&A (2), Controlling y Tesorería (2)". */
function dondeAparece(caso) {
  const lista = contexto.apariciones.get(caso.titulo) || [];

  if (!lista.length) {
    return "";
  }

  const porDominio = new Map();

  lista.forEach((aparicion) => {
    porDominio.set(aparicion.dominio, (porDominio.get(aparicion.dominio) || 0) + 1);
  });

  const dominios = [...porDominio].map(([dominio, veces]) =>
    veces > 1 ? `${dominio} (${veces})` : dominio,
  );

  return `En ${plural(lista.length, "subcapacidad", "subcapacidades")}: ${enumerar(dominios)}`;
}


function pintarCatalogo() {
  if (!contexto || !els.iaCatalogo) {
    return;
  }

  const firma = `${firmaDeLaVista}|${JSON.stringify(filtros)}`;

  if (firma === firmaDelCatalogo) {
    return;
  }

  firmaDelCatalogo = firma;

  const { casos, apariciones } = contexto;

  if (!casos.length) {
    els.iaCatalogoRecuento.textContent = "";
    els.iaCatalogo.innerHTML = `
      <p class="small-note">
        No se han podido leer las fichas de los casos de uso de IA. Recarga la página para
        volver a intentarlo.
      </p>
    `;
    return;
  }

  const visibles = filtrarCasos(casos, filtros, apariciones);
  const filtrado = hayFiltros();

  els.iaCatalogoRecuento.innerHTML = filtrado
    ? `
      <span>Mostrando ${visibles.length} de ${plural(casos.length, "caso")}</span>
      <button class="clear-filters-button" type="button" data-limpiar-filtros-ia>
        Limpiar filtros
      </button>
    `
    : `<span>${plural(casos.length, "caso")}, en el orden del catálogo</span>`;

  els.iaCatalogo.innerHTML = visibles.length
    ? aiCaseCards(visibles, { donde: dondeAparece })
    : `
      <div class="filtered-empty-state">
        <strong>Ningún caso cumple estos filtros</strong>
        <p>Prueba con otras palabras o quita algún filtro para volver a ver el catálogo.</p>
        <button
          class="clear-filters-button empty-state-clear-button"
          type="button"
          data-limpiar-filtros-ia
        >
          Limpiar filtros
        </button>
      </div>
    `;
}


function limpiarFiltros() {
  Object.assign(filtros, FILTROS_VACIOS);
  sincronizarControles();
  pintarCatalogo();
}


/**
 * "Ver sus N casos" desde la tarjeta de un documento: el catalogo filtrado por
 * ese documento, y nada mas, para que se vean exactamente los que promete.
 */
function verCasosDe(documentoId) {
  Object.assign(filtros, FILTROS_VACIOS, { documento: documentoId });
  sincronizarControles();
  pintarCatalogo();

  // El foco va al titulo del catalogo: sin esto, quien navega con teclado se
  // queda en la tarjeta del documento y no se entera de que algo ha cambiado
  // mas abajo.
  els.iaCatalogoTitulo?.focus({ preventScroll: true });
  els.iaCatalogoTitulo?.scrollIntoView({ behavior: comportamientoDeDesplazamiento(), block: "start" });
}


export function setupVistaIa() {
  const seccion = document.getElementById("ia");

  if (!seccion) {
    return;
  }

  els.iaBuscar?.addEventListener("input", () => {
    filtros.texto = els.iaBuscar.value;
    pintarCatalogo();
  });

  [
    [els.iaFiltroDominio, "dominio"],
    [els.iaFiltroValor, "tipoValor"],
    [els.iaFiltroTipoIa, "tipoIa"],
    [els.iaFiltroDocumento, "documento"],
  ].forEach(([select, clave]) => {
    select?.addEventListener("change", () => {
      filtros[clave] = select.value;
      pintarCatalogo();
    });
  });

  seccion.addEventListener("click", (event) => {
    const verCasos = event.target.closest("[data-ver-casos-de]");

    if (verCasos) {
      verCasosDe(verCasos.dataset.verCasosDe);
      return;
    }

    if (event.target.closest("[data-limpiar-filtros-ia]")) {
      limpiarFiltros();
      els.iaBuscar?.focus();
    }
  });
}
