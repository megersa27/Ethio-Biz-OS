
const { getStockReport } = require("../../services/reportService");

// Analyze inventory for one business.
async function analyzeInventory(tenantId) {
  const report = await getStockReport(tenantId);

  return {
    totalProducts: report.totalProducts,
    lowStockProducts: report.lowStockProducts,
    lowStockItems: report.lowStockItems,

    // Convert minor currency units (santim) to ETB.
    inventoryValueETB: report.inventoryValueMinor / 100,

    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  analyzeInventory,
};
