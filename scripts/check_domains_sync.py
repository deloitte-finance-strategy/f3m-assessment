"""Verifica que los JSON de data/domains coinciden con los Excel F3M_*.xlsx.

No escribe nada: regenera cada payload en memoria y lo compara con el archivo
commiteado. Devuelve código de salida 1 si algún dominio está desincronizado,
para poder usarse en CI o antes de un commit.

    python scripts/check_domains_sync.py
"""

import sys

from convert_domains import FILES, build_payload, serialize


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
    fallos = 0

    for config in FILES:
        estado, detalle = check_domain(config)

        if estado != "OK":
            fallos += 1

        print(f"{estado:<5} {config['domain_id']:<24} {detalle}")

    print()

    if fallos:
        print(
            f"{fallos} dominio(s) desincronizado(s). "
            "Ejecuta 'python scripts/convert_domains.py' para regenerarlos."
        )
        return 1

    print(f"Los {len(FILES)} dominios coinciden con sus Excel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
