/**
 * Pruebas de que core/escenario.js sigue siendo el espejo de
 * database.rules.json.
 *
 * Los dos archivos declaran el mismo contrato —que campos admite cada nivel,
 * cuanto mide cada texto, que rangos aceptan los scores— y hasta ahora nada
 * comprobaba que siguieran de acuerdo. Cuando dejan de estarlo el fallo no se
 * ve al programar: se ve en la sesion, cuando Firebase rechaza la escritura
 * entera y el cambio se pierde.
 *
 * Aqui no se valida que las reglas sean buenas, sino que las dos copias del
 * contrato digan lo mismo. Si se cambia una, esta prueba obliga a cambiar la
 * otra.
 *
 * Ojo: esto lee el archivo de reglas del repositorio, no las reglas
 * desplegadas. Que lo publicado en Firebase coincida con lo que hay aqui se
 * comprueba en la consola, y no hay forma de automatizarlo desde el navegador.
 */

import {
  CAMPOS_DE_AUTORIA,
  CAMPOS_DE_DOMINIO,
  CAMPOS_DE_ITEM,
  CAMPOS_RAIZ,
  ESTADOS_VALIDOS,
  LIMITE_DE_META,
  LIMITES_DE_TEXTO,
} from "../core/escenario.js";


const RAIZ = new URL("../", import.meta.url);


/**
 * Lee un JSON del repositorio, en Node y en el navegador.
 *
 * El import de node:fs es dinamico a proposito: uno estatico rompe la carga
 * del modulo en el navegador aunque su rama no llegue a ejecutarse nunca.
 */
async function leerJson(nombre) {
  const url = new URL(nombre, RAIZ);

  if (typeof window === "undefined") {
    const { readFileSync } = await import("node:fs");
    return JSON.parse(readFileSync(url, "utf8"));
  }

  const respuesta = await fetch(url);

  if (!respuesta.ok) {
    throw new Error(`No se pudo leer ${nombre}: ${respuesta.status}`);
  }

  return respuesta.json();
}


// Top-level await: el grafo de modulos espera a que esto termine, asi que
// ejecutarCasos() sigue siendo sincrono y runner.js no cambia de forma.
const reglas = await leerJson("database.rules.json");
const catalogo = await leerJson("data/domains.json");

const ESCENARIO = reglas?.rules?.scenarios?.$scenarioId;
const DOMINIO = ESCENARIO?.domains?.$domainId;
const ITEM = DOMINIO?.items?.$indice;
const TARGET = DOMINIO?.targets?.$indiceTarget;


/** El numero de un ".validate" del tipo "... length <= N". */
function limiteDe(nodo) {
  const encontrado = /length\s*<=\s*(\d+)/.exec(nodo?.[".validate"] ?? "");

  return encontrado ? Number(encontrado[1]) : null;
}


/** Los campos con nombre propio de un nivel: ni ".validate" ni comodines. */
function camposDe(nodo) {
  return Object.keys(nodo ?? {})
    .filter((clave) => !clave.startsWith(".") && !clave.startsWith("$"))
    .sort()
    .join(", ");
}


