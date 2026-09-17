/**
 * Hablar con Firebase: leer el escenario, suscribirse y escribir.
 *
 * Lo que este modulo no puede hacer NUNCA es decir que todo va bien cuando no
 * va bien. Las escrituras suben por su cuenta aunque la suscripcion este
 * muerta, asi que "guardado" y "guardado Y recibiendo" no son lo mismo:
 * confundirlos dejaba a dos consultores pisandose el trabajo creyendo que
 * colaboraban. De ahi que el chip tenga un estado propio para eso.
 *
 * Las escrituras normales son granulares, por ruta: escribir el payload entero
 * hacia que dos personas editando dominios distintos se borrasen el trabajo
 * mutuamente. Las completas —crear escenario e importar— escriben una ruta por
 * dominio CARGADO, para que un dominio cuyo JSON no haya llegado conserve su
 * rama intacta en vez de desaparecer para todo el equipo.
 */

import { DEFAULT_TARGET_MATURITY, normalizeTargetValue } from "../core/calculo.js?v=11";
import { serializeTargetsForFirebase } from "../core/objetivos.js?v=11";
import { get, onValue, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

import { STORAGE_KEY, state, syncActiveDomainState } from "./estado.js?v=11";
import { escribirAlmacenamiento } from "./almacenamiento.js?v=11";
import { ocultarAviso, showNotice } from "./avisos.js?v=11";
import { conLimiteDeEspera, scenarioDatabaseRef } from "./firebase.js?v=11";
import { getUsuarioActual, inicializarIdentidad, marcaDeAutoria } from "./identidad.js?v=11";
import { repintarTodo } from "./repintado.js?v=11";
import { populateCapacityFilter } from "./filtros.js?v=11";

import {
  hayCanalDeVuelta,
  marcarCanalDeVuelta,
  marcarEscrituraCorrecta,
  marcarFalloDeSincronia,
  updateSaveStatus,
} from "./indicador.js?v=11";

import {
  applyScenarioPayload,
  buildScenarioPayload,
  getStoredScenario,
  sanitizeScenarioForFirebase,
} from "./escenario.js?v=11";




let isApplyingRemoteScenario = false;


 // NUEVO: evita guardar de vuelta mientras estamos cargando datos remotos
let pendingScenarioWrites = 0;




let snapshotRemotoPendiente = null;


// Para poder cancelar la suscripcion anterior antes de abrir otra. Sin esto,
// cada reintento de conexion dejaba un listener mas escuchando, y cada snapshot
// repintaba la aplicacion tantas veces como reintentos hubiera habido.
//
// Se perdio al repartir app.js y estuvo fuera hasta hoy. Sin ella,
// subscribeToSharedScenario() reventaba con un ReferenceError en su primera
// linea, asi que en un escenario compartido la suscripcion no llegaba a abrirse
// NUNCA: se subia lo propio y no bajaba nada del resto del equipo.
//
// check_modules.py no lo vio porque solo avisa de nombres que ALGUN modulo
// declara, y este no lo declaraba ninguno.
let cancelarSuscripcionRemota = null;


// getScenarioTimestamp / isScenarioNewer se han retirado: comparar marcas de tiempo
// para decidir qué versión gana dejó de tener sentido al escribir por rutas
// concretas. Además los relojes de cada equipo no son fiables, así que la
// comparación descartaba cambios ajenos de forma arbitraria.


function readScenarioFromFirebase(timeoutMs = 8000) {
  return conLimiteDeEspera(
    get(scenarioDatabaseRef),
    "Tiempo de espera agotado al leer Firebase",
    timeoutMs,
  );
}




export async function initializeSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  const localScenario = getStoredScenario();

  // La lectura y el volcado en pantalla van en dos try distintos a proposito.
  // Compartian uno solo, asi que un fallo de applyScenarioPayload() o de
  // renderAll() —datos raros en el escenario, un fallo de pintado— se anunciaba
  // como "sin conexion con el escenario compartido". Con la red perfecta, eso
  // manda al consultor a mirar el wifi delante del cliente mientras el problema
  // real esta en otra parte. Cada fallo dice ahora lo que es.
  let snapshot;

  try {
    snapshot = await readScenarioFromFirebase();
  } catch (error) {
    avisarDeFalloDeLectura(error);

    // Suscribirse IGUALMENTE, que es lo contrario de lo que se hacia.
    //
    // Antes este catch retornaba, y ahi se rompia todo: las escrituras no
    // comprueban si la lectura inicial funciono, asi que seguian subiendo,
    // mientras que sin onValue no bajaba nada nunca. Al primer cambio el chip
    // se ponia verde y la sincronizacion quedaba en un solo sentido, en
    // silencio: el consultor creia estar colaborando y estaba pisando el
    // trabajo del resto del equipo sin verlo.
    //
    // Y onValue es justo el camino por el que el SDK se recupera solo cuando
    // vuelve la red, asi que se renunciaba a el cuando mas falta hacia.
    subscribeToSharedScenario();
    return;
  }

  try {
    const remoteScenario = snapshot.exists()
      ? snapshot.val()
      : null;

    if (!remoteScenario) {
      const initialPayload =
        localScenario || buildScenarioPayload();

      escribirAlmacenamiento(
        STORAGE_KEY,
        JSON.stringify(initialPayload),
      );

      try {
        await saveScenarioToFirebase(
          initialPayload,
        );

        updateSaveStatus(
          "saved",
          "Guardado ✓",
        );
      } catch (error) {
        console.warn(
          "El escenario se ha guardado localmente, pero no se ha podido crear en Firebase.",
          error,
        );

        marcarFalloDeSincronia(
          "No se ha creado el escenario compartido",
          "Tus datos están guardados en este navegador, pero el escenario compartido no ha llegado a crearse: " +
            "quien abra el enlace no verá nada. Comprueba la conexión y vuelve a intentarlo.",
        );
      }

      subscribeToSharedScenario();
      return;
    }

    // En un escenario compartido la fuente de verdad es Firebase. Antes, si la
    // copia local parecía más reciente, se subía entera y eso borraba los cambios
    // que otras personas hubieran hecho mientras tanto. Ahora se aplica siempre lo
    // remoto: cada edición propia ya sube al instante por su ruta concreta.
    isApplyingRemoteScenario = true;

    try {
      // Al abrir el enlace si tiene sentido ir al dominio del escenario.
      applyScenarioPayload(remoteScenario, {
        seguirDominioDelEscenario: true,
      });

      escribirAlmacenamiento(
        STORAGE_KEY,
        JSON.stringify(remoteScenario),
      );

      populateCapacityFilter();
      repintarTodo();
    } finally {
      isApplyingRemoteScenario = false;
    }

    updateSaveStatus(
      "saved",
      "Sincronizado ✓",
    );

    subscribeToSharedScenario();
  } catch (error) {
    isApplyingRemoteScenario = false;
    pendingScenarioWrites = 0;

    console.warn(
      "El escenario compartido se ha leído, pero no se ha podido aplicar.",
      error,
    );

    marcarFalloDeSincronia(
      "El escenario compartido no se ha podido mostrar",
      "Se ha leído el escenario compartido, pero la herramienta no ha podido aplicarlo en pantalla. " +
        "La conexión funciona, así que cambiar de red no lo arregla: el problema está en los datos o " +
        "en el pintado. Recarga la página; si sigue igual, avisa a quien mantiene la herramienta.",
      { avisar: false },
    );

    showNotice(
      "Se ha leído el escenario compartido, pero no se ha podido mostrar. La conexión funciona: "
        + "recarga la página.",
      "aviso",
    );
  }
}


