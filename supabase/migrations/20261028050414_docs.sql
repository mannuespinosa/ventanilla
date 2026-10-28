-- Fragmentos de páginas oficiales de trámites de la CDMX + búsqueda híbrida.

create extension if not exists vector with schema extensions;

create table public.docs (
  id bigint generated always as identity primary key,
  tramite text not null,
  titulo text not null,
  url text not null,
  chunk_index int not null default 0,
  contenido text not null,
  -- Nullable: si los embeddings fallan, el full-text sigue funcionando.
  embedding extensions.vector(768),
  fts tsvector generated always as (to_tsvector('spanish', titulo || ' ' || contenido)) stored,
  created_at timestamptz not null default now(),
  unique (url, chunk_index)
);

create index docs_embedding_idx on public.docs using hnsw (embedding extensions.vector_cosine_ops);
create index docs_fts_idx on public.docs using gin (fts);
create index docs_tramite_idx on public.docs (tramite);

-- Sin políticas públicas: solo service_role (edge function e ingesta) lee y escribe.
alter table public.docs enable row level security;

-- Búsqueda híbrida con Reciprocal Rank Fusion (k = 60).
-- El full-text usa OR entre los lexemas de la pregunta para no exigir que
-- aparezcan todas las palabras. Si query_embedding es null, solo full-text.
create or replace function public.buscar_docs(
  query_text text,
  query_embedding extensions.vector(768) default null,
  match_count int default 5
)
returns table (id bigint, tramite text, titulo text, url text, contenido text, score double precision)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select to_tsquery(
      'spanish',
      coalesce(
        (select string_agg(quote_literal(lexeme), ' | ')
           from unnest(tsvector_to_array(to_tsvector('spanish', query_text))) as lexeme),
        ''
      )
    ) as tsq
  ),
  full_text as (
    select d.id, row_number() over (order by ts_rank_cd(d.fts, q.tsq) desc) as rank_ix
    from docs d, q
    where d.fts @@ q.tsq
    order by rank_ix
    limit match_count * 4
  ),
  semantic as (
    select d.id, row_number() over (order by d.embedding <=> query_embedding) as rank_ix
    from docs d
    where query_embedding is not null and d.embedding is not null
    order by d.embedding <=> query_embedding
    limit match_count * 4
  )
  select d.id, d.tramite, d.titulo, d.url, d.contenido,
         coalesce(1.0 / (60 + ft.rank_ix), 0.0) + coalesce(1.0 / (60 + s.rank_ix), 0.0) as score
  from full_text ft
  full outer join semantic s on ft.id = s.id
  join docs d on d.id = coalesce(ft.id, s.id)
  order by score desc
  limit match_count;
$$;

revoke execute on function public.buscar_docs(text, extensions.vector, int) from public, anon, authenticated;
grant execute on function public.buscar_docs(text, extensions.vector, int) to service_role;
