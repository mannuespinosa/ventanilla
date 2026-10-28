# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27", "python-dotenv>=1.0"]
# ///
"""Compara modelos Gemma 4 en la función `ask`: latencia, respuesta y fuentes.

Uso:
  uv run scripts/bench.py [--out resultados.json]

Hace una llamada de calentamiento por modelo (no se mide) y luego alterna los
modelos en cada pregunta para no favorecer a ninguno.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"]
QUESTIONS = [
    "¿Cuánto cuesta renovar la licencia tipo A?",
    "¿Qué necesito para la verificación vehicular?",
    "¿Cuánto cuesta una copia certificada de acta de nacimiento?",
    "¿Cómo saco la constancia de no antecedentes penales?",
    "¿Cómo tramito mi pasaporte?",
]


def ask_url() -> str:
    if url := os.environ.get("VITE_ASK_URL"):
        return url
    return os.environ["SUPABASE_URL"].rstrip("/") + "/functions/v1/ask"


def call(client: httpx.Client, url: str, question: str, model: str) -> dict:
    start = time.perf_counter()
    response = client.post(url, json={"question": question, "model": model})
    seconds = time.perf_counter() - start
    body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    return {
        "pregunta": question,
        "modelo_pedido": model,
        "modelo_usado": response.headers.get("x-ventanilla-model"),
        "status": response.status_code,
        "segundos": round(seconds, 2),
        "answer": body.get("answer", ""),
        "sources": body.get("sources", []),
        "error": body.get("error"),
    }


def main() -> None:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, help="guarda los resultados en JSON")
    args = parser.parse_args()
    url = ask_url()

    with httpx.Client(timeout=120) as client:
        for model in MODELS:
            warm = call(client, url, "¿Qué es Llave CDMX?", model)
            print(f"calentamiento {model}: {warm['status']} en {warm['segundos']} s")

        results = []
        for i, question in enumerate(QUESTIONS):
            order = MODELS if i % 2 == 0 else MODELS[::-1]
            for model in order:
                result = call(client, url, question, model)
                results.append(result)
                fallback = " (¡respaldo!)" if result["modelo_usado"] not in (None, model) else ""
                print(f"\n[{model}{fallback}] {question}  →  {result['status']} en {result['segundos']} s")
                print(f"  {result['answer'] or result['error']}")
                for source in result["sources"]:
                    print(f"  · {source['titulo']} — {source['url']}")

    print("\nLatencia (s)")
    for model in MODELS:
        times = sorted(r["segundos"] for r in results if r["modelo_pedido"] == model)
        print(f"  {model}: mediana {times[len(times) // 2]}, mín {times[0]}, máx {times[-1]}")

    if args.out:
        args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
        print(f"\nResultados en {args.out}")


if __name__ == "__main__":
    main()
