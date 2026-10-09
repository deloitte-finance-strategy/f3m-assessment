#!/usr/bin/env python3
"""Comprueba que todos los modulos se piden con la misma version.

Por que hace falta
------------------

index.html carga app.js con ?v=N, y ese numero existe por un motivo concreto:
GitHub Pages sirve cada archivo con su propia cache, asi que durante unos
minutos tras desplegar puede darse la mezcla "index.html nuevo + app.js viejo".
Con la version en la URL, cada index.html pide su app.js y nunca uno anterior.

El problema es que los imports de un modulo ES resuelven rutas relativas sin
pasar por index.html. Es decir, que `import "./core/calculo.js"` se pedia SIN
version, y un app.js nuevo podia venir acompanado de un core/calculo.js viejo
en cache. Justo la mezcla que el ?v= existe para impedir, una capa mas abajo.

La solucion evidente —un importmap en index.html, con las rutas versionadas en
un solo sitio— no sirve aqui: un importmap en linea esta sujeto a script-src, y
la CSP de esta herramienta NO lleva 'unsafe-inline' a proposito, porque es la
directiva que cierra la inyeccion de codigo. Anadirlo para tener un importmap
mas comodo seria cambiar seguridad por comodidad. Y un importmap externo
depende de soporte reciente del navegador, que aqui no se puede dar por hecho:
la herramienta se abre en el portatil que haya en la sala.

Asi que la version va en cada import. Es mas ruidoso, pero funciona en todos los
navegadores y no toca la CSP. Lo que lo hace mantenible es esta comprobacion:
olvidar una version al desplegar es un CI rojo, no un fallo silencioso en casa
de un cliente.

Y la lista de precargas
-----------------------

index.html pide por adelantado, con <link rel="modulepreload">, todos los
modulos que app.js va a necesitar. Sin eso el navegador los descubre por
capas: baja app.js, lee sus imports, baja esos, lee los suyos... y cada capa es
un viaje al servidor. Eran cuatro viajes seguidos solo para tener el codigo, y
en la wifi de un cliente cada viaje se nota.

Esa lista repite el arbol de imports, y una lista repetida a mano acaba
separandose del original. Por eso se comprueba aqui: un modulo nuevo que no se
precarga no rompe nada —solo carga mas tarde, que es justo lo que no se veria—,
y una precarga de un modulo que ya no existe es una peticion de mas. Las dos
cosas ponen el CI en rojo, con las lineas exactas que hay que poner o quitar.

Y el service worker
-------------------

sw.js guarda la herramienta en el navegador para que se abra sin conexion, en
una cache con el nombre de la version. Al desplegar tiene que cambiar su
VERSION: es lo que hace que el navegador instale el nuevo, guarde la version
nueva y borre la anterior. Si no cambia, sin red se seguiria abriendo la
version vieja. Por eso su VERSION tiene que ser la de index.html.

Codigo de salida 1 si algo no cuadra.
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Donde se buscan imports. tests/ entra a proposito: si los modulos de core/ se
# importan entre si con version y las pruebas los piden sin ella, el navegador
# carga DOS instancias del mismo modulo. Hoy son funciones puras y no pasaria
# nada, pero es la clase de detalle que deja de ser inocente en cuanto alguien
# guarde estado en un modulo.
CARPETAS = ["core", "informe", "tests", "app"]
SUELTOS = ["app.js", "tema.js"]

IMPORT = re.compile(r"""from\s+["'](\.\.?/[^"']+)["']""")
DINAMICO = re.compile(r"""import\s*\(\s*["'](\.\.?/[^"']+)["']\s*\)""")
EXTERNO = re.compile(r"""from\s+["'](https://[^"']+)["']""")
PRECARGA = re.compile(r"""<link\s+rel="modulepreload"\s+href="([^"]+)"\s*>""")
DATOS_PRECARGADOS = re.compile(r"""<link\s+rel="preload"\s+href="([^"]+)"\s+as="fetch"[^>]*>""")


def html_de_index():
    return (RAIZ / "index.html").read_text(encoding="utf-8")


def version_de_index():
    """La version que declara index.html, que es la que manda."""
    html = html_de_index()
    versiones = set(re.findall(r'(?:src|href)="[^"]+\?v=([^"]+)"', html))

    # chart.umd.min.js lleva la suya, que es la del propio Chart.js.
    versiones.discard("4.5.0")

    if len(versiones) != 1:
        print(f"ERROR  index.html declara versiones distintas: {sorted(versiones)}")
        print("       styles.css, tema.js y app.js tienen que llevar el mismo ?v=.")
        sys.exit(1)

    return versiones.pop()


def archivos():
    for nombre in SUELTOS:
        ruta = RAIZ / nombre
        if ruta.exists():
            yield ruta

    for carpeta in CARPETAS:
        for ruta in sorted((RAIZ / carpeta).rglob("*.js")):
            yield ruta


