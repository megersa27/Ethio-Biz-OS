import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react';

import {
  createSale,
  getCustomers,
  getProducts,
  getSales,
  recordSalePayment,
} from '../services/api.js';

import { formatMinor } from '../utils/currency.js';
import './SalesPage.css';

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

function getPaymentLabel(sale, t) {
  if (sale.saleStatus === 'CANCELLED') return t('sales.statusCancelled');

  switch (sale.paymentStatus) {
    case 'PAID':
      return t('sales.statusPaid');
    case 'PARTIAL':
      return t('sales.statusPartial');
    default:
      return t('sales.statusUnpaid');
  }
}


function ethiopiaDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function loadTodaysSales(token) {
  const today = ethiopiaDateKey();
  const [year, month, day] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1))
    .toISOString().slice(0, 10);

  // Fetch a broad UTC range, then retain only sales created on today's
  // Ethiopian calendar date.
  const filters = { startDate: yesterday, endDate: today };
  const first = await getSales(token, {
    ...filters,
    page: 1,
    limit: 100,
  });

  const rows = [...(first.sales || [])];
  const totalPages = Number(first.pagination?.totalPages || 1);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await getSales(token, {
      ...filters,
      page,
      limit: 100,
    });
    rows.push(...(result.sales || []));
  }

  return rows.filter((sale) =>
    sale.saleStatus !== 'CANCELLED' &&
    sale.createdAt &&
    ethiopiaDateKey(sale.createdAt) === today
  );
}

