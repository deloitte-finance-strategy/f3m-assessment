/**
 * Un escenario como dato: leerlo, volcarlo sobre lo cargado y volver a armarlo.
 *
 * Esto es la capa de datos, no las acciones. Importar, exportar o restaurar
 * —que preguntan, avisan y escriben en Firebase— viven aparte y llaman aqui.
 * El reparto no es estetico: la persistencia necesita armar y aplicar payloads,
 * y las acciones necesitan la persistencia. Con todo junto, los dos modulos se
 * importarian en circulo.
 */

import {
  DEFAULT_TARGET_MATURITY,
  normalizeTargetValue,
  toScore,
} from "../core/calculo.js?v=12";

import {
  normalizarAutoria,
  normalizarEscenarioParaFirebase,
  normalizarEstado,
  recortarAlLimite,
} from "../core/escenario.js?v=12";

import {
  normalizeDomainTargets,
  serializeTargetsForFirebase,
} from "../core/objetivos.js?v=12";

import {
  findMatchingScenarioItem,
  getSavedField,
  getSavedScore,
  getScenarioItemsFromPayload,
} from "../core/coincidencias.js?v=12";

import { LEVERS, STORAGE_KEY, state, syncActiveDomainState } from "./estado.js?v=12";
import { leerAlmacenamiento } from "./almacenamiento.js?v=12";
import { setActiveDomain } from "./dominios.js?v=12";




export function getStoredScenario() {
  const stored = leerAlmacenamiento(STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn(
      "No se pudo leer el escenario guardado localmente.",
      error,
    );

    return null;
  }
}




export function applyStoredScenario() {
  const stored = leerAlmacenamiento(STORAGE_KEY);

  if (!stored) {
    return;
  }

  try {
    const payload = JSON.parse(stored);
    // Al arrancar se vuelve al dominio en el que se estaba trabajando.
    applyScenarioPayload(payload, {
      seguirDominioDelEscenario: true,
    });
  } catch (error) {
    console.warn("No se pudo aplicar el escenario local.", error);
  }
}




function getScenarioTargetsFromPayload(payload, domainId) {
  if (!payload || !domainId) {
    return {};
  }

  if (payload.domains?.[domainId]?.targets) {
    return payload.domains[domainId].targets;
  }

  if (payload[domainId]?.targets) {
    return payload[domainId].targets;
  }

  if (
    domainId === "fpa" &&
    payload.targets &&
    !payload.domains
  ) {
    return payload.targets;
  }

  return {};
}


/**
 * Vuelca las subcapacidades guardadas sobre las cargadas.
 *
 * `scoresAutoritativos` distingue dos cosas que no son lo mismo:
 *
 * - En un escenario de esta herramienta (el de Firebase, la copia local o un
 *   JSON exportado) el bloque `scores` describe las tres palancas por completo.
 *   Que falte una significa "sin puntuar", no "no se sabe": Firebase no guarda
 *   nulos, asi que borrar una puntuacion borra su clave.
 * - En un archivo de formato antiguo, con columnas planas y sueltas, lo que no
 *   viene de verdad no se sabe, y no puede borrar lo que ya hay.
 *
 * Sin esa distincion, quitar una puntuacion no llegaba a nadie: la clave
 * desaparecia de Firebase, aqui se leia como undefined y se saltaba. Quien
 * tuviera la pagina abierta seguia viendo el valor viejo, y en la misma sesion
 * dos personas veian cifras distintas.
 */
