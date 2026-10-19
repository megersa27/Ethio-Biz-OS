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

test("sales reports separate sale dates, collections and outstanding credit", async (t) => {
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
    businessName: `Report Test ${label} ${id}`,
    ownerName: `Report Owner ${label}`,
    email: `report-${label}-${id}@example.com`,
    password: `Report-Test-${label}-2026!`,
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

  const businessAId = registrations[0].business.id;

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

  const customerResult = await request("/api/customers", {
    method: "POST",
    token: tokenA,
    body: { name: `Report Customer ${id}` },
  });

  assert.equal(customerResult.status, 201, customerResult.body.message);
  const customerId = customerResult.body.data.customer._id;

  const productResult = await request("/api/products", {
    method: "POST",
    token: tokenA,
    body: {
      name: `Report Product ${id}`,
      unit: "piece",
      costPriceMinor: 100,
      sellingPriceMinor: 200,
      stockQuantity: 10,
    },
  });

  assert.equal(productResult.status, 201, productResult.body.message);
  const productId = productResult.body.data.product._id;

  // Create a 400-santim credit sale with an initial 100-santim payment.
  const creditSaleResult = await request("/api/sales", {
    method: "POST",
    token: tokenA,
    body: {
      customerId,
      items: [{ productId, quantity: 2 }],
      paidAmountMinor: 100,
      paymentMethod: "cash",
    },
  });

  assert.equal(creditSaleResult.status, 201, creditSaleResult.body.message);
  const creditSaleId = creditSaleResult.body.data.sale._id;

  // Move the sale and its initial payment to yesterday.
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(`${today}T00:00:00.000Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);

  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  // Use the native collection for this test-only backdate.
  // Mongoose timestamps can treat createdAt as immutable.
  const backdateResult = await Sale.collection.updateOne(
    {
      _id: new mongoose.Types.ObjectId(creditSaleId),
      businessId: new mongoose.Types.ObjectId(businessAId),
    },
    {
      $set: {
        createdAt: yesterdayDate,
        "payments.0.paidAt": yesterdayDate,
      },
    }
  );

  assert.equal(
    backdateResult.matchedCount,
    1,
    "The test sale should exist before backdating"
  );

  const backdatedSale = await Sale.findById(creditSaleId);
  assert.equal(
    backdatedSale.createdAt.getTime(),
    yesterdayDate.getTime(),
    "The test sale should be dated yesterday"
  );

  // Receive 150 santim today against yesterday's sale.
  const partialPayment = await request(
    `/api/sales/${creditSaleId}/payments`,
    {
      method: "POST",
      token: tokenA,
      body: { amountMinor: 150, paymentMethod: "cash" },
    }
  );

  assert.equal(partialPayment.status, 200, partialPayment.body.message);
  assert.equal(partialPayment.body.data.sale.balanceDueMinor, 150);

  // Create a fully paid 200-santim sale today, costing 100 santim.
  const todaySale = await request("/api/sales", {
    method: "POST",
    token: tokenA,
    body: {
      items: [{ productId, quantity: 1 }],
      paidAmountMinor: 200,
      paymentMethod: "cash",
    },
  });

  assert.equal(todaySale.status, 201, todaySale.body.message);

  // Today's revenue includes today's sale, but not yesterday's sale.
  const dailyResult = await request(
    `/api/reports/sales?startDate=${today}&endDate=${today}`,
    { token: tokenA }
  );

  assert.equal(dailyResult.status, 200, dailyResult.body.message);

  const daily = dailyResult.body.data.report;

  assert.equal(daily.salesCount, 1);
  assert.equal(daily.totalSalesMinor, 200);
  assert.equal(daily.costOfGoodsSoldMinor, 100);
  assert.equal(daily.grossProfitMinor, 100);

  // Today's collections include today's sale payment plus today's
  // payment against yesterday's sale.
  assert.equal(daily.paymentsCollectedMinor, 350);
  assert.equal(daily.paymentCount, 2);

  // No sale was created today with a current outstanding balance.
  assert.equal(daily.outstandingCreditForPeriodMinor, 0);

  // Overall outstanding credit includes yesterday's remaining balance.
  assert.equal(daily.totalOutstandingCreditMinor, 150);
  assert.equal(daily.outstandingSaleCount, 1);

  // Business B must not see Business A's report totals.
  const reportB = await request("/api/reports/sales", { token: tokenB });

  assert.equal(reportB.status, 200, reportB.body.message);
  assert.equal(reportB.body.data.report.salesCount, 0);
  assert.equal(reportB.body.data.report.totalSalesMinor, 0);
  assert.equal(reportB.body.data.report.paymentsCollectedMinor, 0);
  assert.equal(reportB.body.data.report.totalOutstandingCreditMinor, 0);

  // The previous full day range includes both sales and all three payments.
  const twoDayResult = await request(
    `/api/reports/sales?startDate=${yesterday}&endDate=${today}`,
    { token: tokenA }
  );

  assert.equal(twoDayResult.status, 200, twoDayResult.body.message);

  const twoDay = twoDayResult.body.data.report;

  assert.equal(twoDay.salesCount, 2);
  assert.equal(twoDay.totalSalesMinor, 600);
  assert.equal(twoDay.costOfGoodsSoldMinor, 300);
  assert.equal(twoDay.grossProfitMinor, 300);
  assert.equal(twoDay.paymentsCollectedMinor, 450);
  assert.equal(twoDay.paymentCount, 3);
  assert.equal(twoDay.outstandingCreditForPeriodMinor, 150);
  assert.equal(twoDay.totalOutstandingCreditMinor, 150);
});
