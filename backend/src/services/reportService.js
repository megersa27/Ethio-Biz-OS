const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Expense = require("../models/Expense");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateTenantId(tenantId) {
  if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
    throw createError("A valid business context is required", 403);
  }
}

function parseDateOnly(value, fieldName) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw createError(`${fieldName} must use YYYY-MM-DD format`, 400);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw createError(`${fieldName} is not a valid calendar date`, 400);
  }

  return date;
}

async function getSalesReport(tenantId, filters = {}) {
  validateTenantId(tenantId);

  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw createError("Invalid report filters", 400);
  }

  const allowedFields = ["startDate", "endDate"];
  const unsupportedField = Object.keys(filters).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported report filter: ${unsupportedField}`, 400);
  }

  let startDate;
  let endDateExclusive;

  if (filters.startDate !== undefined) {
    startDate = parseDateOnly(filters.startDate, "startDate");
  }

  if (filters.endDate !== undefined) {
    const endDate = parseDateOnly(filters.endDate, "endDate");
    endDateExclusive = new Date(endDate);
    endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
  }

  if (
    startDate &&
    endDateExclusive &&
    startDate.getTime() >= endDateExclusive.getTime()
  ) {
    throw createError("endDate must be on or after startDate", 400);
  }

  const businessObjectId = new mongoose.Types.ObjectId(tenantId);
  const salesMatch = {
    businessId: businessObjectId,
    saleStatus: { $ne: "CANCELLED" },
  };
  const paymentDateMatch = {};
  const refundDateMatch = {};

  if (startDate) {
    salesMatch.createdAt = { $gte: startDate };
    paymentDateMatch["payments.paidAt"] = { $gte: startDate };
    refundDateMatch["refunds.refundedAt"] = { $gte: startDate };
  }

  if (endDateExclusive) {
    salesMatch.createdAt ??= {};
    salesMatch.createdAt.$lt = endDateExclusive;

    paymentDateMatch["payments.paidAt"] ??= {};
    paymentDateMatch["payments.paidAt"].$lt = endDateExclusive;

    refundDateMatch["refunds.refundedAt"] ??= {};
    refundDateMatch["refunds.refundedAt"].$lt = endDateExclusive;
  }

  const [
    salesSummaryRows,
    paymentSummaryRows,
    refundSummaryRows,
    outstandingSummaryRows,
  ] = await Promise.all([
    // Sales, cost and the current balance for sales created in the period.
    Sale.aggregate([
      { $match: salesMatch },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          totalSalesMinor: { $sum: "$totalAmountMinor" },
          costOfGoodsSoldMinor: { $sum: "$totalCostMinor" },
          outstandingCreditForPeriodMinor: { $sum: "$balanceDueMinor" },
        },
      },
    ]),

    // Count collections by payment date, independently of sale date.
    Sale.aggregate([
      { $match: { businessId: businessObjectId } },
      { $unwind: "$payments" },
      ...(Object.keys(paymentDateMatch).length
        ? [{ $match: paymentDateMatch }]
        : []),
      {
        $group: {
          _id: null,
          paymentsCollectedMinor: { $sum: "$payments.amountMinor" },
          paymentCount: { $sum: 1 },
        },
      },
    ]),

    // Count refunds by the date money was returned.
    Sale.aggregate([
      { $match: { businessId: businessObjectId } },
      { $unwind: "$refunds" },
      ...(Object.keys(refundDateMatch).length
        ? [{ $match: refundDateMatch }]
        : []),
      {
        $group: {
          _id: null,
          refundsIssuedMinor: { $sum: "$refunds.amountMinor" },
          refundCount: { $sum: 1 },
        },
      },
    ]),

    // Current receivables across non-cancelled sales for this business.
    Sale.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          saleStatus: { $ne: "CANCELLED" },
          balanceDueMinor: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalOutstandingCreditMinor: { $sum: "$balanceDueMinor" },
          outstandingSaleCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const sales = salesSummaryRows[0] || {
    salesCount: 0,
    totalSalesMinor: 0,
    costOfGoodsSoldMinor: 0,
    outstandingCreditForPeriodMinor: 0,
  };

  const payments = paymentSummaryRows[0] || {
    paymentsCollectedMinor: 0,
    paymentCount: 0,
  };

  const refunds = refundSummaryRows[0] || {
    refundsIssuedMinor: 0,
    refundCount: 0,
  };

  const outstanding = outstandingSummaryRows[0] || {
    totalOutstandingCreditMinor: 0,
    outstandingSaleCount: 0,
  };

  return {
    period: {
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      timezone: "UTC",
    },
    salesCount: sales.salesCount,
    totalSalesMinor: sales.totalSalesMinor,
    costOfGoodsSoldMinor: sales.costOfGoodsSoldMinor,
    grossProfitMinor:
      sales.totalSalesMinor - sales.costOfGoodsSoldMinor,
    paymentsCollectedMinor: payments.paymentsCollectedMinor,
    paymentCount: payments.paymentCount,
    refundsIssuedMinor: refunds.refundsIssuedMinor,
    refundCount: refunds.refundCount,
    netCollectionsMinor:
      payments.paymentsCollectedMinor - refunds.refundsIssuedMinor,
    outstandingCreditForPeriodMinor:
      sales.outstandingCreditForPeriodMinor,
    totalOutstandingCreditMinor:
      outstanding.totalOutstandingCreditMinor,
    outstandingSaleCount: outstanding.outstandingSaleCount,
    generatedAt: new Date().toISOString(),
  };
}

function validateReportFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw createError("Invalid report filters", 400);
  }

  const allowedFields = ["startDate", "endDate"];
  const unsupportedField = Object.keys(filters).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported report filter: ${unsupportedField}`, 400);
  }
}

