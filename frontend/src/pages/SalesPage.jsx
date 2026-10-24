import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  History,
  Plus,
  RefreshCw,
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

function getPaymentLabel(sale) {
  if (sale.saleStatus === 'CANCELLED') return 'Cancelled';

  switch (sale.paymentStatus) {
    case 'PAID':
      return 'Paid';
    case 'PARTIAL':
      return 'Partially paid';
    default:
      return 'Unpaid';
  }
}

export default function SalesPage({ token }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [items, setItems] = useState([
    { productId: '', quantity: '1' },
  ]);
  const [customerId, setCustomerId] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
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
        const [productResult, customerResult, salesResult] =
          await Promise.all([
            getProducts(token),
            getCustomers(token),
            getSales(token, { page: 1, limit: 20 }),
          ]);

        if (cancelled) return;

        const productRows = productResult.products || [];
        setProducts(productRows);
        setCustomers(customerResult.customers || []);
        setSales(salesResult.sales || []);
        setPagination(salesResult.pagination || null);

        setItems((current) =>
          current.map((item, index) => ({
            ...item,
            productId:
              item.productId && productRows.some(
                (product) => String(product._id) === item.productId
              )
                ? item.productId
                : index === 0
                  ? String(productRows[0]?._id || '')
                  : item.productId,
          }))
        );
      } catch (error) {
        if (!cancelled) {
          setPageError(error.message || 'Sales data could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSalesData();

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

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

  const totalOutstandingMinor = sales.reduce(
    (sum, sale) =>
      sale.saleStatus === 'CANCELLED'
        ? sum
        : sum + Number(sale.balanceDueMinor || 0),
    0
  );

  const totalCollectedOnPageMinor = sales.reduce(
    (sum, sale) => sum + Number(sale.paidAmountMinor || 0),
    0
  );

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function addItem() {
    const used = new Set(items.map((item) => item.productId));
    const nextProduct = products.find(
      (product) => !used.has(String(product._id))
    );

    setItems((current) => [
      ...current,
      {
        productId: String(nextProduct?._id || ''),
        quantity: '1',
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
        : [{ productId: '', quantity: '1' }];
    });
  }

  function resetSaleForm() {
    setItems([
      {
        productId: String(products[0]?._id || ''),
        quantity: '1',
      },
    ]);
    setCustomerId('');
    setPaidAmount('0');
    setPaymentMethod('cash');
    setPaymentReference('');
    setNotes('');
  }

  async function handleCreateSale(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!items.length || items.some((item) => !item.productId)) {
      setFormError('Product hunda filadhu.');
      return;
    }

    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      setFormError(
        'Product tokko sale tokko keessatti irra deddeebitee hin filatin. Quantity isaa sarara tokko keessatti walitti qabi.'
      );
      return;
    }

    const requestedItems = [];

    for (const item of items) {
      const product = products.find(
        (row) => String(row._id) === item.productId
      );
      const quantity = Number(item.quantity);

      if (!product) {
        setFormError('Product filatame hin argamne.');
        return;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setFormError('Quantity zeeroo caalu galchi.');
        return;
      }

      if (quantity > Number(product.stockQuantity || 0)) {
        setFormError(
          `${product.name}: stock jiru (${product.stockQuantity}) caalaa gurguruu hin dandeessu.`
        );
        return;
      }

      if (
        ['piece', 'box', 'pack'].includes(product.unit) &&
        !Number.isInteger(quantity)
      ) {
        setFormError(
          `${product.name}: unit ${product.unit} waan ta'eef quantity guutuu (integer) galchi.`
        );
        return;
      }

      requestedItems.push({
        productId: item.productId,
        quantity,
      });
    }

    const paidEtb = Number(paidAmount);

    if (
      !Number.isFinite(paidEtb) ||
      paidEtb < 0 ||
      !Number.isFinite(moneyToMinor(paidEtb))
    ) {
      setFormError('Amount paid sirrii galchi.');
      return;
    }

    const paidAmountMinor = moneyToMinor(paidEtb);

    if (paidAmountMinor > totalAmountMinor) {
      setFormError('Kaffaltiin total sale caaluu hin qabu.');
      return;
    }

    if (paidAmountMinor < totalAmountMinor && !customerId) {
      setFormError(
        'Sale keessatti liqiin yoo jiraate maamila filachuun dirqama.'
      );
      return;
    }

    if (notes.length > 500) {
      setFormError('Notes 500 characters caaluu hin qabu.');
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
      setNotice('Gurgurtaan milkaa’inaan galmaa’eera; stock ofumaan haaromfameera.');
      resetSaleForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error.message || 'Gurgurtaa galmeessuun hin milkoofne.');
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
      setFormError('Kaffaltii zeeroo caalu galchi.');
      return;
    }

    if (amountMinor > balanceMinor) {
      setFormError('Kaffaltiin balance hafee caaluu hin qabu.');
      return;
    }

    setSaving(true);

    try {
      await recordSalePayment(token, paymentSale._id, {
        amountMinor,
        paymentMethod: additionalPaymentMethod,
        reference: additionalReference.trim(),
      });

      setNotice('Kaffaltiin dabalataa galmaa’eera.');
      setPaymentSale(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error.message || 'Kaffaltii galmeessuun hin milkoofne.');
    } finally {
      setSaving(false);
    }
  }

  const customerName = (sale) => {
    const rawId = sale.customerId?._id || sale.customerId;
    if (!rawId) return 'Walk-in customer';

    return (
      customers.find(
        (customer) => String(customer._id) === String(rawId)
      )?.name ||
      sale.customerId?.name ||
      'Customer'
    );
  };

  return (
    <section className="sales-page">
      <div className="sales-heading">
        <div>
          <p className="eyebrow">YOUR BUSINESS WORKSPACE</p>
          <h1>Sales Management</h1>
          <p>Gurgurtaa galmeessi, kaffaltii hordofi, seenaa gurgurtaa ilaali.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? 'Loading…' : 'Refresh'}
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
            <p>Recent sales</p>
            <strong>{loading ? '…' : sales.length}</strong>
            <span>Latest {pagination?.limit ?? 20} records</span>
          </div>
        </article>

        <article className="sales-summary-card">
          <div className="sales-summary-icon"><Wallet size={20} /></div>
          <div>
            <p>Collected on this page</p>
            <strong>
              {loading ? '…' : formatMinor(totalCollectedOnPageMinor)}
            </strong>
            <span>Recorded payment totals</span>
          </div>
        </article>

        <article className="sales-summary-card">
          <div className="sales-summary-icon sales-summary-warning"><CircleDollarSign size={20} /></div>
          <div>
            <p>Outstanding on this page</p>
            <strong>
              {loading ? '…' : formatMinor(totalOutstandingMinor)}
            </strong>
            <span>Unpaid balances in recent sales</span>
          </div>
        </article>
      </div>

      <div className="sales-panel">
        <div className="sales-panel-heading">
          <div className="sales-panel-icon"><ShoppingCart size={19} /></div>
          <div>
            <h2>Record a sale</h2>
            <p>Select products and quantities. Prices are verified by the server.</p>
          </div>
        </div>

        {products.length === 0 && !loading ? (
          <div className="sales-empty-products">
            <AlertTriangle size={19} />
            <div>
              <strong>Active products hin jiran.</strong>
              <p>Dura Products page irraa product fi gatii isaa galmeessi.</p>
            </div>
          </div>
        ) : (
          <form className="sales-form" onSubmit={handleCreateSale}>
            <div className="sales-lines-heading">
              <span>Product items</span>
              <button
                type="button"
                className="sales-add-line"
                onClick={addItem}
                disabled={saving || items.length >= products.length}
              >
                <Plus size={15} /> Add product
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
                      Product
                      <select
                        value={item.productId}
                        onChange={(event) =>
                          updateItem(index, 'productId', event.target.value)
                        }
                        required
                        disabled={saving}
                      >
                        <option value="">Select a product</option>
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
                              {product.name} · Stock {product.stockQuantity} {product.unit}
                            </option>
                          );
                        })}
                      </select>
                      {selectedProduct && (
                        <span className="sales-field-help">
                          Unit price: {formatMinor(selectedProduct.sellingPriceMinor)}
                        </span>
                      )}
                    </label>

                    <label className="sales-quantity-field">
                      Quantity
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
                      <span>Line total</span>
                      <strong>{formatMinor(lineTotal)}</strong>
                    </div>

                    <button
                      type="button"
                      className="sales-remove-line"
                      onClick={() => removeItem(index)}
                      disabled={saving}
                      aria-label={`Remove product line ${index + 1}`}
                      title="Remove item"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="sales-total-strip">
              <div>
                <span>Sale total</span>
                <strong>{formatMinor(totalAmountMinor)}</strong>
              </div>
              <div>
                <span>Products selected</span>
                <strong>{items.filter((item) => item.productId).length}</strong>
              </div>
            </div>

            <div className="sales-form-grid">
              <label>
                Customer
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  disabled={saving}
                >
                  <option value="">Walk-in customer (no credit)</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <span className="sales-field-help">
                  Customer is required if any balance remains unpaid.
                </span>
              </label>

              <label>
                Amount paid (ETB)
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
                    Payment method
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      disabled={saving}
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Payment reference (optional)
                    <input
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      maxLength={120}
                      placeholder="Transaction reference"
                      disabled={saving}
                    />
                  </label>
                </>
              )}

              <label className="sales-notes-field">
                Notes (optional)
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Optional notes for this sale"
                  disabled={saving}
                />
              </label>
            </div>

            <div className="sales-payment-preview">
              <div>
                <span>Amount due</span>
                <strong>
                  {formatMinor(
                    Math.max(0, totalAmountMinor - moneyToMinor(Number(paidAmount) || 0))
                  )}
                </strong>
              </div>
              <p>
                Backend gatii dhugaa mirkaneessa, stock hir’isa, sale fi inventory history waliin galmeessa.
              </p>
            </div>

            {formError && !paymentSale && (
              <div className="sales-alert sales-alert-error" role="alert">
                <AlertTriangle size={17} />
                <span>{formError}</span>
              </div>
            )}

            <div className="sales-form-footer">
              <span>Review the total and payment before recording.</span>
              <button
                className="primary-button"
                type="submit"
                disabled={saving || loading}
              >
                {saving ? 'Saving…' : <><ShoppingCart size={16} /> Record sale</>}
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
              <h2>Record additional payment</h2>
              <p>
                Sale balance: {formatMinor(paymentSale.balanceDueMinor)}
              </p>
            </div>
          </div>

          <form className="sales-form" onSubmit={handleAdditionalPayment}>
            <div className="sales-form-grid">
              <label>
                Amount received (ETB)
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
                Payment method
                <select
                  value={additionalPaymentMethod}
                  onChange={(event) => setAdditionalPaymentMethod(event.target.value)}
                  disabled={saving}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sales-notes-field">
                Reference (optional)
                <input
                  value={additionalReference}
                  onChange={(event) => setAdditionalReference(event.target.value)}
                  maxLength={120}
                  placeholder="Transaction reference"
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
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="sales-panel sales-history-panel">
        <div className="sales-panel-heading">
          <div className="sales-panel-icon"><History size={19} /></div>
          <div>
            <h2>Sales history</h2>
            <p>
              {pagination
                ? `${pagination.totalItems} sales in total · Latest ${sales.length} shown`
                : 'Recent sales and payment status'}
            </p>
          </div>
        </div>

        <div className="sales-table-scroll">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Sale ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="sales-table-empty">
                    Loading sales…
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="sales-table-empty">
                    No sales recorded yet. Use the form above to record the first sale.
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
                        {getPaymentLabel(sale)}
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
                            Add payment
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
          <span>Showing up to 20 recent sales.</span>
          {pagination?.totalPages > 1 && (
            <span>Page {pagination.page} of {pagination.totalPages}</span>
          )}
        </div>
      </div>
    </section>
  );
}
