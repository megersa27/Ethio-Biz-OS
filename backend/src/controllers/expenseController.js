const {
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  deactivateExpense: deactivateExpenseService,
} = require("../services/expenseService");

// POST /api/expenses
async function create(req, res, next) {
  try {
    const expense = await createExpense(
      req.tenantId,
      req.user.id,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/expenses
async function list(req, res, next) {
  try {
    const result = await listExpenses(req.tenantId, req.query);

    return res.status(200).json({
      success: true,
      message: "Expenses retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/expenses/:expenseId
async function getById(req, res, next) {
  try {
    const expense = await getExpenseById(
      req.tenantId,
      req.params.expenseId
    );

    return res.status(200).json({
      success: true,
      message: "Expense retrieved successfully",
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/expenses/:expenseId
async function update(req, res, next) {
  try {
    const expense = await updateExpense(
      req.tenantId,
      req.params.expenseId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/expenses/:expenseId
async function deactivate(req, res, next) {
  try {
    const expense = await deactivateExpenseService(
      req.tenantId,
      req.params.expenseId
    );

    return res.status(200).json({
      success: true,
      message: "Expense deactivated successfully",
      data: { expense },
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
