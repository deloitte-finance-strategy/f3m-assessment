/**
 * Los seis radares, que son lo unico de la herramienta que no dibuja el DOM.
 *
 * Chart.js se sirve desde vendor/ y NO desde un CDN, a proposito: una red de
 * cliente que filtre cdnjs dejaba los radares sin pintar y el PDF entregable
 * con tres huecos. Ver vendor/LEEME.md.
 *
 * Son seis y dos registros: los tres del Dashboard, por capacidad, y los tres
 * del Overview, por dominio. Los dos registros se conservan separados porque el
 * informe captura de ambos.
 *
 * Este modulo no sabe nada del ambito ni de los filtros: recibe las filas ya
 * agregadas. Antes buildCapabilityRadarData() iba a buscarlas por su cuenta, y
 * eso ataba el dibujo al estado.
 */

import { formatNumber } from "../core/presentacion.js?v=12";
import { els } from "./estado.js?v=12";
import { showNotice } from "./avisos.js?v=12";
import { paletaDeRadar, tamanoDeLetraDeGrafico } from "./preferencias.js?v=12";




let capabilityRadarCharts = {
  procesos: null,
  tecnologia: null,
  organizacion: null,
};


// Seis canvas, dos registros. getCanvasImageDataUrl() sigue leyendo el del
// Dashboard, que es de donde salen los radares del informe PDF.
const overviewRadarCharts = {
  procesos: null,
  tecnologia: null,
  organizacion: null,
};


/**
 * Solo se avisa una vez por carga: renderCapabilityRadar() se llama en cada
 * repintado del dashboard, y el aviso taparia todo lo demas.
 */
let avisoDeGraficosMostrado = false;


/**
 * Si no hay Chart.js, se dice una sola vez por carga y se sigue.
 *
 * Antes esto era un return mudo dentro de renderCapabilityRadar(). Si la red del
 * cliente bloquea el CDN —normal en una red corporativa ajena— no habia radares,
 * no habia aviso, y el PDF que se entrega salia con tres recuadros en blanco.
 * Nadie se enteraba hasta tener el informe delante.
 *
 * Esta fuera de renderCapabilityRadar() porque ahora hay dos vistas que pintan
 * radares: entrar directamente por #overview con la libreria bloqueada tiene que
 * dar el mismo aviso.
 */
export function hayLibreriaDeGraficos() {
  if (typeof Chart !== "undefined") {
    return true;
  }

  if (!avisoDeGraficosMostrado) {
    avisoDeGraficosMostrado = true;

    showNotice(
      "No se ha podido cargar la librería de gráficos: los radares no se pintan y el informe PDF "
        + "saldrá sin ellos. El resto de la herramienta funciona con normalidad. Recarga la página "
        + "para reintentarlo.",
      "aviso",
    );
  }

  return false;
}




export function renderCapabilityRadar(filas) {
  if (!hayLibreriaDeGraficos()) {
    return;
  }

  const radarData = buildCapabilityRadarData(filas);

  renderSingleCapabilityRadar({
    key: "procesos",
    canvas: els.capabilityRadarProcessesChart,
    label: "Procesos",
    values: radarData.procesos,
    targetValues: radarData.objetivoProcesos,
    color: paletaDeRadar().procesos,
    backgroundColor: paletaDeRadar().areaProcesos,
    radarData,
  });

  renderSingleCapabilityRadar({
    key: "tecnologia",
    canvas: els.capabilityRadarTechnologyChart,
    label: "Tecnología",
    values: radarData.tecnologia,
    targetValues: radarData.objetivoTecnologia,
    color: paletaDeRadar().tecnologia,
    backgroundColor: paletaDeRadar().areaTecnologia,
    radarData,
  });

  renderSingleCapabilityRadar({
    key: "organizacion",
    canvas: els.capabilityRadarOrganizationChart,
    label: "Organización",
    values: radarData.organizacion,
    targetValues: radarData.objetivoOrganizacion,
    color: paletaDeRadar().organizacion,
    backgroundColor: paletaDeRadar().areaOrganizacion,
    radarData,
  });
}




