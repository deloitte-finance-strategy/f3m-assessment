/**
 * La conexion con Firebase, y nada mas.
 *
 * La configuracion esta en claro a proposito. En una aplicacion web de Firebase
 * la apiKey y la databaseURL son publicas por diseno y NO son un secreto
 * filtrado: la autorizacion la dan las reglas de database.rules.json, no el
 * secreto de la clave. SECURITY.md lo explica entero, incluido lo que esto no
 * protege.
 *
 * El SDK se importa de gstatic y no se vendoriza, al reves que Chart.js: son
 * ~500 KB en tres modulos con imports relativos entre ellos, y gstatic tiene
 * que funcionar de todas formas para que funcione la base de datos.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import { scenarioId } from "./estado.js?v=11";
import { borrarDeAlmacenamiento } from "./almacenamiento.js?v=11";


// Configuración de Firebase del proyecto fpa-assessment-mvp
const firebaseConfig = {
  apiKey: "AIzaSyAyHWPnALB5regOMmeR3C-vVLDTmh6fEio",
  authDomain: "fpa-assessment-mvp.firebaseapp.com",
  databaseURL: "https://fpa-assessment-mvp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fpa-assessment-mvp",
  storageBucket: "fpa-assessment-mvp.firebasestorage.app",
  messagingSenderId: "690455183937",
  appId: "1:690455183937:web:e9be8095b43f341589fcc0",
  measurementId: "G-XBHVPCJFFD",
};


// Inicialización de Firebase
const firebaseApp = initializeApp(firebaseConfig);



/**
 * Olvida el fallo de WebSocket que el SDK dejó apuntado la vez anterior.
 *
 * Cuando un intento de WebSocket falla, el SDK de la Realtime Database escribe
 * `firebase:previous_websocket_failure` en localStorage y a partir de ahí deja
 * de intentarlo: va directo a long-polling. En una red corporativa el
 * long-polling puede estar roto —medido el 2026-09-09 sobre el sitio publicado:
 * WebSocket abre en 182 ms, REST responde 200, y `/.lp` devuelve 503 en todos
 * los reintentos—, así que el escenario compartido no vuelve a conectar nunca.
 *
 * Y el flag es por origen y no lo limpia nadie: sobrevive a las recargas y a
 * cerrar el navegador. Un solo minuto malo de red en la oficina de un cliente
 * dejaba a ese consultor con la herramienta desplegada incapaz de abrir un
 * escenario compartido para siempre, con un chip rojo que le mandaba a mirar el
 * wifi teniendo la red perfecta.
 *
 * Borrarlo solo renuncia a recordar el fallo entre sesiones. El fallback sigue
 * intacto dentro de cada carga: si el WebSocket no va, el SDK cae a
 * long-polling igual. Lo que se gana es que el transporte que sí funciona se
 * vuelva a intentar siempre.
 */
borrarDeAlmacenamiento("firebase:previous_websocket_failure");


export const firebaseDatabase = getDatabase(firebaseApp);



export const firebaseAuth = getAuth(firebaseApp);




export const scenarioDatabaseRef = scenarioId ? ref(firebaseDatabase, `scenarios/${scenarioId}`) : null;


/**
 * La misma promesa, pero que falla en vez de quedarse colgada.
 *
 * Sin esto, init() esperaba a signInAnonymously() con un await sin limite: en
 * una red que descarta paquetes en silencio —un portal cautivo, una wifi de
 * invitados— la aplicacion se quedaba en "Preparando datos" para siempre, que
 * es la peor forma de fallar delante de un cliente.
 *
 * Lo comparten ya los cuatro caminos que hablan con Firebase: leer, crear,
 * escribir el escenario completo y escribir una ruta suelta. Cada uno traia su
 * propia copia del patron, y la de persistGranularChange() sencillamente no
 * existia: un update() que no resolvia dejaba los snapshots remotos aparcados
 * sin limite.
 */
export function conLimiteDeEspera(promesa, mensaje, timeoutMs = 8000) {
  let timeoutId;

  const limite = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(mensaje));
    }, timeoutMs);
  });

  return Promise.race([promesa, limite]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}


// Genera un identificador aleatorio de 128 bits. No usamos Math.random porque es predecible
// y aquí el identificador es lo único que protege el escenario.
export function createScenarioId() {
  const uuid = crypto.randomUUID();
  return `f3m-${uuid}`;
}


/**
 * Forma abreviada del identificador, para enseñarla sin comprometerlo.
 *
 * El enlace es la única credencial del escenario, así que el identificador
 * completo no puede aparecer ni en pantalla compartida ni en un PDF que se
 * envía al cliente. Cuatro caracteres bastan para distinguir dos escenarios
 * abiertos a la vez y no permiten reconstruir el enlace.
 */
export function getScenarioShortLabel() {
  if (!scenarioId) {
    return "Modo local";
  }

  return `Escenario compartido · …${scenarioId.slice(-4)}`;
}




export function getScenarioShareUrl() {
  // Construimos la URL a partir del id y no de location.href para no arrastrar
  // otros parámetros que hubiera en la barra de direcciones.
  return `${window.location.origin}${window.location.pathname}?scenario=${scenarioId}`;
}
