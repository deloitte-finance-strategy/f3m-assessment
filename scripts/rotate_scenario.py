"""Rota un escenario compartido a un identificador nuevo e impredecible.

Copia el contenido de un escenario a un id aleatorio de 128 bits y verifica que
la copia es idéntica. NO borra el original: ese paso se hace aparte, a mano,
cuando ya se ha confirmado que el enlace nuevo funciona.

    python scripts/rotate_scenario.py <id-antiguo>              # dry-run
    python scripts/rotate_scenario.py <id-antiguo> --confirm    # copia de verdad

El id de destino se genera con `secrets`, no con `random`, porque el enlace es
la única credencial del escenario.
"""

import argparse
import json
import re
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app.js"

ID_VALIDO = re.compile(r"^[a-zA-Z0-9_-]{20,120}$")


def leer_database_url():
    """Toma la URL de la base desde app.js para no duplicar configuración."""
    texto = APP_JS.read_text(encoding="utf-8")
    match = re.search(r'databaseURL:\s*"([^"]+)"', texto)

    if not match:
        raise SystemExit("No se encontró databaseURL en app.js")

    return match.group(1).rstrip("/")


def peticion(url, metodo="GET", cuerpo=None):
    datos = cuerpo.encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo)

    if datos is not None:
        req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")[:300]


def nuevo_id():
    return f"f3m-{secrets.token_hex(16)}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("id_antiguo", help="Identificador del escenario a rotar")
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Ejecuta la copia. Sin este flag solo muestra qué haría.",
    )
    args = parser.parse_args()

    base = leer_database_url()

    # 1. Leer el original
    estado, cuerpo = peticion(f"{base}/scenarios/{args.id_antiguo}.json")

    if estado != 200:
        raise SystemExit(f"No se pudo leer el escenario origen ({estado}): {cuerpo}")

    if cuerpo.strip() in ("null", ""):
        raise SystemExit(f"El escenario '{args.id_antiguo}' está vacío o no existe.")

    payload = json.loads(cuerpo)
    dominios = payload.get("domains") or {}
    puntuadas = sum(
        1
        for d in dominios.values()
        for i in (d.get("items") or [])
        if any(isinstance(v, (int, float)) for v in (i.get("scores") or {}).values())
    )

    print(f"Origen  : {args.id_antiguo}")
    print(f"          {len(cuerpo)} bytes | {len(dominios)} dominios | {puntuadas} subcapacidades puntuadas")
    print(f"          updatedAt: {payload.get('updatedAt')}")

    destino = nuevo_id()
    print(f"Destino : {destino}  ({len(destino)} caracteres)")

    if not ID_VALIDO.match(destino):
        raise SystemExit("El id generado no pasa la validación del cliente.")

    if not args.confirm:
        print("\nDry-run: no se ha escrito nada. Repite con --confirm para copiar.")
        return 0

    # 2. Comprobar que el destino está libre antes de escribir
    estado, cuerpo_destino = peticion(f"{base}/scenarios/{destino}.json")

    if estado == 200 and cuerpo_destino.strip() not in ("null", ""):
        raise SystemExit(f"El destino '{destino}' ya tiene datos. Abortado.")

    # 3. Copiar
    estado, respuesta = peticion(
        f"{base}/scenarios/{destino}.json",
        metodo="PUT",
        cuerpo=json.dumps(payload, ensure_ascii=False),
    )

    if estado != 200:
        raise SystemExit(f"Fallo al escribir la copia ({estado}): {respuesta}")

    # 4. Verificar que la copia es idéntica
    estado, cuerpo_verificacion = peticion(f"{base}/scenarios/{destino}.json")

    if estado != 200:
        raise SystemExit(f"No se pudo releer la copia ({estado})")

    if json.loads(cuerpo_verificacion) != payload:
        raise SystemExit(
            "La copia NO es idéntica al origen. No borres el original; "
            "revisa el escenario de destino a mano."
        )

    print("\nCopia verificada: idéntica al origen.")
    print(f"\nNuevo enlace (trátalo como una credencial, no lo publiques):")
    print(f"  ?scenario={destino}")
    print(
        "\nEl escenario original NO se ha borrado. Comprueba que el enlace nuevo "
        "funciona y bórralo después desde la consola de Firebase."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
