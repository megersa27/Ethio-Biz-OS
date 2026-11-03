import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Search, UserRound, X } from 'lucide-react';

import { getCustomers, getSales, recordSalePayment } from '../services/api.js';
import { formatMinor } from '../utils/currency.js';
import './CustomersPage.css';

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

const moneyToMinor = (value) => Math.round(Number(value) * 100);

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-ET', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

async function loadAllSales(token) {
  const allSales = [];
  let page = 1;

  while (true) {
    const result = await getSales(token, { page, limit: 100 });
    const rows = result.sales || [];
    allSales.push(...rows);

    const totalPages = Number(result.pagination?.totalPages || 0);

    if (totalPages > 0) {
      if (page >= totalPages) break;
    } else if (rows.length < 200) {
      break;
    }

    page += 1;

    if (page > 1000) {
      throw new Error('Too many sales pages to load safely.');
    }
  }

  return allSales;
}

export default function CustomersPage({ token }) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentSale, setPaymentSale] = useState(null);
  const [additionalPayment, setAdditionalPayment] = useState('');
  const [additionalPaymentMethod, setAdditionalPaymentMethod] = useState('cash');
  const [additionalReference, setAdditionalReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');

  function openPaymentForm(customer) {
    const sale = customer?.paymentTargetSale;
    if (!sale) return;

    setPaymentSale(sale);
    setAdditionalPayment(
      (Number(sale.balanceDueMinor || 0) / 100).toFixed(2)
    );
    setAdditionalPaymentMethod('cash');
    setAdditionalReference('');
    setFormError('');
    setNotice('');
  }

  async function handleAdditionalPayment(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!paymentSale) return;

    const paidEtb = Number(additionalPayment);
    const amountMinor = moneyToMinor(paidEtb);
    const balanceMinor = Number(paymentSale.balanceDueMinor || 0);

    if (!Number.isFinite(paidEtb) || paidEtb <= 0 || amountMinor <= 0) {
      setFormError(t('sales.errPaymentZero'));
      return;
    }

    if (amountMinor > balanceMinor) {
      setFormError(t('sales.errPaymentExceeds'));
      return;
    }

    setSaving(true);

    try {
      await recordSalePayment(token, paymentSale._id, {
        amountMinor,
        paymentMethod: additionalPaymentMethod,
      });

      setNotice(t('sales.paymentSuccess'));
      setPaymentSale(null);
      setSearch('');
      setCustomers((current) => current.map((customer) => ({
        ...customer,
        balanceDueMinor: customer._id === (paymentSale.customerId?._id || paymentSale.customerId)
          ? Math.max(0, customer.balanceDueMinor - amountMinor)
          : customer.balanceDueMinor,
      })));
      setLoading(true);
      const [customerResult, allSales] = await Promise.all([
        getCustomers(token),
        loadAllSales(token),
      ]);

      const customerMap = new Map(
        (customerResult.customers || []).map((customer) => [
          String(customer._id),
          {
            ...customer,
            balanceDueMinor: 0,
            lastPaymentDate: null,
            paymentTargetSale: null,
          },
        ])
      );

      allSales.forEach((sale) => {
        const balance = Number(sale.balanceDueMinor || 0);
        const info = sale.customerId && typeof sale.customerId === 'object' ? sale.customerId : sale.customer || {};
        const rawId = info._id || (typeof sale.customerId === 'string' ? sale.customerId : '') || sale.customer?._id;

        if (!rawId) return;

        const id = String(rawId);
        let customer = customerMap.get(id);

        if (!customer) {
          customer = {
            _id: id,
            name: info.name || 'Customer',
            phone: info.phone || '',
            email: info.email || '',
            address: info.address || '',
            balanceDueMinor: 0,
            lastPaymentDate: null,
            paymentTargetSale: null,
          };
          customerMap.set(id, customer);
        }

        if (Number.isFinite(balance) && balance > 0) {
          customer.balanceDueMinor += balance;

          const saleDate = sale.createdAt ? new Date(sale.createdAt).getTime() : 0;
          const currentSaleDate = customer.paymentTargetSale?.createdAt ? new Date(customer.paymentTargetSale.createdAt).getTime() : 0;

          if (!customer.paymentTargetSale || saleDate > currentSaleDate) {
            customer.paymentTargetSale = sale;
          }
        }

        if (Array.isArray(sale.payments)) {
          sale.payments.forEach((payment) => {
            const paymentDate = payment?.paidAt ? new Date(payment.paidAt) : null;
            if (!paymentDate || Number.isNaN(paymentDate.getTime())) return;

            if (!customer.lastPaymentDate || paymentDate > new Date(customer.lastPaymentDate)) {
              customer.lastPaymentDate = paymentDate;
            }
          });
        }
      });

      setCustomers([...customerMap.values()].filter((customer) => customer.balanceDueMinor > 0).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      setFormError(error.message || t('sales.errPaymentFailed'));
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [customerResult, allSales] = await Promise.all([
          getCustomers(token),
          loadAllSales(token),
        ]);

        if (cancelled) return;

        const customerMap = new Map(
          (customerResult.customers || []).map((customer) => [
            String(customer._id),
            {
              ...customer,
              balanceDueMinor: 0,
              lastPaymentDate: null,
              paymentTargetSale: null,
            },
          ])
        );

        // Aggregate the current outstanding balance and latest payment date for each customer.
        allSales.forEach((sale) => {
          const balance = Number(sale.balanceDueMinor || 0);
          const info =
            sale.customerId && typeof sale.customerId === 'object'
              ? sale.customerId
              : sale.customer || {};

          const rawId =
            info._id ||
            (typeof sale.customerId === 'string' ? sale.customerId : '') ||
            sale.customer?._id;

          if (!rawId) return;

          const id = String(rawId);
          let customer = customerMap.get(id);

          if (!customer) {
            customer = {
              _id: id,
              name: info.name || 'Customer',
              phone: info.phone || '',
              email: info.email || '',
              address: info.address || '',
              balanceDueMinor: 0,
              lastPaymentDate: null,
              paymentTargetSale: null,
            };
            customerMap.set(id, customer);
          }

          if (
            sale.saleStatus !== 'CANCELLED' &&
            Number.isFinite(balance) &&
            balance > 0
          ) {
            customer.balanceDueMinor += balance;

            const saleDate = sale.createdAt ? new Date(sale.createdAt).getTime() : 0;
            const currentSaleDate = customer.paymentTargetSale?.createdAt
              ? new Date(customer.paymentTargetSale.createdAt).getTime()
              : 0;

            if (!customer.paymentTargetSale || saleDate > currentSaleDate) {
              customer.paymentTargetSale = sale;
            }
          }

          if (Array.isArray(sale.payments)) {
            sale.payments.forEach((payment) => {
              const paymentDate = payment?.paidAt ? new Date(payment.paidAt) : null;

              if (!paymentDate || Number.isNaN(paymentDate.getTime())) return;

              if (!customer.lastPaymentDate || paymentDate > new Date(customer.lastPaymentDate)) {
                customer.lastPaymentDate = paymentDate;
              }
            });
          }
        });

        const creditCustomers = [...customerMap.values()]
          .filter((customer) => customer.balanceDueMinor > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        setCustomers(creditCustomers);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || t('customers.errLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.phone,
        customer.address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [customers, search]);

  return (
    <section className="customers-page">
      <div className="customers-heading">
        <div>
          <p className="eyebrow">{t('customers.eyebrow')}</p>
          <h1>{t('customers.title')}</h1>
          <p>{t('customers.lead')}</p>
        </div>
      </div>

      {error && (
        <div className="customers-alert customers-alert-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="customers-panel">
        <div className="customers-directory-heading">
          <div>
            <h2>{t('customers.directory')}</h2>
            <p>
              {loading
                ? t('customers.loadingCustomers')
                : t('customers.shownCount', { count: filtered.length })}
            </p>
          </div>

          <label className="customers-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('customers.searchPh')}
              aria-label={t('customers.searchAria')}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('customers.clearSearchAria')}
              >
                <X size={15} />
              </button>
            )}
          </label>
        </div>

        {paymentSale && (
          <div
            className="customers-payment-overlay"
            onClick={() => {
              setPaymentSale(null);
              setFormError('');
            }}
          >
            <div
              className="customers-payment-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t('sales.recordPayment')}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="customers-payment-header">
                <div>
                  <p className="eyebrow">{t('sales.recordPayment')}</p>
                  <h3>{t('sales.recordPayment')}</h3>
                </div>
                <button
                  type="button"
                  className="customers-payment-close"
                  onClick={() => {
                    setPaymentSale(null);
                    setFormError('');
                  }}
                  aria-label={t('common.cancel')}
                >
                  ×
                </button>
              </div>

              <div className="customers-payment-summary">
                <div>
                  <span>Total price</span>
                  <strong>{formatMinor(Number(paymentSale.totalAmountMinor || 0))}</strong>
                </div>
                <div>
                  <span>{t('sales.amountPaid')}</span>
                  <strong>{formatMinor(Number(paymentSale.paidAmountMinor || 0))}</strong>
                </div>
                <div>
                  <span>Left price</span>
                  <strong>{formatMinor(Number(paymentSale.balanceDueMinor || 0))}</strong>
                </div>
              </div>

              <form className="customers-form" onSubmit={handleAdditionalPayment}>
                <div className="customers-form-grid">
                  <label>
                    {t('sales.amountDue')}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={additionalPayment}
                      onChange={(event) => setAdditionalPayment(event.target.value)}
                      required
                      disabled={saving}
                      autoFocus
                    />
                  </label>

                  <label>
                    {t('sales.paymentMethod')}
                    <select
                      value={additionalPaymentMethod}
                      onChange={(event) => setAdditionalPaymentMethod(event.target.value)}
                      disabled={saving}
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {t(`paymentMethods.${method.value}`)}
                        </option>
                      ))}
                    </select>
                  </label>

                </div>

                {formError && (
                  <div className="customers-alert customers-alert-error" role="alert">
                    <AlertTriangle size={17} />
                    <span>{formError}</span>
                  </div>
                )}

                {notice && (
                  <div className="customers-alert customers-alert-success" role="status">
                    <span>{notice}</span>
                  </div>
                )}

                <div className="customers-form-actions">
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? t('common.saving') : t('sales.recordPaymentBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>{t('customers.thCustomer')}</th>
                <th>{t('customers.thPhone')}</th>
                <th>{t('customers.thAddress')}</th>
                <th>{t('customers.thLastPayment')}</th>
                <th>{t('customers.thOutstanding')}</th>
                <th>{t('customers.thActions')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="customers-empty">
                    {t('customers.loadingCustomers')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="customers-empty">
                    {search ? t('customers.noMatch') : t('customers.none')}
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr key={customer._id}>
                    <td><strong>{customer.name}</strong></td>
                    <td>
                      {customer.phone
                        ? <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                        : '—'}
                    </td>
                    <td>{customer.address || '—'}</td>
                    <td>{customer.lastPaymentDate ? formatDate(customer.lastPaymentDate) : '—'}</td>
                    <td className="customers-outstanding">
                      <strong>{formatMinor(customer.balanceDueMinor)}</strong>
                    </td>
                    <td className="customers-actions-cell">
                      {customer.balanceDueMinor > 0 && customer.paymentTargetSale ? (
                        <button
                          type="button"
                          className="customers-payment-button"
                          onClick={() => openPaymentForm(customer)}
                          disabled={saving}
                        >
                          {t('sales.addPayment')}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