// Convert optional startDate / endDate into an inclusive start and exclusive end.
function resolvePeriod(filters) {
  let startDate;
  let endDateExclusive;

  if (filters.startDate !== undefined) {
    startDate = parseDateOnly(filters.startDate, "startDate");
  }

  if (filters.endDate !== undefined) {
    const endDate = parseDateOnly(filters.endDate, "endDate");
    endDateExclusive = new Date(endDate);
    endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
  }

  if (
    startDate &&
    endDateExclusive &&
    startDate.getTime() >= endDateExclusive.getTime()
  ) {
    throw createError("endDate must be on or after startDate", 400);
  }

  return { startDate, endDateExclusive };
}

function buildExpenseDateRange(startDate, endDateExclusive) {
  const dateRange = {};

  if (startDate) {
    dateRange.$gte = startDate;
  }

  if (endDateExclusive) {
    dateRange.$lt = endDateExclusive;
  }

  return dateRange;
}

// Sum active expenses for the authenticated business within a period.
async function sumExpenses(tenantId, filters = {}) {
  const { startDate, endDateExclusive } = resolvePeriod(filters);
  const businessObjectId = new mongoose.Types.ObjectId(tenantId);

  const match = {
    businessId: businessObjectId,
    isActive: true,
  };

  const dateRange = buildExpenseDateRange(startDate, endDateExclusive);

  if (Object.keys(dateRange).length > 0) {
    match.date = dateRange;
  }

  const rows = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalExpensesMinor: { $sum: "$amountMinor" },
        expenseCount: { $sum: 1 },
      },
    },
  ]);

  return rows[0] || { totalExpensesMinor: 0, expenseCount: 0 };
}

// Current inventory snapshot: product counts, low-stock items and stock value.
async function inventorySnapshot(tenantId) {
  const businessObjectId = new mongoose.Types.ObjectId(tenantId);

  const [totalProducts, lowStockItems, valueRows] = await Promise.all([
    Product.countDocuments({
      businessId: businessObjectId,
      isActive: true,
    }),

    // A product is low stock when stock has fallen to or below its reorder point.
    Product.find({
      businessId: businessObjectId,
      isActive: true,
      $expr: { $lte: ["$stockQuantity", "$minimumStockLevel"] },
    })
      .sort({ stockQuantity: 1 })
      .limit(50)
      .select("name unit stockQuantity minimumStockLevel"),

    // Total stock value at cost.
    Product.aggregate([
      { $match: { businessId: businessObjectId, isActive: true } },
      {
        $group: {
          _id: null,
          inventoryValueMinor: {
            $sum: { $multiply: ["$stockQuantity", "$costPriceMinor"] },
          },
        },
      },
    ]),
  ]);

  // Fractional quantities (kg, litre) can produce fractional santim; round to whole santim.
  const rawValue = valueRows[0]?.inventoryValueMinor || 0;

  return {
    totalProducts,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    inventoryValueMinor: Math.round(rawValue),
  };
}

