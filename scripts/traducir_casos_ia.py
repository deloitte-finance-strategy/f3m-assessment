"""Traduce al espanol los casos de uso de IA de los Excel de origen.

    python scripts/traducir_casos_ia.py              # muestra que haria
    python scripts/traducir_casos_ia.py --confirm    # los reescribe

Despues hay que regenerar los JSON y comprobar que siguen cuadrando:

    python scripts/convert_domains.py
    python scripts/check_domains_sync.py

Por que existe este script y no se editaron los JSON a mano: `check_domains_sync.py`
regenera el payload desde el Excel y lo compara como cadena completa con el JSON
commiteado, y el CI lo ejecuta en cada PR. Un JSON traducido a mano deja el
repositorio en DIFF y la siguiente ejecucion de `convert_domains.py` se lleva la
traduccion por delante. La traduccion tiene que vivir en el Excel.

Por que cirugia sobre el zip y no openpyxl: los nueve libros llevan un grafico
(`xl/charts/chart1.xml` mas su `drawing1.xml`) que openpyxl no conserva al
guardar. Se copian todas las entradas del zip tal cual y solo se sustituye
`xl/sharedStrings.xml`, igual que hace `limpiar_metadatos_xlsx.py`.

Por que la sustitucion va por celda y no por reemplazo global sobre el XML: las
cabeceras de columna ("Casos de uso AI asociados", "Aplicacion en nivel
avanzado") son las claves con las que `convert_domains.py` lee las hojas. Un
reemplazo global de "AI" las romperia y el conversor devolveria cadenas vacias.
Aqui se resuelve primero que indice de `sharedStrings` usa cada celda de las
columnas objetivo, saltando siempre la fila de cabecera, y solo se reescriben
esos indices.

Efecto que conviene conocer: en el Excel, la columna "Aplicacion en nivel
avanzado" de la hoja AI Overlay y la columna "Nivel 5 - Avanzado/Referente" de
la hoja Assessment son *la misma cadena compartida* en 130 de los 152 items. El
cambio de sigla alcanza por tanto los criterios de madurez de Nivel 5, que se
ven en las tarjetas de Assessment y en el PDF. Es lo coherente: lo contrario
dejaria "IA" en el modal y "AI" en el criterio de scoring de al lado.
"""

import argparse
import re
import shutil
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape, unescape

sys.path.insert(0, str(Path(__file__).resolve().parent))

from glosario_casos_ia import GLOSARIO

ROOT = Path(__file__).resolve().parents[1]

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NSR = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

SEPARADOR = "; "

# Columnas cuyo texto esta en ingles y se traduce con el glosario de frases. Se
# localizan por el nombre de su cabecera y no por letra: FP&A tiene otra
# disposicion de columnas que los otros ocho.
COLUMNAS_DE_CASOS = {
    ("AI Overlay", "Casos de uso AI asociados"),
    ("Assessment", "Casos de uso AI asociados"),
    ("Roadmap", "Casos AI asociados"),
    ("Heatmap", "Casos AI"),
}

# Columnas que ya estan en espanol y de las que solo se unifica la sigla.
COLUMNAS_DE_SIGLA = {
    ("AI Overlay", "Aplicación en nivel avanzado"),
    ("Assessment", "Nivel 5 - Avanzado/Referente"),
    ("Assessment", "Iniciativa sugerida"),
    ("Roadmap", "Iniciativa sugerida"),
}

# Nombres de producto que se dejan como estan, por acuerdo. La regla de sigla ya
# los respeta —"AI" va pegada a otra letra y no hay limite de palabra—, pero se
# enumeran para que la comprobacion final no los denuncie como olvidos.
INTOCABLES = ("FinanceAI", "GenAI")

# `AI-enabled` califica a sustantivos de los dos generos, asi que la
# concordancia no sale de una sola regla. Los tres femeninos van enumerados y
# el resto cae en el masculino.
CONCORDANCIA = (
    ("Auditoría AI-enabled", "Auditoría basada en IA"),
    ("Planificación predictiva AI-enabled", "Planificación predictiva basada en IA"),
    ("dinámica y AI-enabled", "dinámica y basada en IA"),
    ("AI-enabled", "basado en IA"),
)

# Trozos en ingles incrustados en texto ya espanol que la regla de sigla dejaria
# a medias ("IA use cases", "IA knowledge assistant"). Son los dos unicos: en el
# resto de apariciones, "AI" va seguida de verbo o preposicion en espanol
# ("AI detecta", "AI de", "AI para") y el cambio de sigla basta.
HIBRIDOS = (
    ("AI use cases", "casos de uso de IA"),
    ("AI knowledge assistant", "Asistente de conocimiento con IA"),
)

