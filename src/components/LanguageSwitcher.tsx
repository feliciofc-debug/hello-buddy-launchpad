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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/50 hover:bg-slate-600/50 text-white border border-slate-600/50 transition-colors"
      title={isPt ? 'Switch to English' : 'Mudar para Português'}
    >
      <span>{isPt ? '🇧🇷' : '🇺🇸'}</span>
      <span>{isPt ? 'PT' : 'EN'}</span>
    </button>
  );
};

export default LanguageSwitcher;
