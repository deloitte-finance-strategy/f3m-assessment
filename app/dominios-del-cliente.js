/**
 * Los dominios del cliente: cuales de los nueve aplican, elegirlos y decirlo.
 *
 * A SGAE no le aplica Relacion con Inversores, y enseñarlo en el conmutador,
 * contarlo en las medias del Overview o darle un capitulo en el informe
 * confunde delante del cliente. Lo que no aplica se elige en «Sesion →
 * Dominios del cliente» y desaparece de la herramienta entera.
 *
 * Desaparecer no es borrar: sus puntuaciones siguen en el escenario y vuelven
 * tal cual si se marca otra vez. Por eso se guardan los que NO aplican
 * (`state.dominiosExcluidos`): un escenario de antes de esto no trae nada y
 * sigue enseñando los nueve.
 *
 * El filtro no vive aqui sino donde se pregunta: `dominioAplica()` en
 * app/estado.js, y sobre todo `getDominiosDelOverview()`, que es la puerta del
 * Overview, el buscador, la pestaña IA y la parte global de los informes. Aqui
 * solo se elige, se guarda y se dice en pantalla.
 */

import { normalizarDominiosExcluidos } from "../core/escenario.js?v=37";
import { losDominios } from "../core/presentacion.js?v=37";

import {
  DOMAINS,
  GRUPOS_DE_DOMINIO,
  dominioAplica,
  dominiosQueAplican,
  primerDominioQueAplica,
  state,
  syncActiveDomainState,
} from "./estado.js?v=37";

import { abrirDialogo, showNotice } from "./avisos.js?v=37";
import { avanceDeDominio, renderDomainSwitcher, switchDomain } from "./dominios.js?v=37";
import { enEscenarioCompartido } from "./firebase.js?v=37";
import { persistDominiosExcluidos } from "./persistencia.js?v=37";
import { repintarTodo } from "./repintado.js?v=37";


/** Para quien, en una frase: el nombre del cliente si lo hay. */
function paraQuien() {
  return state.cliente || "este cliente";
}


/** "Relación con Inversores", "Fiscal y Tesorería", "A, B y C". */
function enumerar(nombres) {
  if (nombres.length <= 1) {
    return nombres.join("");
  }

  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}


function nombresDeExcluidos() {
  return state.dominiosExcluidos.map((domainId) => DOMAINS[domainId]?.label || domainId);
}


/** Lo que lleva cada casilla debajo del nombre: cuanto hay hecho en ese dominio. */
function detalleDe(domainId) {
  if (!state.domains[domainId]) {
    return "No se ha podido cargar";
  }

  const { puntuadas, total } = avanceDeDominio(domainId);

  // Corto, para que quepa en una linea: lo que importa al quitar un dominio
  // es si tiene trabajo dentro, no cuantas subcapacidades tiene.
  return puntuadas ? `${puntuadas} de ${total} puntuadas` : "Sin empezar";
}


/**
 * El dialogo de «Sesion → Dominios del cliente»: los nueve, agrupados como en
 * el conmutador, marcados los que aplican.
 */
export async function pedirDominiosDelCliente() {
  const dominios = Object.values(DOMAINS);
  const grupos = GRUPOS_DE_DOMINIO.length
    ? GRUPOS_DE_DOMINIO
    : [...new Set(dominios.map((dominio) => dominio.group))];

  const marcados = await abrirDialogo({
    eyebrow: "Sesión",
    titulo: "Dominios del cliente",
    parrafos: [
      `Marca los que aplican a ${paraQuien()}. Los demás dejan de salir en la herramienta y en los `
        + "informes, y no cuentan en ninguna media.",
      "Lo puntuado en un dominio que quites no se borra: vuelve tal cual si lo marcas otra vez.",
      enEscenarioCompartido
        ? "Es del escenario compartido: lo verá todo el equipo que tenga el enlace."
        : "Se guarda con el trabajo de este navegador y viaja en las copias que guardes.",
    ],
    casillas: {
      grupos: grupos
        .map((grupo) => ({
          titulo: grupo,
          opciones: dominios
            .filter((dominio) => dominio.group === grupo)
            .map((dominio) => ({
              valor: dominio.id,
              etiqueta: dominio.label,
              detalle: detalleDe(dominio.id),
              marcada: dominioAplica(dominio.id),
            })),
        }))
        .filter((grupo) => grupo.opciones.length),
      minimo: 1,
      avisoMinimo: "Tiene que aplicar al menos un dominio.",
    },
    confirmar: "Guardar",
  });

  if (marcados === false) {
    return;
  }

  const excluidos = normalizarDominiosExcluidos(
    Object.keys(DOMAINS).filter((domainId) => !marcados.includes(domainId)),
  );

  if (excluidos.join(",") === state.dominiosExcluidos.join(",")) {
    return;
  }

  await aplicarDominiosExcluidos(excluidos);
}


