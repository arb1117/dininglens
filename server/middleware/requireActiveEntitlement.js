const { canUseApp } = require('../services/entitlementService');

module.exports = function requireActiveEntitlement(req, res, next) {
  if (req.actor.type === 'anonymous') {
    return res.status(401).json({
      error: 'identity_required',
      message: 'A stable install ID is required.',
    });
  }
  if (!canUseApp(req.actor.id)) {
    return res.status(403).json({
      error: 'trial_expired',
      message: 'Your free trial has ended.',
      upgradeRequired: true,
    });
  }
  next();
};
