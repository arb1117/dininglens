const { canUseApp } = require('../services/entitlementService');

module.exports = function requireActiveEntitlement(req, res, next) {
  if (!canUseApp(req.actor.id)) {
    return res.status(403).json({
      error: 'trial_expired',
      message: 'Your free trial has ended.',
      upgradeRequired: true,
    });
  }
  next();
};
