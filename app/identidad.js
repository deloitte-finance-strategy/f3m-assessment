/**
 * Quien edita: la sesion anonima de Firebase y el nombre que se elige.
 *
 * "Anonima" quiere decir sin pedir credenciales: Firebase asigna un uid propio
 * a cada navegador. Da atribucion y una barrera frente al curl, NO control de
 * acceso: la autenticacion es abierta, asi que el enlace sigue siendo la
 * credencial. SECURITY.md lo desarrolla.
 *
 * `usuarioActual` no se exporta: en modulos ES un valor suelto se puede leer
 * pero no asignar desde fuera, y ademas media aplicacion lo consulta. Sale por
 * getUsuarioActual(), que ademas deja claro que puede ser null.
 */

import { NOMBRE_STORAGE_KEY, els } from "./estado.js?v=12";
import {
  borrarDeAlmacenamiento,
  escribirAlmacenamiento,
  leerAlmacenamiento,
} from "./almacenamiento.js?v=12";
import { abrirDialogo, showNotice } from "./avisos.js?v=12";
import { conLimiteDeEspera, firebaseAuth, scenarioDatabaseRef } from "./firebase.js?v=12";
import { marcarFalloDeSincronia } from "./indicador.js?v=12";
import { repintarTodo } from "./repintado.js?v=12";
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


// Identidad de quien edita. Queda a null si la autenticación no está disponible:
// la app debe seguir funcionando aunque Anonymous Auth no esté activado en la consola.
let usuarioActual = null;


// Baja del vigilante de sesion, para no registrarlo dos veces al reconectar.
let vigilanciaDeIdentidad = null;


/**
 * Mantiene `usuarioActual` al dia con lo que dice Firebase.
 *
 * Sin esto, `usuarioActual` se fijaba UNA vez al arrancar y no volvia a null
 * nunca. Si la sesion anonima se invalidaba a mitad de taller,
 * hayIdentidadParaEscribir() seguia dando el visto bueno, la escritura salia,
 * las reglas la rechazaban por `auth != null`, y el rechazo llegaba disfrazado
 * de fallo de red. La puerta de identidad estaba abierta con la llave rota.
 *
 * Se registra una sola vez: reconectar vuelve a llamar a inicializarIdentidad()
 * y dos vigilantes escribirian `usuarioActual` dos veces por cada cambio.
 */
function vigilarIdentidad() {
  if (vigilanciaDeIdentidad || !firebaseAuth) {
    return;
  }

  vigilanciaDeIdentidad = onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
      // El nombre es cosa del navegador, no de Firebase: se relee de su sitio
      // para no perderlo cuando el SDK refresca la sesion.
      usuarioActual = {
        uid: user.uid,
        nombre: usuarioActual?.nombre || getNombreEditor(),
      };
    } else {
      usuarioActual = null;
    }

    actualizarIndicadorDeIdentidad();
  });
}


/**
 * Autentica de forma anónima para tener un identificador estable de quien edita.
 *
 * "Anónima" quiere decir sin pedir credenciales: Firebase asigna un uid propio a
 * cada navegador. Sirve para atribuir cambios y, más adelante, para exigir
 * `auth != null` en las reglas.
 *
 * Si falla (por ejemplo si Anonymous Auth no está habilitado en la consola) se
 * continúa sin identidad. Es preferible perder la atribución a que la
 * herramienta deje de funcionar por un ajuste que no está en este repositorio.
 */
