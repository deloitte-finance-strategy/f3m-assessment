"""Verifica el catalogo de dominios y que los JSON coinciden con los Excel.

Tres comprobaciones, en este orden:

1. El catalogo (data/domains.json) esta completo y es coherente: cada dominio
   tiene los campos que la aplicacion espera, su Excel de origen existe, su
   ruta de datos apunta a data/domains/, no hay ids ni rutas repetidos, ningun
   grupo se sale de los declarados, y no queda ningun JSON huerfano en
   data/domains/ que el catalogo no mencione.

2. Cada subcapacidad encuentra SU fila de casos de IA en la hoja AI Overlay,
   y ninguna fila de esa hoja se queda sin subcapacidad que la use.

3. Cada JSON generado coincide con su Excel: se regenera el payload en memoria
   y se compara con el archivo commiteado. No escribe nada.

Devuelve codigo de salida 1 si algo falla, para poder usarse en CI o antes de
un commit.

    python scripts/check_domains_sync.py
"""

import json
import sys
from pathlib import Path

from openpyxl import load_workbook

from convert_domains import CATALOGO, FILES, ROOT, build_payload, clean, serialize, sheet_rows

CAMPOS_DE_DOMINIO = ("id", "label", "title", "group", "source", "dataUrl")

DIRECTORIO_DE_DATOS = ROOT / "data" / "domains"


def check_catalogo():
    """Devuelve la lista de problemas del catalogo. Vacia si esta bien."""
    problemas = []
    dominios = CATALOGO.get("domains", [])
    grupos = CATALOGO.get("groups", [])

    if not dominios:
        return ["data/domains.json no declara ningun dominio"]

    vistos_id = set()
    vistos_datos = set()
    vistos_origen = set()

    for dominio in dominios:
        did = dominio.get("id", "(sin id)")

        faltan = [campo for campo in CAMPOS_DE_DOMINIO if not dominio.get(campo)]
        if faltan:
            problemas.append(f"{did}: le faltan campos en el catalogo: {', '.join(faltan)}")
            continue

        if did in vistos_id:
            problemas.append(f"{did}: el id esta repetido en el catalogo")
        vistos_id.add(did)

        if dominio["dataUrl"] in vistos_datos:
            problemas.append(f"{did}: dos dominios escriben en {dominio['dataUrl']}")
        vistos_datos.add(dominio["dataUrl"])

        if dominio["source"] in vistos_origen:
            problemas.append(f"{did}: dos dominios leen del mismo Excel, {dominio['source']}")
        vistos_origen.add(dominio["source"])

        if grupos and dominio["group"] not in grupos:
            problemas.append(
                f"{did}: el grupo '{dominio['group']}' no esta en la lista de grupos del catalogo"
            )

        if not dominio["dataUrl"].startswith("data/domains/"):
            problemas.append(f"{did}: dataUrl deberia apuntar a data/domains/, y apunta a {dominio['dataUrl']}")

        if not (ROOT / dominio["source"]).exists():
            problemas.append(f"{did}: no existe el Excel de origen {dominio['source']}")

    # Un JSON que nadie menciona es un dominio que se quedo a medias de anadir o
    # de quitar: la aplicacion no lo carga y el script no lo regenera.
    declarados = {Path(dominio["dataUrl"]).name for dominio in dominios if dominio.get("dataUrl")}

    for archivo in sorted(DIRECTORIO_DE_DATOS.glob("*.json")):
        if archivo.name not in declarados:
            problemas.append(
                f"{archivo.name}: hay un JSON en data/domains/ que el catalogo no menciona"
            )

    return problemas


