
const {
  getSalesReport,
  getProfitReport,
} = require("../../services/reportService");

/**
 * Retrieve sales information for the authenticated business.
 *
 * tenantId comes from authenticated backend middleware.
 * The AI must never provide its own tenantId.
 */
async function analyzeSales(tenantId, filters = {}) {
  const report = await getSalesReport(tenantId, filters);

  return {
    period: report.period,

    salesCount: report.salesCount,

    totalSalesETB: report.totalSalesMinor / 100,

    costOfGoodsSoldETB:
      report.costOfGoodsSoldMinor / 100,

    grossProfitETB:
      report.grossProfitMinor / 100,

    paymentsCollectedETB:
      report.paymentsCollectedMinor / 100,

    netCollectionsETB:
      report.netCollectionsMinor / 100,

    outstandingCreditETB:
      report.totalOutstandingCreditMinor / 100,

    outstandingSaleCount:
      report.outstandingSaleCount,

    generatedAt: report.generatedAt,
  };
}

/**
 * Retrieve gross and net profit information.
 */
async function analyzeProfit(tenantId, filters = {}) {
  const report = await getProfitReport(tenantId, filters);

  return {
    period: report.period,

    totalSalesETB:
      report.totalSalesMinor / 100,

    costOfGoodsSoldETB:
      report.costOfGoodsSoldMinor / 100,

    grossProfitETB:
      report.grossProfitMinor / 100,

    totalExpensesETB:
      report.totalExpensesMinor / 100,

    netProfitETB:
      report.netProfitMinor / 100,

    generatedAt: report.generatedAt,
  };
}

module.exports = {
  analyzeSales,
  analyzeProfit,
};
