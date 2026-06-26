-- Rate limit for /api/photo-search (3 requests per 5 minutes per client key).
-- Run once in Supabase SQL Editor. Access is service-role only (RLS enabled, no policies).

CREATE TABLE IF NOT EXISTS public.photo_search_rate (
  client_key text PRIMARY KEY,
  hits bigint[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photo_search_rate ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_photo_search_quota(
  p_client_key text,
  p_max_hits integer DEFAULT 3,
  p_window_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now bigint;
  v_cutoff bigint;
  v_hits bigint[];
  v_count integer;
  v_oldest bigint;
  v_retry integer;
BEGIN
  IF coalesce(trim(p_client_key), '') = '' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_sec', 300,
      'limit', p_max_hits
    );
  END IF;

  v_now := extract(epoch from now())::bigint;
  v_cutoff := v_now - p_window_seconds;

  SELECT hits
  INTO v_hits
  FROM public.photo_search_rate
  WHERE client_key = p_client_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_hits := ARRAY[]::bigint[];
  END IF;

  SELECT coalesce(array_agg(h ORDER BY h), ARRAY[]::bigint[])
  INTO v_hits
  FROM unnest(v_hits) AS h
  WHERE h > v_cutoff;

  v_count := coalesce(array_length(v_hits, 1), 0);

  IF v_count >= p_max_hits THEN
    v_oldest := v_hits[1];
    v_retry := greatest(1, (v_oldest + p_window_seconds) - v_now);
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_sec', v_retry,
      'limit', p_max_hits
    );
  END IF;

  v_hits := v_hits || v_now;

  INSERT INTO public.photo_search_rate (client_key, hits, updated_at)
  VALUES (p_client_key, v_hits, now())
  ON CONFLICT (client_key) DO UPDATE
  SET hits = EXCLUDED.hits, updated_at = now();

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_max_hits - coalesce(array_length(v_hits, 1), 0)),
    'retry_after_sec', 0,
    'limit', p_max_hits
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_photo_search_quota(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_photo_search_quota(text, integer, integer) TO service_role;
