# ── Esto de abajo trabaja con las importaciones para que nuestro archivo funcione correctamente ──────────────────────────────────────────────────────────────────────
import os
import threading
import time
import logging
import unicodedata
from datetime import datetime, timedelta, timezone
import requests
import psycopg
from flask import Flask, jsonify, send_from_directory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

app = Flask(__name__, static_folder='.', static_url_path='')

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no esta configurada en las variables de entorno de Railway")

def get_connection():
    return psycopg.connect(DATABASE_URL)

# ── Esto de abajo trabaja con la tabla de Todas las quinielas ──────────────────────────────────────────────────────────────────────────────────────────
def crear_tablas():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS todaslasquinielas (
            id SERIAL PRIMARY KEY,
            nombrecelular VARCHAR(100) NOT NULL,
            nombrequiniela VARCHAR(100) NOT NULL,
            vendedor VARCHAR(100) NOT NULL,
            jornada VARCHAR(100) NOT NULL,
            p1 CHAR(1) CHECK (p1 IN ('L','E','V')),
            p2 CHAR(1) CHECK (p2 IN ('L','E','V')),
            p3 CHAR(1) CHECK (p3 IN ('L','E','V')),
            p4 CHAR(1) CHECK (p4 IN ('L','E','V')),
            p5 CHAR(1) CHECK (p5 IN ('L','E','V')),
            p6 CHAR(1) CHECK (p6 IN ('L','E','V')),
            p7 CHAR(1) CHECK (p7 IN ('L','E','V')),
            p8 CHAR(1) CHECK (p8 IN ('L','E','V')),
            p9 CHAR(1) CHECK (p9 IN ('L','E','V')),
            estado VARCHAR(20) NOT NULL DEFAULT 'En espera'
                CHECK (estado IN ('No jugando','Jugando','En espera','Rechazada')),
            folio VARCHAR(20),
            llavemaestra VARCHAR(300) GENERATED ALWAYS AS (
                nombrecelular || '|' || jornada || '|' || nombrequiniela || '|' ||
                p1 || p2 || p3 || p4 || p5 || p6 || p7 || p8 || p9
            ) STORED UNIQUE,
            fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City'),

            CONSTRAINT folio_solo_si_jugando CHECK (
                (estado = 'Jugando' AND folio IS NOT NULL) OR
                (estado != 'Jugando' AND folio IS NULL)
            )
        );
    """)
# ── Esto de abajo trabaja con la tabla de la Api de Espn ───────────────────────────────────────────────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS 'resultadosdelajornada' (
            id SERIAL PRIMARY KEY,
            "Partidos" INTEGER NOT NULL,
            "Resultados" VARCHAR(100) NOT NULL,
            resultado CHAR(1) CHECK (resultado IN ('L','E','V')),
            marcador_local INTEGER,
            marcador_visita INTEGER,
            fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City'),
            UNIQUE (partidos,resultados)
        );
    """)

    conn.commit()
    cur.close()
    conn.close()