# Un <si> con varias <r> es texto con formato por tramos y no se toca: partirlo
# perderia el formato. No hay ninguno en las columnas objetivo, y si apareciera
# uno conviene enterarse en vez de estropearlo.
BLOQUE_SIMPLE = re.compile(r"^<si><t([^>]*)>(.*)</t></si>$", re.DOTALL)


class Aborta(Exception):
    """Algo no encaja con lo que el script da por supuesto."""


def hojas_de(z):
    """Nombre de hoja -> ruta de su XML dentro del zip."""
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    destinos = {r.get("Id"): r.get("Target") for r in rels}

    hojas = {}
    for hoja in wb.iter(NS + "sheet"):
        destino = destinos[hoja.get(NSR + "id")].lstrip("/")
        hojas[hoja.get("name")] = ("xl/" + destino).replace("xl/xl/", "xl/")
    return hojas


def columna_de(referencia):
    return re.match(r"([A-Z]+)", referencia).group(1)


def fila_de(referencia):
    return int(re.search(r"(\d+)$", referencia).group(1))


def indices_objetivo(z, textos):
    """Indice de sharedStrings -> tipo de transformacion ("casos" o "sigla")."""
    hojas = hojas_de(z)
    objetivo = {}

    for nombre, ruta in hojas.items():
        casos = {c for h, c in COLUMNAS_DE_CASOS if h == nombre}
        siglas = {c for h, c in COLUMNAS_DE_SIGLA if h == nombre}
        if not casos and not siglas:
            continue

        hoja = ET.fromstring(z.read(ruta))
        celdas = [c for c in hoja.iter(NS + "c") if c.get("r")]

        # La cabecera manda: da el nombre de cada columna y ademas es la fila
        # que nunca se toca.
        cabeceras = {}
        for celda in celdas:
            if fila_de(celda.get("r")) != 1 or celda.get("t") != "s":
                continue
            valor = celda.find(NS + "v")
            if valor is not None and valor.text is not None:
                cabeceras[columna_de(celda.get("r"))] = textos[int(valor.text)]

        for celda in celdas:
            referencia = celda.get("r")
            if celda.get("t") != "s" or fila_de(referencia) < 2:
                continue

            cabecera = cabeceras.get(columna_de(referencia))
            if cabecera in casos:
                tipo = "casos"
            elif cabecera in siglas:
                tipo = "sigla"
            else:
                continue

            valor = celda.find(NS + "v")
            if valor is None or valor.text is None:
                continue

            indice = int(valor.text)
            previo = objetivo.get(indice)
            if previo and previo != tipo:
                raise Aborta(
                    f"la cadena {indice} la comparten una columna de {previo} y "
                    f"una de {tipo} ({nombre}!{referencia}); no se puede aplicar "
                    "una sola transformacion"
                )
            objetivo[indice] = tipo

    return objetivo


def traducir_casos(texto):
    """Traduce una lista de casos de uso separada por "; "."""
    frases = texto.split(SEPARADOR)
    sin_glosario = [f for f in frases if f not in GLOSARIO]
    if sin_glosario:
        raise Aborta(
            "faltan en el glosario estas frases:\n        "
            + "\n        ".join(repr(f) for f in sin_glosario)
        )
    return SEPARADOR.join(GLOSARIO[f] for f in frases)


def unificar_sigla(texto):
    """Pasa a "IA" el texto que ya esta en espanol."""
    for antes, despues in HIBRIDOS:
        texto = texto.replace(antes, despues)
    for antes, despues in CONCORDANCIA:
        texto = texto.replace(antes, despues)
    # El limite de palabra es lo que deja fuera a FinanceAI y GenAI: en ambos la
    # "AI" va pegada a una letra por la izquierda.
    return re.sub(r"\bAI\b", "IA", texto)


def revisar(texto, origen):
    """Denuncia lo que se haya quedado a medias."""
    limpio = texto
    for intocable in INTOCABLES:
        limpio = limpio.replace(intocable, "")
    if re.search(r"\bAI\b|AI-", limpio):
        raise Aborta(f"queda 'AI' sin traducir en {origen}: {texto!r}")


