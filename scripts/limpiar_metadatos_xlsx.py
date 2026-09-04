"""Quita los nombres de personas de los metadatos de los Excel de origen.

Los nueve `F3M_*.xlsx` llevan en `docProps/core.xml` un `dc:creator` y un
`cp:lastModifiedBy` con nombre y apellidos de quien los editó. El contenido de
las hojas es metodología genérica, sin datos de cliente, pero esos dos campos
son datos personales en un repositorio público.

    python scripts/limpiar_metadatos_xlsx.py              # muestra qué haría
    python scripts/limpiar_metadatos_xlsx.py --confirm    # los limpia

Reescribe el zip copiando todas las entradas tal cual y sustituyendo solo
`docProps/core.xml` y `docProps/app.xml`. El contenido de las hojas no se toca,
y la forma de comprobarlo es ejecutar después:

    python scripts/check_domains_sync.py

que regenera los JSON desde los Excel y los compara byte a byte con los
commiteados. Si algo del contenido hubiera cambiado, esa comparación falla. Por
eso esto se hace con un script y no a mano.

**Esto limpia el HEAD, no el historial.** Los nombres siguen en los objetos de
git de cada commit anterior, y la autoría de los propios commits ya expone un
correo corporativo por otra vía, cosa que este script no arregla. Reescribir el
historial invalidaría todos los clones y los PR abiertos, y ni siquiera
eliminaría los objetos de los servidores de GitHub sin abrir un ticket con
soporte. Lo que de verdad resuelve esa exposición es que el repositorio sea
privado; esto es higiene, no una solución.

`docProps/custom.xml` se deja como está: son identificadores de SharePoint
(`ContentTypeId`, GUID de listas) sin ningún nombre.
"""

import argparse
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Campos con nombres de personas o de organización. El resto no se toca.
CAMPOS = {
    "docProps/core.xml": ("dc:creator", "cp:lastModifiedBy"),
    "docProps/app.xml": ("Company", "Manager"),
}


def vaciar(xml, etiquetas):
    """Deja las etiquetas presentes pero sin contenido.

    Se vacían en vez de borrarlas para no cambiar la forma del documento: Excel
    espera esos elementos, y una etiqueta vacía es exactamente lo que escribe
    cuando el campo no está relleno.
    """
    encontrados = {}

    for etiqueta in etiquetas:
        patron = re.compile(
            rf"<{re.escape(etiqueta)}(\s[^>]*)?>(.*?)</{re.escape(etiqueta)}>",
            re.DOTALL,
        )

        def sustituir(m):
            if m.group(2):
                encontrados[etiqueta] = m.group(2)
            return f"<{etiqueta}{m.group(1) or ''}></{etiqueta}>"

        xml = patron.sub(sustituir, xml)

    return xml, encontrados


def limpiar(ruta, confirmar):
    origen = zipfile.ZipFile(ruta)
    entradas = origen.infolist()
    encontrados_totales = {}
    nuevos = {}

    for nombre, etiquetas in CAMPOS.items():
        if nombre not in origen.namelist():
            continue

        xml = origen.read(nombre).decode("utf-8")
        limpio, encontrados = vaciar(xml, etiquetas)

        if encontrados:
            encontrados_totales.update(encontrados)
            nuevos[nombre] = limpio

    if not encontrados_totales:
        origen.close()
        return {}

    if not confirmar:
        origen.close()
        return encontrados_totales

    temporal = ruta.with_suffix(ruta.suffix + ".tmp")

    with zipfile.ZipFile(temporal, "w") as destino:
        for entrada in entradas:
            datos = nuevos.get(entrada.filename)
            contenido = (
                datos.encode("utf-8") if datos else origen.read(entrada.filename)
            )
            # Se conserva la entrada original (fecha y metodo de compresion) para
            # que el zip resultante se parezca lo mas posible al de partida.
            destino.writestr(entrada, contenido)

    origen.close()
    shutil.move(str(temporal), str(ruta))

    return encontrados_totales


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Reescribe los archivos. Sin este flag solo muestra qué haría.",
    )
    args = parser.parse_args()

    excels = sorted(ROOT.glob("F3M_*.xlsx"))

    if not excels:
        raise SystemExit("No se han encontrado archivos F3M_*.xlsx en la raíz.")

    tocados = 0

    for ruta in excels:
        encontrados = limpiar(ruta, args.confirm)

        if not encontrados:
            print(f"OK     {ruta.name:<48} sin nombres en los metadatos")
            continue

        tocados += 1
        marca = "LIMPIO" if args.confirm else "TIENE "
        detalle = ", ".join(f"{k}={v!r}" for k, v in sorted(encontrados.items()))
        print(f"{marca} {ruta.name:<48} {detalle}")

    print()

    if not tocados:
        print("Nada que limpiar.")
        return 0

    if not args.confirm:
        print(f"Dry-run: {tocados} archivo(s) se reescribirían. Repite con --confirm.")
        return 0

    print(f"{tocados} archivo(s) reescritos.")
    print(
        "\nAhora ejecuta 'python scripts/check_domains_sync.py': regenera los JSON "
        "desde los Excel y los compara con los commiteados. Si pasa, el contenido "
        "de las hojas está intacto."
    )
    print(
        "\nRecuerda que esto limpia el HEAD, no el historial de git. Los nombres "
        "siguen en los commits anteriores."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
