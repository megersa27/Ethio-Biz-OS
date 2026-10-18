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

test("sales are atomic and isolated between businesses", async (t) => {
  await connectDB();

  const server = app.listen(0);

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const businessIds = [];

  t.after(async () => {
    try {
      if (businessIds.length > 0) {
        await Sale.deleteMany({
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

  const uniqueId =
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const accounts = [
    {
      businessName: `Sale Test A ${uniqueId}`,
      ownerName: "Sale Test Owner A",
      email: `sale-test-a-${uniqueId}@example.com`,
      password: "Sale-Test-A-2026!",
    },
    {
      businessName: `Sale Test B ${uniqueId}`,
      ownerName: "Sale Test Owner B",
      email: `sale-test-b-${uniqueId}@example.com`,
      password: "Sale-Test-B-2026!",
    },
  ];

  const registrations = [];

  for (const account of accounts) {
    const result = await request("/api/auth/register", {
      method: "POST",
      body: account,
    });

    const businessId = result.body.data?.business?.id;

    if (businessId) {
      businessIds.push(businessId);
    }

    assert.equal(
      result.status,
      201,
      `Registration failed: ${result.body.message}`
    );

    registrations.push(result.body.data);
  }

  const businessAId = registrations[0].business.id;
  const businessBId = registrations[1].business.id;

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

  const tokenA = await login(accounts[0]);
  const tokenB = await login(accounts[1]);

  async function createProduct(token, product) {
    const result = await request("/api/products", {
      method: "POST",
      token,
      body: product,
    });

    assert.equal(
      result.status,
      201,
      `Product creation failed: ${result.body.message}`
    );

    return result.body.data.product;
  }

  const flour = await createProduct(tokenA, {
    name: `Sale Test Flour ${uniqueId}`,
    category: "Groceries",
    unit: "piece",
    costPriceMinor: 1000,
    sellingPriceMinor: 2000,
    stockQuantity: 5,
  });

  const salt = await createProduct(tokenA, {
    name: `Sale Test Salt ${uniqueId}`,
    category: "Groceries",
    unit: "piece",
    costPriceMinor: 200,
    sellingPriceMinor: 500,
    stockQuantity: 2,
  });

  const businessBProduct = await createProduct(tokenB, {
    name: `Sale Test Product B ${uniqueId}`,
    category: "General",
    unit: "piece",
    costPriceMinor: 1000,
    sellingPriceMinor: 3000,
    stockQuantity: 10,
  });

  // 1. A paid cash sale uses server-side prices and reduces stock.
  const successfulSale = await request("/api/sales", {
    method: "POST",
    token: tokenA,
    body: {
      items: [
        {
          productId: String(flour._id),
          quantity: 2,
        },
      ],
      paidAmountMinor: 4000,
      paymentMethod: "cash",
    },
  });

  assert.equal(
    successfulSale.status,
    201,
    `Sale failed: ${successfulSale.body.message}`
  );

  const sale = successfulSale.body.data.sale;

  assert.equal(String(sale.businessId), String(businessAId));
  assert.equal(sale.totalAmountMinor, 4000);
  assert.equal(sale.totalCostMinor, 2000);
  assert.equal(sale.paidAmountMinor, 4000);
  assert.equal(sale.balanceDueMinor, 0);
  assert.equal(sale.paymentStatus, "PAID");
  assert.equal(sale.payments.length, 1);
  assert.equal(sale.items[0].lineTotalMinor, 4000);

  let savedFlour = await Product.findById(flour._id);
  assert.equal(savedFlour.stockQuantity, 3);

  // 2. An insufficient-stock failure must roll back earlier stock updates.
  // Flour has sufficient stock, but Salt does not have 99 units available.
  const failedMultiItemSale = await request("/api/sales", {
    method: "POST",
    token: tokenA,
    body: {
      items: [
        {
          productId: String(flour._id),
          quantity: 1,
        },
        {
          productId: String(salt._id),
          quantity: 99,
        },
      ],
      paidAmountMinor: 51500,
      paymentMethod: "cash",
    },
  });

  assert.equal(
    failedMultiItemSale.status,
    409,
    `Expected insufficient-stock conflict, received: ${
      failedMultiItemSale.body.message
    }`
  );

  savedFlour = await Product.findById(flour._id);
  const savedSalt = await Product.findById(salt._id);

  assert.equal(savedFlour.stockQuantity, 3);
  assert.equal(savedSalt.stockQuantity, 2);
  assert.equal(
    await Sale.countDocuments({ businessId: businessAId }),
    1,
    "A failed sale must not be saved"
  );

  // 3. Business A cannot sell Business B's product.
  const crossBusinessSale = await request("/api/sales", {
    method: "POST",
    token: tokenA,
    body: {
      items: [
        {
          productId: String(businessBProduct._id),
          quantity: 1,
        },
      ],
      paidAmountMinor: 3000,
      paymentMethod: "cash",
    },
  });

  assert.equal(crossBusinessSale.status, 404);

  const productBAfterAttempt = await Product.findById(
    businessBProduct._id
  );

  assert.ok(productBAfterAttempt);
  assert.equal(productBAfterAttempt.stockQuantity, 10);

  assert.equal(
    await Sale.countDocuments({ businessId: businessAId }),
    1
  );

  assert.equal(
    await Sale.countDocuments({ businessId: businessBId }),
    0
  );
});
