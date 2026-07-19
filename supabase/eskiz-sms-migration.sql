-- Eskiz SMS: OTP codes + rate limits (service-role only).
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.sms_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_otp_codes_phone_purpose_idx
  ON public.sms_otp_codes (phone, purpose, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.sms_rate_limit (
  client_key text PRIMARY KEY,
  hits bigint[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_sms_send_quota(
  p_client_key text,
  p_max_hits integer DEFAULT 3,
  p_window_seconds integer DEFAULT 900
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
      'retry_after_sec', p_window_seconds,
      'limit', p_max_hits
    );
  END IF;

  v_now := extract(epoch from now())::bigint;
  v_cutoff := v_now - p_window_seconds;

  SELECT hits
  INTO v_hits
  FROM public.sms_rate_limit
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

  INSERT INTO public.sms_rate_limit (client_key, hits, updated_at)
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

CREATE OR REPLACE FUNCTION public.store_sms_otp(
  p_phone text,
  p_purpose text,
  p_code_hash text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sms_otp_codes
  WHERE phone = p_phone
    AND purpose = p_purpose;

  INSERT INTO public.sms_otp_codes (phone, purpose, code_hash, expires_at)
  VALUES (
    p_phone,
    coalesce(nullif(trim(p_purpose), ''), 'login'),
    p_code_hash,
    now() + make_interval(secs => greatest(60, p_ttl_seconds))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_sms_otp(
  p_phone text,
  p_purpose text,
  p_code_hash text,
  p_max_attempts integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.sms_otp_codes%ROWTYPE;
BEGIN
  SELECT *
  INTO v_row
  FROM public.sms_otp_codes
  WHERE phone = p_phone
    AND purpose = coalesce(nullif(trim(p_purpose), ''), 'login')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'otp_not_found');
  END IF;

  IF v_row.expires_at < now() THEN
    DELETE FROM public.sms_otp_codes WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'otp_expired');
  END IF;

  IF v_row.attempts >= p_max_attempts THEN
    DELETE FROM public.sms_otp_codes WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'otp_locked');
  END IF;

  IF v_row.code_hash <> p_code_hash THEN
    UPDATE public.sms_otp_codes
    SET attempts = attempts + 1
    WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'otp_invalid');
  END IF;

  DELETE FROM public.sms_otp_codes WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_sms_send_quota(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_sms_otp(text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_sms_otp(text, text, text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_sms_send_quota(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_sms_otp(text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_sms_otp(text, text, text, integer) TO service_role;
