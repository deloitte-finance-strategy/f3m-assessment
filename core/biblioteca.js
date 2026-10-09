/**
 * La biblioteca de IA: los documentos de los que salen los casos de uso, donde
 * esta cada caso dentro de ellos, y el catalogo que se consulta en la pestana IA.
 *
 * Funciones puras, como todo core/: entra el JSON de data/biblioteca.json y de
 * data/casos-ia.json, y salen referencias ya comprobadas, etiquetas y filtros.
 * La aplicacion pinta; aqui se decide.
 *
 * Lo que mas importa de este modulo es que una referencia rota no llegue a la
 * pantalla. Un «Más información» que abre la pagina equivocada —o una que no
 * existe— es peor que no tener boton: delante del cliente, el consultor confia
 * en que lo que se abre es la fuente del caso. Por eso normalizarFuente() es
 * estricta y descarta en vez de corregir, y por eso check_domains_sync.py
 * comprueba lo mismo en el CI: aqui se protege la pantalla y alli se avisa de
 * que algo se ha roto.
 */

import { normalizeMatchKey } from "./coincidencias.js?v=31";


/**
 * Como se nombra la unidad de cada documento.
 *
 * Un PDF tiene paginas y un PowerPoint diapositivas, aunque los dos se vean en
 * PDF dentro de la herramienta. Decir "pagina 9" de una presentacion obliga a
 * quien la tiene abierta en PowerPoint a traducir, y en una sesion no hay tiempo.
 */
export const UNIDADES = {
  pagina: { singular: "página", plural: "páginas", abreviatura: "p." },
  diapositiva: { singular: "diapositiva", plural: "diapositivas", abreviatura: "diap." },
};


/** Ids de documento: minusculas, cifras y guiones. Van en atributos data-. */
const ID_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;


/**
 * La ruta de un archivo de la biblioteca, si es segura.
 *
 * Tiene que ser relativa y quedarse dentro de biblioteca/: el visor la pone en
 * el src de un iframe, y una ruta que saliera de ahi —o un "javascript:" que se
 * colara en el JSON— seria una forma de cargar lo que no es un documento. La
 * CSP ya lo frenaria, pero la primera barrera es no construir esa URL.
 */
function rutaDeBiblioteca(valor) {
  const ruta = String(valor ?? "").trim();

  if (!/^biblioteca\/[A-Za-z0-9._-]+$/.test(ruta) || ruta.includes("..")) {
    return "";
  }

  return ruta;
}


function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}


function enteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}


/**
 * Un documento de data/biblioteca.json, o null si no se puede ensenar.
 *
 * Lo imprescindible es poder abrirlo: un id, un titulo, una unidad conocida, el
 * numero de paginas y un PDF dentro de biblioteca/. 'archivo' tiene que ser PDF
 * porque es lo unico que el navegador sabe ensenar dentro de la pagina; el
 * original, si es otra cosa, va aparte y es lo que se descarga.
 */
export function normalizarDocumento(entrada) {
  if (!entrada || typeof entrada !== "object") {
    return null;
  }

  const id = texto(entrada.id);
  const titulo = texto(entrada.titulo);
  const archivo = rutaDeBiblioteca(entrada.archivo);
  const total = enteroPositivo(entrada.total);

  if (
    !ID_VALIDO.test(id) ||
    !titulo ||
    !archivo.toLowerCase().endsWith(".pdf") ||
    !UNIDADES[entrada.unidad] ||
    !total
  ) {
    return null;
  }

  const original = rutaDeBiblioteca(entrada.original) || archivo;

  return {
    id,
    titulo,
    tituloCorto: texto(entrada.tituloCorto) || titulo,
    autor: texto(entrada.autor),
    fecha: texto(entrada.fecha),
    idioma: texto(entrada.idioma),
    formato: texto(entrada.formato) || "PDF",
    unidad: entrada.unidad,
    total,
    archivo,
    original,
    nombreDeDescarga: texto(entrada.nombreDeDescarga) || original.split("/").pop(),
    descripcion: texto(entrada.descripcion),
  };
}


/**
 * Los documentos de la biblioteca, por id y en el orden del archivo.
 *
 * Un documento que no se puede ensenar se salta, y un id repetido se queda con
 * el primero: dos documentos con el mismo id harian que un caso abriera uno u
 * otro segun el orden de carga.
 */
