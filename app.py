# ── Esto de abajo trabaja con las importaciones para que nuestro archivo funcione correctamente ──────────────────────────────────────────────────────────────────────
import os
import threading
import time
import logging
import unicodedata
from datetime import datetime, timedelta, timezone
import requests
import psycopg
from psycopg import Connection
from flask import Flask, jsonify, send_from_directory
from flask import request

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

app = Flask(__name__, static_folder='.', static_url_path='')

DATABASE_URL = os.environ.get("DATABASE_URL")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_CLAIMS = {"sub": "mailto:haztuquinielaconelwero@gmail.com"}

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no esta configurada en las variables de entorno de Railway")

def get_connection() -> Connection:
    return psycopg.connect(DATABASE_URL)

# ── Esto de abajo trabaja con la creacion de todas las tablas  ──────────────────────────────────────────────────────────────────────
def crear_tablas():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS todaslasquinielas (
                    id SERIAL PRIMARY KEY,
                    nombrecelular TEXT NOT NULL,
                    nombrequiniela TEXT NOT NULL,
                    vendedor TEXT NOT NULL,
                    jornada TEXT NOT NULL,
                    p1 CHAR(1) CHECK (p1 IN ('L','E','V')),
                    p2 CHAR(1) CHECK (p2 IN ('L','E','V')),
                    p3 CHAR(1) CHECK (p3 IN ('L','E','V')),
                    p4 CHAR(1) CHECK (p4 IN ('L','E','V')),
                    p5 CHAR(1) CHECK (p5 IN ('L','E','V')),
                    p6 CHAR(1) CHECK (p6 IN ('L','E','V')),
                    p7 CHAR(1) CHECK (p7 IN ('L','E','V')),
                    p8 CHAR(1) CHECK (p8 IN ('L','E','V')),
                    p9 CHAR(1) CHECK (p9 IN ('L','E','V')),
                    estado TEXT NOT NULL DEFAULT 'No jugando'
                        CHECK (estado IN ('No jugando','Jugando','En espera','Rechazada','Archivada')),
                    folio TEXT,
                    fechacreacion TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City'),
                    llavemaestra TEXT NOT NULL UNIQUE,
                    dispositivoid TEXT NOT NULL,
                    CONSTRAINT folio_solo_si_jugando CHECK (
                        (estado = 'Jugando' AND folio IS NOT NULL) OR
                        (estado != 'Jugando')
                    )
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_llavemaestra
                ON todaslasquinielas (llavemaestra);
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_dispositivoid
                ON todaslasquinielas (dispositivoid);
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_estado
                ON todaslasquinielas (estado);
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_vendedor_estado
                ON todaslasquinielas (vendedor, estado);
            """)

            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_folio_unico_jugando
                ON todaslasquinielas (folio)
                WHERE estado = 'Jugando';
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS resultadosdelajornada (
                    id SERIAL PRIMARY KEY,
                    jornada TEXT NOT NULL,
                    partido_id INTEGER NOT NULL,
                    resultado CHAR(1) CHECK (resultado IN ('L','E','V')),
                    marcador_local INTEGER,
                    marcador_visita INTEGER,
                    UNIQUE (jornada, partido_id)
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS clientes (
                    id SERIAL PRIMARY KEY,
                    dispositivoid VARCHAR(100) UNIQUE NOT NULL,
                    nombrecelular VARCHAR(100) NOT NULL,
                    fecharegistro TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS suscripcionespush (
                    id SERIAL PRIMARY KEY,
                    dispositivoid VARCHAR(100) NOT NULL REFERENCES clientes(dispositivoid) ON DELETE CASCADE,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    navegador VARCHAR(255),
                    sistemaoperativo VARCHAR(50),
                    activo BOOLEAN NOT NULL DEFAULT TRUE,
                    fechasuscripcion TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City'),
                    ultimaactividad TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City'),
                    fallosconsecutivos INTEGER NOT NULL DEFAULT 0
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idxsuscripcionesdispositivoid
                ON suscripcionespush (dispositivoid);
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idxsuscripcionesactivo
                ON suscripcionespush (activo);
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS invitaatuscompas (
                    id SERIAL PRIMARY KEY,
                    codigo TEXT NOT NULL UNIQUE,
                    dueno TEXT NOT NULL,
                    telefono TEXT NOT NULL,
                    vendedor TEXT NOT NULL,
                    activo BOOLEAN NOT NULL DEFAULT TRUE,
                    fechacreacion TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idxinvitaatuscompasvendedor
                ON invitaatuscompas (vendedor);
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS historialdenotificaciones (
                    id BIGSERIAL PRIMARY KEY,
                    dispositivoid VARCHAR(100) NOT NULL REFERENCES clientes(dispositivoid) ON DELETE CASCADE,
                    tipo TEXT NOT NULL,
                    jornada TEXT,
                    partidoid INTEGER,
                    enviadaen TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City'),
                    abierta BOOLEAN NOT NULL DEFAULT FALSE,
                    clic BOOLEAN NOT NULL DEFAULT FALSE
                );
            """)

            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idxhistorialnoduplicado
                ON historialdenotificaciones (dispositivoid, tipo, jornada, COALESCE(partidoid, -1));
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS preguntaspush (
                    dispositivoid VARCHAR(100) PRIMARY KEY REFERENCES clientes(dispositivoid) ON DELETE CASCADE,
                    ultimajornadapreguntada TEXT,
                    respuesta VARCHAR(10) CHECK (respuesta IN ('si', 'no')),
                    fechapregunta TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')
                );
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idxpreguntaspushrespuesta
                ON preguntaspush (respuesta);
            """)

        conn.commit()
# ──                         Esta API revisa si a este dispositivo ya se le pregunto sobre notificaciones esta jornada                             ──
@app.route("/api/debepreguntarpush")
def debe_preguntar_push():
    dispositivoid = (request.args.get("dispositivoid") or "").strip()
    if not dispositivoid:
        return jsonify(debePreguntar=False)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT ultimajornadapreguntada, respuesta
                    FROM preguntaspush
                    WHERE dispositivoid = %s
                """, (dispositivoid,))
                fila = cur.fetchone()
    except Exception as exc:
        logger.error("debe_preguntar_push error: %s", exc)
        return jsonify(debePreguntar=False)

    if fila is None:
        return jsonify(debePreguntar=True)

    ultima_jornada, respuesta = fila

    if respuesta == "si":
        return jsonify(debePreguntar=False)

    if ultima_jornada != JORNADA_ACTUAL:
        return jsonify(debePreguntar=True)

    return jsonify(debePreguntar=False)

