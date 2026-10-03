"""Verifica el catalogo de dominios y que los JSON coinciden con los Excel.

Cinco comprobaciones, en este orden:

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

4. La biblioteca de IA (data/biblioteca.json) apunta a archivos que existen, y
   cada caso dice de que documento sale y en que pagina, con una pagina que el
   documento tiene.

5. Cada JSON generado coincide con su Excel: se regenera el payload en memoria
   y se compara con el archivo commiteado. No escribe nada.

Devuelve codigo de salida 1 si algo falla, para poder usarse en CI o antes de
un commit.

    python scripts/check_domains_sync.py
"""

import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

from convert_domains import CATALOGO, FILES, ROOT, build_payload, clean, serialize, sheet_rows

CAMPOS_DE_DOMINIO = ("id", "label", "title", "group", "source", "dataUrl")

DIRECTORIO_DE_DATOS = ROOT / "data" / "domains"

CATALOGO_DE_CASOS = ROOT / "data" / "casos-ia.json"

CAMPOS_DE_CASO = ("id", "titulo", "descripcion", "tipoIa", "tipoValor")

BIBLIOTECA = ROOT / "data" / "biblioteca.json"

UNIDADES_DE_DOCUMENTO = ("pagina", "diapositiva")

ID_DE_DOCUMENTO = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

RUTA_DE_BIBLIOTECA = re.compile(r"^biblioteca/[A-Za-z0-9._-]+$")


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


def check_documento(documento, vistos):
    """Los problemas de un documento de data/biblioteca.json.

    Las mismas reglas que normalizarDocumento() en core/biblioteca.js: alli se
    descarta en silencio lo que no se puede ensenar, para que la pantalla no se
    rompa; aqui se dice, para que no se descarte sin que nadie se entere.
    """
    ident = documento.get("id") or "(sin id)"
    problemas = []

    if not ID_DE_DOCUMENTO.match(str(documento.get("id", ""))):
        problemas.append(f"{ident}: el id tiene que ir en minusculas, cifras y guiones")
    elif ident in vistos:
        problemas.append(f"{ident}: el id esta repetido")

    if not clean(documento.get("titulo")):
        problemas.append(f"{ident}: le falta el titulo")

    if documento.get("unidad") not in UNIDADES_DE_DOCUMENTO:
        problemas.append(
            f"{ident}: la unidad tiene que ser {' o '.join(UNIDADES_DE_DOCUMENTO)}"
        )

    total = documento.get("total")

    if not isinstance(total, int) or isinstance(total, bool) or total < 1:
        problemas.append(f"{ident}: 'total' tiene que ser el numero de paginas o diapositivas")

    for campo, obligatorio in (("archivo", True), ("original", False)):
        ruta = documento.get(campo)

        if not ruta:
            if obligatorio:
                problemas.append(f"{ident}: le falta '{campo}'")
            continue

        if not isinstance(ruta, str) or not RUTA_DE_BIBLIOTECA.match(ruta) or ".." in ruta:
            problemas.append(f"{ident}: '{campo}' tiene que ser un archivo dentro de biblioteca/")
        elif not (ROOT / ruta).exists():
            problemas.append(f"{ident}: no existe {ruta}")

    if documento.get("archivo") and not str(documento["archivo"]).lower().endswith(".pdf"):
        problemas.append(
            f"{ident}: 'archivo' tiene que ser un PDF, que es lo que sabe ensenar el "
            "navegador; el original va en 'original'"
        )

    return problemas


def check_fuentes(caso, documentos, con_problemas=frozenset()):
    """Los problemas de las fuentes de un caso, contra los documentos validos.

    Una fuente que apunta a un documento que ya tiene sus propios problemas no
    se repite aqui: el fallo es del documento, y ya se ha dicho una vez.
    """
    titulo = clean(caso.get("titulo")) or "(sin titulo)"
    fuentes = caso.get("fuentes")

    if not fuentes:
        return [
            f'"{titulo}": no dice de que documento sale; sin fuente, la ficha se pinta '
            "sin «Más información»"
        ]

    if not isinstance(fuentes, list):
        return [f'"{titulo}": \'fuentes\' tiene que ser una lista']

    problemas = []

    for numero, fuente in enumerate(fuentes, start=1):
        donde = f'"{titulo}", fuente {numero}'

        # Una fuente mal escrita —un id suelto en vez del objeto, o el id dentro
        # de una lista— se dice como las demas. Sin esto el script se caia con
        # una traza en vez de decir cual era.
        if not isinstance(fuente, dict) or not isinstance(fuente.get("documento"), str):
            problemas.append(
                f"{donde}: tiene que ser un objeto con 'documento', el id de un documento "
                "de data/biblioteca.json, y su 'pagina'"
            )
            continue

        ident = fuente["documento"]
        documento = documentos.get(ident)

        if ident in con_problemas:
            continue

        if not documento:
            problemas.append(f"{donde}: el documento no esta en data/biblioteca.json")
            continue

        total = documento["total"]
        pagina = fuente.get("pagina")
        hasta = fuente.get("hasta", pagina)

        if not isinstance(pagina, int) or isinstance(pagina, bool) or not 1 <= pagina <= total:
            problemas.append(f"{donde}: la pagina tiene que estar entre 1 y {total}")
        elif not isinstance(hasta, int) or isinstance(hasta, bool) or not pagina <= hasta <= total:
            problemas.append(f"{donde}: 'hasta' tiene que estar entre {pagina} y {total}")

        if not clean(fuente.get("texto")):
            problemas.append(
                f"{donde}: falta 'texto', como se llama el caso en el documento; sin el, "
                "encontrarlo en la pagina es leerla entera"
            )

        alcance = fuente.get("alcance", "caso")

        if alcance not in ("caso", "area"):
            problemas.append(f"{donde}: 'alcance' tiene que ser caso o area")
        elif alcance == "area" and not clean(fuente.get("nota")):
            problemas.append(f"{donde}: una referencia de area tiene que explicar por que en 'nota'")

    return problemas