function renderSingleCapabilityRadar({
  key,
  canvas,
  label,
  values,
  targetValues,
  color,
  backgroundColor,
  radarData,

  // Donde se guarda la instancia de Chart. El Dashboard escribe en el registro
  // de siempre —del que tira getCanvasImageDataUrl() para el PDF— y el Overview
  // en el suyo: son seis canvas distintos y una sola caja de tres claves los
  // pisaria, capturando ademas el radar equivocado en el informe.
  registro = capabilityRadarCharts,
}) {
  if (!canvas) {
    return;
  }

  // Estos dos colores se nombran porque ahora aparecen en dos sitios cada uno
  // —la serie y su marca de leyenda, y `labels.color` y el `fontColor` de cada
  // item— y tenerlos escritos dos veces era pedir que se descuadraran.
  const paleta = paletaDeRadar();
  const colorDelObjetivo = paleta.objetivo;
  const colorDelTextoDeLeyenda = paleta.leyenda;

  const chartData = {
    labels: radarData.displayLabels,

    datasets: [
      {
        label: `${label} actual`,
        data: values,
        fill: true,
        backgroundColor,
        borderColor: color,
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: paleta.vertice,
        pointBorderWidth: 2,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: paleta.vertice,
        pointHoverBorderColor: color,
        order: 2,

        // La marca que esta serie ensena en la leyenda. Va aqui, junto al
        // estilo del trazo, para que no se puedan separar al editar una:
        // generateLabels() la lee tal cual. No se usa `pointStyle` del dataset
        // porque eso cambiaria tambien los vertices dibujados en el radar.
        marcaDeLeyenda: {
          pointStyle: "circle",
          fillStyle: color,
          lineWidth: 0,
        },
      },
      {
        label: `${label} objetivo`,
        data: targetValues,
        fill: false,
        borderColor: colorDelObjetivo,
        borderWidth: 2.25,
        borderDash: [7, 5],
        pointBackgroundColor: paleta.vertice,
        pointBorderColor: colorDelObjetivo,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colorDelObjetivo,
        pointHoverBorderColor: paleta.vertice,
        order: 1,

        marcaDeLeyenda: {
          pointStyle: "line",
          strokeStyle: colorDelObjetivo,
          lineWidth: 2,
        },
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,

    layout: {
      padding: 4,
    },

    plugins: {
      legend: {
        display: true,
        position: "bottom",

        labels: {
          usePointStyle: true,
          boxWidth: 28,
          boxHeight: 8,
          padding: 16,
          color: colorDelTextoDeLeyenda,

          font: {
            size: tamanoDeLetraDeGrafico(),
            weight: "700",
          },

          // Antes esto era `pointStyle: "line"` para las dos series. Pero
          // `labels.pointStyle` es global —pisa el del dataset— y la marca se
          // traza con el color del BORDE del punto, que en la serie actual es
          // blanco para que los vertices resalten sobre el area de color: la
          // linea de la leyenda salia blanca sobre fondo blanco y no se veia.
          // Quedaba el texto "Procesos actual" sin nada al lado y no habia
          // forma de saber que ese era el nivel de la empresa hoy.
          //
          // Generandola a mano, cada serie declara su marca en
          // `marcaDeLeyenda` y aqui solo se completan los campos que Chart.js
          // necesita: el color del texto, el estado de visibilidad y el indice
          // que usa el onClick por defecto para ocultar la serie.
          generateLabels: (chart) =>
            chart.data.datasets.map((dataset, index) => ({
              text: dataset.label,
              fontColor: colorDelTextoDeLeyenda,
              hidden: !chart.isDatasetVisible(index),
              datasetIndex: index,
              ...dataset.marcaDeLeyenda,
            })),
        },
      },

      tooltip: {
        callbacks: {
          title: (items) => {
            const index = items[0]?.dataIndex ?? 0;

            return radarData.originalLabels[index] || "";
          },

          label: (context) => {
            return `${context.dataset.label}: ${formatNumber(
              context.parsed.r,
            )}`;
          },
        },
      },
    },

    scales: {
      r: {
        min: 0,
        max: 5,

        ticks: {
          stepSize: 1,
          backdropColor: "transparent",
          color: paleta.marcas,

          font: {
            size: tamanoDeLetraDeGrafico(),
            weight: "700",
          },
        },

        pointLabels: {
          color: paleta.ejes,
          padding: 8,

          font: {
            size: tamanoDeLetraDeGrafico(),
            weight: "800",
          },
        },

        grid: {
          color: paleta.rejilla,
        },

        angleLines: {
          color: paleta.rejilla,
        },
      },
    },
  };

  if (registro[key]) {
    registro[key].data = chartData;
    registro[key].options = chartOptions;
    registro[key].update();
    return;
  }

  registro[key] = new Chart(canvas, {
    type: "radar",
    data: chartData,
    options: chartOptions,
  });
}




export function renderOverviewRadar(filas) {
  if (!hayLibreriaDeGraficos()) {
    return;
  }

  const radarData = buildOverviewRadarData(filas);

  renderSingleCapabilityRadar({
    key: "procesos",
    canvas: els.overviewRadarProcessesChart,
    label: "Procesos",
    values: radarData.procesos,
    targetValues: radarData.objetivoProcesos,
    color: paletaDeRadar().procesos,
    backgroundColor: paletaDeRadar().areaProcesos,
    radarData,
    registro: overviewRadarCharts,
  });

  renderSingleCapabilityRadar({
    key: "tecnologia",
    canvas: els.overviewRadarTechnologyChart,
    label: "Tecnología",
    values: radarData.tecnologia,
    targetValues: radarData.objetivoTecnologia,
    color: paletaDeRadar().tecnologia,
    backgroundColor: paletaDeRadar().areaTecnologia,
    radarData,
    registro: overviewRadarCharts,
  });

  renderSingleCapabilityRadar({
    key: "organizacion",
    canvas: els.overviewRadarOrganizationChart,
    label: "Organización",
    values: radarData.organizacion,
    targetValues: radarData.objetivoOrganizacion,
    color: paletaDeRadar().organizacion,
    backgroundColor: paletaDeRadar().areaOrganizacion,
    radarData,
    registro: overviewRadarCharts,
  });
}




function buildCapabilityRadarData(rows) {
  return {
    originalLabels: rows.map(
      (row) => row.Capacidad,
    ),

    displayLabels: rows.map(
      (row) => getRadarShortLabel(row.Capacidad),
    ),

    procesos: rows.map(
      (row) => toRadarNumber(row.Procesos),
    ),

    objetivoProcesos: rows.map(
      (row) => toRadarNumber(row.ObjetivoProcesos),
    ),

    tecnologia: rows.map(
      (row) => toRadarNumber(row.Tecnologia),
    ),

    objetivoTecnologia: rows.map(
      (row) => toRadarNumber(row.ObjetivoTecnologia),
    ),

    organizacion: rows.map(
      (row) => toRadarNumber(row.Organizacion),
    ),

    objetivoOrganizacion: rows.map(
      (row) => toRadarNumber(row.ObjetivoOrganizacion),
    ),
  };
}


/**
 * Los ejes del radar del Overview son los nueve dominios.
 *
 * Sin getRadarShortLabel(): sus abreviaturas son de capacidades de FP&A y aqui
 * no aplican. Las etiquetas del catalogo ya son cortas y solo hay que partirlas;
 * la mas larga, "Relación con Inversores", cabe en dos lineas.
 *
 * Ojo con toRadarNumber(null), que devuelve 0 y no null: un dominio sin puntuar
 * se dibuja en el centro en vez de dejar hueco. Es exactamente lo que hace hoy el
 * radar por capacidad —buildSummaryRows() pone "" y Number("") es 0— y se
 * replica a proposito para que los dos se comporten igual. Si algun dia se
 * quiere el hueco, hay que arreglar los dos a la vez.
 */
function buildOverviewRadarData(filas) {
  return {
    originalLabels: filas.map((fila) => fila.label),

    displayLabels: filas.map((fila) => wrapRadarLabel(fila.label)),

    procesos: filas.map((fila) => toRadarNumber(fila.procesos)),

    objetivoProcesos: filas.map(
      (fila) => toRadarNumber(fila.objetivoProcesos),
    ),

    tecnologia: filas.map((fila) => toRadarNumber(fila.tecnologia)),

    objetivoTecnologia: filas.map(
      (fila) => toRadarNumber(fila.objetivoTecnologia),
    ),

    organizacion: filas.map((fila) => toRadarNumber(fila.organizacion)),

    objetivoOrganizacion: filas.map(
      (fila) => toRadarNumber(fila.objetivoOrganizacion),
    ),
  };
}




function toRadarNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}




function getRadarShortLabel(label) {
  const shortLabels = {
    "Presupuestos y previsiones": ["Presupuestos", "y previsiones"],
    "Informes de gestión del rendimiento": ["Informes", "gestión"],
    "Evaluación business case": ["Business", "case"],
    "Información y apoyo a la toma de decisiones": ["Apoyo", "decisiones"],
    "Planificación largo plazo": ["Planificación", "largo plazo"],
  };

  return shortLabels[label] || wrapRadarLabel(label);
}




function wrapRadarLabel(label) {
  const words = String(label).split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > 18) {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}


/**
 * La imagen de un radar para el informe, o cadena vacia si no hay radar.
 *
 * La cadena vacia importa: con ella, buildPdfRadarImageHtml() escribe "No se
 * pudo capturar el grafico" y el informe dice la verdad. Sin ella, un canvas
 * sin grafico devuelve un PNG en blanco perfectamente valido —no lanza— y el
 * PDF que se entrega al cliente sale con tres recuadros vacios.
 *
 * Se pregunta por la instancia de Chart y no por el tamano del canvas: es lo
 * unico que distingue "aqui no se ha pintado nada" de "se ha pintado un radar
 * sin datos", que son casos distintos.
 */
function getCanvasImageDataUrl(palanca, canvas, registro = capabilityRadarCharts) {
  if (!canvas || !registro[palanca]) {
    return "";
  }

  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("No se pudo capturar el gráfico para el PDF.", error);
    return "";
  }
}




