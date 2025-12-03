import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Cookie, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: false
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    
    if (!consent) {
      setTimeout(() => setShowBanner(true), 2000);
    } else {
      const saved = JSON.parse(consent) as CookiePreferences;
      setPreferences(saved);
      applyConsent(saved);
    }
  }, []);

  const applyConsent = (prefs: CookiePreferences) => {
    if (prefs.analytics && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
    
    if (prefs.marketing && window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'granted'
      });
    }
  };

  const acceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    
    setPreferences(allAccepted);
    localStorage.setItem('cookie-consent', JSON.stringify(allAccepted));
    applyConsent(allAccepted);
    setShowBanner(false);
  };

  const rejectAll = () => {
    const onlyNecessary: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };
    
    setPreferences(onlyNecessary);
    localStorage.setItem('cookie-consent', JSON.stringify(onlyNecessary));
    applyConsent(onlyNecessary);
    setShowBanner(false);
  };

  const savePreferences = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    applyConsent(preferences);
    setShowSettings(false);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Banner Principal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom">
        <Card className="max-w-4xl mx-auto p-6 shadow-2xl border-2 bg-card">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Cookie className="w-8 h-8 text-orange-500" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">
                🍪 Este site usa cookies
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Usamos cookies para melhorar sua experiência, analisar o tráfego 
                e personalizar conteúdo. Ao clicar em &quot;Aceitar todos&quot;, você concorda 
                com nosso uso de cookies.
                {' '}
                <a 
                  href="/privacy" 
                  className="text-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Saiba mais
                </a>
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={acceptAll}
                  className="bg-primary"
                >
                  ✅ Aceitar Todos
                </Button>
                
                <Button 
                  onClick={rejectAll}
                  variant="outline"
                >
                  ❌ Rejeitar Todos
                </Button>
                
                <Button 
                  onClick={() => setShowSettings(true)}
                  variant="ghost"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Preferências
                </Button>
              </div>
            </div>
            
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowBanner(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Modal de Preferências */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>⚙️ Preferências de Cookies</DialogTitle>
            <DialogDescription>
              Gerencie suas preferências de cookies. Cookies necessários não podem 
              ser desativados pois são essenciais para o funcionamento do site.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  🔒 Cookies Necessários
                </h4>
                <p className="text-sm text-muted-foreground">
                  Essenciais para o funcionamento básico do site (login, segurança, 
                  preferências). Não podem ser desativados.
                </p>
              </div>
              <Switch 
                checked={true} 
                disabled 
              />
            </div>
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  📊 Cookies de Analytics
                </h4>
                <p className="text-sm text-muted-foreground">
                  Nos ajudam a entender como você usa o site para melhorar 
                  a experiência (Google Analytics, métricas de uso).
                </p>
              </div>
              <Switch 
                checked={preferences.analytics}
                onCheckedChange={(checked) => 
                  setPreferences({...preferences, analytics: checked})
                }
              />
            </div>
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  🎯 Cookies de Marketing
                </h4>
                <p className="text-sm text-muted-foreground">
                  Usados para mostrar anúncios relevantes e medir eficácia 
                  de campanhas (Google Ads, Facebook Pixel, remarketing).
                </p>
              </div>
              <Switch 
                checked={preferences.marketing}
                onCheckedChange={(checked) => 
                  setPreferences({...preferences, marketing: checked})
                }
              />
            </div>
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  ⚡ Cookies Funcionais
                </h4>
                <p className="text-sm text-muted-foreground">
                  Permitem funcionalidades extras como chat, vídeos 
                  incorporados e personalização.
                </p>
              </div>
              <Switch 
                checked={preferences.functional}
                onCheckedChange={(checked) => 
                  setPreferences({...preferences, functional: checked})
                }
              />
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowSettings(false)}
            >
              Cancelar
            </Button>
            <Button onClick={savePreferences}>
              Salvar Preferências
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
