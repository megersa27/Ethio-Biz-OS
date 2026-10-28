import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import om from './locales/om.json';
import am from './locales/am.json';

// Supported languages. The user picks one and the entire UI switches.
// BCP-47 codes: en (English), om (Afaan Oromoo), am (Amharic).
export const supportedLanguages = [
  { code: 'en', labelKey: 'language.english' },
  { code: 'om', labelKey: 'language.oromo' },
  { code: 'am', labelKey: 'language.amharic' },
];

export const LANGUAGE_STORAGE_KEY = 'ethiobizLang';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      om: { translation: om },
      am: { translation: am },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'om', 'am'],
    // Only persist the explicit user choice; ignore browser/navigator heuristics
    // so the app always opens in the language the user last selected.
    detection: {
      order: ['localStorage', 'caches'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      // React already escapes, so avoid double-escaping values.
      escapeValue: false,
    },
    returnNull: false,
  });

if (typeof document !== 'undefined') {
  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';
  document.documentElement.lang = currentLang;
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });
}

export default i18n;