# ──                         Esta API guarda si el usuario dijo si o no a la pregunta de notificaciones                                                ──
@app.route("/api/guardarrespuestapush", methods=["POST"])
def guardar_respuesta_push():
    data = request.get_json(silent=True) or {}
    dispositivoid = (data.get("dispositivoid") or "").strip()
    respuesta = (data.get("respuesta") or "").strip().lower()

    if not dispositivoid or respuesta not in ("si", "no"):
        return jsonify(success=False, mensaje="Faltan datos o respuesta invalida"), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO preguntaspush (dispositivoid, ultimajornadapreguntada, respuesta)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (dispositivoid) DO UPDATE SET
                        ultimajornadapreguntada = EXCLUDED.ultimajornadapreguntada,
                        respuesta = EXCLUDED.respuesta,
                        fechapregunta = (now() AT TIME ZONE 'America/Mexico_City')
                """, (dispositivoid, JORNADA_ACTUAL, respuesta))
            conn.commit()
        return jsonify(success=True, mensaje="Respuesta guardada correctamente")
    except Exception as exc:
        logger.error("guardar_respuesta_push error: %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500

# ──                                 Esta API guarda el papelito secreto (suscripcion push) que da el navegador                                                ──
@app.route("/api/guardarsuscripcion", methods=["POST"])
def guardar_suscripcion():
    data = request.get_json(silent=True) or {}
    dispositivoid = (data.get("dispositivoid") or "").strip()
    endpoint = (data.get("endpoint") or "").strip()
    p256dh = (data.get("p256dh") or "").strip()
    auth = (data.get("auth") or "").strip()
    navegador = (data.get("navegador") or "").strip()

    if not dispositivoid or not endpoint or not p256dh or not auth:
        return jsonify(success=False, mensaje="Faltan datos"), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO suscripcionespush
                        (dispositivoid, endpoint, p256dh, auth, navegador, activo)
                    VALUES (%s, %s, %s, %s, %s, TRUE)
                    ON CONFLICT (endpoint) DO UPDATE SET
                        activo = TRUE,
                        ultimaactividad = (now() AT TIME ZONE 'America/Mexico_City'),
                        fallosconsecutivos = 0
                """, (dispositivoid, endpoint, p256dh, auth, navegador))
            conn.commit()
        return jsonify(success=True, mensaje="Suscripcion guardada correctamente")
    except Exception as exc:
        logger.error("guardar_suscripcion error: %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500
    
# ── Esto de abajo trabaja con el archivado de todas las quinielas───────────────────────────────────────────────────────────────────────────────────────────────
@app.route("/api/archivarjugando", methods=["POST"])
def archivarjugando():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE todaslasquinielas
                    SET estado = 'Archivada', folio = NULL
                    WHERE estado = 'Jugando'
                """)
                afectadas = cur.rowcount
            conn.commit()
        return jsonify({"success": True, "mensaje": f"{afectadas} quinielas archivadas correctamente"})
    except Exception as exc:
        logger.error("archivarjugando: error -> %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con  el modo bloqueado y modo en espera───────────────────────────────────────────────────────────────────────────────────────────────
@app.route("/api/estadoadmin")
def estadoadmin():
    return jsonify({
        "success": True,
        "listaBloqueada": LISTA_BLOQUEADA,
        "modoEspera": MODO_ESPERA["activo"]
    })

# ── Esto de abajo trabaja con el boton de modo en espera ───────────────────────────────────────────────────────────────────────────────────────────────
MODO_ESPERA = {"activo": False}

@app.route("/api/togglemodoespera", methods=["POST"])
def togglemodoespera():
    data = request.get_json(silent=True) or {}
    MODO_ESPERA["activo"] = bool(data.get("activar"))
    return jsonify({"success": True, "modoEspera": MODO_ESPERA["activo"]})

# ── Esto de abajo trabaja con el boton de modo Bloqueado ───────────────────────────────────────────────────────────────────────────────────────────────
LISTA_BLOQUEADA = False

@app.route("/api/togglebloqueo", methods=["POST"])
def togglebloqueo():
    global LISTA_BLOQUEADA
    data = request.get_json(silent=True) or {}
    LISTA_BLOQUEADA = bool(data.get("activar"))
    return jsonify(success=True, listaBloqueada=LISTA_BLOQUEADA)
    
# ── Esto de abajo trabaja con la informacion de la Jornada ───────────────────────────────────────────────────────────────────────────────────────────────
# ── ALTER SEQUENCE resultadosdelajornada_id_seq RESTART WITH 1;
# ── ALTER SEQUENCE todaslasquinielas_id_seq RESTART WITH 1;

WHATSAPP_GRUPO_URL = "https://chat.whatsapp.com/C2z6Wir4MC9CY7ayg5ATOP"
JORNADA_ACTUAL = "Jornada 3"
JORNADA_CIERRE = "2026-07-31T16:30:00-06:00"

PARTIDOS = [
    {
        "id": 1,
        "local": "Puebla", "localLogo": "/logos/puebla.png",
        "visitante": "Chivas", "visitanteLogo": "/logos/chivas.png",
        "horario": "Viernes 31 de julio 7:00 pm",
        "televisora": "TV Azteca / FOX / ESPN",
        "televisionLogo": "/logos/tv-azteca.png",
        "kickoff": "2026-07-31T19:00:00-06:00",
    },
    {
        "id": 2,
        "local": "San Luis", "localLogo": "/logos/san-luis.png",
        "visitante": "Tijuana", "visitanteLogo": "/logos/tijuana.png",
        "horario": "Viernes 31 de julio 9:00 pm",
        "televisora": "ESPN / ViX Premium / Disney+",
        "televisionLogo": "/logos/espn.png",
        "kickoff": "2026-07-31T21:00:00-06:00",
    },
    {
        "id": 3,
        "local": "Juarez", "localLogo": "/logos/juarez.png",
        "visitante": "Pumas", "visitanteLogo": "/logos/pumas.png",
        "horario": "Viernes 31 de julio 9:00 pm",
        "televisora": "TV Azteca / FOX",
        "televisionLogo": "/logos/tv-azteca.png",
        "kickoff": "2026-07-31T21:00:00-06:00",
    },
    {
        "id": 4,
        "local": "Queretaro", "localLogo": "/logos/queretaro.png",
        "visitante": "Tigres", "visitanteLogo": "/logos/tigres.png",
        "horario": "Sábado 1 de agosto 5:00 pm",
        "televisora": "FOX / FOX One",
        "televisionLogo": "/logos/fox-sports.png",
        "kickoff": "2026-08-01T17:00:00-06:00",
    },
    {
        "id": 5,
        "local": "Leon", "localLogo": "/logos/leon.png",
        "visitante": "Pachuca", "visitanteLogo": "/logos/pachuca.png",
        "horario": "Sábado 1 de agosto 7:00 pm",
        "televisora": "FOX / FOX One",
        "televisionLogo": "/logos/fox-sports.png",
        "kickoff": "2026-08-01T19:00:00-06:00",
    },
    {
        "id": 6,
        "local": "Atlas", "localLogo": "/logos/atlas.png",
        "visitante": "Monterrey", "visitanteLogo": "/logos/monterrey.png",
        "horario": "Sábado 1 de agosto 7:00 pm",
        "televisora": "Canal 5 / TUDN / ViX",
        "televisionLogo": "/logos/canal-5.png",
        "kickoff": "2026-08-01T19:00:00-06:00",
    },
    {
        "id": 7,
        "local": "Cruz Azul", "localLogo": "/logos/cruz-azul.png",
        "visitante": "Atlante", "visitanteLogo": "/logos/atlante.png",
        "horario": "Sábado 1 de agosto 9:00 pm",
        "televisora": "Canal 5 / TUDN / ViX",
        "televisionLogo": "/logos/canal-5.png",
        "kickoff": "2026-08-01T21:00:00-06:00",
    },
    {
        "id": 8,
        "local": "America", "localLogo": "/logos/america.png",
        "visitante": "Santos", "visitanteLogo": "/logos/santos.png",
        "horario": "Domingo 2 de agosto 5:00 pm",
        "televisora": "Canal 5 / TUDN / ViX",
        "televisionLogo": "/logos/canal-5.png",
        "kickoff": "2026-08-02T17:00:00-06:00",
    },
    {
        "id": 9,
        "local": "Toluca", "localLogo": "/logos/toluca.png",
        "visitante": "Necaxa", "visitanteLogo": "/logos/necaxa.png",
        "horario": "Domingo 2 de agosto 7:00 pm",
        "televisora": "Canal 5 / TUDN",
        "televisionLogo": "/logos/canal-5.png",
        "kickoff": "2026-08-02T19:00:00-06:00",
    },
]
MAX_DOBLES = 3
MAX_TRIPLES = 3

_total_especiales = MAX_DOBLES + MAX_TRIPLES
if _total_especiales > len(PARTIDOS):
    raise RuntimeError(
        f"MAX_DOBLES ({MAX_DOBLES}) + MAX_TRIPLES ({MAX_TRIPLES}) = "
        f"{_total_especiales} excede el numero de partidos ({len(PARTIDOS)})"
    )

@app.route("/api/apijornadaactual")
def apijornadaactual():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT partido_id, resultado, marcador_local, marcador_visita
                       FROM resultadosdelajornada
                       WHERE jornada = %s""",
                    (JORNADA_ACTUAL,)
                )
                filas = cur.fetchall()
        resultados_por_id = {
            pid: {"resultado": res, "marcador_local": ml, "marcador_visita": mv}
            for pid, res, ml, mv in filas
        }
    except Exception as exc:
        logger.error("apijornadaactual: error leyendo resultados -> %s", exc)
        resultados_por_id = {}

    partidos_con_resultado = []
    for p in PARTIDOS:
        info = resultados_por_id.get(p["id"])
        partidos_con_resultado.append({
            **p,
            "resultadoFinal": info["resultado"] if info else None,
            "marcadorLocal": info["marcador_local"] if info else None,
            "marcadorVisita": info["marcador_visita"] if info else None,
        })

    return jsonify({
        "jornadaActual": JORNADA_ACTUAL,
        "cierre": JORNADA_CIERRE, 
        "partidos": partidos_con_resultado,
        "maxDobles": MAX_DOBLES,
        "maxTriples": MAX_TRIPLES,
        "whatsappUrl": WHATSAPP_GRUPO_URL
    })

