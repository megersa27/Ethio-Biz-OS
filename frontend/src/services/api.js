const API_BASE_URL = '/api';

async function apiRequest(path, options = {}) {
  const { method = 'GET', token, body } = options;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new Error(
      'Server waliin wal qunnamuun hin danda\'amne. Backend kee hojjechaa jiraachuu isaa mirkaneessi.'
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error('Deebiin server irraa dhufe sirrii miti.');
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || `Request kufe (${response.status})`
    );
  }

  return result.data;
}

export function registerBusiness(formData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: formData,
  });
}

export function loginUser(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function getCurrentUser(token) {
  return apiRequest('/auth/me', { token });
}

// Dashboard summary: sales, expenses, profit, inventory and credit.
export function getDashboardSummary(token) {
  return apiRequest('/reports/summary', { token });
}

// Inventory health and low-stock products.
export function getStockReport(token) {
  return apiRequest('/reports/stock', { token });
}

// Latest sales, newest first.
export function getRecentSales(token, limit = 5) {
  const query = new URLSearchParams({
    page: '1',
    limit: String(limit),
  });

  return apiRequest(`/sales?${query.toString()}`, { token });
}

// Products belonging to the authenticated business.
export function getProducts(token) {
  return apiRequest('/products', { token });
}

// Customers belonging to the authenticated business.
export function getCustomers(token) {
  return apiRequest('/customers', { token });
}

// Create a product for the authenticated business.
export function createProduct(token, product) {
  return apiRequest('/products', {
    method: 'POST',
    token,
    body: product,
  });
}

// Update editable product details and prices.
export function updateProduct(token, productId, updates) {
  return apiRequest(`/products/${productId}`, {
    method: 'PATCH',
    token,
    body: updates,
  });
}

// Deactivate a product without deleting its history.
export function deactivateProduct(token, productId) {
  return apiRequest(`/products/${productId}`, {
    method: 'DELETE',
    token,
  });
}

// Retrieve stock movement history for the authenticated business.
export function getInventoryMovements(token, options = {}) {
  const query = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 20),
  });

  if (options.productId) {
    query.set('productId', options.productId);
  }

  return apiRequest(`/inventory/movements?${query.toString()}`, { token });
}

// List recent sales with optional pagination and date filters.
export function getSales(token, options = {}) {
  const query = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 20),
  });

  if (options.startDate) query.set('startDate', options.startDate);
  if (options.endDate) query.set('endDate', options.endDate);

  return apiRequest(`/sales?${query.toString()}`, { token });
}

// Create a sale. The backend calculates prices and updates stock.
export function createSale(token, sale) {
  return apiRequest('/sales', {
    method: 'POST',
    token,
    body: sale,
  });
}

// Add a payment to an existing sale with an outstanding balance.
export function recordSalePayment(token, saleId, payment) {
  return apiRequest(`/sales/${saleId}/payments`, {
    method: 'POST',
    token,
    body: payment,
  });
}

// Record stock received, damaged, expired, or adjusted.
export function recordInventoryMovement(token, movement) {
  return apiRequest('/inventory/movements', {
    method: 'POST',
    token,
    body: movement,
  });
}