/**
 * Distingue un rechazo por permisos de una caida de red.
 *
 * Decir "comprueba la conexion" cuando el problema son los permisos es un
 * consejo falso, y de los que hacen perder media hora delante de un cliente:
 * repetir el cambio no arregla nada y la red esta perfecta. Con `auth != null`
 * en las reglas, este es el error que sale cuando la sesion anonima no ha
 * llegado o ha dejado de valer, y el arreglo es recargar, no cambiar de wifi.
 *
 * Vivia dentro de avisarDeFalloDeLectura(), asi que solo la ruta de lectura
 * sabia distinguirlos: al escribir y al perder la suscripcion se seguia
 * mandando a mirar el wifi. Ahora lo comparten los tres caminos.
 */
function esFalloDePermisos(error) {
  return (
    error?.code === "PERMISSION_DENIED" ||
    String(error?.code || "").toLowerCase().includes("permission") ||
    String(error?.message || "").toLowerCase().includes("permission_denied") ||
    !getUsuarioActual()
  );
}


/**
 * Avisa de que el escenario compartido no se ha podido leer.
 *
 * Esta separado de initializeSharedScenario() para que el catch de alli cubra
 * solo el volcado en pantalla y no herede estos mensajes, que hablan de red.
 */
function avisarDeFalloDeLectura(error) {
  isApplyingRemoteScenario = false;
  pendingScenarioWrites = 0;

  // Ahora mismo no hay canal de vuelta. Si la suscripcion que se abre justo
  // despues llega a entregar un snapshot, vuelve a true por su cuenta.
  marcarCanalDeVuelta(false);

  console.warn(
    "Firebase no está disponible. Se conserva la copia local.",
    error,
  );

  const esPermiso = esFalloDePermisos(error);

  marcarFalloDeSincronia(
    esPermiso
      ? "Sin permiso para abrir el escenario compartido"
      : "Sin conexión con el escenario compartido",
    esPermiso
      ? "Este navegador no ha podido identificarse, así que el escenario compartido no le deja entrar. " +
        "Estás viendo la copia local y tus cambios no le llegan al resto del equipo. Recarga la página; " +
        "si sigue igual, exporta una copia antes de cerrar."
      : "No se ha podido conectar con el escenario compartido. Estás trabajando sobre la copia de este navegador " +
        "y tus cambios no le llegan al resto del equipo. Si vas a trabajar así, exporta una copia antes de cerrar.",
    { avisar: false },
  );

  avisarConReconexion(
    esPermiso
      ? "Este navegador no ha podido identificarse y el escenario compartido no le deja entrar. Tus cambios se "
        + "guardan aquí, pero el resto del equipo no los ve."
      : "No se ha podido conectar con el escenario compartido. Tus cambios se guardan en este navegador, "
        + "pero el resto del equipo no los ve.",
    "aviso",
  );
}




function subscribeToSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  // Una suscripcion anterior se cancela antes de abrir la nueva. Desde que se
  // puede reintentar la conexion sin recargar, llamar aqui dos veces es normal,
  // y dos listeners vivos repintan la aplicacion dos veces por cada snapshot.
  if (cancelarSuscripcionRemota) {
    cancelarSuscripcionRemota();
    cancelarSuscripcionRemota = null;
  }

  cancelarSuscripcionRemota = onValue(
    scenarioDatabaseRef,
    (snapshot) => {
      // Que llegue un snapshot es la unica prueba de que hay canal de vuelta.
      // Se marca aqui, y no al suscribirse, porque suscribirse no garantiza
      // nada: onValue acepta el listener aunque la conexion nunca llegue.
      const seHabiaCaido = hayCanalDeVuelta() === false;

      marcarCanalDeVuelta(true);

      // Un aviso de "no se ha podido conectar" que sigue en pantalla cuando ya
      // hay conexion es peor que no avisar: manda a buscar un problema que ya
      // no existe. Ahora que la aplicacion se recupera sola, hay que decirlo.
      if (seHabiaCaido) {
        showNotice(
          "Conexión con el escenario compartido restablecida. Vuelves a ver los cambios del resto del equipo.",
          "exito",
        );
      }

      const remoteScenario = snapshot.val();

      if (!remoteScenario) {
        return;
      }

      // Mientras hay una escritura nuestra en vuelo, el snapshot puede ser
      // anterior a nuestro cambio y provocaría un parpadeo. Antes se descartaba
      // y se perdía para siempre; ahora se aparca y se aplica al terminar.
      if (pendingScenarioWrites > 0) {
        snapshotRemotoPendiente = remoteScenario;
        return;
      }

      aplicarEscenarioRemoto(remoteScenario);
    },
    (error) => {
      // Un listener cancelado no se vuelve a llamar nunca, asi que a partir de
      // aqui no llega nada del resto del equipo hasta que alguien reconecte.
      marcarCanalDeVuelta(false);
      cancelarSuscripcionRemota = null;

      console.warn(
        "Se perdió la conexión con Firebase.",
        error,
      );

      const esPermiso = esFalloDePermisos(error);

      marcarFalloDeSincronia(
        esPermiso
          ? "Sin permiso: no se está compartiendo"
          : "Se ha perdido la conexión",
        esPermiso
          ? "El escenario compartido ha dejado de aceptar a este navegador. La conexión funciona, así que " +
            "cambiar de red no lo arregla. Tus cambios se siguen guardando aquí y no se han perdido: usa " +
            "«Reconectar» en el aviso, y si sigue igual recarga la página."
          : "Se ha perdido la conexión con el escenario compartido. Tus cambios se siguen guardando en este " +
            "navegador y no se han perdido, pero no le llegan al resto del equipo y tampoco ves los suyos. " +
            "Usa «Reconectar» en el aviso cuando vuelvas a tener conexión.",
        { avisar: false },
      );

      avisarConReconexion(
        esPermiso
          ? "El escenario compartido ha dejado de aceptar a este navegador. Tus cambios se guardan aquí, pero " +
            "ni salen ni entran."
          : "Se ha perdido la conexión con el escenario compartido. Tus cambios se guardan en este navegador, " +
            "pero ni le llegan al resto del equipo ni ves los suyos.",
      );
    },
  );
}


