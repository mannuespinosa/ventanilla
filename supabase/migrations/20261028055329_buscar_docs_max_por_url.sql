-- Máximo 2 fragmentos por URL después del RRF, para que una página enorme
-- (p. ej. sedema) no tape a las fichas oficiales. El tope va solo después de
-- fusionar (si se topa cada lista, los mejores fragmentos de una URL difieren
-- entre listas y ninguno suma ambos puntajes). Las listas crecen a
-- match_count * 40 para que, tras el tope, sigan saliendo match_count.
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
    limit match_count * 40
  ),
  -- "+ 0" evita el índice HNSW, que devuelve como máximo hnsw.ef_search (40)
  -- vecinos y no se puede subir aquí. Con cientos de filas la búsqueda exacta
  -- cuesta poco.
  semantic as (
    select d.id, row_number() over (order by (d.embedding <=> query_embedding) + 0) as rank_ix
    from docs d
    where query_embedding is not null and d.embedding is not null
    order by (d.embedding <=> query_embedding) + 0
    limit match_count * 40
  ),
  fused as (
    select d.id, d.tramite, d.titulo, d.url, d.contenido,
           coalesce(1.0 / (60 + ft.rank_ix), 0.0) + coalesce(1.0 / (60 + s.rank_ix), 0.0) as score
    from full_text ft
    full outer join semantic s on ft.id = s.id
    join docs d on d.id = coalesce(ft.id, s.id)
  ),
  capped as (
    select f.*, row_number() over (partition by f.url order by f.score desc) as url_rank
    from fused f
  )
  select c.id, c.tramite, c.titulo, c.url, c.contenido, c.score
  from capped c
  where c.url_rank <= 2
  order by c.score desc
  limit match_count;
$$;
