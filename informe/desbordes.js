/**
 * Mide si alguna diapositiva del informe se sale de su pagina.
 *
 * Por que hace falta. La diapositiva lleva overflow: hidden, y esta ahi a
 * proposito: sin el, un milimetro de mas genera una pagina en blanco detras de
 * cada una y el PDF sale con veinte paginas vacias intercaladas. Pero recortar
 * en silencio es el fallo que mas caro sale en una sesion con cliente, asi que
 * la red es esta: que nada llegue a recortarse nunca.
 *
 * Hay que volver a pasarlo al tocar informe/estilos.js, al cambiar el tamano de
 * letra de una tabla o al mover POR_DIAPOSITIVA en informe/secciones.js. Y
 * sobre Controlling, que con 24 subcapacidades es el dominio que aprieta.
 *
 * Como se pasa: abrir la herramienta con ?comprobar=desbordes en la direccion y
 * exportar el informe. La medida sale en el aviso de la aplicacion.
 *
 * Antes esto era un archivo que habia que copiar y pegar en la consola de la
 * ventana del informe. Se movio aqui por dos motivos. Uno, que pegar un archivo
 * en una consola es un paso que se salta: una comprobacion que cuesta se deja
 * de hacer. Y dos, que la alternativa evidente —un boton dentro del informe— no
 * es posible: la ventana del informe NO lleva scripts a proposito, y ademas
 * hereda la CSP de index.html, que no admite scripts en linea.
 *
 * Se mide desde la aplicacion, que tiene el documento del informe a mano porque
 * lo acaba de escribir ella misma.
 */


/**
 * Cuanto sobra en cada diapositiva de un documento de informe.
 *
 * Recibe el documento en vez de tomarlo de `window`: asi mide el del informe y
 * no el de la aplicacion, y de paso se puede probar con uno de mentira.
 */
export function medirDiapositivas(documento) {
  const diapositivas = [...(documento?.querySelectorAll?.("section.slide") || [])];

  return diapositivas.map((diapositiva, indice) => {
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
      numero: indice + 1,
      titulo: (
        diapositiva.querySelector("h2")?.textContent
        || diapositiva.querySelector("h1")?.textContent
        || "portada"
      ).trim(),
      sobra: Math.round(finDelContenido - limite),
    };
  });
}


/**
 * La lectura de las medidas, en una frase.
 *
 * El margen de un pixel no es cosmetico: el redondeo de getBoundingClientRect()
 * y el del navegador al maquetar dan diferencias de menos de un pixel que no
 * recortan nada. Marcar esas como desbordes haria que la comprobacion diera
 * falsos positivos en cada pasada, y una alarma que siempre suena se ignora.
 */
export function resumenDeDesbordes(medidas) {
  if (!medidas.length) {
    return {
      hayDesbordes: false,
      tono: "aviso",
      mensaje:
        "No se ha encontrado ninguna diapositiva que medir. ¿Se ha llegado a generar el informe?",
    };
  }

  const desbordan = medidas.filter((medida) => medida.sobra > 1);

  if (desbordan.length) {
    const peores = [...desbordan]
      .sort((a, b) => b.sobra - a.sobra)
      .slice(0, 3)
      .map((medida) => `${medida.titulo} (${medida.sobra} px)`)
      .join(", ");

    return {
      hayDesbordes: true,
      tono: "error",
      mensaje:
        `${desbordan.length} de ${medidas.length} diapositivas se recortan. ` +
        `Las que más sobran: ${peores}.`,
    };
  }

  // El margen mas justo es el dato util cuando todo cabe: dice cuanto queda
  // antes de que la proxima fila empiece a recortar.
  const masJusta = [...medidas].sort((a, b) => b.sobra - a.sobra)[0];

  return {
    hayDesbordes: false,
    tono: "exito",
    mensaje:
      `Las ${medidas.length} diapositivas caben. La más justa es «${masJusta.titulo}», ` +
      `con ${Math.abs(masJusta.sobra)} px de margen.`,
  };
}