def arbol_de_imports(entrada):
    """Todos los modulos que carga `entrada`, directa o indirectamente.

    Devuelve rutas relativas a la raiz para los locales y la URL tal cual para
    los externos (el SDK de Firebase). De los externos no se siguen sus propios
    imports: firebase-database.js pide firebase-app.js, que ya se importa
    directamente desde app/firebase.js.
    """
    vistos = set()
    pendientes = [entrada]

    while pendientes:
        actual = pendientes.pop()

        if actual in vistos:
            continue

        vistos.add(actual)

        if actual.startswith("https://"):
            continue

        ruta = RAIZ / actual
        texto = ruta.read_text(encoding="utf-8")

        for especificador in EXTERNO.findall(texto):
            pendientes.append(especificador)

        for especificador in IMPORT.findall(texto):
            destino = (ruta.parent / especificador.split("?")[0]).resolve()
            pendientes.append(destino.relative_to(RAIZ).as_posix())

    return vistos


def comprobar_precargas(version):
    """Que index.html precargue exactamente el arbol de imports de app.js."""
    html = html_de_index()
    precargados = {
        href.split("?")[0] for href in PRECARGA.findall(html)
    }
    necesarios = arbol_de_imports("app.js") - {"app.js"}

    faltan = sorted(necesarios - precargados)
    sobran = sorted(precargados - necesarios)

    print(f"Modulos precargados en index.html: {len(precargados)} de {len(necesarios)}")

    if not faltan and not sobran:
        return []

    def linea(modulo):
        href = modulo if modulo.startswith("https://") else f"{modulo}?v={version}"
        return f'<link rel="modulepreload" href="{href}">'

    problemas = []

    for modulo in faltan:
        problemas.append(f"falta la precarga de {modulo}. Anadir: {linea(modulo)}")

    for modulo in sobran:
        problemas.append(f"{modulo} se precarga y nadie lo importa. Quitar: {linea(modulo)}")

    return problemas


def main():
    version = version_de_index()
    problemas = []
    revisados = 0

    for ruta in archivos():
        texto = ruta.read_text(encoding="utf-8")

        for patron in (IMPORT, DINAMICO):
            for especificador in patron.findall(texto):
                revisados += 1

                if f"?v={version}" in especificador:
                    continue

                relativa = ruta.relative_to(RAIZ).as_posix()

                if "?v=" in especificador:
                    problemas.append(
                        f"{relativa}: '{especificador}' lleva otra version, "
                        f"y index.html dice v={version}"
                    )
                else:
                    problemas.append(
                        f"{relativa}: '{especificador}' va sin version. "
                        f"Deberia ser '{especificador}?v={version}'"
                    )

    print(f"Version declarada en index.html: v={version}")
    print(f"Imports relativos revisados: {revisados}")

    if problemas:
        print("")
        print(f"FALLA  {len(problemas)} import(s) sin la version correcta:")
        for problema in problemas:
            print(f"  - {problema}")
        print("")
        print("Al subir el numero en index.html hay que subirlo tambien en los")
        print("imports. Un modulo sin version puede venir en cache de un")
        print("despliegue anterior, que es lo que el ?v= existe para impedir.")
        sys.exit(1)

    print("")
    print("OK    todos los modulos se piden con la misma version.")

    precargas = comprobar_precargas(version)

    if precargas:
        print("")
        print(f"FALLA  la lista de precargas de index.html no cuadra con los imports:")
        for problema in precargas:
            print(f"  - {problema}")
        print("")
        print("Un modulo sin precarga no rompe nada, solo llega mas tarde: el")
        print("navegador no lo descubre hasta haber bajado al que lo importa.")
        sys.exit(1)

    print("OK    index.html precarga todos los modulos, y solo esos.")

    # Los JSON precargados, al reves: lo que no puede pasar es precargar uno
    # que ya no se pide. Ademas de la peticion de mas, el navegador escribe un
    # aviso en la consola a los pocos segundos, y la consola tiene que arrancar
    # en silencio.
    codigo = "".join(
        ruta.read_text(encoding="utf-8") for ruta in archivos() if "tests" not in ruta.parts
    )
    huerfanos = [
        href for href in DATOS_PRECARGADOS.findall(html_de_index())
        if f'"{href}"' not in codigo
    ]

    if huerfanos:
        print("")
        print("FALLA  index.html precarga datos que ningun modulo pide:")
        for href in huerfanos:
            print(f"  - {href}: quitar su <link rel=\"preload\"> o volver a pedirlo")
        sys.exit(1)

    print("OK    los datos precargados son los que pide el arranque.")

    del_service_worker = re.search(
        r"""^const VERSION = ["']([^"']+)["'];""",
        (RAIZ / "sw.js").read_text(encoding="utf-8"),
        re.MULTILINE,
    )

    if not del_service_worker or del_service_worker.group(1) != version:
        print("")
        print(
            f"FALLA  sw.js dice VERSION = {del_service_worker.group(1) if del_service_worker else '(nada)'!r}"
            f" y index.html v={version}."
        )
        print(f'  Poner en sw.js: const VERSION = "{version}";')
        print("  Sin ese cambio, el navegador no instala el service worker nuevo y,")
        print("  sin red, la herramienta se abre con la version anterior.")
        sys.exit(1)

    print("OK    el service worker guarda la misma version.")


if __name__ == "__main__":
    main()
