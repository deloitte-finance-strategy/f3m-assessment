/**
 * El logo del cliente: elegirlo, reducirlo y enseñarlo en el menu «Sesion».
 *
 * Sale en la portada del informe, en la de la preparacion y el acta, y en la
 * apertura del taller. Un entregable con el logo del cliente se lee como hecho
 * para el, y es lo primero que se ve.
 *
 * Se guarda dentro del escenario, como data URL, y no como archivo aparte: asi
 * viaja en las copias y en el escenario compartido sin otro almacenamiento.
 * Por eso se reduce antes: una foto de 4 MB no puede viajar en cada escritura.
 */

import { FORMATOS_DE_LOGO, LIMITE_DE_LOGO, normalizarLogo } from "../core/escenario.js?v=28";
import { showNotice } from "./avisos.js?v=28";
import { persistLogo } from "./persistencia.js?v=28";
import { state } from "./estado.js?v=28";


/** Lo mas grande que hace falta: en la portada ocupa unos 50 x 20 mm. */
const ANCHO_MAXIMO = 640;
const ALTO_MAXIMO = 240;

/** Un archivo mas grande que esto no es un logo, es una foto. */
const TAMANO_MAXIMO_DEL_ARCHIVO = 8 * 1024 * 1024;


let alCambiar = () => {};


/**
 * `alCambiarElLogo` es lo que repinta lo que lo enseña. Se inyecta, como en
 * las preferencias, para no importar el orquestador de vistas.
 */
export function setupLogoDelCliente({ alCambiarElLogo = () => {} } = {}) {
  alCambiar = alCambiarElLogo;

  const boton = document.getElementById("logoButton");
  const quitar = document.getElementById("logoQuitarButton");
  const entrada = document.getElementById("logoInput");

  if (!boton || !entrada) {
    return;
  }

  // El selector de archivos tiene que abrirse en el mismo clic: si no, el
  // navegador lo bloquea.
  boton.addEventListener("click", () => entrada.click());

  entrada.addEventListener("change", async () => {
    const archivo = entrada.files?.[0];

    // Vaciarlo deja volver a elegir el mismo archivo despues de quitarlo.
    entrada.value = "";

    if (archivo) {
      await ponerLogo(archivo);
    }
  });

  quitar?.addEventListener("click", () => {
    state.logo = "";
    alCambiar();
    persistLogo();
    showNotice("Logo quitado: las portadas vuelven a llevar solo el nombre del cliente.", "exito");
  });

  pintarLogoEnElMenu();
}


async function ponerLogo(archivo) {
  try {
    const logo = await reducirLogo(archivo);

    state.logo = logo;
    alCambiar();
    persistLogo();
    showNotice("Logo puesto: sale en la portada del informe, en la preparación, en el acta y en la apertura del taller.", "exito");
  } catch (error) {
    showNotice(error?.message || "No se ha podido leer esa imagen. Prueba con un PNG o un JPG.", "aviso");
  }
}


/**
 * El logo, reducido a lo que hace falta y en uno de los formatos que admiten
 * las reglas. Primero PNG, que conserva la transparencia; si pesa demasiado,
 * WebP, y si aun asi no cabe, se reduce mas.
 *
 * Un SVG se acepta, pero se guarda ya dibujado en PNG: un SVG puede llevar
 * codigo, y lo que se guarda lo puede escribir cualquiera con el enlace.
 */
export async function reducirLogo(archivo) {
  if (!/^image\//.test(archivo.type || "")) {
    throw new Error("Ese archivo no es una imagen. Elige el logo en PNG, JPG, WebP o SVG.");
  }

  if (archivo.size > TAMANO_MAXIMO_DEL_ARCHIVO) {
    throw new Error("Esa imagen pesa demasiado para ser un logo. Elige una de menos de 8 MB.");
  }

  const imagen = await cargarImagen(await leerComoDataUrl(archivo));
  const ancho = imagen.naturalWidth || ANCHO_MAXIMO;
  const alto = imagen.naturalHeight || ALTO_MAXIMO;
  let escala = Math.min(1, ANCHO_MAXIMO / ancho, ALTO_MAXIMO / alto);

  for (let intento = 0; intento < 6; intento += 1) {
    const lienzo = document.createElement("canvas");

    lienzo.width = Math.max(1, Math.round(ancho * escala));
    lienzo.height = Math.max(1, Math.round(alto * escala));
    lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

    for (const formato of FORMATOS_DE_LOGO.filter((formato) => formato !== "jpeg")) {
      const resultado = normalizarLogo(lienzo.toDataURL(`image/${formato}`, 0.9));

      if (resultado && resultado.length <= LIMITE_DE_LOGO) {
        return resultado;
      }
    }

    escala *= 0.7;
  }

  throw new Error("No se ha podido reducir esa imagen lo bastante. Prueba con el logo en un tamaño más pequeño.");
}


function leerComoDataUrl(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = () => reject(new Error("No se ha podido leer ese archivo."));
    lector.readAsDataURL(archivo);
  });
}


// Con un data URL y no con URL.createObjectURL(): la CSP solo admite imagenes
// de la propia web y data:, y un blob: se bloquearia.
function cargarImagen(fuente) {
  return new Promise((resolve, reject) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error("No se ha podido abrir esa imagen. Prueba con un PNG o un JPG."));
    imagen.src = fuente;
  });
}


/** En el menu «Sesion»: que hace la opcion, con una miniatura si ya hay logo. */
export function pintarLogoEnElMenu() {
  const etiqueta = document.getElementById("logoLabel");
  const miniatura = document.getElementById("logoMiniatura");
  const quitar = document.getElementById("logoQuitarButton");

  if (etiqueta) {
    etiqueta.textContent = state.logo ? "Cambiar el logo del cliente" : "Poner el logo del cliente";
  }

  if (miniatura) {
    miniatura.hidden = !state.logo;

    if (state.logo) {
      miniatura.src = state.logo;
    } else {
      miniatura.removeAttribute("src");
    }
  }

  if (quitar) {
    quitar.hidden = !state.logo;
  }
}
