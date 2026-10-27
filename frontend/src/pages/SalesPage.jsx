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

import {  createCustomer,

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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState('full');
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');

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
    setItems([{ productId: String(products[0]?._id || ''), quantity: '1' }]);
    setCustomerId('');
    setPaidAmount('0');
    setPaymentMethod('cash');
    setPaymentReference('');
    setNotes('');
    setCheckoutOpen(false);
    setPaymentChoice('full');
    setCustomerMode('existing');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');
  }

  function handleOpenCheckout(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!items.length || items.some((item) => !item.productId)) {
      setFormError('Meeshaa hunda filadhu.');
      return;
    }

    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      setFormError('Meeshaa tokko irra deddeebitee hin filatin. Quantity isaa dabali.');
      return;
    }

    for (const item of items) {
      const product = products.find(
        (row) => String(row._id) === item.productId
      );
      const quantity = Number(item.quantity);

      if (!product || !Number.isFinite(quantity) || quantity <= 0) {
        setFormError('Meeshaa fi quantity sirrii galchi.');
        return;
      }

      if (quantity > Number(product.stockQuantity || 0)) {
        setFormError(
          `${product.name}: stock jiru (${product.stockQuantity}) caalaa gurguruu hin dandeessu.`
        );
        return;
      }

      if (
        ['piece', 'box', 'pack', 'g', 'ml'].includes(product.unit) &&
        !Number.isInteger(quantity)
      ) {
        setFormError(
          `${product.name}: quantity unit ${product.unit} guutuu ta'uu qaba.`
        );
        return;
      }

      if (
        ['kg', 'litre'].includes(product.unit) &&
        Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7
      ) {
        setFormError(
          `${product.name}: quantity decimal bakka sadii ol qabaachuu hin qabu.`
        );
        return;
      }
    }

    if (totalAmountMinor <= 0) {
      setFormError('Gatiin waliigalaa zero caaluu qaba.');
      return;
    }

    setCheckoutOpen(true);
  }

  async function handleCreateSale(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!items.length || items.some((item) => !item.productId)) {
      setFormError('Meeshaa hunda filadhu.');
      setCheckoutOpen(false);
      return;
    }

    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      setFormError('Meeshaa tokko irra deddeebitee hin filatin. Quantity isaa dabali.');
      return;
    }

    for (const item of items) {
      const product = products.find(
        (row) => String(row._id) === item.productId
      );
      const quantity = Number(item.quantity);

      if (!product || !Number.isFinite(quantity) || quantity <= 0) {
        setFormError('Meeshaa fi quantity sirrii galchi.');
        return;
      }

      if (quantity > Number(product.stockQuantity || 0)) {
        setFormError(
          `${product.name}: stock jiru (${product.stockQuantity}) caalaa gurguruu hin dandeessu.`
        );
        return;
      }

      if (
        ['piece', 'box', 'pack', 'g', 'ml'].includes(product.unit) &&
        !Number.isInteger(quantity)
      ) {
        setFormError(`${product.name}: quantity unit ${product.unit} guutuu galchi.`);
        return;
      }

      if (
        ['kg', 'litre'].includes(product.unit) &&
        Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7
      ) {
        setFormError(`${product.name}: quantity decimal bakka sadii ol qabaachuu hin qabu.`);
        return;
      }
    }

    let paidAmountMinor = 0;

    if (paymentChoice === 'full') {
      paidAmountMinor = totalAmountMinor;
    } else if (paymentChoice === 'partial') {
      const paidEtb = Number(paidAmount);
      if (!Number.isFinite(paidEtb) || paidEtb <= 0) {
        setFormError('Mallaqa kaffalame sirriitti galchi.');
        return;
      }

      paidAmountMinor = moneyToMinor(paidEtb);

      if (paidAmountMinor >= totalAmountMinor) {
        setFormError('Kaffaltiin guutuu yoo ta’e, Paid in full filadhu.');
        return;
      }
    } else if (paymentChoice !== 'credit') {
      setFormError('Akkataa kaffaltii sirrii filadhu.');
      return;
    }

    if (paidAmountMinor > totalAmountMinor) {
      setFormError('Kaffaltiin waliigala gurgurtaa caaluu hin qabu.');
      return;
    }

    if (notes.length > 500) {
      setFormError('Notes 500 characters caaluu hin qabu.');
      return;
    }

    if (customerMode === 'new' && !newCustomerName.trim()) {
      setFormError('Maqaa customer haaraa galchi.');
      return;
    }

    if (
      paymentChoice !== 'full' &&
      customerMode !== 'new' &&
      !customerId
    ) {
      setFormError('Partial payment ykn credit irratti customer filachuun dirqama.');
      return;
    }

    setSaving(true);

    try {
      let selectedCustomerId = customerMode === 'existing' ? customerId : '';
      let createdCustomer = null;

      if (customerMode === 'new') {
        const customerResult = await createCustomer(token, {
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          email: newCustomerEmail.trim(),
          address: newCustomerAddress.trim(),
        });

        createdCustomer = customerResult.customer || customerResult.data?.customer || customerResult;
        selectedCustomerId = String(
          createdCustomer?._id || createdCustomer?.id || ''
        );

        if (!selectedCustomerId) {
          throw new Error(
            'Customer uumameera, garuu ID isaa hin argamne. Customer list ilaali.'
          );
        }
      }

      if (paidAmountMinor < totalAmountMinor && !selectedCustomerId) {
        throw new Error('Balance yoo jiraate customer filachuun dirqama.');
      }

      const requestedItems = items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      }));

      const saleData = {
        items: requestedItems,
        paidAmountMinor,
        notes: notes.trim(),
      };

      if (selectedCustomerId) {
        saleData.customerId = selectedCustomerId;
      }

      if (paidAmountMinor > 0) {
        saleData.paymentMethod = paymentMethod;
        saleData.paymentReference = paymentReference.trim();
      }

      await createSale(token, saleData);

      if (createdCustomer) {
        setCustomers((current) => [
          ...current,
          createdCustomer,
        ]);
      }

      setNotice(
        paidAmountMinor < totalAmountMinor
          ? 'Gurgurtaan galmaa’eera; balance due customer waliin kuufameera.'
          : 'Gurgurtaan milkaa’inaan galmaa’eera; stock haaromfameera.'
      );

      resetSaleForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(
        error.message || 'Gurgurtaa galmeessuun hin milkoofne.'
      );
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
          <form className="sales-form" onSubmit={checkoutOpen ? handleCreateSale : handleOpenCheckout}>
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

            {checkoutOpen && (
              <section className="sales-checkout">
                <div className="sales-checkout-heading">
                  <h3>Payment and customer</h3>
                  <p>Choose how the customer will pay. Prices are calculated automatically.</p>
                </div>

                <div className="sales-form-grid">
                  <label>
                    How will the customer pay?
                    <select
                      value={paymentChoice}
                      onChange={(event) => {
                        setPaymentChoice(event.target.value);
                        setFormError('');
                        if (event.target.value === 'full') setPaidAmount('0');
                      }}
                      disabled={saving}
                    >
                      <option value="full">Paid in full</option>
                      <option value="partial">Partial payment</option>
                      <option value="credit">Credit / Pay later</option>
                    </select>
                  </label>

                  {paymentChoice === 'partial' && (
                    <label>
                      Amount received (ETB)
                      <input
                        type="number"
                        min="0.01"
                        max={(totalAmountMinor / 100).toFixed(2)}
                        step="0.01"
                        value={paidAmount}
                        onChange={(event) => setPaidAmount(event.target.value)}
                        required
                        disabled={saving}
                      />
                    </label>
                  )}

                  <label className="sales-customer-choice">
                    Customer {paymentChoice === 'full' ? '(optional)' : '(required)'}
                    <select
                      value={customerMode === 'new' ? '__new__' : customerId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFormError('');
                        if (value === '__new__') {
                          setCustomerMode('new');
                          setCustomerId('');
                        } else {
                          setCustomerMode('existing');
                          setCustomerId(value);
                        }
                      }}
                      disabled={saving}
                    >
                      <option value="">Walk-in customer</option>
                      {customers.map((customer) => (
                        <option key={customer._id || customer.id} value={customer._id || customer.id}>
                          {customer.name}{customer.phone ? ` · ${customer.phone}` : ''}
                        </option>
                      ))}
                      <option value="__new__">+ Add a new customer</option>
                    </select>
                    <span className="sales-field-help">
                      Partial payment or credit must be linked to a customer.
                    </span>
                  </label>

                  {paymentChoice !== 'credit' && (
                    <label>
                      Payment method
                      <select
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                        disabled={saving}
                      >
                        {paymentMethods.map((method) => (
                          <option key={method.value} value={method.value}>{method.label}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {paymentChoice !== 'credit' && (
                    <label>
                      Payment reference (optional)
                      <input
                        value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                        maxLength={120}
                        placeholder="Receipt or transaction number"
                        disabled={saving}
                      />
                    </label>
                  )}

                  {customerMode === 'new' && (
                    <div className="sales-new-customer">
                      <h4>New customer details</h4>
                      <div className="sales-form-grid">
                        <label>
                          Customer name
                          <input
                            value={newCustomerName}
                            onChange={(event) => setNewCustomerName(event.target.value)}
                            maxLength={150}
                            required
                            disabled={saving}
                            placeholder="Full customer name"
                          />
                        </label>
                        <label>
                          Phone number
                          <input
                            value={newCustomerPhone}
                            onChange={(event) => setNewCustomerPhone(event.target.value)}
                            maxLength={30}
                            disabled={saving}
                            placeholder="Phone number"
                          />
                        </label>
                        <label>
                          Email (optional)
                          <input
                            type="email"
                            value={newCustomerEmail}
                            onChange={(event) => setNewCustomerEmail(event.target.value)}
                            maxLength={254}
                            disabled={saving}
                            placeholder="name@example.com"
                          />
                        </label>
                        <label>
                          Address (optional)
                          <input
                            value={newCustomerAddress}
                            onChange={(event) => setNewCustomerAddress(event.target.value)}
                            maxLength={300}
                            disabled={saving}
                            placeholder="Town or area"
                          />
                        </label>
                      </div>
                    </div>
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
                    <span>Total sale</span>
                    <strong>{formatMinor(totalAmountMinor)}</strong>
                  </div>
                  <div>
                    <span>Amount received</span>
                    <strong>
                      {formatMinor(
                        paymentChoice === 'full'
                          ? totalAmountMinor
                          : paymentChoice === 'credit'
                            ? 0
                            : Math.max(0, moneyToMinor(Number(paidAmount) || 0))
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Balance due</span>
                    <strong>
                      {formatMinor(
                        Math.max(
                          0,
                          totalAmountMinor - (
                            paymentChoice === 'full'
                              ? totalAmountMinor
                              : paymentChoice === 'credit'
                                ? 0
                                : Math.max(0, moneyToMinor(Number(paidAmount) || 0))
                          )
                        )
                      )}
                    </strong>
                  </div>
                </div>
              </section>
            )}

            {formError && !paymentSale && (
              <div className="sales-alert sales-alert-error" role="alert">
                <AlertTriangle size={17} />
                <span>{formError}</span>
              </div>
            )}

            <div className="sales-form-footer">
              {!checkoutOpen ? (
                <span>Product and quantity only. The sale price is calculated automatically.</span>
              ) : (
                <button
                  type="button"
                  className="secondary-button sales-back-button"
                  onClick={() => {
                    setCheckoutOpen(false);
                    setFormError('');
                  }}
                  disabled={saving}
                >
                  Back to items
                </button>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={saving || loading}
              >
                {saving
                  ? 'Saving…'
                  : checkoutOpen
                    ? 'Confirm sale'
                    : 'Sell / Pay'}
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
