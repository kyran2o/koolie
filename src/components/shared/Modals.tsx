import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Clock,
  CreditCard,
  MapPin,
  ShieldCheck,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import { useKoolie } from '../../context/KoolieContext';
import { Booking, WorkerProfile } from '../../types/koolie';
import {
  BOOKING_STATUS_LABELS,
  formatCountdown,
  formatCurrency,
  formatDateTime,
  formatShortDate,
} from '../../utils/formatters';
import {
  computeWorkerRatingStats,
  evaluateWorkerEligibility,
  getWorkerActiveJobsCount,
  getWorkerPriorityQualification,
  isRatingWindowActive,
  isScheduledArrivalPassed,
} from '../../utils/matching';
import { getLocationByName } from '../../data/locations';

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PaymentSimulationModal({
  title,
  amount,
  description,
  note,
  onConfirm,
  onClose,
}: {
  title: string;
  amount: number;
  description: string;
  note?: string;
  onConfirm: (simulateSuccess: boolean) => { ok: boolean; message: string };
  onClose: () => void;
}) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOutcome = (success: boolean) => {
    const res = onConfirm(success);
    if (res.ok) {
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <ModalShell
      title={title}
      subtitle="Prototype simulated checkout — no real money or external gateway"
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Amount Due</span>
            <span className="font-mono text-2xl font-bold tabular-nums">
              {formatCurrency(amount)}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{description}</p>
          {note && (
            <p className="mt-2 border-t border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              {note}
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-md border border-neutral-950 bg-neutral-100 p-3 text-xs text-neutral-950 dark:border-neutral-200 dark:bg-neutral-800 dark:text-neutral-50">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => handleOutcome(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            <CreditCard className="h-4 w-4" />
            <span className="whitespace-nowrap">
              {errorMsg ? `Retry & Pay ${formatCurrency(amount)}` : `Pay ${formatCurrency(amount)} (Success)`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleOutcome(false)}
            className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <span className="whitespace-nowrap">Simulate Failure</span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function OtpVerificationModal({
  mobile,
  onVerified,
  onClose,
}: {
  mobile: string;
  onVerified: () => void;
  onClose: () => void;
}) {
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim() === '123456') {
      onVerified();
      onClose();
    } else {
      setError('Invalid demo OTP. Enter 123456 to simulate mobile verification.');
    }
  };

  return (
    <ModalShell
      title="Mobile Verification Simulation"
      subtitle="Prototype OTP simulation — no real SMS is dispatched"
      onClose={onClose}
    >
      <form onSubmit={handleVerify} className="space-y-4">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3.5 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
          {sent ? (
            <span>
              Simulated OTP sent to <strong className="font-mono">{mobile}</strong>. Enter demo
              code <strong className="font-mono">123456</strong> below.
            </span>
          ) : (
            <span>Click resend to generate demo OTP.</span>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            6-Digit Demo OTP
          </label>
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value);
              setError(null);
            }}
            placeholder="123456"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm tracking-widest text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
          />
        </div>
        {error && <p className="text-xs text-neutral-900 underline dark:text-neutral-100">{error}</p>}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setSent(true);
              setOtp('123456');
              setError(null);
            }}
            className="text-xs font-medium underline text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            Auto-fill Demo OTP (123456)
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-300 px-3.5 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Verify Mobile
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

export function WorkerPublicProfileModal({
  worker,
  distanceKm,
  onSelectWorker,
  selectDisabledReason,
  onClose,
}: {
  worker: WorkerProfile;
  distanceKm?: number;
  onSelectWorker?: () => void;
  selectDisabledReason?: string;
  onClose: () => void;
}) {
  const { state } = useKoolie();
  const { publicAverageRating, ratingCount } = computeWorkerRatingStats(worker, state.ratings);
  const priorityInfo = getWorkerPriorityQualification(
    worker,
    state.ratings,
    state.adminSettings
  );
  const activeJobs = getWorkerActiveJobsCount(worker.id, state.bookings);
  const workerReviews = state.ratings.filter((r) => r.workerId === worker.id);

  return (
    <ModalShell
      title={worker.fullName}
      subtitle={`${worker.locationName}, Kerala · ${worker.workerOrigin}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Top Metrics Strip */}
        <div className="grid grid-cols-2 gap-3 border-b border-neutral-200 pb-5 sm:grid-cols-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Public Rating</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-lg font-bold tabular-nums">
              <Star className="h-4 w-4 fill-current" />
              {publicAverageRating.toFixed(1)}
              <span className="text-xs font-normal text-neutral-500">({ratingCount})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Service Charge</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums">
              {formatCurrency(worker.serviceCharge)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Distance / Radius</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
              {distanceKm !== undefined ? `${distanceKm} km away` : `${worker.maxWorkingRadiusKm} km max`}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Availability</p>
            <p className="mt-1 text-sm font-semibold">
              {worker.availabilityStatus === 'open' && !worker.temporaryUnavailable
                ? `Open (${activeJobs}/${worker.maxConcurrentJobs} jobs)`
                : worker.temporaryUnavailable
                ? 'Temp Unavailable'
                : 'Closed'}
            </p>
          </div>
        </div>

        {/* Priority & Origin Info */}
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
            {priorityInfo.inPriorityPool && (
              <span className="inline-flex items-center gap-1 font-semibold text-neutral-950 dark:text-neutral-50">
                <Award className="h-3.5 w-3.5" />
                Priority Worker ({priorityInfo.poolLabel})
              </span>
            )}
            <span>Experience: {worker.experienceYears} years</span>
            <span>·</span>
            <span>Languages: {worker.languages.join(', ')}</span>
            <span>·</span>
            <span>
              Hours: {worker.workingHours.start}–{worker.workingHours.end}
            </span>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Service Categories
            </h3>
            <p className="mt-1 text-sm font-medium">{worker.categories.join(' · ')}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Skills & Experience
            </h3>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{worker.skills}</p>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5" />
            Registered mobile numbers are hidden for privacy. Phone visibility can be unlocked
            only after booking confirmation via the simulated ₹10 option.
          </div>
        </div>

        {/* Verified Reviews */}
        <div>
          <h3 className="mb-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Recent Customer Reviews ({workerReviews.length})
          </h3>
          {workerReviews.length === 0 ? (
            <p className="text-xs text-neutral-500">No reviews yet.</p>
          ) : (
            <div className="max-h-52 space-y-2.5 overflow-y-auto pr-1">
              {workerReviews.slice(0, 6).map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-md border border-neutral-200 p-3 text-xs dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {rev.bookerName} · {rev.category}
                    </span>
                    <span className="flex items-center gap-1 font-mono font-semibold tabular-nums">
                      <Star className="h-3 w-3 fill-current" />
                      {rev.stars}/5
                    </span>
                  </div>
                  <p className="mt-1.5 text-neutral-600 dark:text-neutral-400">{rev.review}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Close
          </button>
          {onSelectWorker && (
            <button
              type="button"
              disabled={Boolean(selectDisabledReason)}
              onClick={() => {
                onSelectWorker();
                onClose();
              }}
              title={selectDisabledReason}
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              {selectDisabledReason ? selectDisabledReason : `Send Request to ${worker.fullName}`}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

export function RateWorkerModal({
  booking,
  onSubmit,
  onClose,
}: {
  booking: Booking;
  onSubmit: (stars: number, review: string, tags: string[]) => { ok: boolean; message: string };
  onClose: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Punctual']);
  const [error, setError] = useState<string | null>(null);

  const feedbackOptions = [
    'Punctual',
    'Clean Work',
    'Fair Pricing',
    'Skilled',
    'Clear Communication',
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onSubmit(stars, review, selectedTags);
    if (res.ok) {
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <ModalShell
      title={`Rate ${booking.workerName}`}
      subtitle={`Booking ${booking.id} · ${booking.category}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Star Rating (1 to 5)
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                className={`flex items-center gap-1 rounded-md border px-3 py-2 font-mono text-xs font-semibold transition-colors ${
                  stars >= n
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${stars >= n ? 'fill-current' : ''}`} />
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Optional Feedback Attributes
          </label>
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? 'border-neutral-950 bg-neutral-100 font-medium text-neutral-950 dark:border-white dark:bg-neutral-800 dark:text-neutral-50'
                      : 'border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Written Review
          </label>
          <textarea
            rows={3}
            value={review}
            onChange={(e) => {
              setReview(e.target.value);
              setError(null);
            }}
            placeholder="Describe work quality, punctuality, and experience..."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
          />
        </div>

        {error && <p className="text-xs font-medium underline">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Submit Rating
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function NoShowReportModal({
  booking,
  onConfirm,
  onClose,
}: {
  booking: Booking;
  onConfirm: (notes: string) => { ok: boolean; message: string };
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onConfirm(notes);
    if (res.ok) {
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <ModalShell
      title="Report Worker Didn't Arrive"
      subtitle={`Booking ${booking.id} · ${booking.workerName}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md border border-neutral-300 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
          <p className="font-semibold text-neutral-950 dark:text-neutral-50">
            Confirming a no-show report applies both penalties immediately:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Deducts 1.0 point from the worker&apos;s public average rating (min 1.0).</li>
            <li>Reduces the worker&apos;s internal Priority Matching Score by 5%.</li>
            <li>Keeps genuine customer reviews and monthly subscription status unchanged.</li>
            <li>Allows you to immediately find a replacement worker.</li>
          </ul>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Incident Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details about scheduled time and wait period..."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
          />
        </div>

        {error && <p className="text-xs font-medium underline">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Confirm No-Show Report
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ReassignWorkerModal({
  booking,
  onAutoAssign,
  onManualAssign,
  onClose,
}: {
  booking: Booking;
  onAutoAssign: () => { ok: boolean; message: string };
  onManualAssign: (workerId: string) => { ok: boolean; message: string };
  onClose: () => void;
}) {
  const { state, nowMs } = useKoolie();
  const [error, setError] = useState<string | null>(null);

  const loc = getLocationByName(booking.locationName);
  const excluded =
    booking.workerId && !booking.attemptedWorkerIds.includes(booking.workerId)
      ? [...booking.attemptedWorkerIds, booking.workerId]
      : booking.attemptedWorkerIds;

  const eligibleCandidates = state.workers
    .map((worker) =>
      evaluateWorkerEligibility({
        worker,
        category: booking.category,
        targetLat: loc.lat,
        targetLng: loc.lng,
        searchRadiusKm: booking.searchRadiusKm,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        bookings: state.bookings,
        ratings: state.ratings,
        adminSettings: state.adminSettings,
        excludedWorkerIds: excluded,
        nowMs,
      })
    )
    .filter((e) => e.eligible)
    .sort((a, b) => {
      if (a.inPriorityPool !== b.inPriorityPool) return a.inPriorityPool ? -1 : 1;
      return b.publicAverageRating - a.publicAverageRating;
    });

  return (
    <ModalShell
      title="Find Another Eligible Worker"
      subtitle={`${booking.id} · ${booking.category} in ${booking.locationName}`}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="text-sm font-semibold">Option 1 — Automatic Priority Circulation</h3>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Selects one eligible worker fairly from the Combined Priority Pool (or fallback pool),
            excluding workers who already rejected, expired, or missed this booking.
          </p>
          <button
            type="button"
            onClick={() => {
              const res = onAutoAssign();
              if (res.ok) onClose();
              else setError(res.message);
            }}
            className="mt-3 rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Auto-Find Best Worker
          </button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Option 2 — Manually Select Another Worker ({eligibleCandidates.length} available)
          </h3>
          {eligibleCandidates.length === 0 ? (
            <p className="rounded-md border border-neutral-200 p-4 text-xs text-neutral-500 dark:border-neutral-800">
              No additional eligible workers are available within {booking.searchRadiusKm} km for{' '}
              {booking.category}.
            </p>
          ) : (
            <div className="space-y-2">
              {eligibleCandidates.map((c) => (
                <div
                  key={c.worker.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{c.worker.fullName}</span>
                      {c.inPriorityPool && (
                        <span className="border border-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide dark:border-neutral-200">
                          Priority
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                      Rating {c.publicAverageRating.toFixed(1)} ({c.ratingCount}) · {c.distanceKm} km ·{' '}
                      {formatCurrency(c.worker.serviceCharge)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = onManualAssign(c.worker.id);
                      if (res.ok) onClose();
                      else setError(res.message);
                    }}
                    className="rounded-md border border-neutral-950 px-3 py-1.5 text-xs font-medium hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs font-medium underline">{error}</p>}
      </div>
    </ModalShell>
  );
}

export function BookingDetailModal({
  booking,
  role,
  onOpenChat,
  onOpenPayCommission,
  onOpenPayPhoneUnlock,
  onOpenRate,
  onOpenNoShow,
  onOpenReassign,
  onClose,
}: {
  booking: Booking;
  role: 'booker' | 'worker';
  onOpenChat?: () => void;
  onOpenPayCommission?: () => void;
  onOpenPayPhoneUnlock?: () => void;
  onOpenRate?: () => void;
  onOpenNoShow?: () => void;
  onOpenReassign?: () => void;
  onClose: () => void;
}) {
  const { state, nowMs, acceptBookingRequest, rejectBookingRequest, startWork, completeWork, confirmBookerCompletion, cancelBooking } =
    useKoolie();

  const worker = state.workers.find((w) => w.id === booking.workerId);
  const canRate =
    role === 'booker' &&
    booking.status === 'completed' &&
    !booking.rated &&
    isRatingWindowActive(booking.completedAt, nowMs);
  const canNoShow =
    role === 'booker' &&
    booking.status === 'confirmed' &&
    !booking.noShowReported &&
    isScheduledArrivalPassed(booking.scheduledDate, booking.scheduledTime, nowMs);

  return (
    <ModalShell
      title={`Booking ${booking.id}`}
      subtitle={`${booking.category} · Status: ${BOOKING_STATUS_LABELS[booking.status]}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-4 border-b border-neutral-200 pb-4 sm:grid-cols-3 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Scheduled</p>
            <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums">
              {formatShortDate(booking.scheduledDate)} · {booking.scheduledTime}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Location & Distance</p>
            <p className="mt-0.5 text-xs font-semibold">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              {booking.locationName} ({booking.distanceKm ?? '—'} km)
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Est. Duration</p>
            <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums">
              {booking.estimatedDurationHours} hrs
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Worker Charge (Direct)</p>
            <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums">
              {formatCurrency(booking.serviceChargeSnapshot)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">KOOLIE Commission</p>
            <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums">
              {formatCurrency(booking.commissionAmount)} ({booking.commissionPaid ? 'Paid' : 'Unpaid'})
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Assignment</p>
            <p className="mt-0.5 text-xs font-semibold">
              {booking.bookingMethod === 'auto' ? 'Auto Priority Circulation' : 'Manual Selection'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-500">Job Description</p>
          <p className="text-sm leading-relaxed">{booking.description}</p>
          {booking.additionalDetails && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Additional notes: {booking.additionalDetails}
            </p>
          )}
          <p className="text-xs text-neutral-500">Address note: {booking.addressNote}</p>
        </div>

        {/* Participant Contact Visibility */}
        {booking.commissionPaid && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3.5 text-xs dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  <UserCheck className="mr-1.5 inline h-3.5 w-3.5" />
                  Participant Contact Visibility
                </p>
                {booking.phoneNumbersUnlocked ? (
                  <p className="mt-1 font-mono text-neutral-800 dark:text-neutral-200">
                    Booker ({booking.bookerName}): {state.booker.mobile} · Worker (
                    {booking.workerName}): {worker?.mobile || '—'}
                  </p>
                ) : (
                  <p className="mt-1 text-neutral-500">
                    Phone numbers are hidden by default. Unlock mutually for ₹10 (prototype
                    feature).
                  </p>
                )}
              </div>
              {role === 'booker' && !booking.phoneNumbersUnlocked && onOpenPayPhoneUnlock && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPayPhoneUnlock();
                  }}
                  className="rounded-md border border-neutral-950 px-3 py-1.5 text-xs font-medium hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                >
                  Unlock Numbers (₹10)
                </button>
              )}
            </div>
          </div>
        )}

        {booking.status === 'pending' && booking.requestExpiresAt && (
          <div className="flex items-center justify-between rounded-md border border-neutral-300 px-3.5 py-2.5 text-xs dark:border-neutral-700">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5" />
              Response window remaining
            </span>
            <span className="font-mono font-bold tabular-nums">
              {formatCountdown(booking.requestExpiresAt, nowMs)}
            </span>
          </div>
        )}

        <div className="text-xs text-neutral-500">
          Created {formatDateTime(booking.createdAt)} · Last updated {formatDateTime(booking.updatedAt)}
        </div>

        {/* Contextual Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          {role === 'worker' && booking.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => {
                  rejectBookingRequest(booking.id);
                  onClose();
                }}
                className="rounded-md border border-neutral-300 px-3.5 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  acceptBookingRequest(booking.id);
                  onClose();
                }}
                className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                Accept Request
              </button>
            </>
          )}

          {role === 'worker' && booking.status === 'confirmed' && (
            <button
              type="button"
              onClick={() => {
                startWork(booking.id);
                onClose();
              }}
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
            >
              Start Work (In Progress)
            </button>
          )}

          {role === 'worker' && booking.status === 'in_progress' && (
            <button
              type="button"
              onClick={() => {
                completeWork(booking.id);
                onClose();
              }}
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
            >
              Mark Completed
            </button>
          )}

          {role === 'booker' && booking.status === 'awaiting_commission' && onOpenPayCommission && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPayCommission();
              }}
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
            >
              Pay {formatCurrency(booking.commissionAmount)} Commission
            </button>
          )}

          {role === 'booker' &&
            booking.status === 'completed' &&
            !booking.bookerConfirmedCompletion && (
              <button
                type="button"
                onClick={() => {
                  confirmBookerCompletion(booking.id);
                  onClose();
                }}
                className="rounded-md border border-neutral-950 px-3.5 py-2 text-xs font-medium dark:border-white"
              >
                Confirm Completion
              </button>
            )}

          {canRate && onOpenRate && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRate();
              }}
              className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-neutral-950"
            >
              Rate Worker
            </button>
          )}

          {canNoShow && onOpenNoShow && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNoShow();
              }}
              className="rounded-md border border-neutral-400 px-3.5 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
            >
              Worker Didn&apos;t Arrive
            </button>
          )}

          {role === 'booker' &&
            ['rejected', 'expired', 'no_show_reported'].includes(booking.status) &&
            onOpenReassign && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReassign();
                }}
                className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-neutral-950"
              >
                Find Another Worker
              </button>
            )}

          {role === 'booker' &&
            ['pending', 'awaiting_commission', 'confirmed'].includes(booking.status) && (
              <button
                type="button"
                onClick={() => {
                  cancelBooking(booking.id);
                  onClose();
                }}
                className="rounded-md border border-neutral-300 px-3.5 py-2 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Cancel Booking
              </button>
            )}

          {booking.commissionPaid && onOpenChat && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChat();
              }}
              className="rounded-md border border-neutral-950 px-4 py-2 text-xs font-medium hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
            >
              Open Chat
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
