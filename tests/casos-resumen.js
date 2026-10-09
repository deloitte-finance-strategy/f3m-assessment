/**
 * El resumen de una pagina: la diapositiva para el comite de direccion.
 *
 * Sale hacia arriba en el cliente sin que nadie la revise en pantalla. Aqui se
 * comprueba que sus cuatro cifras sean las del panorama del informe, que lo
 * que no cabe se diga en vez de perderse, y que lo escrito a mano —el cliente
 * y los proximos pasos— llegue escapado.
 */

import {
  BRECHAS_EN_EL_RESUMEN,
  LARGO_DE_ACCION_EN_EL_RESUMEN,
  PASOS_EN_EL_RESUMEN,
  acortar,
  alcance,
  documentoDelResumen,
  tituloDelResumen,
} from "../informe/resumen.js?v=32";
import { kpisDeLaFuncionFinanciera, panoramaGlobal, rejillaDeKpis } from "../informe/secciones.js?v=32";


const GLOBAL = {
  scoreGlobal: 2.54,
  gapMedio: 1.59,
  objetivoMedio: 4,
  evaluadas: 40,
  subcapacidades: 152,
  highCount: 12,
  dominios: 9,
  dominiosTotales: 9,
  titulares: {
    mayorBrecha: { grupo: "Transacciones", gap: 2 },
    palancaMasDebil: { label: "Tecnología", media: 2.18 },
    pendientes: 112,
  },
  palancas: [
    { key: "procesos", label: "Procesos", media: 2.5, objetivo: 4 },
    { key: "tecnologia", label: "Tecnología", media: 2.18, objetivo: 4 },
    { key: "organizacion", label: "Organización", media: 3, objetivo: 4 },
  ],
  brechas: {
    total: 30,
    lista: [1, 2, 3, 4, 5].map((numero) => ({
      dominio: "Fiscal",
      capacidad: "Contabilidad y provisión fiscal",
      subcapacidad: `1.${numero} Subcapacidad ${numero}`,
      scoreMedio: 2,
      targetMedio: 4,
      gap: 2,
      prioridad: "Alta",
    })),
  },
};


function paso(numero, extra = {}) {
  return { dominio: "FP&A", accion: `Acción ${numero}`, responsable: "Marta", fecha: "Noviembre", ...extra };
}


function cuantasVeces(texto, trozo) {
  return texto.split(trozo).length - 1;
}


export const casos = [
  {
    grupo: "Resumen de una página",
    nombre: "es una sola diapositiva, sin scripts, y sus cuatro cifras son las del panorama del informe",
    ejecutar(t) {
      const html = documentoDelResumen({ global: GLOBAL, radar: "", pasos: [] });
      const cifras = rejillaDeKpis(kpisDeLaFuncionFinanciera(GLOBAL));

      t.igual(cuantasVeces(html, '<section class="slide'), 1, "una diapositiva");
      t.igual(/<script/i.test(html), false, "sin scripts");
      t.igual(html.includes(cifras), true, "las cifras del resumen");
      t.igual(panoramaGlobal({ global: GLOBAL }).includes(cifras), true, "son las del panorama");
      t.igual(html.includes("40/152"), true);
      t.igual(html.includes("Transacciones"), true, "con el titular de la parte global");
    },
  },
  {
    grupo: "Resumen de una página",
    nombre: "lleva las cinco brechas y dice de cuántas son",
    ejecutar(t) {
      const html = documentoDelResumen({ global: GLOBAL, radar: "", pasos: [] });

      t.igual(BRECHAS_EN_EL_RESUMEN, 5);
      t.igual(cuantasVeces(html, 'class="resumen-brecha-nombre"'), 5);
      t.igual(html.includes("Las 5 mayores brechas"), true);
      t.igual(html.includes("de 30 por debajo del objetivo"), true);

      const sinBrechas = documentoDelResumen({ global: { ...GLOBAL, brechas: { total: 0, lista: [] } }, pasos: [] });

      t.igual(sinBrechas.includes("Ninguna subcapacidad puntuada queda por debajo de su objetivo."), true);
    },
  },
  {
    grupo: "Resumen de una página",
    nombre: "los pasos que no caben se cuentan, y sin ninguno lo dice",
    ejecutar(t) {
      const pocos = documentoDelResumen({ global: GLOBAL, pasos: [paso(1), paso(2)] });

      t.igual(cuantasVeces(pocos, 'class="resumen-paso-accion"'), 2);
      t.igual(pocos.includes("más en el acta"), false);
      t.igual(pocos.includes("FP&amp;A · Marta · Noviembre"), true, "con su dominio, quién y cuándo");

      const muchos = documentoDelResumen({
        global: GLOBAL,
        pasos: Array.from({ length: PASOS_EN_EL_RESUMEN + 3 }, (_, indice) => paso(indice + 1)),
      });

      t.igual(cuantasVeces(muchos, 'class="resumen-paso-accion"'), PASOS_EN_EL_RESUMEN);
      t.igual(muchos.includes("y 3 más en el acta de cada dominio"), true);

      const ninguno = documentoDelResumen({ global: GLOBAL, pasos: [] });

      t.igual(ninguno.includes("Todavía no hay próximos pasos apuntados."), true);
    },
  },
  {
    grupo: "Resumen de una página",
    nombre: "una acción larga se acorta a la vista, y el bloque dice dónde está entera",
    ejecutar(t) {
      const larga = `${"Revisar el proceso de cierre con cada área ".repeat(6)}y cerrar`;
      const corta = acortar(larga);

      t.igual(acortar("Corta"), "Corta");
      t.igual(corta.endsWith("…"), true, "con puntos suspensivos");
      t.igual(corta.length <= LARGO_DE_ACCION_EN_EL_RESUMEN, true, "dentro del largo");
      t.igual(larga.startsWith(corta.slice(0, -1)), true, "por una palabra entera");
      t.igual(/\s…$/.test(corta), false, "sin un espacio delante de los puntos");

      const html = documentoDelResumen({ global: GLOBAL, pasos: [paso(1, { accion: larga })] });

      t.igual(html.includes("el texto completo, en el acta de cada dominio"), true);
    },
  },
  {
    grupo: "Resumen de una página",
    nombre: "lo escrito a mano llega escapado, y el título sirve de nombre de archivo",
    ejecutar(t) {
      const html = documentoDelResumen({
        cliente: "Acme <b>S.A.</b>",
        global: GLOBAL,
        pasos: [paso(1, { accion: "<img src=x onerror=alert(1)>", responsable: "<i>Ana</i>" })],
      });

      t.igual(html.includes("<img src=x"), false);
      t.igual(html.includes("&lt;img src=x"), true);
      t.igual(html.includes("<b>S.A.</b>"), false);
      t.igual(html.includes("<i>Ana</i>"), false);

      t.igual(tituloDelResumen({ cliente: "A/B: grupo", fechaDeArchivo: "2026-10-09" }), "Resumen F3M - A B  grupo - 2026-10-09");
      t.igual(tituloDelResumen({ fechaDeArchivo: "2026-10-09" }), "Resumen F3M - 2026-10-09");
    },
  },
  {
    grupo: "Resumen de una página",
    nombre: "el pie dice de cuánto habla la hoja y que no lleva filtros",
    ejecutar(t) {
      t.igual(alcance(GLOBAL), "40 de 152 subcapacidades puntuadas en los 9 dominios · Sin filtros");
      t.igual(
        alcance({ ...GLOBAL, dominios: 8 }),
        "40 de 152 subcapacidades puntuadas en 8 de los 9 dominios · Sin filtros",
      );
    },
  },
];
