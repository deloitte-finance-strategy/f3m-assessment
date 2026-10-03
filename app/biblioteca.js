/**
 * La biblioteca de IA dentro de la aplicacion: cargar los documentos y el visor
 * que abre «Más información».
 *
 * El visor ensena el documento dentro de la herramienta, en la pagina exacta
 * del caso, y deja abrirlo entero o descargarlo. Va dentro y no en una pestana
 * nueva porque se usa delante del cliente: salir de la herramienta a un PDF de
 * 190 paginas y volver es justo el tipo de interrupcion que rompe una sesion.
 *
 * Lo pinta el visor de PDF del propio navegador en un iframe, y no una libreria:
 * pdf.js serian mas de un megabyte vendorizado y un worker, para ensenar algo
 * que Chrome, Edge y Firefox ya saben ensenar. La CSP no cambia por ello: el
 * iframe carga un PDF del mismo origen, que default-src 'self' ya permite, y el
 * object-src 'none' no lo frena —comprobado en Chromium—. Donde el navegador no
 * sabe ensenar PDF dentro de la pagina, se dice y se ofrece abrirlo o bajarlo.
 *
 * Que se pueda cargar, pintar y abrir sin la biblioteca no es casualidad: sin
 * ella, las fichas salen sin «Más información» y el resto sigue igual.
 */

import {
  etiquetaDeFuente,
  fuentesDeCaso,
  normalizarBiblioteca,
  ubicacionDeFuente,
  urlDeDocumento,
} from "../core/biblioteca.js?v=16";
import { escapeAttr, escapeHtml } from "../core/presentacion.js?v=16";
import {
  SELECTOR_DE_MODAL_ABIERTO,
  atraparFoco,
  showNotice,
  updateModalOpenState,
} from "./avisos.js?v=16";
import { BIBLIOTECA, BIBLIOTECA_URL, CASOS_DE_IA, els } from "./estado.js?v=16";


/**
 * Lee data/biblioteca.json.
 *
 * Lanza si no puede, como cargarCatalogoDeCasosDeIa(), y quien llama decide:
 * sin biblioteca la herramienta arranca igual.
 */
export async function cargarBiblioteca() {
  const response = await fetch(BIBLIOTECA_URL);

  if (!response.ok) {
    throw new Error(`No se ha podido leer ${BIBLIOTECA_URL}: ${response.status}`);
  }

  const documentos = normalizarBiblioteca(await response.json());

  BIBLIOTECA.clear();
  documentos.forEach((documento, id) => BIBLIOTECA.set(id, documento));
}


/** Las fuentes de un caso que se pueden abrir con la biblioteca que hay. */
export function fuentesDelCaso(caso) {
  return fuentesDeCaso(caso, BIBLIOTECA);
}


/**
 * El pie de una ficha de caso: donde esta en la biblioteca y el boton que lo
 * abre. Vacio si no hay fuente que abrir.
 *
 * El nombre accesible dice el caso y el sitio: en una lista de cien fichas, cien
 * botones que se anuncian todos como "Más información" no distinguen nada.
 */
export function pieDeFuente(caso) {
  const [fuente] = fuentesDelCaso(caso);

  // Sin el visor en la pagina —un index.html cacheado de antes— el boton no
  // abriria nada, y un boton que no responde delante del cliente es peor que
  // no tenerlo.
  if (!fuente || !caso?.id || !els.visorDocumento) {
    return "";
  }

  const documento = BIBLIOTECA.get(fuente.documento);
  const nombre =
    `Más información sobre «${caso.titulo}»: ${documento.titulo}, ` +
    ubicacionDeFuente(fuente, documento).toLowerCase();

  return `
    <div class="ai-case-fuente">
      <span class="ai-case-fuente-texto">${escapeHtml(etiquetaDeFuente(fuente, documento))}</span>
      <button
        class="ai-case-mas-info"
        type="button"
        data-mas-informacion="${escapeAttr(caso.id)}"
        aria-label="${escapeAttr(nombre)}"
      >
        Más información
      </button>
    </div>
  `;
}


/* ------------------------------------------------------------------- visor */


/** Quien abrio el visor, para devolverle el foco al cerrar. */
let disparadorDelVisor = null;

/** El caso que se esta ensenando, si se abrio desde una ficha. */
let casoDelVisor = null;

/** Las fuentes entre las que se puede saltar dentro del visor. */
let fuentesDelVisor = [];

/** Los modales que quedan debajo del visor, que se dejan inertes mientras. */
let modalesDebajo = [];


function casoPorId(id) {
  for (const caso of CASOS_DE_IA.values()) {
    if (caso.id === id) {
      return caso;
    }
  }

  return null;
}


