/**
 * Mide si alguna diapositiva del informe se sale de su pagina.
 *
 * No va con los casos de tests/: esos son funciones puras y esto necesita un
 * navegador que maqueten de verdad. Se pega en la consola con el informe
 * abierto —Exportar PDF, y en la ventana que se abre, antes de imprimir— y
 * escribe lo que sobra en cada diapositiva.
 *
 *     copy(...)  ->  pegar en la consola de la ventana del informe
 *
 * Por que hace falta. La diapositiva lleva overflow: hidden, y esta ahi a
 * proposito: sin el, un milimetro de mas genera una pagina en blanco detras de
 * cada una y el PDF sale con veinte paginas vacias intercaladas. Pero recortar
 * en silencio es el fallo que mas caro sale en una sesion con cliente, asi que
 * la red es esta: que nada llegue a recortarse nunca.
 *
 * Hay que volver a pasarlo al tocar informe/estilos.js, al cambiar el tamano de
 * letra de una tabla o al mover POR_DIAPOSITIVA en informe/secciones.js.
 */

(() => {
  const diapositivas = [...document.querySelectorAll("section.slide")];

  if (!diapositivas.length) {
    console.warn("Aqui no hay ningun informe. Abre la ventana de Exportar PDF y vuelve a pegarlo.");
    return;
  }

  const medidas = diapositivas.map((diapositiva, indice) => {
    const cuerpo = diapositiva.querySelector(".slide-cuerpo");
    const pie = diapositiva.querySelector(".slide-pie");

    // El pie va posicionado absoluto, asi que el techo del cuerpo es donde
    // empieza el pie, no el borde de la diapositiva.
    const limite = pie
      ? pie.getBoundingClientRect().top
      : diapositiva.getBoundingClientRect().bottom;

    const finDelContenido = cuerpo
      ? cuerpo.getBoundingClientRect().top + cuerpo.scrollHeight
      : 0;

    return {
      "#": indice + 1,
      diapositiva: (
        diapositiva.querySelector("h2")?.textContent
        || diapositiva.querySelector("h1")?.textContent
        || "portada"
      ).trim(),
      "sobra (px)": Math.round(finDelContenido - limite),
    };
  });

  const desbordan = medidas.filter((medida) => medida["sobra (px)"] > 1);

  if (desbordan.length) {
    console.warn(`${desbordan.length} de ${medidas.length} diapositivas se recortan:`);
    console.table(desbordan);
    return;
  }

  console.log(`Las ${medidas.length} diapositivas caben. El margen mas justo:`);
  console.table(
    [...medidas].sort((a, b) => b["sobra (px)"] - a["sobra (px)"]).slice(0, 3),
  );
})();
