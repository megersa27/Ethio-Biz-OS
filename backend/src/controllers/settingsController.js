
const {
  getSettingsProfile,
  updateSettingsProfile,
} = require("../services/settingsService");

async function getProfile(req, res, next) {
  try {
    const profile = await getSettingsProfile(req.user.id, req.tenantId);
    return res.status(200).json({
      success: true,
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const profile = await updateSettingsProfile({
      userId: req.user.id,
      tenantId: req.tenantId,
      role: req.user.role,
      input: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getProfile, updateProfile };
