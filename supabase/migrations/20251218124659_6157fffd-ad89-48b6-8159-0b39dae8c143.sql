-- Fix linter WARN: Function Search Path Mutable
-- Add explicit search_path to functions that lack it.

CREATE OR REPLACE FUNCTION public.generate_slug_marketplace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.slug := lower(regexp_replace(NEW.titulo, '[^a-zA-Z0-9]+', '-', 'g'));
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_validacoes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
