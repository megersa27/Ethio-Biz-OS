const mongoose = require("mongoose");
const Sale = require("../models/Sale");

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
  const salesMatch = { businessId: businessObjectId };
  const paymentDateMatch = {};

  if (startDate) {
    salesMatch.createdAt = { $gte: startDate };
    paymentDateMatch["payments.paidAt"] = { $gte: startDate };
  }

  if (endDateExclusive) {
    salesMatch.createdAt ??= {};
    salesMatch.createdAt.$lt = endDateExclusive;

    paymentDateMatch["payments.paidAt"] ??= {};
    paymentDateMatch["payments.paidAt"].$lt = endDateExclusive;
  }

  const [
    salesSummaryRows,
    paymentSummaryRows,
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

    // Current receivables across all sales for this business.
    Sale.aggregate([
      {
        $match: {
          businessId: businessObjectId,
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
    outstandingCreditForPeriodMinor:
      sales.outstandingCreditForPeriodMinor,
    totalOutstandingCreditMinor:
      outstanding.totalOutstandingCreditMinor,
    outstandingSaleCount: outstanding.outstandingSaleCount,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getSalesReport };
