require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/database");
const Business = require("../src/models/Business");
const User = require("../src/models/User");
const Product = require("../src/models/Product");

test("businesses can access only their own products", async (t) => {
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
      businessName: `Tenant A Test ${uniqueId}`,
      ownerName: "Test Owner A",
      email: `tenant-a-${uniqueId}@example.com`,
      password: "Tenant-Test-A-2026!",
    },
    {
      businessName: `Tenant B Test ${uniqueId}`,
      ownerName: "Test Owner B",
      email: `tenant-b-${uniqueId}@example.com`,
      password: "Tenant-Test-B-2026!",
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

  // Business A attempts to forge Business B's ID.
  const createdA = await request("/api/products", {
    method: "POST",
    token: tokenA,
    body: {
      name: "Isolation Test Sugar",
      category: "Groceries",
      unit: "kg",
      costPriceMinor: 10000,
      sellingPriceMinor: 12000,
      stockQuantity: 20,
      businessId: businessBId,
    },
  });

  assert.equal(createdA.status, 201);
  assert.equal(
    String(createdA.body.data.product.businessId),
    String(businessAId),
    "The server must assign Business A's ID"
  );

  // Business B creates its own product.
  const createdB = await request("/api/products", {
    method: "POST",
    token: tokenB,
    body: {
      name: "Isolation Test Paracetamol",
      category: "Medicine",
      unit: "pack",
      costPriceMinor: 5000,
      sellingPriceMinor: 8000,
      stockQuantity: 50,
      businessId: businessAId,
    },
  });

  assert.equal(createdB.status, 201);
  assert.equal(
    String(createdB.body.data.product.businessId),
    String(businessBId),
    "The server must assign Business B's ID"
  );

  const productAId = createdA.body.data.product._id;
  const productBId = createdB.body.data.product._id;

  // Each business sees only its own products.
  const listA = await request("/api/products", { token: tokenA });
  const listB = await request("/api/products", { token: tokenB });

  assert.equal(listA.status, 200);
  assert.equal(listB.status, 200);

  assert.deepEqual(
    listA.body.data.products.map((product) => product.name),
    ["Isolation Test Sugar"]
  );

  assert.deepEqual(
    listB.body.data.products.map((product) => product.name),
    ["Isolation Test Paracetamol"]
  );

  // Neither business can retrieve the other's product by ID.
  const crossAccessA = await request(`/api/products/${productBId}`, {
    token: tokenA,
  });

  const crossAccessB = await request(`/api/products/${productAId}`, {
    token: tokenB,
  });

  assert.equal(crossAccessA.status, 404);
  assert.equal(crossAccessB.status, 404);


  // Business A can update its own product.
  const ownUpdate = await request(`/api/products/${productAId}`, {
    method: "PATCH",
    token: tokenA,
    body: {
      sellingPriceMinor: 12500,
    },
  });

  assert.equal(ownUpdate.status, 200);
  assert.equal(ownUpdate.body.success, true);
  assert.equal(
    ownUpdate.body.data.product.sellingPriceMinor,
    12500
  );

  // Business A cannot update Business B's product.
  const crossBusinessUpdate = await request(
    `/api/products/${productBId}`,
    {
      method: "PATCH",
      token: tokenA,
      body: {
        sellingPriceMinor: 99900,
      },
    }
  );

  assert.equal(crossBusinessUpdate.status, 404);

  // Business A cannot transfer its product to Business B.
  const changeOwnership = await request(
    `/api/products/${productAId}`,
    {
      method: "PATCH",
      token: tokenA,
      body: {
        businessId: businessBId,
      },
    }
  );

  assert.equal(changeOwnership.status, 400);

  // Business A cannot bypass inventory tracking.
  const changeStock = await request(
    `/api/products/${productAId}`,
    {
      method: "PATCH",
      token: tokenA,
      body: {
        stockQuantity: 999,
      },
    }
  );

  assert.equal(changeStock.status, 400);

  // Verify the protected values were not changed.
  const verifyProductA = await request(
    `/api/products/${productAId}`,
    { token: tokenA }
  );

  assert.equal(verifyProductA.status, 200);
  assert.equal(
    String(verifyProductA.body.data.product.businessId),
    String(businessAId)
  );
  assert.equal(
    verifyProductA.body.data.product.stockQuantity,
    20
  );
  assert.equal(
    verifyProductA.body.data.product.sellingPriceMinor,
    12500
  );

  // Business B's price remains unchanged.
  const verifyProductB = await request(
    `/api/products/${productBId}`,
    { token: tokenB }
  );

  assert.equal(verifyProductB.status, 200);
  assert.equal(
    verifyProductB.body.data.product.sellingPriceMinor,
    8000
  );


  // Anonymous users cannot list products.
  const anonymous = await request("/api/products");
  assert.equal(anonymous.status, 401);
});
