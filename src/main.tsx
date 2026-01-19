// CORREÇÃO CRÍTICA: Interceptar URLs antigas do Bolt ANTES de qualquer coisa
const CORRECT_SUPABASE_URL = 'https://zunuqaidxffuhwmvcwul.supabase.co';

if (typeof window !== 'undefined') {
  // INTERCEPTAR FETCH
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // CORRIGIR URL ANTIGA DO BOLT OU PROJETO ANTIGO
    if (url && (url.includes('qbtqjrcfseqcfmcqlngr') || url.includes('gbtqjrcfseqcfmcqlngr') || url.includes('jibpvpqgplmahjhswiza'))) {
      const correctedUrl = url.replace(/https?:\/\/[^/]+\.supabase\.co/g, CORRECT_SUPABASE_URL);
      console.warn('🔧 [MAIN-FETCH] Interceptor corrigiu URL antiga:', url.substring(0, 100), '→', correctedUrl.substring(0, 100));
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
  
  // INTERCEPTAR XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    
    xhr.open = function(method: string, url: string | URL, ...args: any[]) {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr && (urlStr.includes('qbtqjrcfseqcfmcqlngr') || urlStr.includes('gbtqjrcfseqcfmcqlngr'))) {
        const correctedUrl = urlStr.replace(/https?:\/\/[^/]+\.supabase\.co/g, CORRECT_SUPABASE_URL);
        console.warn('🔧 [MAIN-XHR] Interceptor corrigiu URL antiga:', urlStr.substring(0, 100), '→', correctedUrl.substring(0, 100));
        return originalOpen.call(this, method, correctedUrl, ...args);
      }
      return originalOpen.call(this, method, url, ...args);
    };
    
    return xhr;
  };
  
  console.log('✅ [MAIN] Interceptores de fetch e XMLHttpRequest instalados no início da aplicação');
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
