/*
  Aggregate store ratings so the customer home feed does not download every review row.
*/

CREATE OR REPLACE VIEW public.store_ratings_public AS
SELECT
  store_id,
  ROUND(AVG(rating)::numeric, 1)::float8 AS avg_rating,
  COUNT(*)::int AS review_count
FROM public.reviews
WHERE store_id IS NOT NULL
GROUP BY store_id;

GRANT SELECT ON public.store_ratings_public TO anon, authenticated;
