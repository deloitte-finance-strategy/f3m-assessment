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


def version_de_index():
    """La version que declara index.html, que es la que manda."""
    html = (RAIZ / "index.html").read_text(encoding="utf-8")
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


if __name__ == "__main__":
    main()
