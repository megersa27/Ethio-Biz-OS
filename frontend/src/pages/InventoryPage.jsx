import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  History,
  Package,
  PackageMinus,
  PackagePlus,
  RefreshCw,
} from 'lucide-react';

import {
  getProducts,
  getInventoryMovements,
  recordInventoryMovement,
} from '../services/api.js';

import './InventoryPage.css';

const movementOptions = [
  {
    value: 'RECEIVED',
    label: 'Receive stock',
    description: 'Stock haaraa kuusaatti dabaluu.',
  },
  {
    value: 'DAMAGED',
    label: 'Damaged stock',
    description: 'Meeshaa miidhame stock irraa hir’isuu.',
  },
  {
    value: 'EXPIRED',
    label: 'Expired stock',
    description: 'Meeshaa yeroon isaa darbe stock irraa hir’isuu.',
  },
  {
    value: 'ADJUSTMENT_INCREASE',
    label: 'Stock adjustment — increase',
    description: 'Lakkoofsa stock dabaluun sirreessuu.',
  },
  {
    value: 'ADJUSTMENT_DECREASE',
    label: 'Stock adjustment — decrease',
    description: 'Lakkoofsa stock hir’isuun sirreessuu.',
  },
];

const movementLabels = {
  RECEIVED: 'Received',
  DAMAGED: 'Damaged',
  EXPIRED: 'Expired',
  ADJUSTMENT_INCREASE: 'Adjustment +',
  ADJUSTMENT_DECREASE: 'Adjustment −',
  SALE: 'Sale',
  SALE_CANCELLATION: 'Sale cancellation',
};

const increasesStock = (type) =>
  type === 'RECEIVED' || type === 'ADJUSTMENT_INCREASE';