/**
 * Aviso persistente con un boton para reintentar la conexion.
 *
 * Hasta ahora el unico camino de vuelta era recargar la pagina, y recargar en
 * mitad de un taller cuesta el contexto entero: filtros, capacidades
 * desplegadas, posicion en la tabla y el detalle que estuviera abierto.
 */
function avisarConReconexion(mensaje, tipo = "error") {
  showNotice(mensaje, tipo, true, {
    texto: "Reconectar",
    alHacerClic: reconectarEscenarioCompartido,
  });
}


/** Reintenta la conexión con el escenario compartido sin recargar la página. */
async function reconectarEscenarioCompartido() {
  if (!scenarioDatabaseRef) {
    return;
  }

  ocultarAviso();
  updateSaveStatus("saving", "Reconectando...");

  // La identidad se rehace primero: si el fallo era de permisos, volver a leer
  // con la misma sesion invalida da exactamente el mismo error.
  if (!getUsuarioActual()) {
    await inicializarIdentidad();
  }

  await initializeSharedScenario();
}


/**
 * Aplica un snapshot que llegó mientras guardábamos.
 *
 * Antes se comparaban marcas de tiempo para decidir si valía la pena aplicarlo,
 * pero como cada edición local ponía `updatedAt` a "ahora", los cambios de otras
 * personas quedaban sistemáticamente descartados. En un escenario compartido la
 * fuente de verdad es Firebase, así que se aplica siempre.
 */
function aplicarSnapshotPendiente() {
  if (pendingScenarioWrites > 0 || !snapshotRemotoPendiente) {
    return;
  }

  const pendiente = snapshotRemotoPendiente;
  snapshotRemotoPendiente = null;

  aplicarEscenarioRemoto(pendiente);
}




function aplicarEscenarioRemoto(remoteScenario) {
  try {
    isApplyingRemoteScenario = true;

    applyScenarioPayload(remoteScenario);

    escribirAlmacenamiento(
      STORAGE_KEY,
      JSON.stringify(remoteScenario),
    );

    populateCapacityFilter();
    repintarTodo();

    updateSaveStatus("saved", "Sincronizado ✓");
  } catch (error) {
    console.error(
      "No se pudo aplicar el escenario remoto.",
      error,
    );

    showNotice(
      "Ha llegado un cambio del escenario compartido que no se ha podido aplicar. Recarga la página "
        + "para ponerte al día.",
      "error",
    );
  } finally {
    isApplyingRemoteScenario = false;
  }
}


/**
 * Sin identidad no se intenta escribir en el escenario compartido.
 *
 * Con `auth != null` en las reglas esa escritura se rechaza entera, y el error
 * llega como un fallo de red generico: "comprueba la conexion y vuelve a hacer
 * el cambio". Es un consejo falso —repetirlo no arregla nada— y de los que
 * hacen perder media hora en una sesion. Asi el chip dice lo que pasa de
 * verdad y el cambio ni se intenta.
 *
 * La guarda es sincrona y no espera a ninguna promesa a proposito. init() llama
 * a renderAll() antes de await inicializarIdentidad(), asi que hay una ventana
 * de milisegundos con controles ya editables; preguntar por la identidad la
 * cierra sin depender del orden de arranque, que es fragil por naturaleza.
 */
