UPDATE public.feature_flags
SET is_enabled = true,
    updated_at = now()
WHERE flag_key = 'tiktok_integration';