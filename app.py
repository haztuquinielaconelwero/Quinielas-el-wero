"""                                Esto de abajo trabaja con las importaciones para que todo el servicion funcione correctamente                           """
import os
from flask import Flask, jsonify, send_from_directory
import psycopg

app = Flask(__name__, static_folder='.', static_url_path='')

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no esta configurada en las variables de entorno de Railway")

def get_connection():
    return psycopg.connect(DATABASE_URL)
"""                                Esto de abajo trabaja en generar las tablas para el servidor para que funcione correctamente                                   """
def crear_tablas():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS quinielas (
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
    conn.commit()
    cur.close()
    conn.close()
crear_tablas()

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