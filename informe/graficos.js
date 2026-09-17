/**
 * Las primitivas de dibujo del informe.
 *
 * Todo lo que dibujaba el informe anterior eran dos listas de barras hechas con
 * div y tres PNG capturados del Dashboard. El resto eran tablas.
 *
 * Van en SVG y no en Chart.js por dos razones. La ventana del informe se
 * escribe con document.write() y **no lleva scripts a proposito**
 * (exportPdfReport() en app.js lo explica), asi que no hay donde arrancar una
 * libreria. Y un SVG se imprime en vectorial: no pixela al proyectarlo ni al
 * ampliarlo, que es justo lo que le pasa a un canvas capturado.
 *
 * Los radares siguen siendo PNG de Chart.js y siguen estando bien: un radar a
 * mano sale peor, y ese camino ya esta probado.
 *
 * Aqui no hay DOM, ni estado, ni Firebase: entran numeros y sale una cadena.
 * Por eso tests/casos-graficos.js puede comprobar la geometria sin navegador.
 *
 * Una excepcion deliberada: barrasHtml() devuelve HTML y no SVG. Una lista de
 * barras con etiqueta es texto que tiene que ajustarse, alinearse y partirse, y
 * eso en HTML sale gratis y en SVG hay que calcularlo a mano. El SVG se reserva
 * para lo que es geometria de verdad.
 */

import { escapeHtml, formatNumber } from "../core/presentacion.js?v=12";
import { PALETA, colorDeCalor } from "./estilos.js?v=12";


/** Coordenada legible: 2 decimales bastan y evitan cadenas de 17 cifras. */
function n(valor) {
  return Math.round(valor * 100) / 100;
}


/** La fraccion 0..1 que le toca a un valor, acotada. */
function fraccion(valor, maximo) {
  if (!Number.isFinite(valor) || !maximo) {
    return 0;
  }

  return Math.max(0, Math.min(1, valor / maximo));
}


/**
 * Los cinco nombres de nivel, sin el numero delante.
 *
 * Son los mismos que getMaturityLevel() en core/calculo.js, cortados por el
 * guion. No se importa de alli porque alli el nombre viene pegado al numero
 * ("3 - Estandarizado") y en la escala el numero ya esta dibujado aparte.
 * Si cambian alli, cambian aqui: lo cubre tests/casos-graficos.js.
 */
const NOMBRES_DE_NIVEL = [
  "Inicial",
  "Estructurado",
  "Estandarizado",
  "Optimizado",
  "Avanzado",
];


/**
 * Un bullet chart: la barra del valor sobre su pista, y el objetivo como una
 * marca vertical.
 *
 * Es lo que sustituye a la columna de numeros sueltos de la tabla resumen. Un
 * "3,2" junto a un "4" obliga a restar mentalmente fila por fila; la marca
 * ensena de un vistazo cuanto falta y en que filas falta mas.
 */
export function svgBullet({ valor, objetivo, maximo = 5, color = PALETA.marca, etiqueta = "" }) {
  const ancho = 100;
  const alto = 14;
  const pista = { y: 4, alto: 6 };

  const largo = n(fraccion(valor, maximo) * ancho);
  const hayValor = Number.isFinite(valor);

  const marca = Number.isFinite(objetivo)
    ? `<rect x="${n(fraccion(objetivo, maximo) * ancho - 0.6)}" y="1" width="1.2" height="${alto - 2}" fill="${PALETA.tinta}"></rect>`
    : "";

  const barra = hayValor
    ? `<rect x="0" y="${pista.y}" width="${largo}" height="${pista.alto}" fill="${color}"></rect>`
    : "";

  return `
    <svg class="grafico" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none"
         role="img" aria-label="${escapeHtml(etiqueta || descripcionDeBullet(valor, objetivo, maximo))}">
      <rect x="0" y="${pista.y}" width="${ancho}" height="${pista.alto}" fill="${PALETA.pista}"></rect>
      ${barra}
      ${marca}
    </svg>
  `;
}


function descripcionDeBullet(valor, objetivo, maximo) {
  const actual = Number.isFinite(valor) ? formatNumber(valor) : "sin puntuar";

  return Number.isFinite(objetivo)
    ? `${actual} sobre ${maximo}, objetivo ${formatNumber(objetivo)}`
    : `${actual} sobre ${maximo}`;
}


