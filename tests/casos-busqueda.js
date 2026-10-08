/**
 * Pruebas de core/busqueda.js: el buscador de subcapacidades de Ctrl+K.
 *
 * Un buscador que no encuentra lo que esta en pantalla parece roto, y en un
 * taller se teclea deprisa y sin tildes.
 */

import { buscarSubcapacidades, trozosResaltados } from "../core/busqueda.js?v=24";


const DOMINIOS = [
  {
    id: "fpa",
    label: "FP&A",
    items: [
      { id: "fpa-1-1", capacidad: "Presupuestos y previsiones", subcapacidad: "1.1 Elaboración del presupuesto anual" },
      { id: "fpa-1-2", capacidad: "Presupuestos y previsiones", subcapacidad: "1.2 Previsiones y reprevisiones" },
    ],
  },
  {
    id: "tesoreria",
    label: "Tesorería",
    items: [
      { id: "tes-2-1", capacidad: "Gestión de caja", subcapacidad: "2.1 Conciliación bancaria" },
      { id: "tes-2-2", capacidad: "Gestión de caja", subcapacidad: "2.2 Previsión de tesorería" },
    ],
  },
];


const ids = (consulta) => buscarSubcapacidades(DOMINIOS, consulta).resultados.map((r) => r.item.id);


export const casos = [
  {
    grupo: "Buscador de subcapacidades",
    nombre: "encuentra sin tildes, sin mayúsculas y con las palabras en cualquier orden",
    ejecutar: (t) => {
      t.igual(ids("conciliacion").join(), "tes-2-1", "sin tilde");
      t.igual(ids("CONCILIACIÓN").join(), "tes-2-1", "en mayúsculas y con tilde");
      t.igual(ids("caja tesoreria").join(), "tes-2-2,tes-2-1", "por capacidad y dominio, en otro orden; primero la que lo lleva en el nombre");
      t.igual(ids("bancaria tesoreria").join(), "tes-2-1", "todas las palabras tienen que estar");
      t.igual(ids("nada que ver").length, 0, "sin resultados");
      t.igual(ids("   ").length, 0, "una consulta vacía no devuelve todo");
    },
  },
  {
    grupo: "Buscador de subcapacidades",
    nombre: "pone primero lo que está en el nombre, y empatados en el orden de la herramienta",
    ejecutar: (t) => {
      t.igual(ids("prevision").join(), "fpa-1-2,tes-2-2,fpa-1-1", "las dos que lo llevan en el nombre, en el orden de los dominios, y luego la de la capacidad");
      t.igual(ids("presupuesto").join(), "fpa-1-1,fpa-1-2", "en el nombre gana a en la capacidad");
      t.igual(ids("2.1").join(), "tes-2-1", "por el número de la subcapacidad");
    },
  },
  {
    grupo: "Buscador de subcapacidades",
    nombre: "devuelve como mucho el máximo y dice cuántos había",
    ejecutar: (t) => {
      const { resultados, total } = buscarSubcapacidades(DOMINIOS, "a", 3);

      t.igual(resultados.length, 3, "recortado al máximo");
      t.igual(total, 4, "el total cuenta también los que no caben");
      t.igual(resultados[0].dominio, "FP&A", "con el nombre del dominio para la pantalla");
    },
  },
  {
    grupo: "Buscador de subcapacidades",
    nombre: "resalta en el texto original, con sus tildes",
    ejecutar: (t) => {
      const trozos = trozosResaltados("2.2 Previsión de tesorería", "prevision tesoreria");

      t.igual(
        trozos.map((trozo) => (trozo.resaltado ? `[${trozo.texto}]` : trozo.texto)).join(""),
        "2.2 [Previsión] de [tesorería]",
      );
      t.igual(trozosResaltados("Caja", "").length, 1, "sin consulta, un solo trozo sin marcar");
      t.igual(trozosResaltados("", "caja").length, 0, "sin texto, nada");
      t.igual(
        trozosResaltados("Caja y caja", "caja").filter((trozo) => trozo.resaltado).length,
        2,
        "todas las apariciones",
      );
    },
  },
];
