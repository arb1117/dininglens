// PROTOTYPE: In-memory storage only. Production should use DB persistence (Supabase/Postgres).
// Daily coach usage resets by calendar date (server local time).

const TRIAL_DAYS              = Number(process.env.TRIAL_DAYS               ?? 14);
const TRIAL_COACH_DAILY_LIMIT = Number(process.env.TRIAL_COACH_DAILY_LIMIT  ?? 3);
const PAID_COACH_DAILY_LIMIT  = Number(process.env.PAID_COACH_DAILY_LIMIT   ?? 20);

const store = new Map();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function freshRecord(actorId) {
  const now = Date.now();
  const trialEndsAt = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return {
    actorId,
    status: 'trialing',
    trialStartedAt: new Date(now).toISOString(),
    trialEndsAt:    new Date(trialEndsAt).toISOString(),
    paid: false,
    coachUsageDate:  todayStr(),
    coachUsageCount: 0,
  };
}

function getOrCreateEntitlement(actorId) {
  if (!store.has(actorId)) {
    store.set(actorId, freshRecord(actorId));
  }
  const rec = store.get(actorId);
  if (rec.coachUsageDate !== todayStr()) {
    rec.coachUsageDate  = todayStr();
    rec.coachUsageCount = 0;
  }
  return rec;
}

function getEntitlement(actorId) {
  return store.get(actorId) ?? null;
}

function canUseApp(actorId) {
  const rec = getOrCreateEntitlement(actorId);
  if (rec.paid) return true;
  return rec.status === 'trialing' && new Date(rec.trialEndsAt) > new Date();
}

function canUseCoach(actorId) {
  if (!canUseApp(actorId)) return false;
  const rec  = getOrCreateEntitlement(actorId);
  const limit = rec.paid ? PAID_COACH_DAILY_LIMIT : TRIAL_COACH_DAILY_LIMIT;
  return rec.coachUsageCount < limit;
}

function incrementCoachUsage(actorId) {
  getOrCreateEntitlement(actorId);
  store.get(actorId).coachUsageCount += 1;
}

function getUsageSnapshot(actorId) {
  const rec   = getOrCreateEntitlement(actorId);
  const limit = rec.paid ? PAID_COACH_DAILY_LIMIT : TRIAL_COACH_DAILY_LIMIT;
  const resetAt = new Date(rec.coachUsageDate);
  resetAt.setDate(resetAt.getDate() + 1);
  return {
    coachMessagesUsed:      rec.coachUsageCount,
    coachMessagesLimit:     limit,
    coachMessagesRemaining: Math.max(0, limit - rec.coachUsageCount),
    coachMessagesResetAt:   resetAt.toISOString(),
  };
}

module.exports = {
  getOrCreateEntitlement,
  getEntitlement,
  canUseApp,
  canUseCoach,
  incrementCoachUsage,
  getUsageSnapshot,
};
