# Ventanilla

Asistente open source de trámites de la Ciudad de México. Preguntas algo como
"¿cuánto cuesta renovar la licencia tipo A?" y recibes una respuesta corta en
español, **siempre con la liga oficial de donde salió**. Si la respuesta no está
en las fuentes oficiales, lo dice. Nunca inventa requisitos ni costos.

Proyecto para Hacktoberfest México. Licencia [AGPL-3.0](LICENSE).

## Arquitectura

```
UI (TanStack Start, src/lib/ask.ts)
  │  POST {question, history: últimas 3 interacciones}
  ▼
Edge function `ask` (supabase/functions/ask)
  ├─ si hay historial: Gemma 4 26b reescribe la pregunta como independiente
  │     ("¿dónde puedo pagar?" → "¿Dónde pago la copia del acta de nacimiento?");
  │     va en el header x-ventanilla-query (URL-encoded) para depurar
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

Para comparar modelos: `uv run scripts/bench.py` corre preguntas de prueba contra
`gemma-4-31b-it` y `gemma-4-26b-a4b-it` y muestra latencia, respuesta y fuentes.

## Levanta tu propia Ventanilla

Ventanilla no está atada a la CDMX: cualquier ciudad o estado con portales
oficiales puede tener la suya.

1. **Haz fork y edita `ventanilla.config.json`.** `nombre` aparece en
   "Hola, {nombre}"; `subtitulo` y `ejemplos` (las preguntas que rotan en el
   buscador) son textos de la portada; `repo` es tu fork;
   `dominios_permitidos` limita las fuentes, por ejemplo `["jalisco.gob.mx"]`
   (se aceptan sus subdominios). En `voz` (en construcción) van el `voice_id` de ElevenLabs,
   un `voice_id_respaldo` y la `descripcion_voz` con la que se diseñó en
   Voice Design, para que puedas recrear una voz equivalente para tu ciudad.
   Los IDs de voz no son secretos; el único secreto de voz es
   `ELEVENLABS_API_KEY` y va en `.env`.
2. **Define tus trámites y descubre fuentes.** Cambia `TRAMITES` en
   `scripts/ingest.py` por los de tu ciudad, corre
   `uv run scripts/ingest.py --discover` y revisa a mano el archivo de
   `fuentes` (`scripts/urls.json`): borra apps, noticias viejas y duplicados.
3. **Crea tu backend.** En un proyecto nuevo de Supabase aplica
   `supabase/migrations/*.sql`, llena `.env`, corre
   `uv run scripts/ingest.py --ingest` y despliega `supabase/functions/ask`
   con el secreto `GEMINI_API_KEY`. Ajusta en el prompt de sistema de
   `ask/index.ts` el nombre de tu ciudad y qué fuente manda en costos.
4. **Publica el frontend.** Pon la URL de tu función en `VITE_ASK_URL`,
   corre `npm run build` y despliega donde quieras.

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