/** Los valores de un ".validate" con matches(/^(a|b|c)$/), en orden. */
function alternativasDe(nodo) {
  const encontrado = /matches\(\/\^\((.+?)\)\$\//.exec(nodo?.[".validate"] ?? "");

  return encontrado ? encontrado[1].split("|").sort().join(", ") : null;
}


/** El rango de un ".validate" numerico, como "1-5". */
function rangoDe(nodo) {
  const validate = nodo?.[".validate"] ?? "";
  const minimo = />=\s*(\d+)/.exec(validate);
  const maximo = /<=\s*(\d+)/.exec(validate);

  return `${minimo ? minimo[1] : "?"}-${maximo ? maximo[1] : "?"}`;
}


const enOrden = (lista) => [...lista].sort().join(", ");

const PALANCAS_EN_REGLAS = ["procesos", "tecnologia", "organizacion"];


export const casos = [
  // ------------------------------------------------- la forma del archivo
  {
    grupo: "Espejo de las reglas · forma",
    nombre: "el archivo de reglas tiene los niveles que esta prueba recorre",
    ejecutar: (t) => {
      // Sin esto, un renombrado de cualquier comodin dejaria el resto de casos
      // comparando undefined contra undefined y pasando sin comprobar nada.
      t.igual(Boolean(ESCENARIO), true, "scenarios/$scenarioId");
      t.igual(Boolean(DOMINIO), true, "domains/$domainId");
      t.igual(Boolean(ITEM), true, "items/$indice");
      t.igual(Boolean(TARGET), true, "targets/$indiceTarget");
      t.igual(Boolean(ITEM?.scores), true, "items/$indice/scores");
      t.igual(Boolean(ITEM?.lastEditedBy), true, "items/$indice/lastEditedBy");
    },
  },

  // ----------------------------------------------------------- longitudes
  {
    grupo: "Espejo de las reglas · longitudes",
    nombre: "LIMITES_DE_TEXTO coincide campo a campo con las reglas",
    ejecutar: (t) => {
      Object.entries(LIMITES_DE_TEXTO).forEach(([campo, limite]) => {
        t.igual(limiteDe(ITEM?.[campo]), limite, `items/${campo}`);
      });
    },
  },
  {
    grupo: "Espejo de las reglas · longitudes",
    nombre: "CAMPOS_DE_AUTORIA coincide campo a campo con las reglas",
    ejecutar: (t) => {
      Object.entries(CAMPOS_DE_AUTORIA).forEach(([campo, limite]) => {
        t.igual(
          limiteDe(ITEM?.lastEditedBy?.[campo]),
          limite,
          `lastEditedBy/${campo}`,
        );
      });
    },
  },
  {
    grupo: "Espejo de las reglas · longitudes",
    nombre: "LIMITE_DE_META coincide con las reglas",
    ejecutar: (t) => {
      t.igual(limiteDe(DOMINIO?.meta?.$campoMeta), LIMITE_DE_META, "meta");
    },
  },
  {
    grupo: "Espejo de las reglas · longitudes",
    nombre: "capacidad de un objetivo mide lo mismo que la de una subcapacidad",
    ejecutar: (t) => {
      // El mismo texto en dos sitios: si uno se alarga y el otro no, importar
      // un escenario con capacidades largas falla solo a veces.
      t.igual(
        limiteDe(TARGET?.capacidad),
        LIMITES_DE_TEXTO.capacidad,
        "targets/capacidad",
      );
    },
  },

  // ------------------------------------------------------ campos admitidos
  {
    grupo: "Espejo de las reglas · campos admitidos",
    nombre: "la raiz admite los mismos campos en los dos sitios",
    ejecutar: (t) => {
      t.igual(camposDe(ESCENARIO), enOrden(CAMPOS_RAIZ), "CAMPOS_RAIZ");
    },
  },
  {
    grupo: "Espejo de las reglas · campos admitidos",
    nombre: "un dominio admite los mismos campos en los dos sitios",
    ejecutar: (t) => {
      t.igual(camposDe(DOMINIO), enOrden(CAMPOS_DE_DOMINIO), "CAMPOS_DE_DOMINIO");
    },
  },
  {
    grupo: "Espejo de las reglas · campos admitidos",
    nombre: "una subcapacidad admite los mismos campos en los dos sitios",
    ejecutar: (t) => {
      t.igual(camposDe(ITEM), enOrden(CAMPOS_DE_ITEM), "CAMPOS_DE_ITEM");
    },
  },
  {
    grupo: "Espejo de las reglas · campos admitidos",
    nombre: "la autoria admite los mismos campos en los dos sitios",
    ejecutar: (t) => {
      t.igual(
        camposDe(ITEM?.lastEditedBy),
        enOrden(Object.keys(CAMPOS_DE_AUTORIA)),
        "CAMPOS_DE_AUTORIA",
      );
    },
  },

  // ---------------------------------------------------------- los cerrojos
  {
    grupo: "Espejo de las reglas · cerrojos",
    nombre: "cada nivel rechaza cualquier campo no declarado",
    ejecutar: (t) => {
      // Esto es lo que de verdad protege: un cerrojo que desaparezca abre el
      // nivel entero a campos que la aplicacion no sabe leer, y el rechazo de
      // Firebase deja de avisar de que alguien esta escribiendo de mas.
      const cerrojos = [
        [ESCENARIO, "$otroCampoRaiz"],
        [DOMINIO, "$otroCampoDominio"],
        [ITEM, "$otroCampoItem"],
        [ITEM?.scores, "$otroScore"],
        [ITEM?.lastEditedBy, "$otroCampoAutoria"],
        [TARGET, "$otroTarget"],
      ];

      cerrojos.forEach(([nodo, comodin]) => {
        t.igual(nodo?.[comodin]?.[".validate"], false, comodin);
      });
    },
  },

  // ---------------------------------------------------- valores admitidos
  {
    grupo: "Espejo de las reglas · valores admitidos",
    nombre: "status admite exactamente los estados que ofrece la herramienta",
    ejecutar: (t) => {
      t.igual(alternativasDe(ITEM?.status), enOrden(ESTADOS_VALIDOS), "status");
    },
  },
  {
    grupo: "Espejo de las reglas · valores admitidos",
    nombre: "domains admite exactamente los dominios del catalogo",
    ejecutar: (t) => {
      // Esto convierte "anadir un dominio y olvidar las reglas" en un CI rojo,
      // que es la mitad de su valor. La otra mitad es que un archivo importado
      // no pueda crear ramas de dominios que la aplicacion no sabe leer.
      const delCatalogo = (catalogo?.domains ?? []).map((dominio) => dominio.id);

      t.igual(alternativasDe(DOMINIO), enOrden(delCatalogo), "$domainId");
    },
  },

  // ------------------------------------------------------------- el acceso
  {
    grupo: "Espejo de las reglas · acceso",
    nombre: "leer y escribir un escenario exige identidad",
    ejecutar: (t) => {
      // No es espejo de nada de core/, es un cerrojo: quitar el auth != null
      // deja la base abierta a cualquiera con la URL y sin sesion siquiera, y
      // eso no puede pasar sin que algo se ponga rojo.
      t.igual(
        (ESCENARIO?.[".read"] ?? "").includes("auth != null"),
        true,
        ".read",
      );
      t.igual(
        (ESCENARIO?.[".write"] ?? "").includes("auth != null"),
        true,
        ".write",
      );
    },
  },

  // ------------------------------------------------------ rangos de scores
  {
    grupo: "Espejo de las reglas · scores",
    nombre: "las tres palancas de una subcapacidad aceptan de 1 a 5",
    ejecutar: (t) => {
      PALANCAS_EN_REGLAS.forEach((palanca) => {
        t.igual(rangoDe(ITEM?.scores?.[palanca]), "1-5", `scores/${palanca}`);
      });
    },
  },
  {
    grupo: "Espejo de las reglas · scores",
    nombre: "las tres palancas de un objetivo aceptan de 1 a 5",
    ejecutar: (t) => {
      PALANCAS_EN_REGLAS.forEach((palanca) => {
        t.igual(rangoDe(TARGET?.[palanca]), "1-5", `targets/${palanca}`);
      });
    },
  },
];
