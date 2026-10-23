import { useCallback, useEffect, useMemo, useState } from 'react';
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

import './ProductsPage.css';

const emptyForm = {
  name: '',
  category: 'General',
  unit: 'piece',
  costPrice: '',
  sellingPrice: '',
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

function toMinor(value, fieldName) {
  if (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error(`${fieldName} must be a valid non-negative amount.`);
  }

  const minor = Math.round(Number(value) * 100);

  if (!Number.isSafeInteger(minor)) {
    throw new Error(`${fieldName} is too large.`);
  }

  return minor;
}

export default function ProductsPage({ token }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getProducts(token);
      setProducts(result.products || []);
    } catch (requestError) {
      setError(requestError.message || 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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

      if (!Number.isFinite(minimumStockLevel) || minimumStockLevel < 0) {
        throw new Error('Minimum stock level must be zero or greater.');
      }

      const productData = {
        name: form.name.trim(),
        category: form.category.trim() || 'General',
        costPriceMinor: toMinor(form.costPrice, 'Cost price'),
        sellingPriceMinor: toMinor(form.sellingPrice, 'Selling price'),
        minimumStockLevel,
      };

      if (!productData.name) {
        throw new Error('Product name is required.');
      }

      if (editingProduct) {
        await updateProduct(token, editingProduct._id, productData);
        setNotice('Product updated successfully.');
      } else {
        await createProduct(token, {
          ...productData,
          unit: form.unit,
          stockQuantity: 0,
        });
        setNotice('Product created successfully. Record incoming stock in Inventory.');
      }

      closeForm();
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(product) {
    const confirmed = window.confirm(
      `Deactivate "${product.name}"? It will no longer appear in the active product list.`
    );

    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      await deactivateProduct(token, product._id);
      setNotice(`"${product.name}" was deactivated.`);
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || 'Could not deactivate product.');
    }
  }

  return (
    <section className="products-workspace">
      <div className="products-summary">
        <div className="products-summary-icon">
          <Package size={22} />
        </div>
        <div>
          <span>Active products</span>
          <strong>{loading ? '…' : products.length}</strong>
        </div>
        <button
          className="secondary-button products-refresh"
          onClick={loadProducts}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh
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
            <h2 className="panel-title">Product catalogue</h2>
            <p className="panel-subtitle">
              Manage product details, prices and reorder levels.
            </p>
          </div>
          <button className="primary-button" onClick={openCreateForm}>
            <Plus size={16} />
            Add product
          </button>
        </div>

        <label className="products-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product, category or unit..."
            aria-label="Search products"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear product search"
            >
              <X size={15} />
            </button>
          )}
        </label>

        <div className="table-scroll">
          <table className="data-table products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Cost price</th>
                <th>Selling price</th>
                <th>Stock</th>
                <th>Reorder at</th>
                <th>Stock status</th>
                <th>Actions</th>
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
                        {lowStock ? 'Low stock' : 'In stock'}
                      </span>
                    </td>
                    <td>
                      <div className="product-row-actions">
                        <button
                          type="button"
                          className="product-action-button"
                          onClick={() => openEditForm(product)}
                          aria-label={`Edit ${product.name}`}
                          title="Edit product"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="product-action-button deactivate"
                          onClick={() => handleDeactivate(product)}
                          aria-label={`Deactivate ${product.name}`}
                          title="Deactivate product"
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
                      ? 'No products match your search.'
                      : 'No active products yet. Add your first product to get started.'}
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="8" className="products-empty">
                    Loading products…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="products-table-footer">
          Showing {filteredProducts.length} of {products.length} active products
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
                <span className="products-form-eyebrow">PRODUCT MANAGEMENT</span>
                <h2 id="product-form-title">
                  {editingProduct ? 'Edit product' : 'Add a product'}
                </h2>
                <p>
                  {editingProduct
                    ? 'Update product details and pricing.'
                    : 'Enter the details of the product you sell.'}
                </p>
              </div>
            </div>

            <form className="products-form" onSubmit={handleSubmit}>
              <label>
                Product name
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  maxLength={150}
                  placeholder="e.g. Cooking Oil 5L"
                  required
                />
              </label>

              <div className="products-form-grid">
                <label>
                  Category
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
                  Unit
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
                  Cost price (ETB)
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
                  Selling price (ETB)
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

                <label className="products-form-full">
                  Reorder level
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
                  New products start with zero stock. Record incoming stock in
                  Inventory so the stock movement history remains accurate.
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
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : editingProduct
                      ? 'Save changes'
                      : 'Create product'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
