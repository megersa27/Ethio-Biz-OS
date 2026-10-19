const { getSalesReport } = require("../services/reportService");

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

module.exports = { sales };
