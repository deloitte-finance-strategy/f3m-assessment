/**
 * El ejecutor de los casos. Sin librerias y sin dependencias.
 *
 * Un caso es { grupo, nombre, ejecutar(t) }, y `t.igual(obtenido, esperado,
 * detalle)` es la unica comprobacion que hace falta: todo lo que se prueba aqui
 * son valores simples.
 */

import { casos as casosDeCalculo } from "./casos-calculo.js";
import { casos as casosDeEscenario } from "./casos-escenario.js";
import { casos as casosDeReglas } from "./casos-reglas.js";
import { casos as casosDePresentacion } from "./casos-presentacion.js";
import { casos as casosDeGraficos } from "./casos-graficos.js";
import { casos as casosDeObjetivos } from "./casos-objetivos.js";
import { casos as casosDeCoincidencias } from "./casos-coincidencias.js";
import { casos as casosDeExportacion } from "./casos-exportacion.js";
import { casos as casosDeInforme } from "./casos-informe.js";


/** Todos los casos, en el orden en que se quieren leer. */
export const casos = [
  ...casosDeCalculo,
  ...casosDeObjetivos,
  ...casosDeCoincidencias,
  ...casosDeEscenario,
  ...casosDeReglas,
  ...casosDePresentacion,
  ...casosDeExportacion,
  ...casosDeGraficos,
  ...casosDeInforme,
];


export function ejecutarCasos(aEjecutar = casos) {
  const fallos = [];
  let comprobaciones = 0;

  aEjecutar.forEach((caso) => {
    const t = {
      igual(obtenido, esperado, detalle = "") {
        comprobaciones += 1;

        // Object.is distingue null de undefined y no confunde 0 con -0, que es
        // justo lo que hace falta con scores sin puntuar.
        if (!Object.is(obtenido, esperado)) {
          fallos.push({
            grupo: caso.grupo,
            nombre: caso.nombre,
            detalle,
            esperado,
            obtenido,
          });
        }
      },
    };

    try {
      caso.ejecutar(t);
    } catch (error) {
      fallos.push({
        grupo: caso.grupo,
        nombre: caso.nombre,
        detalle: "excepcion",
        esperado: "sin excepciones",
        obtenido: String(error && error.message ? error.message : error),
      });
    }
  });

  return { casos: aEjecutar.length, comprobaciones, fallos };
}
