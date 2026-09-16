/**
 * Pruebas de informe/graficos.js: la geometria de lo que se dibuja en el informe.
 *
 * Un grafico mal escalado no lanza ninguna excepcion. Dibuja una barra que
 * llega al 140% de su pista, o una que se queda en el cero porque el valor
 * ausente se trato como un numero, y el PDF sale con una cifra que no es la que
 * dice la tabla de al lado. Eso no se ve leyendo el codigo y se ve tarde
 * mirando el PDF, asi que se mide aqui.
 *
 * Son funciones puras que devuelven una cadena, asi que basta con leer los
 * atributos del SVG que sale.
 *
 * Van con las del motor de calculo: /tests/ en el navegador, o
 * node tests/ejecutar.mjs desde la linea de comandos.
 *
 * Lo que estas pruebas NO pueden comprobar es que una diapositiva quepa en su
 * pagina: eso hace falta un navegador que maquete, y lo mide
 * tests/comprobar-desbordes.js.
 */

import { getMaturityLevel } from "../core/calculo.js?v=11";

import {
  barrasHtml,
  estiloDeCalor,
  svgBullet,
  svgDonut,
  svgEscalaDeMadurez,
} from "../informe/graficos.js?v=11";


/** El valor del atributo pedido, en la enesima etiqueta de ese tipo. */
function atributo(svg, etiqueta, nombre, indice = 0) {
  const etiquetas = svg.match(new RegExp(`<${etiqueta}\\b[^>]*>`, "g")) || [];
  const encontrada = etiquetas[indice];

  if (!encontrada) {
    return null;
  }

  const valor = encontrada.match(new RegExp(`\\b${nombre}="([^"]*)"`));

  return valor ? valor[1] : null;
}


/** Cuantas veces aparece una etiqueta. */
function cuantos(svg, etiqueta) {
  return (svg.match(new RegExp(`<${etiqueta}\\b`, "g")) || []).length;
}


