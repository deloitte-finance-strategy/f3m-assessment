/**
 * Pruebas de core/biblioteca.js: la biblioteca de IA y la fuente de cada caso.
 *
 * Lo que se protege aqui es que «Más información» no abra nunca algo que no es
 * la fuente del caso: una pagina que no existe, un documento que no esta en la
 * biblioteca o una ruta que sale de biblioteca/. Y que el catalogo de la pestana
 * IA encuentre lo que se busca como se teclea en una sesion: deprisa y sin
 * tildes.
 *
 * Que las 100 fuentes reales cuadren con los documentos reales lo comprueba
 * scripts/check_domains_sync.py, que lee los archivos. Aqui se prueban las
 * reglas con datos pequenos y a la vista.
 */

import {
  aparicionesDeCasos,
  brechasDeCasos,
  contarPorCampo,
  etiquetaDeFuente,
  filtrarCasos,
  fuentesDeCaso,
  normalizarBiblioteca,
  normalizarDocumento,
  normalizarFuente,
  normalizarTextoDeBusqueda,
  ordenarPorBrechas,
  rangoDePaginas,
  resumenDeFuentes,
  textoDeBrechas,
  titulosDeCasos,
  ubicacionDeFuente,
  urlDeDocumento,
} from "../core/biblioteca.js?v=24";


function dossier(extra = {}) {
  return {
    id: "ai-dossier",
    titulo: "The AI Dossier",
    unidad: "pagina",
    total: 190,
    archivo: "biblioteca/the-ai-dossier.pdf",
    ...extra,
  };
}


function financeAi(extra = {}) {
  return {
    id: "financeai",
    titulo: "FinanceAI Use Case Overview",
    tituloCorto: "FinanceAI",
    unidad: "diapositiva",
    total: 19,
    archivo: "biblioteca/financeai.pdf",
    original: "biblioteca/financeai.pptx",
    nombreDeDescarga: "FinanceAI - Use Cases Summary_C.pptx",
    ...extra,
  };
}


function biblioteca() {
  return normalizarBiblioteca({ documentos: [dossier(), financeAi()] });
}


/** Un caso del catalogo, con lo minimo que usan los filtros. */
function caso(id, titulo, extra = {}) {
  return {
    id,
    titulo,
    descripcion: "",
    tipoIa: "Generativa",
    tipoValor: "Eficiencia operativa",
    fuentes: [],
    ...extra,
  };
}


