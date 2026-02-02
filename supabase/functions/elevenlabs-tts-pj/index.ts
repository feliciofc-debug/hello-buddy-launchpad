// ============================================
// ELEVENLABS TTS PARA PJ - EDGE FUNCTION
// AMZ Ofertas - Gerar áudio de resposta via ElevenLabs
// Uso exclusivo para expo@atombrasildigital.com (teste)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vozes disponíveis - Roger é uma voz masculina brasileira natural
const VOICES = {
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  charlie: "IKne3meq5aSn9XLyUdCD",
  george: "JBFqnCBsd6RMkjVDRZzb",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  jessica: "cgSgspJ2msm6clMCkdW9",
  brian: "nPczCjzI2devNBz1zQrb",
  daniel: "onwK4e9ZLuTAKqWW03F9",
  lily: "pFZP5JQG7iQjIQuC4Bku"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
    if (!ELEVENLABS_API_KEY) {
      console.error("❌ [TTS-PJ] ELEVENLABS_API_KEY não configurada");
      return new Response(
        JSON.stringify({ success: false, error: "API Key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text, voice = "roger", returnBase64 = true } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Texto é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limitar texto a 5000 caracteres
    const textToConvert = text.slice(0, 5000);
    const voiceId = VOICES[voice as keyof typeof VOICES] || VOICES.roger;

    console.log(`🎤 [TTS-PJ] Gerando áudio para ${textToConvert.length} caracteres...`);
    console.log(`🎤 [TTS-PJ] Voz selecionada: ${voice} (${voiceId})`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textToConvert,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [TTS-PJ] Erro ElevenLabs ${response.status}:`, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ElevenLabs: ${response.status}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const characterCount = response.headers.get("x-character-count");
    
    console.log(`✅ [TTS-PJ] Áudio gerado! Tamanho: ${audioBuffer.byteLength} bytes`);
    console.log(`✅ [TTS-PJ] Caracteres usados: ${characterCount}`);

    if (returnBase64) {
      // Retornar como base64 para usar com WuzAPI
      const audioBase64 = base64Encode(audioBuffer);
      
      return new Response(
        JSON.stringify({
          success: true,
          audioBase64,
          mimeType: "audio/mpeg",
          size: audioBuffer.byteLength,
          charactersUsed: characterCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Retornar como stream de áudio
      return new Response(audioBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "X-Character-Count": characterCount || "0",
        },
      });
    }

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("💥 [TTS-PJ] Erro geral:", errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
