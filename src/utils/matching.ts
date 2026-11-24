import { calculateHaversineDistanceKm } from '../data/locations';
import {
  AdminSettings,
  Booking,
  DayOfWeek,
  PriorityAssignmentRecord,
  RatingReview,
  ServiceCategory,
  WorkerProfile,
} from '../types/koolie';

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getWorkerActiveJobsCount(workerId: string, bookings: Booking[]): number {
  return bookings.filter(
    (b) =>
      b.workerId === workerId &&
      ['pending', 'accepted', 'awaiting_commission', 'confirmed', 'in_progress'].includes(b.status)
  ).length;
}

export function computeWorkerRatingStats(
  worker: WorkerProfile,
  ratings: RatingReview[]
): {
  publicAverageRating: number;
  genuineAverageRating: number;
  ratingCount: number;
} {
  const workerReviews = ratings.filter((r) => r.workerId === worker.id);
  const ratingCount = workerReviews.length;
  const genuineAverageRating =
    ratingCount > 0
      ? Number((workerReviews.reduce((acc, r) => acc + r.stars, 0) / ratingCount).toFixed(1))
      : 4.0;

  const penalized = genuineAverageRating - worker.noShowPenaltyPoints;
  const publicAverageRating = Number(Math.max(1.0, Math.min(5.0, penalized)).toFixed(1));

  return {
    publicAverageRating,
    genuineAverageRating,
    ratingCount,
  };
}

export function isSubscriptionCurrentlyActive(worker: WorkerProfile, nowMs = Date.now()): boolean {
  if (worker.subscription.status !== 'active' || !worker.subscription.expiryDate) {
    return false;
  }
  return new Date(worker.subscription.expiryDate).getTime() > nowMs;
}

export function getWorkerPriorityQualification(
  worker: WorkerProfile,
  ratings: RatingReview[],
  adminSettings: AdminSettings,
  nowMs = Date.now()
): {
  inPriorityPool: boolean;
  viaSubscription: boolean;
  viaRating: boolean;
  poolLabel: 'Priority Subscriber & Top Rated' | 'Priority Subscriber' | 'Top Rated (4.5+)' | 'Standard';
} {
  const viaSubscription = isSubscriptionCurrentlyActive(worker, nowMs);
  const { publicAverageRating } = computeWorkerRatingStats(worker, ratings);
  const viaRating = publicAverageRating >= adminSettings.priorityRatingThreshold;

  let poolLabel:
    | 'Priority Subscriber & Top Rated'
    | 'Priority Subscriber'
    | 'Top Rated (4.5+)'
    | 'Standard' = 'Standard';

  if (viaSubscription && viaRating) {
    poolLabel = 'Priority Subscriber & Top Rated';
  } else if (viaSubscription) {
    poolLabel = 'Priority Subscriber';
  } else if (viaRating) {
    poolLabel = 'Top Rated (4.5+)';
  }

  return {
    inPriorityPool: viaSubscription || viaRating,
    viaSubscription,
    viaRating,
    poolLabel,
  };
}

