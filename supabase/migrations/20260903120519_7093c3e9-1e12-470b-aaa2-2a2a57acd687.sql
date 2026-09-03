REVOKE ALL ON FUNCTION public.video_motion_destravar_fila() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.video_motion_destravar_fila() FROM anon;
REVOKE ALL ON FUNCTION public.video_motion_destravar_fila() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.video_motion_destravar_fila() TO service_role;