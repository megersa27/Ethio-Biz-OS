const {
  getSalesReport,
  getDashboardSummary,
  getExpensesReport,
  getProfitReport,
  getStockReport,
} = require("../services/reportService");

async function sales(req, res, next) {
  try {
    const report = await getSalesReport(req.tenantId, req.query);

    return res.status(200).json({
      success: true,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/reports/summary
async function summary(req, res, next) {
  try {
    const report = await getDashboardSummary(req.tenantId, req.query);

    return res.status(200).json({
      success: true,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/reports/expenses
async function expenses(req, res, next) {
  try {
    const report = await getExpensesReport(req.tenantId, req.query);

    return res.status(200).json({
      success: true,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/reports/profit
async function profit(req, res, next) {
  try {
    const report = await getProfitReport(req.tenantId, req.query);

    return res.status(200).json({
      success: true,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/reports/stock
async function stock(req, res, next) {
  try {
    const report = await getStockReport(req.tenantId);

    return res.status(200).json({
      success: true,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sales,
  summary,
  expenses,
  profit,
  stock,
};
