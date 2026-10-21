require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/database");
const Business = require("../src/models/Business");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const Expense = require("../src/models/Expense");

test("expenses are tenant-scoped and feed the dashboard reports", async (t) => {
  await connectDB();

  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const businessIds = [];

  t.after(async () => {
    try {
      if (businessIds.length) {
        await Expense.deleteMany({
          businessId: { $in: businessIds },
        });

        await Product.deleteMany({
          businessId: { $in: businessIds },
        });

        await User.deleteMany({
          businessId: { $in: businessIds },
        });

        await Business.deleteMany({
          _id: { $in: businessIds },
        });
      }
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await mongoose.disconnect();
    }
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }

  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const today = new Date().toISOString().slice(0, 10);

  const accounts = [
    {
      businessName: `Expense Tenant A ${uniqueId}`,
      ownerName: "Owner A",
      email: `expense-a-${uniqueId}@example.com`,
      password: "Expense-Test-A-2026!",
    },
    {
      businessName: `Expense Tenant B ${uniqueId}`,
      ownerName: "Owner B",
      email: `expense-b-${uniqueId}@example.com`,
      password: "Expense-Test-B-2026!",
    },
  ];

  async function register(account) {
    const result = await request("/api/auth/register", {
      method: "POST",
      body: account,
    });

    assert.equal(
      result.status,
      201,
      `Registration failed: ${result.body.message}`
    );

    const businessId = result.body.data?.business?.id;

    if (businessId) {
      businessIds.push(businessId);
    }

    return result.body.data;
  }

  async function login(account) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: {
        identifier: account.email,
        password: account.password,
      },
    });

    assert.equal(
      result.status,
      200,
      `Login failed: ${result.body.message}`
    );

    return result.body.data.accessToken;
  }

  const regA = await register(accounts[0]);
  const regB = await register(accounts[1]);
  const businessAId = regA.business.id;

  const tokenA = await login(accounts[0]);
  const tokenB = await login(accounts[1]);

  // Business A creates a product that is already below its reorder point.
  const productResult = await request("/api/products", {
    method: "POST",
    token: tokenA,
    body: {
      name: `Low Stock Item ${uniqueId}`,
      category: "Groceries",
      unit: "piece",
      costPriceMinor: 10000,
      sellingPriceMinor: 13000,
      stockQuantity: 2,
      minimumStockLevel: 5,
    },
  });

  assert.equal(productResult.status, 201);
  assert.equal(
    productResult.body.data.product.minimumStockLevel,
    5
  );

  const productName = productResult.body.data.product.name;

  // Create two expenses for Business A.
  const expense1Result = await request("/api/expenses", {
    method: "POST",
    token: tokenA,
    body: {
      category: "RENT",
      amountMinor: 5000,
      description: "Shop rent",
      date: today,
    },
  });

  assert.equal(expense1Result.status, 201);
  assert.equal(expense1Result.body.success, true);
  assert.equal(
    expense1Result.body.data.expense.amountMinor,
    5000
  );
  assert.equal(
    String(expense1Result.body.data.expense.businessId),
    String(businessAId)
  );
  assert.equal(expense1Result.body.data.expense.isActive, true);

  const expense1Id = expense1Result.body.data.expense._id;

  const expense2Result = await request("/api/expenses", {
    method: "POST",
    token: tokenA,
    body: {
      category: "TRANSPORT",
      amountMinor: 1500,
      description: "Delivery",
      date: today,
    },
  });

  assert.equal(expense2Result.status, 201);

  const expense2Id = expense2Result.body.data.expense._id;

  // List shows both active expenses with pagination.
  const listResult = await request("/api/expenses", { token: tokenA });

  assert.equal(listResult.status, 200);
  assert.equal(listResult.body.data.pagination.totalItems, 2);
  assert.equal(listResult.body.data.expenses.length, 2);

  // Get a single expense by id.
  const getByIdResult = await request(
    `/api/expenses/${expense1Id}`,
    { token: tokenA }
  );

  assert.equal(getByIdResult.status, 200);
  assert.equal(
    getByIdResult.body.data.expense.amountMinor,
    5000
  );

  // Update the first expense.
  const updateResult = await request(`/api/expenses/${expense1Id}`, {
    method: "PUT",
    token: tokenA,
    body: {
      amountMinor: 6000,
      description: "Adjusted shop rent",
    },
  });

  assert.equal(updateResult.status, 200);
  assert.equal(
    updateResult.body.data.expense.amountMinor,
    6000
  );
  assert.equal(
    updateResult.body.data.expense.description,
    "Adjusted shop rent"
  );

  // Cross-tenant access is denied.
  const crossGet = await request(`/api/expenses/${expense1Id}`, {
    token: tokenB,
  });
  assert.equal(crossGet.status, 404);

  const crossUpdate = await request(`/api/expenses/${expense1Id}`, {
    method: "PUT",
    token: tokenB,
    body: { amountMinor: 1 },
  });
  assert.equal(crossUpdate.status, 404);

  const crossDelete = await request(`/api/expenses/${expense1Id}`, {
    method: "DELETE",
    token: tokenB,
  });
  assert.equal(crossDelete.status, 404);

  // Anonymous requests are rejected.
  const anonymous = await request("/api/expenses");
  assert.equal(anonymous.status, 401);

  // Soft-delete the second expense.
  const deactivateResult = await request(
    `/api/expenses/${expense2Id}`,
    { method: "DELETE", token: tokenA }
  );

  assert.equal(deactivateResult.status, 200);
  assert.equal(deactivateResult.body.data.expense.isActive, false);

  // The active list now excludes the deactivated expense.
  const listAfterDelete = await request("/api/expenses", {
    token: tokenA,
  });

  assert.equal(listAfterDelete.body.data.pagination.totalItems, 1);
  assert.equal(listAfterDelete.body.data.expenses.length, 1);
  assert.equal(
    listAfterDelete.body.data.expenses[0]._id,
    expense1Id
  );

  // The expenses report reflects only the active, updated expense.
  const expensesReport = await request("/api/reports/expenses", {
    token: tokenA,
  });

  assert.equal(expensesReport.status, 200);
  assert.equal(
    expensesReport.body.data.report.totalExpensesMinor,
    6000
  );
  assert.equal(expensesReport.body.data.report.expenseCount, 1);
  assert.equal(
    expensesReport.body.data.report.byCategory[0].category,
    "RENT"
  );
  assert.equal(
    expensesReport.body.data.report.byCategory[0].totalMinor,
    6000
  );

  // Date filtering on expense.date works.
  const filteredReport = await request(
    `/api/reports/expenses?startDate=${today}&endDate=${today}`,
    { token: tokenA }
  );

  assert.equal(filteredReport.status, 200);
  assert.equal(
    filteredReport.body.data.report.totalExpensesMinor,
    6000
  );

  // The dashboard summary combines sales (none here), expenses and inventory.
  const summary = await request("/api/reports/summary", {
    token: tokenA,
  });

  assert.equal(summary.status, 200);
  assert.equal(
    summary.body.data.report.totalExpensesMinor,
    6000
  );
  assert.equal(summary.body.data.report.totalSalesMinor, 0);
  assert.equal(summary.body.data.report.grossProfitMinor, 0);
  assert.equal(summary.body.data.report.netProfitMinor, -6000);
  assert.equal(summary.body.data.report.totalProducts, 1);
  assert.equal(summary.body.data.report.lowStockProducts, 1);
  assert.equal(
    summary.body.data.report.lowStockItems[0].name,
    productName
  );

  // The profit report mirrors the dashboard financial figures.
  const profit = await request("/api/reports/profit", { token: tokenA });

  assert.equal(profit.status, 200);
  assert.equal(profit.body.data.report.netProfitMinor, -6000);
  assert.equal(
    profit.body.data.report.totalExpensesMinor,
    6000
  );

  // The stock report exposes the low-stock product and stock value.
  const stock = await request("/api/reports/stock", { token: tokenA });

  assert.equal(stock.status, 200);
  assert.equal(stock.body.data.report.totalProducts, 1);
  assert.equal(stock.body.data.report.lowStockProducts, 1);
  assert.equal(
    stock.body.data.report.lowStockItems[0].name,
    productName
  );
  // 2 units at 10000 santim cost = 20000 santim.
  assert.equal(stock.body.data.report.inventoryValueMinor, 20000);
});
