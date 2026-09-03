/**
 * El motor de calculo F3M.
 *
 * Aqui viven las reglas de negocio y nada mas: ni DOM, ni Firebase, ni estado
 * global, ni imports. Todo son funciones puras, y por eso se pueden probar sin
 * navegador y sin levantar la aplicacion (ver tests/).
 *
 * Lo que decide app.js y no este modulo: de donde salen los objetivos de cada
 * capacidad. Las funciones que los necesitan los reciben como argumento.
 */


/** Objetivo por defecto cuando una capacidad no tiene el suyo. */
export const DEFAULT_TARGET_MATURITY = 4;


/**
 * Las tres palancas, en el orden en que se muestran.
 *
 * Sin color: el color es identidad visual y vive en app.js. Aqui solo importa
 * que son tres y como se llaman sus campos.
 */
export const PALANCAS = [
  { key: "procesos", label: "Procesos" },
  { key: "tecnologia", label: "Tecnología" },
  { key: "organizacion", label: "Organización" },
];


export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}


/** Media de los valores numericos de la lista. null si no hay ninguno. */
export function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));

  if (!clean.length) {
    return null;
  }

  return round2(
    clean.reduce((sum, value) => sum + value, 0) / clean.length,
  );
}


export function unique(values) {
  return [...new Set(values)];
}


/**
 * Un score valido es un entero de 1 a 5. Cualquier otra cosa —vacio, texto,
 * 0, 6, decimales— es "sin puntuar", que no es lo mismo que un cero.
 */
export function toScore(value) {
  const number = Number(value);

  return Number.isInteger(number) && number >= 1 && number <= 5
    ? number
    : null;
}


/** Un objetivo valido es un entero de 1 a 5; si no, se usa el de respaldo. */
export function normalizeTargetValue(
  value,
  fallback = DEFAULT_TARGET_MATURITY,
) {
  const number = Number(value);

  if (Number.isInteger(number) && number >= 1 && number <= 5) {
    return number;
  }

  return fallback;
}


export function getMaturityLevel(score) {
  if (score < 1.5) return "1 - Inicial";
  if (score < 2.5) return "2 - Estructurado";
  if (score < 3.5) return "3 - Estandarizado";
  if (score < 4.5) return "4 - Optimizado";
  return "5 - Avanzado/Referente";
}


export function getMaturityLevelNumber(score) {
  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.max(1, Math.min(5, Math.round(score)));
}


export function priorityFromGap(gap) {
  if (!Number.isFinite(gap)) return "Pendiente";
  if (gap >= 2) return "Alta";
  if (gap >= 1) return "Media";
  return "Baja";
}


export function oleadaDesdePrioridad(prioridad) {
  if (prioridad === "Alta") return "Oleada 1";
  if (prioridad === "Media") return "Oleada 2";
  if (prioridad === "Baja") return "Oleada 3";

  return "Pendiente";
}


/**
 * Las metricas de una subcapacidad.
 *
 * Tres decisiones deliberadas, documentadas en el README con un ejemplo
 * numerico, que no deben cambiarse sin cambiar tambien las pruebas:
 *
 * 1. El gap se calcula POR PALANCA: max(0, objetivo - score). Recortar a 0
 *    significa que estar por encima del objetivo no compensa estar por debajo
 *    en otra palanca.
 * 2. El gap del item es el promedio de los gaps de las palancas puntuadas, no
 *    "objetivo - score medio". Con objetivo 4 y scores [3, 2, 5] el gap es 1,0
 *    y no 0,67.
 * 3. Solo entran en los promedios las palancas con score informado. Un item sin
 *    ninguna queda pendiente, sin prioridad ni oleada inventadas.
 */
export function calcularMetricas(item, objetivos) {
  const palancasPuntuadas = PALANCAS
    .map((palanca) => {
      const score = item.scores?.[palanca.key];

      if (!Number.isFinite(score)) {
        return null;
      }

      const target = normalizeTargetValue(
        objetivos?.[palanca.key],
        DEFAULT_TARGET_MATURITY,
      );

      return {
        lever: palanca.key,
        score,
        target,
        gap: round2(Math.max(0, target - score)),
      };
    })
    .filter(Boolean);

  if (!palancasPuntuadas.length) {
    return {
      isPending: true,
      scoreMedio: null,
      targetMedio: null,
      nivel: "",
      gap: null,
      gaps: {
        procesos: null,
        tecnologia: null,
        organizacion: null,
      },
      targets: objetivos,
      prioridad: "Pendiente",
      oleada: "Pendiente",
    };
  }

  const scoreMedio = average(
    palancasPuntuadas.map((entry) => entry.score),
  );

  const targetMedio = average(
    palancasPuntuadas.map((entry) => entry.target),
  );

  const gap = average(
    palancasPuntuadas.map((entry) => entry.gap),
  );

  const gaps = {
    procesos: null,
    tecnologia: null,
    organizacion: null,
  };

  palancasPuntuadas.forEach((entry) => {
    gaps[entry.lever] = entry.gap;
  });

  const prioridad = priorityFromGap(gap);

  return {
    isPending: false,
    scoreMedio,
    targetMedio,
    nivel: getMaturityLevel(scoreMedio),
    gap,
    gaps,
    targets: objetivos,
    prioridad,
    oleada: oleadaDesdePrioridad(prioridad),
  };
}


/**
 * La agregacion por capacidad, en un unico sitio.
 *
 * Estaba escrita cuatro veces —tabla resumen, heatmap, resumen del PDF y filas
 * del CSV— con la misma aritmetica y cuatro formas de salida distintas.
 *
 * Reglas que aplica:
 * - Las medias por palanca salen de TODAS las subcapacidades con esa palanca
 *   puntuada, aunque el item este pendiente en las otras dos.
 * - Score medio, objetivo medio y gap solo promedian las subcapacidades con
 *   alguna palanca puntuada: lo no evaluado no entra.
 * - La prioridad de la capacidad se deriva del gap agregado, con la misma regla
 *   que la de cada subcapacidad.
 *
 * metricasDe y objetivosDe se reciben de fuera porque dependen del estado de la
 * aplicacion. app.js pasa sus versiones con cache; las pruebas, unas directas.
 */
export function agregarPorCapacidad(items, metricasDe, objetivosDe) {
  return unique(
    items.map((item) => item.capacidad),
  ).map((capacidad) => {
    const subcapacidades = items.filter(
      (item) => item.capacidad === capacidad,
    );

    const metricas = subcapacidades.map(metricasDe);

    const puntuadas = metricas.filter(
      (entrada) => !entrada.isPending,
    );

    const mediaDePalanca = (clave) =>
      average(
        subcapacidades
          .map((item) => item.scores?.[clave])
          .filter(Number.isFinite),
      );

    const gap = average(
      puntuadas.map((entrada) => entrada.gap),
    );

    return {
      capacidad,
      items: subcapacidades,
      metricas,
      objetivos: objetivosDe(capacidad),
      procesos: mediaDePalanca("procesos"),
      tecnologia: mediaDePalanca("tecnologia"),
      organizacion: mediaDePalanca("organizacion"),
      scoreMedio: average(
        puntuadas.map((entrada) => entrada.scoreMedio),
      ),
      targetMedio: average(
        puntuadas.map((entrada) => entrada.targetMedio),
      ),
      gap,
      prioridad: priorityFromGap(gap),
      evaluadas: puntuadas.length,
      total: subcapacidades.length,
    };
  });
}
