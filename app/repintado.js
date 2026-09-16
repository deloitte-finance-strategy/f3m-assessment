/**
 * El cortacircuitos del reparto.
 *
 * Casi todo lo que hace algo en esta herramienta termina pidiendo un repintado:
 * cambiar un score, cambiar de dominio, recibir un snapshot de Firebase, tocar
 * un filtro, alternar el tema. Y el repintado lo orquesta la capa de vistas,
 * que a su vez llama a todos esos modulos.
 *
 * Importarlo directamente cerraria un ciclo con casi cada modulo del reparto.
 * Los ciclos entre modulos ES funcionan mientras solo se crucen declaraciones
 * de funcion —se hoistean, y el enlace se resuelve al llamar— pero dejan de
 * funcionar en cuanto alguien lee una constante durante la evaluacion del
 * modulo. Es decir: hoy funcionaria y manana romperia por un cambio que parece
 * inocente, con un error de "no se puede acceder antes de inicializar" a veinte
 * archivos de distancia.
 *
 * Asi que el repintado se registra UNA vez al arrancar y todo el mundo lo pide
 * por aqui. Un solo punto de indireccion, en vez de inyectarlo modulo a modulo.
 */


let repintar = () => {};


/** Lo llama app.js al arrancar, con renderAll(). */
export function configurarRepintado(fn) {
  repintar = fn;
}


/**
 * Repinta la vista visible.
 *
 * Las opciones viajan tal cual: hoy solo `saltarAssessments`, que evita
 * reconstruir las tarjetas de scoring cuando la lista visible no ha cambiado.
 * Sin eso, puntuar perdia el foco y cerraba los paneles de detalle abiertos.
 */
export function repintarTodo(opciones) {
  repintar(opciones);
}
