#!/usr/bin/env python3
"""Comprueba que los modulos encajan entre si.

Por que hace falta
------------------

Las pruebas de tests/ solo cargan core/ e informe/, que son funciones puras.
app.js y app/ no se cargan nunca en CI, porque necesitan un navegador: tocan el
DOM en cuanto se evaluan. Es decir, que un import mal puesto al mover una
funcion de sitio pasaba el CI en verde y reventaba en el navegador.

Eso paso dos veces repartiendo app.js, y las dos de la misma forma: la consola
del navegador con un ReferenceError y la pagina a medio pintar. Esta
comprobacion las habria cazado antes de subir nada.

Que comprueba
-------------

1. Que cada `import { a } from "./x.js"` encuentre una `export` de `a` en x.js.
   Esto es exacto: se leen las dos listas y se comparan.

2. Que cada identificador usado en un modulo este declarado ahi, importado, o
   sea un global del navegador. Esto es una heuristica —no hay un analizador de
   JavaScript de por medio— y por eso se limpia el codigo de cadenas, plantillas,
   expresiones regulares y comentarios antes de mirar, y solo se avisa de
   nombres que ALGUN modulo del proyecto declara A NIVEL DE MODULO. Un nombre
   que no existe en ninguna parte es casi siempre una palabra suelta de un
   texto en espanol; uno que solo es local de otra funcion no se puede importar.

   Aqui entran tanto las funciones como las variables de modulo. Las segundas
   se colaban: se daba por declarado todo lo que apareciera dentro de un
   `if ( ... ) {`, que tiene la misma forma que una lista de parametros.

3. Que no se asigne a un nombre que no declara NADIE. Esto cierra el hueco que
   deja la comprobacion anterior, y no es un hueco cualquiera: por el se colo un
   ReferenceError hasta produccion.

   Fue `cancelarSuscripcionRemota`, que se quedo fuera al sacar la persistencia
   de app.js. Se usaba en cinco sitios de app/persistencia.js y no la declaraba
   ya ningun modulo, asi que para la comprobacion 2 era una palabra suelta mas y
   pasaba en verde. En el navegador, `subscribeToSharedScenario()` reventaba en
   su primera linea y la suscripcion al escenario compartido no se abria nunca:
   se subia lo propio y no bajaba nada del resto del equipo.

   El criterio es la ASIGNACION y no el uso, y ahi esta lo que lo hace fiable.
   Leer un nombre libre puede ser ruido; escribir en el es codigo siempre. Por
   eso esta comprobacion si puede hablar de nombres que no existen en ninguna
   parte, que es justo lo que la 2 tiene que callarse.

Codigo de salida 1 si algo no encaja.
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

CARPETAS = ["core", "app", "informe"]
SUELTOS = ["app.js", "tema.js"]

GLOBALES = set("""
window document console localStorage sessionStorage navigator location history
Math JSON Object Array String Number Boolean Date RegExp Map Set WeakMap WeakSet
Promise Error TypeError RangeError Intl Infinity NaN undefined null true false
URL URLSearchParams Blob File FileReader FormData Image Chart crypto
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame
fetch alert confirm prompt Event CustomEvent DOMParser TextEncoder TextDecoder
HTMLScriptElement HTMLElement Element Node NodeList CSS structuredClone
queueMicrotask this arguments globalThis performance AbortController
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent
Symbol Proxy Reflect BigInt process
""".split())

# Palabras clave tras las que una "/" abre una expresion regular, no una
# division: todas esperan una expresion detras.
ANTES_DE_REGEX = set("""
return typeof instanceof in of case do else yield await delete void new
""".split())

# Un `( ... ) {` detras de una de estas no es una lista de parametros, es una
# condicion. Lo que aparezca dentro se usa, no se declara.
CONTROL_DE_FLUJO = set("""
if while for switch catch with
""".split())

PALABRAS = set("""
const let var function return if else for while do switch case break continue
new typeof instanceof delete void in of class extends super import export from
as default try catch finally throw async await yield static get set
""".split())


def sin_literales(texto):
    """Quita comentarios, cadenas, plantillas y expresiones regulares.

    Se recorre caracter a caracter en vez de con expresiones regulares porque
    una plantilla puede ocupar veinte lineas y llevar dentro comillas, llaves y
    hasta otra plantilla. Lo que queda dentro de `${...}` SI se conserva: ahi
    hay identificadores de verdad.
    """
    salida = []
    i = 0
    n = len(texto)
    # Pila de plantillas abiertas, para saber si un "}" cierra una interpolacion.
    plantillas = []

    while i < n:
        c = texto[i]
        siguiente = texto[i + 1] if i + 1 < n else ""

        if c == "/" and siguiente == "/":
            j = texto.find("\n", i)
            i = n if j == -1 else j
            continue

        if c == "/" and siguiente == "*":
            j = texto.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue

        if c in "\"'":
            comilla = c
            i += 1
            while i < n and texto[i] != comilla:
                i += 2 if texto[i] == "\\" else 1
            i += 1
            salida.append(" ")
            continue

        if c == "`":
            plantillas.append(True)
            i += 1
            while i < n:
                if texto[i] == "\\":
                    i += 2
                    continue
                if texto[i] == "`":
                    i += 1
                    plantillas.pop()
                    break
                if texto[i] == "$" and i + 1 < n and texto[i + 1] == "{":
                    # La interpolacion se conserva: se vuelve al bucle de fuera.
                    salida.append(" ")
                    i += 2
                    nivel = 1
                    inicio = i
                    while i < n and nivel:
                        if texto[i] == "{":
                            nivel += 1
                        elif texto[i] == "}":
                            nivel -= 1
                        i += 1
                    salida.append(sin_literales(texto[inicio:i - 1]))
                    continue
                i += 1
            salida.append(" ")
            continue

        # Una "/" es division o expresion regular segun lo que venga antes.
        # Tras un identificador, un numero o un cierre es division... salvo que
        # ese "identificador" sea una palabra clave que espera una expresion
        # detras. `return /re/.test(x)` es el caso que lo hacia fallar: leia el
        # "n" de return, decidia division, y la comilla siguiente abria una
        # cadena que se comia el resto del archivo.
        if c == "/":
            hasta_aqui = "".join(salida).rstrip()
            anterior = hasta_aqui[-1] if hasta_aqui else ""
            palabra = re.search(r"([A-Za-z_$][\w$]*)$", hasta_aqui)
            es_palabra_clave = bool(palabra) and palabra.group(1) in ANTES_DE_REGEX

            if anterior and (anterior.isalnum() or anterior in "_$)]") and not es_palabra_clave:
                salida.append(c)
                i += 1
                continue

            i += 1
            dentro = False
            while i < n:
                if texto[i] == "\\":
                    i += 2
                    continue
                if texto[i] == "[":
                    dentro = True
                elif texto[i] == "]":
                    dentro = False
                elif texto[i] == "/" and not dentro:
                    i += 1
                    break
                elif texto[i] == "\n":
                    break
                i += 1
            while i < n and texto[i].isalpha():
                i += 1
            salida.append(" ")
            continue

        salida.append(c)
        i += 1

    return "".join(salida)


def declarados(codigo):
    nombres = set()
    nombres |= set(re.findall(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)", codigo))
    nombres |= set(re.findall(r"\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)", codigo))
    nombres |= set(re.findall(r"\bclass\s+([A-Za-z_$][\w$]*)", codigo))

    # Parametros y desestructuraciones, aceptados en bloque y sin precision.
    #
    # El patron admite un nivel de parentesis dentro de la lista. Sin eso, una
    # firma con un valor por defecto que llama a algo —renderLeverBars(items =
    # getScopedItems(), ...)— no casaba, sus parametros no se daban por
    # declarados, y el comprobador denunciaba un identificador que si existe.
    #
    # Pero un `( ... ) {` no siempre es una firma: `if (...) {`, `while (...) {`
    # y `switch (...) {` tienen la misma forma. Contarlos daba por DECLARADO
    # todo lo que apareciera en una condicion, en cualquier modulo. Asi se colo
    # `if (!guardadosPendientes.size && pendingScenarioWrites === 0)`: app.js
    # leia una variable que se habia ido a app/persistencia.js, y el
    # comprobador la daba por suya porque estaba dentro de un if. El navegador
    # decia ReferenceError y el freno de cierre de pestana estaba muerto.
    for coincidencia in re.finditer(r"\(((?:[^()]|\([^()]*\))*)\)\s*(?:=>|\{)", codigo):
        anterior = re.search(r"([A-Za-z_$][\w$]*)\s*$", codigo[:coincidencia.start()])

        if anterior and anterior.group(1) in CONTROL_DE_FLUJO:
            continue

        nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", coincidencia.group(1)))

    for bloque in re.findall(r"(?:const|let|var)\s*[\{\[]([^\}\]]*)[\}\]]", codigo):
        nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", bloque))

    for bloque in re.findall(r"catch\s*\(([^)]*)\)", codigo):
        nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", bloque))

    # Del encabezado de un for solo se declara lo que se enlaza. Cogerlo entero
    # daba por declarado tambien aquello sobre lo que se itera: en
    # `for (const item of items)`, `items` no se declara ahi.
    for bloque in re.findall(r"for\s*\(([^)]*)\)", codigo):
        for enlace in re.findall(
            r"(?:const|let|var)\s*(\[[^\]]*\]|\{[^}]*\}|[A-Za-z_$][\w$]*)", bloque
        ):
            nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", enlace))

    return nombres


def declarados_de_modulo(codigo):
    """Solo lo declarado a nivel de modulo.

    declarados() es deliberadamente ancha: mete parametros y variables de
    dentro de una funcion, porque su trabajo es no denunciar nada que este a
    mano. Para decir QUIEN declara un nombre hace falta lo contrario, porque
    una variable local no se puede importar: atribuirle a un modulo algo que
    solo vive dentro de una de sus funciones manda a quien lea el aviso a
    buscar un import que no existiria nunca.
    """
    nombres = set()
    profundidad = 0

    for linea in codigo.splitlines():
        if profundidad == 0:
            encaje = re.match(
                r"\s*(?:export\s+)?(?:async\s+)?"
                r"(?:const|let|var|function\s*\*?|class)\s+([A-Za-z_$][\w$]*)",
                linea,
            )

            if encaje:
                nombres.add(encaje.group(1))

        profundidad = max(0, profundidad + linea.count("{") - linea.count("}"))

    return nombres


def exportados(codigo):
    nombres = set(
        re.findall(
            r"^export\s+(?:async\s+)?(?:function\s*\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)",
            codigo,
            re.M,
        )
    )

    # Tambien la forma en lista, `export { a, b };`, que informe/secciones.js usa
    # para lo que solo necesita informe/pdf.js.
    for bloque in re.findall(r"export\s*\{([^}]*)\}\s*;", codigo):
        for parte in bloque.split(","):
            parte = parte.strip()
            if parte:
                nombres.add(parte.split(" as ")[-1].strip())

    return nombres


def imports(texto):
    """[(nombres_importados, especificador)] de cada import con llaves."""
    salida = []

    for bloque, especificador in re.findall(
        r"import\s*\{([^}]*)\}\s*from\s*[\"']([^\"']+)[\"']", texto
    ):
        nombres = []

        for parte in bloque.split(","):
            parte = parte.strip()
            if parte:
                origen = parte.split(" as ")[0].strip()
                local = parte.split(" as ")[-1].strip()
                nombres.append((origen, local))

        salida.append((nombres, especificador))

    return salida


def usados(codigo):
    # Fuera accesos a propiedad y claves de objeto: no son referencias libres.
    sin = re.sub(r"\.\s*[A-Za-z_$][\w$]*", " ", codigo)
    sin = re.sub(r"([A-Za-z_$][\w$]*)\s*:", " ", sin)
    return set(re.findall(r"\b[A-Za-z_$][\w$]*\b", sin))


def asignados(codigo):
    r"""Nombres a los que se ASIGNA algo siendo una referencia libre.

    Es la firma de una declaracion perdida. La comprobacion 2 mira los USOS, y
    tiene que callarse ante un nombre que no declara nadie porque no puede
    distinguirlo del ruido. Una asignacion no tiene esa ambiguedad: escribir en
    un nombre libre es codigo siempre, nunca una palabra que se ha colado.

    Los cuatro detalles que hacen que esto no denuncie cosas sanas:

    - `(?<![.\w$])` deja fuera `obj.prop = 1`, que asigna a una propiedad y no
      a una variable.
    - `=(?![=>])` distingue la asignacion de `===`, `==` y de la flecha de una
      funcion: `fn = (a) => a` asigna, y `a => a` no.
    - `!=`, `<=` y `>=` no casan solos, porque delante del `=` hay un caracter
      que no es parte del nombre ni espacio.
    - Los parametros con valor por defecto, `function f(a = 1)`, si casan, pero
      `declarados()` ya los da por declarados y por eso no llegan al aviso.

    El incremento va en su forma sufija, `a++`, que es la unica que usa el
    proyecto. Un campo de clase (`class X { campo = 0 }`) si seria un falso
    positivo, pero aqui no hay ni una sola clase; si algun dia la hay, este es
    el sitio donde mirar.
    """
    patron = (
        r"(?<![.\w$])([A-Za-z_$][\w$]*)\s*"
        r"(?:=(?![=>])|[+\-*/%&|^]=|\+\+|--)"
    )

    return set(re.findall(patron, codigo))


def archivos():
    for nombre in SUELTOS:
        ruta = RAIZ / nombre
        if ruta.exists():
            yield ruta

    for carpeta in CARPETAS:
        carpeta_ruta = RAIZ / carpeta
        if carpeta_ruta.exists():
            yield from sorted(carpeta_ruta.rglob("*.js"))


def main():
    rutas = list(archivos())
    codigos = {}
    textos = {}

    for ruta in rutas:
        textos[ruta] = ruta.read_text(encoding="utf-8")
        codigos[ruta] = sin_literales(textos[ruta])

    # Quien declara cada nombre, para no avisar de palabras que no son codigo.
    # Solo cuentan las declaraciones de nivel de modulo: son las unicas que otro
    # modulo podria importar, asi que son las unicas que explican el aviso.
    declarado_en = {}
    for ruta in rutas:
        for nombre in declarados_de_modulo(codigos[ruta]):
            declarado_en.setdefault(nombre, ruta)

    problemas = []

    for ruta in rutas:
        relativa = ruta.relative_to(RAIZ).as_posix()

        # --- 1. cada import encuentra su export
        for nombres, especificador in imports(textos[ruta]):
            if not especificador.startswith("."):
                continue

            destino = (ruta.parent / especificador.split("?")[0]).resolve()

            if not destino.exists():
                problemas.append(f"{relativa}: importa de '{especificador}', que no existe")
                continue

            disponibles = exportados(sin_literales(destino.read_text(encoding="utf-8")))

            for origen, _ in nombres:
                if origen not in disponibles:
                    problemas.append(
                        f"{relativa}: '{especificador}' no exporta '{origen}'"
                    )

        # --- 2. cada nombre usado esta a mano
        locales = declarados(codigos[ruta])
        locales |= {local for nombres, _ in imports(textos[ruta]) for _, local in nombres}
        locales |= set(re.findall(r"import\s+([A-Za-z_$][\w$]*)\s+from", textos[ruta]))

        for nombre in sorted(usados(codigos[ruta]) - locales - GLOBALES - PALABRAS):
            if nombre in declarado_en:
                donde = declarado_en[nombre].relative_to(RAIZ).as_posix()
                problemas.append(
                    f"{relativa}: usa '{nombre}' sin importarlo (lo declara {donde})"
                )

        # --- 3. ninguna asignacion a un nombre que no declara nadie
        #
        # Lo que la 2 no puede decir. Alli un nombre que no declara ningun
        # modulo se deja pasar a proposito, porque no hay con que separarlo del
        # ruido; aqui lo separa la propia asignacion.
        for nombre in sorted(asignados(codigos[ruta]) - locales - GLOBALES - PALABRAS):
            if nombre not in declarado_en:
                problemas.append(
                    f"{relativa}: asigna '{nombre}', que no declara nadie "
                    f"(declaracion perdida: en un modulo ES es un ReferenceError)"
                )

    print(f"Modulos revisados: {len(rutas)}")

    if problemas:
        print("")
        print(f"FALLA  {len(problemas)} problema(s):")
        for problema in problemas:
            print(f"  - {problema}")
        print("")
        print("Las pruebas de tests/ no cargan app.js ni app/: necesitan un")
        print("navegador. Esta comprobacion es lo unico que ve estos fallos")
        print("antes de que aparezcan en la consola de alguien.")
        sys.exit(1)

    print("")
    print("OK    los modulos encajan entre si.")


if __name__ == "__main__":
    main()
