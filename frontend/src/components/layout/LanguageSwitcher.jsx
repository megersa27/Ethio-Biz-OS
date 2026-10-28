import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';

import { supportedLanguages } from '../../i18n.js';

// Compact language switcher. Selecting a language re-renders the whole app
// in that language via react-i18next; the choice persists in localStorage.
export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const rawLang = i18n.resolvedLanguage || i18n.language || 'en';
  const current = rawLang.split('-')[0];

  useEffect(() => {
    function close(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  function selectLanguage(code) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  const currentConfig = supportedLanguages.find((l) => l.code === current) || supportedLanguages[0];
  const currentLabel = currentConfig?.labelKey ? t(currentConfig.labelKey) : current;

  return (
    <div className={`language-switcher ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        className="icon-button language-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('language.label')}
        aria-expanded={open}
        title={t('language.label')}
      >
        <Globe size={17} />
        <span className="language-current">{currentLabel}</span>
      </button>

      {open && (
        <div className="topbar-popover language-popover" role="menu">
          <div className="popover-heading">{t('language.label')}</div>
          {supportedLanguages.map((language) => (
            <button
              key={language.code}
              type="button"
              className={`profile-menu-item language-option ${
                language.code === current ? 'selected' : ''
              }`}
              onClick={() => selectLanguage(language.code)}
              role="menuitemradio"
              aria-checked={language.code === current}
            >
              <span>{t(language.labelKey)}</span>
              {language.code === current && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