def check_overlay(config):
    """Devuelve la lista de desajustes entre Assessment y AI Overlay de un dominio.

    Existe por un fallo que estuvo meses sin que nadie lo viera. `find_ai_for_row()`
    tiene un respaldo: si no encuentra la subcapacidad en AI Overlay, devuelve la
    primera fila de esa capacidad y no avisa de nada. Asi es como la subcapacidad
    "3.3 Narrative reporting y envio ESEF" de Controlling —escrita "3.3 Narrative
    reporting y MD&A" en la otra hoja— acabo enseñando los casos de IA de la 3.1,
    y perdiendo los suyos, sin un solo mensaje en consola ni en CI.

    El respaldo se deja en el conversor a proposito, para que un Excel a medias no
    reviente la carga de la aplicacion delante de un cliente. Lo que se hace aqui es
    que deje de ser silencioso: si se usa, el CI se pone rojo.

    Se comprueban las dos direcciones. Una subcapacidad sin fila hereda casos que no
    son suyos; una fila que ninguna subcapacidad usa es trabajo escrito que no se ve
    en ningun sitio.
    """
    libro = load_workbook(config["source"], data_only=True)

    if "AI Overlay" not in libro.sheetnames:
        return [f"{config['source'].name} no tiene hoja AI Overlay"]

    declaradas = {}
    for fila in sheet_rows(libro["AI Overlay"]):
        capacidad = clean(fila.get("Capacidad"))
        if capacidad:
            declaradas.setdefault(capacidad, []).append(clean(fila.get("Subcapacidad")))

    problemas = []
    usadas = set()

    for fila in sheet_rows(libro["Assessment"]):
        capacidad = clean(fila.get("Capacidad"))
        subcapacidad = clean(fila.get("Subcapacidad"))

        if not capacidad or not subcapacidad:
            continue

        del_grupo = declaradas.get(capacidad, [])

        if subcapacidad in del_grupo:
            usadas.add((capacidad, subcapacidad))
            continue

        heredaria = del_grupo[0] if del_grupo else "(ninguna: se quedaria sin casos)"
        problemas.append(
            f'"{subcapacidad}" no tiene fila propia en AI Overlay; '
            f'heredaria los casos de "{heredaria}"'
        )

    for capacidad, subcapacidades in declaradas.items():
        for subcapacidad in subcapacidades:
            if (capacidad, subcapacidad) not in usadas:
                problemas.append(
                    f'la fila de AI Overlay "{capacidad} / {subcapacidad}" no la usa '
                    "ninguna subcapacidad de Assessment"
                )

    return problemas


def check_domain(config):
    """Devuelve (estado, detalle) para un dominio."""
    destino = config["output"]

    if not config["source"].exists():
        return "ERROR", f"falta el Excel de origen: {config['source'].name}"

    if not destino.exists():
        return "ERROR", f"falta el JSON generado: {destino.name}"

    payload = build_payload(config)
    esperado = serialize(payload)
    actual = destino.read_text(encoding="utf-8")

    if esperado == actual:
        return "OK", f"{len(payload['subcapacities'])} subcapacidades"

    # Localizamos la primera línea divergente para que el fallo sea accionable.
    lineas_esperadas = esperado.splitlines()
    lineas_actuales = actual.splitlines()

    for numero, (linea_esperada, linea_actual) in enumerate(
        zip(lineas_esperadas, lineas_actuales), start=1
    ):
        if linea_esperada != linea_actual:
            return "DIFF", (
                f"primera diferencia en la línea {numero}\n"
                f"      Excel dice: {linea_esperada.strip()[:100]}\n"
                f"      JSON dice:  {linea_actual.strip()[:100]}"
            )

    return "DIFF", (
        f"el JSON tiene {len(lineas_actuales)} líneas y el Excel genera "
        f"{len(lineas_esperadas)}"
    )


def main():
    problemas_de_catalogo = check_catalogo()

    print("Catalogo de dominios (data/domains.json)")

    if problemas_de_catalogo:
        for problema in problemas_de_catalogo:
            print(f"  ERROR {problema}")
    else:
        print(
            f"  OK    {len(CATALOGO['domains'])} dominios en "
            f"{len(CATALOGO.get('groups', []))} grupos, sin huerfanos"
        )

    print()
    print("Casos de IA por subcapacidad (Assessment <-> AI Overlay)")

    problemas_de_overlay = 0

    for config in FILES:
        problemas = check_overlay(config)

        if not problemas:
            continue

        problemas_de_overlay += len(problemas)

        for problema in problemas:
            print(f"  ERROR {config['domain_id']}: {problema}")

    if not problemas_de_overlay:
        print(f"  OK    los {len(FILES)} dominios cruzan al 100%")

    print()

    fallos = 0

    for config in FILES:
        estado, detalle = check_domain(config)

        if estado != "OK":
            fallos += 1

        print(f"{estado:<5} {config['domain_id']:<24} {detalle}")

    print()

    if problemas_de_overlay:
        print(
            f"{problemas_de_overlay} subcapacidad(es) sin su fila de casos de IA. "
            "Alinea el nombre en las hojas Assessment y AI Overlay del Excel."
        )

    if problemas_de_catalogo:
        print(
            f"{len(problemas_de_catalogo)} problema(s) en el catalogo. "
            "Revisa data/domains.json."
        )

    if fallos:
        print(
            f"{fallos} dominio(s) desincronizado(s). "
            "Ejecuta 'python scripts/convert_domains.py' para regenerarlos."
        )

    if problemas_de_catalogo or problemas_de_overlay or fallos:
        return 1

    print(f"Los {len(FILES)} dominios coinciden con sus Excel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
