/**
 * El contrato de un escenario, en un solo sitio.
 *
 * Es el espejo en JavaScript de database.rules.json. Las reglas de la Realtime
 * Database validan campo a campo y rechazan cualquier campo que no declaren
 * (los ".validate": false), y lo hacen sobre la escritura ENTERA: un solo campo
 * de mas o un texto demasiado largo tumban el guardado completo.
 *
 * Antes eso pasaba en silencio y a destiempo. Un escenario importado podia
 * traer un status de 120 caracteres o un lastEditedBy con campos inventados,
 * entraba en la aplicacion sin problema, y el rechazo llegaba despues, al
 * intentar guardar.
 *
 * Todo esto son funciones puras: se prueban sin navegador, igual que el motor
 * de calculo.
 *
 * IMPORTANTE: si cambia database.rules.json, hay que cambiar esto tambien.
 */


/** Longitudes maximas de texto. Espejo de database.rules.json. */
export const LIMITES_DE_TEXTO = {
  id: 120,
  capacidad: 200,
  subcapacidad: 300,
  owner: 120,
  status: 40,
  comentario: 2000,
};


/** Los unicos estados que ofrece la herramienta. */
export const ESTADOS_VALIDOS = [
  "No iniciado",
  "En curso",
  "Completado",
  "Bloqueado",
];


/** Campos de autoria admitidos, con su longitud maxima. */
export const CAMPOS_DE_AUTORIA = {
  uid: 128,
  nombre: 60,
  at: 40,
};


/** Campos que las reglas admiten en la raiz del escenario. */
export const CAMPOS_RAIZ = [
  "version",
  "activeDomainId",
  "updatedAt",
  "domains",
];


/** Campos que las reglas admiten dentro de cada dominio. */
export const CAMPOS_DE_DOMINIO = ["meta", "targets", "items"];


/** Campos que las reglas admiten dentro de cada subcapacidad. */
export const CAMPOS_DE_ITEM = [
  "id",
  "capacidad",
  "subcapacidad",
  "scores",
  "owner",
  "status",
  "comentario",
  "lastEditedBy",
];


/** Longitud maxima de cada campo de meta, segun las reglas. */
export const LIMITE_DE_META = 200;


export function recortarAlLimite(campo, valor) {
  const limite = LIMITES_DE_TEXTO[campo];
  const texto = String(valor ?? "");

  return limite ? texto.slice(0, limite) : texto;
}


/**
 * Un estado valido, o el de partida si no lo es.
 *
 * Las reglas solo exigen un texto de 40 caracteres, pero la herramienta solo
 * sabe pintar cuatro estados: cualquier otro dejaria el select en blanco.
 */
export function normalizarEstado(valor, porDefecto = ESTADOS_VALIDOS[0]) {
  const texto = String(valor ?? "").trim();

  return ESTADOS_VALIDOS.includes(texto) ? texto : porDefecto;
}


/**
 * La marca de autoria, con solo los tres campos que las reglas admiten y
 * recortada a sus longitudes. Devuelve null si no queda nada aprovechable.
 */
export function normalizarAutoria(valor) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return null;
  }

  const autoria = {};

  Object.entries(CAMPOS_DE_AUTORIA).forEach(([campo, limite]) => {
    const contenido = valor[campo];

    if (contenido === undefined || contenido === null) {
      return;
    }

    autoria[campo] = String(contenido).slice(0, limite);
  });

  return Object.keys(autoria).length ? autoria : null;
}


/** Un score valido para las reglas: entero de 1 a 5, o null. */
function normalizarScore(valor) {
  const numero = Number(valor);

  return Number.isInteger(numero) && numero >= 1 && numero <= 5
    ? numero
    : null;
}


function esObjeto(valor) {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}


function comoLista(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "object") return Object.values(valor);

  return [];
}


