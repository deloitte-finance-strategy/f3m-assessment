/**
 * Buscar una subcapacidad en los nueve dominios.
 *
 * En un taller alguien dice «volvamos a lo de conciliaciones» y hasta ahora
 * habia que saber en que dominio estaba, abrirlo y bajar por sus tarjetas. El
 * buscador (Ctrl+K) lo encuentra escribiendo un trozo del nombre.
 *
 * Puras, como todo core/: entran los dominios como los da
 * getDominiosDelOverview() y la consulta, y salen los resultados.
 */

import { normalizarTextoDeBusqueda } from "./biblioteca.js?v=26";


export const MAXIMO_DE_RESULTADOS = 8;


/** Si la palabra empieza alguna de las palabras del texto, ya normalizado. */
function empiezaPalabra(texto, palabra) {
  return texto.startsWith(palabra) || texto.includes(` ${palabra}`);
}


/**
 * Lo que vale una subcapacidad para una consulta, o null si no casa.
 *
 * Todas las palabras tienen que estar, en cualquier orden y en cualquier
 * campo: «tesoreria conciliacion» encuentra las conciliaciones de Tesoreria.
 * Pesa mas lo que esta en el nombre de la subcapacidad, y mas aun si empieza
 * una palabra, para que «cierre» ponga primero «Cierre contable» que algo que
 * solo lo nombra de pasada su capacidad.
 */
function puntosDe(palabras, titulo, resto) {
  let puntos = 0;

  for (const palabra of palabras) {
    if (empiezaPalabra(titulo, palabra)) {
      puntos += 3;
    } else if (titulo.includes(palabra)) {
      puntos += 2;
    } else if (resto.includes(palabra)) {
      puntos += 1;
    } else {
      return null;
    }
  }

  return puntos;
}


/**
 * Las subcapacidades que casan, las mejores primero y en el orden de la
 * herramienta cuando empatan. `total` dice cuantas casaban en realidad, para
 * que la pantalla pueda pedir que se afine en vez de esconder las demas.
 */
export function buscarSubcapacidades(dominios, consulta, maximo = MAXIMO_DE_RESULTADOS) {
  const palabras = normalizarTextoDeBusqueda(consulta).split(" ").filter(Boolean);

  if (!palabras.length) {
    return { resultados: [], total: 0 };
  }

  const encontrados = [];

  (dominios || []).forEach((dominio) => {
    (dominio.items || []).forEach((item) => {
      const puntos = puntosDe(
        palabras,
        normalizarTextoDeBusqueda(item.subcapacidad),
        normalizarTextoDeBusqueda(`${item.capacidad || ""} ${dominio.label || ""}`),
      );

      if (puntos !== null) {
        encontrados.push({
          domainId: dominio.id,
          dominio: dominio.label || dominio.id,
          item,
          puntos,
          orden: encontrados.length,
        });
      }
    });
  });

  encontrados.sort((a, b) => b.puntos - a.puntos || a.orden - b.orden);

  return { resultados: encontrados.slice(0, maximo), total: encontrados.length };
}


/**
 * El texto partido en trozos, con los que casan con la consulta marcados.
 *
 * Se compara sin tildes pero se devuelve el texto tal cual: buscar «prevision»
 * resalta «Previsión», con su tilde. Cada letra se normaliza por separado para
 * saber a que posicion del original corresponde cada una de la version sin
 * tildes.
 */
export function trozosResaltados(texto, consulta) {
  const original = String(texto ?? "");
  const palabras = normalizarTextoDeBusqueda(consulta).split(" ").filter(Boolean);

  if (!original || !palabras.length) {
    return original ? [{ texto: original, resaltado: false }] : [];
  }

  let normalizado = "";
  const posicionEnOriginal = [];

  [...original].reduce((indice, letra) => {
    const sinTilde = normalizarTextoDeBusqueda(letra) || (letra.trim() ? "" : " ");

    for (const caracter of sinTilde) {
      normalizado += caracter;
      posicionEnOriginal.push(indice);
    }

    return indice + letra.length;
  }, 0);

  const marcado = new Array(original.length).fill(false);

  palabras.forEach((palabra) => {
    let desde = normalizado.indexOf(palabra);

    while (desde !== -1) {
      for (let k = desde; k < desde + palabra.length; k += 1) {
        marcado[posicionEnOriginal[k]] = true;
      }

      desde = normalizado.indexOf(palabra, desde + palabra.length);
    }
  });

  const trozos = [];

  [...original].reduce((indice, letra) => {
    const resaltado = marcado[indice];
    const ultimo = trozos[trozos.length - 1];

    if (ultimo && ultimo.resaltado === resaltado) {
      ultimo.texto += letra;
    } else {
      trozos.push({ texto: letra, resaltado });
    }

    return indice + letra.length;
  }, 0);

  return trozos;
}
