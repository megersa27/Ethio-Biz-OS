import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Edit2, Mail, MapPin, Phone,
  Plus, RefreshCw, Search, UserRound, UserRoundX, X,
} from 'lucide-react';

import {
  createCustomer, deactivateCustomer, getCustomers, updateCustomer,
} from '../services/api.js';
import './CustomersPage.css';

const emptyForm = {
  name: '', phone: '', email: '', address: '', notes: '',
};

export default function CustomersPage({ token }) {
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await getCustomers(token);
        if (!cancelled) setCustomers(result.customers || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Customers could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, reload]);

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
      setError('Customer name is required.');
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
        setNotice('Customer details updated successfully.');
      } else {
        await createCustomer(token, payload);
        setNotice('Customer created successfully.');
      }

      setFormOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      setReload((value) => value + 1);
    } catch (err) {
      setError(err.message || 'Customer could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(customer) {
    if (!window.confirm(
      `Deactivate ${customer.name}? Historical sales records will be retained.`
    )) return;

    setError('');
    setNotice('');
    try {
      await deactivateCustomer(token, customer._id);
      setNotice(`${customer.name} has been deactivated.`);
      setReload((value) => value + 1);
    } catch (err) {
      setError(err.message || 'Customer could not be deactivated.');
    }
  }

  const withPhone = customers.filter((customer) => customer.phone).length;
  const withEmail = customers.filter((customer) => customer.email).length;

  return (
    <section className="customers-page">
      <div className="customers-heading">
        <div>
          <p className="eyebrow">YOUR BUSINESS WORKSPACE</p>
          <h1>Customers</h1>
          <p>Manage customer contacts and keep customer records organised.</p>
        </div>
        <div className="customers-heading-actions">
          <button className="secondary-button" type="button"
            onClick={() => setReload((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="primary-button" type="button" onClick={openCreate}>
            <Plus size={16} /> Add customer
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
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="customers-summary">
        <article><UserRound size={20} /><div><p>Active customers</p>
          <strong>{loading ? '…' : customers.length}</strong></div></article>
        <article><Phone size={20} /><div><p>With phone number</p>
          <strong>{loading ? '…' : withPhone}</strong></div></article>
        <article><Mail size={20} /><div><p>With email address</p>
          <strong>{loading ? '…' : withEmail}</strong></div></article>
      </div>

      {formOpen && (
        <section className="customers-panel">
          <div className="customers-panel-heading">
            <div>
              <h2>{editing ? 'Edit customer' : 'Add customer'}</h2>
              <p>Name is required. Other contact information is optional.</p>
            </div>
            <button className="customers-close" type="button"
              onClick={closeForm} disabled={saving} aria-label="Close form">
              <X size={18} />
            </button>
          </div>

          <form className="customers-form" onSubmit={handleSubmit}>
            <div className="customers-form-grid">
              <label>Customer name *
                <input name="name" value={form.name} onChange={handleChange}
                  maxLength={150} autoComplete="name" required disabled={saving}
                  placeholder="e.g. Abebe Kebede" />
              </label>
              <label>Phone number
                <input name="phone" type="tel" value={form.phone}
                  onChange={handleChange} maxLength={30} autoComplete="tel"
                  disabled={saving} placeholder="+251…" />
              </label>
              <label>Email address
                <input name="email" type="email" value={form.email}
                  onChange={handleChange} maxLength={254} autoComplete="email"
                  disabled={saving} placeholder="customer@example.com" />
              </label>
              <label>Address
                <input name="address" value={form.address} onChange={handleChange}
                  maxLength={300} autoComplete="street-address" disabled={saving}
                  placeholder="Town, area or street" />
              </label>
              <label className="customers-notes-field">Notes
                <textarea name="notes" value={form.notes} onChange={handleChange}
                  maxLength={500} rows={3} disabled={saving}
                  placeholder="Optional customer notes" />
              </label>
            </div>

            <div className="customers-form-actions">
              <button type="button" className="secondary-button"
                onClick={closeForm} disabled={saving}>Cancel</button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create customer'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="customers-panel">
        <div className="customers-directory-heading">
          <div><h2>Customer directory</h2>
            <p>{loading ? 'Loading…' : `${filtered.length} customer(s) shown`}</p>
          </div>
          <label className="customers-search">
            <Search size={17} />
            <input type="search" value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone or email…" aria-label="Search customers" />
            {search && <button type="button" onClick={() => setSearch('')}
              aria-label="Clear search"><X size={15} /></button>}
          </label>
        </div>

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead><tr>
              <th>Customer</th><th>Phone</th><th>Email</th>
              <th>Address</th><th>Notes</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="customers-empty">Loading customers…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="customers-empty">
                  {search ? 'No customers match your search.' :
                    'No customers yet. Add your first customer to get started.'}
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
                      title="Edit customer" aria-label={`Edit ${customer.name}`}>
                      <Edit2 size={15} />
                    </button>
                    <button type="button" className="customers-deactivate"
                      onClick={() => handleDeactivate(customer)}
                      title="Deactivate customer" aria-label={`Deactivate ${customer.name}`}>
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
