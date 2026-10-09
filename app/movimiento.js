/**
 * El movimiento de la herramienta: cifras que cuentan, barras que se deslizan,
 * paneles que se despliegan y salidas que se funden.
 *
 * Tres reglas para todo lo que se anima desde aqui:
 *
 * - Corto. Entre 200 y 400 ms cada cosa; el cierre del taller encadena varias,
 *   pero ninguna espera a que termine otra para dejarse usar.
 * - Solo lo que ha cambiado. Una cifra que no se ha movido no cuenta, y una
 *   barra que mide lo mismo no se desliza: el movimiento es la señal de que
 *   algo ha cambiado, y si se mueve todo deja de serlo.
 * - Con «reducir movimiento» en el sistema, nada. El CSS apaga sus animaciones
 *   con prefers-reduced-motion; esto es para las que se lanzan desde aqui.
 *
 * Va con la Web Animations API y no con clases de CSS cuando el punto de
 * partida es un valor que solo se conoce al pintar —el ancho que tenia una
 * barra, el alto de un panel—, que en una hoja de estilos no se puede escribir.
 */

const REDUCIR = "(prefers-reduced-motion: reduce)";

const SUAVE = "cubic-bezier(0.22, 0.61, 0.36, 1)";


export const sinMovimiento = () => Boolean(window.matchMedia?.(REDUCIR).matches);


// ---------------------------------------------------------------------------
// Cifras que cuentan
// ---------------------------------------------------------------------------

/** Los numeros tal como los escribe la herramienta: «2,54», «40», «40/152». */
const NUMERO = /\d+(?:,\d+)?/g;

const formatos = new Map();

function formatear(valor, decimales) {
  if (!formatos.has(decimales)) {
    formatos.set(decimales, new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
      useGrouping: false,
    }));
  }

  return formatos.get(decimales).format(valor);
}

function numeros(texto) {
  return (texto.match(NUMERO) || []).map((trozo) => ({
    valor: Number(trozo.replace(",", ".")),
    decimales: trozo.includes(",") ? trozo.split(",")[1].length : 0,
  }));
}

const forma = (texto) => texto.replace(NUMERO, "#");


/** Las cuentas en marcha de cada contenedor, para cortarlas si se repinta a mitad. */
const cuentas = new WeakMap();

function cortarLasCuentas(contenedor) {
  window.cancelAnimationFrame(cuentas.get(contenedor));
  cuentas.delete(contenedor);
  contenedor.removeAttribute("aria-busy");
}


/**
 * Cada nodo de texto pasa de lo que decia `desde` a lo que dice ahora, numero
 * a numero. Solo cuenta si los dos textos tienen la misma forma —«39/152» y
 * «40/152», no «-» y «2,54»— y algo ha cambiado: lo que no se ha movido se
 * queda quieto, como el 152.
 *
 * Mientras cuenta, el contenedor se marca ocupado: un lector de pantalla
 * anuncia el valor final y no cada paso. Al terminar, el texto es exactamente
 * el que se pinto, no una aproximacion.
 */
export function contarTextos(contenedor, cambios, { duracion = 400, retraso = 0 } = {}) {
  cortarLasCuentas(contenedor);

  const tramos = cambios
    .map(({ nodo, desde }) => {
      const final = nodo.data;

      if (typeof desde !== "string" || desde === final || forma(desde) !== forma(final)) {
        return null;
      }

      const de = numeros(desde);
      const a = numeros(final);

      return { nodo, final, pares: a.map((numero, indice) => ({ ...numero, desde: de[indice].valor })) };
    })
    .filter(Boolean);

  if (!tramos.length || sinMovimiento()) {
    return;
  }

  contenedor.setAttribute("aria-busy", "true");

  const escribir = (avance) => {
    tramos.forEach(({ nodo, final, pares }) => {
      let indice = 0;

      nodo.data = final.replace(NUMERO, () => {
        const { valor, desde, decimales } = pares[indice++];

        return formatear(desde + (valor - desde) * avance, decimales);
      });
    });
  };

  escribir(0);

  let inicio = null;

  const paso = (ahora) => {
    inicio ??= ahora;

    const avance = Math.min(1, Math.max(0, (ahora - inicio - retraso) / duracion));

    escribir(1 - (1 - avance) ** 3);

    if (avance < 1) {
      cuentas.set(contenedor, window.requestAnimationFrame(paso));
    } else {
      tramos.forEach(({ nodo, final }) => {
        nodo.data = final;
      });
      cortarLasCuentas(contenedor);
    }
  };

  cuentas.set(contenedor, window.requestAnimationFrame(paso));
}