export function setupVisorDeDocumentos() {
  if (!els.visorDocumento) {
    return;
  }

  // Delegado en el documento: los botones viven en fichas que se repintan —la
  // tarjeta de assessment, el modal del roadmap, la pestana IA— y engancharlos
  // uno a uno obligaria a cada vista a acordarse de hacerlo.
  document.addEventListener("click", (event) => {
    const masInformacion = event.target.closest("[data-mas-informacion]");

    if (masInformacion) {
      abrirFuenteDeCaso(masInformacion.dataset.masInformacion, masInformacion);
      return;
    }

    const abrir = event.target.closest("[data-abrir-documento]");

    if (abrir) {
      abrirDocumento(abrir.dataset.abrirDocumento, abrir);
    }
  });

  els.visorCerrar?.addEventListener("click", cerrarVisor);

  els.visorDocumento.addEventListener("click", (event) => {
    if (event.target === els.visorDocumento) {
      cerrarVisor();
      return;
    }

    const otraFuente = event.target.closest("[data-fuente-del-visor]");

    if (otraFuente) {
      const indice = Number(otraFuente.dataset.fuenteDelVisor);

      mostrarFuente(indice);

      // El contexto se pinta de nuevo entero, y el boton pulsado con el: sin
      // esto el foco caia al <body> y, con teclado, habia que volver a buscar
      // dentro del visor desde el principio.
      els.visorContexto?.querySelector(`[data-fuente-del-visor="${indice}"]`)?.focus();
    }
  });

  // En captura y parando la propagacion: el visor se abre encima del modal de
  // la iniciativa de IA, que escucha las mismas teclas en el documento. Sin
  // esto, un Escape cerraba los dos de golpe y el Tab saltaba al de debajo.
  document.addEventListener(
    "keydown",
    (event) => {
      if (els.visorDocumento.hidden) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cerrarVisor();
        return;
      }

      if (event.key === "Tab") {
        event.stopPropagation();
        atraparFoco(event, els.visorDocumento);
      }
    },
    true,
  );
}


function abrirFuenteDeCaso(idDeCaso, disparador) {
  const caso = casoPorId(idDeCaso);
  const fuentes = caso ? fuentesDelCaso(caso) : [];

  if (!fuentes.length) {
    // No deberia pasar: el boton solo se pinta si hay fuente. Pero si la ficha
    // se pinto con una biblioteca y ahora hay otra, se dice en vez de no hacer
    // nada, que delante del cliente parece un boton roto.
    showNotice("No se ha encontrado la fuente de este caso en la biblioteca.", "aviso");
    return;
  }

  casoDelVisor = caso;
  fuentesDelVisor = fuentes;
  abrirVisor(disparador);
  mostrarFuente(0);
}


function abrirDocumento(idDeDocumento, disparador) {
  const documento = BIBLIOTECA.get(idDeDocumento);

  if (!documento) {
    showNotice("No se ha encontrado este documento en la biblioteca.", "aviso");
    return;
  }

  casoDelVisor = null;
  fuentesDelVisor = [
    { documento: documento.id, pagina: 1, hasta: 1, texto: "", alcance: "caso", nota: "" },
  ];
  abrirVisor(disparador);
  mostrarFuente(0);
}


function abrirVisor(disparador) {
  // Si ya estaba abierto —se ha pulsado otra fuente desde dentro— se conserva
  // quien lo abrio la primera vez, que es a quien hay que volver.
  if (els.visorDocumento.hidden) {
    disparadorDelVisor = disparador;

    modalesDebajo = [...document.querySelectorAll(SELECTOR_DE_MODAL_ABIERTO)].filter(
      (modal) => modal !== els.visorDocumento,
    );

    modalesDebajo.forEach((modal) => {
      modal.inert = true;
    });
  }

  els.visorDocumento.hidden = false;
  updateModalOpenState();
  els.visorCerrar?.focus();
}


function cerrarVisor() {
  els.visorDocumento.hidden = true;

  // Fuera el iframe: un PDF de 190 paginas no tiene por que seguir en memoria
  // con el visor cerrado, y al volver a abrirlo se navega de cero a su pagina.
  els.visorMarco?.replaceChildren();

  modalesDebajo.forEach((modal) => {
    modal.inert = false;
  });

  modalesDebajo = [];

  // Antes de devolver el foco: mientras hay un modal abierto el fondo esta
  // inerte, y un elemento inerte no puede recibirlo.
  updateModalOpenState();

  if (disparadorDelVisor?.isConnected) {
    disparadorDelVisor.focus();
  }

  disparadorDelVisor = null;
  casoDelVisor = null;
  fuentesDelVisor = [];
}