export function normalizarBiblioteca(json) {
  const documentos = new Map();

  (Array.isArray(json?.documentos) ? json.documentos : []).forEach((entrada) => {
    const documento = normalizarDocumento(entrada);

    if (documento && !documentos.has(documento.id)) {
      documentos.set(documento.id, documento);
    }
  });

  return documentos;
}


/**
 * Una fuente de un caso, o null si no lleva a ningun sitio.
 *
 * Se descarta, no se corrige: una pagina fuera de rango no se "ajusta" a la
 * ultima, porque abriria una pagina que no tiene nada que ver con el caso y el
 * consultor no tendria forma de saberlo.
 */
export function normalizarFuente(entrada, documentos) {
  if (!entrada || typeof entrada !== "object") {
    return null;
  }

  const documento = documentos?.get(texto(entrada.documento));
  const pagina = enteroPositivo(entrada.pagina);

  if (!documento || !pagina || pagina > documento.total) {
    return null;
  }

  const hasta = enteroPositivo(entrada.hasta);

  return {
    documento: documento.id,
    pagina,
    // Un 'hasta' que no cuadra se ignora y la fuente se queda en su pagina: la
    // primera sigue siendo cierta aunque el rango no lo sea.
    hasta: hasta && hasta > pagina && hasta <= documento.total ? hasta : pagina,
    texto: texto(entrada.texto),
    alcance: entrada.alcance === "area" ? "area" : "caso",
    nota: texto(entrada.nota),
  };
}


/** Las fuentes de un caso que llevan a algun sitio, en el orden en que vienen. */
export function fuentesDeCaso(caso, documentos) {
  return (Array.isArray(caso?.fuentes) ? caso.fuentes : [])
    .map((entrada) => normalizarFuente(entrada, documentos))
    .filter(Boolean);
}


/** "7", "7-8" o "7-9": las paginas de una fuente, para una etiqueta corta. */
export function rangoDePaginas(fuente) {
  return fuente.hasta > fuente.pagina
    ? `${fuente.pagina}–${fuente.hasta}`
    : String(fuente.pagina);
}


/**
 * Donde esta una fuente, en una frase: "Páginas 7 y 8 de 190".
 *
 * Con el total delante para que se sepa en que parte del documento se esta, que
 * en uno de 190 paginas no es un detalle.
 */
export function ubicacionDeFuente(fuente, documento) {
  const unidad = UNIDADES[documento.unidad];
  const deTotal = `de ${documento.total}`;

  if (fuente.hasta === fuente.pagina) {
    return `${mayuscula(unidad.singular)} ${fuente.pagina} ${deTotal}`;
  }

  const enlace = fuente.hasta === fuente.pagina + 1 ? "y" : "a";

  return `${mayuscula(unidad.plural)} ${fuente.pagina} ${enlace} ${fuente.hasta} ${deTotal}`;
}


/**
 * La etiqueta corta de una fuente: "The AI Dossier · p. 7–8".
 *
 * La de un area lo dice: es una referencia aproximada y no puede leerse igual
 * que una que lleva al caso exacto.
 */
export function etiquetaDeFuente(fuente, documento) {
  const unidad = UNIDADES[documento.unidad];
  const partes = [documento.tituloCorto, `${unidad.abreviatura} ${rangoDePaginas(fuente)}`];

  if (fuente.alcance === "area") {
    partes.push("área");
  }

  return partes.join(" · ");
}


/**
 * La direccion del documento abierto en la pagina de la fuente.
 *
 * #page= es el parametro de apertura de PDF que entienden el visor de Chrome y
 * Edge y el de Firefox. Se probaron tambien view=Fit y zoom=page-fit: Chrome los
 * ignora y la pagina ya entra entera en el visor, asi que no se anaden.
 */
export function urlDeDocumento(documento, pagina = 1) {
  const destino = enteroPositivo(pagina) && pagina <= documento.total ? pagina : 1;

  return `${documento.archivo}#page=${destino}`;
}


function mayuscula(cadena) {
  return cadena.charAt(0).toUpperCase() + cadena.slice(1);
}


