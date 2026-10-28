import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

import {
  createExpense,
  deactivateExpense,
  getExpenses,
  updateExpense,
} from '../services/api.js';

import { formatMinor } from '../utils/currency.js';
import './ExpensesPage.css';

const categories = [
  'Rent',
  'Utilities',
  'Transport',
  'Marketing',
  'Salaries',
  'Inventory / Stock',
  'Maintenance',
  'Communication',
  'Packaging',
  'Taxes & Fees',
  'Other',
];

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function emptyForm() {
  return {
    category: 'Transport',
    customCategory: '',
    amount: '',
    date: localToday(),
    description: '',
  };
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-ET', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

export default function ExpensesPage({ token }) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadExpenses() {
      setLoading(true);
      setPageError('');

      try {
        const result = await getExpenses(token, {
          page: 1,
          limit: 50,
          startDate,
          endDate,
        });

        if (!cancelled) {
          setExpenses(result.expenses || []);
          setPagination(result.pagination || null);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error.message || t('expenses.errLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadExpenses();

    return () => {
      cancelled = true;
    };
  }, [token, startDate, endDate, reloadKey, t]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return expenses;

    return expenses.filter((expense) =>
      [
        expense.category,
        expense.description,
        expense.date,
        String(Number(expense.amountMinor || 0) / 100),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [expenses, search]);

  const totalMinor = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amountMinor || 0),
    0
  );

  function openCreateForm() {
    setEditingExpense(null);
    setForm(emptyForm());
    setFormError('');
    setNotice('');
    setFormOpen(true);
  }

  function openEditForm(expense) {
    const category = expense.category || 'Other';
    const isStandard = categories.includes(category) && category !== 'Other';

    setEditingExpense(expense);
    setForm({
      category: isStandard ? category : 'Other',
      customCategory: isStandard ? '' : category,
      amount: (Number(expense.amountMinor || 0) / 100).toFixed(2),
      date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : localToday(),
      description: expense.description || '',
    });
    setFormError('');
    setNotice('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;

    setFormOpen(false);
    setEditingExpense(null);
    setForm(emptyForm());
    setFormError('');
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    const category =
      form.category === 'Other'
        ? form.customCategory.trim()
        : form.category.trim();

    if (!category) {
      setFormError(t('expenses.errCategory'));
      return;
    }

    if (category.length > 80) {
      setFormError(t('expenses.errCategoryLen'));
      return;
    }

    const amount = Number(form.amount);
    const amountMinor = Math.round(amount * 100);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor <= 0
    ) {
      setFormError(t('expenses.errAmount'));
      return;
    }

    if (!form.date || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setFormError(t('expenses.errDate'));
      return;
    }

    if (form.description.trim().length > 500) {
      setFormError(t('expenses.errDescLen'));
      return;
    }

    const payload = {
      category,
      amountMinor,
      date: form.date,
      description: form.description.trim(),
    };

    setSaving(true);

    try {
      if (editingExpense) {
        await updateExpense(token, editingExpense._id, payload);
        setNotice(t('expenses.updated'));
      } else {
        await createExpense(token, payload);
        setNotice(t('expenses.recorded'));
      }

      setFormOpen(false);
      setEditingExpense(null);
      setForm(emptyForm());
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error.message || t('expenses.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(expense) {
    const confirmed = window.confirm(
      t('expenses.confirmDeactivate', { category: expense.category })
    );

    if (!confirmed) return;

    setPageError('');
    setNotice('');

    try {
      await deactivateExpense(token, expense._id);
      setNotice(t('expenses.deactivated'));
      setReloadKey((value) => value + 1);
    } catch (error) {
      setPageError(error.message || t('expenses.errDeactivate'));
    }
  }

  return (
    <section className="expenses-page">
      <div className="expenses-heading">
        <div>
          <p className="eyebrow">{t('expenses.eyebrow')}</p>
          <h1>{t('expenses.title')}</h1>
          <p>{t('expenses.lead')}</p>
        </div>

        <div className="expenses-heading-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            <Plus size={16} /> {t('expenses.addExpense')}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="expenses-alert expenses-alert-error" role="alert">
          <AlertTriangle size={18} />
          <span>{pageError}</span>
        </div>
      )}

      {notice && (
        <div className="expenses-alert expenses-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label={t('common.dismiss')}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="expenses-summary">
        <article className="expenses-summary-card">
          <div className="expenses-summary-icon"><Wallet size={20} /></div>
          <div>
            <p>{t('expenses.totalShown')}</p>
            <strong>{loading ? t('common.loadingEllipsis') : formatMinor(totalMinor)}</strong>
            <span>{t('expenses.totalNote')}</span>
          </div>
        </article>

        <article className="expenses-summary-card">
          <div className="expenses-summary-icon"><CreditCard size={20} /></div>
          <div>
            <p>{t('expenses.recordsShown')}</p>
            <strong>{loading ? t('common.loadingEllipsis') : filteredExpenses.length}</strong>
            <span>{t('expenses.ofLoaded', { total: pagination?.totalItems ?? expenses.length })}</span>
          </div>
        </article>
      </div>

      {formOpen && (
        <div className="expenses-panel">
          <div className="expenses-panel-heading">
            <div className="expenses-panel-icon">
              {editingExpense ? <Edit2 size={19} /> : <Plus size={19} />}
            </div>
            <div>
              <h2>{editingExpense ? t('expenses.editTitle') : t('expenses.recordTitle')}</h2>
              <p>{t('expenses.formLead')}</p>
            </div>
            <button
              type="button"
              className="expenses-close"
              onClick={closeForm}
              disabled={saving}
              aria-label={t('expenses.closeAria')}
            >
              <X size={18} />
            </button>
          </div>

          <form className="expenses-form" onSubmit={handleSubmit}>
            <div className="expenses-form-grid">
              <label>
                {t('expenses.category')}
                <select
                  name="category"
                  value={form.category}
                  onChange={updateField}
                  required
                  disabled={saving}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>

              {form.category === 'Other' && (
                <label>
                  {t('expenses.customCategory')}
                  <input
                    name="customCategory"
                    value={form.customCategory}
                    onChange={updateField}
                    maxLength={80}
                    required
                    disabled={saving}
                    placeholder={t('expenses.customPh')}
                  />
                </label>
              )}

              <label>
                {t('expenses.amount')}
                <input
                  name="amount"
                  type="number"
                  value={form.amount}
                  onChange={updateField}
                  min="0.01"
                  step="0.01"
                  required
                  disabled={saving}
                  placeholder={t('expenses.amountPh')}
                />
              </label>

              <label>
                {t('expenses.expenseDate')}
                <input
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={updateField}
                  required
                  disabled={saving}
                />
              </label>

              <label className="expenses-description-field">
                {t('expenses.description')}
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  maxLength={500}
                  rows={3}
                  disabled={saving}
                  placeholder={t('expenses.descriptionPh')}
                />
              </label>
            </div>

            {formError && (
              <div className="expenses-alert expenses-alert-error" role="alert">
                <AlertTriangle size={17} />
                <span>{formError}</span>
              </div>
            )}

            <div className="expenses-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving
                  ? t('common.saving')
                  : editingExpense
                    ? t('common.saveChanges')
                    : t('expenses.recordExpense')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="expenses-panel expenses-history-panel">
        <div className="expenses-table-heading">
          <div>
            <h2>{t('expenses.history')}</h2>
            <p>
              {pagination
                ? t('expenses.historyCount', { count: pagination.totalItems })
                : t('expenses.historyDefault')}
            </p>
          </div>
          <label className="expenses-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('expenses.searchPh')}
              aria-label={t('expenses.searchAria')}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label={t('expenses.clearSearchAria')}>
                <X size={15} />
              </button>
            )}
          </label>
        </div>

        <div className="expenses-date-filters">
          <label>
            <CalendarDays size={15} /> {t('expenses.from')}
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            <CalendarDays size={15} /> {t('expenses.to')}
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          {(startDate || endDate) && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              {t('common.clearDates')}
            </button>
          )}
        </div>

        <div className="expenses-table-wrap">
          <table className="expenses-table">
            <thead>
              <tr>
                <th>{t('expenses.thDate')}</th>
                <th>{t('expenses.thCategory')}</th>
                <th>{t('expenses.thDescription')}</th>
                <th>{t('expenses.thAmount')}</th>
                <th>{t('expenses.thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="expenses-empty">{t('expenses.loadingExpenses')}</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="expenses-empty">
                    {search || startDate || endDate
                      ? t('expenses.noMatch')
                      : t('expenses.none')}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense._id}>
                    <td>{formatDate(expense.date)}</td>
                    <td><span className="expenses-category">{expense.category}</span></td>
                    <td className="expenses-description">
                      {expense.description || '—'}
                    </td>
                    <td><strong>{formatMinor(expense.amountMinor)}</strong></td>
                    <td>
                      <div className="expenses-row-actions">
                        <button
                          type="button"
                          onClick={() => openEditForm(expense)}
                          aria-label={t('expenses.editAria', { category: expense.category })}
                          title={t('expenses.editTitle')}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="expenses-deactivate"
                          onClick={() => handleDeactivate(expense)}
                          aria-label={t('expenses.deactivateAria', { category: expense.category })}
                          title={t('expenses.deactivateAria', { category: expense.category })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="expenses-table-footer">
          {t('expenses.footer')}
        </div>
      </div>
    </section>
  );
}
