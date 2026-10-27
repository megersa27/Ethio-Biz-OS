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
export function getDashboardSummary(token, options = {}) {
  const query = new URLSearchParams();
  if (options.startDate) query.set('startDate', options.startDate);
  if (options.endDate) query.set('endDate', options.endDate);

  const suffix = query.toString();
  return apiRequest(`/reports/summary${suffix ? `?${suffix}` : ''}`, { token });
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

// Create a customer for the authenticated business.
export function createCustomer(token, customer) {
  return apiRequest('/customers', {
    method: 'POST', token, body: customer,
  });
}

// Update a customer's editable details.
export function updateCustomer(token, customerId, updates) {
  return apiRequest(`/customers/${customerId}`, {
    method: 'PUT', token, body: updates,
  });
}

// Deactivate while keeping historical sales references.
export function deactivateCustomer(token, customerId) {
  return apiRequest(`/customers/${customerId}`, {
    method: 'DELETE', token,
  });
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

// List business expenses with pagination and optional date filters.
export function getExpenses(token, options = {}) {
  const query = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 50),
  });

  if (options.startDate) query.set('startDate', options.startDate);
  if (options.endDate) query.set('endDate', options.endDate);

  return apiRequest(`/expenses?${query.toString()}`, { token });
}

// Create an expense; amountMinor is measured in santim.
export function createExpense(token, expense) {
  return apiRequest('/expenses', {
    method: 'POST',
    token,
    body: expense,
  });
}

// Update an existing expense.
export function updateExpense(token, expenseId, updates) {
  return apiRequest(`/expenses/${expenseId}`, {
    method: 'PUT',
    token,
    body: updates,
  });
}

// Deactivate an expense without physically deleting its record.
export function deactivateExpense(token, expenseId) {
  return apiRequest(`/expenses/${expenseId}`, {
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


// Business reports. Dates must use YYYY-MM-DD.
function reportQuery(options = {}) {
  const query = new URLSearchParams();
  if (options.startDate) query.set('startDate', options.startDate);
  if (options.endDate) query.set('endDate', options.endDate);
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}

export function getSalesReport(token, options = {}) {
  return apiRequest(`/reports/sales${reportQuery(options)}`, { token });
}

export function getExpensesReport(token, options = {}) {
  return apiRequest(`/reports/expenses${reportQuery(options)}`, { token });
}

export function getProfitReport(token, options = {}) {
  return apiRequest(`/reports/profit${reportQuery(options)}`, { token });
}

export function getBusinessReportSummary(token, options = {}) {
  return apiRequest(`/reports/summary${reportQuery(options)}`, { token });
}

export function getBusinessStockReport(token) {
  return apiRequest('/reports/stock', { token });
}


// Load and update the authenticated user's profile and business details.
export function getSettingsProfile(token) {
  return apiRequest('/settings/profile', { token });
}

export function updateSettingsProfile(token, profile) {
  return apiRequest('/settings/profile', {
    method: 'PUT',
    token,
    body: profile,
  });
}
