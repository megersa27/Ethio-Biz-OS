import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Building2, RefreshCw, Save, UserRound } from 'lucide-react';
import {
  getSettingsProfile,
  updateSettingsProfile,
} from '../services/api.js';
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
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      setError(err.message || 'Profile information could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      setNotice('Settings saved successfully.');
    } catch (err) {
      setError(err.message || 'Settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="settings-loading"><RefreshCw size={19} /> Loading settings…</div>;
  }

  if (!profile) {
    return (
      <section className="settings-page">
        <div className="settings-message settings-error">
          <AlertCircle size={18} /> {error || 'Profile unavailable.'}
          <button type="button" onClick={loadProfile}>Try again</button>
        </div>
      </section>
    );
  }

  const canEditBusiness = profile.user.role === 'OWNER';

  return (
    <section className="settings-page">
      <header className="settings-heading">
        <div>
          <p className="settings-eyebrow">WORKSPACE PREFERENCES</p>
          <h1>Settings</h1>
          <p>Manage your business information and personal account details.</p>
        </div>
      </header>

      {error && <div className="settings-message settings-error">
        <AlertCircle size={18} /><span>{error}</span>
      </div>}
      {notice && <div className="settings-message settings-success">{notice}</div>}

      <form onSubmit={handleSubmit} className="settings-form">
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><Building2 size={20} /></div>
            <div><h2>Business profile</h2>
              <p>Contact and identification details for your workspace.</p></div>
          </div>

          {!canEditBusiness && (
            <p className="settings-readonly">Only the business owner can change these details.</p>
          )}

          <div className="settings-fields">
            <label className="settings-field settings-wide">
              <span>Business name</span>
              <input required maxLength={150} value={form.businessName}
                onChange={change('businessName')} disabled={!canEditBusiness} />
            </label>
            <label className="settings-field">
              <span>Business phone</span>
              <input maxLength={30} value={form.businessPhone}
                onChange={change('businessPhone')} disabled={!canEditBusiness}
                placeholder="Business contact number" />
            </label>
            <label className="settings-field settings-wide">
              <span>Business address</span>
              <textarea rows={3} maxLength={300} value={form.address}
                onChange={change('address')} disabled={!canEditBusiness}
                placeholder="Town, area, street or other address details" />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><UserRound size={20} /></div>
            <div><h2>Personal profile</h2>
              <p>Your account details used in the workspace.</p></div>
          </div>

          <div className="settings-fields">
            <label className="settings-field settings-wide">
              <span>Name</span>
              <input required maxLength={100} value={form.ownerName}
                onChange={change('ownerName')} />
            </label>
            <label className="settings-field">
              <span>Email address</span>
              <input type="email" maxLength={254} value={form.email}
                onChange={change('email')} placeholder="name@example.com" />
            </label>
            <label className="settings-field">
              <span>Personal phone</span>
              <input maxLength={30} value={form.ownerPhone}
                onChange={change('ownerPhone')} placeholder="+251…" />
            </label>
          </div>
          <p className="settings-hint">At least one of your email address or personal phone number is required for login.</p>
          <div className="settings-account-meta">
            <span>Account role</span><strong>{profile.user.role}</strong>
          </div>
        </section>

        <div className="settings-actions">
          <button type="button" className="settings-secondary" onClick={loadProfile} disabled={saving}>
            <RefreshCw size={16} /> Reload
          </button>
          <button type="submit" className="settings-save" disabled={saving}>
            {saving ? <RefreshCw size={16} /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
