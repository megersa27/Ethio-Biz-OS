import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Building2, Check, Globe, RefreshCw, Save, UserRound } from 'lucide-react';
import {
  getSettingsProfile,
  updateSettingsProfile,
} from '../services/api.js';
import { supportedLanguages } from '../i18n.js';
import { useAutoDismissNotice } from '../utils/useAutoDismissNotice.js';
import './SettingsPage.css';

const emptyForm = {
  businessName: '',
  businessPhone: '',
  address: '',
  ownerName: '',
  email: '',
  ownerPhone: '',
};

export default function SettingsPage({ token, onProfileUpdated }) {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useAutoDismissNotice(notice, setNotice);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getSettingsProfile(token);
      const current = result.profile;
      setProfile(current);
      setForm({
        businessName: current.business.name || '',
        businessPhone: current.business.phone || '',
        address: current.business.address || '',
        ownerName: current.user.name || '',
        email: current.user.email || '',
        ownerPhone: current.user.phone || '',
      });
    } catch (err) {
      setError(err.message || t('settings.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const change = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setNotice('');
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      user: {
        name: form.ownerName,
        email: form.email,
        phone: form.ownerPhone,
      },
    };

    if (profile?.user?.role === 'OWNER') {
      payload.business = {
        name: form.businessName,
        phone: form.businessPhone,
        address: form.address,
      };
    }

    try {
      const result = await updateSettingsProfile(token, payload);
      setProfile(result.profile);
      setForm({
        businessName: result.profile.business.name || '',
        businessPhone: result.profile.business.phone || '',
        address: result.profile.business.address || '',
        ownerName: result.profile.user.name || '',
        email: result.profile.user.email || '',
        ownerPhone: result.profile.user.phone || '',
      });
      if (onProfileUpdated) onProfileUpdated(result.profile);
      setNotice(t('settings.saved'));
    } catch (err) {
      setError(err.message || t('settings.errSave'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="settings-loading"><RefreshCw size={19} /> {t('settings.loadingSettings')}</div>;
  }

  if (!profile) {
    return (
      <section className="settings-page">
        <div className="settings-message settings-error">
          <AlertCircle size={18} /> {error || t('settings.unavailable')}
          <button type="button" onClick={loadProfile}>{t('common.retry')}</button>
        </div>
      </section>
    );
  }

  const canEditBusiness = profile.user.role === 'OWNER';
  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  return (
    <section className="settings-page">
      <header className="settings-heading">
        <div>
          <p className="settings-eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.lead')}</p>
        </div>
      </header>

      {error && <div className="settings-message settings-error">
        <AlertCircle size={18} /><span>{error}</span>
      </div>}
      {notice && <div className="settings-message settings-success">{notice}</div>}

      <form onSubmit={handleSubmit} className="settings-form">
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><Globe size={20} /></div>
            <div>
              <h2>{t('language.label')}</h2>
              <p>{t('language.label')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '8px' }}>
            {supportedLanguages.map((lang) => {
              const isActive = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => i18n.changeLanguage(lang.code)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: isActive ? '2px solid #176b4d' : '1px solid #d5ded8',
                    background: isActive ? '#e7f4ed' : '#ffffff',
                    color: isActive ? '#176b4d' : '#233229',
                    fontWeight: isActive ? '700' : '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Globe size={16} />
                  <span>{t(lang.labelKey)}</span>
                  {isActive && <Check size={16} color="#176b4d" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><Building2 size={20} /></div>
            <div><h2>{t('settings.businessProfile')}</h2>
              <p>{t('settings.businessLead')}</p></div>
          </div>

          {!canEditBusiness && (
            <p className="settings-readonly">{t('settings.readonlyNote')}</p>
          )}

          <div className="settings-fields">
            <label className="settings-field settings-wide">
              <span>{t('settings.businessName')}</span>
              <input required maxLength={150} value={form.businessName}
                onChange={change('businessName')} disabled={!canEditBusiness} />
            </label>
            <label className="settings-field">
              <span>{t('settings.businessPhone')}</span>
              <input maxLength={30} value={form.businessPhone}
                onChange={change('businessPhone')} disabled={!canEditBusiness}
                placeholder={t('settings.businessPhonePh')} />
            </label>
            <label className="settings-field settings-wide">
              <span>{t('settings.businessAddress')}</span>
              <textarea rows={3} maxLength={300} value={form.address}
                onChange={change('address')} disabled={!canEditBusiness}
                placeholder={t('settings.businessAddressPh')} />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><UserRound size={20} /></div>
            <div><h2>{t('settings.personalProfile')}</h2>
              <p>{t('settings.personalLead')}</p></div>
          </div>

          <div className="settings-fields">
            <label className="settings-field settings-wide">
              <span>{t('settings.name')}</span>
              <input required maxLength={100} value={form.ownerName}
                onChange={change('ownerName')} />
            </label>
            <label className="settings-field">
              <span>{t('settings.emailAddress')}</span>
              <input type="email" maxLength={254} value={form.email}
                onChange={change('email')} placeholder={t('settings.emailPh')} />
            </label>
            <label className="settings-field">
              <span>{t('settings.personalPhone')}</span>
              <input maxLength={30} value={form.ownerPhone}
                onChange={change('ownerPhone')} placeholder={t('settings.phonePh')} />
            </label>
          </div>
          <p className="settings-hint">{t('settings.hint')}</p>
          <div className="settings-account-meta">
            <span>{t('settings.accountRole')}</span><strong>{profile.user.role}</strong>
          </div>
        </section>

        <div className="settings-actions">
          <button type="button" className="settings-secondary" onClick={loadProfile} disabled={saving}>
            <RefreshCw size={16} /> {t('settings.reload')}
          </button>
          <button type="submit" className="settings-save" disabled={saving}>
            {saving ? <RefreshCw size={16} /> : <Save size={16} />}
            {saving ? t('common.saving') : t('common.saveChanges')}
          </button>
        </div>
      </form>
    </section>
  );
}
