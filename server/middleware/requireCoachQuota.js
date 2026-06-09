const { canUseCoach, incrementCoachUsage, getUsageSnapshot } = require('../services/entitlementService');

// Usage is counted before the AI call to prevent retry abuse — a request that
// passes entitlement and quota validation is charged even if the AI provider
// subsequently errors. This is intentional.
module.exports = function requireCoachQuota(req, res, next) {
  if (!canUseCoach(req.actor.id)) {
    const snap = getUsageSnapshot(req.actor.id);
    return res.status(429).json({
      error: 'coach_limit_reached',
      message: "You've used today's coach messages.",
      remaining: 0,
      resetAt: snap.coachMessagesResetAt,
    });
  }
  incrementCoachUsage(req.actor.id);
  next();
};