/**
 * Deja fuera los dominios que no aplican, y si el abierto es uno de ellos,
 * pasa al primero que si: no se puede seguir puntuando un dominio que el
 * conmutador ya no enseña.
 */
async function aplicarDominiosExcluidos(excluidos) {
  syncActiveDomainState();

  state.dominiosExcluidos = excluidos;
  persistDominiosExcluidos();

  const destino = dominioAplica(state.activeDomainId) ? null : primerDominioQueAplica();

  // switchDomain() ya repinta, con los radares creciendo como en cualquier
  // cambio de dominio. Repintar otra vez detras los pararia a medio crecer.
  if (destino) {
    try {
      await switchDomain(destino);
    } catch (error) {
      console.error(`No se pudo abrir el dominio ${destino}.`, error);
      repintarTodo();
    }
  } else {
    repintarTodo();
  }

  showNotice(
    excluidos.length
      ? `Ahora se ven ${losDominios(dominiosQueAplican().length)} que aplican a ${paraQuien()}. `
        + `${enumerar(nombresDeExcluidos())} ${excluidos.length === 1 ? "queda" : "quedan"} fuera, `
        + "con lo puntuado guardado por si vuelven."
      : "Vuelven a verse los nueve dominios, con lo que tuvieran puntuado.",
    "exito",
  );
}


/** Que exclusion se pinto la ultima vez: el conmutador solo se rehace si cambia. */
let firmaPintada = null;


/**
 * Lo que dice en pantalla cuantos dominios aplican. Se llama en cada
 * repintado, porque la eleccion puede llegar de otra persona del escenario o
 * de una copia que se abre, no solo del dialogo.
 */
export function pintarDominiosDelCliente() {
  const firma = state.dominiosExcluidos.join(",");

  if (firma !== firmaPintada) {
    firmaPintada = firma;
    renderDomainSwitcher();
  }

  const cuantos = dominiosQueAplican().length;
  const excluidos = state.dominiosExcluidos.length;
  const nombre = losDominios(cuantos);

  // Bajo el conmutador no se dice nada cuando aplican todos: es lo de siempre,
  // y una linea mas delante del cliente es ruido. Cuando no, se dice, para que
  // nadie piense que faltan dominios por un fallo de carga.
  const alcance = document.getElementById("alcanceDeDominios");

  if (alcance) {
    alcance.hidden = !excluidos;

    const texto = alcance.querySelector("[data-alcance-texto]");

    if (texto) {
      texto.textContent = excluidos
        ? `${excluidos} ${excluidos === 1 ? "dominio no aplica" : "dominios no aplican"} a ${paraQuien()}`
        : "";
      texto.title = excluidos ? `No aplican: ${enumerar(nombresDeExcluidos())}` : "";
    }
  }

  const etiqueta = document.getElementById("dominiosDelClienteLabel");

  if (etiqueta) {
    etiqueta.textContent = excluidos
      ? `Dominios del cliente · ${cuantos} de ${Object.keys(DOMAINS).length}`
      : "Dominios del cliente";
  }

  const titulo = document.getElementById("overviewTitulo");

  if (titulo) {
    titulo.textContent = `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} de un vistazo`;
  }

  const buscar = document.getElementById("buscadorButton");

  if (buscar) {
    buscar.title = `Buscar una subcapacidad en ${nombre}`;
  }

  const campo = document.getElementById("buscadorCampo");

  if (campo) {
    campo.placeholder = `Busca una subcapacidad en ${nombre}`;
  }
}
