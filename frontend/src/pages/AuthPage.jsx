import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  MoonStar,
  ShieldCheck,
  SunMedium,
} from 'lucide-react';

import { loginUser, registerBusiness } from '../services/api.js';
import LanguageSwitcher from '../components/layout/LanguageSwitcher.jsx';
import './AuthPage.css';

const initialForm = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  identifier: '',
  password: '',
};

export default function AuthPage({ onLogin }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';

    const storedTheme = window.localStorage.getItem('ethioBizTheme');
    return storedTheme === 'dark' ? 'dark' : 'light';
  });
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('ethioBizTheme', theme);
  }, [theme]);

  const isRegister = mode === 'register';

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError('');
    setSuccess('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (isRegister) {
      if (!form.email.trim() && !form.phone.trim()) {
        setError(t('auth.errEmailOrPhone'));
        return;
      }

      if (form.password.length < 12) {
        setError(t('auth.errPasswordLen'));
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        await registerBusiness({
          businessName: form.businessName.trim(),
          ownerName: form.ownerName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        });

        setForm((current) => ({
          ...initialForm,
          identifier: current.email.trim() || current.phone.trim(),
        }));

        setMode('login');
        setSuccess(t('auth.successRegister'));
      } else {
        const result = await loginUser({
          identifier: form.identifier.trim(),
          password: form.password,
        });

        onLogin(result);
      }
    } catch (requestError) {
      setError(
        requestError.message || t('auth.errGeneric')
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setShowPassword(false);
  }

  const currentYear = new Date().getFullYear();

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="auth-brand-mark">
            <Activity size={25} />
          </span>

          <span className="auth-brand-name">
            EthioBiz <strong>OS</strong>
          </span>
        </div>

        <div className="auth-story-content">
          <span className="auth-kicker">
            {t('auth.kicker')}
          </span>

          <h1>
            {t('auth.headline1')}
            <br />
            {t('auth.headline2')}
          </h1>

          <p>
            {t('auth.lead')}
          </p>

          <div className="auth-benefit">
            <span className="auth-benefit-icon">
              <ShieldCheck size={20} />
            </span>

            <div>
              <strong>{t('auth.benefitTitle')}</strong>
              <span>
                {t('auth.benefitBody')}
              </span>
            </div>
          </div>
        </div>

        <p className="auth-story-footer">
          {t('auth.storyFooter')}
        </p>
      </section>

      <section className="auth-form-side">
        <div className="auth-top-actions">
          <button
            type="button"
            className="auth-theme-toggle"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunMedium size={17} /> : <MoonStar size={17} />}
          </button>
          <LanguageSwitcher />
        </div>

        <div className="auth-form-card">
          <div className="auth-mobile-brand">
            <Activity size={23} />
            <span>EthioBiz <strong>OS</strong></span>
          </div>

          <div className="auth-heading">
            <span className="auth-form-eyebrow">
              {t('auth.formEyebrow')}
            </span>

            <h2>
              {isRegister ? t('auth.createTitle') : t('auth.welcomeTitle')}
            </h2>

            <p>
              {isRegister
                ? t('auth.createLead')
                : t('auth.loginLead')}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={!isRegister ? 'selected' : ''}
              onClick={() => switchMode('login')}
            >
              {t('auth.signIn')}
            </button>

            <button
              type="button"
              className={isRegister ? 'selected' : ''}
              onClick={() => switchMode('register')}
            >
              {t('auth.createAccount')}
            </button>
          </div>

          {error && (
            <div className="auth-message auth-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="auth-message auth-success" role="status">
              {success}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister ? (
              <>
                <div className="auth-field">
                  <label htmlFor="businessName">{t('auth.businessName')}</label>
                  <input
                    id="businessName"
                    name="businessName"
                    value={form.businessName}
                    onChange={updateField}
                    placeholder={t('auth.businessNamePh')}
                    maxLength={150}
                    autoComplete="organization"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="ownerName">{t('auth.ownerName')}</label>
                  <input
                    id="ownerName"
                    name="ownerName"
                    value={form.ownerName}
                    onChange={updateField}
                    placeholder={t('auth.ownerNamePh')}
                    maxLength={100}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="email">
                    {t('auth.emailOptional')} <span>{t('auth.optional')}</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder={t('auth.emailPh')}
                    autoComplete="email"
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="phone">
                    {t('auth.phoneOptional')} <span>{t('auth.optional')}</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={updateField}
                    placeholder={t('auth.phonePh')}
                    maxLength={30}
                    autoComplete="tel"
                  />
                  <small>{t('auth.emailOrPhoneHint')}</small>
                </div>
              </>
            ) : (
              <div className="auth-field">
                <label htmlFor="identifier">{t('auth.identifier')}</label>
                <input
                  id="identifier"
                  name="identifier"
                  value={form.identifier}
                  onChange={updateField}
                  placeholder={t('auth.identifierPh')}
                  autoComplete="username"
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="password">{t('auth.password')}</label>

              <div className="auth-password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={updateField}
                  placeholder={
                    isRegister
                      ? t('auth.passwordCreatePh')
                      : t('auth.passwordLoginPh')
                  }
                  minLength={isRegister ? 12 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {isRegister && (
                <small>{t('auth.passwordHint')}</small>
              )}
            </div>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? t('auth.submitWait')
                  : isRegister
                    ? t('auth.submitCreate')
                    : t('auth.submitLogin')}
              </span>

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-privacy-note">
            {t('auth.privacyNote')}
          </p>
        </div>

        <p className="auth-copyright">
          {t('auth.copyright', { year: currentYear })}
        </p>
      </section>
    </main>
  );
}
