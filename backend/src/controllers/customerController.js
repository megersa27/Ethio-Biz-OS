const {
  createCustomer,
  listCustomers,
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

module.exports = {
  create,
  list,
};
