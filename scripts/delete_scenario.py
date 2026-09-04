"""Borra un escenario compartido de la Realtime Database.

`rotate_scenario.py` copia pero no borra. Esto cierra el ciclo: es lo que hay
que ejecutar cuando un escenario ya no debe existir, sea porque se ha rotado a
un enlace nuevo o porque el trabajo ha terminado.

    python scripts/delete_scenario.py <id>                       # dry-run
    python scripts/delete_scenario.py <id> --confirm             # copia y borra
    python scripts/delete_scenario.py <id> --confirm --sin-copia # borra sin copia

Por defecto guarda una copia en `copias/<id>-<fecha>.json` **antes** de borrar, y
la relee para comprobar que es idéntica: si no lo fuera, no borra nada. Es la
misma disciplina que ya aplica la aplicación, que ofrece "Exportar JSON antes"
junto a cada acción destructiva.

`copias/` está en el `.gitignore` a propósito: son datos reales de cliente y el
repositorio es público.

**Un escenario borrado puede resucitar.** `initializeSharedScenario()` recrea el
escenario si no existe, así que si alguien tiene la pestaña abierta con ese
enlace, su siguiente cambio o una simple recarga lo vuelve a subir entero. El
orden correcto es: rotar primero, confirmar que todo el mundo está en el enlace
nuevo y ha cerrado el viejo, y borrar después.
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from firebase_rest import (
    anadir_flags_de_auth,
    con_auth,
    leer_config,
    obtener_token,
    peticion,
    resumen,
)

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIO_DE_COPIAS = ROOT / "copias"

ID_VALIDO = re.compile(r"^[a-zA-Z0-9_-]{20,120}$")


def guardar_copia(id_escenario, payload):
    """Escribe la copia, la relee y comprueba que es idéntica.

    Se relee de verdad en lugar de dar por buena la escritura: una copia que no
    sirve es peor que no tenerla, porque da confianza para borrar.
    """
    DIRECTORIO_DE_COPIAS.mkdir(exist_ok=True)

    marca = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destino = DIRECTORIO_DE_COPIAS / f"{id_escenario}-{marca}.json"

    destino.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    releido = json.loads(destino.read_text(encoding="utf-8"))

    if releido != payload:
        raise SystemExit(
            f"La copia en '{destino}' NO coincide con el escenario. "
            "No se ha borrado nada."
        )

    return destino


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("escenario", help="Identificador del escenario a borrar")
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Borra de verdad. Sin este flag solo muestra qué haría.",
    )
    parser.add_argument(
        "--sin-copia",
        action="store_true",
        help="No guarda copia antes de borrar. Úsalo solo si ya tienes una.",
    )
    anadir_flags_de_auth(parser)
    args = parser.parse_args()

    if not ID_VALIDO.match(args.escenario):
        raise SystemExit(
            f"'{args.escenario}' no tiene forma de identificador de escenario. "
            "Comprueba que lo has copiado entero."
        )

    base, _ = leer_config()
    token = obtener_token(args)
    url = con_auth(f"{base}/scenarios/{args.escenario}.json", token)

    # 1. Leer lo que se va a destruir, y enseñarlo.
    estado, cuerpo = peticion(url)

    if estado != 200:
        raise SystemExit(f"No se pudo leer el escenario ({estado}): {cuerpo}")

    if cuerpo.strip() in ("null", ""):
        raise SystemExit(
            f"El escenario '{args.escenario}' está vacío o no existe. "
            "No hay nada que borrar."
        )

    payload = json.loads(cuerpo)

    print(f"Escenario : {args.escenario}")
    print(f"            {resumen(payload, cuerpo)}")
    print(f"            updatedAt: {payload.get('updatedAt')}")

    if not args.confirm:
        print("\nDry-run: no se ha borrado nada. Repite con --confirm.")
        return 0

    # 2. Copia de seguridad, salvo que se pida explícitamente no hacerla.
    if args.sin_copia:
        print("\nSin copia previa: --sin-copia.")
    else:
        destino = guardar_copia(args.escenario, payload)
        print(f"\nCopia verificada en {destino.relative_to(ROOT)}")

    # 3. Borrar.
    estado, respuesta = peticion(url, metodo="DELETE")

    if estado != 200:
        raise SystemExit(f"Fallo al borrar ({estado}): {respuesta}")

    # 4. Comprobar que ya no está.
    estado, verificacion = peticion(url)

    if estado != 200:
        raise SystemExit(f"No se pudo releer para verificar ({estado}).")

    if verificacion.strip() not in ("null", ""):
        raise SystemExit(
            "El escenario sigue ahí después del borrado. Revísalo en la consola."
        )

    print(f"\nBorrado: scenarios/{args.escenario} ya no existe.")
    print(
        "\nOJO: si alguien tiene la pestaña abierta con ese enlace, la aplicación "
        "recrea el escenario en cuanto recargue o toque algo. Comprueba que nadie "
        "lo está usando, o rota primero y borra cuando todos estén en el nuevo."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
