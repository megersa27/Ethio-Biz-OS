require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/database");
const Business = require("../src/models/Business");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");

test("customers remain isolated between businesses", async (t) => {
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
        await Customer.deleteMany({
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
      businessName: `Customer Test A ${uniqueId}`,
      ownerName: "Customer Test Owner A",
      email: `customer-test-a-${uniqueId}@example.com`,
      password: "Customer-Test-A-2026!",
    },
    {
      businessName: `Customer Test B ${uniqueId}`,
      ownerName: "Customer Test Owner B",
      email: `customer-test-b-${uniqueId}@example.com`,
      password: "Customer-Test-B-2026!",
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

  // Business A attempts to assign its customer to Business B.
  const forgedCustomer = await request("/api/customers", {
    method: "POST",
    token: tokenA,
    body: {
      name: `Forged Customer ${uniqueId}`,
      businessId: businessBId,
    },
  });

  assert.equal(
    forgedCustomer.status,
    400,
    "Clients must not be allowed to supply businessId"
  );

  // Business A creates a legitimate customer.
  const createdA = await request("/api/customers", {
    method: "POST",
    token: tokenA,
    body: {
      name: "Alpha Test Customer",
      phone: "0911000001",
      email: "ALPHA.TEST@example.com",
    },
  });

  assert.equal(
    createdA.status,
    201,
    `Customer creation failed: ${createdA.body.message}`
  );

  assert.equal(
    String(createdA.body.data.customer.businessId),
    String(businessAId)
  );

  assert.equal(
    createdA.body.data.customer.email,
    "alpha.test@example.com"
  );

  // Business B creates its own customer.
  const createdB = await request("/api/customers", {
    method: "POST",
    token: tokenB,
    body: {
      name: "Beta Test Customer",
      phone: "0922000002",
    },
  });

  assert.equal(
    createdB.status,
    201,
    `Customer creation failed: ${createdB.body.message}`
  );

  assert.equal(
    String(createdB.body.data.customer.businessId),
    String(businessBId)
  );

  // Each business can list only its own customers.
  const listA = await request("/api/customers", {
    token: tokenA,
  });

  const listB = await request("/api/customers", {
    token: tokenB,
  });

  assert.equal(listA.status, 200);
  assert.equal(listB.status, 200);

  assert.deepEqual(
    listA.body.data.customers.map((customer) => customer.name),
    ["Alpha Test Customer"]
  );

  assert.deepEqual(
    listB.body.data.customers.map((customer) => customer.name),
    ["Beta Test Customer"]
  );

  // The failed forgery must not create a customer for Business B.
  const forgedCount = await Customer.countDocuments({
    businessId: businessBId,
    name: `Forged Customer ${uniqueId}`,
  });

  assert.equal(forgedCount, 0);

  // Anonymous users cannot list customers.
  const anonymous = await request("/api/customers");

  assert.equal(anonymous.status, 401);
});