/**
 * Un anillo con la cifra dentro y una marca en el objetivo.
 *
 * Se usa para las tres palancas. El arco se dibuja con stroke-dasharray sobre
 * una circunferencia girada -90 grados, que es la unica forma de hacer un arco
 * sin calcular un path con arcos elipticos.
 */
export function svgDonut({ valor, objetivo, maximo = 5, color = PALETA.marca, titulo = "" }) {
  const radio = 38;
  const grosor = 11;
  const circunferencia = 2 * Math.PI * radio;
  const pintado = n(fraccion(valor, maximo) * circunferencia);

  const arco = Number.isFinite(valor)
    ? `<circle cx="50" cy="50" r="${radio}" fill="none" stroke="${color}"
               stroke-width="${grosor}" stroke-linecap="butt"
               stroke-dasharray="${pintado} ${n(circunferencia)}"
               transform="rotate(-90 50 50)"></circle>`
    : "";

  return `
    <svg class="grafico" viewBox="0 0 100 100" role="img"
         aria-label="${escapeHtml(`${titulo}: ${descripcionDeBullet(valor, objetivo, maximo)}`)}"
         font-family="Segoe UI, Arial, sans-serif">
      <circle cx="50" cy="50" r="${radio}" fill="none" stroke="${PALETA.pista}" stroke-width="${grosor}"></circle>
      ${arco}
      ${marcaDeObjetivoEnAnillo(objetivo, maximo, radio, grosor)}
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
            font-size="26" font-weight="700" fill="${PALETA.tinta}">${escapeHtml(formatNumber(valor))}</text>
      <text x="50" y="68" text-anchor="middle" font-size="9" font-weight="700"
            letter-spacing="0.6" fill="${PALETA.tintaTenue}">OBJ ${escapeHtml(formatNumber(objetivo))}</text>
    </svg>
  `;
}


function marcaDeObjetivoEnAnillo(objetivo, maximo, radio, grosor) {
  if (!Number.isFinite(objetivo)) {
    return "";
  }

  const angulo = fraccion(objetivo, maximo) * 2 * Math.PI - Math.PI / 2;
  const dentro = radio - grosor / 2 - 1;
  const fuera = radio + grosor / 2 + 1;

  return `<line x1="${n(50 + Math.cos(angulo) * dentro)}" y1="${n(50 + Math.sin(angulo) * dentro)}"
                x2="${n(50 + Math.cos(angulo) * fuera)}" y2="${n(50 + Math.sin(angulo) * fuera)}"
                stroke="${PALETA.tinta}" stroke-width="2"></line>`;
}


/**
 * La escala de madurez del 1 al 5, con la posicion actual y el objetivo.
 *
 * Es la diapositiva que convence. El resto del informe contesta "cuanto
 * tenemos"; esta contesta "donde estamos y a donde vamos", que es la pregunta
 * que trae el cliente. Los cinco tramos son los de getMaturityLevel(), con los
 * cortes en 1,5 / 2,5 / 3,5 / 4,5, asi que el nombre que se lee debajo del
 * marcador es exactamente el nivel que calcula el motor.
 */
export function svgEscalaDeMadurez({ score, objetivo }) {
  const ancho = 200;
  const pista = { y: 8.5, alto: 7 };
  const posicion = (valor) => n(((Math.max(1, Math.min(5, valor)) - 1) / 4) * ancho);

  // Los cortes entre niveles, en coordenadas de la pista.
  const cortes = [1.5, 2.5, 3.5, 4.5]
    .map((corte) => `<line x1="${posicion(corte)}" y1="${pista.y}" x2="${posicion(corte)}" y2="${pista.y + pista.alto}" stroke="${PALETA.papel}" stroke-width="0.8"></line>`)
    .join("");

  const nombres = NOMBRES_DE_NIVEL.map((nombre, indice) => {
    const desde = indice === 0 ? 0 : posicion(indice + 0.5);
    const hasta = indice === 4 ? ancho : posicion(indice + 1.5);

    return `<text x="${n((desde + hasta) / 2)}" y="20" text-anchor="middle"
                  font-size="4.4" font-weight="700" fill="${PALETA.tintaTenue}">${escapeHtml(nombre)}</text>`;
  }).join("");

  return `
    <svg class="grafico" viewBox="0 0 ${ancho} 27" role="img"
         aria-label="${escapeHtml(descripcionDeEscala(score, objetivo))}"
         font-family="Segoe UI, Arial, sans-serif">
      <rect x="0" y="${pista.y}" width="${ancho}" height="${pista.alto}" fill="${PALETA.pista}"></rect>
      ${Number.isFinite(score) ? `<rect x="0" y="${pista.y}" width="${posicion(score)}" height="${pista.alto}" fill="${PALETA.marca}"></rect>` : ""}
      ${cortes}
      ${nombres}
      ${marcaDeObjetivoEnEscala(objetivo, posicion, pista)}
      ${marcaDeScore(score, posicion, pista)}
    </svg>
  `;
}