# ── Esto de abajo trabaja en el direccionario de pins de los vendedores────────────────────────────────────────────────────────────────────────────────
VENDEDOR_PIN = {
    "Alan Garcia":  "0106",
    "Alexander":    "0229",
    "Alfonso":      "1977",
    "Azael":        "1895",
    "Boosters":     "8106",
    "Caro":         "0511",
    "Checo":        "3019",
    "Choneke":      "2323",
    "Dani":         "1728",
    "Del Angel":    "4635",
    "El Piojo":     "2052",
    "Energeticos":  "1707",
    "Enoc":         "7683",
    "Ever":         "1821",
    "Fer":          "1111",
    "Figueroa":     "1378",
    "Gera":         "2115",
    "GioSoto":      "1788",
    "Guerrero":     "1187",
    "Jj":           "5555",
    "Jose Luis":    "1682",
    "Juanillo":     "1739",
    "Kany":         "2177",
    "Manu":         "5525",
    "Marchan":      "1226",
    "Mazatan":      "1213",
    "Memo":         "1976",
    "Pantoja":      "5429",
    "Patty":        "2012",
    "Piny":         "1234",
    "PolloGol":     "1234",
    "Ranita":       "2307",
    "Rolando":      "1982",
    "Taliban":      "6881",
    "•":            "1379",
}
# ── Esto de abajo trabaja en el diccionario de los vendedores ────────────────────────────────────────────────────────────────────────────────
VENDEDOR_WHATSAPP = {
    "Alan Garcia":  "5218284575949",
    "Alexander":    "5218287683709",
    "Alfonso":      "5218186589145",
    "Azael":        "5218120753862",
    "Boosters":     "5218121942047",
    "Caro":         "5215584076984",
    "Checo":        "5218281186921",
    "Choneke":      "5218138834830",
    "Dani":         "5218282942378",
    "Del Angel":    "5218117456805",
    "El Piojo":     "5218118004801",
    "Energeticos":  "5218281432464",
    "Enoc":         "5218186836163",
    "Ever":         "5218117299742",
    "Fer":          "5218281317783",
    "Figueroa":     "5218334077675",
    "Gera":         "5218182523537",
    "GioSoto":      "5218116911526",
    "Guerrero":     "5217206346990",
    "Jj":           "5218281006452",
    "Jose Luis":    "5218113153788",
    "Juanillo":     "5218136984024",
    "Kany":         "5218281007191",
    "Manu":         "5213111359115",
    "Marchan":      "5218281007640",
    "Mazatan":      "5218136280437",
    "Memo":         "5218284577005",
    "Pantoja":      "5218117027387",
    "Patty":        "5218281016489",
    "Piny":         "5218282941357",
    "PolloGol":     "5218125728071",
    "Ranita":       "5218281432398",
    "Rolando":      "5214891009110",
    "Taliban":      "5218287685754",
    "•":            "5218281011650",
}
# ── Esto de abajo trabaja en los links de cada vendedor────────────────────────────────────────────────────────────────────────────────
VENDEDOR_LINKS = {
    "Alan Garcia":  "https://www.quinielaselwero.com/?vendedor=Alan+Garcia",
    "Alexander":    "https://www.quinielaselwero.com/?vendedor=Alexander",
    "Alfonso":      "https://www.quinielaselwero.com/?vendedor=Alfonso",
    "Azael":        "https://www.quinielaselwero.com/?vendedor=Azael",
    "Boosters":     "https://www.quinielaselwero.com/?vendedor=Boosters",
    "Caro":         "https://www.quinielaselwero.com/?vendedor=Caro",
    "Checo":        "https://www.quinielaselwero.com/?vendedor=Checo",
    "Choneke":      "https://www.quinielaselwero.com/?vendedor=Choneke",
    "Dani":         "https://www.quinielaselwero.com/?vendedor=Dani",
    "Del Angel":    "https://www.quinielaselwero.com/?vendedor=Del+Angel",
    "El Piojo":     "https://www.quinielaselwero.com/?vendedor=El+Piojo",
    "Energeticos":  "https://www.quinielaselwero.com/?vendedor=Energeticos",
    "Enoc":         "https://www.quinielaselwero.com/?vendedor=Enoc",
    "Ever":         "https://www.quinielaselwero.com/?vendedor=Ever",
    "Fer":          "https://www.quinielaselwero.com/?vendedor=Fer",
    "Figueroa":     "https://www.quinielaselwero.com/?vendedor=Figueroa",
    "Gera":         "https://www.quinielaselwero.com/?vendedor=Gera",
    "GioSoto":      "https://www.quinielaselwero.com/?vendedor=GioSoto",
    "Guerrero":     "https://www.quinielaselwero.com/?vendedor=Guerrero",
    "Jj":           "https://www.quinielaselwero.com/?vendedor=Jj",
    "Jose Luis":    "https://www.quinielaselwero.com/?vendedor=Jose+Luis",
    "Juanillo":     "https://www.quinielaselwero.com/?vendedor=Juanillo",
    "Kany":         "https://www.quinielaselwero.com/?vendedor=Kany",
    "Manu":         "https://www.quinielaselwero.com/?vendedor=Manu",
    "Marchan":      "https://www.quinielaselwero.com/?vendedor=Marchan",
    "Mazatan":      "https://www.quinielaselwero.com/?vendedor=Mazatan",
    "Memo":         "https://www.quinielaselwero.com/?vendedor=Memo",
    "Pantoja":      "https://www.quinielaselwero.com/?vendedor=Pantoja",
    "Patty":        "https://www.quinielaselwero.com/?vendedor=Patty",
    "Piny":         "https://www.quinielaselwero.com/?vendedor=Piny",
    "PolloGol":     "https://www.quinielaselwero.com/?vendedor=PolloGol",
    "Ranita":       "https://www.quinielaselwero.com/?vendedor=Ranita",
    "Rolando":      "https://www.quinielaselwero.com/?vendedor=Rolando",
    "Taliban":      "https://www.quinielaselwero.com/?vendedor=Taliban",
    "•":            "https://www.quinielaselwero.com/?vendedor=%E2%80%A2",
}
# ── Esto de abajo trabaja en los limites de folio asignados por vendedor ────────────────────────────────────────────────────────────────────────────────
LIMITES_VENDEDORES = {
    "Alexander":      (1,    90),
    "•":              (91,   100),
    "Rifa":           (101,  200),
    "Alfonso":        (201,  290),
    "•":              (291,  300),
    "Checo":          (301,  440),
    "•":              (441,  450),
    "Azael":          (451,  500),
    "Taliban":        (501,  740),
    "•":              (741,  750),
    "Choneke":        (751,  790),
    "•":              (791,  800),
    "Dani":           (801,  850),
    "Memo":           (851,  970),
    "•":              (971,  975),
    "Guerrero":       (976,  1000),
    "Patty":          (1001, 1490),
    "•":              (1491, 1500),
    "El Piojo":       (1501, 1540),
    "•":              (1541, 1550),
    "Fer":            (1551, 1600),
    "Del Angel":      (1601, 1660),
    "•":              (1661, 1665),
    "PolloGol":       (1666, 1700),
    "Figueroa":       (1701, 1750),
    "Pantoja":        (1751, 1790),
    "•":              (1791, 1800),
    "Manu":           (1801, 1870),
    "•":              (1871, 1875),
    "Mazatan":        (1876, 1900),
    "Marchan":        (1901, 1940),
    "•":              (1941, 1950),
    "Boosters":       (1951, 2000),
    "Rolando":        (2001, 2125),
    "•":              (2126, 2130),
    "Caro":           (2131, 2150),
    "Ranita":         (2151, 2220),
    "•":              (2221, 2225),
    "Ever":           (2226, 2250),
    "Gera":           (2251, 2290),
    "•":              (2291, 2300),
    "Kany":           (2301, 2340),
    "•":              (2341, 2350),
    "Alan Garcia":    (2351, 2420),
    "•":              (2421, 2430),
    "GioSoto":        (2431, 2500),
    "Juanillo":       (2501, 2550),
    "Energeticos":    (2551, 2610),
    "•":              (2611, 2615),
    "Jose Luis":      (2616, 2650),
    "Piny":           (2651, 2660),
    "Tienda":         (2661, 2670),
    "Vender 1":       (2671, 2680),
    "Dinamicas":      (2681, 2700),
    "Jj":             (2701, 2740),
    "Enoc":           (2751, 2780),
}
LIGAS_ESPN = {
    "bundesliga": "ger.1",
    "champions":  "uefa.champions",
    "la_liga":    "esp.1",
    "liga_mx":    "mex.1",
    "ligue_1":    "fra.1",
    "premier":    "eng.1",
    "serie_a":    "ita.1",
    "mundial":    "fifa.world",
}

NOMBRE_A_ESPN = {
    # ── Liga MX ──────────────────────────────────────────
    "America":   ("227",   "liga_mx"),
    "Atlante":   ("226",   "liga_mx"),
    "Atlas":     ("216",   "liga_mx"),
    "Chivas":    ("219",   "liga_mx"),
    "Cruz Azul": ("218",   "liga_mx"),
    "Juarez":    ("17851", "liga_mx"),
    "Leon":      ("228",   "liga_mx"),
    "Monterrey": ("220",   "liga_mx"),
    "Necaxa":    ("229",   "liga_mx"),
    "Pachuca":   ("234",   "liga_mx"),
    "Puebla":    ("231",   "liga_mx"),
    "Pumas":     ("233",   "liga_mx"),
    "Queretaro": ("222",   "liga_mx"),
    "San Luis":  ("15720", "liga_mx"),
    "Santos":    ("225",   "liga_mx"),
    "Tigres":    ("232",   "liga_mx"),
    "Tijuana":   ("10125", "liga_mx"),
    "Toluca":    ("223",   "liga_mx"),
    # ── Premier League ───────────────────────────────────
    "Arsenal":     ("359", "premier"),
    "Aston Villa": ("362", "premier"),
    "Brighton":    ("331", "premier"),
    "Chelsea":     ("363", "premier"),
    "Crystal":     ("384", "premier"),
    "Everton":     ("368", "premier"),
    "Fulham":      ("370", "premier"),
    "Leeds":       ("357", "premier"),
    "Liverpool":   ("364", "premier"),
    "Man City":    ("382", "premier"),
    "Man Utd":     ("360", "premier"),
    "Newcastle":   ("361", "premier"),
    "Forest":      ("393", "premier"),
    "Sunderland":  ("366", "premier"),
    "Tottenham":   ("367", "premier"),
    # ── La Liga ──────────────────────────────────────────
    "Athletic":   ("93",   "la_liga"),
    "Atlético":   ("1068", "la_liga"),
    "Barcelona":  ("83",   "la_liga"),
    "Betis":      ("244",  "la_liga"),
    "Espanyol":   ("88",   "la_liga"),
    "Real M":     ("86",   "la_liga"),
    "Sevilla":    ("243",  "la_liga"),
    "Sociedad":   ("89",   "la_liga"),
    "Valencia":   ("94",   "la_liga"),
    "Villarreal": ("102",  "la_liga"),
    # ── Bundesliga ───────────────────────────────────────
    "Bayern":     ("132",   "bundesliga"),
    "Dortmund":   ("124",   "bundesliga"),
    "Frankfurt":  ("125",   "bundesliga"),
    "Leipzig":    ("11420", "bundesliga"),
    "Leverkusen": ("131",   "bundesliga"),
    # ── Serie A ──────────────────────────────────────────
    "Inter":    ("110", "serie_a"),
    "Juventus": ("111", "serie_a"),
    "Lazio":    ("112", "serie_a"),
    "Milan":    ("103", "serie_a"),
    "Napoli":   ("114", "serie_a"),
    "Roma":     ("104", "serie_a"),
    # ── Ligue 1 ──────────────────────────────────────────
    "Marsella": ("176", "ligue_1"),
    "Monaco":   ("174", "ligue_1"),
    "PSG":      ("160", "ligue_1"),
    # ── Mundial ──────────────────────────────────────────
    "Alemania":     ("481",  "mundial"),
    "Argentina":    ("202",  "mundial"),
    "Argelia":      ("624",  "mundial"),
    "Austria":      ("474",  "mundial"),
    "Australia":    ("628",  "mundial"),
    "Belgica":      ("459",  "mundial"),
    "Bosnia":       ("452",  "mundial"),
    "Brasil":       ("205",  "mundial"),
    "Cabo Verde":   ("2597", "mundial"),
    "Chequia":      ("450",  "mundial"),
    "Colombia":     ("208",  "mundial"),
    "Congo":        ("2850", "mundial"),
    "Costa Marfil": ("4789", "mundial"),
    "Croacia":      ("477",  "mundial"),
    "Curazao":      ("11678","mundial"),
    "Ecuador":      ("209",  "mundial"),
    "Francia":      ("478",  "mundial"),
    "Ghana":        ("4469", "mundial"),
    "Inglaterra":   ("448",  "mundial"),
    "Iran":         ("469",  "mundial"),
    "Japon":        ("627",  "mundial"),
    "Marruecos":    ("2869", "mundial"),
    "Mexico":       ("203",  "mundial"),
    "Noruega":      ("464",  "mundial"),
    "Paises Bajos": ("449",  "mundial"),
    "Paraguay":     ("210",  "mundial"),
    "Portugal":     ("482",  "mundial"),
}

