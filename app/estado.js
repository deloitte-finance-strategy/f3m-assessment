/**
 * El estado que comparte toda la aplicacion, y las constantes que lo describen.
 *
 * Esto NO es `core/`: aqui si hay estado, y es mutable a proposito. La frontera
 * de `core/` sigue donde estaba —alli no hay DOM, ni Firebase, ni estado— y este
 * modulo esta del otro lado.
 *
 * Todo lo que se exporta de aqui es un objeto o una coleccion, nunca un valor
 * suelto, y no es casualidad: en modulos ES se puede LEER lo que otro modulo
 * exporta, pero no se le puede asignar. `state.activeDomainId = "fiscal"` vale
 * desde cualquier sitio; `vistaActiva = "roadmap"` no compila. Los valores
 * sueltos que de verdad cambian viven en el modulo que los gobierna y salen por
 * una funcion de lectura.
 */

import { PALANCAS } from "../core/calculo.js?v=12";
import { ESTADOS_VALIDOS } from "../core/escenario.js?v=12";
import { COLOR_DE_PALANCA } from "../core/presentacion.js?v=12";


export const DEFAULT_DOMAIN_ID = "fpa";

export const CATALOGO_URL = "data/domains.json";
export const CASOS_DE_IA_URL = "data/casos-ia.json";


/**
 * El catalogo de dominios, indexado por id. Se llena al arrancar desde
 * data/domains.json, que es la fuente unica de la lista.
 */
export const DOMAINS = {};

/** Los grupos del conmutador, en el orden en que los declara el catalogo. */
export const GRUPOS_DE_DOMINIO = [];

/**
 * Las fichas de los 100 casos de uso de IA, indexadas por su titulo.
 *
 * El titulo es la clave del cruce y coincide exactamente con el del catalogo.
 * Que siga coincidiendo lo comprueba scripts/check_domains_sync.py en cada PR,
 * en las dos direcciones.
 *
 * Se carga una sola vez y se cruza al pintar. La alternativa era meter la ficha
 * dentro de cada subcapacidad al convertir los Excel, y serian 413 copias de
 * 100 fichas repartidas por los nueve archivos de datos.
 */
export const CASOS_DE_IA = new Map();


// Las palancas las define el motor; aqui solo se les pone el color de marca.
export const LEVERS = PALANCAS.map((palanca) => ({
  ...palanca,
  color: COLOR_DE_PALANCA[palanca.key],
}));

// Los estados y los limites de longitud de los campos editables los define el
// contrato del escenario, que es el espejo de database.rules.json.
export const STATUS_OPTIONS = ESTADOS_VALIDOS;


/** El dominio abierto y sus subcapacidades. Se muta en el sitio. */
export const state = {
  activeDomainId: DEFAULT_DOMAIN_ID,
  domains: {},
  meta: null,
  items: [],
  targets: {},
};


/** Los nodos del DOM que se usan mas de una vez. Los llena cacheElements(). */
export const els = {};


/** Que capacidades del heatmap estan desplegadas, entre repintados. */
export const expandedHeatmapCapabilities = new Set();

/**
 * Que tarjetas tienen desplegado "Ver detalle". Cada repintado de la lista las
 * reconstruye desde la plantilla, con el detalle cerrado: quien abria los
 * niveles de madurez para decidir entre un 3 y un 4 se los encontraba cerrados
 * justo despues de puntuar.
 */
export const tarjetasConDetalleAbierto = new Set();


/**
 * El identificador del escenario compartido, leido de la URL.
 *
 * Se permiten letras, numeros, guiones y guiones bajos, para evitar rutas raras
 * en Firebase. El minimo es 20 caracteres: el enlace es la UNICA credencial del
 * escenario, asi que un id corto o inventado a mano seria adivinable y
 * expondria el assessment completo.
 */
export function getScenarioIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawScenarioId = params.get("scenario");

  if (!rawScenarioId) {
    return null;
  }

  const cleanScenarioId = rawScenarioId.trim();
  const isValidScenarioId = /^[a-zA-Z0-9_-]{20,120}$/.test(cleanScenarioId);

  if (!isValidScenarioId) {
    console.warn(
      "Scenario ID inválido (mínimo 20 caracteres, solo letras, números, '-' y '_'). Se usará modo local:",
      cleanScenarioId,
    );

    return null;
  }

  return cleanScenarioId;
}


export const scenarioId = getScenarioIdFromUrl();


/**
 * La copia local se guarda por escenario, no bajo una clave unica.
 *
 * Con una sola clave, abrir el escenario de un cliente y despues el de otro en
 * el mismo navegador dejaba cargados los datos del primero cuando la lectura
 * remota del segundo fallaba: applyStoredScenario() corre antes de leer
 * Firebase, y el catch de initializeSharedScenario() avisa de la falta de
 * conexion pero no limpia lo que ya se ha pintado. La pantalla acababa
 * ensenando los datos de un cliente bajo la URL de otro, y el aviso decia
 * "estas trabajando sobre la copia de este navegador" sin aclarar de quien era
 * esa copia.
 *
 * En modo local la clave es la misma de siempre, asi que nadie pierde su
 * trabajo al desplegar esto. En modo compartido la primera carga no encuentra
 * copia y baja de Firebase, que es la fuente de verdad de todos modos.
 */
export const STORAGE_KEY_BASE = "f3m-fpa-assessment-scenario";

export const STORAGE_KEY = scenarioId
  ? `${STORAGE_KEY_BASE}:${scenarioId}`
  : STORAGE_KEY_BASE;

export const NOMBRE_STORAGE_KEY = "f3m-nombre-editor";
export const MODO_PRESENTACION_KEY = "f3m-modo-presentacion";
export const TEMA_KEY = "f3m-tema";




export function syncActiveDomainState() {
  if (!state.activeDomainId || !state.domains[state.activeDomainId]) {
    return;
  }

  state.domains[state.activeDomainId].items = state.items;
  state.domains[state.activeDomainId].meta = state.meta;
  state.domains[state.activeDomainId].targets = state.targets;
}
