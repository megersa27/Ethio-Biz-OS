
const {
  getDashboardSummary,
} = require("../../services/reportService");

/**
 * Generate a complete business overview.
 * Uses actual data from the authenticated business.
 */
async function analyzeBusinessOverview(tenantId, filters = {}) {
  const report = await getDashboardSummary(tenantId, filters);

  return {
    period: report.period,

    // Sales performance
    sales: {
      totalSalesETB: report.totalSalesMinor / 100,
      salesCount: report.salesCount,
      costOfGoodsSoldETB:
        report.costOfGoodsSoldMinor / 100,
      grossProfitETB:
        report.grossProfitMinor / 100,
    },

    // Financial performance
    finance: {
      totalExpensesETB:
        report.totalExpensesMinor / 100,
      netProfitETB:
        report.netProfitMinor / 100,
      paymentsCollectedETB:
        report.paymentsCollectedMinor / 100,
    },

    // Inventory performance
    inventory: {
      totalProducts: report.totalProducts,
      lowStockProducts: report.lowStockProducts,
      inventoryValueETB:
        report.inventoryValueMinor / 100,
      lowStockItems: report.lowStockItems,
    },

    // Customer credit
    customerCredit: {
      outstandingCreditETB:
        report.outstandingCreditMinor / 100,
      outstandingSaleCount: report.outstandingSaleCount,
    },

    generatedAt: report.generatedAt,
  };
}

module.exports = {
  analyzeBusinessOverview,
};