def _parsear_eventos_espn(data, local_lookup, ids_listos):
    encontrados = []
    for ev in (data.get("events") or []):
        for comp in (ev.get("competitions") or []):
            state = comp.get("status", {}).get("type", {}).get("state", "")
            if state != "post":
                continue
            home_id = home_score = away_score = None
            for team in (comp.get("competitors") or []):
                equipo_id = team.get("team", {}).get("id")
                score = team.get("score")
                if team.get("homeAway") == "home":
                    home_id = equipo_id
                    home_score = score
                else:
                    away_score = score
            if home_id is None or home_score is None or away_score is None:
                continue
            pid = local_lookup.get(home_id)
            if pid is None or pid not in ids_listos:
                continue
            try:
                gh, ga = int(home_score), int(away_score)
            except (ValueError, TypeError):
                continue
            res = "L" if gh > ga else ("E" if gh == ga else "V")
            encontrados.append((pid, gh, ga, res))
    return encontrados

def _construir_lookups():
    kickoff_por_id = {}
    fecha_local_por_id = {}
    for p in PARTIDOS:
        kostr = p.get("kickoff")
        if not kostr:
            continue
        try:
            kodt = datetime.fromisoformat(kostr)
        except ValueError:
            logger.warning("kickoff invalido para partido_id=%s: %s", p["id"], kostr)
            continue
        fecha_local_por_id[p["id"]] = kodt.strftime("%Y%m%d")
        kodt_utc = kodt.astimezone(timezone.utc) if kodt.tzinfo else kodt.replace(tzinfo=timezone.utc)
        kickoff_por_id[p["id"]] = kodt_utc

    local_lookup = {}
    liga_fecha_ids = {}
    for p in PARTIDOS:
        pid = p["id"]
        entry = NOMBRE_A_ESPN.get(p["local"])
        if pid not in fecha_local_por_id:
            continue
        fecha = fecha_local_por_id[pid]
        if entry:
            espn_id, liga_key = entry
            local_lookup[espn_id] = pid
            liga_fecha_ids.setdefault((liga_key, fecha), []).append(pid)
        else:
            local_lookup[p["local"]] = pid
            logger.warning("%s no esta en NOMBRE_A_ESPN, usando nombre directo", p["local"])
    return kickoff_por_id, local_lookup, liga_fecha_ids

from pywebpush import webpush, WebPushException
import json

FALLOS_MAX_CONSECUTIVOS = 5

def _get_ids_con_resultado(jornada, ids):
    if not ids:
        return set()
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT partido_id FROM resultadosdelajornada
                       WHERE jornada = %s AND partido_id = ANY(%s)""",
                    (jornada, list(ids)),
                )
                return {r[0] for r in cur.fetchall()}
    except Exception as exc:
        logger.error("_get_ids_con_resultado error: %s", exc)
        return set()

def _guardar_resultado(pid, gh, ga, res):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO resultadosdelajornada
                    (jornada, partido_id, resultado, marcador_local, marcador_visita)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (jornada, partido_id) DO UPDATE SET
                    resultado = EXCLUDED.resultado,
                    marcador_local = EXCLUDED.marcador_local,
                    marcador_visita = EXCLUDED.marcador_visita
                """,
                (JORNADA_ACTUAL, pid, res, gh, ga),
            )
        conn.commit()

def _desactivar_suscripcion(endpoint):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE suscripcionespush SET activo = FALSE WHERE endpoint = %s",
                    (endpoint,),
                )
            conn.commit()
    except Exception as exc:
        logger.error("_desactivar_suscripcion error: %s", exc)

def _registrar_fallo(endpoint):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE suscripcionespush
                    SET fallos_consecutivos = fallos_consecutivos + 1
                    WHERE endpoint = %s
                    RETURNING fallos_consecutivos
                    """,
                    (endpoint,),
                )
                fila = cur.fetchone()
            conn.commit()
        if fila and fila[0] >= FALLOS_MAX_CONSECUTIVOS:
            _desactivar_suscripcion(endpoint)
    except Exception as exc:
        logger.error("_registrar_fallo error: %s", exc)

def _resetear_fallos(endpoint):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE suscripcionespush SET fallos_consecutivos = 0 WHERE endpoint = %s",
                    (endpoint,),
                )
            conn.commit()
    except Exception as exc:
        logger.error("_resetear_fallos error: %s", exc)

def enviar_push(dispositivoid, titulo, cuerpo, url="/"):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT endpoint, p256dh, auth
                    FROM suscripcionespush
                    WHERE dispositivoid = %s AND activo = TRUE
                """, (dispositivoid,))
                suscripciones = cur.fetchall()
    except Exception as exc:
        logger.error("enviar_push error consultando: %s", exc)
        return

    for endpoint, p256dh, auth in suscripciones:
        try:
            webpush(
                subscription_info={
                    "endpoint": endpoint,
                    "keys": {"p256dh": p256dh, "auth": auth}
                },
                data=json.dumps({"titulo": titulo, "cuerpo": cuerpo, "deepLink": url}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS.copy()
            )
            _resetear_fallos(endpoint)
        except WebPushException as exc:
            logger.warning("enviar_push fallo endpoint %s: %s", endpoint, exc)
            if exc.response is not None and exc.response.status_code in (404, 410):
                _desactivar_suscripcion(endpoint)
            else:
                _registrar_fallo(endpoint)
        except Exception as exc:
            logger.error("enviar_push error inesperado endpoint %s: %s", endpoint, exc)
            _registrar_fallo(endpoint)

def ya_se_le_mando(dispositivoid, tipo, jornada, partidoid=None):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 1 FROM historialdenotificaciones
                    WHERE dispositivoid = %s AND tipo = %s AND jornada = %s
                    AND COALESCE(partidoid, -1) = COALESCE(%s, -1)
                """, (dispositivoid, tipo, jornada, partidoid))
                return cur.fetchone() is not None
    except Exception as exc:
        logger.error("ya_se_le_mando error: %s", exc)
        return True  # ante la duda, no reenviar duplicado

def registrar_envio(dispositivoid, tipo, jornada, partidoid=None):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO historialdenotificaciones (dispositivoid, tipo, jornada, partidoid)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (dispositivoid, tipo, jornada, partidoid))
            conn.commit()
    except Exception as exc:
        logger.error("registrar_envio error: %s", exc)

def suscriptores_activos():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT DISTINCT dispositivoid FROM suscripcionespush WHERE activo = TRUE
                """)
                return [r[0] for r in cur.fetchall()]
    except Exception as exc:
        logger.error("suscriptores_activos error: %s", exc)
        return []

TEXTOS_AVISO_TIEMPO = {
    "3dias": "Faltan 3 dias para el cierre de la jornada",
    "2dias": "Faltan 2 dias para el cierre de la jornada",
    "1dia": "Falta 1 dia para el cierre de la jornada",
    "2horas": "Faltan 2 horas para el cierre de la jornada",
}

def revisar_avisos_de_tiempo(now):
    try:
        cierre = datetime.fromisoformat(JORNADA_CIERRE)
    except Exception as exc:
        logger.error("revisar_avisos_de_tiempo: JORNADA_CIERRE invalido -> %s", exc)
        return

    faltante = cierre - now
    ventanas = [
        ("3dias", timedelta(days=3)),
        ("2dias", timedelta(days=2)),
        ("1dia", timedelta(days=1)),
        ("2horas", timedelta(hours=2)),
    ]
    for tipo, ventana in ventanas:
        if timedelta(0) < faltante <= ventana:
            for dispositivoid in suscriptores_activos():
                try:
                    if not ya_se_le_mando(dispositivoid, tipo, JORNADA_ACTUAL):
                        enviar_push(
                            dispositivoid, "Quinielas El Wero", TEXTOS_AVISO_TIEMPO[tipo],
                            url="https://www.quinielaselwero.com/realizarlaquiniela.html"
                        )
                        registrar_envio(dispositivoid, tipo, JORNADA_ACTUAL)
                except Exception as exc:
                    logger.error("revisar_avisos_de_tiempo error dispositivo %s: %s", dispositivoid, exc)