function applyScenarioItemsToDomain(
  domainId,
  savedItems,
  { scoresAutoritativos = false } = {},
) {
  const domain = state.domains[domainId];

  if (!domain || !Array.isArray(savedItems)) {
    return {
      matched: 0,
      total: savedItems?.length || 0,
    };
  }

  let matched = 0;

  savedItems.forEach((savedItem) => {
    const item = findMatchingScenarioItem(domain.items, savedItem);

    if (!item) {
      return;
    }

    matched += 1;

    if (scoresAutoritativos) {
      const guardados = savedItem.scores || {};

      LEVERS.forEach((lever) => {
        item.scores[lever.key] = toScore(guardados[lever.key]);
      });
    } else {
      LEVERS.forEach((lever) => {
        const guardado = getSavedScore(savedItem, lever.key);

        if (guardado !== undefined) {
          item.scores[lever.key] = toScore(guardado);
        }
      });
    }

    const owner = getSavedField(savedItem, ["owner", "Owner"]);
    const status = getSavedField(savedItem, ["status", "Estado", "estado"]);
    const comentario = getSavedField(savedItem, ["comentario", "Comentarios", "Comentarios / hallazgos", "comments"]);

    if (owner !== undefined) {
      item.owner = recortarAlLimite("owner", owner);
    }

    if (status !== undefined) {
      // Las reglas admiten cualquier texto de 40 caracteres, pero la
      // herramienta solo sabe pintar cuatro estados: un valor de fuera dejaba
      // el select en blanco, y si era largo tumbaba la escritura entera.
      item.status = normalizarEstado(status);
    }

    if (comentario !== undefined) {
      item.comentario = recortarAlLimite("comentario", comentario);
    }

    // Las reglas de autoria declaran "$otroCampoAutoria": false: un campo
    // inventado dentro de lastEditedBy tumbaba tambien la escritura entera.
    const autoria = normalizarAutoria(savedItem.lastEditedBy);

    if (autoria) {
      item.lastEditedBy = autoria;
    }
  });

  return {
    matched,
    total: savedItems.length,
  };
}


/**
 * Vuelca un escenario guardado sobre los datos cargados.
 *
 * Devuelve cuántas subcapacidades ha reconocido: sin ese dato, una importación
 * que no casaba con nada terminaba igualmente en "Escenario importado
 * correctamente".
 *
 * `seguirDominioDelEscenario` solo debe ser true al CARGAR un escenario: al
 * abrir un enlace compartido, al restaurar la copia local o al abrir un
 * archivo. Nunca en una actualizacion en vivo.
 *
 * El motivo: el payload lleva un activeDomainId, y las escrituras granulares
 * —que son las de puntuar— no lo actualizan nunca. Asi que en un escenario
 * compartido el valor guardado se quedaba en el dominio de la primera
 * escritura completa. Cada puntuacion volvia por Firebase como snapshot, se
 * aplicaba, y devolvia a quien estuviera puntuando al dominio de entonces:
 * puntuar en Tesoreria te dejaba en FP&A.
 *
 * Y aunque se actualizara, seguiria estando mal: el dominio que cada persona
 * mira es suyo, no del escenario. Dos consultores trabajando en dominios
 * distintos se arrastrarian el uno al otro en cada puntuacion.
 */