function marcaDeScore(score, posicion, pista) {
  if (!Number.isFinite(score)) {
    return `<text x="0" y="6.5" font-size="6" font-weight="700" fill="${PALETA.tintaTenue}">Sin puntuar</text>`;
  }

  const x = posicion(score);

  return `
    <line x1="${x}" y1="${pista.y - 3}" x2="${x}" y2="${pista.y + pista.alto + 0.6}" stroke="${PALETA.tinta}" stroke-width="1.9"></line>
    <text x="${x}" y="${pista.y - 4.4}" text-anchor="${anclaSegunBorde(x)}" font-size="7.5" font-weight="700"
          fill="${PALETA.tinta}">${escapeHtml(formatNumber(score))}</text>
  `;
}


function marcaDeObjetivoEnEscala(objetivo, posicion, pista) {
  if (!Number.isFinite(objetivo)) {
    return "";
  }

  const x = posicion(objetivo);

  return `
    <line x1="${x}" y1="${pista.y - 2.4}" x2="${x}" y2="${pista.y + pista.alto + 2.4}"
          stroke="${PALETA.tinta}" stroke-width="1.4" stroke-dasharray="1.5 1.1"></line>
    <text x="${x}" y="26" text-anchor="${anclaSegunBorde(x)}" font-size="4.4"
          font-weight="800" letter-spacing="0.3" fill="${PALETA.tintaSuave}">OBJETIVO ${escapeHtml(formatNumber(objetivo))}</text>
  `;
}


/** Una etiqueta pegada al borde se sale del lienzo; ahi se ancla al reves. */
function anclaSegunBorde(x) {
  if (x < 14) return "start";
  if (x > 186) return "end";

  return "middle";
}


function descripcionDeEscala(score, objetivo) {
  if (!Number.isFinite(score)) {
    return "Escala de madurez del 1 al 5, sin puntuar";
  }

  const nivel = NOMBRES_DE_NIVEL[Math.max(0, Math.min(4, Math.round(score) - 1))];

  return `Madurez ${formatNumber(score)} de 5, nivel ${nivel}`
    + (Number.isFinite(objetivo) ? `, objetivo ${formatNumber(objetivo)}` : "");
}


/**
 * Una lista de barras con etiqueta, en HTML.
 *
 * Cada fila es { etiqueta, valor, color, texto }, donde `texto` es lo que se
 * escribe a la derecha si no vale el propio valor. El maximo se pasa aparte
 * porque no siempre es el mayor de la lista: en las medias por palanca es 5,
 * la escala del modelo, y usar el mayor haria que tres barras flojas parecieran
 * llenas.
 */
export function barrasHtml(filas, { maximo } = {}) {
  const tope = Number.isFinite(maximo)
    ? maximo
    : Math.max(...filas.map((fila) => (Number.isFinite(fila.valor) ? fila.valor : 0)), 1);

  return `
    <div class="barras">
      ${filas.map((fila) => barraHtml(fila, tope)).join("")}
    </div>
  `;
}


function barraHtml({ etiqueta, valor, color = PALETA.marca, texto }, tope) {
  const ancho = n(fraccion(valor, tope) * 100);
  const escrito = texto !== undefined ? texto : formatNumber(valor);

  return `
    <div class="barra">
      <div class="barra-cabeza">
        <span>${escapeHtml(etiqueta)}</span>
        <strong>${escapeHtml(String(escrito))}</strong>
      </div>
      <div class="barra-pista">
        <div class="barra-relleno" style="width:${ancho}%; background:${color};"></div>
      </div>
    </div>
  `;
}


/**
 * El estilo en linea de una celda del heatmap.
 *
 * Va en linea y no como clase porque los cinco colores tienen que sobrevivir a
 * la impresion: una clase se puede quedar sin aplicar si el navegador decide no
 * pintar fondos, y entonces el heatmap sale en blanco y negro sin avisar.
 */
export function estiloDeCalor(valor) {
  const { fondo, texto } = colorDeCalor(valor);

  return `background:${fondo}; color:${texto};`;
}