/** El primer nodo de texto con algun numero dentro de `elemento`. */
export function textoConNumero(elemento) {
  if (!elemento) {
    return null;
  }

  const recorrido = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);

  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    if (NUMERO.test(nodo.data)) {
      NUMERO.lastIndex = 0;
      return nodo;
    }
  }

  return null;
}


/** El mismo texto con todos sus numeros a cero, conservando sus decimales. */
export const aCero = (texto) => texto.replace(NUMERO, (trozo) => formatear(0, trozo.includes(",") ? trozo.split(",")[1].length : 0));


// ---------------------------------------------------------------------------
// KPIs y barras que se mueven al repintar
// ---------------------------------------------------------------------------

/**
 * Repinta `contenedor` con `pintar()` y anima lo que ha cambiado: las cifras
 * de `selectorDeCifras` cuentan desde su valor de antes y las barras de
 * `selectorDeBarras` se deslizan desde su ancho de antes.
 *
 * Se emparejan por su posicion, que no cambia: cuatro KPIs, cuatro barras de
 * prioridad, tres de palanca. Una vista oculta no se repinta (ver renderAll),
 * asi que al volver a ella lo de antes es lo que se vio la ultima vez, y lo
 * que se mueve es exactamente lo que ha cambiado mientras tanto.
 */
export function repintarConMovimiento(contenedor, pintar, { selectorDeCifras = "", selectorDeBarras = "" } = {}) {
  if (!contenedor) {
    pintar();
    return;
  }

  const textosDeAntes = selectorDeCifras
    ? [...contenedor.querySelectorAll(selectorDeCifras)].map((elemento) => textoConNumero(elemento)?.data ?? elemento.textContent)
    : [];
  const anchosDeAntes = selectorDeBarras
    ? [...contenedor.querySelectorAll(selectorDeBarras)].map((barra) => barra.style.width)
    : [];

  pintar();

  if (sinMovimiento()) {
    return;
  }

  if (selectorDeCifras) {
    contarTextos(
      contenedor,
      [...contenedor.querySelectorAll(selectorDeCifras)]
        .map((elemento, indice) => ({ nodo: textoConNumero(elemento), desde: textosDeAntes[indice] }))
        .filter(({ nodo }) => nodo),
    );
  }

  if (selectorDeBarras) {
    [...contenedor.querySelectorAll(selectorDeBarras)].forEach((barra, indice) => {
      deslizarAncho(barra, anchosDeAntes[indice]);
    });
  }
}


/** De un ancho a otro. Sin ancho de antes, o con el mismo, no hace nada. */
export function deslizarAncho(barra, desde, { duracion = 380, retraso = 0 } = {}) {
  const hasta = barra.style.width;

  if (!desde || !hasta || desde === hasta || sinMovimiento() || !barra.animate) {
    return;
  }

  barra.animate([{ width: desde }, { width: hasta }], {
    duration: duracion,
    delay: retraso,
    easing: SUAVE,
    fill: "backwards",
  });
}


/** Una entrada corta: funde y sube unos pixeles hasta su sitio. */
export function entrar(elemento, { duracion = 260, retraso = 0, desplazamiento = 6 } = {}) {
  if (!elemento?.animate || sinMovimiento()) {
    return;
  }

  elemento.animate(
    [
      { opacity: 0, translate: `0 ${desplazamiento}px` },
      { opacity: 1, translate: "0 0" },
    ],
    { duration: duracion, delay: retraso, easing: SUAVE, fill: "backwards" },
  );
}


/**
 * Un fundido, sin desplazamiento. Es el de las vistas: un translate en una
 * seccion crea un contexto nuevo para lo fijo y lo pegajoso de dentro —el
 * encabezado del Roadmap— y lo soltaba durante la animacion.
 */