// Dashboard summary combining sales, expenses, profit and inventory state.
async function getDashboardSummary(tenantId, filters = {}) {
  validateTenantId(tenantId);
  validateReportFilters(filters);

  const periodFilters = {};

  if (filters.startDate !== undefined) {
    periodFilters.startDate = filters.startDate;
  }

  if (filters.endDate !== undefined) {
    periodFilters.endDate = filters.endDate;
  }

  // Sales, COGS, gross profit and current receivables for the period.
  const salesReport = await getSalesReport(tenantId, periodFilters);
  const expenseSummary = await sumExpenses(tenantId, periodFilters);
  const inventory = await inventorySnapshot(tenantId);

  const grossProfitMinor = salesReport.grossProfitMinor;
  const totalExpensesMinor = expenseSummary.totalExpensesMinor;
  const netProfitMinor = grossProfitMinor - totalExpensesMinor;

  return {
    period: {
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      timezone: "UTC",
    },
    totalSalesMinor: salesReport.totalSalesMinor,
    costOfGoodsSoldMinor: salesReport.costOfGoodsSoldMinor,
    grossProfitMinor,
    totalExpensesMinor,
    netProfitMinor,
    salesCount: salesReport.salesCount,
    totalProducts: inventory.totalProducts,
    lowStockProducts: inventory.lowStockCount,
    lowStockItems: inventory.lowStockItems,
    inventoryValueMinor: inventory.inventoryValueMinor,
    outstandingCreditMinor: salesReport.totalOutstandingCreditMinor,
    outstandingSaleCount: salesReport.outstandingSaleCount,
    paymentsCollectedMinor: salesReport.paymentsCollectedMinor,
    generatedAt: new Date().toISOString(),
  };
}

// Expense totals for a period, broken down by category.
async function getExpensesReport(tenantId, filters = {}) {
  validateTenantId(tenantId);
  validateReportFilters(filters);

  const { startDate, endDateExclusive } = resolvePeriod(filters);
  const businessObjectId = new mongoose.Types.ObjectId(tenantId);

  const match = {
    businessId: businessObjectId,
    isActive: true,
  };

  const dateRange = buildExpenseDateRange(startDate, endDateExclusive);

  if (Object.keys(dateRange).length > 0) {
    match.date = dateRange;
  }

  const [totalRows, byCategory] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalExpensesMinor: { $sum: "$amountMinor" },
          expenseCount: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          totalMinor: { $sum: "$amountMinor" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalMinor: -1 } },
    ]),
  ]);

  const total = totalRows[0] || { totalExpensesMinor: 0, expenseCount: 0 };

  return {
    period: {
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      timezone: "UTC",
    },
    totalExpensesMinor: total.totalExpensesMinor,
    expenseCount: total.expenseCount,
    byCategory: byCategory.map((row) => ({
      category: row._id,
      totalMinor: row.totalMinor,
      count: row.count,
    })),
    generatedAt: new Date().toISOString(),
  };
}

// Gross and net profit for a period.
async function getProfitReport(tenantId, filters = {}) {
  validateTenantId(tenantId);
  validateReportFilters(filters);

  const periodFilters = {};

  if (filters.startDate !== undefined) {
    periodFilters.startDate = filters.startDate;
  }

  if (filters.endDate !== undefined) {
    periodFilters.endDate = filters.endDate;
  }

  const salesReport = await getSalesReport(tenantId, periodFilters);
  const expenseSummary = await sumExpenses(tenantId, periodFilters);

  const grossProfitMinor = salesReport.grossProfitMinor;
  const totalExpensesMinor = expenseSummary.totalExpensesMinor;

  return {
    period: {
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      timezone: "UTC",
    },
    totalSalesMinor: salesReport.totalSalesMinor,
    costOfGoodsSoldMinor: salesReport.costOfGoodsSoldMinor,
    grossProfitMinor,
    totalExpensesMinor,
    netProfitMinor: grossProfitMinor - totalExpensesMinor,
    paymentsCollectedMinor: salesReport.paymentsCollectedMinor,
    refundsIssuedMinor: salesReport.refundsIssuedMinor,
    generatedAt: new Date().toISOString(),
  };
}

// Current stock health for the authenticated business.
async function getStockReport(tenantId) {
  validateTenantId(tenantId);

  const inventory = await inventorySnapshot(tenantId);

  return {
    totalProducts: inventory.totalProducts,
    lowStockProducts: inventory.lowStockCount,
    lowStockItems: inventory.lowStockItems,
    inventoryValueMinor: inventory.inventoryValueMinor,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getSalesReport,
  getDashboardSummary,
  getExpensesReport,
  getProfitReport,
  getStockReport,
};