/**
 * Texto para buscar: sin tildes, en minusculas y con los espacios juntos.
 *
 * Buscar "prevision" tiene que encontrar "Previsión": en una sesion se teclea
 * deprisa y sin tildes, y un buscador que no encuentra lo que esta en pantalla
 * parece roto.
 *
 * Es la clave con la que se reconoce el trabajo guardado, normalizeMatchKey(),
 * con los espacios de dentro juntos: dos formas de quitar tildes acaban
 * quitando cosas distintas.
 */
export function normalizarTextoDeBusqueda(valor) {
  return normalizeMatchKey(String(valor ?? "")).replace(/\s+/g, " ");
}


/** Los titulos de un campo ai.cases, que es una lista separada por ';'. */
export function titulosDeCasos(cadena) {
  return String(cadena ?? "")
    .split(";")
    .map((titulo) => titulo.trim())
    .filter(Boolean);
}


/**
 * Donde aparece cada caso: titulo -> subcapacidades, con su dominio.
 *
 * Recibe los dominios como los da getDominiosDelOverview(): [{ id, label, items }].
 * Un caso puede aparecer varias veces en el mismo dominio, en subcapacidades
 * distintas, y cada aparicion cuenta: es justo lo que el consultor necesita ver
 * al filtrar por dominio.
 */
export function aparicionesDeCasos(dominios) {
  const apariciones = new Map();

  (dominios || []).forEach((dominio) => {
    (dominio.items || []).forEach((item) => {
      titulosDeCasos(item?.ai?.cases).forEach((titulo) => {
        if (!apariciones.has(titulo)) {
          apariciones.set(titulo, []);
        }

        apariciones.get(titulo).push({
          domainId: dominio.id,
          dominio: dominio.label || dominio.id,
          capacidad: item.capacidad || "",
          subcapacidad: item.subcapacidad || "",
          // La subcapacidad entera, para pedirle sus metricas al motor cuando
          // el catalogo se ordena por las brechas del cliente.
          item,
        });
      });
    });
  });

  return apariciones;
}


/**
 * Las brechas del cliente que ataca cada caso: cuantas de las subcapacidades
 * en las que aparece tienen prioridad alta, media o baja, y cuanto suman sus
 * gaps. Lo que esta sin puntuar no cuenta: no se inventa una brecha que nadie
 * ha medido.
 *
 * 'metricasDe' recibe una aparicion y devuelve sus metricas. Se inyecta porque
 * el objetivo de cada subcapacidad depende de su dominio y de lo que el equipo
 * haya ajustado, y eso lo sabe la aplicacion, no el catalogo. Con 'dominio',
 * solo cuentan las apariciones de ese dominio: con el filtro de dominio puesto,
 * una brecha de otro dominio no explica por que un caso va primero.
 */
export function brechasDeCasos(apariciones, metricasDe, dominio = "") {
  const brechas = new Map();

  (apariciones || new Map()).forEach((lista, titulo) => {
    const cuenta = { altas: 0, medias: 0, bajas: 0, gap: 0 };

    lista.forEach((aparicion) => {
      if (dominio && aparicion.domainId !== dominio) {
        return;
      }

      const metricas = metricasDe(aparicion);

      if (!metricas || metricas.isPending) {
        return;
      }

      if (metricas.prioridad === "Alta") cuenta.altas += 1;
      else if (metricas.prioridad === "Media") cuenta.medias += 1;
      else if (metricas.prioridad === "Baja") cuenta.bajas += 1;

      cuenta.gap += Number.isFinite(metricas.gap) ? metricas.gap : 0;
    });

    brechas.set(titulo, cuenta);
  });

  return brechas;
}


/**
 * Los casos por las brechas que atacan: primero los que tienen mas
 * subcapacidades de prioridad alta detras, luego media, y a igualdad, mas gap
 * acumulado. Lo que empata del todo —tambien todo lo que no ataca nada
 * puntuado— conserva el orden en que llego, asi que sin nada puntuado el
 * resultado es el orden de partida.
 */
export function ordenarPorBrechas(casos, brechas) {
  const vacio = { altas: 0, medias: 0, bajas: 0, gap: 0 };

  return (casos || [])
    .map((caso, indice) => ({ caso, indice, brecha: brechas.get(caso.titulo) || vacio }))
    .sort(
      (a, b) =>
        b.brecha.altas - a.brecha.altas ||
        b.brecha.medias - a.brecha.medias ||
        b.brecha.gap - a.brecha.gap ||
        a.indice - b.indice,
    )
    .map(({ caso }) => caso);
}