/**
 * Revisa un archivo antes de dejarlo entrar.
 *
 * Distingue dos cosas que antes se trataban igual:
 *
 * - `valido: false` es un archivo que no es un escenario de esta herramienta.
 *   No se aplica nada y se explica por que.
 * - `problemas` son cosas que si se pueden arreglar al vuelo —un estado que no
 *   existe, un texto demasiado largo, un campo de mas— y que conviene contarle
 *   a quien importa, en vez de corregirlas en silencio.
 *
 * Acepta tanto el formato actual (domains) como los antiguos de una sola
 * pagina (items / subcapacities sueltos), que es lo que hace la aplicacion.
 */
export function revisarEscenario(payload) {
  if (payload === null || payload === undefined) {
    return {
      valido: false,
      motivo: "El archivo esta vacio.",
      problemas: [],
      subcapacidades: 0,
    };
  }

  if (typeof payload !== "object") {
    return {
      valido: false,
      motivo:
        "El archivo contiene un valor suelto, no un escenario. Tiene que ser un " +
        "JSON exportado con Guardar copia desde esta misma herramienta.",
      problemas: [],
      subcapacidades: 0,
    };
  }

  const bloques = [];

  if (esObjeto(payload.domains)) {
    Object.entries(payload.domains).forEach(([domainId, dominio]) => {
      if (!esObjeto(dominio)) {
        return;
      }

      bloques.push({
        dominio: domainId,
        items: comoLista(dominio.items ?? dominio.subcapacities),
        extras: Object.keys(dominio).filter(
          (campo) => !CAMPOS_DE_DOMINIO.includes(campo) && campo !== "subcapacities",
        ),
      });
    });
  } else {
    // Formatos antiguos: un unico dominio, con los items en la raiz.
    const items = Array.isArray(payload)
      ? payload
      : comoLista(payload.items ?? payload.subcapacities ?? payload.state?.items);

    if (items.length) {
      bloques.push({ dominio: "fpa", items, extras: [] });
    }
  }

  const subcapacidades = bloques.reduce(
    (total, bloque) => total + bloque.items.length,
    0,
  );

  if (!bloques.length || !subcapacidades) {
    return {
      valido: false,
      motivo:
        "El archivo no contiene ninguna subcapacidad. Tiene que ser un JSON " +
        "exportado con Guardar copia desde esta misma herramienta.",
      problemas: [],
      subcapacidades: 0,
    };
  }

  const problemas = [];
  const contar = (texto) => {
    if (!problemas.includes(texto)) {
      problemas.push(texto);
    }
  };

  if (!Array.isArray(payload) && payload.version !== undefined
      && !Number.isFinite(Number(payload.version))) {
    contar("la version del archivo no es un numero y se ignora");
  }

  Object.keys(esObjeto(payload) && !Array.isArray(payload) ? payload : {})
    .filter((campo) => !CAMPOS_RAIZ.includes(campo))
    .forEach(() => contar("el archivo trae campos que esta herramienta no usa y se descartan"));

  bloques.forEach((bloque) => {
    if (bloque.extras.length) {
      contar("algun dominio trae campos que esta herramienta no usa y se descartan");
    }

    bloque.items.forEach((item) => {
      if (!esObjeto(item)) {
        contar("alguna subcapacidad del archivo no es un registro y se ignora");
        return;
      }

      const scores = esObjeto(item.scores) ? item.scores : {};

      ["procesos", "tecnologia", "organizacion"].forEach((palanca) => {
        const bruto = scores[palanca];

        if (
          bruto !== undefined &&
          bruto !== null &&
          bruto !== "" &&
          normalizarScore(bruto) === null
        ) {
          contar("alguna puntuacion no es un entero del 1 al 5 y queda sin puntuar");
        }
      });

      if (item.status !== undefined && item.status !== null && item.status !== "") {
        if (normalizarEstado(item.status, null) === null) {
          contar("algun estado no es uno de los cuatro de la herramienta y se pone en No iniciado");
        }
      }

      if (String(item.owner ?? "").length > LIMITES_DE_TEXTO.owner) {
        contar(`algun responsable pasa de ${LIMITES_DE_TEXTO.owner} caracteres y se recorta`);
      }

      if (String(item.comentario ?? "").length > LIMITES_DE_TEXTO.comentario) {
        contar(`algun comentario pasa de ${LIMITES_DE_TEXTO.comentario} caracteres y se recorta`);
      }

      if (item.lastEditedBy !== undefined && normalizarAutoria(item.lastEditedBy) === null) {
        contar("alguna marca de autoria no se entiende y se descarta");
      } else if (esObjeto(item.lastEditedBy)) {
        const sobran = Object.keys(item.lastEditedBy).filter(
          (campo) => !(campo in CAMPOS_DE_AUTORIA),
        );

        if (sobran.length) {
          contar("alguna marca de autoria trae campos de mas y se limpian");
        }
      }

      const sobranEnItem = Object.keys(item).filter(
        (campo) => !CAMPOS_DE_ITEM.includes(campo),
      );

      if (sobranEnItem.length) {
        contar("alguna subcapacidad trae campos que esta herramienta no usa y se descartan");
      }
    });
  });

  return { valido: true, motivo: "", problemas, subcapacidades };
}