function mostrarFuente(indice) {
  const fuente = fuentesDelVisor[indice];
  const documento = fuente && BIBLIOTECA.get(fuente.documento);

  if (!documento) {
    return;
  }

  els.visorAntetitulo.textContent = casoDelVisor ? "Fuente del caso de uso" : "Biblioteca de IA";
  els.visorTitulo.textContent = documento.titulo;
  els.visorDatos.textContent = [
    documento.autor,
    documento.fecha,
    documento.idioma ? `En ${documento.idioma.toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  els.visorContexto.hidden = !casoDelVisor;
  els.visorContexto.innerHTML = casoDelVisor
    ? contextoDelCaso(casoDelVisor, fuente, documento, indice)
    : "";

  pintarMarco(documento, fuente);

  const direccion = urlDeDocumento(documento, fuente.pagina);

  els.visorAbrir.href = direccion;
  els.visorDescargar.href = documento.original;
  els.visorDescargar.setAttribute("download", documento.nombreDeDescarga);
  els.visorDescargar.textContent = `Descargar el ${documento.formato}`;
}


/**
 * Lo que hay que saber antes de mirar la pagina: que caso es, donde esta, como
 * se llama en el documento y si la referencia es exacta o de su area.
 *
 * El "como se llama en el documento" no es decoracion. Los documentos estan en
 * ingles y una diapositiva del FinanceAI lleva veinte casos: sin el texto
 * exacto, encontrar el que se busca es leerla entera delante del cliente.
 */
function contextoDelCaso(caso, fuente, documento, indice) {
  const aproximada = fuente.alcance === "area";

  const otras = fuentesDelVisor.length > 1
    ? `
      <div class="visor-otras-fuentes" role="group" aria-label="Otras fuentes del caso">
        <span>También en:</span>
        ${fuentesDelVisor
          .map((otra, posicion) => {
            const suDocumento = BIBLIOTECA.get(otra.documento);
            const actual = posicion === indice;

            return `
              <button
                class="visor-fuente-boton"
                type="button"
                data-fuente-del-visor="${posicion}"
                aria-pressed="${actual}"
              >
                ${escapeHtml(etiquetaDeFuente(otra, suDocumento))}
              </button>
            `;
          })
          .join("")}
      </div>
    `
    : "";

  return `
    <p class="visor-caso-titulo">${escapeHtml(caso.titulo)}</p>
    <p class="visor-caso-ubicacion">
      <strong>${escapeHtml(ubicacionDeFuente(fuente, documento))}</strong>
      ${
        fuente.texto
          ? `<span>${aproximada ? "Área" : "En el documento"}: «<span lang="en">${escapeHtml(fuente.texto)}</span>»</span>`
          : ""
      }
    </p>
    ${
      aproximada
        ? `<p class="visor-caso-nota es-aproximada"><strong>Referencia aproximada.</strong> ${escapeHtml(fuente.nota)}</p>`
        : fuente.nota
          ? `<p class="visor-caso-nota">${escapeHtml(fuente.nota)}</p>`
          : ""
    }
    ${otras}
  `;
}


/**
 * El documento, en un iframe nuevo cada vez.
 *
 * Nuevo y no reutilizado: cambiar solo el #page= de un iframe que ya tiene el
 * PDF es una navegacion dentro del documento, y no todos los visores la
 * siguen. Con un iframe nuevo, cada fuente se abre en su pagina siempre.
 */
function pintarMarco(documento, fuente) {
  if (!els.visorMarco) {
    return;
  }

  // navigator.pdfViewerEnabled lo dan Chrome, Edge, Firefox y Safari recientes.
  // Solo se cree un "no" explicito: si el navegador no lo dice, se intenta.
  //
  // Un "no" suele ser una configuracion del equipo que manda descargar los PDF
  // en vez de ensenarlos, y entonces la pestana nueva tambien lo descarga, y sin
  // ir a la pagina. Por eso aqui no se promete la pagina: se remite al recuadro
  // de arriba, que dice donde esta el caso y como se llama en el documento.
  if (navigator.pdfViewerEnabled === false) {
    els.visorMarco.innerHTML = `
      <div class="visor-sin-pdf">
        <strong>Este navegador no enseña los PDF dentro de la página.</strong>
        <p>${
          casoDelVisor
            ? "Ábrelo o descárgalo con los enlaces de abajo. Arriba tienes dónde está el caso y cómo se llama en el documento."
            : "Ábrelo o descárgalo con los enlaces de abajo."
        }</p>
      </div>
    `;
    return;
  }

  const marco = document.createElement("iframe");

  marco.className = "visor-iframe";
  marco.title = `${documento.titulo}, ${ubicacionDeFuente(fuente, documento).toLowerCase()}`;
  marco.src = urlDeDocumento(documento, fuente.pagina);

  els.visorMarco.replaceChildren(marco);
}
