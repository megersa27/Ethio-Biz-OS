const {
  recordInventoryMovement,
  listInventoryMovements,
} = require("../services/inventoryService");

// POST /api/inventory/movements
async function createMovement(req, res, next) {
  try {
    const movement = await recordInventoryMovement(
      req.tenantId,
      req.user.id,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Inventory movement recorded successfully",
      data: { movement },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/inventory/movements
async function listMovements(req, res, next) {
  try {
    const { productId, page, limit } = req.query;

    const result = await listInventoryMovements(req.tenantId, {
      ...(productId !== undefined ? { productId } : {}),
      ...(page !== undefined ? { page } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });

    return res.status(200).json({
      success: true,
      message: "Inventory movements retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createMovement,
  listMovements,
};