export function getRadarImagesForPdf() {
  return {
    procesos: getCanvasImageDataUrl("procesos", els.capabilityRadarProcessesChart),
    tecnologia: getCanvasImageDataUrl("tecnologia", els.capabilityRadarTechnologyChart),
    organizacion: getCanvasImageDataUrl("organizacion", els.capabilityRadarOrganizationChart),
  };
}


/**
 * Los radares de nueve ejes del Overview, para la parte global del informe.
 *
 * Son canvas distintos y registro distinto de los del Dashboard —seis canvas,
 * dos registros— y hasta ahora no llegaban al PDF.
 */
export function getOverviewRadarImagesForPdf() {
  return {
    procesos: getCanvasImageDataUrl("procesos", els.overviewRadarProcessesChart, overviewRadarCharts),
    tecnologia: getCanvasImageDataUrl("tecnologia", els.overviewRadarTechnologyChart, overviewRadarCharts),
    organizacion: getCanvasImageDataUrl("organizacion", els.overviewRadarOrganizationChart, overviewRadarCharts),
  };
}


/**
 * Obliga a los seis radares a medirse otra vez, ahora mismo.
 *
 * Chart.js es responsive por ResizeObserver, que es asincrono: quitar el modo
 * presentacion cambia la rejilla de una a tres columnas, pero el canvas conserva
 * su tamano anterior durante ese tick, y la captura del informe ocurre dentro
 * del mismo. Sin esto, exportar con el modo puesto metia en el PDF unos radares
 * de 734x480 en una diapositiva medida para 414x380.
 */
export function redimensionarRadares() {
  [
    ...Object.values(capabilityRadarCharts),
    ...Object.values(overviewRadarCharts),
  ].forEach((grafico) => grafico?.resize());
}