export const casos = [
  // ------------------------------------------------------------- bullet chart
  {
    grupo: "Bullet chart",
    nombre: "la barra ocupa la fraccion que le toca de la pista",
    ejecutar: (t) => {
      // El primer rect es la pista, que siempre mide 100. El segundo es el valor.
      t.igual(atributo(svgBullet({ valor: 3, maximo: 5 }), "rect", "width", 1), "60", "3 de 5");
      t.igual(atributo(svgBullet({ valor: 5, maximo: 5 }), "rect", "width", 1), "100", "el maximo");
      t.igual(atributo(svgBullet({ valor: 1, maximo: 5 }), "rect", "width", 1), "20", "el minimo de la escala");
      t.igual(atributo(svgBullet({ valor: 2.63, maximo: 5 }), "rect", "width", 1), "52.6", "con decimales");
    },
  },
  {
    grupo: "Bullet chart",
    nombre: "un valor fuera de escala se acota en vez de desbordar la pista",
    ejecutar: (t) => {
      // Sin acotar, un 7 pintaria una barra del 140% que se sale de la celda y
      // se solapa con la columna siguiente.
      t.igual(atributo(svgBullet({ valor: 7, maximo: 5 }), "rect", "width", 1), "100", "por arriba");
      t.igual(atributo(svgBullet({ valor: -2, maximo: 5 }), "rect", "width", 1), "0", "por abajo");
    },
  },
  {
    grupo: "Bullet chart",
    nombre: "sin puntuar no se dibuja barra, que no es lo mismo que una barra a cero",
    ejecutar: (t) => {
      // Una barra de ancho cero y ninguna barra se ven igual, pero solo una de
      // las dos es verdad. Lo que importa es que no se invente un valor.
      const sinValor = svgBullet({ valor: null, objetivo: 4, maximo: 5 });

      // Pista + marca de objetivo, sin la barra del valor.
      t.igual(cuantos(sinValor, "rect"), 2, "solo pista y objetivo");
      t.igual(atributo(sinValor, "svg", "aria-label"), "sin puntuar sobre 5, objetivo 4", "lo dice el texto alternativo");
    },
  },
  {
    grupo: "Bullet chart",
    nombre: "la marca del objetivo se coloca en su posicion de la escala",
    ejecutar: (t) => {
      // La marca mide 1,2 de ancho y se centra en su posicion: 4 de 5 es el 80.
      t.igual(atributo(svgBullet({ valor: 3, objetivo: 4, maximo: 5 }), "rect", "x", 2), "79.4", "objetivo 4");
      t.igual(atributo(svgBullet({ valor: 3, objetivo: 5, maximo: 5 }), "rect", "x", 2), "99.4", "objetivo 5");
    },
  },
  {
    grupo: "Bullet chart",
    nombre: "sin objetivo no se dibuja marca",
    ejecutar: (t) => {
      t.igual(cuantos(svgBullet({ valor: 3, objetivo: null, maximo: 5 }), "rect"), 2, "pista y barra");
    },
  },

  // -------------------------------------------------------- escala de madurez
  {
    grupo: "Escala de madurez",
    nombre: "la escala va del 1 al 5, no del 0 al 5",
    ejecutar: (t) => {
      // El relleno es el segundo rect: el primero es la pista.
      // Un 1 es el principio de la escala, no un quinto de ella.
      t.igual(atributo(svgEscalaDeMadurez({ score: 1 }), "rect", "width", 1), "0", "un 1 esta al principio");
      t.igual(atributo(svgEscalaDeMadurez({ score: 3 }), "rect", "width", 1), "100", "un 3 esta en la mitad");
      t.igual(atributo(svgEscalaDeMadurez({ score: 5 }), "rect", "width", 1), "200", "un 5 esta al final");
      t.igual(atributo(svgEscalaDeMadurez({ score: 2 }), "rect", "width", 1), "50", "un 2 es un cuarto");
    },
  },
  {
    grupo: "Escala de madurez",
    nombre: "sin puntuar lo dice, en vez de dibujar la escala a cero",
    ejecutar: (t) => {
      const sinPuntuar = svgEscalaDeMadurez({ score: null, objetivo: 4 });

      t.igual(cuantos(sinPuntuar, "rect"), 1, "solo la pista, sin relleno");
      t.igual(sinPuntuar.includes("Sin puntuar"), true, "lo escribe");
      t.igual(
        atributo(sinPuntuar, "svg", "aria-label"),
        "Escala de madurez del 1 al 5, sin puntuar",
        "y tambien el texto alternativo",
      );
    },
  },
  {
    grupo: "Escala de madurez",
    nombre: "los cinco nombres de nivel son los que calcula el motor",
    ejecutar: (t) => {
      // Si alguien renombra un nivel en core/calculo.js y no aqui, la escala
      // escribiria un nombre y la tabla de al lado otro. Se cruzan los dos.
      const escala = svgEscalaDeMadurez({ score: 3 });

      [1, 2, 3, 4, 5].forEach((nivel) => {
        // getMaturityLevel devuelve "3 - Estandarizado"; la escala pinta el
        // nombre solo, porque el numero ya esta dibujado en la pista.
        const nombre = getMaturityLevel(nivel).split(" - ")[1].split("/")[0];

        t.igual(escala.includes(`>${nombre}<`), true, nombre);
      });
    },
  },
  {
    grupo: "Escala de madurez",
    nombre: "una etiqueta pegada al borde se ancla hacia dentro",
    ejecutar: (t) => {
      // Centrada, la etiqueta de un score de 1 se saldria por la izquierda del
      // lienzo y el navegador la recortaria sin avisar.
      t.igual(atributo(svgEscalaDeMadurez({ score: 1 }), "text", "text-anchor", 5), "start", "en el minimo");
      t.igual(atributo(svgEscalaDeMadurez({ score: 5 }), "text", "text-anchor", 5), "end", "en el maximo");
      t.igual(atributo(svgEscalaDeMadurez({ score: 3 }), "text", "text-anchor", 5), "middle", "en medio");
    },
  },

  // -------------------------------------------------------------------- donut
  {
    grupo: "Anillo por palanca",
    nombre: "el arco cubre la fraccion que le toca de la circunferencia",
    ejecutar: (t) => {
      // Radio 38, asi que la circunferencia es 2*pi*38 = 238,76.
      const mitad = svgDonut({ valor: 2.5, maximo: 5 });

      t.igual(atributo(mitad, "circle", "stroke-dasharray", 1), "119.38 238.76", "la mitad");
      t.igual(
        atributo(svgDonut({ valor: 5, maximo: 5 }), "circle", "stroke-dasharray", 1),
        "238.76 238.76",
        "entero",
      );
    },
  },
  {
    grupo: "Anillo por palanca",
    nombre: "sin valor no se dibuja arco y la cifra del centro es un guion",
    ejecutar: (t) => {
      const sinValor = svgDonut({ valor: null, objetivo: 4, maximo: 5 });

      // Solo el circulo de la pista: el del arco no se pinta.
      t.igual(cuantos(sinValor, "circle"), 1, "sin arco");
      t.igual(sinValor.includes(">-</text>"), true, "guion y no cero");
    },
  },

  // ------------------------------------------------------------------- barras
  {
    grupo: "Barras con etiqueta",
    nombre: "el ancho se calcula sobre el maximo que se pasa, no sobre el mayor de la lista",
    ejecutar: (t) => {
      // Tres palancas flojas sobre la escala del modelo tienen que verse
      // flojas. Escaladas al mayor de las tres, las tres se verian llenas.
      const html = barrasHtml(
        [
          { etiqueta: "Procesos", valor: 2 },
          { etiqueta: "Tecnologia", valor: 1 },
        ],
        { maximo: 5 },
      );

      t.igual(html.includes("width:40%"), true, "2 sobre 5");
      t.igual(html.includes("width:20%"), true, "1 sobre 5");
    },
  },
  {
    grupo: "Barras con etiqueta",
    nombre: "el texto que llega de fuera se escapa",
    ejecutar: (t) => {
      const html = barrasHtml([{ etiqueta: "<script>alert(1)</script>", valor: 1 }], { maximo: 5 });

      t.igual(html.includes("<script>"), false, "no se cuela la etiqueta");
      t.igual(html.includes("&lt;script&gt;"), true, "sale escapada");
    },
  },

  // ----------------------------------------------------------- color de calor
  {
    grupo: "Color del heatmap",
    nombre: "los cortes de color son los que dice el motor, no unos escritos aparte",
    ejecutar: (t) => {
      // Este caso comprobaba que el color cambiaba en 1,5 / 2,5 / 3,5 / 4,5,
      // con los cortes escritos a mano en los dos lados. Seguia en verde si
      // alguien movia uno en core/calculo.js: la celda se pintaria de un
      // color y la columna "Nivel" de al lado diria otra cosa, que es justo
      // lo que el caso decia estar cubriendo. Ahora se le preguntan al motor.
      const color = (valor) => estiloDeCalor(valor).match(/background:(#[0-9A-Fa-f]{6})/)[1];

      // En centesimas para no arrastrar error de coma flotante al sumar.
      const cortes = [];
      for (let centesimas = 101; centesimas <= 500; centesimas += 1) {
        if (getMaturityLevel((centesimas - 1) / 100) !== getMaturityLevel(centesimas / 100)) {
          cortes.push(centesimas);
        }
      }

      t.igual(cortes.length, 4, "el motor reparte el 1-5 en cinco tramos");

      cortes.forEach((centesimas) => {
        const corte = centesimas / 100;
        const justoAntes = (centesimas - 1) / 100;

        t.igual(color(justoAntes) === color(corte), false, `corte en ${corte}`);
      });

      t.igual(color(1) === color((cortes[0] - 1) / 100), true, "dentro del mismo tramo");
    },
  },
  {
    grupo: "Color del heatmap",
    nombre: "una celda sin puntuar no se pinta del color del peor nivel",
    ejecutar: (t) => {
      // Gris, no rojo: sin evaluar y evaluado con la peor nota son dos cosas
      // distintas y el cliente las lee de un vistazo por el color.
      const gris = estiloDeCalor(null);

      t.igual(gris, estiloDeCalor(undefined), "sin campo");
      t.igual(gris, estiloDeCalor(NaN), "resultado no numerico");
      t.igual(gris === estiloDeCalor(1), false, "no es el del nivel 1");
    },
  },
];
