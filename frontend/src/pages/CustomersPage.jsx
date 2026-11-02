import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Search, UserRound, X } from 'lucide-react';

import { getCustomers, getSales } from '../services/api.js';
import { formatMinor } from '../utils/currency.js';
import './CustomersPage.css';

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
            },
          ])
        );

        // Aggregate the current outstanding balance for each customer.
        allSales.forEach((sale) => {
          const balance = Number(sale.balanceDueMinor || 0);

          if (
            sale.saleStatus === 'CANCELLED' ||
            !Number.isFinite(balance) ||
            balance <= 0
          ) {
            return;
          }

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
            };
            customerMap.set(id, customer);
          }

          customer.balanceDueMinor += balance;
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

      {/* One summary card: distinct customers who currently owe money. */}
      <div className="customers-summary">
        <article className="customers-total-card">
          <div className="customers-total-icon">
            <UserRound size={25} />
          </div>
          <div>
            <p>{t('customers.totalCreditCustomers')}</p>
            <strong>
              {loading ? t('common.loadingEllipsis') : customers.length}
            </strong>
          </div>
        </article>
      </div>

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

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>{t('customers.thCustomer')}</th>
                <th>{t('customers.thPhone')}</th>

                <th>{t('customers.thAddress')}</th>
                <th>{t('customers.thOutstanding')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="customers-empty">
                    {t('customers.loadingCustomers')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="customers-empty">
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
                    <td className="customers-outstanding">
                      <strong>{formatMinor(customer.balanceDueMinor)}</strong>
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
