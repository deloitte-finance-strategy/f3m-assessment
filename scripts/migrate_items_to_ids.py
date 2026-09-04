"""Migra los `items` de un escenario de lista a objeto indexado por id.

Las escrituras granulares apuntan a rutas como
`domains/fpa/items/fpa-1-2/scores/procesos`. En los escenarios antiguos los
items son una lista, así que sus claves son posiciones (0, 1, 2...) y una
escritura granular añadiría una clave nueva en lugar de modificar la existente,
dejando el escenario con datos duplicados.

    python scripts/migrate_items_to_ids.py <id-escenario>              # dry-run
    python scripts/migrate_items_to_ids.py <id-escenario> --confirm    # migra

La app lee ambos formatos (toSavedItemsArray acepta lista y objeto), así que la
migración es segura: un escenario ya migrado se detecta y se deja intacto.

Con `auth != null` en las reglas hace falta un token: se pide uno anónimo, el
mismo que obtiene cualquier navegador. Ver scripts/firebase_rest.py.
"""

import argparse
import json
import sys

from firebase_rest import (
    anadir_flags_de_auth,
    con_auth,
    leer_config,
    obtener_token,
    peticion,
)


def migrar_items(items, domain_id):
    """Devuelve (items_migrados, estado). Estado: 'migrado', 'ya-migrado' o un error."""
    if isinstance(items, dict):
        # Firebase devuelve dict con claves numéricas si la lista tenía huecos.
        if all(k.isdigit() for k in items):
            items = [items[k] for k in sorted(items, key=int)]
        else:
            return items, "ya-migrado"

    if not isinstance(items, list):
        return items, f"formato inesperado ({type(items).__name__})"

    migrados = {}

    for posicion, item in enumerate(items):
        if not isinstance(item, dict):
            return items, f"elemento {posicion} no es un objeto"

        item_id = item.get("id")

        if not item_id:
            return items, f"elemento {posicion} de {domain_id} no tiene id"

        if item_id in migrados:
            return items, f"id duplicado en {domain_id}: {item_id}"

        migrados[item_id] = item

    return migrados, "migrado"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("escenario", help="Identificador del escenario a migrar")
    parser.add_argument("--confirm", action="store_true", help="Escribe los cambios")
    anadir_flags_de_auth(parser)
    args = parser.parse_args()

    base, _ = leer_config()
    token = obtener_token(args)
    url = con_auth(f"{base}/scenarios/{args.escenario}.json", token)

    estado, cuerpo = peticion(url)

    if estado != 200:
        raise SystemExit(f"No se pudo leer el escenario ({estado}): {cuerpo}")

    if cuerpo.strip() in ("null", ""):
        raise SystemExit(f"El escenario '{args.escenario}' está vacío o no existe.")

    payload = json.loads(cuerpo)
    dominios = payload.get("domains") or {}

    if not dominios:
        raise SystemExit("El escenario no tiene dominios.")

    total_migrados = 0

    for domain_id, dominio in dominios.items():
        items = dominio.get("items")

        if items is None:
            print(f"  {domain_id:<24} sin items")
            continue

        antes = len(items)
        nuevos, resultado = migrar_items(items, domain_id)

        if resultado not in ("migrado", "ya-migrado"):
            raise SystemExit(f"Abortado. {domain_id}: {resultado}")

        if resultado == "migrado":
            total_migrados += 1
            dominio["items"] = nuevos

        print(f"  {domain_id:<24} {antes} items -> {resultado} ({len(nuevos)} claves)")

    if total_migrados == 0:
        print("\nNada que migrar: todos los dominios ya usan ids como clave.")
        return 0

    if not args.confirm:
        print(f"\nDry-run: {total_migrados} dominio(s) se migrarían. Repite con --confirm.")
        return 0

    estado, respuesta = peticion(url, metodo="PUT", cuerpo=json.dumps(payload, ensure_ascii=False))

    if estado != 200:
        raise SystemExit(f"Fallo al escribir ({estado}): {respuesta}")

    # Verificamos releyendo: ningún dominio debe quedar con items en lista.
    estado, verificacion = peticion(url)

    if estado != 200:
        raise SystemExit("No se pudo releer el escenario para verificar.")

    releido = json.loads(verificacion)

    for domain_id, dominio in (releido.get("domains") or {}).items():
        items = dominio.get("items")

        if isinstance(items, list) or (
            isinstance(items, dict) and all(k.isdigit() for k in items)
        ):
            raise SystemExit(f"Verificación fallida: {domain_id} sigue indexado por posición.")

    print(f"\nMigrados {total_migrados} dominio(s). Verificado releyendo el escenario.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
