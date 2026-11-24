import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  MapPin,
  MessageSquare,
  RotateCw,
  Search,
  ShieldCheck,
  Star,
  User,
  Zap,
} from 'lucide-react';
import { useKoolie } from '../../context/KoolieContext';
import { KERALA_LOCATIONS, getLocationByName } from '../../data/locations';
import {
  Booking,
  BookingStatus,
  SERVICE_CATEGORIES,
  ServiceCategory,
  WorkerProfile,
} from '../../types/koolie';
import {
  BOOKING_STATUS_LABELS,
  formatCountdown,
  formatCurrency,
  formatShortDate,
} from '../../utils/formatters';
import {
  evaluateWorkerEligibility,
  isRatingWindowActive,
  isScheduledArrivalPassed,
  SEVEN_DAYS_MS,
} from '../../utils/matching';
import {
  BookingDetailModal,
  NoShowReportModal,
  OtpVerificationModal,
  PaymentSimulationModal,
  RateWorkerModal,
  ReassignWorkerModal,
  WorkerPublicProfileModal,
} from '../shared/Modals';
import { MessagesView } from '../shared/MessagesView';
import { NotificationsView } from '../shared/NotificationsView';

export type BookerTab = 'find' | 'bookings' | 'messages' | 'notifications' | 'profile' | 'settings';

function defaultBookingDateTime(): { date: string; time: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hour = now.getHours();
  if (hour >= 7 && hour <= 19) {
    return { date: `${y}-${m}-${d}`, time: `${String(hour + 1).padStart(2, '0')}:00` };
  }
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const ty = tomorrow.getFullYear();
  const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const td = String(tomorrow.getDate()).padStart(2, '0');
  return { date: `${ty}-${tm}-${td}`, time: '09:30' };
}