/**
 * Deja el escenario con exactamente lo que las reglas admiten, y nada mas.
 *
 * Se aplica justo antes de escribir en Firebase. Si algo se cuela pese a todo
 * lo anterior, aqui se queda fuera: es preferible guardar de menos a que la
 * escritura entera sea rechazada y el cambio se pierda.
 *
 * `serializarTargets` se recibe de fuera porque depende de los items del
 * dominio, que solo conoce la aplicacion.
 */
export function normalizarEscenarioParaFirebase(payload, serializarTargets) {
  if (!esObjeto(payload)) {
    return payload;
  }

  const escenario = {
    version: 3,
    updatedAt: String(payload.updatedAt ?? new Date().toISOString()).slice(0, 40),
    domains: {},
  };

  if (payload.activeDomainId !== undefined) {
    escenario.activeDomainId = String(payload.activeDomainId).slice(0, 64);
  }

  Object.entries(payload.domains || {}).forEach(([domainId, dominio]) => {
    if (!esObjeto(dominio)) {
      return;
    }

    const items = comoLista(dominio.items);

    escenario.domains[domainId] = {
      meta: normalizarMeta(dominio.meta),
      targets: serializarTargets(items, dominio.targets, dominio.meta),
      items: items.map(normalizarItemParaFirebase).filter(Boolean),
    };
  });

  return escenario;
}


/** Meta solo admite textos de 200 caracteres y numeros, un nivel de profundidad. */
function normalizarMeta(meta) {
  if (!esObjeto(meta)) {
    return {};
  }

  const salida = {};

  Object.entries(meta).forEach(([campo, valor]) => {
    if (typeof valor === "number" && Number.isFinite(valor)) {
      salida[campo] = valor;
      return;
    }

    if (valor === null || valor === undefined || typeof valor === "object") {
      return;
    }

    salida[campo] = String(valor).slice(0, LIMITE_DE_META);
  });

  return salida;
}


function normalizarItemParaFirebase(item) {
  if (!esObjeto(item)) {
    return null;
  }

  const scores = esObjeto(item.scores) ? item.scores : {};

  const normalizado = {
    id: recortarAlLimite("id", item.id),
    capacidad: recortarAlLimite("capacidad", item.capacidad),
    subcapacidad: recortarAlLimite("subcapacidad", item.subcapacidad),

    scores: {
      procesos: normalizarScore(scores.procesos),
      tecnologia: normalizarScore(scores.tecnologia),
      organizacion: normalizarScore(scores.organizacion),
    },

    owner: recortarAlLimite("owner", item.owner),
    status: normalizarEstado(item.status),
    comentario: recortarAlLimite("comentario", item.comentario),
  };

  const autoria = normalizarAutoria(item.lastEditedBy);

  if (autoria) {
    normalizado.lastEditedBy = autoria;
  }

  return normalizado;
}
