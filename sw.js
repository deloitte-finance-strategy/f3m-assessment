/**
 * Lo que hace que la herramienta se abra sin conexion.
 *
 * La red de la sala del cliente es justo donde se usa la herramienta, y la que
 * menos se controla. Si la wifi caia, recargar la pagina la dejaba en blanco, y
 * los documentos de la biblioteca no se abrian. Este service worker guarda en
 * el navegador, la primera vez que se abre, lo que hace falta para trabajar en
 * modo local: el codigo, los datos de los nueve dominios y los PDF de la
 * biblioteca.
 *
 * Todo va primero a la red, y solo si no contesta, a lo guardado. Lo contrario
 * —servir lo guardado y no preguntar— seria mas rapido con la version que
 * lleva ?v=, pero en local se edita un modulo y se recarga sin subir la
 * version, y con lo guardado delante el cambio no se veria nunca. Con la red
 * primero, conectado todo es como sin service worker, y una version nueva no
 * puede quedarse atras.
 *
 * Una red que no contesta no siempre falla: en una wifi saturada la peticion se
 * queda colgada. Por eso a los ESPERA_DE_LA_RED_MS se sirve lo guardado, y la
 * respuesta de la red, si llega, se guarda para la proxima.
 *
 * Solo lo de esta web. Firebase y su SDK van por su camino: sin red no hay
 * escenario compartido, y la aplicacion ya lo dice con el chip de guardado.
 *
 * VERSION es la de index.html, y scripts/check_module_version.py lo comprueba
 * en el CI. Al desplegar cambia este archivo: el navegador instala el service
 * worker nuevo, que guarda la version nueva y borra la anterior.
 *
 * Es un script clasico y no un modulo, y no lleva ?v=: el navegador lo pide a
 * la red cada vez que comprueba si hay uno nuevo, sin pasar por su cache.
 */

const VERSION = "33";
const CACHE = `f3m-v${VERSION}`;
const ESPERA_DE_LA_RED_MS = 4000;


self.addEventListener("install", (event) => {
  event.waitUntil(guardarLoNecesario().then(() => self.skipWaiting()));
});


self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(
        nombres.filter((nombre) => nombre.startsWith("f3m-") && nombre !== CACHE).map((nombre) => caches.delete(nombre)),
      ))
      .then(() => self.clients.claim()),
  );
});


self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(primeroLaRed(event));
});


/**
 * El codigo y los datos se guardan juntos o no se guardan: una copia a medias
 * pareceria funcionar sin red y fallaria al recargar. Los PDF van aparte y sin
 * esa exigencia: pesan mucho, y si alguno no llega se guarda la primera vez
 * que se abra.
 */
async function guardarLoNecesario() {
  const cache = await caches.open(CACHE);
  const pagina = await pedir("./");
  const html = await pagina.clone().text();

  await cache.put(new URL("./", self.registration.scope).href, pagina);

  const codigo = [...html.matchAll(/(?:href|src)="([^"#:]+\.(?:js|css|json)(?:\?[^"]*)?)"/g)].map((resultado) => resultado[1]);
  const catalogo = await pedirJson("data/domains.json");
  const biblioteca = await pedirJson("data/biblioteca.json");
  const datos = [
    "data/domains.json",
    "data/casos-ia.json",
    "data/biblioteca.json",
    ...(catalogo.domains || []).map((dominio) => dominio.dataUrl).filter(Boolean),
  ];
  const documentos = (biblioteca.documentos || []).map((documento) => documento.archivo).filter(Boolean);

  await cache.addAll([...new Set([...codigo, ...datos])].map(peticionSinCache));
  await Promise.allSettled(documentos.map((documento) => cache.add(peticionSinCache(documento))));
}


// Sin la cache HTTP del navegador: lo que se guarda tiene que ser lo publicado.
function peticionSinCache(ruta) {
  return new Request(new URL(ruta, self.registration.scope).href, { cache: "no-cache" });
}


async function pedir(ruta) {
  const respuesta = await fetch(peticionSinCache(ruta));

  if (!respuesta.ok) {
    throw new Error(`${ruta}: ${respuesta.status}`);
  }

  return respuesta;
}


async function pedirJson(ruta) {
  return (await pedir(ruta)).json();
}


async function primeroLaRed(event) {
  const { request } = event;
  const guardada = loGuardado(request);
  const red = fetch(request).then((respuesta) => {
    // Solo lo que esta entero: un 206 es un trozo del PDF, y un error no se guarda.
    if (respuesta.status === 200 && respuesta.type === "basic") {
      const copia = respuesta.clone();

      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(claveDeGuardado(request), copia)).catch(() => {}));
    }

    return respuesta;
  });

  // Que la red siga y se guarde aunque se haya servido lo guardado.
  event.waitUntil(red.catch(() => {}));

  try {
    return await Promise.race([red, esperar(ESPERA_DE_LA_RED_MS).then(() => guardada.then((copia) => copia || red))]);
  } catch (error) {
    const copia = await guardada;

    if (copia) {
      return copia;
    }

    throw error;
  }
}


/**
 * La pagina se abre con ?scenario= y con lo que sea, pero es una sola: se
 * guarda y se busca con la direccion de la raiz. El resto, con la suya exacta,
 * porque la consulta es la version.
 */
function claveDeGuardado(request) {
  const raiz = new URL("./", self.registration.scope);
  const { pathname } = new URL(request.url);

  if (request.mode === "navigate" && (pathname === raiz.pathname || pathname === `${raiz.pathname}index.html`)) {
    return raiz.href;
  }

  return request;
}


function loGuardado(request) {
  return caches.match(claveDeGuardado(request));
}


function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
