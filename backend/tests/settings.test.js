require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/database");
const Business = require("../src/models/Business");
const User = require("../src/models/User");
const { hashPassword } = require("../src/utils/password");

test("settings profiles are secure, update correctly, and remain tenant-scoped", async (t) => {
  await connectDB();

  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const businessIds = [];
  const userIds = [];

  t.after(async () => {
    try {
      if (userIds.length) {
        await User.deleteMany({ _id: { $in: userIds } });
      }

      if (businessIds.length) {
        await Business.deleteMany({ _id: { $in: businessIds } });
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
    const headers = { "Content-Type": "application/json" };

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
      businessName: `Settings Business A ${uniqueId}`,
      ownerName: "Settings Owner A",
      email: `settings-a-${uniqueId}@example.com`,
      password: "Settings-Test-A-2026!",
    },
    {
      businessName: `Settings Business B ${uniqueId}`,
      ownerName: "Settings Owner B",
      email: `settings-b-${uniqueId}@example.com`,
      password: "Settings-Test-B-2026!",
    },
  ];

  const registrations = [];

  for (const account of accounts) {
    const result = await request("/api/auth/register", {
      method: "POST",
      body: account,
    });

    assert.equal(
      result.status,
      201,
      `Registration failed: ${result.body.message}`
    );

    registrations.push(result.body.data);
    businessIds.push(result.body.data.business.id);
    userIds.push(result.body.data.user.id);
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

  // Each owner sees their own profile only.
  const profileA = await request("/api/settings/profile", {
    token: tokenA,
  });
  const profileB = await request("/api/settings/profile", {
    token: tokenB,
  });

  assert.equal(profileA.status, 200);
  assert.equal(profileB.status, 200);
  assert.equal(profileA.body.data.profile.business.name, accounts[0].businessName);
  assert.equal(profileB.body.data.profile.business.name, accounts[1].businessName);

  // Password hashes must never appear in a profile response.
  assert.equal(
    Object.hasOwn(profileA.body.data.profile.user, "passwordHash"),
    false
  );

  // Owner A can update their profile and business details.
  const updateA = await request("/api/settings/profile", {
    method: "PUT",
    token: tokenA,
    body: {
      user: {
        name: "Updated Settings Owner A",
        email: `updated-a-${uniqueId}@example.com`,
        phone: `+2519${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`,
      },
      business: {
        name: "Updated Settings Business A",
        phone: "+251911000002",
        address: "Adama, Ethiopia",
      },
      // The server must ignore a client-supplied tenant ID.
      businessId: businessBId,
    },
  });

  assert.equal(
    updateA.status,
    200,
    `Profile update failed: ${updateA.body.message}`
  );

  assert.equal(updateA.body.data.profile.user.name, "Updated Settings Owner A");
  assert.equal(updateA.body.data.profile.business.name, "Updated Settings Business A");
  assert.equal(updateA.body.data.profile.business.id, businessAId);
  assert.equal(updateA.body.data.profile.business.address, "Adama, Ethiopia");

  // Business B must remain unchanged.
  const profileBAfter = await request("/api/settings/profile", {
    token: tokenB,
  });

  assert.equal(profileBAfter.status, 200);
  assert.equal(profileBAfter.body.data.profile.business.id, businessBId);
  assert.equal(profileBAfter.body.data.profile.business.name, accounts[1].businessName);
  assert.equal(profileBAfter.body.data.profile.user.name, accounts[1].ownerName);

  // A duplicate email must be rejected.
  const duplicateEmail = await request("/api/settings/profile", {
    method: "PUT",
    token: tokenA,
    body: {
      user: {
        email: accounts[1].email,
      },
    },
  });

  assert.equal(duplicateEmail.status, 409);

  // A user must retain at least one login identifier.
  const noLoginIdentifier = await request("/api/settings/profile", {
    method: "PUT",
    token: tokenA,
    body: {
      user: {
        email: "",
        phone: "",
      },
    },
  });

  assert.equal(noLoginIdentifier.status, 400);

  // Create a staff account to check owner-only business editing.
  const staffPassword = "Settings-Staff-2026!";
  const staff = await User.create({
    businessId: businessAId,
    name: "Settings Staff",
    email: `settings-staff-${uniqueId}@example.com`,
    passwordHash: await hashPassword(staffPassword),
    role: "STAFF",
  });

  userIds.push(staff._id.toString());

  const staffToken = await login({
    email: staff.email,
    password: staffPassword,
  });

  const staffBusinessUpdate = await request("/api/settings/profile", {
    method: "PUT",
    token: staffToken,
    body: {
      business: {
        name: "Unauthorised Business Change",
      },
    },
  });

  assert.equal(staffBusinessUpdate.status, 403);

  // Unauthenticated users must not read profiles.
  const unauthenticated = await request("/api/settings/profile");
  assert.equal(unauthenticated.status, 401);
});
