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

        conn.commit()

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
WHATSAPP_GRUPO_URL = "https://chat.whatsapp.com/JKFSN3hDRBA91iy9T7GLPh"
JORNADA_ACTUAL = "Jornada 1"
PARTIDOS = [
    {
        "id": 1,
        "local": "Necaxa", "localLogo": "/logos/necaxa.png",
        "visitante": "Atlante", "visitanteLogo": "/logos/atlante.png",
        "horario": "Jueves 16 de julio 7:00 pm",
        "televisora": "TV Azteca",
        "televisionLogo": "/logos/tv-azteca.png",
        "kickoff": "2026-07-16T19:00:00-06:00",
    },
    {
        "id": 2,
        "local": "Tijuana", "localLogo": "/logos/tijuana.png",
        "visitante": "Tigres", "visitanteLogo": "/logos/tigres.png",
        "horario": "Jueves 16 de julio 9:00 pm",
        "televisora": "TV Azteca",
        "televisionLogo": "/logos/fox-sports.png",
        "kickoff": "2026-07-16T21:00:00-06:00",
    },
    {
        "id": 3,
        "local": "San Luis", "localLogo": "/logos/san-luis.png",
        "visitante": "Cruz Azul", "visitanteLogo": "/logos/cruz-azul.png",
        "horario": "Viernes 17 de julio 7:00 pm",
        "televisora": "FOX Sports",
        "televisionLogo": "/logos/espn.png",
        "kickoff": "2026-07-17T19:00:00-06:00",
    },
    {
        "id": 4,
        "local": "León", "localLogo": "/logos/leon.png",
        "visitante": "Atlas", "visitanteLogo": "/logos/atlas.png",
        "horario": "Viernes 17 de julio 7:00 pm",
        "televisora": "FOX Sports / ViX",
        "televisionLogo": "/logos/vix.png",
        "kickoff": "2026-07-17T19:00:00-06:00",
    },
    {
        "id": 5,
        "local": "FC Juárez", "localLogo": "/logos/juarez.png",
        "visitante": "Puebla", "visitanteLogo": "/logos/puebla.png",
        "horario": "Viernes 17 de julio 9:00 pm",
        "televisora": "TV Azteca",
        "televisionLogo": "/logos/tv-azteca.png",
        "kickoff": "2026-07-17T21:00:00-06:00",
    },
    {
        "id": 6,
        "local": "Pumas", "localLogo": "/logos/pumas.png",
        "visitante": "Pachuca", "visitanteLogo": "/logos/pachuca.png",
        "horario": "Sábado 18 de julio 5:00 pm",
        "televisora": "Canal 5 / TUDN / ViX",
        "televisionLogo": "/logos/canal-5.png",
        "kickoff": "2026-07-18T17:00:00-06:00",
    },
    {
        "id": 7,
        "local": "Monterrey", "localLogo": "/logos/monterrey.png",
        "visitante": "Santos", "visitanteLogo": "/logos/santos.png",
        "horario": "Sábado 18 de julio 7:00 pm",
        "televisora": "Canal 5 / TUDN / ViX",
        "televisionLogo": "/logos/canal-5.png",
        "kickoff": "2026-07-18T19:00:00-06:00",
    },
    {
        "id": 8,
        "local": "Chivas", "localLogo": "/logos/chivas.png",
        "visitante": "Toluca", "visitanteLogo": "/logos/toluca.png",
        "horario": "Sábado 18 de julio 7:07 pm",
        "televisora": "Amazon Prime Video / Chivas TV",
        "televisionLogo": "/logos/amazon-prime.png",
        "kickoff": "2026-07-18T19:07:00-06:00",
    },
    {
        "id": 9,
        "local": "Querétaro", "localLogo": "/logos/queretaro.png",
        "visitante": "América", "visitanteLogo": "/logos/america.png",
        "horario": "Sábado 18 de julio 9:00 pm",
        "televisora": "TV Azteca",
        "televisionLogo": "/logos/tv-azteca.png",
        "kickoff": "2026-07-18T21:00:00-06:00",
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
    return jsonify({
        "jornadaActual": JORNADA_ACTUAL,
        "partidos": PARTIDOS,
        "maxDobles": MAX_DOBLES,
        "maxTriples": MAX_TRIPLES,
        "whatsappUrl": WHATSAPP_GRUPO_URL
    })

# ── Esto de abajo trabaja en el direccionario de pins de los vendedores────────────────────────────────────────────────────────────────────────────────
VENDEDOR_PIN = {
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
    "Ever":         "1821",
    "Fer":          "1111",
    "Figueroa":     "1378",
    "Gera":         "2115",
    "GioSoto":      "1788",
    "Guerrero":     "1187",
    "Javier Garcia": "2014",
    "Jose Luis":    "1682",
    "Juan de Dios": "1083",
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
    "Alexander":    "5218287683709",
    "Alfonso":      "5218186589145",
    "Azael":        "5218120708453",
    "Boosters":     "5218121942047",
    "Caro":         "5215584076984",
    "Checo":        "5218281186921",
    "Choneke":      "5218138834830",
    "Dani":         "5218282942378",
    "Del Angel":    "5218117456805",
    "El Piojo":     "5218118004801",
    "Energeticos":  "5218281432464",
    "Ever":         "5218117299742",
    "Fer":          "5218281317783",
    "Figueroa":     "5218334077675",
    "Gera":         "5218182523537",
    "GioSoto":      "5218116911526",
    "Guerrero":     "5217206346990",
    "Javier Garcia": "5218281148922",
    "Jose Luis":    "5218113153788",
    "Juanillo":     "5218136984024",
    "Kany":         "5218281007191",
    "Manu":         "5213111359115",
    "Marchan":      "5218281007640",
    "Mazatan":      "5218136280437",
    "Memo":         "5218284577005",
    "Pantoja":      "5218117027387",
    "Patty":        "5218281016489",
    "PolloGol":     "5218125728071",
    "Piny":         "5218282941357",
    "Ranita":       "5218281432398",
    "Rolando":      "5214891009110",
    "Taliban":      "5218287685754",
    "•":            "5218281011650",
}
# ── Esto de abajo trabaja en los links de cada vendedor────────────────────────────────────────────────────────────────────────────────
VENDEDOR_LINKS = {
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
    "Ever":         "https://www.quinielaselwero.com/?vendedor=Ever",
    "Fer":          "https://www.quinielaselwero.com/?vendedor=Fer",
    "Figueroa":     "https://www.quinielaselwero.com/?vendedor=Figueroa",
    "Gera":         "https://www.quinielaselwero.com/?vendedor=Gera",
    "GioSoto":      "https://www.quinielaselwero.com/?vendedor=GioSoto",
    "Guerrero":     "https://www.quinielaselwero.com/?vendedor=Guerrero",
    "Javier Garcia": "https://www.quinielaselwero.com/?vendedor=Javier+Garcia",
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
    "Alfonso":        (1,    60),
    "•":              (61,   70),
    "Choneke":        (71,   100),
    "Rifa":           (101,  200),
    "Azael":          (201,  250),
    "Checo":          (251,  390),
    "Dani":           (401,  450),
    "El Piojo":       (451,  490),
    "Taliban":        (501,  720),
    "Guerrero":       (726,  750),
    "Fer":            (751,  790),
    "Figueroa":       (801,  850),
    "Del Angel":      (851,  910),
    "PolloGol":       (916,  950),
    "Marchan":        (951,  990),
    "Patty":          (1001, 1400),
    "Manu":           (1401, 1460),
    "Pantoja":        (1471, 1500),
    "Rolando":        (1501, 1640),
    "Ranita":         (1651, 1710),
    "Gera":           (1716, 1750),
    "Mazatan":        (1751, 1785),
    "Boosters":       (1801, 1835),
    "Alexander":      (1851, 1940),
    "GioSoto":        (1951, 2010),
    "Juanillo":       (2021, 2050),
    "Energeticos":    (2051, 2110),
    "Jose Luis":      (2116, 2150),
    "Memo":           (2151, 2240),
    "Tienda":         (2251, 2255),
    "Piny":           (2256, 2260),
    "Dinamica":       (2261, 2265),
    "Vender 1":       (2266, 2315),
    "Kany":           (2401, 2430),
    "Ever":           (2451, 2480),
    "Caro":           (2501, 2525),
}
# ── Ligas en total ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
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
    # ── Liga Mx──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "América":     ("América",                  "liga_mx"),
    "Atlas":       ("Atlas",                    "liga_mx"),
    "Chivas":      ("Guadalajara",              "liga_mx"),
    "Cruz Azul":   ("Cruz Azul",                "liga_mx"),
    "Juárez":      ("FC Juarez",                "liga_mx"),
    "León":        ("Leon",                     "liga_mx"),
    "Mazatlán":    ("Mazatlan FC",              "liga_mx"),
    "Monterrey":   ("Monterrey",                "liga_mx"),
    "Necaxa":      ("Necaxa",                   "liga_mx"),
    "Pachuca":     ("Pachuca",                  "liga_mx"),
    "Puebla":      ("Puebla FC",                "liga_mx"),
    "Pumas":       ("Pumas UNAM",               "liga_mx"),
    "Querétaro":   ("Queretaro FC",             "liga_mx"),
    "San Luis":    ("Atletico San Luis",        "liga_mx"),
    "Santos":      ("Santos Laguna",            "liga_mx"),
    "Tigres":      ("Tigres UANL",              "liga_mx"),
    "Tijuana":     ("Club Tijuana",             "liga_mx"),
    "Toluca":      ("Toluca",                   "liga_mx"),
    # ──Premier League──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Arsenal":     ("Arsenal",                  "premier"),
    "Aston Villa": ("Aston Villa",              "premier"),
    "Brighton":    ("Brighton & Hove Albion",   "premier"),
    "Chelsea":     ("Chelsea",                  "premier"),
    "Crystal":     ("Crystal Palace",           "premier"),
    "Everton":     ("Everton",                  "premier"),
    "Fulham":      ("Fulham",                   "premier"),
    "Leeds":       ("Leeds United",             "premier"),
    "Liverpool":   ("Liverpool",                "premier"),
    "Man City":    ("Manchester City",          "premier"),
    "Man Utd":     ("Manchester United",        "premier"),
    "Newcastle":   ("Newcastle United",         "premier"),
    "Forest":      ("Nottingham Forest",        "premier"),
    "Tottenham":   ("Tottenham Hotspur",        "premier"),
    "West Ham":    ("West Ham United",          "premier"),
    "Wolves":      ("Wolverhampton Wanderers",  "premier"),
    # ──La Liga──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Athletic":    ("Athletic Club",            "la_liga"),
    "Atlético":    ("Atletico de Madrid",       "la_liga"),
    "Barcelona":   ("Barcelona",                "la_liga"),
    "Betis":       ("Real Betis",               "la_liga"),
    "Espanyol":    ("Espanyol",                 "la_liga"),
    "Real M":      ("Real Madrid",              "la_liga"),
    "Sevilla":     ("Sevilla",                  "la_liga"),
    "Sociedad":    ("Real Sociedad",            "la_liga"),
    "Valencia":    ("Valencia",                 "la_liga"),
    "Villarreal":  ("Villarreal",               "la_liga"),
    # ──La Bundesliga───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Bayern":      ("Bayern Munich",            "bundesliga"),
    "Dortmund":    ("Borussia Dortmund",        "bundesliga"),
    "Frankfurt":   ("Eintracht Frankfurt",      "bundesliga"),
    "Leipzig":     ("RB Leipzig",               "bundesliga"),
    "Leverkusen":  ("Bayer Leverkusen",         "bundesliga"),
    # ──Serie A─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Inter":       ("Inter Milan",              "serie_a"),
    "Juventus":    ("Juventus",                 "serie_a"),
    "Lazio":       ("Lazio",                    "serie_a"),
    "Milan":       ("AC Milan",                 "serie_a"),
    "Napoli":      ("Napoli",                   "serie_a"),
    "Roma":        ("AS Roma",                  "serie_a"),
    # ──La Ligue 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Marsella":    ("Marseille",                "ligue_1"),
    "Monaco":      ("Monaco",                   "ligue_1"),
    "PSG":         ("Paris Saint-Germain",      "ligue_1"),
    # ──Mundial ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Alemania":      ("Germany",                "mundial"),
    "Arabia":        ("Saudi Arabia",           "mundial"),
    "Argelia":       ("Algeria",                "mundial"),
    "Argentina":     ("Argentina",              "mundial"),
    "Austria":       ("Austria",                "mundial"),
    "Australia":     ("Australia",              "mundial"),
    "Belgica":       ("Belgium",                "mundial"),
    "Bosnia":        ("Bosnia-Herzegovina",     "mundial"),
    "Brasil":        ("Brazil",                 "mundial"),
    "Cabo Verde":    ("Cape Verde",             "mundial"),
    "Chequia":       ("Czechia",                "mundial"),
    "Colombia":      ("Colombia",               "mundial"),
    "Congo":         ("Congo DR",               "mundial"),
    "Corea Sur":     ("South Korea",            "mundial"),
    "Costa Marfil":  ("Ivory Coast",            "mundial"),
    "Croacia":       ("Croatia",                "mundial"),
    "Curazao":       ("Curaçao",                "mundial"),
    "Ecuador":       ("Ecuador",                "mundial"),
    "Escocia":       ("Scotland",               "mundial"),
    "España":        ("Spain",                  "mundial"),
    "Eua":           ("United States",          "mundial"),
    "Francia":       ("France",                 "mundial"),
    "Ghana":         ("Ghana",                  "mundial"),
    "Inglaterra":    ("England",                "mundial"),
    "Iran":          ("Iran",                   "mundial"),
    "Japon":         ("Japan",                  "mundial"),
    "Marruecos":     ("Morocco",                "mundial"),
    "Mexico":        ("Mexico",                 "mundial"),
    "Noruega":       ("Norway",                 "mundial"),
    "Paises Bajos":  ("Netherlands",            "mundial"),
    "Paraguay":      ("Paraguay",               "mundial"),
    "Portugal":      ("Portugal",               "mundial"),
    "Senegal":       ("Senegal",                "mundial"),
    "Sudafrica":     ("South Africa",           "mundial"),
    "Suecia":        ("Sweden",                 "mundial"),
    "Suiza":         ("Switzerland",            "mundial"),
    "Tunez":         ("Tunisia",                "mundial"),
    "Turquia":       ("Türkiye",                "mundial"),
    "Uruguay":       ("Uruguay",                "mundial"),
}

def _normalizar_nombre(nombre):
    nombre = (nombre or "").strip().lower()
    nombre = unicodedata.normalize("NFD", nombre)
    return "".join(c for c in nombre if unicodedata.category(c) != "Mn")

def _parsear_eventos_espn(data, local_lookup, ids_listos):
    encontrados = []
    for ev in (data.get("events") or []):
        for comp in (ev.get("competitions") or []):
            state = comp.get("status", {}).get("type", {}).get("state", "")
            if state != "post":
                continue
            home_name = home_score = away_score = None
            for team in (comp.get("competitors") or []):
                nombre_raw = (team.get("team", {}).get("displayName") or "")
                nombre = _normalizar_nombre(nombre_raw)
                score = team.get("score")
                if team.get("homeAway") == "home":
                    home_name = nombre
                    home_score = score
                else:
                    away_score = score
            if home_name is None or home_score is None or away_score is None:
                continue
            pid = local_lookup.get(home_name)
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
    for p in PARTIDOS:
        ko_str = p.get("kickoff")
        if not ko_str:
            continue
        try:
            ko_dt = datetime.fromisoformat(ko_str)
        except ValueError:
            logger.warning("kickoff invalido para partido_id=%s -> %s", p["id"], ko_str)
            continue
        ko_dt = ko_dt.astimezone(timezone.utc) if ko_dt.tzinfo else ko_dt.replace(tzinfo=timezone.utc)
        kickoff_por_id[p["id"]] = ko_dt
    local_lookup = {}
    liga_fecha_ids = {}
    for p in PARTIDOS:
        pid = p["id"]
        entry = NOMBRE_A_ESPN.get(p["local"])
        if pid not in kickoff_por_id:
            continue
        fecha = kickoff_por_id[pid].strftime("%Y%m%d")
        if entry:
            espn_nombre, liga_key = entry
            local_lookup[_normalizar_nombre(espn_nombre)] = pid
            liga_fecha_ids.setdefault((liga_key, fecha), []).append(pid)
        else:
            local_lookup[_normalizar_nombre(p["local"])] = pid
            logger.warning("'%s' no esta en NOMBRE_A_ESPN, usando nombre directo", p["local"])
    return kickoff_por_id, local_lookup, liga_fecha_ids

# ── Consultas a resultadosdelajornada usando las columnas nuevas: "partidos" y "resultados"  ───────────────────────────────────────────────────
def _get_ids_con_resultado(jornada, ids):
    if not ids:
        return set()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT "partidos" FROM resultadosdelajornada WHERE "resultados"=%s AND "partidos" = ANY(%s)''',
                (jornada, list(ids)),
            )
            return {r[0] for r in cur.fetchall()}
def _guardar_resultado(pid, gh, ga, res):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO resultadosdelajornada
                    ("partidos", "resultados", resultado, marcadorlocal, marcadorvisita)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT ("partidos", "resultados") DO UPDATE SET
                    resultado = EXCLUDED.resultado,
                    marcadorlocal = EXCLUDED.marcadorlocal,
                    marcadorvisita = EXCLUDED.marcadorvisita,
                    fechaactualizacion = NOW()
                ''',
                (pid, JORNADA_ACTUAL, res, gh, ga),
            )
        conn.commit()
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
            ids_listos = {
                pid for pid, ko in kickoff_por_id.items()
                if now >= ko + timedelta(minutes=105)
            }
            if not ids_listos:
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
                time.sleep(600)
                continue
            for (liga_key, fecha), pids in liga_fecha_ids.items():
                if not any(pid in ids_sin_resultado for pid in pids):
                    continue
                slug = LIGAS_ESPN.get(liga_key)
                if not slug:
                    continue
                url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard?dates={fecha}"
                try:
                    resp = requests.get(url, timeout=10)
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                except Exception as exc:
                    logger.warning("auto_sync: error de red liga=%s fecha=%s -> %s", liga_key, fecha, exc)
                    continue
                for pid, gh, ga, res in _parsear_eventos_espn(data, local_lookup, ids_sin_resultado):
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


        quinielas = []
        for row in filas:
            id_, folio, nombre, vendedor, p1, p2, p3, p4, p5, p6, p7, p8, p9, dispositivoid, llavemaestra = row
            quinielas.append({
                "id": id_,
                "folio": folio,
                "nombre": nombre,
                "vendedor": vendedor,
                "picks": [p1, p2, p3, p4, p5, p6, p7, p8, p9],
                "dispositivoid": dispositivoid,
                "llavemaestra": llavemaestra,
            })


        return jsonify({"quinielas": quinielas})
    except Exception as exc:
        logger.error("laapidelalistaoficial: error -> %s", exc)
        return jsonify({"quinielas": [], "error": str(exc)}), 500

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
        jugando = []
        for row in filas:
            id_, folio, nombre, p1, p2, p3, p4, p5, p6, p7, p8, p9 = row
            jugando.append({
                "id": id_,
                "folio": folio,
                "nombre": nombre,
                "vendedor": vendedor,
                "picks": [p1, p2, p3, p4, p5, p6, p7, p8, p9],
            })
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
                        COUNT(*) FILTER (WHERE estado IN ('No jugando', 'En espera', 'Rechazada')) AS pending,
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
                    "SELECT folio::int FROM todaslasquinielas WHERE vendedor = %s AND estado = 'Jugando' ORDER BY folio::int ASC FOR UPDATE",
                    (vendedor,),
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
                    SELECT id, llavemaestra, estado, folio, nombrequiniela, vendedor
                    FROM todaslasquinielas
                    WHERE dispositivoid = %s
                    """,
                    (dispositivoid,),
                )
                filas = cur.fetchall()
        quinielas = [
            {"id": id_, "llavemaestra": llave, "estado": estado, "folio": folio, "nombre": nombre, "vendedor": vendedor}
            for id_, llave, estado, folio, nombre, vendedor in filas
        ]
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
    

# ── Esto de abajo trabaja con archivo para importar de excel ────────────────────────────────────────────────────────────────────────────────
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
    