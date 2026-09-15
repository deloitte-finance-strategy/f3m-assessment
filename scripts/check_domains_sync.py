"""Verifica el catalogo de dominios y que los JSON coinciden con los Excel.

Cuatro comprobaciones, en este orden:

1. El catalogo (data/domains.json) esta completo y es coherente: cada dominio
   tiene los campos que la aplicacion espera, su Excel de origen existe, su
   ruta de datos apunta a data/domains/, no hay ids ni rutas repetidos, ningun
   grupo se sale de los declarados, y no queda ningun JSON huerfano en
   data/domains/ que el catalogo no mencione.

2. Cada subcapacidad encuentra SU fila de casos de IA en la hoja AI Overlay,
   y ninguna fila de esa hoja se queda sin subcapacidad que la use.

3. El catalogo de casos de IA (data/casos-ia.json) cuadra con los titulos que
   usan las subcapacidades, en las dos direcciones, y cada caso trae sus dos
   etiquetas con un valor de los declarados.

4. Cada JSON generado coincide con su Excel: se regenera el payload en memoria
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

CATALOGO_DE_CASOS = ROOT / "data" / "casos-ia.json"

CAMPOS_DE_CASO = ("id", "titulo", "descripcion", "tipoIa", "tipoValor")


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


def titulos_de_casos(cadena):
    """Los titulos de un campo ai.cases, que es una lista separada por '; '."""
    return [titulo.strip() for titulo in clean(cadena).split(";") if titulo.strip()]


def check_casos_ia():
    """Devuelve (problemas, resumen) del catalogo de casos de IA.

    El mismo tipo de guardarrail que check_overlay(), y por el mismo motivo: el
    cruce entre los titulos de ai.cases y las fichas de data/casos-ia.json se
    hace en tiempo de render y por texto exacto. Si una tilde se mueve, la
    aplicacion pinta el titulo sin etiquetas y sin frase, y eso no se distingue
    a simple vista de un caso que aun no se ha clasificado. Aqui deja de ser
    silencioso.

    Se cruza contra los JSON de data/domains/ y no contra los Excel a proposito:
    son los que lee la aplicacion, y que coincidan con su Excel ya lo comprueba
    check_domain(). Asi esto sigue diciendo la verdad aunque falte openpyxl.

    Las dos direcciones importan. Un titulo sin ficha es una ficha que no se ve;
    una ficha que no usa nadie es un caso que se quedo fuera del modelo al
    renombrar una entrada de ai.cases.
    """
    if not CATALOGO_DE_CASOS.exists():
        return [f"falta {CATALOGO_DE_CASOS.relative_to(ROOT).as_posix()}"], ""

    try:
        catalogo = json.loads(CATALOGO_DE_CASOS.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return [f"data/casos-ia.json no es JSON valido: {error}"], ""

    casos = catalogo.get("casos", [])

    if not casos:
        return ["data/casos-ia.json no declara ningun caso"], ""

    problemas = []

    tipos_de_ia = {entrada.get("valor") for entrada in catalogo.get("tiposDeIa", [])}
    tipos_de_valor = {entrada.get("valor") for entrada in catalogo.get("tiposDeValor", [])}

    vistos_id = set()
    declarados = {}

    for caso in casos:
        titulo = clean(caso.get("titulo")) or "(sin titulo)"

        faltan = [campo for campo in CAMPOS_DE_CASO if not clean(caso.get(campo))]

        if faltan:
            problemas.append(f'"{titulo}": le faltan campos: {", ".join(faltan)}')
            continue

        if caso["id"] in vistos_id:
            problemas.append(f'"{titulo}": el id {caso["id"]} esta repetido')
        vistos_id.add(caso["id"])

        if caso["titulo"] in declarados:
            problemas.append(f'"{titulo}": el titulo esta repetido, y es la clave del cruce')
        declarados[caso["titulo"]] = caso

        if tipos_de_ia and caso["tipoIa"] not in tipos_de_ia:
            problemas.append(f'"{titulo}": «{caso["tipoIa"]}» no esta en tiposDeIa')

        if tipos_de_valor and caso["tipoValor"] not in tipos_de_valor:
            problemas.append(f'"{titulo}": «{caso["tipoValor"]}» no esta en tiposDeValor')

    usados = {}

    for dominio in CATALOGO.get("domains", []):
        ruta = ROOT / dominio["dataUrl"]

        if not ruta.exists():
            continue

        datos = json.loads(ruta.read_text(encoding="utf-8"))

        for item in datos.get("subcapacities", []):
            for titulo in titulos_de_casos((item.get("ai") or {}).get("cases")):
                usados.setdefault(titulo, []).append(item.get("id", "(sin id)"))

    for titulo in sorted(set(usados) - set(declarados)):
        donde = ", ".join(usados[titulo][:3])
        problemas.append(
            f'"{titulo}": lo usa {donde} y no tiene ficha en data/casos-ia.json; '
            "se pintaria sin etiquetas ni descripcion"
        )

    for titulo in sorted(set(declarados) - set(usados)):
        problemas.append(
            f'"{titulo}" ({declarados[titulo]["id"]}): esta en el catalogo y no lo usa '
            "ninguna subcapacidad"
        )

    resumen = (
        f"{len(declarados)} casos, {sum(len(ids) for ids in usados.values())} apariciones "
        f"en {len(CATALOGO.get('domains', []))} dominios"
    )

    return problemas, resumen


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
    print("Catalogo de casos de IA (data/casos-ia.json <-> ai.cases)")

    problemas_de_casos, resumen_de_casos = check_casos_ia()

    if problemas_de_casos:
        for problema in problemas_de_casos:
            print(f"  ERROR {problema}")
    else:
        print(f"  OK    {resumen_de_casos}")

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

    if problemas_de_casos:
        print(
            f"{len(problemas_de_casos)} problema(s) en el catalogo de casos de IA. "
            "Alinea el titulo en data/casos-ia.json y en la hoja AI Overlay del Excel: "
            "el cruce es por texto exacto."
        )

    if fallos:
        print(
            f"{fallos} dominio(s) desincronizado(s). "
            "Ejecuta 'python scripts/convert_domains.py' para regenerarlos."
        )

    if problemas_de_catalogo or problemas_de_overlay or problemas_de_casos or fallos:
        return 1

    print(f"Los {len(FILES)} dominios coinciden con sus Excel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
