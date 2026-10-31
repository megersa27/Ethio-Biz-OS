import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Edit2,
  Package,
  Plus,
  Search,
  RefreshCw,
  X,
  Archive,
} from 'lucide-react';

import {
  createProduct,
  deactivateProduct,
  getProducts,
  updateProduct,
} from '../services/api.js';
import { useAutoDismissNotice } from '../utils/useAutoDismissNotice.js';

import './ProductsPage.css';

const emptyForm = {
  name: '',
  category: 'General',
  unit: 'piece',
  costPrice: '',
  sellingPrice: '',
  stockQuantity: '0',
  minimumStockLevel: '5',
};

const units = ['piece', 'kg', 'g', 'litre', 'ml', 'box', 'pack'];

const categoryOptions = [
  'General',
  'Groceries',
  'Beverages',
  'Dairy & Eggs',
  'Fruits & Vegetables',
  'Meat & Poultry',
  'Bakery',
  'Snacks & Sweets',
  'Household Items',
  'Cleaning Supplies',
  'Personal Care',
  'Cosmetics',
  'Medicine & Pharmacy',
  'Clothing',
  'Electronics',
  'Stationery',
  'Hardware & Tools',
  'Other',
];

const formatETB = (minor) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number(minor) || 0) / 100);

export default function ProductsPage({ token }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useAutoDismissNotice(notice, setNotice);

  function toMinor(value, fieldName) {
    if (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new Error(fieldName === 'Cost price' ? t('products.errCost') : t('products.errSelling'));
    }

    const minor = Math.round(Number(value) * 100);

    if (!Number.isSafeInteger(minor)) {
      throw new Error(fieldName === 'Cost price' ? t('products.errCostLarge') : t('products.errSellingLarge'));
    }

    return minor;
  }

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getProducts(token);
      setProducts(result.products || []);
    } catch (requestError) {
      setError(requestError.message || t('products.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) =>
      `${product.name} ${product.category} ${product.unit}`
        .toLowerCase()
        .includes(query)
    );
  }, [products, search]);

  function openCreateForm() {
    setEditingProduct(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  function openEditForm(product) {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      category: product.category || 'General',
      unit: product.unit || 'piece',
      costPrice: ((product.costPriceMinor || 0) / 100).toFixed(2),
      sellingPrice: ((product.sellingPriceMinor || 0) / 100).toFixed(2),
      stockQuantity: String(product.stockQuantity ?? 0),
      minimumStockLevel: String(product.minimumStockLevel ?? 0),
    });
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const minimumStockLevel = Number(form.minimumStockLevel);
      const stockQuantity = Number(form.stockQuantity);

      if (!Number.isFinite(minimumStockLevel) || minimumStockLevel < 0) {
        throw new Error(t('products.errMinStock'));
      }

      if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
        throw new Error(t('products.errStockQuantity'));
      }

      const productData = {
        name: form.name.trim(),
        category: form.category.trim() || 'General',
        costPriceMinor: toMinor(form.costPrice, 'Cost price'),
        sellingPriceMinor: toMinor(form.sellingPrice, 'Selling price'),
        minimumStockLevel,
      };

      if (!productData.name) {
        throw new Error(t('products.errName'));
      }

      if (editingProduct) {
        await updateProduct(token, editingProduct._id, productData);
        setNotice(t('products.updated'));
      } else {
        await createProduct(token, {
          ...productData,
          unit: form.unit,
          stockQuantity,
        });
        setNotice(t('products.created'));
      }

      closeForm();
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || t('products.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(product) {
    const confirmed = window.confirm(
      t('products.confirmDeactivate', { name: product.name })
    );

    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      await deactivateProduct(token, product._id);
      setNotice(t('products.deactivated', { name: product.name }));
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || t('products.errDeactivate'));
    }
  }

  return (
    <section className="products-workspace">
      <div className="products-summary">
        <div className="products-summary-icon">
          <Package size={22} />
        </div>
        <div>
          <span>{t('products.activeProducts')}</span>
          <strong>{loading ? t('common.loadingEllipsis') : products.length}</strong>
        </div>
        <button
          className="secondary-button products-refresh"
          onClick={loadProducts}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {t('common.refresh')}
        </button>
      </div>

      {error && (
        <div className="products-message products-message-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="products-message products-message-success" role="status">
          {notice}
        </div>
      )}

      <section className="panel products-panel">
        <div className="panel-header products-toolbar">
          <div>
            <h2 className="panel-title">{t('products.catalogue')}</h2>
            <p className="panel-subtitle">
              {t('products.catalogueLead')}
            </p>
          </div>
          <button className="primary-button" onClick={openCreateForm}>
            <Plus size={16} />
            {t('products.addProduct')}
          </button>
        </div>

        <label className="products-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('products.searchPh')}
            aria-label={t('products.searchAria')}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('products.clearSearchAria')}
            >
              <X size={15} />
            </button>
          )}
        </label>

        <div className="table-scroll">
          <table className="data-table products-table">
            <thead>
              <tr>
                <th>{t('products.thProduct')}</th>
                <th>{t('products.thCategory')}</th>
                <th>{t('products.thCostPrice')}</th>
                <th>{t('products.thSellingPrice')}</th>
                <th>{t('products.thStock')}</th>
                <th>{t('products.thReorderAt')}</th>
                <th>{t('products.thStockStatus')}</th>
                <th>{t('products.thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const lowStock =
                  Number(product.stockQuantity) <=
                  Number(product.minimumStockLevel ?? 0);

                return (
                  <tr key={product._id}>
                    <td>
                      <span className="table-primary">{product.name}</span>
                    </td>
                    <td>{product.category || 'General'}</td>
                    <td>{formatETB(product.costPriceMinor)}</td>
                    <td>
                      <strong>{formatETB(product.sellingPriceMinor)}</strong>
                    </td>
                    <td>
                      {product.stockQuantity} {product.unit}
                    </td>
                    <td>{product.minimumStockLevel ?? 0}</td>
                    <td>
                      <span className={`product-stock-badge ${lowStock ? 'low' : 'good'}`}>
                        {lowStock ? t('products.lowStock') : t('products.inStock')}
                      </span>
                    </td>
                    <td>
                      <div className="product-row-actions">
                        <button
                          type="button"
                          className="product-action-button"
                          onClick={() => openEditForm(product)}
                          aria-label={t('products.editAria', { name: product.name })}
                          title={t('products.editTitle')}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="product-action-button deactivate"
                          onClick={() => handleDeactivate(product)}
                          aria-label={t('products.deactivateAria', { name: product.name })}
                          title={t('products.deactivateTitle')}
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="8" className="products-empty">
                    {search
                      ? t('products.noMatch')
                      : t('products.none')}
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="8" className="products-empty">
                    {t('products.loadingProducts')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="products-table-footer">
          {t('products.showingActive', { shown: filteredProducts.length, total: products.length })}
        </div>
      </section>

      {formOpen && (
        <div
          className="products-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeForm();
          }}
        >
          <section
            className="products-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <div className="products-modal-header">
              <div>
                <span className="products-form-eyebrow">{t('products.formEyebrow')}</span>
                <h2 id="product-form-title">
                  {editingProduct ? t('products.editTitle2') : t('products.addTitle')}
                </h2>
                <p>
                  {editingProduct
                    ? t('products.editLead')
                    : t('products.addLead')}
                </p>
              </div>
            </div>

            <form className="products-form" onSubmit={handleSubmit}>
              <label>
                {t('products.name')}
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  maxLength={150}
                  placeholder={t('products.namePh')}
                  required
                />
              </label>

              <div className="products-form-grid">
                <label>
                  {t('products.category')}
                  <select
                    name="category"
                    value={form.category}
                    onChange={updateField}
                    required
                  >
                    {!categoryOptions.includes(form.category) && form.category && (
                      <option value={form.category}>{form.category}</option>
                    )}
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {t('products.unit')}
                  <select
                    name="unit"
                    value={form.unit}
                    onChange={updateField}
                    disabled={Boolean(editingProduct)}
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {t('products.costPrice')}
                  <input
                    name="costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={updateField}
                    placeholder="0.00"
                    required
                  />
                </label>

                <label>
                  {t('products.sellingPrice')}
                  <input
                    name="sellingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.sellingPrice}
                    onChange={updateField}
                    placeholder="0.00"
                    required
                  />
                </label>

                {!editingProduct && (
                  <label>
                    {t('products.initialStock')}
                    <input
                      name="stockQuantity"
                      type="number"
                      min="0"
                      step="any"
                      value={form.stockQuantity}
                      onChange={updateField}
                      required
                    />
                  </label>
                )}

                <label className={editingProduct ? 'products-form-full' : ''}>
                  {t('products.reorderLevel')}
                  <input
                    name="minimumStockLevel"
                    type="number"
                    min="0"
                    step="any"
                    value={form.minimumStockLevel}
                    onChange={updateField}
                    required
                  />
                </label>
              </div>

              {!editingProduct && (
                <p className="products-form-note">
                  {t('products.formNote')}
                </p>
              )}

              {error && (
                <div className="products-message products-message-error" role="alert">
                  {error}
                </div>
              )}

              <div className="products-form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving
                    ? t('common.saving')
                    : editingProduct
                      ? t('common.saveChanges')
                      : t('products.createProduct')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