function hayIdentidadParaEscribir() {
  if (getUsuarioActual()) {
    return true;
  }

  marcarFalloDeSincronia(
    "Sin identidad: no se está compartiendo",
    "Este navegador no ha podido identificarse contra Firebase, y sin identidad el escenario " +
      "compartido rechaza las escrituras. Tus cambios están guardados aquí y no se han perdido. " +
      "Recarga la página; si sigue igual, exporta una copia con Escenario → Guardar una copia.",
  );

  return false;
}


/**
 * Una escritura completa, repartida en una ruta por dominio.
 *
 * Antes era un set() de la raiz, y ahi estaba el problema: buildScenarioPayload()
 * solo serializa los dominios que estan en memoria, asi que un dominio cuyo JSON
 * no hubiera cargado no viajaba en el payload... y un set() de raiz borra lo que
 * no viene. Es decir, que a un consultor le fallara la descarga de un archivo
 * BORRABA ese dominio en Firebase para todo el equipo, mientras la pantalla
 * decia "el resto funciona con normalidad".
 *
 * Con un update() multi-ruta, cada dominio cargado se reemplaza entero —que es
 * lo que se quiere al importar o al restaurar— y la rama de un dominio ausente
 * se queda intacta. Las claves raiz son exactamente las cuatro que admiten las
 * reglas, que rechazan cualquier otra con `$otroCampoRaiz: false`.
 */
function rutasDeEscrituraCompleta(sanitizado) {
  const rutas = {
    version: sanitizado.version,
    updatedAt: sanitizado.updatedAt,
  };

  if (sanitizado.activeDomainId !== undefined) {
    rutas.activeDomainId = sanitizado.activeDomainId;
  }

  Object.entries(sanitizado.domains || {}).forEach(([domainId, dominio]) => {
    rutas[`domains/${domainId}`] = dominio;
  });

  return rutas;
}




function saveScenarioToFirebase(
  payload,
  timeoutMs = 8000,
) {
  if (!scenarioDatabaseRef) {
    return Promise.resolve();
  }

  const sanitizedPayload =
    sanitizeScenarioForFirebase(payload);

  return conLimiteDeEspera(
    update(
      scenarioDatabaseRef,
      rutasDeEscrituraCompleta(sanitizedPayload),
    ),
    "Tiempo de espera agotado al guardar en Firebase",
    timeoutMs,
  );
}


/**
 * Guarda solo las rutas que han cambiado, en lugar del escenario completo.
 *
 * Escribir el payload entero hacía que dos personas editando dominios distintos
 * se borrasen el trabajo mutuamente: la última en guardar sobrescribía todo.
 * Con rutas concretas, dos cambios sobre campos distintos ya no colisionan.
 *
 * `rutas` usa claves relativas al escenario, por ejemplo:
 *   { "domains/fpa/items/fpa-1-2/scores/procesos": 3 }
 */
function persistGranularChange(rutas) {
  syncActiveDomainState();

  // La copia local sigue guardándose entera: es una caché, no la fuente de verdad.
  escribirAlmacenamiento(
    STORAGE_KEY,
    JSON.stringify(buildScenarioPayload()),
  );

  if (!scenarioDatabaseRef) {
    updateSaveStatus("saved", "Guardado local ✓");
    return;
  }

  if (isApplyingRemoteScenario) {
    return;
  }

  if (!hayIdentidadParaEscribir()) {
    return;
  }

  pendingScenarioWrites += 1;
  updateSaveStatus("saving", "Guardando...");

  const carga = {
    ...rutas,
    updatedAt: new Date().toISOString(),
  };

  // Con limite de espera, igual que saveScenarioToFirebase(). Sin el, un
  // update() que no resuelve deja pendingScenarioWrites por encima de cero, y
  // mientras tanto TODOS los snapshots remotos se aparcan sin aplicarse: la red
  // degradada dejaba el chip en "Guardando..." y los cambios del equipo
  // invisibles, sin decir por que.
  conLimiteDeEspera(
    update(scenarioDatabaseRef, carga),
    "Tiempo de espera agotado al guardar el cambio en Firebase",
  )
    .then(() => {
      marcarEscrituraCorrecta();
    })
    .catch((error) => {
      console.warn(
        "No se pudo guardar el cambio en Firebase. Se conserva la copia local.",
        error,
      );

      const esPermiso = esFalloDePermisos(error);

      marcarFalloDeSincronia(
        esPermiso
          ? "Sin permiso: el cambio no se ha compartido"
          : "El último cambio no se ha compartido",
        esPermiso
          ? "El cambio está guardado en este navegador, pero el escenario compartido lo ha rechazado por " +
            "permisos. La conexión funciona, así que repetir el cambio no lo arregla: usa «Reconectar» en el " +
            "aviso, y si sigue igual recarga la página."
          : "El cambio está guardado en este navegador, pero no se ha podido enviar al escenario compartido y el " +
            "resto del equipo no lo ve. Comprueba la conexión y vuelve a hacer el cambio.",
      );
    })
    .finally(() => {
      pendingScenarioWrites = Math.max(0, pendingScenarioWrites - 1);
      aplicarSnapshotPendiente();
    });
}


