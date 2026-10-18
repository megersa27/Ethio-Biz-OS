const {
  createSale,
  recordSalePayment,
} = require("../services/saleService");

async function create(req, res, next) {
  try {
    const sale = await createSale(
      req.tenantId,
      req.user.id,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      data: { sale },
    });
  } catch (error) {
    next(error);
  }
}

async function recordPayment(req, res, next) {
  try {
    const sale = await recordSalePayment(
      req.tenantId,
      req.user.id,
      req.params.saleId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: { sale },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  recordPayment,
};
