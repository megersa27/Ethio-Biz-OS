import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, CheckCircle2, Edit2, Mail, MapPin, Phone,
  Plus, RefreshCw, Search, UserRound, UserRoundX, X,
} from 'lucide-react';

import {
  createCustomer, deactivateCustomer, getCustomers, updateCustomer,
} from '../services/api.js';
import { useAutoDismissNotice } from '../utils/useAutoDismissNotice.js';
import './CustomersPage.css';

const emptyForm = {
  name: '', phone: '', email: '', address: '', notes: '',
};

export default function CustomersPage({ token }) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [reload, setReload] = useState(0);

  useAutoDismissNotice(notice, setNotice);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await getCustomers(token);
        if (!cancelled) setCustomers(result.customers || []);
      } catch (err) {
        if (!cancelled) setError(err.message || t('customers.errLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, reload, t]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.address, customer.notes]
        .filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [customers, search]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  function openEdit(customer) {
    setEditing(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setForm({ ...emptyForm });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!form.name.trim()) {
      setError(t('customers.errName'));
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(token, editing._id, payload);
        setNotice(t('customers.updated'));
      } else {
        await createCustomer(token, payload);
        setNotice(t('customers.created'));
      }

      setFormOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      setReload((value) => value + 1);
    } catch (err) {
      setError(err.message || t('customers.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(customer) {
    if (!window.confirm(
      t('customers.confirmDeactivate', { name: customer.name })
    )) return;

    setError('');
    setNotice('');
    try {
      await deactivateCustomer(token, customer._id);
      setNotice(t('customers.deactivated', { name: customer.name }));
      setReload((value) => value + 1);
    } catch (err) {
      setError(err.message || t('customers.errDeactivate'));
    }
  }

  const withPhone = customers.filter((customer) => customer.phone).length;
  const withEmail = customers.filter((customer) => customer.email).length;

  return (
    <section className="customers-page">
      <div className="customers-heading">
        <div>
          <p className="eyebrow">{t('customers.eyebrow')}</p>
          <h1>{t('customers.title')}</h1>
          <p>{t('customers.lead')}</p>
        </div>
        <div className="customers-heading-actions">
          <button className="secondary-button" type="button"
            onClick={() => setReload((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} /> {loading ? t('common.loading') : t('common.refresh')}
          </button>
          <button className="primary-button" type="button" onClick={openCreate}>
            <Plus size={16} /> {t('customers.addCustomer')}
          </button>
        </div>
      </div>

      {error && (
        <div className="customers-alert customers-alert-error" role="alert">
          <AlertTriangle size={18} /><span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="customers-alert customers-alert-success" role="status">
          <CheckCircle2 size={18} /><span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label={t('common.dismiss')}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="customers-summary">
        <article><UserRound size={20} /><div><p>{t('customers.activeCustomers')}</p>
          <strong>{loading ? t('common.loadingEllipsis') : customers.length}</strong></div></article>
        <article><Phone size={20} /><div><p>{t('customers.withPhone')}</p>
          <strong>{loading ? t('common.loadingEllipsis') : withPhone}</strong></div></article>
        <article><Mail size={20} /><div><p>{t('customers.withEmail')}</p>
          <strong>{loading ? t('common.loadingEllipsis') : withEmail}</strong></div></article>
      </div>

      {formOpen && (
        <section className="customers-panel">
          <div className="customers-panel-heading">
            <div>
              <h2>{editing ? t('customers.editCustomer') : t('customers.addCustomerTitle')}</h2>
              <p>{t('customers.formLead')}</p>
            </div>
            <button className="customers-close" type="button"
              onClick={closeForm} disabled={saving} aria-label={t('customers.closeFormAria')}>
              <X size={18} />
            </button>
          </div>

          <form className="customers-form" onSubmit={handleSubmit}>
            <div className="customers-form-grid">
              <label>{t('customers.customerNameLabel')}
                <input name="name" value={form.name} onChange={handleChange}
                  maxLength={150} autoComplete="name" required disabled={saving}
                  placeholder={t('customers.customerNamePh')} />
              </label>
              <label>{t('customers.phoneLabel')}
                <input name="phone" type="tel" value={form.phone}
                  onChange={handleChange} maxLength={30} autoComplete="tel"
                  disabled={saving} placeholder={t('customers.phonePh')} />
              </label>
              <label>{t('customers.emailLabel')}
                <input name="email" type="email" value={form.email}
                  onChange={handleChange} maxLength={254} autoComplete="email"
                  disabled={saving} placeholder={t('customers.emailPh')} />
              </label>
              <label>{t('customers.addressLabel')}
                <input name="address" value={form.address} onChange={handleChange}
                  maxLength={300} autoComplete="street-address" disabled={saving}
                  placeholder={t('customers.addressPh')} />
              </label>
              <label className="customers-notes-field">{t('customers.notesLabel')}
                <textarea name="notes" value={form.notes} onChange={handleChange}
                  maxLength={500} rows={3} disabled={saving}
                  placeholder={t('customers.notesPh')} />
              </label>
            </div>

            <div className="customers-form-actions">
              <button type="button" className="secondary-button"
                onClick={closeForm} disabled={saving}>{t('common.cancel')}</button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? t('common.saving') : editing ? t('common.saveChanges') : t('customers.createCustomer')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="customers-panel">
        <div className="customers-directory-heading">
          <div><h2>{t('customers.directory')}</h2>
            <p>{loading ? t('customers.loadingCustomers') : t('customers.shownCount', { count: filtered.length })}</p>
          </div>
          <label className="customers-search">
            <Search size={17} />
            <input type="search" value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('customers.searchPh')} aria-label={t('customers.searchAria')} />
            {search && <button type="button" onClick={() => setSearch('')}
              aria-label={t('customers.clearSearchAria')}><X size={15} /></button>}
          </label>
        </div>

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead><tr>
              <th>{t('customers.thCustomer')}</th><th>{t('customers.thPhone')}</th><th>{t('customers.thEmail')}</th>
              <th>{t('customers.thAddress')}</th><th>{t('customers.thNotes')}</th><th>{t('customers.thActions')}</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="customers-empty">{t('customers.loadingCustomers')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="customers-empty">
                  {search ? t('customers.noMatch') : t('customers.none')}
                </td></tr>
              ) : filtered.map((customer) => (
                <tr key={customer._id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone ?
                    <a href={`tel:${customer.phone}`}>{customer.phone}</a> : '—'}</td>
                  <td>{customer.email ?
                    <a href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}</td>
                  <td>{customer.address ?
                    <span className="customers-address"><MapPin size={13} />{customer.address}</span> : '—'}</td>
                  <td className="customers-notes-cell">{customer.notes || '—'}</td>
                  <td><div className="customers-actions">
                    <button type="button" onClick={() => openEdit(customer)}
                      title={t('customers.editTitle')} aria-label={t('customers.editTitle')}>
                      <Edit2 size={15} />
                    </button>
                    <button type="button" className="customers-deactivate"
                      onClick={() => handleDeactivate(customer)}
                      title={t('customers.deactivateTitle')} aria-label={t('customers.deactivateTitle')}>
                      <UserRoundX size={15} />
                    </button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