/** Ruta de un campo de subcapacidad dentro del escenario. */
function rutaDeItem(itemId, campo) {
  return `domains/${state.activeDomainId}/items/${itemId}/${campo}`;
}


/**
 * Cambio sobre una subcapacidad, acompañado de quién lo hizo.
 *
 * La autoría va en la misma escritura que el dato: si fueran dos escrituras
 * separadas, una podría fallar y dejar el cambio atribuido a quien no fue.
 */
export function persistItemChange(itemId, campo, valor) {
  const rutas = {
    [rutaDeItem(itemId, campo)]: valor,
  };

  const autoria = marcaDeAutoria();

  if (autoria) {
    rutas[rutaDeItem(itemId, "lastEditedBy")] = autoria;
  }

  persistGranularChange(rutas);
}


/**
 * Objetivos del dominio activo, en el formato que se guarda en Firebase.
 *
 * Los objetivos se escriben por dominio y no por capacidad porque la clave sería
 * el nombre de la capacidad, que puede contener caracteres que Firebase no admite
 * en una ruta. Aun así el alcance es mucho menor que reescribir todo el escenario.
 */
export function persistTargetsDelDominioActivo() {
  const activeDomain = state.domains[state.activeDomainId];

  if (!activeDomain) {
    return;
  }

  persistGranularChange({
    [`domains/${state.activeDomainId}/targets`]: serializeTargetsForFirebase(
      activeDomain.items,
      activeDomain.targets,
      normalizeTargetValue(
        activeDomain.meta?.targetMaturity,
        DEFAULT_TARGET_MATURITY,
      ),
    ),
  });
}




export function persistScenario() {
  syncActiveDomainState();

  const payload = buildScenarioPayload();

  escribirAlmacenamiento(
    STORAGE_KEY,
    JSON.stringify(payload),
  );

  if (!scenarioDatabaseRef) {
    updateSaveStatus(
      "saved",
      "Guardado local ✓",
    );

    return;
  }

  if (isApplyingRemoteScenario) {
    return;
  }

  if (!hayIdentidadParaEscribir()) {
    return;
  }

  pendingScenarioWrites += 1;

  updateSaveStatus(
    "saving",
    "Guardando...",
  );

  saveScenarioToFirebase(
    payload,
    8000,
  )
    .then(() => {
      marcarEscrituraCorrecta();
    })
    .catch((error) => {
      console.warn(
        "Firebase no respondió. Se conserva el guardado local.",
        error,
      );

      const esPermiso = esFalloDePermisos(error);

      marcarFalloDeSincronia(
        esPermiso
          ? "Sin permiso: los cambios no se han compartido"
          : "Los cambios no se han compartido",
        esPermiso
          ? "Los cambios están guardados en este navegador, pero el escenario compartido los ha rechazado por " +
            "permisos. La conexión funciona: usa «Reconectar» en el aviso, y si sigue igual recarga la página."
          : "Los cambios están guardados en este navegador, pero no se han podido enviar al escenario compartido. " +
            "Comprueba la conexión y vuelve a intentarlo.",
      );
    })
    .finally(() => {
      pendingScenarioWrites = Math.max(
        0,
        pendingScenarioWrites - 1,
      );
    });
}


/**
 * Si hay alguna escritura en vuelo.
 *
 * Lo pregunta el aviso de cerrar la pestana: con una escritura sin confirmar,
 * cerrar pierde ese cambio en el escenario compartido aunque la copia local ya
 * lo tenga.
 */
export function hayEscriturasEnVuelo() {
  return pendingScenarioWrites > 0;
}
