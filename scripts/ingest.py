# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27", "python-dotenv>=1.0"]
# ///
"""Ingesta de páginas oficiales de trámites de la CDMX a la tabla `docs`.

Uso:
  uv run scripts/ingest.py --discover   # busca URLs y escribe scripts/urls.json para revisarlo
  uv run scripts/ingest.py --ingest     # rastrea las URLs de urls.json, divide, genera embeddings y carga

Lee GEMINI_API_KEY, FIRECRAWL_API_KEY, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
URLS_FILE = ROOT / "scripts" / "urls.json"
CACHE_DIR = ROOT / "scripts" / ".cache"

FIRECRAWL = "https://api.firecrawl.dev/v2"
GEMINI = "https://generativelanguage.googleapis.com/v1beta"
EMBED_MODEL = "gemini-embedding-2"
EMBED_DIMS = 768

TRAMITES: dict[str, str] = {
    "licencia_a": "renovación licencia de conducir tipo A",
    "verificacion": "verificación vehicular",
    "predial": "pago impuesto predial",
    "tenencia": "tenencia refrendo vehicular pago",
    "acta_nacimiento": "copia certificada acta de nacimiento",
    "llave_cdmx": "Llave CDMX registro cuenta",
    "tarjeta_circulacion": "tarjeta de circulación",
    "no_antecedentes": "constancia de no antecedentes penales",
}
MAX_URLS = 4
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Falta {name} en .env")
    return value


def is_cdmx(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "cdmx.gob.mx" or host.endswith(".cdmx.gob.mx")


# --- Descubrimiento -----------------------------------------------------------


def discover(client: httpx.Client) -> None:
    headers = {"Authorization": f"Bearer {env('FIRECRAWL_API_KEY')}"}
    result: dict[str, list[dict]] = {}

    for tramite, terms in TRAMITES.items():
        found: dict[str, dict] = {}

        search = client.post(
            f"{FIRECRAWL}/search",
            headers=headers,
            json={"query": f"site:cdmx.gob.mx {terms}", "limit": 10, "country": "MX"},
        )
        search.raise_for_status()
        for item in search.json().get("data", {}).get("web", []):
            if is_cdmx(item["url"]):
                found.setdefault(item["url"], {"titulo": item.get("title", ""), "origen": "search"})

        site_map = client.post(
            f"{FIRECRAWL}/map",
            headers=headers,
            json={"url": "https://tramites.cdmx.gob.mx", "search": terms, "limit": 5},
        )
        site_map.raise_for_status()
        for link in site_map.json().get("links", []):
            if is_cdmx(link["url"]):
                found.setdefault(link["url"], {"titulo": link.get("title", ""), "origen": "map"})

        result[tramite] = [
            {"url": url, "dominio": urlparse(url).hostname, **meta}
            for url, meta in list(found.items())[:MAX_URLS]
        ]
        print(f"{tramite}: {len(result[tramite])} URLs")
        for entry in result[tramite]:
            print(f"   {entry['url']}  ({entry['titulo'][:60]})")

    URLS_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"\nEscrito {URLS_FILE.relative_to(ROOT)}. Revísalo y borra lo que no sirva antes de --ingest.")


# --- Rastreo y fragmentación --------------------------------------------------


def scrape(client: httpx.Client, url: str) -> dict | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / f"{hashlib.sha1(url.encode()).hexdigest()}.json"
    if cached.exists():
        return json.loads(cached.read_text())

    response = client.post(
        f"{FIRECRAWL}/scrape",
        headers={"Authorization": f"Bearer {env('FIRECRAWL_API_KEY')}"},
        json={"url": url, "formats": ["markdown"], "onlyMainContent": True, "timeout": 90000},
        timeout=120,
    )
    if response.status_code != 200:
        print(f"   ✗ scrape {response.status_code}: {url}")
        return None
    data = response.json().get("data", {})
    title = data.get("metadata", {}).get("title") or ""
    page = {"markdown": data.get("markdown") or "", "titulo": title[0] if isinstance(title, list) else title}
    cached.write_text(json.dumps(page, ensure_ascii=False))
    return page


def clean(markdown: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", markdown)  # imágenes
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)  # ligas → solo texto
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def chunk(text: str) -> list[str]:
    sections = re.split(r"\n(?=#{1,3} )", text)
    pieces: list[str] = []
    for section in sections:
        if len(section) <= CHUNK_SIZE:
            pieces.append(section)
            continue
        start = 0
        while start < len(section):
            end = min(start + CHUNK_SIZE, len(section))
            if end < len(section):
                cut = section.rfind("\n", start + CHUNK_SIZE // 2, end)
                end = cut if cut > 0 else end
            pieces.append(section[start:end])
            if end == len(section):
                break
            start = max(end - CHUNK_OVERLAP, start + 1)

    # Junta secciones pequeñas consecutivas hasta CHUNK_SIZE.
    chunks: list[str] = []
    for piece in (p.strip() for p in pieces):
        if not piece:
            continue
        if chunks and len(chunks[-1]) + len(piece) + 2 <= CHUNK_SIZE:
            chunks[-1] += "\n\n" + piece
        else:
            chunks.append(piece)
    return [c for c in chunks if len(c) >= 80]


# --- Embeddings y carga -------------------------------------------------------


def embed(client: httpx.Client, rows: list[dict]) -> None:
    key = env("GEMINI_API_KEY")
    for i in range(0, len(rows), 50):
        batch = rows[i : i + 50]
        response = client.post(
            f"{GEMINI}/models/{EMBED_MODEL}:batchEmbedContents",
            headers={"x-goog-api-key": key},
            json={
                "requests": [
                    {
                        "model": f"models/{EMBED_MODEL}",
                        "content": {"parts": [{"text": f"title: {r['titulo']} | text: {r['contenido']}"}]},
                        "output_dimensionality": EMBED_DIMS,
                    }
                    for r in batch
                ]
            },
            timeout=120,
        )
        if response.status_code != 200:
            print(f"   ⚠ embeddings fallaron ({response.status_code}): se cargan sin embedding. {response.text[:200]}")
            continue
        for row, embedding in zip(batch, response.json()["embeddings"]):
            row["embedding"] = embedding["values"]


def load(client: httpx.Client, url: str, rows: list[dict]) -> None:
    base = env("SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    # Reemplaza los fragmentos previos de esta URL para que una página más corta no deje sobrantes.
    client.delete(f"{base}/rest/v1/docs", headers=headers, params={"url": f"eq.{url}"}).raise_for_status()
    response = client.post(f"{base}/rest/v1/docs", headers={**headers, "Prefer": "return=minimal"}, json=rows)
    if response.status_code >= 300:
        sys.exit(f"Error al cargar {url}: {response.status_code} {response.text[:300]}")


def ingest(client: httpx.Client) -> None:
    if not URLS_FILE.exists():
        sys.exit("No existe scripts/urls.json: corre primero --discover")
    urls: dict[str, list[dict]] = json.loads(URLS_FILE.read_text())
    total = 0

    for tramite, entries in urls.items():
        print(f"{tramite}:")
        for entry in entries:
            url = entry["url"]
            if not is_cdmx(url):
                print(f"   ✗ fuera de cdmx.gob.mx, se omite: {url}")
                continue
            page = scrape(client, url)
            if not page:
                continue
            titulo = (page["titulo"] or entry.get("titulo") or tramite).strip()
            pieces = chunk(clean(page["markdown"]))
            if not pieces:
                print(f"   ✗ sin contenido: {url}")
                continue
            rows = [
                {"tramite": tramite, "titulo": titulo, "url": url, "chunk_index": i, "contenido": text}
                for i, text in enumerate(pieces)
            ]
            embed(client, rows)
            load(client, url, rows)
            with_embedding = sum(1 for r in rows if "embedding" in r)
            print(f"   ✓ {len(rows)} fragmentos ({with_embedding} con embedding): {url}")
            total += len(rows)

    print(f"\nListo: {total} fragmentos cargados.")


def main() -> None:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--discover", action="store_true", help="busca URLs y escribe scripts/urls.json")
    mode.add_argument("--ingest", action="store_true", help="rastrea urls.json y carga a docs")
    args = parser.parse_args()

    with httpx.Client(timeout=60) as client:
        discover(client) if args.discover else ingest(client)


if __name__ == "__main__":
    main()
