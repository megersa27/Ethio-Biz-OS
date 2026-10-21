const {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  deactivateCustomer: deactivateCustomerService,
} = require("../services/customerService");

async function create(req, res, next) {
  try {
    const customer = await createCustomer(req.tenantId, req.body);

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const customers = await listCustomers(req.tenantId);

    return res.status(200).json({
      success: true,
      data: { customers },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/customers/:customerId
async function getById(req, res, next) {
  try {
    const customer = await getCustomerById(
      req.tenantId,
      req.params.customerId
    );

    return res.status(200).json({
      success: true,
      message: "Customer retrieved successfully",
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/customers/:customerId
async function update(req, res, next) {
  try {
    const customer = await updateCustomer(
      req.tenantId,
      req.params.customerId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/customers/:customerId
async function deactivate(req, res, next) {
  try {
    const customer = await deactivateCustomerService(
      req.tenantId,
      req.params.customerId
    );

    return res.status(200).json({
      success: true,
      message: "Customer deactivated successfully",
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  deactivate,
};
