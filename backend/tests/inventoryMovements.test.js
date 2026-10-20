require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/database");
const Business = require("../src/models/Business");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const InventoryMovement = require("../src/models/InventoryMovement");

test("inventory movements update stock and enforce business isolation", async (t) => {
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
        await InventoryMovement.deleteMany({
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

  async function request(path, { method = "GET", token, body } = {}) {
    const headers = { "Content-Type": "application/json" };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const accounts = ["A", "B"].map((label) => ({
    businessName: `Inventory Test ${label} ${id}`,
    ownerName: `Inventory Owner ${label}`,
    email: `inventory-${label}-${id}@example.com`,
    password: `Inventory-Test-${label}-2026!`,
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

  async function createProduct(token, name, stockQuantity) {
    const result = await request("/api/products", {
      method: "POST",
      token,
      body: {
        name: `${name} ${id}`,
        unit: "piece",
        costPriceMinor: 1000,
        sellingPriceMinor: 2000,
        stockQuantity,
      },
    });

    assert.equal(result.status, 201, result.body.message);
    return result.body.data.product;
  }

  const productA = await createProduct(tokenA, "Inventory Product A", 10);
  const productB = await createProduct(tokenB, "Inventory Product B", 4);

  // Unauthenticated users cannot access inventory history.
  const unauthenticated = await request("/api/inventory/movements");
  assert.equal(unauthenticated.status, 401);

  // Receiving five units increases stock from 10 to 15.
  const received = await request("/api/inventory/movements", {
    method: "POST",
    token: tokenA,
    body: {
      productId: productA._id,
      movementType: "RECEIVED",
      quantity: 5,
      reason: "Received five units from supplier",
    },
  });

  assert.equal(received.status, 201, received.body.message);
  assert.equal(received.body.data.movement.movementType, "RECEIVED");
  assert.equal(received.body.data.movement.quantity, 5);
  assert.equal(received.body.data.movement.stockBefore, 10);
  assert.equal(received.body.data.movement.stockAfter, 15);
  assert.equal(
    String(received.body.data.movement.performedBy),
    registrations[0].user.id
  );

  // Damaged goods reduce stock from 15 to 12.
  const damaged = await request("/api/inventory/movements", {
    method: "POST",
    token: tokenA,
    body: {
      productId: productA._id,
      movementType: "DAMAGED",
      quantity: 3,
      reason: "Three units damaged during storage",
    },
  });

  assert.equal(damaged.status, 201, damaged.body.message);
  assert.equal(damaged.body.data.movement.stockBefore, 15);
  assert.equal(damaged.body.data.movement.stockAfter, 12);

  let storedProduct = await Product.findOne({
    _id: productA._id,
    businessId: businessIds[0],
  });

  assert.equal(storedProduct.stockQuantity, 12);

  // A decrease cannot make stock negative.
  const insufficientStock = await request("/api/inventory/movements", {
    method: "POST",
    token: tokenA,
    body: {
      productId: productA._id,
      movementType: "ADJUSTMENT_DECREASE",
      quantity: 100,
      reason: "Invalid excessive stock removal",
    },
  });

  assert.equal(insufficientStock.status, 409);

  storedProduct = await Product.findById(productA._id);
  assert.equal(storedProduct.stockQuantity, 12);

  // Clients cannot create sale or cancellation movements directly.
  const forbiddenType = await request("/api/inventory/movements", {
    method: "POST",
    token: tokenA,
    body: {
      productId: productA._id,
      movementType: "SALE",
      quantity: 1,
      reason: "Attempt to bypass the sales service",
    },
  });

  assert.equal(forbiddenType.status, 400);

  // Invalid quantities and missing reasons are rejected.
  for (const invalidMovement of [
    {
      productId: productA._id,
      movementType: "RECEIVED",
      quantity: 0,
      reason: "Zero quantity",
    },
    {
      productId: productA._id,
      movementType: "RECEIVED",
      quantity: 1,
      reason: "   ",
    },
  ]) {
    const result = await request("/api/inventory/movements", {
      method: "POST",
      token: tokenA,
      body: invalidMovement,
    });

    assert.equal(result.status, 400);
  }

  // Business A cannot change Business B's product.
  const foreignProductMovement = await request(
    "/api/inventory/movements",
    {
      method: "POST",
      token: tokenA,
      body: {
        productId: productB._id,
        movementType: "RECEIVED",
        quantity: 5,
        reason: "Unauthorized stock increase",
      },
    }
  );

  assert.equal(foreignProductMovement.status, 404);

  const storedProductB = await Product.findById(productB._id);
  assert.equal(storedProductB.stockQuantity, 4);

  // Business B records its own stock receipt.
  const receivedB = await request("/api/inventory/movements", {
    method: "POST",
    token: tokenB,
    body: {
      productId: productB._id,
      movementType: "RECEIVED",
      quantity: 2,
      reason: "Business B supplier delivery",
    },
  });

  assert.equal(receivedB.status, 201, receivedB.body.message);
  assert.equal(receivedB.body.data.movement.stockBefore, 4);
  assert.equal(receivedB.body.data.movement.stockAfter, 6);

  // Only two successful movements should exist for Business A.
  const historyA = await request("/api/inventory/movements", {
    token: tokenA,
  });

  assert.equal(historyA.status, 200);
  assert.equal(historyA.body.data.movements.length, 2);
  assert.equal(historyA.body.data.pagination.total, 2);

  const historyB = await request("/api/inventory/movements", {
    token: tokenB,
  });

  assert.equal(historyB.status, 200);
  assert.equal(historyB.body.data.movements.length, 1);
  assert.equal(historyB.body.data.pagination.total, 1);

  // Product-specific history is also tenant-isolated.
  const productHistory = await request(
    `/api/inventory/movements?productId=${productA._id}`,
    { token: tokenA }
  );

  assert.equal(productHistory.status, 200);
  assert.equal(productHistory.body.data.movements.length, 2);

  const foreignProductHistory = await request(
    `/api/inventory/movements?productId=${productB._id}`,
    { token: tokenA }
  );

  assert.equal(foreignProductHistory.status, 200);
  assert.equal(foreignProductHistory.body.data.movements.length, 0);
  assert.equal(foreignProductHistory.body.data.pagination.total, 0);

  // Pagination returns stable page sizes and accurate totals.
  const pageOne = await request(
    "/api/inventory/movements?page=1&limit=1",
    { token: tokenA }
  );

  assert.equal(pageOne.status, 200);
  assert.equal(pageOne.body.data.movements.length, 1);
  assert.equal(pageOne.body.data.pagination.total, 2);
  assert.equal(pageOne.body.data.pagination.totalPages, 2);

  const invalidPage = await request(
    "/api/inventory/movements?page=0",
    { token: tokenA }
  );

  assert.equal(invalidPage.status, 400);

  // Invalid requests must not create extra audit records.
  assert.equal(
    await InventoryMovement.countDocuments({
      businessId: businessIds[0],
    }),
    2
  );

  assert.equal(
    await InventoryMovement.countDocuments({
      businessId: businessIds[1],
    }),
    1
  );
});