# ── Esto de abajo trabaja con la informacion de la Jornada ───────────────────────────────────────────────────────────────────────────────────────────────
JORNADA_ACTUAL = "Jornada 1"
PARTIDOS = [
    {
        "id": 1,
        "local": "Necaxa", "localLogo": "/logos/necaxa.png",
        "visitante": "Atlante", "visitanteLogo": "/logos/atlante.png",
        "horario": "Jueves 16 de julio 7:00 pm",
        "televisora": "TV Azteca",
        "televisionLogo": "/logos/azteca.png",
        "kickoff": "2026-07-16T19:00:00-06:00",
    },
    {
        "id": 2,
        "local": "Tijuana", "localLogo": "/logos/tijuana.png",
        "visitante": "Tigres", "visitanteLogo": "/logos/tigres.png",
        "horario": "Jueves 16 de julio 9:00 pm",
        "televisora": "TV Azteca",
        "televisionLogo": "/logos/azteca.png",
        "kickoff": "2026-07-16T21:00:00-06:00",
    },
    {
        "id": 3,
        "local": "San Luis", "localLogo": "/logos/san-luis.png",
        "visitante": "Cruz Azul", "visitanteLogo": "/logos/cruz-azul.png",
        "horario": "Viernes 17 de julio 7:00 pm",
        "televisora": "FOX Sports",
        "televisionLogo": "/logos/fox.png",
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
        "televisionLogo": "/logos/azteca.png",
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
        "televisionLogo": "/logos/prime.png",
        "kickoff": "2026-07-18T19:07:00-06:00",
    },
    {
        "id": 9,
        "local": "Querétaro", "localLogo": "/logos/queretaro.png",
        "visitante": "América", "visitanteLogo": "/logos/america.png",
        "horario": "Sábado 18 de julio 9:00 pm",
        "televisora": "TV Azteca",
        "televisionLogo": "/logos/azteca.png",
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
# ── Ligas en total ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────                                        
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
# ── Liga Mx ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── 
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
# ── Premier League ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Arsenal":        ("Arsenal",                  "premier"),
    "Aston Villa":    ("Aston Villa",              "premier"),
    "Brighton":       ("Brighton & Hove Albion",   "premier"),
    "Chelsea":        ("Chelsea",                  "premier"),
    "Crystal":        ("Crystal Palace",           "premier"),
    "Everton":        ("Everton",                  "premier"),
    "Fulham":         ("Fulham",                   "premier"),
    "Leeds":          ("Leeds United",             "premier"),
    "Liverpool":      ("Liverpool",                "premier"),
    "Man City":       ("Manchester City",          "premier"),
    "Man Utd":        ("Manchester United",        "premier"),
    "Newcastle":      ("Newcastle United",         "premier"),
    "Forest":         ("Nottingham Forest",        "premier"),
    "Tottenham":      ("Tottenham Hotspur",        "premier"),
    "West Ham":       ("West Ham United",          "premier"),
    "Wolves":         ("Wolverhampton Wanderers",  "premier"),
# ── La Liga ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    "Athletic":    ("Athletic Club",            "la_liga"),
    "Atlético":    ("Atletico de Madrid",       "la_liga"),
    "Barcelona":   ("Barcelona",                "la_liga"),
    "Betis":       ("Real Betis",               "la_liga"),
    "Espanyol":    ("Espanyol",                 "la_liga"),
    "Real M":     ("Real Madrid",              "la_liga"),
    "Sevilla":     ("Sevilla",                  "la_liga"),
    "Sociedad":    ("Real Sociedad",            "la_liga"),
    "Valencia":    ("Valencia",                 "la_liga"),
    "Villarreal":  ("Villarreal",               "la_liga"),
    # ── Bundesliga ───────────────────────────────────────────────────
    "Bayern":      ("Bayern Munich",            "bundesliga"),
    "Dortmund":    ("Borussia Dortmund",        "bundesliga"),
    "Frankfurt":   ("Eintracht Frankfurt",      "bundesliga"),
    "Leipzig":     ("RB Leipzig",               "bundesliga"),
    "Leverkusen":  ("Bayer Leverkusen",         "bundesliga"),
    # ── Serie A ──────────────────────────────────────────────────────
    "Inter":       ("Inter Milan",              "serie_a"),
    "Juventus":    ("Juventus",                 "serie_a"),
    "Lazio":       ("Lazio",                    "serie_a"),
    "Milan":       ("AC Milan",                 "serie_a"),
    "Napoli":      ("Napoli",                   "serie_a"),
    "Roma":        ("AS Roma",                  "serie_a"),
    # ── Ligue 1 ──────────────────────────────────────────────────────
    "Marsella":    ("Marseille",                "ligue_1"),
    "Monaco":      ("Monaco",                   "ligue_1"),
    "PSG":         ("Paris Saint-Germain",      "ligue_1"),
    # ── Selecciones Nacionales ───────────────────────────────────────
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
# ── Consultas a "resultadosdelajornada" usando las columnas nuevas: "partidos" y "resultados"  ─────────────────────────────────────────────────────── 
def _get_ids_con_resultado(jornada, ids):
    if not ids:
        return set()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT "Partidos" FROM "ResultadosdelaJornada" WHERE "Resultados"=%s AND "Partidos" = ANY(%s)''',
                (jornada, list(ids)),
            )
            return {r[0] for r in cur.fetchall()}

def _guardar_resultado(pid, gh, ga, res):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO resultadosdelajornada
                    ("Partidos", "Resultados", resultado, marcador_local, marcador_visita)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT ("Partidos", "Resultados") DO UPDATE SET
                    resultado = EXCLUDED.resultado,
                    marcador_local = EXCLUDED.marcador_local,
                    marcador_visita = EXCLUDED.marcador_visita,
                    fecha_actualizacion = NOW()
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
# ── Inicializacion al arrancar el servicior  ─────────────────────────────────────────────────────────────────────────────────────────────────────────── 
try:
    crear_tablas()
except Exception as exc:
    raise RuntimeError(f"No se pudieron crear las tablas: {exc}") from exc

iniciar_auto_sync()

@app.route('/')
def home():
    return send_from_directory('.', 'inicio.html')

@app.route('/<path:filename>')
def serve_file(filename):
    return send_from_directory('.', filename)

@app.route("/health")
def health():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({"status": "ok", "db": "conectado"})
    except Exception as e:
        return jsonify({"status": "error", "detalle": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)