export function fundir(elemento, { duracion = 220 } = {}) {
  if (!elemento?.animate || sinMovimiento()) {
    return;
  }

  elemento.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duracion, easing: "ease-out" });
}


// ---------------------------------------------------------------------------
// Salidas
// ---------------------------------------------------------------------------

/**
 * Oculta `elemento` despues de su animacion de salida, la clase `se-va` del
 * CSS. Si alguien lo vuelve a ensenar a mitad —un aviso nuevo que sustituye al
 * que se iba—, la clase desaparece y la salida no llega a ocultarlo.
 *
 * Con un tope, por si la animacion no llega a terminar nunca: con la pestana
 * en segundo plano o un estilo que no la define, el elemento se quedaria a la
 * vista para siempre.
 */
export function ocultarConSalida(elemento, { tope = 400, alOcultar = () => {} } = {}) {
  if (!elemento || elemento.hidden) {
    return;
  }

  if (sinMovimiento()) {
    elemento.hidden = true;
    alOcultar();
    return;
  }

  const terminar = () => {
    if (elemento.classList.contains("se-va")) {
      elemento.classList.remove("se-va");
      elemento.hidden = true;
      alOcultar();
    }
  };

  elemento.classList.add("se-va");
  elemento.addEventListener("animationend", terminar, { once: true });
  window.setTimeout(terminar, tope);
}


// ---------------------------------------------------------------------------
// Paneles que se despliegan
// ---------------------------------------------------------------------------

/**
 * Los <details> de la herramienta —«Ver detalle», los objetivos, la leyenda de
 * la IA— se abrian y se cerraban de golpe, y lo que habia debajo saltaba. Aqui
 * se intercepta el clic en su <summary> y se anima el alto del <details>
 * entero, del de su cabecera al de todo y al reves.
 *
 * Un solo oyente en el documento y no uno por tarjeta: las tarjetas se
 * repintan, y el oyente tendria que volver a ponerse en cada una.
 *
 * El estado se sigue cambiando con `open`, asi que el evento `toggle` llega
 * igual y lo que escucha —el texto «Ocultar detalle», la lista de abiertas—
 * no se entera. Al cerrar llega al terminar de plegarse, que es cuando se
 * cierra de verdad.
 */
export function activarDesplieguesSuaves(raiz = document) {
  raiz.addEventListener("click", (event) => {
    const resumen = event.target.closest?.("summary");
    const detalles = resumen?.parentElement;

    if (
      event.defaultPrevented
      || !(detalles instanceof HTMLDetailsElement)
      || detalles.querySelector(":scope > summary") !== resumen
      || sinMovimiento()
      || !detalles.animate
    ) {
      return;
    }

    // Un control dentro de la cabecera hace lo suyo, no despliega.
    const control = event.target.closest("a, button, input, select, textarea, label");

    if (control && control !== resumen && resumen.contains(control)) {
      return;
    }

    event.preventDefault();
    alternar(detalles);
  });
}


const despliegues = new WeakMap();

function alternar(detalles) {
  const anterior = despliegues.get(detalles);
  const altoActual = detalles.getBoundingClientRect().height;
  const abrir = anterior ? !anterior.abrir : !detalles.open;

  anterior?.animacion.cancel();

  // Los dos altos se miden de verdad, cerrando y abriendo en la misma tarea:
  // el navegador no pinta entre medias, y calcularlos a mano —cabecera,
  // relleno, bordes, margenes negativos del <summary>— fallaba en uno u otro.
  detalles.open = false;
  const altoCerrado = detalles.getBoundingClientRect().height;
  detalles.open = true;
  const altoAbierto = detalles.getBoundingClientRect().height;
  const hasta = abrir ? altoAbierto : altoCerrado;

  detalles.style.overflow = "hidden";

  const animacion = detalles.animate(
    [{ height: `${altoActual}px` }, { height: `${hasta}px` }],
    { duration: Math.min(360, 180 + Math.abs(hasta - altoActual) * 0.3), easing: SUAVE },
  );

  despliegues.set(detalles, { animacion, abrir });

  animacion.onfinish = () => {
    despliegues.delete(detalles);
    detalles.style.overflow = "";
    detalles.open = abrir;
  };

  animacion.oncancel = () => {
    detalles.style.overflow = "";
  };
}
