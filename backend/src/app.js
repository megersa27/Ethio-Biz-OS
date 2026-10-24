
const express = require("express");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const saleRoutes = require("./routes/saleRoutes");
const customerRoutes = require("./routes/customerRoutes");
const reportRoutes = require("./routes/reportRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

const app = express();

app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EthioBiz OS API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/settings", settingsRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    console.error("API error:", err.message);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An unexpected server error occurred"
        : err.message,
  });
});

module.exports = app;