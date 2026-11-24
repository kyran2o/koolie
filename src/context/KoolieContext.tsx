import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createInitialSeedState } from '../data/seedData';
import {
  AccountId,
  AdminSettings,
  AppNotification,
  BookerProfile,
  Booking,
  BookingMethod,
  KoolieState,
  PriorityAssignmentRecord,
  ServiceCategory,
  ThemeMode,
  Transaction,
  WorkerProfile,
} from '../types/koolie';
import {
  evaluateWorkerEligibility,
  isMessageRetentionExpired,
  isRatingWindowActive,
  isScheduledArrivalPassed,
  maskPhoneNumbers,
  detectPhoneNumbers,
  selectBestWorkerWithPriorityCirculation,
} from '../utils/matching';
import { getLocationByName } from '../data/locations';

const STORAGE_KEY = 'koolie_marketplace_state_v1';

interface CreateBookingInput {
  category: ServiceCategory;
  locationName: string;
  addressNote: string;
  searchRadiusKm: 5 | 10 | 15 | 20;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDurationHours: number;
  description: string;
  additionalDetails: string;
  method: BookingMethod;
  manualWorkerId?: string;
}

interface ActionResult {
  ok: boolean;
  message: string;
  bookingId?: string;
}

interface KoolieContextValue {
  state: KoolieState;
  nowMs: number;
  switchAccount: (accountId: AccountId) => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  createBooking: (input: CreateBookingInput) => ActionResult;
  reassignBookingAuto: (bookingId: string) => ActionResult;
  reassignBookingManual: (bookingId: string, workerId: string) => ActionResult;
  acceptBookingRequest: (bookingId: string) => ActionResult;
  rejectBookingRequest: (bookingId: string) => ActionResult;
  processCommissionPayment: (bookingId: string, simulateSuccess: boolean) => ActionResult;
  processPhoneUnlockPayment: (bookingId: string, simulateSuccess: boolean) => ActionResult;
  startWork: (bookingId: string) => ActionResult;
  completeWork: (bookingId: string) => ActionResult;
  confirmBookerCompletion: (bookingId: string) => ActionResult;
  cancelBooking: (bookingId: string) => ActionResult;
  reportWorkerNoShow: (bookingId: string, notes: string) => ActionResult;
  submitRating: (
    bookingId: string,
    stars: number,
    review: string,
    feedbackTags: string[]
  ) => ActionResult;
  sendMessage: (bookingId: string, text: string) => ActionResult;
  markConversationRead: (bookingId: string, viewerAccountId: AccountId) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (accountId: AccountId) => void;
  updateWorkerProfile: (workerId: string, updates: Partial<WorkerProfile>) => ActionResult;
  updateBookerProfile: (updates: Partial<BookerProfile>) => ActionResult;
  purchasePrioritySubscription: (workerId: string, simulateSuccess: boolean) => ActionResult;
  expireWorkerSubscriptionNow: (workerId: string) => ActionResult;
  updateAdminSettings: (settings: AdminSettings) => ActionResult;
  resetDemoData: () => void;
}

const KoolieContext = createContext<KoolieContextValue | null>(null);

function loadPersistedState(): KoolieState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialSeedState();
    }
    const parsed = JSON.parse(raw) as KoolieState;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.booker ||
      !Array.isArray(parsed.workers) ||
      parsed.workers.length === 0 ||
      !Array.isArray(parsed.bookings) ||
      !parsed.adminSettings
    ) {
      return createInitialSeedState();
    }
    return parsed;
  } catch {
    return createInitialSeedState();
  }
}

