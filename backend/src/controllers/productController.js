
const {
  createProduct,
  listProducts,
  getProductById,
} = require("../services/productService");

// POST /api/products
async function create(req, res, next) {
  try {
    const product = await createProduct(
      req.tenantId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: { product },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/products
async function list(req, res, next) {
  try {
    const products = await listProducts(req.tenantId);

    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: { products },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/products/:productId
async function getById(req, res, next) {
  try {
    const product = await getProductById(
      req.tenantId,
      req.params.productId
    );

    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: { product },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  list,
  getById,
};