function formatQuantity(value) {
  return Number(value ?? 0).toLocaleString('en-ET', {
    maximumFractionDigits: 3,
  });
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-ET', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function InventoryPage({ token }) {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [productFilter, setProductFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({
    productId: '',
    movementType: 'RECEIVED',
    quantity: '1',
    reason: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoading(true);
      setPageError('');

      try {
        const options = { page: 1, limit: 20 };
        if (productFilter) options.productId = productFilter;

        const [productResult, movementResult] = await Promise.all([
          getProducts(token),
          getInventoryMovements(token, options),
        ]);

        if (cancelled) return;

        const rows = productResult.products || [];
        setProducts(rows);
        setMovements(movementResult.movements || []);
        setPagination(movementResult.pagination || null);

        setForm((current) => ({
          ...current,
          productId:
            current.productId && rows.some(
              (product) => String(product._id) === current.productId
            )
              ? current.productId
              : String(rows[0]?._id || ''),
        }));
      } catch (error) {
        if (!cancelled) {
          setPageError(error.message || 'Inventory data loading failed.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInventory();

    return () => {
      cancelled = true;
    };
  }, [token, productFilter, reloadKey]);

  const totalUnits = products.reduce(
    (sum, product) => sum + Number(product.stockQuantity || 0),
    0
  );

  const lowStockCount = products.filter(
    (product) =>
      Number(product.stockQuantity || 0) <=
      Number(product.minimumStockLevel ?? 0)
  ).length;

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    const quantity = Number(form.quantity);

    if (!form.productId) {
      setFormError('Dura product filadhu.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError('Quantity lakkoofsa zeeroo caalu galchi.');
      return;
    }

    if (!form.reason.trim()) {
      setFormError('Sababaa sochii stock galchi.');
      return;
    }

    setSaving(true);

    try {
      await recordInventoryMovement(token, {
        productId: form.productId,
        movementType: form.movementType,
        quantity,
        reason: form.reason.trim(),
      });

      setNotice('Inventory movement milkaa’inaan galmaa’eera.');
      setForm((current) => ({
        ...current,
        quantity: '1',
        reason: '',
      }));
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error.message || 'Stock movement galmeessuun hin milkoofne.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-page">
      <div className="inventory-heading">
        <div>
          <p className="eyebrow">STOCK CONTROL</p>
          <h1>Inventory Management</h1>
          <p>Stock dabaluu, hir’isuu fi sochiiwwan isaa hordofuu.</p>
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
        <div className="inventory-alert inventory-alert-error" role="alert">
          <AlertTriangle size={18} />
          <span>{pageError}</span>
        </div>
      )}

      <div className="inventory-summary">
        <article className="inventory-summary-card">
          <div className="inventory-summary-icon">
            <Package size={20} />
          </div>
          <div>
            <p>Active products</p>
            <strong>{loading ? '…' : products.length}</strong>
          </div>
        </article>

        <article className="inventory-summary-card">
          <div className="inventory-summary-icon">
            <PackagePlus size={20} />
          </div>
          <div>
            <p>Total stock units</p>
            <strong>{loading ? '…' : formatQuantity(totalUnits)}</strong>
          </div>
        </article>

        <article className="inventory-summary-card">
          <div className="inventory-summary-icon inventory-warning-icon">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p>At / below minimum</p>
            <strong>{loading ? '…' : lowStockCount}</strong>
          </div>
        </article>
      </div>

      <div className="inventory-panel">
        <div className="inventory-panel-heading">
          <div className="inventory-panel-icon">
            <PackagePlus size={19} />
          </div>
          <div>
            <h2>Record stock movement</h2>
            <p>Sochii stock hundumaaf quantity fi sababaa galchi.</p>
          </div>
        </div>

        <form className="inventory-form" onSubmit={handleSubmit}>
          <label>
            Product
            <select
              name="productId"
              value={form.productId}
              onChange={updateField}
              required
              disabled={loading || products.length === 0 || saving}
            >
              {products.length === 0 && (
                <option value="">No active products available</option>
              )}
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name} — {formatQuantity(product.stockQuantity)}{' '}
                  {product.unit || 'piece'} in stock
                </option>
              ))}
            </select>
          </label>

          <label>
            Movement type
            <select
              name="movementType"
              value={form.movementType}
              onChange={updateField}
              disabled={saving}
            >
              {movementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="inventory-field-hint">
              {movementOptions.find(
                (option) => option.value === form.movementType
              )?.description}
            </span>
          </label>

          <div className="inventory-form-grid">
            <label>
              Quantity
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={updateField}
                min="0.001"
                step="any"
                required
                disabled={saving}
                placeholder="e.g. 10"
              />
            </label>

            <label>
              Reason
              <input
                type="text"
                name="reason"
                value={form.reason}
                onChange={updateField}
                maxLength={500}
                required
                disabled={saving}
                placeholder="e.g. New supplier delivery"
              />
            </label>
          </div>

          {formError && (
            <div className="inventory-alert inventory-alert-error" role="alert">
              <AlertTriangle size={17} />
              <span>{formError}</span>
            </div>
          )}

          {notice && (
            <div className="inventory-alert inventory-alert-success" role="status">
              {notice}
            </div>
          )}

          <div className="inventory-form-footer">
            <p>
              Stock will be updated and the movement saved to history together.
            </p>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || loading || products.length === 0}
            >
              {saving ? (
                'Saving…'
              ) : increasesStock(form.movementType) ? (
                <><PackagePlus size={16} /> Record movement</>
              ) : (
                <><PackageMinus size={16} /> Record movement</>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="inventory-panel inventory-history-panel">
        <div className="inventory-panel-heading inventory-history-heading">
          <div className="inventory-panel-icon">
            <History size={19} />
          </div>
          <div>
            <h2>Movement history</h2>
            <p>
              {pagination
                ? `${pagination.total} recorded movements`
                : 'Recent stock movements'}
            </p>
          </div>
          <label className="inventory-filter">
            <span>Filter product</span>
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Movement</th>
                <th>Quantity</th>
                <th>Stock before</th>
                <th>Stock after</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="inventory-empty">
                    Loading movements…
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="inventory-empty">
                    No stock movements found. Record a movement above to begin.
                  </td>
                </tr>
              ) : (
                movements.map((movement) => {
                  const type = movement.movementType;
                  const positive =
                    type === 'RECEIVED' || type === 'ADJUSTMENT_INCREASE' ||
                    type === 'SALE_CANCELLATION';

                  const productName =
                    movement.productId && typeof movement.productId === 'object'
                      ? movement.productId.name
                      : products.find(
                          (product) =>
                            String(product._id) === String(movement.productId)
                        )?.name || 'Product';

                  return (
                    <tr key={movement._id}>
                      <td>{formatDate(movement.createdAt)}</td>
                      <td><strong>{productName}</strong></td>
                      <td>
                        <span
                          className={`inventory-type-badge ${
                            positive ? 'inventory-type-positive' : 'inventory-type-negative'
                          }`}
                        >
                          {movementLabels[type] || type}
                        </span>
                      </td>
                      <td>
                        <strong className={positive ? 'inventory-quantity-positive' : 'inventory-quantity-negative'}>
                          {positive ? '+' : '−'}{formatQuantity(movement.quantity)}
                        </strong>
                        {' '}
                        {movement.productId?.unit || ''}
                      </td>
                      <td>{formatQuantity(movement.stockBefore)}</td>
                      <td>{formatQuantity(movement.stockAfter)}</td>
                      <td className="inventory-reason">{movement.reason}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="inventory-table-footer">
          <span>Showing up to 20 movements at a time.</span>
          {pagination?.totalPages > 1 && (
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
