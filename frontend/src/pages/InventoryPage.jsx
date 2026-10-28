import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  const movementOptions = [
    {
      value: 'RECEIVED',
      label: t('inventory.optReceiveLabel'),
      description: t('inventory.optReceiveDesc'),
    },
    {
      value: 'DAMAGED',
      label: t('inventory.optDamagedLabel'),
      description: t('inventory.optDamagedDesc'),
    },
    {
      value: 'EXPIRED',
      label: t('inventory.optExpiredLabel'),
      description: t('inventory.optExpiredDesc'),
    },
    {
      value: 'ADJUSTMENT_INCREASE',
      label: t('inventory.optAdjustUpLabel'),
      description: t('inventory.optAdjustUpDesc'),
    },
    {
      value: 'ADJUSTMENT_DECREASE',
      label: t('inventory.optAdjustDownLabel'),
      description: t('inventory.optAdjustDownDesc'),
    },
  ];

  const getMovementLabel = (type) => {
    switch (type) {
      case 'RECEIVED': return t('inventory.movementReceived');
      case 'DAMAGED': return t('inventory.movementDamaged');
      case 'EXPIRED': return t('inventory.movementExpired');
      case 'ADJUSTMENT_INCREASE': return t('inventory.movementAdjustmentIncrease');
      case 'ADJUSTMENT_DECREASE': return t('inventory.movementAdjustmentDecrease');
      case 'SALE': return t('inventory.movementSale');
      case 'SALE_CANCELLATION': return t('inventory.movementSaleCancellation');
      default: return type;
    }
  };

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
          setPageError(error.message || t('inventory.errLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInventory();

    return () => {
      cancelled = true;
    };
  }, [token, productFilter, reloadKey, t]);

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
      setFormError(t('inventory.errProduct'));
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError(t('inventory.errQuantity'));
      return;
    }

    if (!form.reason.trim()) {
      setFormError(t('inventory.errReason'));
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

      setNotice(t('inventory.movementSuccess'));
      setForm((current) => ({
        ...current,
        quantity: '1',
        reason: '',
      }));
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error.message || t('inventory.errMovementFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-page">
      <div className="inventory-heading">
        <div>
          <p className="eyebrow">{t('inventory.eyebrow')}</p>
          <h1>{t('inventory.title')}</h1>
          <p>{t('inventory.lead')}</p>
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
            <p>{t('inventory.activeProducts')}</p>
            <strong>{loading ? t('common.loadingEllipsis') : products.length}</strong>
          </div>
        </article>

        <article className="inventory-summary-card">
          <div className="inventory-summary-icon">
            <PackagePlus size={20} />
          </div>
          <div>
            <p>{t('inventory.totalUnits')}</p>
            <strong>{loading ? t('common.loadingEllipsis') : formatQuantity(totalUnits)}</strong>
          </div>
        </article>

        <article className="inventory-summary-card">
          <div className="inventory-summary-icon inventory-warning-icon">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p>{t('inventory.atMinimum')}</p>
            <strong>{loading ? t('common.loadingEllipsis') : lowStockCount}</strong>
          </div>
        </article>
      </div>

      <div className="inventory-panel">
        <div className="inventory-panel-heading">
          <div className="inventory-panel-icon">
            <PackagePlus size={19} />
          </div>
          <div>
            <h2>{t('inventory.recordMovement')}</h2>
            <p>{t('inventory.recordLead')}</p>
          </div>
        </div>

        <form className="inventory-form" onSubmit={handleSubmit}>
          <label>
            {t('inventory.product')}
            <select
              name="productId"
              value={form.productId}
              onChange={updateField}
              required
              disabled={loading || products.length === 0 || saving}
            >
              {products.length === 0 && (
                <option value="">{t('inventory.noProductsOption')}</option>
              )}
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {t('inventory.productOption', {
                    name: product.name,
                    stock: formatQuantity(product.stockQuantity),
                    unit: product.unit || 'piece',
                  })}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('inventory.movementType')}
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
              {t('inventory.quantity')}
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={updateField}
                min="0.001"
                step="any"
                required
                disabled={saving}
                placeholder={t('inventory.quantityPh')}
              />
            </label>

            <label>
              {t('inventory.reason')}
              <input
                type="text"
                name="reason"
                value={form.reason}
                onChange={updateField}
                maxLength={500}
                required
                disabled={saving}
                placeholder={t('inventory.reasonPh')}
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
              {t('inventory.footerNote')}
            </p>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || loading || products.length === 0}
            >
              {saving ? (
                t('common.saving')
              ) : increasesStock(form.movementType) ? (
                <><PackagePlus size={16} /> {t('inventory.recordMovementBtn')}</>
              ) : (
                <><PackageMinus size={16} /> {t('inventory.recordMovementBtn')}</>
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
            <h2>{t('inventory.movementHistory')}</h2>
            <p>
              {pagination
                ? t('inventory.historyCount', { count: pagination.total })
                : t('inventory.historyDefault')}
            </p>
          </div>
          <label className="inventory-filter">
            <span>{t('inventory.filterProduct')}</span>
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <option value="">{t('inventory.allProducts')}</option>
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
                <th>{t('inventory.thDate')}</th>
                <th>{t('inventory.thProduct')}</th>
                <th>{t('inventory.thMovement')}</th>
                <th>{t('inventory.thQuantity')}</th>
                <th>{t('inventory.thStockBefore')}</th>
                <th>{t('inventory.thStockAfter')}</th>
                <th>{t('inventory.thReason')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="inventory-empty">
                    {t('inventory.loadingMovements')}
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="inventory-empty">
                    {t('inventory.noMovements')}
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
                          {getMovementLabel(type)}
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
          <span>{t('inventory.showingMovements')}</span>
          {pagination?.totalPages > 1 && (
            <span>
              {t('common.pageOf', { page: pagination.page, total: pagination.totalPages })}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
