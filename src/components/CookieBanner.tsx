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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
                {t('cookies.title')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('cookies.desc')}
                {' '}
                <a 
                  href="/privacy" 
                  className="text-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('cookies.learn_more')}
                </a>
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={acceptAll}
                  className="bg-primary"
                >
                  {t('cookies.accept_all')}
                </Button>
                
                <Button 
                  onClick={rejectAll}
                  variant="outline"
                >
                  {t('cookies.reject_all')}
                </Button>
                
                <Button 
                  onClick={() => setShowSettings(true)}
                  variant="ghost"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {t('cookies.preferences')}
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
            <DialogTitle>{t('cookies.prefs_title')}</DialogTitle>
            <DialogDescription>
              {t('cookies.prefs_desc')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  {t('cookies.necessary')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t('cookies.necessary_desc')}
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
                  {t('cookies.analytics')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t('cookies.analytics_desc')}
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
                  {t('cookies.marketing')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t('cookies.marketing_desc')}
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
                  {t('cookies.functional')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t('cookies.functional_desc')}
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
              {t('cookies.cancel')}
            </Button>
            <Button onClick={savePreferences}>
              {t('cookies.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