export function BookerDashboard({
  activeTab,
  setActiveTab,
  onNotify,
}: {
  activeTab: BookerTab;
  setActiveTab: (tab: BookerTab) => void;
  onNotify: (ok: boolean, text: string) => void;
}) {
  const {
    state,
    nowMs,
    createBooking,
    reassignBookingAuto,
    reassignBookingManual,
    processCommissionPayment,
    processPhoneUnlockPayment,
    confirmBookerCompletion,
    cancelBooking,
    reportWorkerNoShow,
    submitRating,
    updateBookerProfile,
    toggleTheme,
  } = useKoolie();

  const initialDt = useMemo(() => defaultBookingDateTime(), []);

  // Booking / Search form state
  const [category, setCategory] = useState<ServiceCategory>('General Labour / Coolie Work');
  const [locationName, setLocationName] = useState<string>(state.booker.locationName);
  const [addressNote, setAddressNote] = useState<string>('');
  const [searchRadiusKm, setSearchRadiusKm] = useState<5 | 10 | 15 | 20>(
    state.booker.defaultSearchRadiusKm
  );
  const [scheduledDate, setScheduledDate] = useState<string>(initialDt.date);
  const [scheduledTime, setScheduledTime] = useState<string>(initialDt.time);
  const [estimatedDurationHours, setEstimatedDurationHours] = useState<number>(4);
  const [description, setDescription] = useState<string>(
    'Need general household assistance for shifting materials and courtyard clearing.'
  );
  const [additionalDetails, setAdditionalDetails] = useState<string>('');
  const [showIneligible, setShowIneligible] = useState(false);

  // Bookings filter state
  const [bookingFilter, setBookingFilter] = useState<'all' | BookingStatus>('all');
  const [bookingSearch, setBookingSearch] = useState('');

  // Modals & selected items
  const [profileModalWorker, setProfileModalWorker] = useState<{
    worker: WorkerProfile;
    distanceKm: number;
    disabledReason?: string;
  } | null>(null);
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [payCommissionBooking, setPayCommissionBooking] = useState<Booking | null>(null);
  const [payPhoneUnlockBooking, setPayPhoneUnlockBooking] = useState<Booking | null>(null);
  const [rateBooking, setRateBooking] = useState<Booking | null>(null);
  const [noShowBooking, setNoShowBooking] = useState<Booking | null>(null);
  const [reassignBooking, setReassignBooking] = useState<Booking | null>(null);
  const [chatInitialBookingId, setChatInitialBookingId] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);

  // Profile form state
  const [profileName, setProfileName] = useState(state.booker.fullName);
  const [profileMobile, setProfileMobile] = useState(state.booker.mobile);
  const [profileLocation, setProfileLocation] = useState(state.booker.locationName);
  const [profileRadius, setProfileRadius] = useState<5 | 10 | 15 | 20>(
    state.booker.defaultSearchRadiusKm
  );

  const bookerBookings = useMemo(
    () => state.bookings.filter((b) => b.bookerId === state.booker.id),
    [state.bookings, state.booker.id]
  );

  const unreadMessagesCount = useMemo(() => {
    return bookerBookings.reduce((sum, b) => {
      const conv = state.conversations[b.id];
      if (!conv || !b.commissionPaid) return sum;
      return (
        sum +
        conv.messages.filter(
          (m) => m.senderAccountId !== state.booker.accountId && !m.readByOther
        ).length
      );
    }, 0);
  }, [bookerBookings, state.conversations, state.booker.accountId]);

  // Evaluate workers for current Find Workers criteria
  const workerEvaluations = useMemo(() => {
    const loc = getLocationByName(locationName);
    return state.workers.map((worker) =>
      evaluateWorkerEligibility({
        worker,
        category,
        targetLat: loc.lat,
        targetLng: loc.lng,
        searchRadiusKm,
        scheduledDate,
        scheduledTime,
        bookings: state.bookings,
        ratings: state.ratings,
        adminSettings: state.adminSettings,
        nowMs,
      })
    );
  }, [
    locationName,
    state.workers,
    category,
    searchRadiusKm,
    scheduledDate,
    scheduledTime,
    state.bookings,
    state.ratings,
    state.adminSettings,
    nowMs,
  ]);

  const eligibleWorkers = useMemo(() => {
    return workerEvaluations
      .filter((e) => e.eligible)
      .sort((a, b) => {
        if (a.inPriorityPool !== b.inPriorityPool) return a.inPriorityPool ? -1 : 1;
        if (b.publicAverageRating !== a.publicAverageRating) {
          return b.publicAverageRating - a.publicAverageRating;
        }
        return a.distanceKm - b.distanceKm;
      });
  }, [workerEvaluations]);

  const ineligibleCategoryWorkers = useMemo(
    () =>
      workerEvaluations.filter(
        (e) => !e.eligible && e.worker.categories.includes(category)
      ),
    [workerEvaluations, category]
  );

  const handleAutoBook = () => {
    const res = createBooking({
      category,
      locationName,
      addressNote,
      searchRadiusKm,
      scheduledDate,
      scheduledTime,
      estimatedDurationHours,
      description,
      additionalDetails,
      method: 'auto',
    });
    onNotify(res.ok, res.message);
    if (res.ok) {
      setActiveTab('bookings');
      setBookingFilter('all');
    }
  };

  const handleManualBook = (workerId: string) => {
    const res = createBooking({
      category,
      locationName,
      addressNote,
      searchRadiusKm,
      scheduledDate,
      scheduledTime,
      estimatedDurationHours,
      description,
      additionalDetails,
      method: 'manual',
      manualWorkerId: workerId,
    });
    onNotify(res.ok, res.message);
    if (res.ok) {
      setActiveTab('bookings');
      setBookingFilter('all');
    }
  };

  const filteredBookings = useMemo(() => {
    return bookerBookings.filter((b) => {
      if (bookingFilter !== 'all') {
        if (bookingFilter === 'accepted') {
          if (b.status !== 'accepted' && b.status !== 'awaiting_commission') return false;
        } else if (b.status !== bookingFilter) {
          return false;
        }
      }
      if (bookingSearch.trim()) {
        const q = bookingSearch.toLowerCase();
        const matches =
          b.id.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          (b.workerName || '').toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.locationName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [bookerBookings, bookingFilter, bookingSearch]);

  const detailBooking = detailBookingId
    ? state.bookings.find((b) => b.id === detailBookingId) || null
    : null;

  return (
    <div className="space-y-6">
      {/* Overview Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Active &amp; Upcoming</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
            {
              bookerBookings.filter((b) =>
                ['pending', 'awaiting_commission', 'confirmed', 'in_progress'].includes(b.status)
              ).length
            }
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Awaiting Commission</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
            {bookerBookings.filter((b) => b.status === 'awaiting_commission').length}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Completed Bookings</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
            {bookerBookings.filter((b) => b.status === 'completed').length}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Unread Messages</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{unreadMessagesCount}</p>
        </div>
      </div>

      {/* TAB: FIND WORKERS */}
      {activeTab === 'find' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left: Job Details & Booking Form */}
          <section className="space-y-5 rounded-lg border border-neutral-200 bg-white p-6 xl:col-span-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Create a Job Request</h2>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Enter job details, select a Kerala location and search radius, then book
                automatically or choose a worker manually.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Service Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {category === 'General Labour / Coolie Work' && (
                  <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    Covers daily-wage physical labour, carrying construction materials, shifting
                    household items, yard clearing, and general assistance.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Job Location (Kerala)
                  </label>
                  <select
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                  >
                    {KERALA_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name} ({loc.district})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Search Radius
                  </label>
                  <div className="grid grid-cols-4 gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
                    {([5, 10, 15, 20] as const).map((km) => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setSearchRadiusKm(km)}
                        className={`rounded py-1.5 font-mono text-xs font-medium tabular-nums transition-colors ${
                          searchRadiusKm === km
                            ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                            : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'
                        }`}
                      >
                        {km}km
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Address / Landmark Note
                </label>
                <input
                  type="text"
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                  placeholder="House name, street, or nearby landmark"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Duration (hrs)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={estimatedDurationHours}
                    onChange={(e) =>
                      setEstimatedDurationHours(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Job Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the work to be done..."
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Additional Details (Optional)
                </label>
                <input
                  type="text"
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="Tools available on site, parking, gate access..."
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                />
              </div>

              {/* Method B: Automatic Priority Circulation */}
              <div className="rounded-md border border-neutral-950 bg-neutral-50 p-4 dark:border-neutral-200 dark:bg-neutral-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-bold">
                      <Zap className="h-4 w-4" />
                      <span>Book the Best Worker (Automatic)</span>
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                      Uses KOOLIE&apos;s Priority Circulation System to send this request to
                      exactly one eligible worker (no simultaneous multi-worker broadcasts).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={eligibleWorkers.length === 0}
                  onClick={handleAutoBook}
                  className="mt-3 w-full rounded-md bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  {eligibleWorkers.length > 0
                    ? `Auto-Assign Best Eligible Worker (${eligibleWorkers.length} available)`
                    : 'No Eligible Workers Within Selected Criteria'}
                </button>
              </div>
            </div>
          </section>

          {/* Right: Manual Worker Selection List */}
          <section className="space-y-4 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">
                  Select a Worker Manually
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {eligibleWorkers.length} eligible for {category} within {searchRadiusKm} km of{' '}
                  {locationName} · Sorted by Priority &amp; Rating
                </p>
              </div>
              <span className="font-mono text-xs text-neutral-500 tabular-nums">
                Commission: {formatCurrency(state.adminSettings.platformCommission)} on accept
              </span>
            </div>

            {eligibleWorkers.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <Search className="mx-auto h-7 w-7 text-neutral-400" />
                <h3 className="mt-3 font-display text-base font-semibold">
                  No Eligible Workers Found
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Try increasing the search radius ({searchRadiusKm} km → 10/15/20 km), selecting a
                  nearby Kerala town, or checking another service category.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {([10, 15, 20] as const).map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setSearchRadiusKm(km)}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 font-mono text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Expand to {km} km
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {eligibleWorkers.map((item) => (
                  <div
                    key={item.worker.id}
                    className={`rounded-lg border bg-white p-5 transition-colors dark:bg-neutral-900 ${
                      item.inPriorityPool
                        ? 'border-neutral-950 dark:border-neutral-200'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-bold">
                            {item.worker.fullName}
                          </h3>
                          {item.inPriorityPool && (
                            <span className="inline-flex items-center gap-1 border border-neutral-950 bg-neutral-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:border-white dark:bg-white dark:text-neutral-950">
                              <Award className="h-3 w-3" />
                              Priority
                            </span>
                          )}
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {item.worker.workerOrigin}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600 tabular-nums dark:text-neutral-400">
                          <span className="inline-flex items-center gap-1 font-semibold text-neutral-950 dark:text-neutral-50">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {item.publicAverageRating.toFixed(1)} ({item.ratingCount} ratings)
                          </span>
                          <span>·</span>
                          <span>{item.distanceKm} km away</span>
                          <span>·</span>
                          <span>{item.worker.locationName}</span>
                          <span>·</span>
                          <span className="font-mono font-semibold text-neutral-950 dark:text-neutral-50">
                            {formatCurrency(item.worker.serviceCharge)} / job
                          </span>
                        </div>

                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Services: {item.worker.categories.join(', ')}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setProfileModalWorker({
                              worker: item.worker,
                              distanceKm: item.distanceKm,
                            })
                          }
                          className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-700 dark:hover:bg-neutral-800"
                        >
                          View Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => handleManualBook(item.worker.id)}
                          className="rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                        >
                          Select &amp; Request
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Filtered-out diagnostic disclosure */}
            {ineligibleCategoryWorkers.length > 0 && (
              <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowIneligible((v) => !v)}
                  className="flex w-full items-center justify-between px-5 py-3 text-xs font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                >
                  <span>
                    {ineligibleCategoryWorkers.length} other {category} worker(s) excluded by
                    radius, availability, schedule, or capacity rules
                  </span>
                  {showIneligible ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showIneligible && (
                  <div className="divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                    {ineligibleCategoryWorkers.map((item) => (
                      <div
                        key={item.worker.id}
                        className="flex flex-col justify-between gap-1 px-5 py-3 text-xs sm:flex-row sm:items-center"
                      >
                        <span className="font-semibold">
                          {item.worker.fullName} ({item.worker.locationName} · {item.distanceKm} km)
                        </span>
                        <span className="text-neutral-500">{item.reasons.join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB: MY BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search bookings by ID, category, worker, or location..."
                  className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                />
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('find')}
                className="rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                New Booking
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'accepted', label: 'Accepted / Commission' },
                  { id: 'confirmed', label: 'Confirmed' },
                  { id: 'in_progress', label: 'In Progress' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'rejected', label: 'Rejected' },
                  { id: 'expired', label: 'Expired' },
                  { id: 'cancelled', label: 'Cancelled' },
                  { id: 'no_show_reported', label: 'No-Show' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBookingFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    bookingFilter === tab.id
                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                      : 'border border-neutral-200 text-neutral-600 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
              <Calendar className="mx-auto h-7 w-7 text-neutral-400" />
              <p className="mt-3 text-sm font-medium">No matching bookings</p>
              <p className="mt-1 text-xs text-neutral-500">
                Create a new booking request or clear your filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((b) => {
                const canNoShow =
                  b.status === 'confirmed' &&
                  !b.noShowReported &&
                  isScheduledArrivalPassed(b.scheduledDate, b.scheduledTime, nowMs);

                const ratingOpen =
                  b.status === 'completed' &&
                  !b.rated &&
                  isRatingWindowActive(b.completedAt, nowMs);

                const ratingDaysLeft =
                  b.completedAt && ratingOpen
                    ? Math.max(
                        1,
                        Math.ceil(
                          (SEVEN_DAYS_MS - (nowMs - new Date(b.completedAt).getTime())) /
                            (24 * 60 * 60 * 1000)
                        )
                      )
                    : 0;

                return (
                  <div
                    key={b.id}
                    className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-neutral-500">
                            {b.id}
                          </span>
                          <span className="border border-neutral-950 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide dark:border-neutral-200">
                            {BOOKING_STATUS_LABELS[b.status]}
                          </span>
                          <span className="text-sm font-bold">{b.category}</span>
                        </div>

                        <p className="text-sm text-neutral-700 dark:text-neutral-300">
                          {b.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                          <span>
                            Worker:{' '}
                            <strong className="text-neutral-950 dark:text-neutral-50">
                              {b.workerName || 'Unassigned'}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            <MapPin className="mr-0.5 inline h-3.5 w-3.5" />
                            {b.locationName} ({b.distanceKm ?? '—'} km)
                          </span>
                          <span>·</span>
                          <span>
                            {formatShortDate(b.scheduledDate)} at {b.scheduledTime} (
                            {b.estimatedDurationHours}h)
                          </span>
                          <span>·</span>
                          <span>Worker Fee: {formatCurrency(b.serviceChargeSnapshot)} (Direct)</span>
                        </div>

                        {b.status === 'pending' && b.requestExpiresAt && (
                          <p className="flex items-center gap-1.5 pt-1 font-mono text-xs font-semibold text-neutral-950 tabular-nums dark:text-neutral-50">
                            <Clock className="h-3.5 w-3.5" />
                            Awaiting worker response · {formatCountdown(b.requestExpiresAt, nowMs)}{' '}
                            remaining
                          </p>
                        )}

                        {b.status === 'awaiting_commission' && (
                          <p className="pt-1 text-xs font-medium text-neutral-950 dark:text-neutral-50">
                            Worker accepted. Pay the {formatCurrency(b.commissionAmount)} platform
                            commission to confirm and unlock chat.
                          </p>
                        )}

                        {b.status === 'completed' && !b.rated && !ratingOpen && (
                          <p className="pt-1 text-xs text-neutral-500">
                            7-day rating submission window has expired.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {b.status === 'awaiting_commission' && (
                          <button
                            type="button"
                            onClick={() => setPayCommissionBooking(b)}
                            className="flex items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Pay {formatCurrency(b.commissionAmount)} Commission</span>
                          </button>
                        )}

                        {b.commissionPaid && (
                          <button
                            type="button"
                            onClick={() => {
                              setChatInitialBookingId(b.id);
                              setActiveTab('messages');
                            }}
                            className="flex items-center gap-1.5 rounded-md border border-neutral-950 px-3 py-2 text-xs font-medium hover:bg-neutral-950 hover:text-white whitespace-nowrap dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Messages</span>
                          </button>
                        )}

                        {b.status === 'completed' && !b.bookerConfirmedCompletion && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = confirmBookerCompletion(b.id);
                              onNotify(res.ok, res.message);
                            }}
                            className="flex items-center gap-1.5 rounded-md border border-neutral-950 px-3 py-2 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-white dark:hover:bg-neutral-800"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Confirm Completion</span>
                          </button>
                        )}

                        {ratingOpen && (
                          <button
                            type="button"
                            onClick={() => setRateBooking(b)}
                            className="flex items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                          >
                            <Star className="h-3.5 w-3.5" />
                            <span>Rate Worker ({ratingDaysLeft}d left)</span>
                          </button>
                        )}

                        {canNoShow && (
                          <button
                            type="button"
                            onClick={() => setNoShowBooking(b)}
                            className="flex items-center gap-1.5 rounded-md border border-neutral-400 px-3 py-2 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-600 dark:hover:bg-neutral-800"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Worker Didn&apos;t Arrive</span>
                          </button>
                        )}

                        {['rejected', 'expired', 'no_show_reported'].includes(b.status) && (
                          <button
                            type="button"
                            onClick={() => setReassignBooking(b)}
                            className="flex items-center gap-1.5 rounded-md bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 whitespace-nowrap dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            <span>Find Another Worker</span>
                          </button>
                        )}

                        {['pending', 'awaiting_commission', 'confirmed'].includes(b.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = cancelBooking(b.id);
                              onNotify(res.ok, res.message);
                            }}
                            className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-700 dark:hover:bg-neutral-800"
                          >
                            Cancel
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setDetailBookingId(b.id)}
                          className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-700 dark:hover:bg-neutral-800"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: MESSAGES */}
      {activeTab === 'messages' && (
        <MessagesView
          viewerAccountId={state.booker.accountId}
          viewerRole="booker"
          initialBookingId={chatInitialBookingId}
          onNotify={onNotify}
        />
      )}

      {/* TAB: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <NotificationsView
          accountId={state.booker.accountId}
          onOpenBooking={(bookingId) => {
            setDetailBookingId(bookingId);
          }}
        />
      )}

      {/* TAB: PROFILE */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 font-display text-lg font-bold dark:border-neutral-700">
              {state.booker.fullName.charAt(0)}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">{state.booker.fullName} — Booker</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Default Location: {state.booker.locationName}, Kerala
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const loc = getLocationByName(profileLocation);
              const res = updateBookerProfile({
                fullName: profileName.trim() || 'Rahul',
                mobile: profileMobile.trim(),
                locationName: loc.name,
                lat: loc.lat,
                lng: loc.lng,
                defaultSearchRadiusKm: profileRadius,
              });
              onNotify(res.ok, res.message);
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium">Full Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Registered Mobile Number</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={profileMobile}
                  onChange={(e) => {
                    setProfileMobile(e.target.value);
                    updateBookerProfile({ mobileVerified: false });
                  }}
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="button"
                  onClick={() => setShowOtpModal(true)}
                  className="rounded-md border border-neutral-950 px-3.5 py-2 text-xs font-medium hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                >
                  {state.booker.mobileVerified ? 'Verified (Re-verify OTP)' : 'Verify via Demo OTP'}
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                {state.booker.mobileVerified
                  ? 'Mobile verified (Prototype simulation). Hidden from public listings.'
                  : 'Pending simulated OTP verification.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Home Location</label>
                <select
                  value={profileLocation}
                  onChange={(e) => setProfileLocation(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                >
                  {KERALA_LOCATIONS.map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">Default Search Radius</label>
                <select
                  value={profileRadius}
                  onChange={(e) => setProfileRadius(Number(e.target.value) as 5 | 10 | 15 | 20)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                >
                  {[5, 10, 15, 20].map((km) => (
                    <option key={km} value={km}>
                      {km} km
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Save Booker Profile
            </button>
          </form>
        </div>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="font-display text-lg font-bold">Appearance &amp; Account Settings</h2>
            <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <div>
                <p className="text-sm font-medium">Interface Theme</p>
                <p className="text-xs text-neutral-500">
                  Strict black-and-white palette. Current: {state.theme === 'light' ? 'Light' : 'Dark'}
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
            <div className="mt-4 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <p className="font-semibold text-neutral-950 dark:text-neutral-50">
                Payment &amp; Privacy Model
              </p>
              <p className="mt-1">
                KOOLIE collects only the {formatCurrency(state.adminSettings.platformCommission)}{' '}
                platform commission per accepted booking to confirm and unlock two-way chat. You pay
                the worker&apos;s service charge directly in cash or UPI.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {profileModalWorker && (
        <WorkerPublicProfileModal
          worker={profileModalWorker.worker}
          distanceKm={profileModalWorker.distanceKm}
          selectDisabledReason={profileModalWorker.disabledReason}
          onSelectWorker={() => handleManualBook(profileModalWorker.worker.id)}
          onClose={() => setProfileModalWorker(null)}
        />
      )}

      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          role="booker"
          onOpenChat={() => {
            setChatInitialBookingId(detailBooking.id);
            setActiveTab('messages');
          }}
          onOpenPayCommission={() => setPayCommissionBooking(detailBooking)}
          onOpenPayPhoneUnlock={() => setPayPhoneUnlockBooking(detailBooking)}
          onOpenRate={() => setRateBooking(detailBooking)}
          onOpenNoShow={() => setNoShowBooking(detailBooking)}
          onOpenReassign={() => setReassignBooking(detailBooking)}
          onClose={() => setDetailBookingId(null)}
        />
      )}

      {payCommissionBooking && (
        <PaymentSimulationModal
          title="Pay Platform Commission"
          amount={payCommissionBooking.commissionAmount}
          description={`Confirm booking ${payCommissionBooking.id} (${payCommissionBooking.category}) with ${payCommissionBooking.workerName}.`}
          note={`Only the ₹${payCommissionBooking.commissionAmount} commission goes to KOOLIE. Pay ₹${payCommissionBooking.serviceChargeSnapshot} directly to ${payCommissionBooking.workerName} upon completion.`}
          onConfirm={(ok) => {
            const res = processCommissionPayment(payCommissionBooking.id, ok);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setPayCommissionBooking(null)}
        />
      )}

      {payPhoneUnlockBooking && (
        <PaymentSimulationModal
          title="Unlock Registered Phone Numbers"
          amount={10}
          description={`Reveal registered phone numbers between Rahul and ${payPhoneUnlockBooking.workerName} for booking ${payPhoneUnlockBooking.id}.`}
          onConfirm={(ok) => {
            const res = processPhoneUnlockPayment(payPhoneUnlockBooking.id, ok);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setPayPhoneUnlockBooking(null)}
        />
      )}

      {rateBooking && (
        <RateWorkerModal
          booking={rateBooking}
          onSubmit={(stars, review, tags) => {
            const res = submitRating(rateBooking.id, stars, review, tags);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setRateBooking(null)}
        />
      )}

      {noShowBooking && (
        <NoShowReportModal
          booking={noShowBooking}
          onConfirm={(notes) => {
            const res = reportWorkerNoShow(noShowBooking.id, notes);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setNoShowBooking(null)}
        />
      )}

      {reassignBooking && (
        <ReassignWorkerModal
          booking={reassignBooking}
          onAutoAssign={() => {
            const res = reassignBookingAuto(reassignBooking.id);
            onNotify(res.ok, res.message);
            return res;
          }}
          onManualAssign={(workerId) => {
            const res = reassignBookingManual(reassignBooking.id, workerId);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setReassignBooking(null)}
        />
      )}

      {showOtpModal && (
        <OtpVerificationModal
          mobile={profileMobile}
          onVerified={() => {
            updateBookerProfile({ mobile: profileMobile, mobileVerified: true });
            onNotify(true, 'Booker mobile number verified via demo OTP.');
          }}
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </div>
  );
}