def revisar_aviso_jornada_lista():
    for dispositivoid in suscriptores_activos():
        try:
            if not ya_se_le_mando(dispositivoid, "jornadalista", JORNADA_ACTUAL):
                enviar_push(
                    dispositivoid,
                    "Quinielas El Wero",
                    f"Ya esta lista la {JORNADA_ACTUAL}, entra y haz tu quiniela",
                    url="https://www.quinielaselwero.com/realizarlaquiniela.html"
                )
                registrar_envio(dispositivoid, "jornadalista", JORNADA_ACTUAL)
        except Exception as exc:
            logger.error("revisar_aviso_jornada_lista error dispositivo %s: %s", dispositivoid, exc)

def revisar_avisos_de_partidos():
    try:
        resultados = _obtener_resultados_oficiales(JORNADA_ACTUAL)
    except Exception as exc:
        logger.error("revisar_avisos_de_partidos error obteniendo resultados: %s", exc)
        return

    if 5 in resultados:
        for dispositivoid in suscriptores_activos():
            try:
                if not ya_se_le_mando(dispositivoid, "partido5", JORNADA_ACTUAL, 5):
                    enviar_push(
                        dispositivoid, "Quinielas El Wero", "Termino el partido 5, revisa tus puntos",
                        url="https://www.quinielaselwero.com/misquinielas.html"
                    )
                    registrar_envio(dispositivoid, "partido5", JORNADA_ACTUAL, 5)
            except Exception as exc:
                logger.error("revisar_avisos_de_partidos (partido5) error dispositivo %s: %s", dispositivoid, exc)

    if len(resultados) >= len(PARTIDOS):
        for dispositivoid in suscriptores_activos():
            try:
                if not ya_se_le_mando(dispositivoid, "jornadaterminada", JORNADA_ACTUAL):
                    enviar_push(
                        dispositivoid, "Quinielas El Wero", "Terminaron los 9 partidos, ve los resultados finales",
                        url="https://www.quinielaselwero.com/listaoficial.html"
                    )
                    registrar_envio(dispositivoid, "jornadaterminada", JORNADA_ACTUAL)
            except Exception as exc:
                logger.error("revisar_avisos_de_partidos (final) error dispositivo %s: %s", dispositivoid, exc)

def _auto_sync_loop():
    logger.info("auto_sync (hilo Flask) iniciado")
    try:
        kickoff_por_id, local_lookup, liga_fecha_ids = _construir_lookups()
    except Exception as exc:
        logger.error("auto_sync: error construyendo lookups -> %s", exc)
        return

    while True:
        try:
            now = datetime.now(timezone.utc)

            try:
                revisar_aviso_jornada_lista()
                revisar_avisos_de_tiempo(now)
                revisar_avisos_de_partidos()
            except Exception as exc:
                logger.error("autosync: error revisando avisos push - %s", exc)

            ids_listos = {
                pid for pid, ko in kickoff_por_id.items()
                if now >= ko + timedelta(minutes=105)
            }
            
            if not ids_listos:
                logger.info("auto_sync: ningun partido listo todavia, durmiendo 10 min")
                time.sleep(600)
                continue

            try:
                ids_con_resultado = _get_ids_con_resultado(JORNADA_ACTUAL, ids_listos)
            except Exception as exc:
                logger.error("auto_sync: error consultando DB -> %s", exc)
                time.sleep(60)
                continue

            ids_sin_resultado = ids_listos - ids_con_resultado
            if not ids_sin_resultado:
                logger.info("auto_sync: todos los partidos listos ya tienen resultado")
                time.sleep(600)
                continue

            logger.info("auto_sync: partidos pendientes de resultado -> %s", ids_sin_resultado)

            for (liga_key, fecha), pids in liga_fecha_ids.items():
                if not any(pid in ids_sin_resultado for pid in pids):
                    continue

                slug = LIGAS_ESPN.get(liga_key)
                if not slug:
                    logger.warning("auto_sync: liga_key=%s sin slug configurado en LIGAS_ESPN", liga_key)
                    continue

                fecha_dt = datetime.strptime(fecha, "%Y%m%d")
                fecha_ini = (fecha_dt - timedelta(days=1)).strftime("%Y%m%d")
                fecha_fin = (fecha_dt + timedelta(days=1)).strftime("%Y%m%d")
                rango = f"{fecha_ini}-{fecha_fin}"

                url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard?dates={rango}"

                try:
                    resp = requests.get(url, timeout=10)
                    logger.info("auto_sync: GET %s -> status=%s", url, resp.status_code)
                    if resp.status_code != 200:
                        logger.warning(
                            "auto_sync: ESPN respondio codigo %s para liga=%s fecha=%s",
                            resp.status_code, liga_key, fecha
                        )
                        continue
                    try:
                        data = resp.json()
                    except ValueError as exc:
                        logger.error(
                            "auto_sync: JSON invalido de ESPN liga=%s fecha=%s -> %s | body[:300]=%s",
                            liga_key, fecha, exc, resp.text[:300]
                        )
                        continue
                    logger.info(
                        "auto_sync: %s eventos recibidos para liga=%s rango=%s",
                        len(data.get("events", [])), liga_key, rango
                    )
                except requests.Timeout:
                    logger.warning("auto_sync: TIMEOUT consultando ESPN liga=%s fecha=%s", liga_key, fecha)
                    continue
                except requests.RequestException as exc:
                    logger.warning("auto_sync: error de red liga=%s fecha=%s -> %s", liga_key, fecha, exc)
                    continue

                encontrados = _parsear_eventos_espn(data, local_lookup, ids_sin_resultado)
                if not encontrados:
                    logger.info(
                        "auto_sync: ningun partido terminado coincidio todavia para liga=%s rango=%s",
                        liga_key, rango
                    )

                for pid, gh, ga, res in encontrados:
                    try:
                        _guardar_resultado(pid, gh, ga, res)
                        logger.info("auto_sync OK partido_id=%s %s-%s res=%s", pid, gh, ga, res)
                    except Exception as exc:
                        logger.error("auto_sync: error guardando partido_id=%s -> %s", pid, exc)

        except Exception as exc:
            logger.error("auto_sync_loop: error inesperado -> %s", exc)
            time.sleep(60)
            continue

        time.sleep(600)

_sync_iniciado = False
_sync_lock = threading.Lock()

def iniciar_auto_sync():
    global _sync_iniciado
    with _sync_lock:
        if _sync_iniciado:
            return
        hilo = threading.Thread(target=_auto_sync_loop, daemon=True)
        hilo.start()
        _sync_iniciado = True
        logger.info("Hilo auto_sync lanzado en background")

# ── Esto de abajo trabaja en obtener los resultados oficiales ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def _obtener_resultados_oficiales(jornada):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT partido_id, resultado FROM resultadosdelajornada WHERE jornada=%s''',
                (jornada,)
            )
            return {row[0]: row[1] for row in cur.fetchall()}

def _calcular_puntos(picks, resultados_oficiales):
    puntos = 0
    for i, partido in enumerate(PARTIDOS):
        resultado_oficial = resultados_oficiales.get(partido["id"])
        if resultado_oficial and i < len(picks) and picks[i] == resultado_oficial:
            puntos += 1
    return puntos

# ── Inicializacion al arrancar el servicio  ──────────────────────────────────────────────────────────────────────────────────────────────────────────
try:
    crear_tablas()
except Exception as exc:
    raise RuntimeError(f"No se pudieron crear las tablas: {exc}") from exc

iniciar_auto_sync()

