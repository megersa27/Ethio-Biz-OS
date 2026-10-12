function requireTenant(req, res, next) {
  if (!req.user || !req.user.businessId) {
    return res.status(403).json({
      success: false,
      message: "Business context is required",
    });
  }

  req.tenantId = req.user.businessId;

  next();
}

module.exports = {
  requireTenant,
};