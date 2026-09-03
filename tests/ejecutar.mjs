/**
 * Las mismas pruebas, desde la linea de comandos.
 *
 *     node tests/ejecutar.mjs
 *
 * Sale con codigo 1 si falla algo, para poder encadenarlo en CI. No instala ni
 * necesita nada: usa modulos ES nativos, igual que el navegador.
 *
 * En una maquina sin Node, las mismas pruebas se ejecutan abriendo tests/ con
 * el servidor estatico de siempre (python -m http.server).
 */

import { casos, ejecutarCasos } from "./runner.js";

const resultado = ejecutarCasos();

let grupoActual = null;

casos.forEach((caso) => {
  if (caso.grupo !== grupoActual) {
    grupoActual = caso.grupo;
    console.log(`\n${grupoActual}`);
  }

  const fallos = resultado.fallos.filter(
    (fallo) => fallo.grupo === caso.grupo && fallo.nombre === caso.nombre,
  );

  console.log(`  ${fallos.length ? "FALLA" : "OK   "} ${caso.nombre}`);

  fallos.forEach((fallo) => {
    console.log(`         ${fallo.detalle || "comprobacion"}`);
    console.log(`           esperado: ${JSON.stringify(fallo.esperado)}`);
    console.log(`           obtenido: ${JSON.stringify(fallo.obtenido)}`);
  });
});

console.log("");

if (resultado.fallos.length) {
  console.log(
    `${resultado.fallos.length} comprobacion(es) fallan de ` +
      `${resultado.comprobaciones}, en ${resultado.casos} casos.`,
  );
  process.exit(1);
}

console.log(
  `Las ${resultado.comprobaciones} comprobaciones pasan, en ` +
    `${resultado.casos} casos.`,
);