# ── Esto de abajo trabaja con la api de registrodeclientes  ─────────────────────────────────────────────────────────────────────────────────────────
@app.route("/api/registrodeclientes", methods=["POST"])
def registrodeclientes():
    data = request.get_json(silent=True) or {}

    dispositivoid = (data.get("dispositivoid") or "").strip()
    nombrecelular = (data.get("nombrecelular") or "").strip()

    if not dispositivoid or not nombrecelular:
        return jsonify({"success": False, "mensaje": "Faltan datos"}), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO clientes (dispositivoid, nombrecelular)
                    VALUES (%s, %s)
                    ON CONFLICT (dispositivoid) DO NOTHING
                    RETURNING id
                    """,
                    (dispositivoid, nombrecelular)
                )
                fila = cur.fetchone()

                if fila is None:
                    cur.execute(
                        "SELECT id FROM clientes WHERE dispositivoid = %s",
                        (dispositivoid,),
                    )
                    fila = cur.fetchone()

                conn.commit()

        return jsonify({"success": True, "id": fila[0]})

    except Exception as exc:
        logger.error("registrodeclientes error: %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con la api de vendedores  ──────────────────────────────────────────────────────────────────────────────────────────────────
@app.route("/api/vendedores")
def api_vendedores():
    return jsonify({"success": True, "vendedores": VENDEDOR_WHATSAPP})

# ── Esto de abajo trabaja con la api de enviar la quiniela por whatsapp  ────────────────────────────────────────────────────────────────────────────
def construir_llavemaestra(nombrecelular, jornada, nombrequiniela, picks):
    return f"{nombrecelular}|{jornada}|{nombrequiniela}|{''.join(picks)}"

@app.route("/api/enviarlaquinielaporwhatsapp", methods=["POST"])
def enviarlaquinielaporwhatsapp():
    data = request.get_json(silent=True) or {}
    nombrecelular = (data.get("nombrecelular") or "").strip()
    nombrequiniela = (data.get("nombrequiniela") or "").strip()
    vendedor = (data.get("vendedor") or "").strip()
    jornada = (data.get("jornada") or JORNADA_ACTUAL).strip()
    dispositivoid = (data.get("dispositivoid") or "").strip()
    selecciones = data.get("selecciones") or {}
    if not nombrecelular or not nombrequiniela or not selecciones or not dispositivoid:
        return jsonify({"success": False, "mensaje": "Faltan datos"}), 400
    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify({"success": False, "mensaje": "Vendedor no reconocido"}), 400
    picks = []
    for p in PARTIDOS:
        pick = selecciones.get(str(p["id"])) or selecciones.get(p["id"])
        if not pick or pick not in ("L", "E", "V"):
            return jsonify({"success": False, "mensaje": f"Falta selección en partido {p['id']}"}), 400
        picks.append(pick)
    llavemaestra = construir_llavemaestra(nombrecelular, jornada, nombrequiniela, picks)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO todaslasquinielas (
                        nombrecelular, nombrequiniela, vendedor, jornada,
                        p1, p2, p3, p4, p5, p6, p7, p8, p9,
                        llavemaestra, dispositivoid
                    )
                    VALUES (%s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s)
                    ON CONFLICT (llavemaestra) DO NOTHING
                    RETURNING id
                    """,
                    (
                        nombrecelular, nombrequiniela, vendedor, jornada,
                        *picks, llavemaestra, dispositivoid
                    )
                )
                fila = cur.fetchone()
                conn.commit()

        if fila is None:
            return jsonify({"success": False, "mensaje": "Esta quiniela ya fue enviada anteriormente"}), 409

        return jsonify({
            "success": True,
            "id": fila[0],
            "llavemaestra": llavemaestra
        })

    except Exception as exc:
        logger.error("enviarlaquinielaporwhatsapp error: %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con la api de verificar registro de clientes  ──────────────────────────────────────────────────────────────────────────────

@app.route("/api/verificarregistro")
def verificarregistro():
    dispositivoid = (request.args.get("dispositivoid") or "").strip()
    if not dispositivoid:
        return jsonify({"registrado": False}), 400
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT nombrecelular FROM clientes WHERE dispositivoid = %s",
                    (dispositivoid,),
                )
                fila = cur.fetchone()
        if fila is None:
            return jsonify({"registrado": False})
        return jsonify({"registrado": True, "nombrecelular": fila[0]})
    except Exception as exc:
        logger.error("verificarregistro: error -> %s", exc)
        return jsonify({"registrado": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con la api de la lista oficial              ───────────────────────────────────────────────────────────────────────────────────────────
@app.route("/api/laapidelalistaoficial")
def laapidelalistaoficial():
    jornada = request.args.get("jornada", JORNADA_ACTUAL)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, folio, nombrequiniela, vendedor,
                           p1, p2, p3, p4, p5, p6, p7, p8, p9,
                           dispositivoid, llavemaestra
                    FROM todaslasquinielas
                    WHERE estado = 'Jugando'
                      AND jornada = %s
                    ORDER BY folio::int ASC;
                """, (jornada,))
                filas = cur.fetchall()

        resultados_oficiales = _obtener_resultados_oficiales(jornada)

        quinielas = []
        for row in filas:
            id_, folio, nombre, vendedor, p1, p2, p3, p4, p5, p6, p7, p8, p9, dispositivoid, llavemaestra = row
            picks = [p1, p2, p3, p4, p5, p6, p7, p8, p9]
            quinielas.append({
                "id": id_,
                "folio": folio,
                "nombre": nombre,
                "vendedor": vendedor,
                "picks": picks,
                "puntos": _calcular_puntos(picks, resultados_oficiales),
                "dispositivoid": dispositivoid,
                "llavemaestra": llavemaestra,
            })

        quinielas.sort(key=lambda q: q["puntos"], reverse=True)

        return jsonify({"quinielas": quinielas})
    except Exception as exc:
        logger.error("laapidelalistaoficial: error -> %s", exc)
        return jsonify({"quinielas": [], "error": str(exc)}), 500

# ==================== Esto de abajo trabaja con la api de todas las quinielas (sin importar estado) ====================
@app.route("/api/apitodaslasquinielas")
def apitodaslasquinielas():
    jornada = request.args.get("jornada", JORNADA_ACTUAL)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, nombrecelular, nombrequiniela, vendedor,
                           p1, p2, p3, p4, p5, p6, p7, p8, p9,
                           dispositivoid, llavemaestra, estado, folio
                    FROM todaslasquinielas
                    WHERE jornada = %s
                    ORDER BY fechacreacion ASC
                    """,
                    (jornada,),
                )
                filas = cur.fetchall()

        quinielas = []
        for row in filas:
            (id_, nombrecelular, nombrequiniela, vendedor,
             p1, p2, p3, p4, p5, p6, p7, p8, p9,
             dispositivoid, llavemaestra, estado, folio) = row
            quinielas.append({
                "id": id_,
                "nombre": nombrequiniela,
                "vendedor": vendedor,
                "picks": [p1, p2, p3, p4, p5, p6, p7, p8, p9],
                "dispositivo_id": dispositivoid,
                "llave_maestra": llavemaestra,
                "estado": estado,
                "folio": folio,
            })
        return jsonify(success=True, quinielas=quinielas)
    except Exception as exc:
        logger.error("apitodaslasquinielas: error -> %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500
    
# ── Esto de abajo trabaja con la api de validad pin de los vendedores   ───────────────────────────────────────────────────────────────────────────────────────────
@app.route("/api/validarpin", methods=["POST"])
def validarpin():
    data = request.get_json(silent=True) or {}
    vendedor = (data.get("vendedor") or "").strip()
    pin = (data.get("pin") or "").strip()
    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify({"valido": False, "mensaje": "Vendedor no reconocido"}), 400
    if VENDEDOR_PIN.get(vendedor) == pin:
        return jsonify({"valido": True, "vendedor": vendedor})
    return jsonify({"valido": False, "mensaje": "PIN incorrecto"}), 401

# ── Esto de abajo trabaja con la api de las quinielas del vendedor en administrador    ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/quinielasdelvendedor")
def quinielasdelvendedor():
    vendedor = (request.args.get("vendedor") or "").strip()
    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify({"success": False, "mensaje": "Vendedor no valido"}), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, nombrecelular, nombrequiniela, jornada, estado, folio,
                              p1,p2,p3,p4,p5,p6,p7,p8,p9
                       FROM todaslasquinielas
                       WHERE vendedor = %s
                       ORDER BY fechacreacion DESC;""",
                    (vendedor,),
                )
                filas = cur.fetchall()
        return jsonify({"success": True, "quinielas": [
            dict(zip(
                ["id", "nombrecelular", "nombrequiniela", "jornada", "estado",
                 "folio", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"],
                f
            )) for f in filas
        ]})
    except Exception as exc:
        logger.error("quinielasdelvendedor: error -> %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con la api de las quinielas No jugando                   ─────────────────────────────────────────────────────────────────────────
@app.route("/api/nojugando")
def api_nojugando():
    vendedor = (request.args.get("vendedor") or "").strip()
    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify({"success": False, "mensaje": "Vendedor no valido"}), 400
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, nombrecelular, nombrequiniela,
                              p1, p2, p3, p4, p5, p6, p7, p8, p9
                       FROM todaslasquinielas
                       WHERE vendedor = %s AND estado = 'No jugando'
                       ORDER BY fechacreacion ASC;""",
                    (vendedor,),
                )
                filas = cur.fetchall()
        pendientes = []
        for row in filas:
            id_, nombrecelular, nombre, p1, p2, p3, p4, p5, p6, p7, p8, p9 = row
            pendientes.append({
                "id": id_,
                "nombre": nombre,
                "vendedor": vendedor,
                "picks": [p1, p2, p3, p4, p5, p6, p7, p8, p9],
            })
        return jsonify({"pendientes": pendientes})
    except Exception as exc:
        logger.error("api_nojugando: error -> %s", exc)
        return jsonify({"pendientes": [], "error": str(exc)}), 500

# ── Esto de abajo trabaja con la api de las quinielas En espera                      ─────────────────────────────────────────────────────────────────────────
@app.route("/api/espera")
def api_espera():
    vendedor = (request.args.get("vendedor") or "").strip()
    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify({"success": False, "mensaje": "Vendedor no valido"}), 400
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, nombrecelular, nombrequiniela,
                              p1, p2, p3, p4, p5, p6, p7, p8, p9
                       FROM todaslasquinielas
                       WHERE vendedor = %s AND estado = 'En espera'
                       ORDER BY fechacreacion ASC;""",
                    (vendedor,),
                )
                filas = cur.fetchall()
        espera = []
        for row in filas:
            id_, nombrecelular, nombre, p1, p2, p3, p4, p5, p6, p7, p8, p9 = row
            espera.append({
                "id": id_,
                "nombre": nombre,
                "vendedor": vendedor,
                "picks": [p1, p2, p3, p4, p5, p6, p7, p8, p9],
            })
        return jsonify({"espera": espera})
    except Exception as exc:
        logger.error("api_espera: error -> %s", exc)
        return jsonify({"espera": [], "error": str(exc)}), 500

# ── Esto de abajo trabaja con la api de las quinielas Jugando                       ─────────────────────────────────────────────────────────────────────────
@app.route("/api/jugando")
def api_jugando():
    vendedor = (request.args.get("vendedor") or "").strip()
    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify({"success": False, "mensaje": "Vendedor no valido"}), 400
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, folio, nombrequiniela,
                              p1, p2, p3, p4, p5, p6, p7, p8, p9
                       FROM todaslasquinielas
                       WHERE vendedor = %s AND estado = 'Jugando'
                       ORDER BY folio::int ASC;""",
                    (vendedor,),
                )
                filas = cur.fetchall()

        resultados_oficiales = _obtener_resultados_oficiales(JORNADA_ACTUAL)

        jugando = []
        for row in filas:
            id_, folio, nombre, p1, p2, p3, p4, p5, p6, p7, p8, p9 = row
            picks = [p1, p2, p3, p4, p5, p6, p7, p8, p9]
            jugando.append({
                "id": id_,
                "folio": folio,
                "nombre": nombre,
                "vendedor": vendedor,
                "picks": picks,
                "puntos": _calcular_puntos(picks, resultados_oficiales),
            })

        jugando.sort(key=lambda q: q["puntos"], reverse=True)

        return jsonify({"jugando": jugando, "totalSemana": len(jugando)})
    except Exception as exc:
        logger.error("api_jugando: error -> %s", exc)
        return jsonify({"jugando": [], "error": str(exc)}), 500

