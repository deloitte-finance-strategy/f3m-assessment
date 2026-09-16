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
   nombres que ALGUN modulo del proyecto declara. Un nombre que no existe en
   ninguna parte es casi siempre una palabra suelta de un texto en espanol.

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
    for bloque in re.findall(r"\(([^()]*)\)\s*(?:=>|\{)", codigo):
        nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", bloque))

    for bloque in re.findall(r"(?:const|let|var)\s*[\{\[]([^\}\]]*)[\}\]]", codigo):
        nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", bloque))

    for bloque in re.findall(r"catch\s*\(([^)]*)\)", codigo):
        nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", bloque))

    for bloque in re.findall(r"for\s*\(([^)]*)\)", codigo):
        nombres |= set(re.findall(r"[A-Za-z_$][\w$]*", bloque))

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
    declarado_en = {}
    for ruta in rutas:
        for nombre in declarados(codigos[ruta]):
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