def traducir_libro(ruta):
    """Devuelve (cambios, xml_nuevo). `cambios` es [(antes, despues), ...]."""
    with zipfile.ZipFile(ruta) as z:
        crudo = z.read("xl/sharedStrings.xml").decode("utf-8")
        bloques = re.findall(r"<si>.*?</si>|<si/>", crudo, re.DOTALL)

        declarado = re.search(r'uniqueCount="(\d+)"', crudo)
        if declarado and int(declarado.group(1)) != len(bloques):
            raise Aborta(
                f"sharedStrings declara {declarado.group(1)} cadenas y se han "
                f"encontrado {len(bloques)}"
            )

        textos = []
        for bloque in bloques:
            encaje = BLOQUE_SIMPLE.match(bloque)
            textos.append(unescape(encaje.group(2)) if encaje else None)

        objetivo = indices_objetivo(z, textos)

    cambios = []
    nuevos = dict(zip(range(len(bloques)), bloques))

    for indice, tipo in sorted(objetivo.items()):
        encaje = BLOQUE_SIMPLE.match(bloques[indice])
        if encaje is None:
            raise Aborta(
                f"la cadena {indice} no es un <si><t> simple y no se toca: "
                f"{bloques[indice][:80]!r}"
            )

        antes = textos[indice]
        if not antes:
            continue

        despues = traducir_casos(antes) if tipo == "casos" else unificar_sigla(antes)
        revisar(despues, f"{ruta.name} (cadena {indice})")

        if despues == antes:
            continue

        nuevos[indice] = f"<si><t{encaje.group(1)}>{escape(despues)}</t></si>"
        cambios.append((antes, despues))

    if not cambios:
        return [], None

    # Se reconstruye sustituyendo bloque a bloque sobre el XML original en vez de
    # volver a serializar el arbol: asi todo lo que no se traduce sale byte a
    # byte como estaba.
    partes = []
    resto = crudo
    for indice, bloque in enumerate(bloques):
        corte = resto.index(bloque)
        partes.append(resto[:corte])
        partes.append(nuevos[indice])
        resto = resto[corte + len(bloque):]
    partes.append(resto)

    return cambios, "".join(partes)


def escribir(ruta, xml):
    """Reescribe el zip cambiando solo sharedStrings.xml."""
    temporal = ruta.with_suffix(ruta.suffix + ".tmp")

    with zipfile.ZipFile(ruta) as origen, zipfile.ZipFile(temporal, "w") as destino:
        for entrada in origen.infolist():
            if entrada.filename == "xl/sharedStrings.xml":
                contenido = xml.encode("utf-8")
            else:
                contenido = origen.read(entrada.filename)
            # Se conserva la entrada original (fecha y metodo de compresion) para
            # que el zip resultante se parezca lo mas posible al de partida.
            destino.writestr(entrada, contenido)

    shutil.move(str(temporal), str(ruta))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Reescribe los archivos. Sin este flag solo muestra que haria.",
    )
    parser.add_argument(
        "--ver",
        action="store_true",
        help="Enumera cada cadena antes y despues, no solo el recuento.",
    )
    args = parser.parse_args()

    excels = sorted(ROOT.glob("F3M_*.xlsx"))
    if not excels:
        raise SystemExit("No se han encontrado archivos F3M_*.xlsx en la raiz.")

    total = 0
    fallos = 0

    for ruta in excels:
        try:
            cambios, xml = traducir_libro(ruta)
        except Aborta as error:
            fallos += 1
            print(f"ERROR  {ruta.name}")
            print(f"       {error}")
            continue

        if not cambios:
            print(f"OK     {ruta.name:<48} nada que traducir")
            continue

        total += len(cambios)
        marca = "TRADUC" if args.confirm else "HARIA "
        print(f"{marca} {ruta.name:<48} {len(cambios)} cadenas")

        if args.ver:
            for antes, despues in cambios:
                print(f"       - {antes}")
                print(f"       + {despues}")

        if args.confirm:
            escribir(ruta, xml)

    print()

    if fallos:
        print(f"{fallos} archivo(s) con problemas. No se ha escrito nada en ellos.")
        return 1

    if not total:
        print("Nada que traducir.")
        return 0

    if not args.confirm:
        print(f"Dry-run: {total} cadenas se traducirian. Repite con --confirm.")
        return 0

    print(f"{total} cadenas traducidas.")
    print(
        "\nAhora ejecuta 'python scripts/convert_domains.py' y despues "
        "'python scripts/check_domains_sync.py': regenera los JSON desde los "
        "Excel y los compara con los commiteados."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
