// CORREÇÃO CRÍTICA: Interceptar URLs antigas do Bolt ANTES de qualquer coisa
const CORRECT_SUPABASE_URL = 'https://jibpvpqgplmahjhswiza.supabase.co';

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // CORRIGIR URL ANTIGA DO BOLT
    if (url.includes('qbtqjrcfseqcfmcqlngr') || url.includes('gbtqjrcfseqcfmcqlngr')) {
      const correctedUrl = url.replace(/https?:\/\/[^/]+\.supabase\.co/g, CORRECT_SUPABASE_URL);
      console.warn('🔧 [MAIN] Interceptor corrigiu URL antiga:', url, '→', correctedUrl);
      url = correctedUrl;
      
      if (typeof input === 'string') {
        input = url;
      } else if (input instanceof URL) {
        input = new URL(url);
      } else {
        input = new Request(url, input);
      }
    }
    
    return originalFetch.call(this, input, init);
  };
  console.log('✅ [MAIN] Interceptor de fetch instalado no início da aplicação');
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