const JS_DAY_TO_DOW: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isWithinWorkingSchedule(
  worker: WorkerProfile,
  scheduledDate: string,
  scheduledTime: string
): { valid: boolean; reason?: string } {
  if (!scheduledDate || !scheduledTime) {
    return { valid: true };
  }

  const parsed = new Date(`${scheduledDate}T${scheduledTime}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: true };
  }

  const dow = JS_DAY_TO_DOW[parsed.getDay()];
  if (!worker.workingDays.includes(dow)) {
    return { valid: false, reason: `Does not work on ${dow}` };
  }

  const [reqH, reqM] = scheduledTime.split(':').map(Number);
  const [startH, startM] = worker.workingHours.start.split(':').map(Number);
  const [endH, endM] = worker.workingHours.end.split(':').map(Number);

  const reqMins = reqH * 60 + reqM;
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  if (reqMins < startMins || reqMins > endMins) {
    return {
      valid: false,
      reason: `Outside working hours (${worker.workingHours.start}–${worker.workingHours.end})`,
    };
  }

  return { valid: true };
}

export interface WorkerEligibilityResult {
  worker: WorkerProfile;
  eligible: boolean;
  reasons: string[];
  distanceKm: number;
  activeJobsCount: number;
  publicAverageRating: number;
  ratingCount: number;
  inPriorityPool: boolean;
  viaSubscription: boolean;
  viaRating: boolean;
  poolLabel: string;
}

export function evaluateWorkerEligibility(params: {
  worker: WorkerProfile;
  category: ServiceCategory;
  targetLat: number;
  targetLng: number;
  searchRadiusKm: number;
  scheduledDate: string;
  scheduledTime: string;
  bookings: Booking[];
  ratings: RatingReview[];
  adminSettings: AdminSettings;
  excludedWorkerIds?: string[];
  nowMs?: number;
}): WorkerEligibilityResult {
  const {
    worker,
    category,
    targetLat,
    targetLng,
    searchRadiusKm,
    scheduledDate,
    scheduledTime,
    bookings,
    ratings,
    adminSettings,
    excludedWorkerIds = [],
    nowMs = Date.now(),
  } = params;

  const reasons: string[] = [];
  const distanceKm = calculateHaversineDistanceKm(targetLat, targetLng, worker.lat, worker.lng);
  const activeJobsCount = getWorkerActiveJobsCount(worker.id, bookings);
  const { publicAverageRating, ratingCount } = computeWorkerRatingStats(worker, ratings);
  const priorityInfo = getWorkerPriorityQualification(worker, ratings, adminSettings, nowMs);

  if (excludedWorkerIds.includes(worker.id)) {
    reasons.push('Already attempted for this booking');
  }
  if (!worker.categories.includes(category)) {
    reasons.push(`Does not offer ${category}`);
  }
  if (distanceKm > searchRadiusKm) {
    reasons.push(`Beyond your ${searchRadiusKm} km search radius (${distanceKm} km)`);
  }
  if (distanceKm > worker.maxWorkingRadiusKm) {
    reasons.push(`Outside worker's ${worker.maxWorkingRadiusKm} km service radius (${distanceKm} km)`);
  }
  if (worker.availabilityStatus !== 'open') {
    reasons.push('Availability is Closed');
  }
  if (worker.temporaryUnavailable) {
    reasons.push('Temporarily unavailable');
  }
  const scheduleCheck = isWithinWorkingSchedule(worker, scheduledDate, scheduledTime);
  if (!scheduleCheck.valid && scheduleCheck.reason) {
    reasons.push(scheduleCheck.reason);
  }
  if (activeJobsCount >= worker.maxConcurrentJobs) {
    reasons.push(`At capacity (${activeJobsCount}/${worker.maxConcurrentJobs} active jobs)`);
  }

  return {
    worker,
    eligible: reasons.length === 0,
    reasons,
    distanceKm,
    activeJobsCount,
    publicAverageRating,
    ratingCount,
    inPriorityPool: priorityInfo.inPriorityPool,
    viaSubscription: priorityInfo.viaSubscription,
    viaRating: priorityInfo.viaRating,
    poolLabel: priorityInfo.poolLabel,
  };
}

function weightedRandomPick<T>(items: { item: T; weight: number }[]): T {
  const totalWeight = items.reduce((sum, entry) => sum + Math.max(0.01, entry.weight), 0);
  let r = Math.random() * totalWeight;
  for (const entry of items) {
    r -= Math.max(0.01, entry.weight);
    if (r <= 0) {
      return entry.item;
    }
  }
  return items[items.length - 1].item;
}

export interface AutoMatchResult {
  selected: WorkerEligibilityResult | null;
  poolType: PriorityAssignmentRecord['poolType'] | null;
  reason: string;
  candidateCount: number;
}

/**
 * Priority Circulation System:
 * 1. Combined Priority Pool (active subscription OR public rating >= threshold).
 * 2. Fair rotation favoring eligible workers with fewer recent auto-assignments and older lastSelectedAt.
 * 3. Fallback matching among remaining basic-eligible workers if Priority Pool has none.
 */