function makeId(prefix: string): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export function KoolieProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KoolieState>(() => loadPersistedState());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Persist to localStorage & sync document dark class
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors gracefully
    }
    const root = document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state]);

  // 1-second timer for live countdowns, request expirations, subscription expirations, and 7-day chat retention purging
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      setState((prev) => {
        let changed = false;
        const newNotifications: AppNotification[] = [];

        // 1. Check pending request timeouts
        const updatedBookings = prev.bookings.map((b) => {
          if (
            b.status === 'pending' &&
            b.requestExpiresAt &&
            new Date(b.requestExpiresAt).getTime() <= currentNow
          ) {
            changed = true;
            const attempted =
              b.workerId && !b.attemptedWorkerIds.includes(b.workerId)
                ? [...b.attemptedWorkerIds, b.workerId]
                : b.attemptedWorkerIds;

            newNotifications.push({
              id: makeId('NTF'),
              recipientAccountId: prev.booker.accountId,
              type: 'request_expired',
              title: 'Worker Request Expired',
              message: `${b.workerName || 'Selected worker'} did not respond in time for ${b.category} (${b.id}). You can auto-find or select another worker.`,
              bookingId: b.id,
              read: false,
              createdAt: new Date(currentNow).toISOString(),
            });

            if (b.workerId) {
              const targetWorker = prev.workers.find((w) => w.id === b.workerId);
              if (targetWorker) {
                newNotifications.push({
                  id: makeId('NTF'),
                  recipientAccountId: targetWorker.accountId,
                  type: 'request_expired',
                  title: 'Incoming Request Expired',
                  message: `Response window elapsed for ${b.category} request (${b.id}) from ${b.bookerName}.`,
                  bookingId: b.id,
                  read: false,
                  createdAt: new Date(currentNow).toISOString(),
                });
              }
            }

            return {
              ...b,
              status: 'expired' as const,
              updatedAt: new Date(currentNow).toISOString(),
              attemptedWorkerIds: attempted,
            };
          }
          return b;
        });

        // 2. Check active subscription expirations
        const updatedWorkers = prev.workers.map((w) => {
          if (
            w.subscription.status === 'active' &&
            w.subscription.expiryDate &&
            new Date(w.subscription.expiryDate).getTime() <= currentNow
          ) {
            changed = true;
            newNotifications.push({
              id: makeId('NTF'),
              recipientAccountId: w.accountId,
              type: 'subscription_expired',
              title: 'Priority Subscription Expired',
              message:
                'Your monthly Priority Plan has expired. Renew your plan to regain subscription-based Priority Pool eligibility.',
              read: false,
              createdAt: new Date(currentNow).toISOString(),
            });
            return {
              ...w,
              subscription: {
                ...w.subscription,
                status: 'expired' as const,
                history: w.subscription.history.map((h) =>
                  h.status === 'active' ? { ...h, status: 'expired' as const } : h
                ),
              },
            };
          }
          return w;
        });

        // 3. Check 7-day message retention expiration on completed bookings
        let updatedConversations = prev.conversations;
        for (const b of updatedBookings) {
          if (b.status === 'completed' && isMessageRetentionExpired(b.completedAt, currentNow)) {
            const conv = updatedConversations[b.id];
            if (conv && (!conv.expiredPurged || conv.messages.length > 0)) {
              changed = true;
              updatedConversations = {
                ...updatedConversations,
                [b.id]: {
                  bookingId: b.id,
                  messages: [],
                  expiredPurged: true,
                },
              };
            }
          }
        }

        if (!changed) return prev;

        return {
          ...prev,
          bookings: updatedBookings,
          workers: updatedWorkers,
          conversations: updatedConversations,
          notifications: [...newNotifications, ...prev.notifications],
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const switchAccount = useCallback((accountId: AccountId) => {
    setState((prev) => ({ ...prev, activeAccountId: accountId }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState((prev) => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setState((prev) => ({ ...prev, theme }));
  }, []);

  const createBooking = useCallback(
    (input: CreateBookingInput): ActionResult => {
      if (!input.description.trim()) {
        return { ok: false, message: 'Please enter a job description.' };
      }
      if (!input.scheduledDate || !input.scheduledTime) {
        return { ok: false, message: 'Please choose a date and time.' };
      }

      const loc = getLocationByName(input.locationName);
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const bookingId = `BK-${Math.floor(1000 + Math.random() * 9000)}`;

      let selectedWorker: WorkerProfile | null = null;
      let distanceKm: number | null = null;
      let assignmentSource: Booking['assignmentSource'] = 'manual';
      let assignmentRecord: PriorityAssignmentRecord | null = null;

      if (input.method === 'manual') {
        const candidate = state.workers.find((w) => w.id === input.manualWorkerId);
        if (!candidate) {
          return { ok: false, message: 'Please select an eligible worker.' };
        }
        const evalRes = evaluateWorkerEligibility({
          worker: candidate,
          category: input.category,
          targetLat: loc.lat,
          targetLng: loc.lng,
          searchRadiusKm: input.searchRadiusKm,
          scheduledDate: input.scheduledDate,
          scheduledTime: input.scheduledTime,
          bookings: state.bookings,
          ratings: state.ratings,
          adminSettings: state.adminSettings,
          nowMs: now,
        });
        if (!evalRes.eligible) {
          return {
            ok: false,
            message: `${candidate.fullName} is currently ineligible: ${evalRes.reasons.join(', ')}.`,
          };
        }
        selectedWorker = candidate;
        distanceKm = evalRes.distanceKm;
        assignmentSource = 'manual';
      } else {
        const autoRes = selectBestWorkerWithPriorityCirculation({
          workers: state.workers,
          category: input.category,
          targetLat: loc.lat,
          targetLng: loc.lng,
          searchRadiusKm: input.searchRadiusKm,
          scheduledDate: input.scheduledDate,
          scheduledTime: input.scheduledTime,
          bookings: state.bookings,
          ratings: state.ratings,
          adminSettings: state.adminSettings,
          nowMs: now,
        });
        if (!autoRes.selected || !autoRes.poolType) {
          return { ok: false, message: autoRes.reason };
        }
        selectedWorker = autoRes.selected.worker;
        distanceKm = autoRes.selected.distanceKm;
        assignmentSource = autoRes.poolType;
        assignmentRecord = {
          id: makeId('PA'),
          bookingId,
          category: input.category,
          locationName: loc.name,
          selectedWorkerId: selectedWorker.id,
          selectedWorkerName: selectedWorker.fullName,
          poolType: autoRes.poolType,
          reason: autoRes.reason,
          candidateCount: autoRes.candidateCount,
          workerScoreSnapshot: selectedWorker.internalPriorityScore,
          recentAssignmentsBefore: selectedWorker.recentAutoAssignments,
          createdAt: nowIso,
        };
      }

      const timeoutMs = selectedWorker.responseTimeoutMinutes * 60 * 1000;
      const expiresAt = new Date(now + timeoutMs).toISOString();

      const newBooking: Booking = {
        id: bookingId,
        bookerId: state.booker.id,
        bookerName: state.booker.fullName,
        workerId: selectedWorker.id,
        workerName: selectedWorker.fullName,
        category: input.category,
        locationName: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        addressNote: input.addressNote.trim() || `${loc.name}, Kerala`,
        searchRadiusKm: input.searchRadiusKm,
        distanceKm,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        estimatedDurationHours: input.estimatedDurationHours,
        description: input.description.trim(),
        additionalDetails: input.additionalDetails.trim(),
        serviceChargeSnapshot: selectedWorker.serviceCharge,
        commissionAmount: state.adminSettings.platformCommission,
        bookingMethod: input.method,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        requestSentAt: nowIso,
        requestExpiresAt: expiresAt,
        acceptedAt: null,
        confirmedAt: null,
        startedAt: null,
        completedAt: null,
        bookerConfirmedCompletion: false,
        commissionPaid: false,
        phoneNumbersUnlocked: false,
        attemptedWorkerIds: [],
        rated: false,
        noShowReported: false,
        assignmentSource,
      };

      const workerNotif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: selectedWorker.accountId,
        type: 'booking_request',
        title: 'New Booking Request',
        message: `${state.booker.fullName} requested ${input.category} in ${loc.name} (${distanceKm} km away). Respond within ${selectedWorker.responseTimeoutMinutes} min.`,
        bookingId,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        bookings: [newBooking, ...prev.bookings],
        workers:
          input.method === 'auto' && selectedWorker
            ? prev.workers.map((w) =>
                w.id === selectedWorker!.id
                  ? {
                      ...w,
                      recentAutoAssignments: w.recentAutoAssignments + 1,
                      totalAutoAssignments: w.totalAutoAssignments + 1,
                      lastSelectedAt: nowIso,
                    }
                  : w
              )
            : prev.workers,
        priorityAssignmentHistory: assignmentRecord
          ? [assignmentRecord, ...prev.priorityAssignmentHistory]
          : prev.priorityAssignmentHistory,
        notifications: [workerNotif, ...prev.notifications],
      }));

      return {
        ok: true,
        bookingId,
        message: `Booking request ${bookingId} sent exclusively to ${selectedWorker.fullName} (${distanceKm} km away).`,
      };
    },
    [state.adminSettings, state.booker, state.bookings, state.ratings, state.workers]
  );

  const reassignBookingAuto = useCallback(
    (bookingId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (!['rejected', 'expired', 'no_show_reported'].includes(booking.status)) {
        return {
          ok: false,
          message: 'Can only reassign after the previous request was rejected, expired, or reported as a no-show.',
        };
      }

      const excluded =
        booking.workerId && !booking.attemptedWorkerIds.includes(booking.workerId)
          ? [...booking.attemptedWorkerIds, booking.workerId]
          : booking.attemptedWorkerIds;

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const autoRes = selectBestWorkerWithPriorityCirculation({
        workers: state.workers,
        category: booking.category,
        targetLat: booking.lat,
        targetLng: booking.lng,
        searchRadiusKm: booking.searchRadiusKm,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        bookings: state.bookings,
        ratings: state.ratings,
        adminSettings: state.adminSettings,
        excludedWorkerIds: excluded,
        nowMs: now,
      });

      if (!autoRes.selected || !autoRes.poolType) {
        return { ok: false, message: autoRes.reason };
      }

      const nextWorker = autoRes.selected.worker;
      const expiresAt = new Date(now + nextWorker.responseTimeoutMinutes * 60 * 1000).toISOString();

      const assignmentRecord: PriorityAssignmentRecord = {
        id: makeId('PA'),
        bookingId: booking.id,
        category: booking.category,
        locationName: booking.locationName,
        selectedWorkerId: nextWorker.id,
        selectedWorkerName: nextWorker.fullName,
        poolType: autoRes.poolType,
        reason: `Reassigned automatically: ${autoRes.reason}`,
        candidateCount: autoRes.candidateCount,
        workerScoreSnapshot: nextWorker.internalPriorityScore,
        recentAssignmentsBefore: nextWorker.recentAutoAssignments,
        createdAt: nowIso,
      };

      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: nextWorker.accountId,
        type: 'booking_request',
        title: 'New Booking Request',
        message: `${booking.bookerName} requested ${booking.category} in ${booking.locationName} (${autoRes.selected.distanceKm} km away).`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                workerId: nextWorker.id,
                workerName: nextWorker.fullName,
                distanceKm: autoRes.selected!.distanceKm,
                serviceChargeSnapshot: nextWorker.serviceCharge,
                bookingMethod: 'auto',
                status: 'pending',
                updatedAt: nowIso,
                requestSentAt: nowIso,
                requestExpiresAt: expiresAt,
                acceptedAt: null,
                confirmedAt: null,
                commissionPaid: false,
                noShowReported: false,
                attemptedWorkerIds: excluded,
                assignmentSource: autoRes.poolType!,
              }
            : b
        ),
        workers: prev.workers.map((w) =>
          w.id === nextWorker.id
            ? {
                ...w,
                recentAutoAssignments: w.recentAutoAssignments + 1,
                totalAutoAssignments: w.totalAutoAssignments + 1,
                lastSelectedAt: nowIso,
              }
            : w
        ),
        priorityAssignmentHistory: [assignmentRecord, ...prev.priorityAssignmentHistory],
        notifications: [notif, ...prev.notifications],
      }));

      return {
        ok: true,
        message: `Request automatically circulated to ${nextWorker.fullName}.`,
      };
    },
    [state.adminSettings, state.bookings, state.ratings, state.workers]
  );

  const reassignBookingManual = useCallback(
    (bookingId: string, workerId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (!['rejected', 'expired', 'no_show_reported'].includes(booking.status)) {
        return {
          ok: false,
          message: 'Can only select another worker after rejection, expiration, or no-show.',
        };
      }

      const excluded =
        booking.workerId && !booking.attemptedWorkerIds.includes(booking.workerId)
          ? [...booking.attemptedWorkerIds, booking.workerId]
          : booking.attemptedWorkerIds;

      const candidate = state.workers.find((w) => w.id === workerId);
      if (!candidate) return { ok: false, message: 'Selected worker not found.' };

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const evalRes = evaluateWorkerEligibility({
        worker: candidate,
        category: booking.category,
        targetLat: booking.lat,
        targetLng: booking.lng,
        searchRadiusKm: booking.searchRadiusKm,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        bookings: state.bookings,
        ratings: state.ratings,
        adminSettings: state.adminSettings,
        excludedWorkerIds: excluded,
        nowMs: now,
      });

      if (!evalRes.eligible) {
        return {
          ok: false,
          message: `${candidate.fullName} is ineligible: ${evalRes.reasons.join(', ')}.`,
        };
      }

      const expiresAt = new Date(now + candidate.responseTimeoutMinutes * 60 * 1000).toISOString();
      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: candidate.accountId,
        type: 'booking_request',
        title: 'New Booking Request',
        message: `${booking.bookerName} requested ${booking.category} in ${booking.locationName} (${evalRes.distanceKm} km away).`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                workerId: candidate.id,
                workerName: candidate.fullName,
                distanceKm: evalRes.distanceKm,
                serviceChargeSnapshot: candidate.serviceCharge,
                bookingMethod: 'manual',
                status: 'pending',
                updatedAt: nowIso,
                requestSentAt: nowIso,
                requestExpiresAt: expiresAt,
                acceptedAt: null,
                confirmedAt: null,
                commissionPaid: false,
                noShowReported: false,
                attemptedWorkerIds: excluded,
                assignmentSource: 'manual',
              }
            : b
        ),
        notifications: [notif, ...prev.notifications],
      }));

      return { ok: true, message: `Booking request sent to ${candidate.fullName}.` };
    },
    [state.adminSettings, state.bookings, state.ratings, state.workers]
  );

  const acceptBookingRequest = useCallback(
    (bookingId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.status !== 'pending') {
        return { ok: false, message: 'This request is no longer pending.' };
      }
      const now = Date.now();
      if (booking.requestExpiresAt && new Date(booking.requestExpiresAt).getTime() <= now) {
        return { ok: false, message: 'Response time has expired for this request.' };
      }
      const worker = state.workers.find((w) => w.id === booking.workerId);
      if (!worker) return { ok: false, message: 'Worker record missing.' };

      const nowIso = new Date(now).toISOString();
      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: state.booker.accountId,
        type: 'booking_accepted',
        title: 'Booking Accepted — Pay Platform Commission',
        message: `${worker.fullName} accepted ${booking.category} (${booking.id}). Pay ₹${booking.commissionAmount} platform commission to confirm and unlock chat.`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: 'awaiting_commission',
                acceptedAt: nowIso,
                updatedAt: nowIso,
                requestExpiresAt: null,
              }
            : b
        ),
        notifications: [notif, ...prev.notifications],
      }));

      return {
        ok: true,
        message: `Accepted ${booking.id}. Waiting for booker to pay ₹${booking.commissionAmount} commission.`,
      };
    },
    [state.booker.accountId, state.bookings, state.workers]
  );

  const rejectBookingRequest = useCallback(
    (bookingId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.status !== 'pending') {
        return { ok: false, message: 'Only pending requests can be rejected.' };
      }

      const nowIso = new Date().toISOString();
      const excluded =
        booking.workerId && !booking.attemptedWorkerIds.includes(booking.workerId)
          ? [...booking.attemptedWorkerIds, booking.workerId]
          : booking.attemptedWorkerIds;

      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: state.booker.accountId,
        type: 'booking_rejected',
        title: 'Booking Request Rejected',
        message: `${booking.workerName || 'The worker'} rejected ${booking.category} (${booking.id}). You can automatically find or manually select another worker.`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: 'rejected',
                updatedAt: nowIso,
                requestExpiresAt: null,
                attemptedWorkerIds: excluded,
              }
            : b
        ),
        notifications: [notif, ...prev.notifications],
      }));

      return { ok: true, message: `Request ${booking.id} rejected.` };
    },
    [state.booker.accountId, state.bookings]
  );

  const processCommissionPayment = useCallback(
    (bookingId: string, simulateSuccess: boolean): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.commissionPaid) {
        return { ok: false, message: 'Commission has already been paid.' };
      }
      if (booking.status !== 'awaiting_commission' && booking.status !== 'accepted') {
        return { ok: false, message: 'Booking must be accepted by the worker first.' };
      }

      const nowIso = new Date().toISOString();
      const txn: Transaction = {
        id: makeId('TXN'),
        type: 'commission',
        amount: booking.commissionAmount,
        status: simulateSuccess ? 'success' : 'failed',
        payerAccountId: state.booker.accountId,
        payerName: state.booker.fullName,
        bookingId: booking.id,
        description: `Platform commission for ${booking.id} (${booking.category})`,
        createdAt: nowIso,
      };

      if (!simulateSuccess) {
        setState((prev) => ({
          ...prev,
          transactions: [txn, ...prev.transactions],
        }));
        return {
          ok: false,
          message: 'Simulated commission payment failed. Chat remains locked. Please retry payment.',
        };
      }

      const worker = state.workers.find((w) => w.id === booking.workerId);
      const notifs: AppNotification[] = [
        {
          id: makeId('NTF'),
          recipientAccountId: state.booker.accountId,
          type: 'commission_paid',
          title: 'Commission Paid & Booking Confirmed',
          message: `Paid ₹${booking.commissionAmount} for ${booking.id}. Chat with ${booking.workerName} is now unlocked.`,
          bookingId: booking.id,
          read: false,
          createdAt: nowIso,
        },
      ];
      if (worker) {
        notifs.push({
          id: makeId('NTF'),
          recipientAccountId: worker.accountId,
          type: 'booking_confirmed',
          title: 'Booking Confirmed',
          message: `${booking.bookerName} paid the ₹${booking.commissionAmount} commission for ${booking.id}. You can now message and start work as scheduled.`,
          bookingId: booking.id,
          read: false,
          createdAt: nowIso,
        });
      }

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: 'confirmed',
                commissionPaid: true,
                confirmedAt: nowIso,
                updatedAt: nowIso,
              }
            : b
        ),
        conversations: {
          ...prev.conversations,
          [bookingId]: prev.conversations[bookingId] || {
            bookingId,
            messages: [],
            expiredPurged: false,
          },
        },
        transactions: [txn, ...prev.transactions],
        notifications: [...notifs, ...prev.notifications],
      }));

      return {
        ok: true,
        message: `₹${booking.commissionAmount} commission paid. Booking ${booking.id} is confirmed and chat is unlocked.`,
      };
    },
    [state.booker.accountId, state.booker.fullName, state.bookings, state.workers]
  );

  const processPhoneUnlockPayment = useCallback(
    (bookingId: string, simulateSuccess: boolean): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (!booking.commissionPaid) {
        return { ok: false, message: 'Confirm the booking with ₹15 commission first.' };
      }
      if (booking.phoneNumbersUnlocked) {
        return { ok: false, message: 'Phone numbers are already unlocked for this booking.' };
      }

      const nowIso = new Date().toISOString();
      const txn: Transaction = {
        id: makeId('TXN'),
        type: 'phone_unlock',
        amount: 10,
        status: simulateSuccess ? 'success' : 'failed',
        payerAccountId: state.booker.accountId,
        payerName: state.booker.fullName,
        bookingId: booking.id,
        description: `Simulated ₹10 phone number visibility unlock for ${booking.id}`,
        createdAt: nowIso,
      };

      if (!simulateSuccess) {
        setState((prev) => ({
          ...prev,
          transactions: [txn, ...prev.transactions],
        }));
        return { ok: false, message: 'Simulated ₹10 payment failed. Phone numbers remain private.' };
      }

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId ? { ...b, phoneNumbersUnlocked: true, updatedAt: nowIso } : b
        ),
        transactions: [txn, ...prev.transactions],
      }));

      return {
        ok: true,
        message: 'Registered phone numbers unlocked for both participants of this booking.',
      };
    },
    [state.booker.accountId, state.booker.fullName, state.bookings]
  );

  const startWork = useCallback(
    (bookingId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.status !== 'confirmed') {
        return { ok: false, message: 'Only confirmed bookings can be started.' };
      }
      const nowIso = new Date().toISOString();
      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: state.booker.accountId,
        type: 'work_started',
        title: 'Work Started',
        message: `${booking.workerName} marked ${booking.category} (${booking.id}) as In Progress.`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, status: 'in_progress', startedAt: nowIso, updatedAt: nowIso }
            : b
        ),
        notifications: [notif, ...prev.notifications],
      }));
      return { ok: true, message: `Job ${booking.id} is now In Progress.` };
    },
    [state.booker.accountId, state.bookings]
  );

  const completeWork = useCallback(
    (bookingId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.status !== 'in_progress' && booking.status !== 'confirmed') {
        return { ok: false, message: 'Only active bookings can be marked completed.' };
      }
      const nowIso = new Date().toISOString();
      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: state.booker.accountId,
        type: 'work_completed',
        title: 'Work Marked Completed',
        message: `${booking.workerName} completed ${booking.category} (${booking.id}). Confirm completion and submit your rating within 7 days. Pay the ₹${booking.serviceChargeSnapshot} service charge directly to the worker.`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: 'completed',
                startedAt: b.startedAt || nowIso,
                completedAt: nowIso,
                updatedAt: nowIso,
              }
            : b
        ),
        notifications: [notif, ...prev.notifications],
      }));
      return {
        ok: true,
        message: `Job ${booking.id} marked Completed. Booker has been notified.`,
      };
    },
    [state.booker.accountId, state.bookings]
  );

  const confirmBookerCompletion = useCallback(
    (bookingId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.status !== 'completed') {
        return { ok: false, message: 'Worker must mark the job completed first.' };
      }
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, bookerConfirmedCompletion: true, updatedAt: nowIso }
            : b
        ),
      }));
      return { ok: true, message: `Completion confirmed for ${booking.id}.` };
    },
    [state.bookings]
  );

  const cancelBooking = useCallback(
    (bookingId: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (!['pending', 'awaiting_commission', 'confirmed'].includes(booking.status)) {
        return { ok: false, message: 'This booking cannot be cancelled in its current status.' };
      }
      const nowIso = new Date().toISOString();
      const worker = state.workers.find((w) => w.id === booking.workerId);
      const notifs: AppNotification[] = worker
        ? [
            {
              id: makeId('NTF'),
              recipientAccountId: worker.accountId,
              type: 'booking_cancelled',
              title: 'Booking Cancelled',
              message: `${booking.bookerName} cancelled ${booking.category} (${booking.id}).`,
              bookingId: booking.id,
              read: false,
              createdAt: nowIso,
            },
          ]
        : [];

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, status: 'cancelled', requestExpiresAt: null, updatedAt: nowIso }
            : b
        ),
        notifications: [...notifs, ...prev.notifications],
      }));
      return { ok: true, message: `Booking ${booking.id} cancelled.` };
    },
    [state.bookings, state.workers]
  );

  const reportWorkerNoShow = useCallback(
    (bookingId: string, notes: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.noShowReported || booking.status === 'no_show_reported') {
        return { ok: false, message: 'A no-show report has already been filed for this booking.' };
      }
      if (booking.status !== 'confirmed') {
        return { ok: false, message: 'No-show can only be reported on confirmed bookings.' };
      }
      if (!isScheduledArrivalPassed(booking.scheduledDate, booking.scheduledTime)) {
        return {
          ok: false,
          message: 'No-show reporting is only available after the scheduled arrival time has passed.',
        };
      }
      const worker = state.workers.find((w) => w.id === booking.workerId);
      if (!worker) return { ok: false, message: 'Worker record not found.' };

      const nowIso = new Date().toISOString();
      const report = {
        id: makeId('NS'),
        bookingId: booking.id,
        workerId: worker.id,
        workerName: worker.fullName,
        bookerId: booking.bookerId,
        bookerName: booking.bookerName,
        scheduledAt: `${booking.scheduledDate} ${booking.scheduledTime}`,
        reportedAt: nowIso,
        notes: notes.trim() || 'Worker did not arrive at scheduled time.',
        ratingDeducted: 1.0,
        priorityScoreDeducted: 5,
      };

      const excluded = !booking.attemptedWorkerIds.includes(worker.id)
        ? [...booking.attemptedWorkerIds, worker.id]
        : booking.attemptedWorkerIds;

      const workerNotif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: worker.accountId,
        type: 'no_show_reported',
        title: 'No-Show Reported',
        message: `${booking.bookerName} reported a no-show for ${booking.id}. -1.0 public rating penalty and -5% Priority Matching Score applied. Subscription status unchanged.`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: 'no_show_reported',
                noShowReported: true,
                attemptedWorkerIds: excluded,
                updatedAt: nowIso,
              }
            : b
        ),
        workers: prev.workers.map((w) =>
          w.id === worker.id
            ? {
                ...w,
                noShowCount: w.noShowCount + 1,
                noShowPenaltyPoints: Number((w.noShowPenaltyPoints + 1.0).toFixed(1)),
                internalPriorityScore: Math.max(0, w.internalPriorityScore - 5),
              }
            : w
        ),
        noShowReports: [report, ...prev.noShowReports],
        notifications: [workerNotif, ...prev.notifications],
      }));

      return {
        ok: true,
        message: `No-show reported for ${worker.fullName}. Penalties applied. You may now find a replacement worker.`,
      };
    },
    [state.bookings, state.workers]
  );

  const submitRating = useCallback(
    (bookingId: string, stars: number, review: string, feedbackTags: string[]): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (booking.status !== 'completed') {
        return { ok: false, message: 'Only completed bookings can be rated.' };
      }
      if (booking.rated) {
        return { ok: false, message: 'You have already rated this booking.' };
      }
      if (!isRatingWindowActive(booking.completedAt)) {
        return { ok: false, message: 'The 7-day rating submission window has expired.' };
      }
      if (stars < 1 || stars > 5) {
        return { ok: false, message: 'Please select a star rating from 1 to 5.' };
      }
      if (!review.trim()) {
        return { ok: false, message: 'Please enter a short written review.' };
      }
      const worker = state.workers.find((w) => w.id === booking.workerId);
      if (!worker) return { ok: false, message: 'Worker not found.' };

      const nowIso = new Date().toISOString();
      const newRating = {
        id: makeId('REV'),
        bookingId: booking.id,
        workerId: worker.id,
        bookerId: booking.bookerId,
        bookerName: booking.bookerName,
        category: booking.category,
        stars,
        review: review.trim(),
        feedbackTags,
        createdAt: nowIso,
      };

      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: worker.accountId,
        type: 'rating_submitted',
        title: `New ${stars}-Star Review Received`,
        message: `${booking.bookerName} rated your ${booking.category} work (${booking.id}) ${stars}/5 stars.`,
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, rated: true, bookerConfirmedCompletion: true, updatedAt: nowIso }
            : b
        ),
        ratings: [newRating, ...prev.ratings],
        notifications: [notif, ...prev.notifications],
      }));

      return { ok: true, message: `Rating submitted for ${worker.fullName}.` };
    },
    [state.bookings, state.workers]
  );

  const sendMessage = useCallback(
    (bookingId: string, text: string): ActionResult => {
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (!booking) return { ok: false, message: 'Booking not found.' };
      if (!booking.commissionPaid) {
        return {
          ok: false,
          message: 'Chat is locked until the ₹15 platform commission is paid.',
        };
      }
      if (booking.status === 'completed' && isMessageRetentionExpired(booking.completedAt)) {
        return {
          ok: false,
          message: 'Conversation has expired (7-day post-completion retention limit reached).',
        };
      }
      if (!text.trim()) {
        return { ok: false, message: 'Message cannot be empty.' };
      }

      const isBooker = state.activeAccountId === state.booker.accountId;
      const worker = state.workers.find((w) => w.id === booking.workerId);
      const senderName = isBooker ? state.booker.fullName : worker?.fullName || 'Worker';
      const senderRole = isBooker ? ('booker' as const) : ('worker' as const);
      const recipientAccountId = isBooker
        ? worker?.accountId || 'worker-ramesh'
        : state.booker.accountId;

      const hasPhone = detectPhoneNumbers(text);
      const processedText =
        hasPhone && !booking.phoneNumbersUnlocked ? maskPhoneNumbers(text.trim()) : text.trim();

      const nowIso = new Date().toISOString();
      const msg = {
        id: makeId('MSG'),
        bookingId,
        senderAccountId: state.activeAccountId,
        senderName,
        senderRole,
        text: processedText,
        containedMaskedPhone: hasPhone && !booking.phoneNumbersUnlocked,
        createdAt: nowIso,
        readByOther: false,
      };

      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId,
        type: 'new_message',
        title: `New Message from ${senderName}`,
        message: `${senderName}: "${processedText.slice(0, 70)}${processedText.length > 70 ? '...' : ''}"`,
        bookingId,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => {
        const existingConv = prev.conversations[bookingId] || {
          bookingId,
          messages: [],
          expiredPurged: false,
        };
        return {
          ...prev,
          conversations: {
            ...prev.conversations,
            [bookingId]: {
              ...existingConv,
              messages: [...existingConv.messages, msg],
            },
          },
          notifications: [notif, ...prev.notifications],
        };
      });

      return {
        ok: true,
        message:
          hasPhone && !booking.phoneNumbersUnlocked
            ? 'Message sent with phone digits masked for privacy.'
            : 'Message sent.',
      };
    },
    [state.activeAccountId, state.booker, state.bookings, state.workers]
  );

  const markConversationRead = useCallback((bookingId: string, viewerAccountId: AccountId) => {
    setState((prev) => {
      const conv = prev.conversations[bookingId];
      if (!conv) return prev;
      const hasUnread = conv.messages.some(
        (m) => m.senderAccountId !== viewerAccountId && !m.readByOther
      );
      if (!hasUnread) return prev;
      return {
        ...prev,
        conversations: {
          ...prev.conversations,
          [bookingId]: {
            ...conv,
            messages: conv.messages.map((m) =>
              m.senderAccountId !== viewerAccountId ? { ...m, readByOther: true } : m
            ),
          },
        },
      };
    });
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback((accountId: AccountId) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.recipientAccountId === accountId ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const updateWorkerProfile = useCallback(
    (workerId: string, updates: Partial<WorkerProfile>): ActionResult => {
      setState((prev) => ({
        ...prev,
        workers: prev.workers.map((w) => (w.id === workerId ? { ...w, ...updates } : w)),
      }));
      return { ok: true, message: 'Worker profile updated.' };
    },
    []
  );

  const updateBookerProfile = useCallback((updates: Partial<BookerProfile>): ActionResult => {
    setState((prev) => ({
      ...prev,
      booker: { ...prev.booker, ...updates },
    }));
    return { ok: true, message: 'Booker profile updated.' };
  }, []);

  const purchasePrioritySubscription = useCallback(
    (workerId: string, simulateSuccess: boolean): ActionResult => {
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker) return { ok: false, message: 'Worker not found.' };

      const price = state.adminSettings.prioritySubscriptionPrice;
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const expiryIso = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

      const txn: Transaction = {
        id: makeId('TXN'),
        type: 'priority_subscription',
        amount: price,
        status: simulateSuccess ? 'success' : 'failed',
        payerAccountId: worker.accountId,
        payerName: worker.fullName,
        workerId: worker.id,
        description: `Monthly Priority Plan (₹${price}) for ${worker.fullName}`,
        createdAt: nowIso,
      };

      if (!simulateSuccess) {
        const failedSub = {
          id: makeId('SUB'),
          workerId: worker.id,
          planName: 'Monthly Priority Plan',
          amount: price,
          startDate: nowIso,
          expiryDate: expiryIso,
          status: 'failed' as const,
          purchasedAt: nowIso,
        };
        setState((prev) => ({
          ...prev,
          workers: prev.workers.map((w) =>
            w.id === workerId
              ? {
                  ...w,
                  subscription: {
                    ...w.subscription,
                    history: [failedSub, ...w.subscription.history],
                  },
                }
              : w
          ),
          transactions: [txn, ...prev.transactions],
        }));
        return {
          ok: false,
          message: 'Simulated subscription payment failed. Please retry.',
        };
      }

      const activeSub = {
        id: makeId('SUB'),
        workerId: worker.id,
        planName: 'Monthly Priority Plan',
        amount: price,
        startDate: nowIso,
        expiryDate: expiryIso,
        status: 'active' as const,
        purchasedAt: nowIso,
      };

      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: worker.accountId,
        type: 'subscription_activated',
        title: 'Priority Plan Activated',
        message: `Your Monthly Priority Plan (₹${price}) is active for 30 days. You are now eligible for the Combined Priority Pool.`,
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        workers: prev.workers.map((w) =>
          w.id === workerId
            ? {
                ...w,
                subscription: {
                  status: 'active',
                  startDate: nowIso,
                  expiryDate: expiryIso,
                  history: [
                    activeSub,
                    ...w.subscription.history.map((h) =>
                      h.status === 'active' ? { ...h, status: 'expired' as const } : h
                    ),
                  ],
                },
              }
            : w
        ),
        transactions: [txn, ...prev.transactions],
        notifications: [notif, ...prev.notifications],
      }));

      return {
        ok: true,
        message: `Priority subscription activated for ${worker.fullName} (₹${price}/month).`,
      };
    },
    [state.adminSettings.prioritySubscriptionPrice, state.workers]
  );

  const expireWorkerSubscriptionNow = useCallback(
    (workerId: string): ActionResult => {
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker) return { ok: false, message: 'Worker not found.' };
      if (worker.subscription.status !== 'active') {
        return { ok: false, message: `${worker.fullName} does not have an active subscription.` };
      }

      const nowIso = new Date().toISOString();
      const notif: AppNotification = {
        id: makeId('NTF'),
        recipientAccountId: worker.accountId,
        type: 'subscription_expired',
        title: 'Priority Subscription Expired',
        message:
          'Your monthly Priority subscription has expired. Subscription-based Priority Pool eligibility is removed, while rating-based eligibility (4.5+) remains unaffected.',
        read: false,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        workers: prev.workers.map((w) =>
          w.id === workerId
            ? {
                ...w,
                subscription: {
                  ...w.subscription,
                  status: 'expired',
                  expiryDate: nowIso,
                  history: w.subscription.history.map((h) =>
                    h.status === 'active'
                      ? { ...h, status: 'expired' as const, expiryDate: nowIso }
                      : h
                  ),
                },
              }
            : w
        ),
        notifications: [notif, ...prev.notifications],
      }));

      return {
        ok: true,
        message: `Simulated expiration for ${worker.fullName}'s Priority subscription.`,
      };
    },
    [state.workers]
  );

  const updateAdminSettings = useCallback((settings: AdminSettings): ActionResult => {
    if (settings.prioritySubscriptionPrice < 60 || settings.prioritySubscriptionPrice > 70) {
      return { ok: false, message: 'Priority subscription price must be between ₹60 and ₹70.' };
    }
    if (settings.platformCommission < 0) {
      return { ok: false, message: 'Platform commission cannot be negative.' };
    }
    if (settings.priorityRatingThreshold < 3.0 || settings.priorityRatingThreshold > 5.0) {
      return { ok: false, message: 'Priority rating threshold must be between 3.0 and 5.0.' };
    }
    setState((prev) => ({ ...prev, adminSettings: settings }));
    return { ok: true, message: 'Platform settings updated.' };
  }, []);

  const resetDemoData = useCallback(() => {
    const fresh = createInitialSeedState();
    setState((prev) => ({ ...fresh, theme: prev.theme }));
  }, []);

  return (
    <KoolieContext.Provider
      value={{
        state,
        nowMs,
        switchAccount,
        toggleTheme,
        setTheme,
        createBooking,
        reassignBookingAuto,
        reassignBookingManual,
        acceptBookingRequest,
        rejectBookingRequest,
        processCommissionPayment,
        processPhoneUnlockPayment,
        startWork,
        completeWork,
        confirmBookerCompletion,
        cancelBooking,
        reportWorkerNoShow,
        submitRating,
        sendMessage,
        markConversationRead,
        markNotificationRead,
        markAllNotificationsRead,
        updateWorkerProfile,
        updateBookerProfile,
        purchasePrioritySubscription,
        expireWorkerSubscriptionNow,
        updateAdminSettings,
        resetDemoData,
      }}
    >
      {children}
    </KoolieContext.Provider>
  );
}

export function useKoolie(): KoolieContextValue {
  const ctx = useContext(KoolieContext);
  if (!ctx) {
    throw new Error('useKoolie must be used inside KoolieProvider');
  }
  return ctx;
}
