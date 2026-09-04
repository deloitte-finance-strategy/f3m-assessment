"""Rota un escenario compartido a un identificador nuevo e impredecible.

Copia el contenido de un escenario a un id aleatorio de 128 bits y verifica que
la copia es idéntica. NO borra el original: ese paso se hace aparte, a mano,
cuando ya se ha confirmado que el enlace nuevo funciona.

    python scripts/rotate_scenario.py <id-antiguo>              # dry-run
    python scripts/rotate_scenario.py <id-antiguo> --confirm    # copia de verdad

El id de destino se genera con `secrets`, no con `random`, porque el enlace es
la única credencial del escenario.

Con `auth != null` en las reglas hace falta un token: se pide uno anónimo, el
mismo que obtiene cualquier navegador. Ver scripts/firebase_rest.py.
"""

import argparse
import json
import re
import secrets
import sys

from firebase_rest import (
    anadir_flags_de_auth,
    con_auth,
    leer_config,
    obtener_token,
    peticion,
    resumen,
)

ID_VALIDO = re.compile(r"^[a-zA-Z0-9_-]{20,120}$")


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
    anadir_flags_de_auth(parser)
    args = parser.parse_args()

    base, _ = leer_config()
    token = obtener_token(args)

    # 1. Leer el original
    estado, cuerpo = peticion(
        con_auth(f"{base}/scenarios/{args.id_antiguo}.json", token)
    )

    if estado != 200:
        raise SystemExit(f"No se pudo leer el escenario origen ({estado}): {cuerpo}")

    if cuerpo.strip() in ("null", ""):
        raise SystemExit(f"El escenario '{args.id_antiguo}' está vacío o no existe.")

    payload = json.loads(cuerpo)

    print(f"Origen  : {args.id_antiguo}")
    print(f"          {resumen(payload, cuerpo)}")
    print(f"          updatedAt: {payload.get('updatedAt')}")

    destino = nuevo_id()
    print(f"Destino : {destino}  ({len(destino)} caracteres)")

    if not ID_VALIDO.match(destino):
        raise SystemExit("El id generado no pasa la validación del cliente.")

    if not args.confirm:
        print("\nDry-run: no se ha escrito nada. Repite con --confirm para copiar.")
        return 0

    # 2. Comprobar que el destino está libre antes de escribir
    estado, cuerpo_destino = peticion(
        con_auth(f"{base}/scenarios/{destino}.json", token)
    )

    if estado == 200 and cuerpo_destino.strip() not in ("null", ""):
        raise SystemExit(f"El destino '{destino}' ya tiene datos. Abortado.")

    # 3. Copiar
    estado, respuesta = peticion(
        con_auth(f"{base}/scenarios/{destino}.json", token),
        metodo="PUT",
        cuerpo=json.dumps(payload, ensure_ascii=False),
    )

    if estado != 200:
        raise SystemExit(f"Fallo al escribir la copia ({estado}): {respuesta}")

    # 4. Verificar que la copia es idéntica
    estado, cuerpo_verificacion = peticion(
        con_auth(f"{base}/scenarios/{destino}.json", token)
    )

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