export function selectBestWorkerWithPriorityCirculation(params: {
  workers: WorkerProfile[];
  category: ServiceCategory;
  targetLat: number;
  targetLng: number;
  searchRadiusKm: number;
  scheduledDate: string;
  scheduledTime: string;
  bookings: Booking[];
  ratings: RatingReview[];
  adminSettings: AdminSettings;
  excludedWorkerIds?: string[];
  nowMs?: number;
}): AutoMatchResult {
  const nowMs = params.nowMs ?? Date.now();
  const evaluations = params.workers.map((worker) =>
    evaluateWorkerEligibility({
      worker,
      category: params.category,
      targetLat: params.targetLat,
      targetLng: params.targetLng,
      searchRadiusKm: params.searchRadiusKm,
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
      bookings: params.bookings,
      ratings: params.ratings,
      adminSettings: params.adminSettings,
      excludedWorkerIds: params.excludedWorkerIds,
      nowMs,
    })
  );

  const allEligible = evaluations.filter((e) => e.eligible);
  if (allEligible.length === 0) {
    return {
      selected: null,
      poolType: null,
      reason: 'No eligible workers match the category, distance, schedule, and capacity criteria.',
      candidateCount: 0,
    };
  }

  const priorityCandidates = allEligible.filter((e) => e.inPriorityPool);

  if (priorityCandidates.length > 0) {
    // Fair rotation: find minimum recentAutoAssignments among eligible priority workers
    const minRecent = Math.min(...priorityCandidates.map((c) => c.worker.recentAutoAssignments));
    // Fair tier: candidates within +0 (or +1 if tie-breaking needed) of minRecent
    const fairTier = priorityCandidates.filter(
      (c) => c.worker.recentAutoAssignments <= minRecent
    );

    const weightedCandidates = fairTier.map((c) => {
      const lastSelectedMs = c.worker.lastSelectedAt
        ? new Date(c.worker.lastSelectedAt).getTime()
        : 0;
      const hoursSinceLast = lastSelectedMs === 0 ? 720 : Math.max(1, (nowMs - lastSelectedMs) / 3600000);
      const recencyFactor = Math.min(4, 1 + Math.log10(hoursSinceLast));
      const scoreFactor = Math.max(0.2, c.worker.internalPriorityScore / 100);
      const distanceFactor = Math.max(0.5, 1.5 - c.distanceKm / 30);
      const weight = scoreFactor * recencyFactor * distanceFactor;
      return { item: c, weight };
    });

    const chosen = weightedRandomPick(weightedCandidates);
    const poolType: PriorityAssignmentRecord['poolType'] =
      chosen.viaSubscription && chosen.viaRating
        ? 'priority_both'
        : chosen.viaSubscription
        ? 'priority_subscription'
        : 'priority_rating';

    const routeDesc =
      poolType === 'priority_both'
        ? 'Active Priority Subscription & High Rating'
        : poolType === 'priority_subscription'
        ? 'Active Priority Subscription'
        : `High Rating (${chosen.publicAverageRating} >= ${params.adminSettings.priorityRatingThreshold})`;

    return {
      selected: chosen,
      poolType,
      reason: `Selected from Combined Priority Pool via ${routeDesc}; fair rotation (${chosen.worker.recentAutoAssignments} recent auto-assignments, ${chosen.distanceKm} km away, Priority Score ${chosen.worker.internalPriorityScore}%).`,
      candidateCount: priorityCandidates.length,
    };
  }

  // Fallback matching: remaining eligible standard workers
  const minRecentFallback = Math.min(...allEligible.map((c) => c.worker.recentAutoAssignments));
  const fallbackFairTier = allEligible.filter(
    (c) => c.worker.recentAutoAssignments <= minRecentFallback + 1
  );

  const weightedFallback = fallbackFairTier.map((c) => {
    const ratingFactor = c.publicAverageRating / 5;
    const distanceFactor = Math.max(0.4, 1.5 - c.distanceKm / 25);
    const capacityRatio =
      (c.worker.maxConcurrentJobs - c.activeJobsCount) / Math.max(1, c.worker.maxConcurrentJobs);
    const assignmentFairness = 1 / (1 + c.worker.recentAutoAssignments);
    const scoreFactor = Math.max(0.2, c.worker.internalPriorityScore / 100);
    const weight =
      ratingFactor * 0.3 +
      distanceFactor * 0.25 +
      capacityRatio * 0.2 +
      assignmentFairness * 0.15 +
      scoreFactor * 0.1;
    return { item: c, weight };
  });

  const chosenFallback = weightedRandomPick(weightedFallback);

  return {
    selected: chosenFallback,
    poolType: 'fallback_standard',
    reason: `Selected via Fallback Matching (no Priority Pool candidates eligible); ranked by rating (${chosenFallback.publicAverageRating}), distance (${chosenFallback.distanceKm} km), capacity, and fair assignment count (${chosenFallback.worker.recentAutoAssignments}).`,
    candidateCount: allEligible.length,
  };
}

export function detectPhoneNumbers(text: string): boolean {
  // Detect 10-digit Indian phone numbers or sequences of 7+ digits with optional separators
  const cleaned = text.replace(/[\s\-().+]/g, '');
  if (/\d{8,}/.test(cleaned)) {
    return true;
  }
  const indianPattern = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;
  return indianPattern.test(text);
}

export function maskPhoneNumbers(text: string): string {
  // Mask 8+ consecutive digits (allowing spaces/hyphens inside)
  return text.replace(/(?:\+?\d[\d\s\-()]{6,}\d)/g, '[number hidden]');
}

export function isRatingWindowActive(completedAt: string | null, nowMs = Date.now()): boolean {
  if (!completedAt) return false;
  return nowMs - new Date(completedAt).getTime() <= SEVEN_DAYS_MS;
}

export function isMessageRetentionExpired(completedAt: string | null, nowMs = Date.now()): boolean {
  if (!completedAt) return false;
  return nowMs - new Date(completedAt).getTime() > SEVEN_DAYS_MS;
}

export function isScheduledArrivalPassed(
  scheduledDate: string,
  scheduledTime: string,
  nowMs = Date.now()
): boolean {
  if (!scheduledDate || !scheduledTime) return false;
  const scheduledMs = new Date(`${scheduledDate}T${scheduledTime}:00`).getTime();
  if (Number.isNaN(scheduledMs)) return false;
  return nowMs > scheduledMs;
}
