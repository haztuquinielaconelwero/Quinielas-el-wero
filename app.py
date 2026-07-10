"""                                Esto de abajo trabaja con las importaciones para que todo el servicion funcione correctamente                        """
import os
from flask import Flask, jsonify, send_from_directory
import psycopg

app = Flask(__name__, static_folder='.', static_url_path='')

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_connection():
    return psycopg.connect(DATABASE_URL)

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