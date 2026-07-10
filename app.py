"""
QUINIELAS EL WERO — app.py
Backend inicial en Flask. Conecta con PostgreSQL en Railway.
Objetivo de esta primera version: SOLO confirmar que el servicio
levanta correctamente y que la conexion a la base de datos funciona.
Endpoints de negocio (jornadas, participantes, etc.) se agregan despues.
"""

import os
from flask import Flask, jsonify
import psycopg2

app = Flask(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_connection():
    return psycopg2.connect(DATABASE_URL)


@app.route("/")
def home():
    return jsonify({"status": "ok", "mensaje": "Quinielas El Wero backend activo"})


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
