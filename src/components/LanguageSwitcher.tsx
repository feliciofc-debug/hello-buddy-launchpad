import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const toggle = () => {
    const next = i18n.language?.startsWith('pt') ? 'en' : 'pt-BR';
    i18n.changeLanguage(next);
  };

  const isPt = i18n.language?.startsWith('pt');

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium hover:bg-accent text-foreground border border-border transition-colors"
      title={isPt ? 'Switch to English' : 'Mudar para Português'}
    >
      <span>{isPt ? '🇧🇷' : '🇺🇸'}</span>
      <span>{isPt ? 'PT' : 'EN'}</span>
    </button>
  );
};

export default LanguageSwitcher;
