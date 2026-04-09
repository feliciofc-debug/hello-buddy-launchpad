import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const location = useLocation();

  const toggle = () => {
    const next = i18n.language?.startsWith('pt') ? 'en' : 'pt-BR';
    i18n.changeLanguage(next);
  };

  const isPt = i18n.language?.startsWith('pt');

  // Don't show on landing/public pages
  const hiddenPaths = ['/', '/login', '/cadastro', '/terms', '/privacy', '/termos', '/privacidade', '/data-deletion', '/security', '/planos', '/pay'];
  if (hiddenPaths.some(p => location.pathname === p || location.pathname.startsWith('/pay'))) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-20 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-background/80 backdrop-blur-sm hover:bg-accent text-foreground border border-border shadow-sm transition-colors"
      title={isPt ? 'Switch to English' : 'Mudar para Português'}
    >
      <span>{isPt ? '🇧🇷' : '🇺🇸'}</span>
      <span>{isPt ? 'PT' : 'EN'}</span>
    </button>
  );
};

export default LanguageSwitcher;
