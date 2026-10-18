require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/database");
const Business = require("../src/models/Business");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const Sale = require("../src/models/Sale");

test("sales history supports pagination, dates and tenant isolation", async (t) => {
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
        await Sale.deleteMany({ businessId: { $in: businessIds } });
        await Product.deleteMany({ businessId: { $in: businessIds } });
        await User.deleteMany({ businessId: { $in: businessIds } });
        await Business.deleteMany({ _id: { $in: businessIds } });
      }
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await mongoose.disconnect();
    }
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { method = "GET", token, body } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    return { status: response.status, body: await response.json() };
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const accounts = ["A", "B"].map((label) => ({
    businessName: `History Test ${label} ${id}`,
    ownerName: `History Owner ${label}`,
    email: `history-${label}-${id}@example.com`,
    password: `History-Test-${label}-2026!`,
  }));

  const registrations = [];

  for (const account of accounts) {
    const result = await request("/api/auth/register", {
      method: "POST",
      body: account,
    });

    const businessId = result.body.data?.business?.id;
    if (businessId) businessIds.push(businessId);

    assert.equal(result.status, 201, result.body.message);
    registrations.push(result.body.data);
  }

  async function login(account) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: {
        identifier: account.email,
        password: account.password,
      },
    });

    assert.equal(result.status, 200, result.body.message);
    return result.body.data.accessToken;
  }

  const tokenA = await login(accounts[0]);
  const tokenB = await login(accounts[1]);

  async function createProduct(token, name) {
    const result = await request("/api/products", {
      method: "POST",
      token,
      body: {
        name: `${name} ${id}`,
        unit: "piece",
        costPriceMinor: 100,
        sellingPriceMinor: 200,
        stockQuantity: 10,
      },
    });

    assert.equal(result.status, 201, result.body.message);
    return result.body.data.product;
  }

  const productA = await createProduct(tokenA, "History Product A");
  const productB = await createProduct(tokenB, "History Product B");

  async function createPaidSale(token, productId) {
    const result = await request("/api/sales", {
      method: "POST",
      token,
      body: {
        items: [{ productId: String(productId), quantity: 1 }],
        paidAmountMinor: 200,
        paymentMethod: "cash",
      },
    });

    assert.equal(result.status, 201, result.body.message);
    return result.body.data.sale;
  }

  const saleA1 = await createPaidSale(tokenA, productA._id);
  const saleA2 = await createPaidSale(tokenA, productA._id);
  const saleB = await createPaidSale(tokenB, productB._id);

  // Business A sees two sales, not Business B's sale.
  const listA = await request("/api/sales", { token: tokenA });

  assert.equal(listA.status, 200);
  assert.equal(listA.body.data.pagination.totalItems, 2);
  assert.equal(listA.body.data.sales.length, 2);
  assert.ok(
    listA.body.data.sales.every(
      (sale) => String(sale.businessId) === String(registrations[0].business.id)
    )
  );

  // Pagination returns one record per page and no duplicates.
  const page1 = await request("/api/sales?page=1&limit=1", { token: tokenA });
  const page2 = await request("/api/sales?page=2&limit=1", { token: tokenA });

  assert.equal(page1.status, 200);
  assert.equal(page2.status, 200);
  assert.equal(page1.body.data.sales.length, 1);
  assert.equal(page2.body.data.sales.length, 1);
  assert.equal(page1.body.data.pagination.totalPages, 2);
  assert.notEqual(
    String(page1.body.data.sales[0]._id),
    String(page2.body.data.sales[0]._id)
  );

  // The inclusive UTC date range includes today's sales.
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = await request(
    `/api/sales?startDate=${today}&endDate=${today}`,
    { token: tokenA }
  );

  assert.equal(todaySales.status, 200);
  assert.equal(todaySales.body.data.pagination.totalItems, 2);

  // Invalid query values are rejected.
  const invalidDate = await request(
    "/api/sales?startDate=2026-02-31",
    { token: tokenA }
  );
  assert.equal(invalidDate.status, 400);

  const invalidLimit = await request(
    "/api/sales?limit=1000",
    { token: tokenA }
  );
  assert.equal(invalidLimit.status, 400);

  // A business can retrieve its own sale.
  const ownDetail = await request(`/api/sales/${saleA1._id}`, {
    token: tokenA,
  });

  assert.equal(ownDetail.status, 200);
  assert.equal(String(ownDetail.body.data.sale._id), String(saleA1._id));

  // A business cannot retrieve another business's sale.
  const foreignDetail = await request(`/api/sales/${saleB._id}`, {
    token: tokenA,
  });

  assert.equal(foreignDetail.status, 404);

  // Invalid IDs return a validation error.
  const badId = await request("/api/sales/not-an-object-id", {
    token: tokenA,
  });
  assert.equal(badId.status, 400);

  // Business B's own list contains only its own sale.
  const listB = await request("/api/sales", { token: tokenB });

  assert.equal(listB.status, 200);
  assert.equal(listB.body.data.pagination.totalItems, 1);
  assert.equal(
    String(listB.body.data.sales[0]._id),
    String(saleB._id)
  );

  // Keep a reference to prove the second Business A sale was created.
  assert.ok(saleA2._id);
});
