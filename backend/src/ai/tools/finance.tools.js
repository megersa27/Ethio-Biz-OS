
const {
  getExpensesReport,
  getProfitReport,
} = require("../../services/reportService");

/**
 * Analyze business expenses.
 */
async function analyzeExpenses(tenantId, filters = {}) {
  const report = await getExpensesReport(tenantId, filters);

  return {
    period: report.period,

    totalExpensesETB:
      report.totalExpensesMinor / 100,

    expenseCount: report.expenseCount,

    expensesByCategory: report.byCategory.map((item) => ({
      category: item.category,
      amountETB: item.totalMinor / 100,
      count: item.count,
    })),

    generatedAt: report.generatedAt,
  };
}

/**
 * Analyze business financial performance.
 */
async function analyzeFinancialPerformance(
  tenantId,
  filters = {}
) {
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

    paymentsCollectedETB:
      report.paymentsCollectedMinor / 100,

    refundsIssuedETB:
      report.refundsIssuedMinor / 100,

    generatedAt: report.generatedAt,
  };
}

module.exports = {
  analyzeExpenses,
  analyzeFinancialPerformance,
};
