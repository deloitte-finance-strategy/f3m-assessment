"""Lo que comparten los scripts que hablan con la Realtime Database por REST.

Estaba duplicado en `rotate_scenario.py` y `migrate_items_to_ids.py`, y con las
reglas exigiendo `auth != null` los dos necesitaban además un token. Se saca
aquí, siguiendo el precedente de `check_domains_sync.py`, que ya importa de
`convert_domains`.

**Sobre el token.** Se pide uno anónimo, el mismo que obtiene cualquier navegador
que abra la aplicación: el script acaba con exactamente los mismos privilegios
que cualquier persona con el enlace, ni uno más. Deliberadamente no se usa una
credencial de administrador — no hay ningún secreto nuevo que guardar, y no se
abre una puerta trasera en un repositorio público. La `apiKey` con la que se pide
ya está en `app.js` y es pública por diseño en una web app de Firebase.

El precio es que cada ejecución crea un usuario anónimo en Firebase Auth. Se
purgan de vez en cuando desde la consola, o se reutiliza uno con `--token`.
"""

import json
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app.js"

IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1/accounts:signUp"


def leer_config():
    """La URL de la base y la clave de API, desde app.js.

    Se leen de ahí y no de una copia para no duplicar configuración: es la misma
    razón por la que el catálogo de dominios vive en un solo archivo.
    """
    texto = APP_JS.read_text(encoding="utf-8")

    base = re.search(r'databaseURL:\s*"([^"]+)"', texto)
    clave = re.search(r'apiKey:\s*"([^"]+)"', texto)

    if not base:
        raise SystemExit("No se encontró databaseURL en app.js")

    if not clave:
        raise SystemExit("No se encontró apiKey en app.js")

    return base.group(1).rstrip("/"), clave.group(1)


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


def token_anonimo(api_key):
    """Un idToken de sesión anónima, el mismo que usa la aplicación."""
    estado, cuerpo = peticion(
        f"{IDENTITY_TOOLKIT}?key={api_key}",
        metodo="POST",
        cuerpo=json.dumps({"returnSecureToken": True}),
    )

    if estado != 200:
        raise SystemExit(
            f"No se pudo obtener un token anónimo ({estado}): {cuerpo}\n"
            "Comprueba que 'Anonymous' está habilitado en Firebase → "
            "Authentication → Sign-in method."
        )

    token = json.loads(cuerpo).get("idToken")

    if not token:
        raise SystemExit("La respuesta de autenticación no traía idToken.")

    return token


def con_auth(url, token):
    if not token:
        return url

    separador = "&" if "?" in url else "?"

    return f"{url}{separador}auth={token}"


def obtener_token(args):
    """El token según los flags comunes: --token, --sin-auth, o uno nuevo.

    `--sin-auth` existe para el mundo anterior a exigir `auth != null` en las
    reglas, y para diagnosticar: si un script funciona con él y falla sin él, el
    problema es la autenticación y no la base.
    """
    if getattr(args, "sin_auth", False):
        return None

    if getattr(args, "token", None):
        return args.token

    _, api_key = leer_config()

    return token_anonimo(api_key)


def anadir_flags_de_auth(parser):
    parser.add_argument(
        "--token",
        help="Reutiliza un idToken en vez de crear otro usuario anónimo.",
    )
    parser.add_argument(
        "--sin-auth",
        action="store_true",
        help="No autentica. Solo sirve si las reglas aún no exigen auth != null.",
    )


def resumen(payload, cuerpo):
    """Las cifras de un escenario, para poder mirarlas antes de tocarlo."""
    dominios = payload.get("domains") or {}

    def puntuada(item):
        return any(
            isinstance(v, (int, float))
            for v in (item.get("scores") or {}).values()
        )

    def items_de(dominio):
        items = dominio.get("items")

        if isinstance(items, dict):
            return items.values()

        return items or []

    puntuadas = sum(
        1 for d in dominios.values() for i in items_de(d) if puntuada(i)
    )

    return (
        f"{len(cuerpo)} bytes | {len(dominios)} dominios | "
        f"{puntuadas} subcapacidades puntuadas"
    )