export const casos = [
  // ------------------------------------------------------------- documentos
  {
    grupo: "Biblioteca de IA",
    nombre: "un documento valido conserva sus datos y completa lo que falta",
    ejecutar: (t) => {
      const documento = normalizarDocumento(dossier());

      t.igual(documento.id, "ai-dossier", "id");
      t.igual(documento.tituloCorto, "The AI Dossier", "sin titulo corto, el titulo");
      t.igual(documento.original, "biblioteca/the-ai-dossier.pdf", "sin original, el mismo PDF");
      t.igual(documento.nombreDeDescarga, "the-ai-dossier.pdf", "sin nombre, el del archivo");
      t.igual(documento.formato, "PDF", "formato por defecto");
    },
  },
  {
    grupo: "Biblioteca de IA",
    nombre: "un PowerPoint se ve en PDF y se descarga en su formato original",
    ejecutar: (t) => {
      const documento = normalizarDocumento(financeAi());

      t.igual(documento.archivo, "biblioteca/financeai.pdf", "lo que se ve");
      t.igual(documento.original, "biblioteca/financeai.pptx", "lo que se descarga");
      t.igual(documento.nombreDeDescarga, "FinanceAI - Use Cases Summary_C.pptx", "con su nombre");
    },
  },
  {
    grupo: "Biblioteca de IA",
    nombre: "lo que el navegador no sabe ensenar dentro de la pagina no es un documento",
    ejecutar: (t) => {
      t.igual(normalizarDocumento(financeAi({ archivo: "biblioteca/financeai.pptx" })), null, "un pptx como archivo");
      t.igual(normalizarDocumento(dossier({ unidad: "capitulo" })), null, "unidad desconocida");
      t.igual(normalizarDocumento(dossier({ total: 0 })), null, "sin paginas");
      t.igual(normalizarDocumento(dossier({ total: 1.5 })), null, "paginas no enteras");
      t.igual(normalizarDocumento(dossier({ titulo: "  " })), null, "sin titulo");
      t.igual(normalizarDocumento(dossier({ id: "AI Dossier" })), null, "id con espacios");
      t.igual(normalizarDocumento(null), null, "nada");
    },
  },
  {
    grupo: "Biblioteca de IA",
    nombre: "ninguna ruta sale de biblioteca/",
    ejecutar: (t) => {
      // El archivo acaba en el src de un iframe y en un enlace de descarga.
      t.igual(normalizarDocumento(dossier({ archivo: "biblioteca/../index.pdf" })), null, "subir de carpeta");
      t.igual(normalizarDocumento(dossier({ archivo: "/biblioteca/x.pdf" })), null, "ruta absoluta");
      t.igual(normalizarDocumento(dossier({ archivo: "https://ejemplo.com/x.pdf" })), null, "otro origen");
      t.igual(normalizarDocumento(dossier({ archivo: "javascript:alert(1)//.pdf" })), null, "esquema javascript");
      t.igual(normalizarDocumento(dossier({ archivo: "biblioteca/sub/x.pdf" })), null, "subcarpetas");

      const conOriginalRaro = normalizarDocumento(dossier({ original: "../secreto.pptx" }));

      t.igual(conOriginalRaro.original, "biblioteca/the-ai-dossier.pdf", "un original raro se descarta");
    },
  },
  {
    grupo: "Biblioteca de IA",
    nombre: "la biblioteca salta lo invalido y un id repetido se queda con el primero",
    ejecutar: (t) => {
      const documentos = normalizarBiblioteca({
        documentos: [dossier(), dossier({ titulo: "Otro" }), { id: "roto" }, financeAi()],
      });

      t.igual(documentos.size, 2, "dos documentos");
      t.igual(documentos.get("ai-dossier").titulo, "The AI Dossier", "el primero");
      t.igual([...documentos.keys()].join(","), "ai-dossier,financeai", "en el orden del archivo");
      t.igual(normalizarBiblioteca({}).size, 0, "sin documentos");
      t.igual(normalizarBiblioteca(null).size, 0, "sin JSON");
    },
  },

  // ---------------------------------------------------------------- fuentes
  {
    grupo: "Fuente de un caso",
    nombre: "una fuente valida lleva a su documento y a su pagina",
    ejecutar: (t) => {
      const fuente = normalizarFuente(
        { documento: "ai-dossier", pagina: 7, hasta: 8, texto: " Dynamic pricing " },
        biblioteca(),
      );

      t.igual(fuente.documento, "ai-dossier", "documento");
      t.igual(fuente.pagina, 7, "pagina");
      t.igual(fuente.hasta, 8, "hasta");
      t.igual(fuente.texto, "Dynamic pricing", "texto recortado");
      t.igual(fuente.alcance, "caso", "por defecto, el caso exacto");
    },
  },
  {
    grupo: "Fuente de un caso",
    nombre: "una fuente que no lleva a ningun sitio se descarta, no se corrige",
    ejecutar: (t) => {
      const documentos = biblioteca();

      t.igual(normalizarFuente({ documento: "otro", pagina: 1 }, documentos), null, "documento que no esta");
      t.igual(normalizarFuente({ documento: "financeai", pagina: 20 }, documentos), null, "diapositiva 20 de 19");
      t.igual(normalizarFuente({ documento: "financeai", pagina: 0 }, documentos), null, "pagina cero");
      t.igual(normalizarFuente({ documento: "financeai", pagina: "3" }, documentos), null, "pagina como texto");
      t.igual(normalizarFuente({ documento: "financeai" }, documentos), null, "sin pagina");
      t.igual(normalizarFuente({ documento: "financeai", pagina: 3 }, new Map()), null, "biblioteca vacia");
    },
  },
  {
    grupo: "Fuente de un caso",
    nombre: "un rango que no cuadra se ignora y la fuente se queda en su pagina",
    ejecutar: (t) => {
      const documentos = biblioteca();

      t.igual(normalizarFuente({ documento: "ai-dossier", pagina: 7, hasta: 6 }, documentos).hasta, 7, "hacia atras");
      t.igual(normalizarFuente({ documento: "ai-dossier", pagina: 190, hasta: 191 }, documentos).hasta, 190, "fuera del documento");
      t.igual(normalizarFuente({ documento: "ai-dossier", pagina: 7 }, documentos).hasta, 7, "sin rango");
    },
  },
  {
    grupo: "Fuente de un caso",
    nombre: "solo un area declarada como tal se trata como referencia aproximada",
    ejecutar: (t) => {
      const documentos = biblioteca();

      t.igual(normalizarFuente({ documento: "financeai", pagina: 5, alcance: "area" }, documentos).alcance, "area", "area");
      t.igual(normalizarFuente({ documento: "financeai", pagina: 5, alcance: "otra" }, documentos).alcance, "caso", "valor desconocido");
    },
  },
  {
    grupo: "Fuente de un caso",
    nombre: "las fuentes de un caso conservan su orden y pierden las rotas",
    ejecutar: (t) => {
      const fuentes = fuentesDeCaso(
        {
          fuentes: [
            { documento: "ai-dossier", pagina: 79 },
            { documento: "ai-dossier", pagina: 999 },
            { documento: "ai-dossier", pagina: 23 },
          ],
        },
        biblioteca(),
      );

      t.igual(fuentes.map((fuente) => fuente.pagina).join(","), "79,23", "la primera sigue siendo la que se abre");
      t.igual(fuentesDeCaso({}, biblioteca()).length, 0, "un caso sin fuentes");
      t.igual(fuentesDeCaso({ fuentes: "p. 7" }, biblioteca()).length, 0, "fuentes que no son una lista");
    },
  },

  // -------------------------------------------------------------- etiquetas
  {
    grupo: "Fuente de un caso",
    nombre: "la ubicacion habla en paginas o en diapositivas, segun el documento",
    ejecutar: (t) => {
      const documentos = biblioteca();
      const enDossier = (pagina, hasta) =>
        ubicacionDeFuente(
          normalizarFuente({ documento: "ai-dossier", pagina, hasta }, documentos),
          documentos.get("ai-dossier"),
        );

      t.igual(enDossier(7, 8), "Páginas 7 y 8 de 190", "dos paginas seguidas");
      t.igual(enDossier(7, 9), "Páginas 7 a 9 de 190", "un rango");
      t.igual(enDossier(7), "Página 7 de 190", "una pagina");

      t.igual(
        ubicacionDeFuente(
          normalizarFuente({ documento: "financeai", pagina: 9 }, documentos),
          documentos.get("financeai"),
        ),
        "Diapositiva 9 de 19",
        "una diapositiva",
      );
    },
  },
  {
    grupo: "Fuente de un caso",
    nombre: "la etiqueta corta dice el documento, la pagina y si es aproximada",
    ejecutar: (t) => {
      const documentos = biblioteca();
      const etiqueta = (entrada) =>
        etiquetaDeFuente(normalizarFuente(entrada, documentos), documentos.get(entrada.documento));

      t.igual(etiqueta({ documento: "ai-dossier", pagina: 7, hasta: 8 }), "The AI Dossier · p. 7–8", "rango");
      t.igual(etiqueta({ documento: "financeai", pagina: 9 }), "FinanceAI · diap. 9", "titulo corto");
      t.igual(etiqueta({ documento: "financeai", pagina: 5, alcance: "area" }), "FinanceAI · diap. 5 · área", "area");
      t.igual(rangoDePaginas({ pagina: 3, hasta: 3 }), "3", "una sola pagina");
    },
  },
  {
    grupo: "Fuente de un caso",
    nombre: "el documento se abre en la pagina de la fuente, y si no existe en la primera",
    ejecutar: (t) => {
      const documento = biblioteca().get("ai-dossier");

      t.igual(urlDeDocumento(documento, 7), "biblioteca/the-ai-dossier.pdf#page=7", "la pagina");
      t.igual(urlDeDocumento(documento), "biblioteca/the-ai-dossier.pdf#page=1", "sin pagina");
      t.igual(urlDeDocumento(documento, 500), "biblioteca/the-ai-dossier.pdf#page=1", "fuera del documento");
    },
  },

  // --------------------------------------------------------------- catalogo
  {
    grupo: "Catalogo de casos de IA",
    nombre: "se busca sin tildes, sin mayusculas y con los espacios que sean",
    ejecutar: (t) => {
      t.igual(normalizarTextoDeBusqueda("  Previsión   de CAJA "), "prevision de caja", "tildes y espacios");
      t.igual(normalizarTextoDeBusqueda(null), "", "nada");

      const catalogo = [caso("IA-060", "Previsión predictiva de flujo de caja"), caso("IA-001", "Checklist de cierre")];

      t.igual(filtrarCasos(catalogo, { texto: "prevision" }).length, 1, "sin tilde encuentra con tilde");
      t.igual(filtrarCasos(catalogo, { texto: "ia-001" })[0].id, "IA-001", "por id");
      t.igual(filtrarCasos(catalogo, { texto: "" }).length, 2, "sin texto no filtra");
    },
  },
  {
    grupo: "Catalogo de casos de IA",
    nombre: "un caso se encuentra tambien por como se llama en el documento",
    ejecutar: (t) => {
      const catalogo = [
        caso("IA-123", "Generación de datos sintéticos", {
          fuentes: [{ documento: "ai-dossier", pagina: 81, texto: "Fixing the missing data issue" }],
        }),
        caso("IA-001", "Checklist de cierre"),
      ];

      t.igual(filtrarCasos(catalogo, { texto: "missing data" }).length, 1, "texto en ingles");
    },
  },
  {
    grupo: "Catalogo de casos de IA",
    nombre: "los filtros de etiqueta, documento y dominio se combinan",
    ejecutar: (t) => {
      const catalogo = [
        caso("IA-060", "Previsión de caja", {
          tipoIa: "Analítica",
          fuentes: [{ documento: "financeai", pagina: 5 }],
        }),
        caso("IA-062", "Liquidez intradía", {
          tipoIa: "Agéntica",
          fuentes: [{ documento: "ai-dossier", pagina: 75 }],
        }),
        caso("IA-045", "Consulta en lenguaje natural", {
          tipoIa: "Generativa",
          tipoValor: "Mejor decisión",
          fuentes: [
            { documento: "ai-dossier", pagina: 79 },
            { documento: "financeai", pagina: 5 },
          ],
        }),
      ];

      const apariciones = aparicionesDeCasos([
        {
          id: "tesoreria",
          label: "Tesorería",
          items: [{ capacidad: "Liquidez", subcapacidad: "1.1 Caja", ai: { cases: "Previsión de caja; Liquidez intradía" } }],
        },
        {
          id: "fpa",
          label: "FP&A",
          items: [{ capacidad: "Reporting", subcapacidad: "2.1 Informes", ai: { cases: "Consulta en lenguaje natural" } }],
        },
      ]);

      const ids = (filtros) => filtrarCasos(catalogo, filtros, apariciones).map((entrada) => entrada.id).join(",");

      t.igual(ids({ dominio: "tesoreria" }), "IA-060,IA-062", "por dominio");
      t.igual(ids({ tipoIa: "Agéntica" }), "IA-062", "por tipo de IA");
      t.igual(ids({ tipoValor: "Mejor decisión" }), "IA-045", "por tipo de valor");
      t.igual(ids({ documento: "financeai" }), "IA-060,IA-045", "por documento, en cualquiera de sus fuentes");
      t.igual(ids({ dominio: "tesoreria", documento: "ai-dossier" }), "IA-062", "combinados");
      t.igual(ids({ dominio: "auditoria-interna" }), "", "un dominio sin casos");
      t.igual(ids({}), "IA-060,IA-062,IA-045", "sin filtros, en el orden del catalogo");
    },
  },
  {
    grupo: "Catalogo de casos de IA",
    nombre: "cada aparicion de un caso cuenta, tambien dos veces en el mismo dominio",
    ejecutar: (t) => {
      const apariciones = aparicionesDeCasos([
        {
          id: "controlling",
          label: "Controlling",
          items: [
            { capacidad: "Cierre", subcapacidad: "1.1 Calendario", ai: { cases: "Checklist de cierre; Asientos inusuales" } },
            { capacidad: "Cierre", subcapacidad: "1.2 Asientos", ai: { cases: "Asientos inusuales" } },
            { capacidad: "Cierre", subcapacidad: "1.3 Sin IA" },
          ],
        },
      ]);

      t.igual(apariciones.get("Asientos inusuales").length, 2, "en dos subcapacidades");
      t.igual(apariciones.get("Asientos inusuales")[1].subcapacidad, "1.2 Asientos", "con su subcapacidad");
      t.igual(apariciones.get("Checklist de cierre")[0].dominio, "Controlling", "con su dominio");
      t.igual(apariciones.size, 2, "una subcapacidad sin IA no aporta nada");
      t.igual(titulosDeCasos(" a ;; b; ").join("|"), "a|b", "la lista de ai.cases");
    },
  },
  {
    grupo: "Catalogo de casos de IA",
    nombre: "las opciones de un filtro cuentan sus casos en el orden del catalogo",
    ejecutar: (t) => {
      const cuentas = contarPorCampo(
        [
          caso("IA-1", "a", { tipoIa: "Generativa" }),
          caso("IA-2", "b", { tipoIa: "Analítica" }),
          caso("IA-3", "c", { tipoIa: "Generativa" }),
          caso("IA-4", "d", { tipoIa: "" }),
        ],
        "tipoIa",
      );

      t.igual([...cuentas.keys()].join(","), "Generativa,Analítica", "orden de aparicion");
      t.igual(cuentas.get("Generativa"), 2, "cuenta");
      t.igual(cuentas.has(""), false, "un valor vacio no es una opcion");
    },
  },
  {
    grupo: "Catalogo de casos de IA",
    nombre: "el resumen de fuentes: la precision de la primera, el documento de todas",
    ejecutar: (t) => {
      const casos = [
        caso("IA-1", "a", { fuentes: [{ documento: "financeai", alcance: "caso" }] }),
        caso("IA-2", "b", { fuentes: [{ documento: "financeai", alcance: "area" }] }),
        caso("IA-3", "c", { fuentes: [{ documento: "ai-dossier", alcance: "caso" }, { documento: "financeai" }] }),
        caso("IA-4", "d", {
          fuentes: [{ documento: "ai-dossier", alcance: "caso" }, { documento: "ai-dossier" }],
        }),
        caso("IA-5", "e"),
      ];
      const resumen = resumenDeFuentes(casos);

      t.igual(resumen.total, 5, "total");
      t.igual(resumen.conFuente, 4, "con fuente");
      t.igual(resumen.exactas, 3, "exactas, por la primera fuente");
      t.igual(resumen.aproximadas, 1, "por su area");
      t.igual(resumen.porDocumento.get("financeai"), 3, "por documento, cualquiera de las fuentes");
      t.igual(resumen.porDocumento.get("ai-dossier"), 2, "dos fuentes en el mismo documento, una vez");

      // Lo que promete la tarjeta del documento es lo que ensena su filtro.
      ["financeai", "ai-dossier"].forEach((documento) => {
        t.igual(
          filtrarCasos(casos, { documento }).length,
          resumen.porDocumento.get(documento),
          `la tarjeta de ${documento} y su filtro dicen lo mismo`,
        );
      });
    },
  },
  {
    grupo: "Catalogo de casos de IA",
    nombre: "por brechas: primero lo que ataca prioridades altas, y sin puntuar no cuenta",
    ejecutar: (t) => {
      const catalogo = [
        caso("IA-1", "Checklist de cierre"),
        caso("IA-2", "Asientos inusuales"),
        caso("IA-3", "Previsión de caja"),
        caso("IA-4", "Sin apariciones"),
      ];

      // El motor de verdad necesita el dominio y los objetivos; aqui cada
      // subcapacidad trae ya sus metricas, que es lo que importa al ordenar.
      const sub = (subcapacidad, ia, metricas) => ({ subcapacidad, ai: { cases: ia }, metricas });
      const apariciones = aparicionesDeCasos([
        {
          id: "controlling",
          label: "Controlling",
          items: [
            sub("1.1", "Checklist de cierre; Asientos inusuales", { prioridad: "Media", gap: 1.5 }),
            sub("1.2", "Asientos inusuales", { prioridad: "Alta", gap: 2.5 }),
            sub("1.3", "Checklist de cierre", { isPending: true, prioridad: "Pendiente", gap: null }),
          ],
        },
        {
          id: "tesoreria",
          label: "Tesorería",
          items: [
            sub("2.1", "Previsión de caja", { prioridad: "Media", gap: 1.2 }),
            sub("2.2", "Checklist de cierre", { prioridad: "Baja", gap: 0.5 }),
          ],
        },
      ]);

      const metricasDe = (aparicion) => aparicion.item.metricas;
      const brechas = brechasDeCasos(apariciones, metricasDe);

      t.igual(JSON.stringify(brechas.get("Asientos inusuales")), JSON.stringify({ altas: 1, medias: 1, bajas: 0, gap: 4 }), "suma por caso");
      t.igual(brechas.get("Checklist de cierre").medias, 1, "lo pendiente no cuenta");
      t.igual(brechas.get("Checklist de cierre").bajas, 1, "las bajas se cuentan aparte");

      const orden = (lista) => lista.map((entrada) => entrada.id).join(",");

      t.igual(orden(ordenarPorBrechas(catalogo, brechas)), "IA-2,IA-1,IA-3,IA-4", "altas, luego medias, luego gap");
      t.igual(
        orden(ordenarPorBrechas(catalogo, brechasDeCasos(apariciones, metricasDe, "tesoreria"))),
        "IA-3,IA-1,IA-2,IA-4",
        "con un dominio, solo sus brechas",
      );
      t.igual(orden(ordenarPorBrechas(catalogo, new Map())), "IA-1,IA-2,IA-3,IA-4", "sin nada puntuado, el orden de partida");

      t.igual(textoDeBrechas(brechas.get("Asientos inusuales")), "Ataca 1 brecha alta y 1 media", "texto con las dos");
      t.igual(textoDeBrechas({ altas: 0, medias: 2 }), "Ataca 2 brechas medias", "solo medias");
      t.igual(textoDeBrechas({ altas: 3, medias: 0 }), "Ataca 3 brechas altas", "solo altas");
      t.igual(textoDeBrechas({ altas: 0, medias: 0, bajas: 4 }), "", "una brecha baja no se cuenta");
    },
  },
];