export default function SalesPage({ token }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [items, setItems] = useState([
    { productId: '', quantity: '' },
  ]);
  const [customerId, setCustomerId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');

  const [paymentSale, setPaymentSale] = useState(null);
  const [additionalPayment, setAdditionalPayment] = useState('');
  const [additionalPaymentMethod, setAdditionalPaymentMethod] =
    useState('cash');
  const [additionalReference, setAdditionalReference] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadSalesData() {
      setLoading(true);
      setPageError('');

      try {
        const [productResult, customerResult, salesResult, todaySalesRows] =
          await Promise.all([
            getProducts(token),
            getCustomers(token),
            getSales(token, { page: 1, limit: 20 }),
            loadTodaysSales(token),
          ]);

        if (cancelled) return;

        const productRows = productResult.products || [];
        setProducts(productRows);
        setCustomers(customerResult.customers || []);
        setSales(salesResult.sales || []);
        setTodaySales(todaySalesRows);
        setPagination(salesResult.pagination || null);

        setItems((current) =>
          current.map((item) => ({
            ...item,
            productId:
              item.productId && productRows.some(
                (product) => String(product._id) === item.productId
              )
                ? item.productId
                : '',
          }))
        );
      } catch (error) {
        if (!cancelled) {
          setPageError(error.message || t('sales.errLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSalesData();

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey, t]);

  const totalAmountMinor = useMemo(
    () =>
      items.reduce((sum, item) => {
        const product = products.find(
          (row) => String(row._id) === item.productId
        );
        const quantity = Number(item.quantity);

        if (
          !product ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          return sum;
        }

        return sum + Math.round(
          Number(product.sellingPriceMinor || 0) * quantity
        );
      }, 0),
    [items, products]
  );

  const totalOutstandingMinor = todaySales.reduce(
    (sum, sale) =>
      sale.saleStatus === 'CANCELLED'
        ? sum
        : sum + Number(sale.balanceDueMinor || 0),
    0
  );

  const totalCollectedOnPageMinor = todaySales.reduce(
    (sum, sale) => sum + Number(sale.paidAmountMinor || 0),
    0
  );

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'productId' && value && !item.quantity) {
          updated.quantity = '1';
        }
        return updated;
      })
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        productId: '',
        quantity: '',
      },
    ]);
  }

  function removeItem(index) {
    setItems((current) => {
      const remaining = current.filter(
        (_, itemIndex) => itemIndex !== index
      );

      return remaining.length
        ? remaining
        : [{ productId: '', quantity: '' }];
    });
  }

  function resetSaleForm() {
    setItems([
      {
        productId: '',
        quantity: '',
      },
    ]);
    setCustomerId('');
    setPaidAmount('');
    setPaymentMethod('cash');
    setPaymentReference('');
    setNotes('');
    setFormError('');
  }

  async function handleCreateSale(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!items.length || items.some((item) => !item.productId)) {
      setFormError(t('sales.errSelectProducts'));
      return;
    }

    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      setFormError(t('sales.errDuplicate'));
      return;
    }

    const requestedItems = [];

    for (const item of items) {
      const product = products.find(
        (row) => String(row._id) === item.productId
      );
      const quantity = Number(item.quantity);

      if (!product) {
        setFormError(t('sales.errProductNotFound'));
        return;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setFormError(t('sales.errQuantity'));
        return;
      }

      if (quantity > Number(product.stockQuantity || 0)) {
        setFormError(
          t('sales.errStock', { name: product.name, stock: product.stockQuantity })
        );
        return;
      }

      if (
        ['piece', 'box', 'pack'].includes(product.unit) &&
        !Number.isInteger(quantity)
      ) {
        setFormError(
          t('sales.errIntegerUnit', { name: product.name, unit: product.unit })
        );
        return;
      }

      requestedItems.push({
        productId: item.productId,
        quantity,
      });
    }

    const paidEtb = paidAmount === '' ? 0 : Number(paidAmount);

    if (
      !Number.isFinite(paidEtb) ||
      paidEtb < 0 ||
      !Number.isFinite(moneyToMinor(paidEtb))
    ) {
      setFormError(t('sales.errAmountPaid'));
      return;
    }

    const paidAmountMinor = moneyToMinor(paidEtb);

    if (paidAmountMinor > totalAmountMinor) {
      setFormError(t('sales.errPaidExceeds'));
      return;
    }

    if (paidAmountMinor < totalAmountMinor && !customerId) {
      setFormError(t('sales.errCreditCustomer'));
      return;
    }

    if (notes.length > 500) {
      setFormError(t('sales.errNotesLen'));
      return;
    }

    const saleData = {
      items: requestedItems,
      paidAmountMinor,
      notes: notes.trim(),
    };

    if (customerId) saleData.customerId = customerId;

    if (paidAmountMinor > 0) {
      saleData.paymentMethod = paymentMethod;
      saleData.paymentReference = paymentReference.trim();
    }

    setSaving(true);

    try {
      await createSale(token, saleData);
      setNotice(t('sales.saleSuccess'));
      resetSaleForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error.message || t('sales.errSaleFailed'));
    } finally {
      setSaving(false);
    }
  }

  function openPaymentForm(sale) {
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
        reference: additionalReference.trim(),
      });

      setNotice(t('sales.paymentSuccess'));
      setPaymentSale(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error.message || t('sales.errPaymentFailed'));
    } finally {
      setSaving(false);
    }
  }

  const customerName = (sale) => {
    const rawId = sale.customerId?._id || sale.customerId;
    if (!rawId) return t('sales.walkInCustomer');

    return (
      customers.find(
        (customer) => String(customer._id) === String(rawId)
      )?.name ||
      sale.customerId?.name ||
      t('sales.customerGeneric')
    );
  };

  return (
    <section className="sales-page">
      <div className="sales-heading">
        <div>
          <p className="eyebrow">{t('sales.eyebrow')}</p>
          <h1>{t('sales.title')}</h1>
          <p>{t('sales.lead')}</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? t('common.loading') : t('common.refresh')}
        </button>
      </div>

      {pageError && (
        <div className="sales-alert sales-alert-error" role="alert">
          <AlertTriangle size={18} />
          <span>{pageError}</span>
        </div>
      )}

      {notice && (
        <div className="sales-alert sales-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      <div className="sales-summary">
        <article className="sales-summary-card">
          <div className="sales-summary-icon"><ShoppingCart size={20} /></div>
          <div>
            <p>{t('sales.todaysSales')}</p>
            <strong>{loading ? t('common.loadingEllipsis') : todaySales.length}</strong>
            <span>{t('sales.todaysSalesNote', { limit: pagination?.limit ?? 20 })}</span>
          </div>
        </article>

        <article className="sales-summary-card">
          <div className="sales-summary-icon"><Wallet size={20} /></div>
          <div>
            <p>{t('sales.collectedToday')}</p>
            <strong>
              {loading ? t('common.loadingEllipsis') : formatMinor(totalCollectedOnPageMinor)}
            </strong>
            <span>{t('sales.collectedNote')}</span>
          </div>
        </article>

        <article className="sales-summary-card">
          <div className="sales-summary-icon sales-summary-warning"><CircleDollarSign size={20} /></div>
          <div>
            <p>{t('sales.outstandingToday')}</p>
            <strong>
              {loading ? t('common.loadingEllipsis') : formatMinor(totalOutstandingMinor)}
            </strong>
            <span>{t('sales.outstandingNote')}</span>
          </div>
        </article>
      </div>

      <div className="sales-panel">
        <div className="sales-panel-heading">
          <div className="sales-panel-icon"><ShoppingCart size={19} /></div>
          <div>
            <h2>{t('sales.recordSale')}</h2>
            <p>{t('sales.recordSaleLead')}</p>
          </div>
        </div>

        {products.length === 0 && !loading ? (
          <div className="sales-empty-products">
            <AlertTriangle size={19} />
            <div>
              <strong>{t('sales.noProductsTitle')}</strong>
              <p>{t('sales.noProductsBody')}</p>
            </div>
          </div>
        ) : (
          <form className="sales-form" onSubmit={handleCreateSale}>
            <div className="sales-lines-heading">
              <span>{t('sales.productItems')}</span>
              <button
                type="button"
                className="sales-add-line"
                onClick={addItem}
                disabled={saving || items.length >= products.length}
              >
                <Plus size={15} /> {t('sales.addProduct')}
              </button>
            </div>

            <div className="sales-lines">
              {items.map((item, index) => {
                const selectedProduct = products.find(
                  (product) => String(product._id) === item.productId
                );
                const quantity = Number(item.quantity);
                const lineTotal = selectedProduct &&
                  Number.isFinite(quantity) &&
                  quantity > 0
                  ? Math.round(
                      Number(selectedProduct.sellingPriceMinor || 0) * quantity
                    )
                  : 0;

                return (
                  <div className="sales-line" key={index}>
                    <label className="sales-product-field">
                      {t('sales.product')}
                      <select
                        value={item.productId}
                        onChange={(event) =>
                          updateItem(index, 'productId', event.target.value)
                        }
                        required
                        disabled={saving}
                      >
                        <option value="">{t('sales.selectProduct')}</option>
                        {products.map((product) => {
                          const duplicate = items.some(
                            (other, otherIndex) =>
                              otherIndex !== index &&
                              other.productId === String(product._id)
                          );

                          return (
                            <option
                              key={product._id}
                              value={product._id}
                              disabled={duplicate}
                            >
                              {product.name} · {t('products.thStock')} {product.stockQuantity} {product.unit}
                            </option>
                          );
                        })}
                      </select>
                      {selectedProduct && (
                        <span className="sales-field-help">
                          {t('sales.unitPrice', { price: formatMinor(selectedProduct.sellingPriceMinor) })}
                        </span>
                      )}
                    </label>

                    <label className="sales-quantity-field">
                      {t('sales.quantity')}
                      <input
                        type="number"
                        min={
                          selectedProduct &&
                          ['piece', 'box', 'pack'].includes(selectedProduct.unit)
                            ? '1'
                            : '0.001'
                        }
                        step={
                          selectedProduct &&
                          ['piece', 'box', 'pack'].includes(selectedProduct.unit)
                            ? '1'
                            : 'any'
                        }
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, 'quantity', event.target.value)
                        }
                        required
                        disabled={saving}
                      />
                    </label>

                    <div className="sales-line-total">
                      <span>{t('sales.lineTotal')}</span>
                      <strong>{formatMinor(lineTotal)}</strong>
                    </div>

                    <button
                      type="button"
                      className="sales-remove-line"
                      onClick={() => removeItem(index)}
                      disabled={saving}
                      aria-label={t('sales.removeLineAria', { index: index + 1 })}
                      title={t('sales.removeItem')}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="sales-total-strip">
              <div>
                <span>{t('sales.saleTotal')}</span>
                <strong>{formatMinor(totalAmountMinor)}</strong>
              </div>
              <div>
                <span>{t('sales.productsSelected')}</span>
                <strong>{items.filter((item) => item.productId).length}</strong>
              </div>
            </div>

            <div className="sales-form-grid">
              <label>
                {t('sales.customer')}
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  disabled={saving}
                >
                  <option value="">{t('sales.walkIn')}</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <span className="sales-field-help">
                  {t('sales.customerRequired')}
                </span>
              </label>

              <label>
                {t('sales.amountPaid')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              {Number(paidAmount) > 0 && (
                <>
                  <label>
                    {t('sales.paymentMethod')}
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      disabled={saving}
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {t(`paymentMethods.${method.value}`)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    {t('sales.paymentReference')}
                    <input
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      maxLength={120}
                      placeholder={t('sales.referencePh')}
                      disabled={saving}
                    />
                  </label>
                </>
              )}

              <label className="sales-notes-field">
                {t('sales.notesOptional')}
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder={t('sales.notesPh')}
                  disabled={saving}
                />
              </label>
            </div>

            <div className="sales-payment-preview">
              <div>
                <span>{t('sales.amountDue')}</span>
                <strong>
                  {formatMinor(
                    Math.max(0, totalAmountMinor - moneyToMinor(Number(paidAmount) || 0))
                  )}
                </strong>
              </div>
              <p>
                {t('sales.paymentPreview')}
              </p>
            </div>

            {formError && !paymentSale && (
              <div className="sales-alert sales-alert-error" role="alert">
                <AlertTriangle size={17} />
                <span>{formError}</span>
              </div>
            )}

            <div className="sales-form-footer">
              <span>{t('sales.reviewBefore')}</span>
              <button
                className="primary-button"
                type="submit"
                disabled={saving || loading}
              >
                {saving ? t('common.saving') : <><ShoppingCart size={16} /> {t('sales.recordSaleBtn')}</>}
              </button>
            </div>
          </form>
        )}
      </div>

      {paymentSale && (
        <div className="sales-panel sales-payment-panel">
          <div className="sales-panel-heading">
            <div className="sales-panel-icon"><Wallet size={19} /></div>
            <div>
              <h2>{t('sales.recordPayment')}</h2>
              <p>
                {t('sales.saleBalance', { amount: formatMinor(paymentSale.balanceDueMinor) })}
              </p>
            </div>
          </div>

          <form className="sales-form" onSubmit={handleAdditionalPayment}>
            <div className="sales-form-grid">
              <label>
                {t('sales.amountReceived')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={additionalPayment}
                  onChange={(event) => setAdditionalPayment(event.target.value)}
                  required
                  disabled={saving}
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

              <label className="sales-notes-field">
                {t('sales.referenceOptional')}
                <input
                  value={additionalReference}
                  onChange={(event) => setAdditionalReference(event.target.value)}
                  maxLength={120}
                  placeholder={t('sales.referencePh')}
                  disabled={saving}
                />
              </label>
            </div>

            {formError && paymentSale && (
              <div className="sales-alert sales-alert-error" role="alert">
                <AlertTriangle size={17} />
                <span>{formError}</span>
              </div>
            )}

            <div className="sales-form-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPaymentSale(null);
                  setFormError('');
                }}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('sales.recordPaymentBtn')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="sales-panel sales-history-panel">
        <div className="sales-panel-heading">
          <div className="sales-panel-icon"><History size={19} /></div>
          <div>
            <h2>{t('sales.salesHistory')}</h2>
            <p>
              {pagination
                ? t('sales.historySummary', { total: pagination.totalItems, shown: sales.length })
                : t('sales.historyDefault')}
            </p>
          </div>
        </div>

        <div className="sales-table-scroll">
          <table className="sales-table">
            <thead>
              <tr>
                <th>{t('sales.thDate')}</th>
                <th>{t('sales.thSaleId')}</th>
                <th>{t('sales.thCustomer')}</th>
                <th>{t('sales.thItems')}</th>
                <th>{t('sales.thTotal')}</th>
                <th>{t('sales.thPaid')}</th>
                <th>{t('sales.thBalance')}</th>
                <th>{t('sales.thStatus')}</th>
                <th>{t('sales.thAction')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="sales-table-empty">
                    {t('sales.loadingSales')}
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="sales-table-empty">
                    {t('sales.noSales')}
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale._id}>
                    <td>{formatDate(sale.createdAt)}</td>
                    <td className="sales-id">
                      {String(sale._id || '').slice(-8).toUpperCase()}
                    </td>
                    <td>{customerName(sale)}</td>
                    <td>
                      {Array.isArray(sale.items)
                        ? sale.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')
                        : '—'}
                    </td>
                    <td><strong>{formatMinor(sale.totalAmountMinor)}</strong></td>
                    <td>{formatMinor(sale.paidAmountMinor)}</td>
                    <td>{formatMinor(sale.balanceDueMinor)}</td>
                    <td>
                      <span className={`sales-status sales-status-${String(sale.saleStatus === 'CANCELLED' ? 'cancelled' : sale.paymentStatus || 'unpaid').toLowerCase()}`}>
                        {getPaymentLabel(sale, t)}
                      </span>
                    </td>
                    <td>
                      {sale.saleStatus !== 'CANCELLED' &&
                        Number(sale.balanceDueMinor || 0) > 0 && (
                          <button
                            type="button"
                            className="sales-payment-button"
                            onClick={() => openPaymentForm(sale)}
                            disabled={saving}
                          >
                            {t('sales.addPayment')}
                          </button>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sales-table-footer">
          <span>{t('sales.showingRecent')}</span>
          {pagination?.totalPages > 1 && (
            <span>{t('common.pageOf', { page: pagination.page, total: pagination.totalPages })}</span>
          )}
        </div>
      </div>
    </section>
  );
}
