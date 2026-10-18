require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/database");
const Business = require("../src/models/Business");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const Customer = require("../src/models/Customer");
const Sale = require("../src/models/Sale");

test("credit payments update balances and enforce business isolation", async (t) => {
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
        await Customer.deleteMany({ businessId: { $in: businessIds } });
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
    businessName: `Payment Test ${label} ${id}`,
    ownerName: `Payment Owner ${label}`,
    email: `payment-${label}-${id}@example.com`,
    password: `Payment-Test-${label}-2026!`,
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
      body: { identifier: account.email, password: account.password },
    });

    assert.equal(result.status, 200, result.body.message);
    return result.body.data.accessToken;
  }

  const tokenA = await login(accounts[0]);
  const tokenB = await login(accounts[1]);

  const customerResult = await request("/api/customers", {
    method: "POST",
    token: tokenA,
    body: { name: `Payment Customer ${id}` },
  });
  assert.equal(customerResult.status, 201, customerResult.body.message);

  const productResult = await request("/api/products", {
    method: "POST",
    token: tokenA,
    body: {
      name: `Payment Product ${id}`,
      unit: "piece",
      costPriceMinor: 1000,
      sellingPriceMinor: 2000,
      stockQuantity: 10,
    },
  });
  assert.equal(productResult.status, 201, productResult.body.message);

  const customerId = customerResult.body.data.customer._id;
  const productId = productResult.body.data.product._id;

  // Create a 4,000-santim sale; initially collect 1,000 santim.
  const saleResult = await request("/api/sales", {
    method: "POST",
    token: tokenA,
    body: {
      customerId,
      items: [{ productId, quantity: 2 }],
      paidAmountMinor: 1000,
      paymentMethod: "cash",
    },
  });

  assert.equal(saleResult.status, 201, saleResult.body.message);
  const saleId = saleResult.body.data.sale._id;
  assert.equal(saleResult.body.data.sale.balanceDueMinor, 3000);

  // Collect another 1,500 santim.
  const partial = await request(`/api/sales/${saleId}/payments`, {
    method: "POST",
    token: tokenA,
    body: { amountMinor: 1500, paymentMethod: "cash" },
  });

  assert.equal(partial.status, 200, partial.body.message);
  assert.equal(partial.body.data.sale.paidAmountMinor, 2500);
  assert.equal(partial.body.data.sale.balanceDueMinor, 1500);
  assert.equal(partial.body.data.sale.paymentStatus, "PARTIAL");
  assert.equal(partial.body.data.sale.payments.length, 2);

  // Reject payment greater than the remaining balance.
  const overpayment = await request(`/api/sales/${saleId}/payments`, {
    method: "POST",
    token: tokenA,
    body: { amountMinor: 2000, paymentMethod: "cash" },
  });

  assert.equal(overpayment.status, 400);

  // Business B cannot pay Business A's sale.
  const crossBusiness = await request(`/api/sales/${saleId}/payments`, {
    method: "POST",
    token: tokenB,
    body: { amountMinor: 500, paymentMethod: "cash" },
  });

  assert.equal(crossBusiness.status, 404);

  let saved = await Sale.findById(saleId);
  assert.equal(saved.paidAmountMinor, 2500);
  assert.equal(saved.balanceDueMinor, 1500);
  assert.equal(saved.payments.length, 2);

  // Collect the remaining 1,500 santim.
  const finalPayment = await request(`/api/sales/${saleId}/payments`, {
    method: "POST",
    token: tokenA,
    body: { amountMinor: 1500, paymentMethod: "cash" },
  });

  assert.equal(finalPayment.status, 200, finalPayment.body.message);
  assert.equal(finalPayment.body.data.sale.paidAmountMinor, 4000);
  assert.equal(finalPayment.body.data.sale.balanceDueMinor, 0);
  assert.equal(finalPayment.body.data.sale.paymentStatus, "PAID");
  assert.equal(finalPayment.body.data.sale.payments.length, 3);
});
