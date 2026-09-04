"""Comprueba si unas reglas nuevas rechazarían escenarios que ya están escritos.

Responde a una sola pregunta, y hay que hacérsela **antes** de publicar cualquier
cambio en `database.rules.json`: ¿hay datos ya guardados que estas reglas no
admitirían?

    python scripts/audit_scenarios.py <export-de-la-consola.json>

La entrada es el JSON que se descarga en Firebase Console → Realtime Database →
⋮ → Exportar JSON, sobre `/` o sobre `/scenarios`. Se usa un export y no la API
REST a propósito: las reglas no permiten leer `/scenarios` entero —`.read` está
solo en `$scenarioId`— y meter una credencial de administrador en un repositorio
público para esquivarlo sería peor que el problema que resuelve.

El script **no lleva la lista de campos escrita a mano**. Lee
`database.rules.json` de la rama en la que estás, así que sirve tal cual para
validar reglas candidatas: cambias las reglas, lo ejecutas, y te dice qué se
rompería. Sale con código 1 si encuentra algo.

Matiz que conviene tener presente al leer la salida: en la Realtime Database los
`.validate` solo se evalúan sobre el nodo que se escribe y sus descendientes,
nunca sobre sus ancestros. Un dato antiguo que no encaje **no se borra ni deja de
leerse**; solo bloquea una escritura completa del escenario, que en la práctica
es importar o crear. El trabajo normal, que escribe por rutas concretas, sigue
funcionando. Por eso lo que aparezca aquí es una lista de cosas que revisar, no
necesariamente un incendio.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGLAS_JSON = ROOT / "database.rules.json"
CATALOGO_JSON = ROOT / "data" / "domains.json"


# --------------------------------------------------------------- las reglas

def cargar_reglas():
    reglas = json.loads(REGLAS_JSON.read_text(encoding="utf-8"))
    escenario = reglas.get("rules", {}).get("scenarios", {}).get("$scenarioId")

    if not escenario:
        raise SystemExit(
            "No se encontró rules/scenarios/$scenarioId en database.rules.json. "
            "Si se ha renombrado un comodín, hay que actualizar este script."
        )

    return escenario


def campos_declarados(nodo):
    """Los campos con nombre propio de un nivel: ni '.validate' ni comodines."""
    return {c for c in (nodo or {}) if not c.startswith(".") and not c.startswith("$")}


def limite_de(nodo):
    """El número de un '.validate' del tipo '... length <= N', o None."""
    encontrado = re.search(r"length\s*<=\s*(\d+)", (nodo or {}).get(".validate", ""))
    return int(encontrado.group(1)) if encontrado else None


def alternativas_de(nodo):
    """Los valores de un '.validate' con matches(/^(a|b|c)$/), o None."""
    encontrado = re.search(
        r"matches\(/\^\((.+?)\)\$/", (nodo or {}).get(".validate", "")
    )
    return set(encontrado.group(1).split("|")) if encontrado else None


def rango_de(nodo):
    """El (mínimo, máximo) de un '.validate' numérico, o (None, None)."""
    validate = (nodo or {}).get(".validate", "")
    minimo = re.search(r">=\s*(\d+)", validate)
    maximo = re.search(r"<=\s*(\d+)", validate)
    return (
        int(minimo.group(1)) if minimo else None,
        int(maximo.group(1)) if maximo else None,
    )


def ids_del_catalogo():
    catalogo = json.loads(CATALOGO_JSON.read_text(encoding="utf-8"))
    return {d["id"] for d in catalogo.get("domains", [])}


# ----------------------------------------------------------- la comprobación

def como_lista(valor):
    """items y targets viven a veces como lista y a veces indexados por id."""
    if isinstance(valor, dict):
        return list(valor.items())
    if isinstance(valor, list):
        return list(enumerate(valor))
    return []


def revisar_escenario(id_escenario, escenario, reglas, ids_validos):
    problemas = []
    uids = set()

    def anotar(ruta, texto):
        problemas.append(f"{ruta}: {texto}")

    if not isinstance(escenario, dict):
        return [f"{id_escenario}: no es un objeto"], uids

    # Raíz
    sobrantes = set(escenario) - campos_declarados(reglas)
    for campo in sorted(sobrantes):
        anotar(id_escenario, f"campo de raíz no declarado '{campo}'")

    reglas_dominio = reglas.get("domains", {}).get("$domainId", {})
    dominios_admitidos = alternativas_de(reglas_dominio)

    for id_dominio, dominio in (escenario.get("domains") or {}).items():
        ruta_dominio = f"{id_escenario}/{id_dominio}"

        if dominios_admitidos is not None and id_dominio not in dominios_admitidos:
            anotar(ruta_dominio, "las reglas no admiten este id de dominio")
        elif id_dominio not in ids_validos:
            anotar(ruta_dominio, "no está en data/domains.json")

        if not isinstance(dominio, dict):
            anotar(ruta_dominio, "no es un objeto")
            continue

        for campo in sorted(set(dominio) - campos_declarados(reglas_dominio)):
            anotar(ruta_dominio, f"campo de dominio no declarado '{campo}'")

        _revisar_meta(dominio, reglas_dominio, ruta_dominio, anotar)
        _revisar_targets(dominio, reglas_dominio, ruta_dominio, anotar)
        _revisar_items(dominio, reglas_dominio, ruta_dominio, anotar, uids)

    return problemas, uids


def _revisar_meta(dominio, reglas_dominio, ruta, anotar):
    limite = limite_de(reglas_dominio.get("meta", {}).get("$campoMeta"))

    for campo, valor in (dominio.get("meta") or {}).items():
        if isinstance(valor, str) and limite and len(valor) > limite:
            anotar(f"{ruta}/meta/{campo}", f"{len(valor)} caracteres, máximo {limite}")
        elif not isinstance(valor, (str, int, float)):
            anotar(f"{ruta}/meta/{campo}", "ni texto ni número")


def _revisar_targets(dominio, reglas_dominio, ruta, anotar):
    reglas_target = reglas_dominio.get("targets", {}).get("$indiceTarget", {})
    declarados = campos_declarados(reglas_target)

    for clave, target in como_lista(dominio.get("targets")):
        if not isinstance(target, dict):
            continue

        for campo in sorted(set(target) - declarados):
            anotar(f"{ruta}/targets/{clave}", f"campo no declarado '{campo}'")

        for palanca in ("procesos", "tecnologia", "organizacion"):
            _revisar_numero(
                target.get(palanca),
                reglas_target.get(palanca),
                f"{ruta}/targets/{clave}/{palanca}",
                anotar,
            )


def _revisar_items(dominio, reglas_dominio, ruta, anotar, uids):
    reglas_item = reglas_dominio.get("items", {}).get("$indice", {})
    declarados = campos_declarados(reglas_item)
    reglas_autoria = reglas_item.get("lastEditedBy", {})
    reglas_scores = reglas_item.get("scores", {})

    for clave, item in como_lista(dominio.get("items")):
        ruta_item = f"{ruta}/items/{clave}"

        if not isinstance(item, dict):
            anotar(ruta_item, "no es un objeto")
            continue

        for campo in sorted(set(item) - declarados):
            anotar(ruta_item, f"campo no declarado '{campo}'")

        # Textos: longitud y, si las reglas la traen, lista cerrada de valores.
        for campo in ("id", "capacidad", "subcapacidad", "owner", "status", "comentario"):
            valor = item.get(campo)

            if valor is None:
                continue

            if not isinstance(valor, str):
                anotar(f"{ruta_item}/{campo}", "no es texto")
                continue

            limite = limite_de(reglas_item.get(campo))
            if limite and len(valor) > limite:
                anotar(f"{ruta_item}/{campo}", f"{len(valor)} caracteres, máximo {limite}")

            admitidos = alternativas_de(reglas_item.get(campo))
            if admitidos is not None and valor not in admitidos:
                anotar(f"{ruta_item}/{campo}", f"valor '{valor}' fuera de la lista admitida")

        for palanca in ("procesos", "tecnologia", "organizacion"):
            _revisar_numero(
                (item.get("scores") or {}).get(palanca),
                reglas_scores.get(palanca),
                f"{ruta_item}/scores/{palanca}",
                anotar,
            )

        for campo in sorted(set(item.get("scores") or {}) - campos_declarados(reglas_scores)):
            anotar(f"{ruta_item}/scores", f"palanca no declarada '{campo}'")

        autoria = item.get("lastEditedBy")

        if isinstance(autoria, dict):
            for campo in sorted(set(autoria) - campos_declarados(reglas_autoria)):
                anotar(f"{ruta_item}/lastEditedBy", f"campo no declarado '{campo}'")

            for campo, valor in autoria.items():
                limite = limite_de(reglas_autoria.get(campo))
                if isinstance(valor, str) and limite and len(valor) > limite:
                    anotar(
                        f"{ruta_item}/lastEditedBy/{campo}",
                        f"{len(valor)} caracteres, máximo {limite}",
                    )

            if isinstance(autoria.get("uid"), str):
                uids.add(autoria["uid"])
        elif autoria is not None:
            anotar(f"{ruta_item}/lastEditedBy", "no es un objeto")


def _revisar_numero(valor, regla, ruta, anotar):
    if valor is None:
        return

    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        anotar(ruta, f"no es un número ({valor!r})")
        return

    minimo, maximo = rango_de(regla)

    if minimo is not None and valor < minimo:
        anotar(ruta, f"{valor} por debajo del mínimo {minimo}")
    if maximo is not None and valor > maximo:
        anotar(ruta, f"{valor} por encima del máximo {maximo}")


# ------------------------------------------------------------------- entrada

def escenarios_del_export(datos):
    """Acepta un export de / y uno de /scenarios."""
    if isinstance(datos, dict) and isinstance(datos.get("scenarios"), dict):
        return datos["scenarios"]
    return datos if isinstance(datos, dict) else {}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", help="JSON exportado desde la consola de Firebase")
    args = parser.parse_args()

    ruta = Path(args.export)

    if not ruta.is_file():
        raise SystemExit(f"No existe el archivo '{ruta}'.")

    escenarios = escenarios_del_export(json.loads(ruta.read_text(encoding="utf-8")))

    if not escenarios:
        raise SystemExit(
            "El export no contiene escenarios. Exporta desde / o desde /scenarios."
        )

    reglas = cargar_reglas()
    ids_validos = ids_del_catalogo()

    print(f"Reglas  : {REGLAS_JSON.relative_to(ROOT)} (las de esta rama)")
    print(f"Export  : {ruta}  |  {len(escenarios)} escenario(s)\n")

    total = 0

    for id_escenario, escenario in sorted(escenarios.items()):
        problemas, uids = revisar_escenario(
            id_escenario, escenario, reglas, ids_validos
        )
        total += len(problemas)

        marca = "FALLA" if problemas else "OK   "
        # El numero de uid distintos decide si la regla uid === auth.uid es
        # viable: con muchos, restringirla rompe las escrituras completas.
        print(f"{marca} {id_escenario}  ({len(uids)} uid distintos)")

        for problema in problemas:
            print(f"        {problema}")

    print()

    if total:
        print(f"{total} cosa(s) que estas reglas rechazarían. Revísalas antes de publicar.")
        print(
            "Recuerda: los .validate no se evalúan sobre ancestros, así que esto "
            "bloquearía importar o crear ese escenario, no el trabajo del día a día."
        )
        return 1

    print("Ningún escenario del export choca con estas reglas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
