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
import { useAutoDismissNotice } from '../utils/useAutoDismissNotice.js';

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
  const [productSearch, setProductSearch] = useState('');
  const [productSearchFocused, setProductSearchFocused] = useState(false);
  const [reasonSearchFocused, setReasonSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({
    productId: '',
    movementType: '',
    quantity: '',
    reason: '',
  });
  const [keepSelectionEmpty, setKeepSelectionEmpty] = useState(true);

  useAutoDismissNotice(notice, setNotice);

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

  const reasonSuggestions = [
    'Supplier delivery',
    'Damaged goods',
    'Expired stock',
    'Stock adjustment',
    'Customer return',
    'Inventory count correction',
    'Warehouse transfer',
    'Lost stock',
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

        setForm((current) => {
          if (keepSelectionEmpty) {
            return {
              ...current,
              productId: '',
            };
          }

          if (current.productId && rows.some(
            (product) => String(product._id) === current.productId
          )) {
            return current;
          }

          return {
            ...current,
            productId: '',
          };
        });
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

    if (name === 'productId') {
      setKeepSelectionEmpty(false);
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleProductSearch(event) {
    const nextValue = event.target.value;
    setProductSearch(nextValue);

    const normalized = nextValue.trim().toLowerCase();
    const selectedProduct = products.find(
      (product) => product.name.trim().toLowerCase() === normalized
    );

    setKeepSelectionEmpty(false);
    setForm((current) => ({
      ...current,
      productId: selectedProduct ? String(selectedProduct._id) : '',
    }));
  }

  function handleProductFieldFocus() {
    setProductSearchFocused((current) => {
      if (current) {
        setProductSearch('');
        setForm((currentForm) => ({ ...currentForm, productId: '' }));
        return false;
      }

      return true;
    });
  }

  function handleProductSelect(product) {
    setKeepSelectionEmpty(false);
    setProductSearch(product.name);
    setProductSearchFocused(false);
    setForm((current) => ({
      ...current,
      productId: String(product._id),
    }));
  }

  function closeProductSuggestions() {
    setProductSearchFocused(false);
  }

  function handleReasonFieldFocus() {
    setReasonSearchFocused((current) => {
      if (current) {
        setForm((currentForm) => ({ ...currentForm, reason: '' }));
        return false;
      }

      return true;
    });
  }

  function handleReasonSelect(reason) {
    setForm((current) => ({
      ...current,
      reason,
    }));
    setReasonSearchFocused(false);
  }

  function closeReasonSuggestions() {
    setReasonSearchFocused(false);
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

    if (!form.movementType) {
      setFormError(t('inventory.errMovementType'));
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
      setKeepSelectionEmpty(true);
      setProductSearch('');
      setForm({
        productId: '',
        movementType: '',
        quantity: '',
        reason: '',
      });
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
            <div className="inventory-product-search-wrap">
              <input
                type="text"
                name="productSearch"
                className="inventory-product-search"
                value={productSearch}
                onChange={handleProductSearch}
                onFocus={handleProductFieldFocus}
                onBlur={() => setTimeout(closeProductSuggestions, 100)}
                required
                disabled={loading || products.length === 0 || saving}
                placeholder={products.length === 0 ? t('inventory.noProductsOption') : 'Type product name'}
              />

              {productSearchFocused && (
                <ul className="inventory-product-suggestions">
                  {(productSearch.trim()
                    ? products.filter((product) =>
                        product.name.toLowerCase().includes(productSearch.trim().toLowerCase())
                      )
                    : products
                  )
                    .slice(0, 8)
                    .map((product) => (
                      <li key={product._id}>
                        <button
                          type="button"
                          className="inventory-product-suggestion"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleProductSelect(product);
                          }}
                        >
                          <span>{product.name}</span>
                          <small>
                            {formatQuantity(product.stockQuantity)} {product.unit || 'piece'}
                          </small>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </label>

          <label>
            {t('inventory.movementType')}
            <select
              name="movementType"
              value={form.movementType}
              onChange={updateField}
              disabled={saving}
            >
              <option value="" hidden>{t('inventory.chooseMovement')}</option>
              {movementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="inventory-field-hint">
              {form.movementType
                ? movementOptions.find(
                    (option) => option.value === form.movementType
                  )?.description
                : ' '}
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
              <div className="inventory-reason-search-wrap">
                <input
                  type="text"
                  name="reason"
                  className="inventory-reason-search"
                  value={form.reason}
                  onChange={updateField}
                  onFocus={handleReasonFieldFocus}
                  onBlur={() => setTimeout(closeReasonSuggestions, 100)}
                  maxLength={500}
                  required
                  disabled={saving}
                  placeholder={t('inventory.reasonPh')}
                />

                {reasonSearchFocused && (
                  <ul className="inventory-product-suggestions inventory-reason-suggestions">
                    {reasonSuggestions
                      .filter((reason) =>
                        reason.toLowerCase().includes(form.reason.trim().toLowerCase())
                      )
                      .slice(0, 6)
                      .map((reason) => (
                        <li key={reason}>
                          <button
                            type="button"
                            className="inventory-product-suggestion"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleReasonSelect(reason);
                            }}
                          >
                            <span>{reason}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
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
