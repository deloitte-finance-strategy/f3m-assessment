"""Trae los 100 casos de uso de IA del Excel del equipo a data/casos-ia.json.

Es un arranque de una sola vez y por eso se llama bootstrap. Los tres campos
que aporta —la frase de "que hace" y las dos etiquetas— se escribieron a mano
en un Excel de trabajo, y este script los mete en el repositorio. A partir de
ahi la direccion del flujo se invierte y se queda como esta en todo lo demas:

    data/casos-ia.json  ->  scripts/generar_excel_casos_ia.py  ->  el Excel

O sea: el repositorio es la fuente y el documento del equipo es la salida. Si
alguien corrige una etiqueta en su copia del Excel, hay que traerla al JSON a
conciencia; no se recoge sola.

El script se conserva por trazabilidad: dice de donde salio cada campo y como
se leyo. Necesita el Excel de origen, que no esta versionado.

    python scripts/bootstrap_casos_ia.py [ruta-del-excel]
"""

import json
import sys
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]

EXCEL_POR_DEFECTO = ROOT / "Casos_de_uso_IA_Finance_Strategy.xlsx"

SALIDA = ROOT / "data" / "casos-ia.json"

HOJA_DE_CASOS = "2. Los 100 casos"
HOJA_DE_LEYENDA = "5. Leyenda"

# Las columnas del Excel del equipo, por su nombre de cabecera. Se leen por
# nombre y no por posicion: el documento lleva catorce columnas y solo siete
# entran aqui, y anadir una columna intermedia no deberia romper esto.
COLUMNAS = {
    "id": "ID",
    "titulo": "Caso de uso de IA",
    "descripcion": "Qué hace",
    "tipoIa": "Tipo de IA",
    "tipoValor": "Tipo de valor",
    "poc": "POC en cliente",
    "origen": "Origen",
}

COMENTARIO = (
    "Fuente unica de los casos de uso de IA: que hace cada uno y sus dos etiquetas. "
    "Lo lee app.js (para las fichas del modal de IA y de la tarjeta de assessment), "
    "scripts/check_domains_sync.py (que cruza estos titulos con los de ai.cases de "
    "data/domains/*.json, en las dos direcciones) y scripts/generar_excel_casos_ia.py "
    "(que regenera el documento del equipo). El cruce con las subcapacidades se hace "
    "por 'titulo', que coincide exactamente con cada entrada de ai.cases. Los campos "
    "'poc' y 'origen' no los usa la aplicacion: estan para que el Excel del equipo se "
    "pueda regenerar sin perder nada."
)


def clean(value):
    if value is None:
        return ""
    return str(value).strip()


def filas(hoja):
    """Las filas de una hoja como diccionarios indexados por su cabecera."""
    todas = list(hoja.iter_rows(values_only=True))

    if not todas:
        return []

    cabeceras = [clean(celda) for celda in todas[0]]
    salida = []

    for fila in todas[1:]:
        if not any(celda not in (None, "") for celda in fila):
            continue

        registro = {}

        for indice, cabecera in enumerate(cabeceras):
            if cabecera:
                registro[cabecera] = fila[indice] if indice < len(fila) else None

        salida.append(registro)

    return salida


def leer_leyenda(hoja):
    """Los valores admitidos de cada etiqueta, con su definicion.

    La hoja de leyenda no tiene cabeceras: es una lista de dos columnas donde el
    nombre de la etiqueta abre cada bloque y las filas siguientes son sus valores,
    hasta la primera fila vacia. Se lee asi y no con una lista fija en el codigo
    porque las definiciones son texto que el equipo escribio y revisa.
    """
    bloques = {"Tipo de IA": [], "Tipo de valor": []}
    actual = None

    for fila in hoja.iter_rows(values_only=True):
        etiqueta = clean(fila[0] if len(fila) > 0 else "")
        definicion = clean(fila[1] if len(fila) > 1 else "")

        if etiqueta in bloques and not definicion:
            actual = etiqueta
            continue

        if not etiqueta or not definicion:
            actual = None
            continue

        if actual:
            bloques[actual].append({"valor": etiqueta, "definicion": definicion})

    return bloques


def construir(ruta_excel):
    libro = load_workbook(ruta_excel, data_only=True)

    for hoja in (HOJA_DE_CASOS, HOJA_DE_LEYENDA):
        if hoja not in libro.sheetnames:
            raise SystemExit(f"El Excel no tiene la hoja «{hoja}»: {ruta_excel}")

    leyenda = leer_leyenda(libro[HOJA_DE_LEYENDA])

    tipos_de_ia = {entrada["valor"] for entrada in leyenda["Tipo de IA"]}
    tipos_de_valor = {entrada["valor"] for entrada in leyenda["Tipo de valor"]}

    casos = []
    problemas = []

    for fila in filas(libro[HOJA_DE_CASOS]):
        caso = {clave: clean(fila.get(columna)) for clave, columna in COLUMNAS.items()}

        if not caso["titulo"]:
            continue

        # Se avisa en vez de escribir un JSON a medias: un caso sin etiqueta
        # llegaria a la herramienta como una ficha con un hueco, y el hueco no
        # explica de quien es la culpa.
        for clave in ("id", "descripcion", "tipoIa", "tipoValor"):
            if not caso[clave]:
                problemas.append(f"{caso['id'] or caso['titulo']}: le falta «{COLUMNAS[clave]}»")

        if caso["tipoIa"] and caso["tipoIa"] not in tipos_de_ia:
            problemas.append(f"{caso['id']}: «{caso['tipoIa']}» no esta en la leyenda de Tipo de IA")

        if caso["tipoValor"] and caso["tipoValor"] not in tipos_de_valor:
            problemas.append(
                f"{caso['id']}: «{caso['tipoValor']}» no esta en la leyenda de Tipo de valor"
            )

        casos.append(
            {
                "id": caso["id"],
                "titulo": caso["titulo"],
                "descripcion": caso["descripcion"],
                "tipoIa": caso["tipoIa"],
                "tipoValor": caso["tipoValor"],
                "poc": caso["poc"].lower().startswith("s"),
                "origen": caso["origen"],
            }
        )

    if problemas:
        for problema in problemas:
            print(f"ERROR {problema}")
        raise SystemExit(f"{len(problemas)} problema(s) en el Excel. No se ha escrito nada.")

    return {
        "_comentario": COMENTARIO,
        "tiposDeIa": leyenda["Tipo de IA"],
        "tiposDeValor": leyenda["Tipo de valor"],
        "casos": casos,
    }


def main():
    ruta_excel = Path(sys.argv[1]) if len(sys.argv) > 1 else EXCEL_POR_DEFECTO

    if not ruta_excel.exists():
        raise SystemExit(
            f"No se encuentra el Excel de origen: {ruta_excel}\n"
            "Es un arranque de una sola vez y el documento no esta versionado. "
            "Pide la copia al equipo o pasa la ruta como argumento."
        )

    payload = construir(ruta_excel)

    SALIDA.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"OK: {SALIDA} -> {len(payload['casos'])} casos")


if __name__ == "__main__":
    main()
