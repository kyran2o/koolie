import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  CreditCard,
  Inbox,
  MapPin,
  MessageSquare,
  Play,
  ShieldCheck,
  Star,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useKoolie } from '../../context/KoolieContext';
import { KERALA_LOCATIONS, getLocationByName } from '../../data/locations';
import {
  BookingStatus,
  DayOfWeek,
  SERVICE_CATEGORIES,
  ServiceCategory,
  WorkerProfile,
} from '../../types/koolie';
import {
  BOOKING_STATUS_LABELS,
  formatCountdown,
  formatCurrency,
  formatDateTime,
  formatShortDate,
} from '../../utils/formatters';
import {
  computeWorkerRatingStats,
  getWorkerActiveJobsCount,
  getWorkerPriorityQualification,
} from '../../utils/matching';
import {
  BookingDetailModal,
  OtpVerificationModal,
  PaymentSimulationModal,
} from '../shared/Modals';
import { MessagesView } from '../shared/MessagesView';
import { NotificationsView } from '../shared/NotificationsView';

export type WorkerTab =
  | 'requests'
  | 'jobs'
  | 'messages'
  | 'notifications'
  | 'subscription'
  | 'profile'
  | 'settings';

const DAYS_LIST: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WorkerDashboard({
  worker,
  activeTab,
  setActiveTab,
  onNotify,
}: {
  worker: WorkerProfile;
  activeTab: WorkerTab;
  setActiveTab: (tab: WorkerTab) => void;
  onNotify: (ok: boolean, text: string) => void;
}) {
  const {
    state,
    nowMs,
    acceptBookingRequest,
    rejectBookingRequest,
    startWork,
    completeWork,
    updateWorkerProfile,
    purchasePrioritySubscription,
    toggleTheme,
  } = useKoolie();

  const [jobFilter, setJobFilter] = useState<'all' | BookingStatus>('all');
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [chatInitialBookingId, setChatInitialBookingId] = useState<string | null>(null);
  const [showSubPayment, setShowSubPayment] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  // Editable Profile Form State (synced when switching worker accounts)
  const [fullName, setFullName] = useState(worker.fullName);
  const [mobile, setMobile] = useState(worker.mobile);
  const [locationName, setLocationName] = useState(worker.locationName);
  const [workerOrigin, setWorkerOrigin] = useState<WorkerProfile['workerOrigin']>(
    worker.workerOrigin
  );
  const [homeState, setHomeState] = useState(worker.homeState);
  const [languagesText, setLanguagesText] = useState(worker.languages.join(', '));
  const [categories, setCategories] = useState<ServiceCategory[]>(worker.categories);
  const [skills, setSkills] = useState(worker.skills);
  const [experienceYears, setExperienceYears] = useState(worker.experienceYears);
  const [serviceCharge, setServiceCharge] = useState(worker.serviceCharge);
  const [maxWorkingRadiusKm, setMaxWorkingRadiusKm] = useState(worker.maxWorkingRadiusKm);
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(worker.workingDays);
  const [workStart, setWorkStart] = useState(worker.workingHours.start);
  const [workEnd, setWorkEnd] = useState(worker.workingHours.end);
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState(worker.maxConcurrentJobs);
  const [responseTimeoutMinutes, setResponseTimeoutMinutes] = useState(
    worker.responseTimeoutMinutes
  );
  const [customTimeoutInput, setCustomTimeoutInput] = useState(
    String(worker.responseTimeoutMinutes)
  );
  const [tempReason, setTempReason] = useState(worker.temporaryUnavailableReason);

  useEffect(() => {
    setFullName(worker.fullName);
    setMobile(worker.mobile);
    setLocationName(worker.locationName);
    setWorkerOrigin(worker.workerOrigin);
    setHomeState(worker.homeState);
    setLanguagesText(worker.languages.join(', '));
    setCategories(worker.categories);
    setSkills(worker.skills);
    setExperienceYears(worker.experienceYears);
    setServiceCharge(worker.serviceCharge);
    setMaxWorkingRadiusKm(worker.maxWorkingRadiusKm);
    setWorkingDays(worker.workingDays);
    setWorkStart(worker.workingHours.start);
    setWorkEnd(worker.workingHours.end);
    setMaxConcurrentJobs(worker.maxConcurrentJobs);
    setResponseTimeoutMinutes(worker.responseTimeoutMinutes);
    setCustomTimeoutInput(String(worker.responseTimeoutMinutes));
    setTempReason(worker.temporaryUnavailableReason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id]);

  const workerBookings = useMemo(
    () => state.bookings.filter((b) => b.workerId === worker.id),
    [state.bookings, worker.id]
  );

  const incomingRequests = useMemo(
    () => workerBookings.filter((b) => b.status === 'pending'),
    [workerBookings]
  );

  const rejectedOrExpiredRequests = useMemo(
    () => workerBookings.filter((b) => b.status === 'rejected' || b.status === 'expired'),
    [workerBookings]
  );

  const activeJobsCount = getWorkerActiveJobsCount(worker.id, state.bookings);
  const { publicAverageRating, ratingCount } = computeWorkerRatingStats(worker, state.ratings);
  const priorityInfo = getWorkerPriorityQualification(
    worker,
    state.ratings,
    state.adminSettings,
    nowMs
  );

  const filteredJobs = useMemo(() => {
    const jobStatuses: BookingStatus[] = [
      'awaiting_commission',
      'accepted',
      'confirmed',
      'in_progress',
      'completed',
      'no_show_reported',
      'cancelled',
    ];
    return workerBookings.filter((b) => {
      if (!jobStatuses.includes(b.status)) return false;
      if (jobFilter === 'all') return true;
      if (jobFilter === 'accepted') {
        return b.status === 'accepted' || b.status === 'awaiting_commission';
      }
      return b.status === jobFilter;
    });
  }, [workerBookings, jobFilter]);

  const detailBooking = detailBookingId
    ? state.bookings.find((b) => b.id === detailBookingId) || null
    : null;

  const toggleCategory = (cat: ServiceCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleDay = (day: DayOfWeek) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (categories.length === 0) {
      onNotify(false, 'Select at least one service category.');
      return;
    }
    if (workingDays.length === 0) {
      onNotify(false, 'Select at least one working day.');
      return;
    }
    const loc = getLocationByName(locationName);
    const parsedTimeout = Math.max(1, Math.min(120, Number(responseTimeoutMinutes) || 5));
    const res = updateWorkerProfile(worker.id, {
      fullName: fullName.trim() || worker.fullName,
      mobile: mobile.trim(),
      locationName: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      workerOrigin,
      homeState: homeState.trim() || 'Kerala',
      languages: languagesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      categories,
      skills: skills.trim(),
      experienceYears: Math.max(0, Number(experienceYears) || 0),
      serviceCharge: Math.max(100, Number(serviceCharge) || 500),
      maxWorkingRadiusKm: Math.max(1, Math.min(50, Number(maxWorkingRadiusKm) || 10)),
      workingDays,
      workingHours: { start: workStart, end: workEnd },
      maxConcurrentJobs: Math.max(1, Math.min(10, Number(maxConcurrentJobs) || 1)),
      responseTimeoutMinutes: parsedTimeout,
    });
    onNotify(res.ok, res.message);
  };

  return (
    <div className="space-y-6">
      {/* Top Worker Availability & Metrics Strip */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 flex-1">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Public Rating</p>
              <p className="mt-1 flex items-center gap-1 font-mono text-lg font-bold tabular-nums">
                <Star className="h-4 w-4 fill-current" />
                {publicAverageRating.toFixed(1)}
                <span className="text-xs font-normal text-neutral-500">({ratingCount})</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Job Capacity</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {activeJobsCount} / {worker.maxConcurrentJobs}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Priority Pool</p>
              <p className="mt-1 text-xs font-semibold">
                {priorityInfo.inPriorityPool ? priorityInfo.poolLabel : 'Standard Pool'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Response Timeout</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {worker.responseTimeoutMinutes} min
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3 lg:border-t-0 lg:pt-0 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => {
                const next = worker.availabilityStatus === 'open' ? 'closed' : 'open';
                updateWorkerProfile(worker.id, { availabilityStatus: next });
                onNotify(true, `${worker.fullName} availability set to ${next.toUpperCase()}.`);
              }}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                worker.availabilityStatus === 'open'
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                  : 'border border-neutral-400 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300'
              }`}
            >
              Availability: {worker.availabilityStatus === 'open' ? 'Open' : 'Closed'}
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !worker.temporaryUnavailable;
                updateWorkerProfile(worker.id, {
                  temporaryUnavailable: next,
                  temporaryUnavailableReason: next ? tempReason || 'On short break' : '',
                });
                onNotify(
                  true,
                  next
                    ? `${worker.fullName} marked temporarily unavailable.`
                    : `${worker.fullName} is available for requests again.`
                );
              }}
              className={`rounded-md border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                worker.temporaryUnavailable
                  ? 'border-neutral-950 bg-neutral-100 text-neutral-950 dark:border-white dark:bg-neutral-800 dark:text-white'
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {worker.temporaryUnavailable ? 'Temp Unavailable: ON' : 'Set Temp Unavailable'}
            </button>
          </div>
        </div>
      </div>

      {/* TAB: INCOMING REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold tracking-tight">
                Incoming Requests ({incomingRequests.length})
              </h2>
              <span className="text-xs text-neutral-500">
                Timeout configured: {worker.responseTimeoutMinutes} min
              </span>
            </div>

            {incomingRequests.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <Inbox className="mx-auto h-7 w-7 text-neutral-400" />
                <p className="mt-3 text-sm font-medium">No Pending Incoming Requests</p>
                <p className="mt-1 text-xs text-neutral-500">
                  When a booker requests {worker.fullName} (manually or via Priority Circulation),
                  it will appear here with a live response countdown.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-lg border border-neutral-950 bg-white p-5 dark:border-neutral-200 dark:bg-neutral-900"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-neutral-500">
                            {req.id}
                          </span>
                          <span className="border border-neutral-950 bg-neutral-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:border-white dark:bg-white dark:text-neutral-950">
                            Incoming Request
                          </span>
                          <h3 className="font-display text-base font-bold">{req.category}</h3>
                        </div>

                        <p className="text-sm text-neutral-800 dark:text-neutral-200">
                          {req.description}
                        </p>
                        {req.additionalDetails && (
                          <p className="text-xs text-neutral-500">Note: {req.additionalDetails}</p>
                        )}

                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-1 text-xs text-neutral-600 tabular-nums sm:grid-cols-4 dark:text-neutral-400">
                          <div>
                            <span className="block text-[11px] text-neutral-500">Location</span>
                            <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                              <MapPin className="mr-1 inline h-3 w-3" />
                              {req.locationName} ({req.distanceKm ?? '—'} km)
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-neutral-500">Date &amp; Time</span>
                            <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                              {formatShortDate(req.scheduledDate)} · {req.scheduledTime}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-neutral-500">Est. Duration</span>
                            <span className="font-semibold text-neutral-950 dark:text-neutral-50">
                              {req.estimatedDurationHours} hrs
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-neutral-500">Service Charge</span>
                            <span className="font-mono font-bold text-neutral-950 dark:text-neutral-50">
                              {formatCurrency(req.serviceChargeSnapshot)}
                            </span>
                          </div>
                        </div>

                        {req.requestExpiresAt && (
                          <div className="inline-flex items-center gap-2 rounded border border-neutral-300 px-3 py-1.5 font-mono text-xs font-bold tabular-nums dark:border-neutral-700">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              Remaining time: {formatCountdown(req.requestExpiresAt, nowMs)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const res = rejectBookingRequest(req.id);
                            onNotify(res.ok, res.message);
                          }}
                          className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-700 dark:hover:bg-neutral-800"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const res = acceptBookingRequest(req.id);
                            onNotify(res.ok, res.message);
                          }}
                          className="flex items-center gap-1.5 rounded-md bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Accept Request</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Rejected / Expired Request History */}
          {rejectedOrExpiredRequests.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-bold text-neutral-600 dark:text-neutral-400">
                Rejected &amp; Expired Requests ({rejectedOrExpiredRequests.length})
              </h3>
              <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
                {rejectedOrExpiredRequests.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold">{b.id}</span> ·{' '}
                      <span className="font-semibold">{b.category}</span> · {b.locationName} (
                      {b.distanceKm} km)
                    </div>
                    <span className="border border-neutral-300 px-2 py-0.5 font-medium uppercase dark:border-neutral-700">
                      {BOOKING_STATUS_LABELS[b.status]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB: MY JOBS */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            {(
              [
                { id: 'all', label: 'All Jobs' },
                { id: 'accepted', label: 'Accepted (Awaiting Commission)' },
                { id: 'confirmed', label: 'Upcoming (Confirmed)' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'completed', label: 'Completed' },
                { id: 'no_show_reported', label: 'No-Show Reports' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setJobFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  jobFilter === tab.id
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'border border-neutral-200 text-neutral-600 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredJobs.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm font-medium">No jobs in this filter</p>
              <p className="mt-1 text-xs text-neutral-500">
                Accepted and confirmed jobs will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-neutral-500">
                          {job.id}
                        </span>
                        <span className="border border-neutral-950 px-2 py-0.5 text-[11px] font-semibold uppercase dark:border-neutral-200">
                          {BOOKING_STATUS_LABELS[job.status]}
                        </span>
                        <span className="text-sm font-bold">{job.category}</span>
                      </div>

                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        {job.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                        <span>
                          Booker:{' '}
                          <strong className="text-neutral-950 dark:text-neutral-50">
                            {job.bookerName}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          {job.locationName} ({job.distanceKm ?? '—'} km)
                        </span>
                        <span>·</span>
                        <span>
                          {formatShortDate(job.scheduledDate)} at {job.scheduledTime} (
                          {job.estimatedDurationHours}h)
                        </span>
                        <span>·</span>
                        <span>
                          Direct Fee:{' '}
                          <strong className="font-mono text-neutral-950 dark:text-neutral-50">
                            {formatCurrency(job.serviceChargeSnapshot)}
                          </strong>{' '}
                          (Collect directly from booker)
                        </span>
                      </div>

                      {job.status === 'awaiting_commission' && (
                        <p className="pt-1 text-xs text-neutral-500">
                          Waiting for {job.bookerName} to pay the ₹{job.commissionAmount} KOOLIE
                          commission to unlock chat and confirm.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {job.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = startWork(job.id);
                            onNotify(res.ok, res.message);
                          }}
                          className="flex items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Start Work</span>
                        </button>
                      )}

                      {job.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = completeWork(job.id);
                            onNotify(res.ok, res.message);
                          }}
                          className="flex items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Mark Completed</span>
                        </button>
                      )}

                      {job.commissionPaid && (
                        <button
                          type="button"
                          onClick={() => {
                            setChatInitialBookingId(job.id);
                            setActiveTab('messages');
                          }}
                          className="flex items-center gap-1.5 rounded-md border border-neutral-950 px-3 py-2 text-xs font-medium hover:bg-neutral-950 hover:text-white whitespace-nowrap dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Messages</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDetailBookingId(job.id)}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-700 dark:hover:bg-neutral-800"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: MESSAGES */}
      {activeTab === 'messages' && (
        <MessagesView
          viewerAccountId={worker.accountId}
          viewerRole="worker"
          initialBookingId={chatInitialBookingId}
          onNotify={onNotify}
        />
      )}

      {/* TAB: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <NotificationsView
          accountId={worker.accountId}
          onOpenBooking={(bookingId) => setDetailBookingId(bookingId)}
        />
      )}

      {/* TAB: PRIORITY SUBSCRIPTION */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 lg:col-span-7 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold tracking-tight">
                    Monthly Priority Plan
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Qualify for KOOLIE&apos;s Combined Priority Pool regardless of your current
                    rating.
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {formatCurrency(state.adminSettings.prioritySubscriptionPrice)}
                  <span className="text-xs font-normal text-neutral-500">/mo</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 border-y border-neutral-200 py-4 sm:grid-cols-3 dark:border-neutral-800">
                <div>
                  <p className="text-xs text-neutral-500">Subscription Status</p>
                  <p className="mt-1 font-mono text-sm font-bold uppercase">
                    {worker.subscription.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Start Date</p>
                  <p className="mt-1 font-mono text-xs font-semibold tabular-nums">
                    {formatShortDate(worker.subscription.startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Expiry Date</p>
                  <p className="mt-1 font-mono text-xs font-semibold tabular-nums">
                    {formatShortDate(worker.subscription.expiryDate)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                <p className="font-semibold text-neutral-950 dark:text-neutral-50">
                  How Combined Priority Pool Qualification Works
                </p>
                <p>
                  1. <strong>Route 1 — Active Priority Subscription:</strong> Any worker with an
                  active monthly plan enters the Priority Pool when meeting basic eligibility
                  (category, radius, availability, working hours, capacity).
                </p>
                <p>
                  2. <strong>Route 2 — High Public Rating ({state.adminSettings.priorityRatingThreshold}+):</strong>{' '}
                  Workers with a public rating of {state.adminSettings.priorityRatingThreshold} or
                  higher qualify automatically even without a paid subscription.
                </p>
                <p>
                  3. <strong>Fairness &amp; Integrity:</strong> Priority subscription never raises
                  your public rating, and no-show penalties never cancel your active subscription.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubPayment(true)}
                  className="flex items-center gap-2 rounded-md bg-neutral-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>
                    {worker.subscription.status === 'active'
                      ? `Renew Monthly Priority Plan (${formatCurrency(state.adminSettings.prioritySubscriptionPrice)})`
                      : `Activate Monthly Priority Plan (${formatCurrency(state.adminSettings.prioritySubscriptionPrice)})`}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 lg:col-span-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <Award className="h-4 w-4" />
                <span>Your Current Priority Status</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
                  <span className="text-neutral-500">Combined Pool Status</span>
                  <span className="font-semibold">
                    {priorityInfo.inPriorityPool ? 'Eligible' : 'Standard (Fallback)'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
                  <span className="text-neutral-500">Subscription Route</span>
                  <span className="font-semibold">
                    {priorityInfo.viaSubscription ? 'Qualified (Active)' : 'Not Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
                  <span className="text-neutral-500">Rating Route ({state.adminSettings.priorityRatingThreshold}+)</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {publicAverageRating.toFixed(1)} ({priorityInfo.viaRating ? 'Qualified' : 'Below Threshold'})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Internal Priority Score</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {worker.internalPriorityScore}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription History */}
          <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
              <h3 className="text-sm font-bold">Subscription History</h3>
            </div>
            {worker.subscription.history.length === 0 ? (
              <p className="p-6 text-xs text-neutral-500">No subscription transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                    <tr>
                      <th className="px-5 py-3 font-medium">ID</th>
                      <th className="px-5 py-3 font-medium">Plan</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Start</th>
                      <th className="px-5 py-3 font-medium">Expiry</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 tabular-nums dark:divide-neutral-800">
                    {worker.subscription.history.map((sub) => (
                      <tr key={sub.id}>
                        <td className="px-5 py-3 font-mono">{sub.id}</td>
                        <td className="px-5 py-3">{sub.planName}</td>
                        <td className="px-5 py-3 font-mono">{formatCurrency(sub.amount)}</td>
                        <td className="px-5 py-3 font-mono">{formatShortDate(sub.startDate)}</td>
                        <td className="px-5 py-3 font-mono">{formatShortDate(sub.expiryDate)}</td>
                        <td className="px-5 py-3 font-semibold uppercase">{sub.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PROFILE */}
      {activeTab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="space-y-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 font-display text-lg font-bold dark:border-neutral-700">
                {worker.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">
                  {worker.fullName} — Worker Profile
                </h2>
                <p className="text-xs text-neutral-500">
                  {worker.workerOrigin} ({worker.homeState}) · Public Rating{' '}
                  {publicAverageRating.toFixed(1)} ({ratingCount} reviews)
                </p>
              </div>
            </div>
            <button
              type="submit"
              className="rounded-md bg-neutral-950 px-5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Save Profile Changes
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Mobile Number (Private)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value);
                    updateWorkerProfile(worker.id, { mobileVerified: false });
                  }}
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="button"
                  onClick={() => setShowOtpModal(true)}
                  className="rounded-md border border-neutral-950 px-3 py-2 text-xs font-medium hover:bg-neutral-950 hover:text-white whitespace-nowrap dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                >
                  {worker.mobileVerified ? 'OTP Verified' : 'Verify OTP'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                {worker.mobileVerified
                  ? 'Verified via prototype OTP simulation.'
                  : 'Click Verify OTP to test simulated verification.'}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Base Location in Kerala</label>
              <select
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                {KERALA_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name} ({loc.district})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Worker Origin</label>
                <select
                  value={workerOrigin}
                  onChange={(e) =>
                    setWorkerOrigin(e.target.value as WorkerProfile['workerOrigin'])
                  }
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                >
                  <option value="Local (Kerala)">Local (Kerala)</option>
                  <option value="Migrant Worker">Migrant Worker</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">Home State</label>
                <input
                  type="text"
                  value={homeState}
                  onChange={(e) => setHomeState(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Languages Spoken</label>
              <input
                type="text"
                value={languagesText}
                onChange={(e) => setLanguagesText(e.target.value)}
                placeholder="Malayalam, Hindi, Tamil"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Service Charge (₹)</label>
                <input
                  type="number"
                  min={100}
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Number(e.target.value))}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">Experience (yrs)</label>
                <input
                  type="number"
                  min={0}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">Max Radius (km)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxWorkingRadiusKm}
                  onChange={(e) => setMaxWorkingRadiusKm(Number(e.target.value))}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            </div>
          </div>

          {/* Multi-select Service Categories */}
          <div>
            <label className="mb-2 block text-xs font-medium">
              Service Categories (Select all that apply — you appear in searches for each selected)
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_CATEGORIES.map((cat) => {
                const selected = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      selected
                        ? 'border-neutral-950 bg-neutral-950 font-medium text-white dark:border-white dark:bg-white dark:text-neutral-950'
                        : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span>{cat}</span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">Skills &amp; Experience Details</label>
            <textarea
              rows={2}
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </div>

          {/* Working Days, Working Hours, Capacity, Response Timeout */}
          <div className="grid grid-cols-1 gap-5 border-t border-neutral-200 pt-5 lg:grid-cols-2 dark:border-neutral-800">
            <div>
              <label className="mb-2 block text-xs font-medium">Working Days</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_LIST.map((day) => {
                  const active = workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                          : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Start Hour</label>
                <input
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">End Hour</label>
                <input
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">Max Concurrent Jobs</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxConcurrentJobs}
                  onChange={(e) => setMaxConcurrentJobs(Number(e.target.value))}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            </div>
          </div>

          {/* Response Timeout Config */}
          <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <label className="mb-2 block text-xs font-medium">
              Incoming Request Response Timeout
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[2, 5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setResponseTimeoutMinutes(mins);
                    setCustomTimeoutInput(String(mins));
                  }}
                  className={`rounded-md border px-3 py-1.5 font-mono text-xs font-medium ${
                    responseTimeoutMinutes === mins
                      ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                >
                  {mins} min
                </button>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Custom (min):</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customTimeoutInput}
                  onChange={(e) => {
                    setCustomTimeoutInput(e.target.value);
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= 120) {
                      setResponseTimeoutMinutes(val);
                    }
                  }}
                  className="w-20 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="font-display text-lg font-bold">Worker Preferences &amp; Theme</h2>

            <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <div>
                <p className="text-sm font-medium">Interface Theme</p>
                <p className="text-xs text-neutral-500">
                  Current: {state.theme === 'light' ? 'Light' : 'Dark'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-md border border-neutral-950 px-4 py-2 text-xs font-medium hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
              >
                Switch to {state.theme === 'light' ? 'Dark' : 'Light'} Theme
              </button>
            </div>

            <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <label className="block text-xs font-medium">
                Temporary Unavailability Reason (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempReason}
                  onChange={(e) => setTempReason(e.target.value)}
                  placeholder="e.g., Attending family event today"
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateWorkerProfile(worker.id, {
                      temporaryUnavailableReason: tempReason.trim(),
                    });
                    onNotify(true, 'Unavailability reason saved.');
                  }}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Save Note
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-neutral-200 pt-4 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <p className="font-semibold text-neutral-950 dark:text-neutral-50">
                <UserCheck className="mr-1.5 inline h-3.5 w-3.5" />
                Direct Service Fee Collection
              </p>
              <p className="mt-1">
                KOOLIE never holds or settles your service charge ({formatCurrency(worker.serviceCharge)}).
                Collect your wage directly from the booker in cash or UPI upon completing work.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          role="worker"
          onOpenChat={() => {
            setChatInitialBookingId(detailBooking.id);
            setActiveTab('messages');
          }}
          onClose={() => setDetailBookingId(null)}
        />
      )}

      {showSubPayment && (
        <PaymentSimulationModal
          title="Monthly Priority Plan Checkout"
          amount={state.adminSettings.prioritySubscriptionPrice}
          description={`Activate 30-day Combined Priority Pool eligibility for ${worker.fullName}.`}
          note="Priority subscription enters you into the Combined Priority Pool for automatic matching. It does not alter your public customer rating."
          onConfirm={(ok) => {
            const res = purchasePrioritySubscription(worker.id, ok);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setShowSubPayment(false)}
        />
      )}

      {showOtpModal && (
        <OtpVerificationModal
          mobile={mobile}
          onVerified={() => {
            updateWorkerProfile(worker.id, { mobile, mobileVerified: true });
            onNotify(true, `${worker.fullName}'s mobile number verified via demo OTP.`);
          }}
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </div>
  );
}