# ── Esto de abajo trabaja con la api de contadordequinielas                   ─────────────────────────────────────────────────────────────────────────
@app.route("/api/contadordequinielas")
def contadordequinielas():
    dispositivoid = (request.args.get("dispositivoid") or "").strip()
    if not dispositivoid:
        return jsonify({"success": False, "mensaje": "Falta dispositivoid"}), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        COUNT(*) FILTER (WHERE estado IN ('No jugando', 'En espera', 'Rechazada', 'Archivada')) AS pending,
                        COUNT(*) FILTER (WHERE estado = 'Jugando') AS active
                    FROM todaslasquinielas
                    WHERE dispositivoid = %s
                """, (dispositivoid,))
                fila = cur.fetchone()

        pending = fila[0] or 0
        active = fila[1] or 0

        return jsonify({
            "success": True,
            "pending": pending,
            "active": active
        })
    except Exception as exc:
        logger.error("contadordequinielas error: %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con la api de confirmar una quiniela pasa de no jugando a jugando o en espera ────────────────────────────────────────────────
@app.route("/api/quinielas/<int:qid>/confirmar", methods=["PATCH"])
def api_confirmar(qid):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT vendedor, estado FROM todaslasquinielas WHERE id = %s FOR UPDATE",
                    (qid,),
                )
                fila = cur.fetchone()
                if fila is None:
                    return jsonify({"success": False, "error": "Quiniela no encontrada"}), 404
                vendedor, estado = fila
                if estado != "No jugando":
                    return jsonify({"success": False, "error": "Esta quiniela ya fue procesada"}), 409
                if LISTA_BLOQUEADA:
                    return jsonify({
                        "success": False,
                        "error": "Estamos trabajando en las listas, favor de intentarlo mañana"
                    }), 423
                if MODO_ESPERA["activo"]:
                    cur.execute(
                        "UPDATE todaslasquinielas SET estado = 'En espera' WHERE id = %s",
                        (qid,),
                    )
                    conn.commit()
                    return jsonify({"success": True, "estado": "espera", "motivo": "modo_espera", "nuevofolio": None})
                rango = LIMITES_VENDEDORES.get(vendedor)
                if rango is None:
                    return jsonify({"success": False, "error": f"{vendedor} no tiene folios asignados"}), 400
                folioinicio, foliofin = rango
                cur.execute(
                    """
                    SELECT folio::int FROM todaslasquinielas
                    WHERE estado = 'Jugando'
                      AND folio::int BETWEEN %s AND %s
                    FOR UPDATE
                    """,
                    (folioinicio, foliofin),
                )
                foliosocupados = [r[0] for r in cur.fetchall()]
                foliolibre = None
                for candidato in range(folioinicio, foliofin + 1):
                    if candidato not in foliosocupados:
                        foliolibre = candidato
                        break
                if foliolibre is None:
                    cur.execute(
                        "UPDATE todaslasquinielas SET estado = 'En espera' WHERE id = %s",
                        (qid,),
                    )
                    conn.commit()
                    return jsonify({"success": True, "estado": "espera", "motivo": "sin_folios", "nuevofolio": None})
                cur.execute(
                    "UPDATE todaslasquinielas SET estado = 'Jugando', folio = %s WHERE id = %s RETURNING folio",
                    (str(foliolibre), qid),
                )
                folio = cur.fetchone()[0]
                conn.commit()
                return jsonify({"success": True, "estado": "jugando", "quiniela": {"folio": folio}})
    except Exception as exc:
        logger.error("api_confirmar: error -> %s", exc)
        return jsonify({"success": False, "error": str(exc)}), 500

# ── Esto de abajo trabaja con la api de rechazar una quiniela pasa de no jugando a rechazada ────────────────────────────────────────────────────────────────
@app.route("/api/quinielas/<int:qid>/rechazar", methods=["PATCH"])
def api_rechazar(qid):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE todaslasquinielas SET estado = 'Rechazada' WHERE id = %s AND estado = 'No jugando'",
                    (qid,),
                )
                afectadas = cur.rowcount
                conn.commit()
        if afectadas == 0:
            return jsonify({"success": False, "error": "No se pudo rechazar: no existe o ya fue procesada"}), 404
        return jsonify({"success": True})
    except Exception as exc:
        logger.error("api_rechazar: error -> %s", exc)
        return jsonify({"success": False, "error": str(exc)}), 500

# ── Esto de abajo trabaja con actualizarmisquiniela ────────────────────────────────────────────────────────────────────────────────
@app.route("/api/actualizarmisquinielas")
def actualizarmisquinielas():
    dispositivoid = (request.args.get("dispositivoid") or "").strip()
    if not dispositivoid:
        return jsonify({"success": False, "mensaje": "Falta dispositivoid"}), 400
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, llavemaestra, estado, folio, nombrequiniela, vendedor,
                           p1, p2, p3, p4, p5, p6, p7, p8, p9, jornada
                    FROM todaslasquinielas
                    WHERE dispositivoid = %s
                    """,
                    (dispositivoid,),
                )
                filas = cur.fetchall()

        resultados_cache = {}
        quinielas = []
        for id_, llave, estado, folio, nombre, vendedor, p1, p2, p3, p4, p5, p6, p7, p8, p9, jornada in filas:
            if jornada not in resultados_cache:
                resultados_cache[jornada] = _obtener_resultados_oficiales(jornada)
            picks = [p1, p2, p3, p4, p5, p6, p7, p8, p9]
            quinielas.append({
                "id": id_,
                "llavemaestra": llave,
                "estado": estado,
                "folio": folio,
                "nombre": nombre,
                "vendedor": vendedor,
                "puntos": _calcular_puntos(picks, resultados_cache[jornada]),
            })

        return jsonify({"success": True, "quinielas": quinielas})
    except Exception as exc:
        logger.error("actualizarmisquinielas: error -> %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500
    
    # ── Esto de abajo trabaja con la api de porcentajes actuales de la lista oficial ─────────────────────────────────────────────────────────────────────
@app.route("/api/apiporcentajesactuales")
def apiporcentajesactuales():
    jornada = request.args.get("jornada", JORNADA_ACTUAL)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT p1, p2, p3, p4, p5, p6, p7, p8, p9
                    FROM todaslasquinielas
                    WHERE estado = 'Jugando'
                      AND jornada = %s
                """, (jornada,))
                filas = cur.fetchall()

        partidos = []
        total_participantes = len(filas)

        for i, partido in enumerate(PARTIDOS):
            conteoL = 0
            conteoE = 0
            conteoV = 0

            for fila in filas:
                pick = fila[i]
                if pick == "L":
                    conteoL += 1
                elif pick == "E":
                    conteoE += 1
                elif pick == "V":
                    conteoV += 1

            if total_participantes > 0:
                porcL = round((conteoL / total_participantes) * 100)
                porcE = round((conteoE / total_participantes) * 100)
                porcV = round((conteoV / total_participantes) * 100)
            else:
                porcL = 0
                porcE = 0
                porcV = 0

            partidos.append({
                "id": partido["id"],
                "local": partido["local"],
                "localLogo": partido["localLogo"],
                "visitante": partido["visitante"],
                "visitanteLogo": partido["visitanteLogo"],
                "horario": f"Porcentajes basados a {total_participantes} participantes",
                "porcL": porcL,
                "porcE": porcE,
                "porcV": porcV
            })

        return jsonify({
            "success": True,
            "jornadaActual": jornada,
            "totalParticipantes": total_participantes,
            "partidos": partidos
        })

    except Exception as exc:
        logger.error("apiporcentajesactuales: error -> %s", exc)
        return jsonify({
            "success": False,
            "jornadaActual": jornada,
            "totalParticipantes": 0,
            "partidos": [],
            "error": str(exc)
        }), 500

# ── Esto de abajo trabaja con archivo para importar de excel ────────────────────────────────────────────────────────────────────────────────
@app.route("/api/importararchivodeexcel", methods=["POST"])
def importararchivodeexcel():
    data = request.get_json(silent=True) or {}
    jornada = data.get("jornada") or JORNADA_ACTUAL
    filas = data.get("filas") or []
    if not filas:
        return jsonify({"success": False, "mensaje": "El archivo no trae filas"}), 400
    insertadas = 0
    reactivadas = 0
    rechazadas = []
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                for f in filas:
                    picks = (f.get("picks") or [])[:9]
                    if len(picks) < 9 or any(p not in ("L", "E", "V") for p in picks):
                        rechazadas.append(f.get("folio"))
                        continue
                    dispositivoid = f.get("dispositivoid") or "csv-import"
                    llave = f.get("llavemaestra") or f"IMPORTADO|{jornada}|{f.get('nombre')}|{f.get('folio')}"
                    cur.execute(
                        """
                        INSERT INTO todaslasquinielas
                        (nombrecelular, nombrequiniela, vendedor, jornada,
                         p1,p2,p3,p4,p5,p6,p7,p8,p9, estado, folio, llavemaestra, dispositivoid)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Jugando',%s,%s,%s)
                        ON CONFLICT (llavemaestra) DO UPDATE SET
                            folio = EXCLUDED.folio,
                            nombrequiniela = EXCLUDED.nombrequiniela,
                            vendedor = EXCLUDED.vendedor,
                            estado = 'Jugando'
                        RETURNING id, (xmax = 0) AS fue_insertada
                        """,
                        ("Importado", f.get("nombre"), f.get("vendedor"), jornada,
                         *picks, f.get("folio"), llave, dispositivoid),
                    )
                    fila = cur.fetchone()
                    if fila is None:
                        rechazadas.append(f.get("folio"))
                    elif fila[1]:
                        insertadas += 1
                    else:
                        reactivadas += 1
            conn.commit()
        return jsonify({
            "success": True,
            "insertadas": insertadas,
            "reactivadas": reactivadas,
            "rechazadas": len(rechazadas),
            "foliosrechazados": rechazadas
        })
    except Exception as exc:
        logger.error("importararchivodeexcel: error -> %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con el boton de Nueva jornada────────────────────────────────────────────────────────────────────────────────
@app.route("/api/nuevajornada", methods=["POST"])
def nuevajornada():
    data = request.get_json(silent=True) or {}
    confirmacion = data.get("confirmacion")
    if confirmacion != "SI_BORRAR_TODO":
        return jsonify({"success": False, "mensaje": "Falta confirmación"}), 400
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM todaslasquinielas")
                cur.execute("DELETE FROM resultadosdelajornada")
            conn.commit()
        return jsonify({"success": True, "mensaje": "Quinielas y resultados borrados. Clientes intactos."})
    except Exception as exc:
        logger.error("nuevajornada: error -> %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500
    

# ── Esto de abajo trabaja con actualizar los resultados────────────────────────────────────────────────────────────────────────────────
@app.route("/api/apiparaactualizarlosresultados", methods=["POST"])
def apiparaactualizarlosresultados():
    data = request.get_json(silent=True) or {}
    jornada = data.get("jornada") or JORNADA_ACTUAL
    resultados = data.get("resultados") or []

    if not resultados:
        return jsonify({"success": False, "mensaje": "No se recibieron resultados"}), 400

    actualizados = 0
    rechazados = []

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                for r in resultados:
                    partido_id = r.get("partido_id")
                    resultado = r.get("resultado")
                    marcador_local = r.get("marcador_local")
                    marcador_visita = r.get("marcador_visita")

                    if not partido_id:
                        rechazados.append({"partido_id": partido_id, "motivo": "Falta partido_id"})
                        continue

                    if resultado not in ("L", "E", "V"):
                        rechazados.append({"partido_id": partido_id, "motivo": "Resultado inválido"})
                        continue

                    cur.execute(
                        """
                        INSERT INTO resultadosdelajornada
                        (jornada, partido_id, resultado, marcador_local, marcador_visita)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (jornada, partido_id) DO UPDATE SET
                            resultado = EXCLUDED.resultado,
                            marcador_local = EXCLUDED.marcador_local,
                            marcador_visita = EXCLUDED.marcador_visita
                        """,
                        (jornada, partido_id, resultado, marcador_local, marcador_visita),
                    )
                    actualizados += 1

            conn.commit()

        return jsonify({
            "success": True,
            "mensaje": "Resultados guardados correctamente",
            "actualizados": actualizados,
            "rechazados": rechazados
        })

    except Exception as exc:
        logger.error("apiparaactualizarlosresultados: error -> %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500
    

# ── Esto de abajo trabaja con el contador de quinielas para que no se actualize nuestra tabla de quinielas sin nececidad ─────────────────────────────
@app.route("/api/totaljugando")
def totaljugando():
    jornada = request.args.get("jornada", JORNADA_ACTUAL)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM todaslasquinielas WHERE estado = 'Jugando' AND jornada = %s",
                    (jornada,)
                )
                total = cur.fetchone()[0]
        return jsonify({"success": True, "total": total})
    except Exception as exc:
        logger.error("totaljugando: error -> %s", exc)
        return jsonify({"success": False, "mensaje": str(exc)}), 500

# ── Esto de abajo trabaja con el invitaatuscompas  ────────────────────────────────────────────────────────────────────────────────
@app.route('/api/invitaatuscompaslista')
def invitaatuscompaslista():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT codigo, dueno, telefono, vendedor, activo, fechacreacion
                    FROM invitaatuscompas
                    ORDER BY fechacreacion DESC
                """)
                filas = cur.fetchall()
        codigos = []
        for codigo, dueno, telefono, vendedor, activo, fechacreacion in filas:
            codigos.append({
                "codigo": codigo,
                "dueno": dueno,
                "telefono": telefono,
                "vendedor": vendedor,
                "linkVendedor": VENDEDOR_LINKS.get(vendedor, ""),
                "activo": activo,
                "creadoEn": fechacreacion.strftime("%Y-%m-%d %H:%M") if fechacreacion else "",
            })
        return jsonify(success=True, codigos=codigos)
    except Exception as exc:
        logger.error("invitaatuscompaslista error - %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500

@app.route('/api/invitaatuscompascrearreferido', methods=['POST'])
def invitaatuscompascrearreferido():
    data = request.get_json(silent=True) or {}
    codigo = (data.get('codigo') or '').strip()
    dueno = (data.get('dueno') or '').strip()
    telefono = (data.get('telefono') or '').strip()
    vendedor = (data.get('vendedor') or '').strip()

    if not codigo or not dueno or not telefono or not vendedor:
        return jsonify(success=False, mensaje="Faltan datos: código, dueño, teléfono y vendedor son obligatorios"), 400

    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify(success=False, mensaje="Vendedor no reconocido"), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO invitaatuscompas (codigo, dueno, telefono, vendedor)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (codigo) DO NOTHING
                    RETURNING id
                """, (codigo, dueno, telefono, vendedor))
                fila = cur.fetchone()
                conn.commit()
        if fila is None:
            return jsonify(success=False, mensaje="Ese código ya existe, elige otro"), 409
        return jsonify(success=True, id=fila[0], mensaje="Código creado correctamente")
    except Exception as exc:
        logger.error("invitaatuscompascrearreferido error - %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500

@app.route('/api/invitaatuscompaseditar', methods=['POST'])
def invitaatuscompaseditar():
    data = request.get_json(silent=True) or {}
    codigo = (data.get('codigo') or '').strip()
    dueno = (data.get('dueno') or '').strip()
    telefono = (data.get('telefono') or '').strip()
    vendedor = (data.get('vendedor') or '').strip()

    if not codigo or not dueno or not telefono or not vendedor:
        return jsonify(success=False, mensaje="Faltan datos: código, dueño, teléfono y vendedor son obligatorios"), 400

    if vendedor not in VENDEDOR_WHATSAPP:
        return jsonify(success=False, mensaje="Vendedor no reconocido"), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE invitaatuscompas
                    SET dueno = %s, telefono = %s, vendedor = %s
                    WHERE codigo = %s
                    RETURNING id
                """, (dueno, telefono, vendedor, codigo))
                fila = cur.fetchone()
                conn.commit()
        if fila is None:
            return jsonify(success=False, mensaje="No se encontró ese código"), 404
        return jsonify(success=True, mensaje="Código editado correctamente")
    except Exception as exc:
        logger.error("invitaatuscompaseditar error - %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500

@app.route('/api/invitaatuscompasestado', methods=['POST'])
def invitaatuscompasestado():
    data = request.get_json(silent=True) or {}
    codigo = (data.get('codigo') or '').strip()
    activar = bool(data.get('activar'))

    if not codigo:
        return jsonify(success=False, mensaje="Falta el código"), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE invitaatuscompas
                    SET activo = %s
                    WHERE codigo = %s
                    RETURNING id
                """, (activar, codigo))
                fila = cur.fetchone()
                conn.commit()
        if fila is None:
            return jsonify(success=False, mensaje="No se encontró ese código"), 404
        return jsonify(success=True, mensaje="Estado actualizado correctamente")
    except Exception as exc:
        logger.error("invitaatuscompasestado error - %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500

@app.route('/api/invitaatuscompaseliminar', methods=['POST'])
def invitaatuscompaseliminar():
    data = request.get_json(silent=True) or {}
    codigo = (data.get('codigo') or '').strip()

    if not codigo:
        return jsonify(success=False, mensaje="Falta el código"), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM invitaatuscompas
                    WHERE codigo = %s
                    RETURNING id
                """, (codigo,))
                fila = cur.fetchone()
                conn.commit()
        if fila is None:
            return jsonify(success=False, mensaje="No se encontró ese código"), 404
        return jsonify(success=True, mensaje="Código eliminado correctamente")
    except Exception as exc:
        logger.error("invitaatuscompaseliminar error - %s", exc)
        return jsonify(success=False, mensaje=str(exc)), 500

    
# ── Esto de abajo trabaja con el home e inicio.html ────────────────────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return send_from_directory(".", "inicio.html")

@app.route("/<path:filename>")
def serve_file(filename):
    return send_from_directory(".", filename)

# ── Esto de abajo trabaja con la api de health ────────────────────────────────────────────────────────────────────────────────
@app.route("/health")
def health():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({"status": "ok", "db": "conectado"})
    except Exception as e:
        return jsonify({"status": "error", "detalle": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
    