-- Adicionar suporte a TTS na config PJ
ALTER TABLE public.pj_clientes_config 
ADD COLUMN IF NOT EXISTS tts_ativo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tts_voz text DEFAULT 'roger';

-- Adicionar campo para áudio na fila de atendimento
ALTER TABLE public.fila_atendimento_pj 
ADD COLUMN IF NOT EXISTS audio_base64 text;

-- Ativar TTS para o cliente de teste
UPDATE public.pj_clientes_config 
SET tts_ativo = true, tts_voz = 'roger'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'expo@atombrasildigital.com');