export async function inicializarIdentidad() {
  if (!scenarioDatabaseRef) {
    return;
  }

  vigilarIdentidad();

  try {
    const credencial = await conLimiteDeEspera(
      signInAnonymously(firebaseAuth),
      "Tiempo de espera agotado al autenticar",
    );

    usuarioActual = {
      uid: credencial.user.uid,
      nombre: getNombreEditor(),
    };
  } catch (error) {
    console.warn(
      "No se pudo autenticar de forma anónima. Se continúa sin identidad; " +
        "revisa que Anonymous Auth esté habilitado en la consola de Firebase.",
      error,
    );

    usuarioActual = null;

    // Esto se avisa aunque hoy no impida guardar. Es la senal de campo que dice
    // si exigir `auth != null` en las reglas dejaria a alguien sin escribir: si
    // el chip rojo aparece en la red de algun cliente, se sabe antes de
    // desplegar ese cambio y no despues.
    marcarFalloDeSincronia(
      "Sin identidad para atribuir los cambios",
      "Este navegador no ha podido identificarse contra Firebase. Los cambios se siguen guardando y "
        + "compartiendo, pero sin atribución en la columna \"Último cambio\". Avisa a quien mantiene "
        + "la herramienta.",
      { avisar: false },
    );

    showNotice(
      "Este navegador no ha podido identificarse. Los cambios se guardan y se comparten, pero sin "
        + "atribución en la columna \"Último cambio\".",
      "aviso",
    );
  }

  actualizarIndicadorDeIdentidad();
}




export function getNombreEditor() {
  return (leerAlmacenamiento(NOMBRE_STORAGE_KEY) || "").trim();
}




function setNombreEditor(nombre) {
  const limpio = (nombre || "").trim().slice(0, 60);

  if (limpio) {
    escribirAlmacenamiento(NOMBRE_STORAGE_KEY, limpio);
  } else {
    borrarDeAlmacenamiento(NOMBRE_STORAGE_KEY);
  }

  if (usuarioActual) {
    usuarioActual.nombre = limpio;
  }

  actualizarIndicadorDeIdentidad();
}




export async function pedirNombreEditor() {
  const nombre = await abrirDialogo({
    eyebrow: "Atribución de cambios",
    titulo: "Tu nombre en este escenario",
    parrafos: [
      "Así aparecerás en la columna Último cambio del Roadmap cuando edites algo. Solo se guarda en este navegador.",
    ],
    campo: {
      etiqueta: "Nombre",
      valor: getNombreEditor(),
      placeholder: "Nombre y apellido",
      maxLength: 60,
    },
    confirmar: "Guardar nombre",
  });

  if (nombre === false) {
    return; // Cancelado: no tocamos nada
  }

  setNombreEditor(nombre);
  repintarTodo();
}




export function actualizarIndicadorDeIdentidad() {
  const boton = els.editorNameButton;

  if (!boton) {
    return;
  }

  // Solo tiene sentido en un escenario compartido: en modo local no hay a quién atribuir.
  boton.hidden = !scenarioDatabaseRef;

  const nombre = getNombreEditor();

  // Se escribe SOLO el rotulo, no el boton entero. Con textContent sobre el
  // boton desaparecia la linea "Asi se atribuyen tus cambios", asi que la
  // entrada se quedaba sin explicacion mientras sus hermanas la conservaban.
  const rotulo = boton.querySelector("#editorNameLabel") || boton;

  rotulo.textContent = nombre
    ? `Editas como: ${nombre}`
    : "Poner mi nombre";

  boton.classList.toggle("sin-nombre", !nombre);
}


/** Datos de atribución que acompañan a cada cambio, si hay identidad disponible. */
export function marcaDeAutoria() {
  if (!usuarioActual) {
    return null;
  }

  return {
    uid: usuarioActual.uid,
    nombre: usuarioActual.nombre || "Sin nombre",
    at: new Date().toISOString(),
  };
}


/**
 * Quien edita ahora mismo, o null si este navegador no ha podido identificarse.
 *
 * Sale por funcion y no como valor exportado porque un valor suelto no se puede
 * asignar desde otro modulo, y ademas asi el llamante ve que puede no haber
 * nadie: la herramienta tiene que seguir funcionando aunque Anonymous Auth no
 * este activado en la consola.
 */
export function getUsuarioActual() {
  return usuarioActual;
}
