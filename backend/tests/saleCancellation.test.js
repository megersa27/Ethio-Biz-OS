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

test("sale cancellation restores stock once and preserves history", async (t) => {
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
    businessName: `Cancel Test ${label} ${id}`,
    ownerName: `Cancel Owner ${label}`,
    email: `cancel-${label}-${id}@example.com`,
    password: `Cancel-Test-${label}-2026!`,
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

  const customerResult = await request("/api/customers", {
    method: "POST",
    token: tokenA,
    body: { name: `Cancel Customer ${id}` },
  });

  assert.equal(customerResult.status, 201, customerResult.body.message);

  async function createProduct(token, name) {
    const result = await request("/api/products", {
      method: "POST",
      token,
      body: {
        name: `${name} ${id}`,
        unit: "piece",
        costPriceMinor: 1000,
        sellingPriceMinor: 2000,
        stockQuantity: 10,
      },
    });

    assert.equal(result.status, 201, result.body.message);
    return result.body.data.product;
  }

  const productA = await createProduct(tokenA, "Cancel Product A");
  const productB = await createProduct(tokenB, "Cancel Product B");

  // Business A creates a 4,000-santim sale with 1,000 santim paid.
  const saleAResult = await request("/api/sales", {
    method: "POST",
    token: tokenA,
    body: {
      customerId: customerResult.body.data.customer._id,
      items: [{ productId: productA._id, quantity: 2 }],
      paidAmountMinor: 1000,
      paymentMethod: "cash",
    },
  });

  assert.equal(saleAResult.status, 201, saleAResult.body.message);

  const saleAId = saleAResult.body.data.sale._id;

  // Stock drops from 10 to 8 when the sale is completed.
  let savedProductA = await Product.findById(productA._id);
  assert.equal(savedProductA.stockQuantity, 8);

  // Business B creates a separate paid sale.
  const saleBResult = await request("/api/sales", {
    method: "POST",
    token: tokenB,
    body: {
      items: [{ productId: productB._id, quantity: 1 }],
      paidAmountMinor: 2000,
      paymentMethod: "cash",
    },
  });

  assert.equal(saleBResult.status, 201, saleBResult.body.message);

  const saleBId = saleBResult.body.data.sale._id;

  // Business A cannot cancel Business B's sale.
  const foreignCancellation = await request(
    `/api/sales/${saleBId}/cancel`,
    {
      method: "POST",
      token: tokenA,
      body: { reason: "Unauthorized cancellation attempt" },
    }
  );

  assert.equal(foreignCancellation.status, 404);

  const savedProductB = await Product.findById(productB._id);
  assert.equal(savedProductB.stockQuantity, 9);

  // Business A cancels its own sale.
  const cancellation = await request(
    `/api/sales/${saleAId}/cancel`,
    {
      method: "POST",
      token: tokenA,
      body: { reason: "Sale entered incorrectly" },
    }
  );

  assert.equal(
    cancellation.status,
    200,
    cancellation.body.message
  );

  const cancelledSale = cancellation.body.data.sale;

  assert.equal(cancelledSale.saleStatus, "CANCELLED");
  assert.equal(cancelledSale.totalAmountMinor, 4000);
  assert.equal(cancelledSale.paidAmountMinor, 1000);
  assert.equal(cancelledSale.balanceDueAtCancellationMinor, 3000);
  assert.equal(cancelledSale.balanceDueMinor, 0);
  assert.equal(cancelledSale.payments.length, 1);
  assert.equal(cancelledSale.cancellationReason, "Sale entered incorrectly");
  assert.ok(cancelledSale.cancelledAt);
  assert.equal(
    String(cancelledSale.cancelledBy),
    registrations[0].user.id
  );

  // Inventory returns to its original quantity.
  savedProductA = await Product.findById(productA._id);
  assert.equal(savedProductA.stockQuantity, 10);

  // The original sale and payment history remain in the database.
  const storedSale = await Sale.findById(saleAId);
  assert.ok(storedSale);
  assert.equal(storedSale.saleStatus, "CANCELLED");
  assert.equal(storedSale.payments.length, 1);
  assert.equal(storedSale.payments[0].amountMinor, 1000);

  // A second cancellation is rejected and cannot add stock again.
  const duplicateCancellation = await request(
    `/api/sales/${saleAId}/cancel`,
    {
      method: "POST",
      token: tokenA,
      body: { reason: "Trying again" },
    }
  );

  assert.equal(duplicateCancellation.status, 409);

  savedProductA = await Product.findById(productA._id);
  assert.equal(savedProductA.stockQuantity, 10);

  // The cancelled sale remains visible in its business's history.
  const detail = await request(`/api/sales/${saleAId}`, {
    token: tokenA,
  });

  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.sale.saleStatus, "CANCELLED");

  // Cancelled sales are excluded from active revenue and gross profit.
  // Original payments remain in collections until a refund is recorded.
  const reportResult = await request("/api/reports/sales", {
    token: tokenA,
  });

  assert.equal(reportResult.status, 200, reportResult.body.message);

  const report = reportResult.body.data.report;

  assert.equal(report.salesCount, 0);
  assert.equal(report.totalSalesMinor, 0);
  assert.equal(report.costOfGoodsSoldMinor, 0);
  assert.equal(report.grossProfitMinor, 0);
  assert.equal(report.paymentsCollectedMinor, 1000);
  assert.equal(report.refundsIssuedMinor, 0);
  assert.equal(report.netCollectionsMinor, 1000);
  assert.equal(report.outstandingCreditForPeriodMinor, 0);
  assert.equal(report.totalOutstandingCreditMinor, 0);

  // Business B cannot refund Business A's cancelled sale.
  const foreignRefund = await request(
    `/api/sales/${saleAId}/refunds`,
    {
      method: "POST",
      token: tokenB,
      body: {
        amountMinor: 100,
        method: "cash",
        reason: "Foreign business refund attempt",
      },
    }
  );

  assert.equal(foreignRefund.status, 404);

  // A refund cannot be recorded against Business B's active sale.
  const activeSaleRefund = await request(
    `/api/sales/${saleBId}/refunds`,
    {
      method: "POST",
      token: tokenB,
      body: {
        amountMinor: 100,
        method: "cash",
        reason: "Sale has not been cancelled",
      },
    }
  );

  assert.equal(activeSaleRefund.status, 409);

  // Refund 400 santim of the 1,000 originally collected.
  const partialRefund = await request(
    `/api/sales/${saleAId}/refunds`,
    {
      method: "POST",
      token: tokenA,
      body: {
        amountMinor: 400,
        method: "cash",
        reference: "REFUND-PART-1",
        reason: "Partial refund to customer",
      },
    }
  );

  assert.equal(
    partialRefund.status,
    200,
    partialRefund.body.message
  );
  assert.equal(partialRefund.body.data.sale.payments.length, 1);
  assert.equal(partialRefund.body.data.sale.payments[0].amountMinor, 1000);
  assert.equal(partialRefund.body.data.sale.paidAmountMinor, 1000);
  assert.equal(partialRefund.body.data.sale.refunds.length, 1);
  assert.equal(partialRefund.body.data.sale.refunds[0].amountMinor, 400);

  // Refunding more than the remaining 600 santim must be rejected.
  const overRefund = await request(
    `/api/sales/${saleAId}/refunds`,
    {
      method: "POST",
      token: tokenA,
      body: {
        amountMinor: 700,
        method: "cash",
        reason: "Attempt to exceed refundable amount",
      },
    }
  );

  assert.equal(overRefund.status, 400);

  const storedAfterRejectedRefund = await Sale.findById(saleAId);
  assert.equal(storedAfterRejectedRefund.payments.length, 1);
  assert.equal(storedAfterRejectedRefund.paidAmountMinor, 1000);
  assert.equal(storedAfterRejectedRefund.refunds.length, 1);
  assert.equal(storedAfterRejectedRefund.refunds[0].amountMinor, 400);

  // The report now separates original collections from actual refunds.
  const reportAfterPartialRefund = await request("/api/reports/sales", {
    token: tokenA,
  });

  assert.equal(reportAfterPartialRefund.status, 200);
  assert.equal(
    reportAfterPartialRefund.body.data.report.paymentsCollectedMinor,
    1000
  );
  assert.equal(
    reportAfterPartialRefund.body.data.report.refundsIssuedMinor,
    400
  );
  assert.equal(
    reportAfterPartialRefund.body.data.report.netCollectionsMinor,
    600
  );

  // Refund the remaining 600 santim.
  const finalRefund = await request(
    `/api/sales/${saleAId}/refunds`,
    {
      method: "POST",
      token: tokenA,
      body: {
        amountMinor: 600,
        method: "cash",
        reference: "REFUND-FINAL",
        reason: "Complete the refund",
      },
    }
  );

  assert.equal(finalRefund.status, 200, finalRefund.body.message);
  assert.equal(finalRefund.body.data.sale.payments.length, 1);
  assert.equal(finalRefund.body.data.sale.paidAmountMinor, 1000);
  assert.equal(finalRefund.body.data.sale.refunds.length, 2);

  const finalReport = await request("/api/reports/sales", {
    token: tokenA,
  });

  assert.equal(finalReport.status, 200);
  assert.equal(
    finalReport.body.data.report.refundsIssuedMinor,
    1000
  );
  assert.equal(
    finalReport.body.data.report.netCollectionsMinor,
    0
  );
});
