const {
  createSale,
  recordSalePayment,
  listSales,
  getSaleById,
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

async function list(req, res, next) {
  try {
    const result = await listSales(req.tenantId, req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const sale = await getSaleById(
      req.tenantId,
      req.params.saleId
    );

    return res.status(200).json({
      success: true,
      data: { sale },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  recordPayment,
  list,
  getById,
};
