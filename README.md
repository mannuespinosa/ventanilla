# Ventanilla

Asistente open source de trámites de la Ciudad de México. Preguntas algo como
"¿cuánto cuesta renovar la licencia tipo A?" y recibes una respuesta corta en
español, **siempre con la liga oficial de donde salió**. Si la respuesta no está
en las fuentes oficiales, lo dice. Nunca inventa requisitos ni costos.

Proyecto para Hacktoberfest México. Licencia [AGPL-3.0](LICENSE).

## Arquitectura

```
UI (TanStack Start, src/lib/ask.ts)
  │  POST {question}
  ▼
Edge function `ask` (supabase/functions/ask)
  ├─ embedding de la pregunta (gemini-embedding-2, 768 dims)
  ├─ buscar_docs(): búsqueda híbrida en Postgres
  │     pgvector (coseno) + full-text en español, fusionados con RRF
  │     (si el embedding falla, sigue funcionando solo con full-text)
  ├─ Gemma 4 vía Gemini API: responde SOLO con los fragmentos y cita [n]
  └─ el servidor arma `sources` con los fragmentos citados
  ▼
{answer, sources: [{titulo, url}]}
```

- **Fuentes:** páginas oficiales de `*.cdmx.gob.mx`, descubiertas y rastreadas
  con Firecrawl por `scripts/ingest.py`, divididas en fragmentos y guardadas en
  la tabla `docs`.
- **Citas a prueba de alucinaciones:** el modelo nunca escribe URLs. Solo cita
  números de fragmento y el servidor los convierte en ligas reales de la base.
  Si no cita nada o responde `NO_LO_SE`, `sources` va vacío y la UI muestra
  "No encontré una fuente oficial".
- **Embeddings:** se usa `gemini-embedding-2` (multilingüe, misma llave que
  Gemma). Preferíamos un modelo open-weight, pero el modelo nativo de Supabase
  Edge (`gte-small`) solo sirve para inglés, y correr un e5 multilingüe dentro
  de la edge function con transformers.js hace lento el arranque y choca con
  el límite de memoria. Es una decisión pragmática para la hackathon.

## Cómo correrlo

1. Copia `.env.example` a `.env` y llena las llaves. `.env` está en
   `.gitignore`: nunca lo subas.
2. Base de datos: aplica `supabase/migrations/*.sql` a tu proyecto de Supabase
   (SQL editor o `supabase db push`).
3. Ingesta (requiere [uv](https://docs.astral.sh/uv/)):
   ```sh
   uv run scripts/ingest.py --discover   # escribe scripts/urls.json para revisarlo
   uv run scripts/ingest.py --ingest     # rastrea, divide, genera embeddings y carga a `docs`
   ```
4. Edge function: define el secreto `GEMINI_API_KEY` en Supabase
   (Edge Functions → Secrets) y despliega `supabase/functions/ask`
   con `verify_jwt = false`.
5. Frontend: `npm i && npm run dev`. Para apuntar a otra función, usa `VITE_ASK_URL`.

> ⚠️ `ask` es pública (no pide JWT) para que el frontend no necesite llaves.
> Cualquiera puede gastar la cuota de Gemini. Es aceptable para una demo, no para producción.

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1a2b4e9b-007d-47b1-959a-111e78e3dbdc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