def check_biblioteca():
    """Devuelve (problemas, avisos, resumen) de la biblioteca de IA.

    El fallo que se vigila es el silencioso: un archivo renombrado, una pagina
    que el documento no tiene o un caso nuevo sin fuente no rompen nada a la
    vista. La ficha se pinta igual, solo que sin «Más información», o con uno
    que abre la pagina equivocada delante del cliente.

    Un documento que ningun caso cita es un aviso y no un fallo. La biblioteca
    empieza por los dos documentos principales y va a crecer, y lo natural es
    subir un documento antes de terminar de apuntar sus casos; la pestana IA ya
    lo ensena asi, sin el boton de ver sus casos.
    """
    if not BIBLIOTECA.exists():
        return [f"falta {BIBLIOTECA.relative_to(ROOT).as_posix()}"], [], ""

    try:
        biblioteca = json.loads(BIBLIOTECA.read_text(encoding="utf-8"))
        casos = json.loads(CATALOGO_DE_CASOS.read_text(encoding="utf-8")).get("casos", [])
    except (json.JSONDecodeError, OSError) as error:
        return [f"no se puede leer la biblioteca o el catalogo de casos: {error}"], [], ""

    problemas = []
    documentos = {}
    con_problemas = set()

    # Lo que no es un objeto se dice y se salta, en vez de tumbar el script con
    # una traza que no dice que entrada es.
    declarados = biblioteca.get("documentos", []) if isinstance(biblioteca, dict) else []
    casos = [caso for caso in casos if isinstance(caso, dict)]

    for documento in declarados:
        if not isinstance(documento, dict):
            problemas.append("data/biblioteca.json: cada documento tiene que ser un objeto")
            continue

        propios = check_documento(documento, documentos)
        problemas.extend(propios)
        ident = documento.get("id")

        if not propios:
            documentos[ident] = documento
        elif isinstance(ident, str) and ident not in documentos:
            con_problemas.add(ident)

    if not documentos and not con_problemas:
        problemas.append("data/biblioteca.json no declara ningun documento")

    for caso in casos:
        problemas.extend(check_fuentes(caso, documentos, con_problemas))

    usados = {
        fuente["documento"]
        for caso in casos
        for fuente in (caso.get("fuentes") or [])
        if isinstance(fuente, dict) and isinstance(fuente.get("documento"), str)
    }

    avisos = [
        f"{ident}: ningun caso lo cita todavia; si sus casos ya estan en el catalogo, "
        "falta apuntarlos en sus 'fuentes'"
        for ident in sorted(set(documentos) - usados)
    ]

    resumen = (
        f"{len(documentos)} documentos, "
        f"{sum(1 for caso in casos if caso.get('fuentes'))} de {len(casos)} casos con su fuente"
    )

    return problemas, avisos, resumen


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
    print("Biblioteca de IA (data/biblioteca.json <-> fuentes de cada caso)")

    problemas_de_biblioteca, avisos_de_biblioteca, resumen_de_biblioteca = check_biblioteca()

    for problema in problemas_de_biblioteca:
        print(f"  ERROR {problema}")

    for aviso in avisos_de_biblioteca:
        print(f"  AVISO {aviso}")

    if not problemas_de_biblioteca:
        print(f"  OK    {resumen_de_biblioteca}")

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

    if problemas_de_biblioteca:
        print(
            f"{len(problemas_de_biblioteca)} problema(s) en la biblioteca de IA. "
            "Como se anade un documento o una fuente: biblioteca/LEEME.md."
        )

    if fallos:
        print(
            f"{fallos} dominio(s) desincronizado(s). "
            "Ejecuta 'python scripts/convert_domains.py' para regenerarlos."
        )

    if (
        problemas_de_catalogo
        or problemas_de_overlay
        or problemas_de_casos
        or problemas_de_biblioteca
        or fallos
    ):
        return 1

    print(f"Los {len(FILES)} dominios coinciden con sus Excel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