export function applyScenarioPayload(payload, { seguirDominioDelEscenario = false } = {}) {
  const resultado = { aplicadas: 0, total: 0, dominios: 0 };

  if (!payload) {
    return resultado;
  }

  if (payload.domains) {
    Object.keys(payload.domains).forEach((domainId) => {
      const domain = state.domains[domainId];

      if (!domain) {
        return;
      }

      const result = applyScenarioItemsToDomain(
        domainId,
        getScenarioItemsFromPayload(payload, domainId),
        { scoresAutoritativos: true },
      );

      const defaultTarget = normalizeTargetValue(
        domain.meta?.targetMaturity,
        DEFAULT_TARGET_MATURITY,
      );

      domain.targets = normalizeDomainTargets(
        domain.items,
        getScenarioTargetsFromPayload(payload, domainId),
        defaultTarget,
      );

      resultado.aplicadas += result.matched;
      resultado.total += result.total;
      resultado.dominios += 1;

      // Solo se dice algo cuando hay algo que decir: que una subcapacidad del
      // archivo no case con ninguna de las cargadas es justo lo que hay que
      // poder ver en la consola durante una sesion.
      if (result.matched < result.total) {
        console.warn(
          `Escenario aplicado en ${domainId}: solo ${result.matched} de ${result.total} ` +
            "subcapacidades del archivo corresponden a este dominio.",
        );
      }
    });

    // Se vuelve a fijar el dominio activo en cualquier caso: aplicar el
    // escenario reasigna domain.targets, y state.targets debe volver a
    // apuntar al objeto nuevo. Lo que cambia es CUAL, no si se hace.
    const dominioDestino =
      seguirDominioDelEscenario &&
      payload.activeDomainId &&
      state.domains[payload.activeDomainId]
        ? payload.activeDomainId
        : state.activeDomainId;

    if (state.domains[dominioDestino]) {
      setActiveDomain(dominioDestino);
    }

    return resultado;
  }

  const legacyItems = getScenarioItemsFromPayload(payload, "fpa");
  const result = applyScenarioItemsToDomain("fpa", legacyItems);

  const fpaDomain = state.domains.fpa;

  if (fpaDomain) {
    const defaultTarget = normalizeTargetValue(
      fpaDomain.meta?.targetMaturity,
      DEFAULT_TARGET_MATURITY,
    );

    fpaDomain.targets = normalizeDomainTargets(
      fpaDomain.items,
      getScenarioTargetsFromPayload(payload, "fpa"),
      defaultTarget,
    );
  }

  resultado.aplicadas = result.matched;
  resultado.total = result.total;
  resultado.dominios = 1;

  if (result.matched < result.total) {
    console.warn(
      `Escenario antiguo aplicado en FP&A: solo ${result.matched} de ${result.total} ` +
        "subcapacidades del archivo corresponden a este dominio.",
    );
  }

  if (state.activeDomainId === "fpa") {
    setActiveDomain("fpa");
  }

  return resultado;
}




export function buildScenarioPayload() {
  syncActiveDomainState();

  const domainsPayload = {};

  Object.entries(state.domains).forEach(([domainId, domain]) => {
    domainsPayload[domainId] = {
      meta: domain.meta,

      targets: serializeTargetsForFirebase(
        domain.items,
        domain.targets,
        normalizeTargetValue(
          domain.meta?.targetMaturity,
          DEFAULT_TARGET_MATURITY,
        ),
      ),

      // Indexamos por id y no por posición: las escrituras granulares apuntan a
      // rutas como items/fpa-1-2/scores/procesos, que deben seguir siendo válidas
      // aunque más adelante se añadan o reordenen subcapacidades.
      items: Object.fromEntries(
        domain.items.map((item) => [
          item.id,
          {
            id: item.id,
            capacidad: item.capacidad,
            subcapacidad: item.subcapacidad,

            scores: {
              procesos: item.scores.procesos,
              tecnologia: item.scores.tecnologia,
              organizacion: item.scores.organizacion,
            },

            owner: item.owner,
            status: item.status,
            comentario: item.comentario,

            // Se conserva para que una escritura completa (importar, restaurar)
            // no borre la autoría registrada por las escrituras granulares.
            ...(item.lastEditedBy ? { lastEditedBy: item.lastEditedBy } : {}),
          },
        ]),
      ),
    };
  });

  return {
    version: 3,
    activeDomainId: state.activeDomainId,
    updatedAt: new Date().toISOString(),
    domains: domainsPayload,
  };
}


/**
 * Deja el escenario con exactamente lo que admiten las reglas de Firebase.
 *
 * Antes copiaba con spread las claves de la raiz y de cada dominio, asi que un
 * campo que las reglas no declaran viajaba igualmente y hacia que rechazaran la
 * escritura ENTERA. Ahora se construye desde cero con los campos permitidos.
 */
export function sanitizeScenarioForFirebase(payload) {
  return normalizarEscenarioParaFirebase(payload);
}