/**
 * "Ataca 2 brechas altas y 1 media". Vacio si no ataca nada puntuado con
 * prioridad alta o media: una brecha baja no es lo que se viene a contar.
 */
export function textoDeBrechas(brecha) {
  const altas = brecha?.altas || 0;
  const medias = brecha?.medias || 0;

  if (!altas && !medias) {
    return "";
  }

  const partes = [];

  if (altas) {
    partes.push(`${altas} ${altas === 1 ? "brecha alta" : "brechas altas"}`);
  }

  if (medias) {
    const nombre = altas
      ? (medias === 1 ? "media" : "medias")
      : (medias === 1 ? "brecha media" : "brechas medias");

    partes.push(`${medias} ${nombre}`);
  }

  return `Ataca ${partes.join(" y ")}`;
}


/**
 * Los casos que pasan los filtros del catalogo, en el orden en que vienen.
 *
 * Los filtros vacios no filtran. El texto se busca en el titulo, la descripcion,
 * las dos etiquetas, el id y el texto de las fuentes, que esta en ingles: quien
 * recuerda el caso por como se llama en el documento tambien tiene que poder
 * encontrarlo.
 */
export function filtrarCasos(casos, filtros = {}, apariciones = new Map()) {
  const buscado = normalizarTextoDeBusqueda(filtros.texto);

  return (casos || []).filter((caso) => {
    if (filtros.tipoIa && caso.tipoIa !== filtros.tipoIa) {
      return false;
    }

    if (filtros.tipoValor && caso.tipoValor !== filtros.tipoValor) {
      return false;
    }

    if (
      filtros.documento &&
      !(caso.fuentes || []).some((fuente) => fuente.documento === filtros.documento)
    ) {
      return false;
    }

    if (
      filtros.dominio &&
      !(apariciones.get(caso.titulo) || []).some(
        (aparicion) => aparicion.domainId === filtros.dominio,
      )
    ) {
      return false;
    }

    if (!buscado) {
      return true;
    }

    const pajar = normalizarTextoDeBusqueda(
      [
        caso.id,
        caso.titulo,
        caso.descripcion,
        caso.tipoIa,
        caso.tipoValor,
        ...(caso.fuentes || []).map((fuente) => fuente.texto),
      ].join(" "),
    );

    return pajar.includes(buscado);
  });
}


/**
 * Cuantos casos hay por cada valor de un campo, para las opciones de un filtro.
 *
 * Con un Map y no un objeto para conservar el orden de aparicion, que es el del
 * catalogo.
 */
export function contarPorCampo(casos, campo) {
  const cuentas = new Map();

  (casos || []).forEach((caso) => {
    const valor = caso[campo];

    if (valor) {
      cuentas.set(valor, (cuentas.get(valor) || 0) + 1);
    }
  });

  return cuentas;
}


/**
 * De cuantos casos se sabe la fuente, y con que precision.
 *
 * La precision mira la primera fuente, que es la que abre «Más información».
 *
 * 'porDocumento' cuenta, en cambio, los casos que citan cada documento en
 * cualquiera de sus fuentes: es el numero que promete la tarjeta del documento
 * en la biblioteca ("Ver sus 39 casos"), y tiene que coincidir con lo que
 * ensena el filtro por documento, que mira todas.
 */
export function resumenDeFuentes(casos) {
  const resumen = { total: 0, conFuente: 0, exactas: 0, aproximadas: 0, porDocumento: new Map() };

  (casos || []).forEach((caso) => {
    resumen.total += 1;

    const fuentes = caso.fuentes || [];
    const [primera] = fuentes;

    if (!primera) {
      return;
    }

    resumen.conFuente += 1;
    resumen[primera.alcance === "area" ? "aproximadas" : "exactas"] += 1;

    // Un caso con dos fuentes en el mismo documento cuenta una vez.
    new Set(fuentes.map((fuente) => fuente.documento)).forEach((documento) => {
      resumen.porDocumento.set(documento, (resumen.porDocumento.get(documento) || 0) + 1);
    });
  });

  return resumen;
}
