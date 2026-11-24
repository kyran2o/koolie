import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  Save,
  Sliders,
} from 'lucide-react';
import { useKoolie } from '../../context/KoolieContext';
import {
  BOOKING_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  formatShortDate,
} from '../../utils/formatters';
import {
  computeWorkerRatingStats,
  getWorkerActiveJobsCount,
  getWorkerPriorityQualification,
} from '../../utils/matching';

export type AdminTab =
  | 'overview'
  | 'workers'
  | 'bookings'
  | 'transactions'
  | 'noshows'
  | 'priority_log';

export function AdminConsole({
  activeTab,
  setActiveTab,
  onNotify,
}: {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  onNotify: (ok: boolean, text: string) => void;
}) {
  const {
    state,
    nowMs,
    updateAdminSettings,
    expireWorkerSubscriptionNow,
    resetDemoData,
  } = useKoolie();

  const [commissionInput, setCommissionInput] = useState(
    String(state.adminSettings.platformCommission)
  );
  const [subPriceInput, setSubPriceInput] = useState(
    String(state.adminSettings.prioritySubscriptionPrice)
  );
  const [thresholdInput, setThresholdInput] = useState(
    String(state.adminSettings.priorityRatingThreshold)
  );
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setCommissionInput(String(state.adminSettings.platformCommission));
    setSubPriceInput(String(state.adminSettings.prioritySubscriptionPrice));
    setThresholdInput(String(state.adminSettings.priorityRatingThreshold));
  }, [state.adminSettings]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateAdminSettings({
      platformCommission: Number(commissionInput),
      prioritySubscriptionPrice: Number(subPriceInput),
      priorityRatingThreshold: Number(thresholdInput),
    });
    onNotify(res.ok, res.message);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar for mobile/quick switching */}
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        {(
          [
            { id: 'overview', label: 'Settings & Overview' },
            { id: 'workers', label: `Workers (${state.workers.length})` },
            { id: 'bookings', label: `Bookings (${state.bookings.length})` },
            { id: 'transactions', label: `Transactions (${state.transactions.length})` },
            { id: 'noshows', label: `No-Shows (${state.noShowReports.length})` },
            { id: 'priority_log', label: `Priority Log (${state.priorityAssignmentHistory.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                : 'border border-neutral-200 text-neutral-600 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW & SETTINGS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveSettings}
            className="space-y-5 rounded-lg border border-neutral-200 bg-white p-6 lg:col-span-7 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
              <Sliders className="h-4 w-4" />
              <h2 className="font-display text-lg font-bold">Platform Rules &amp; Pricing</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  Platform Commission (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={commissionInput}
                  onChange={(e) => setCommissionInput(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <p className="mt-1 text-[11px] text-neutral-500">Default: ₹15 per booking</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  Priority Subscription (₹60–₹70)
                </label>
                <input
                  type="number"
                  min={60}
                  max={70}
                  value={subPriceInput}
                  onChange={(e) => setSubPriceInput(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <p className="mt-1 text-[11px] text-neutral-500">Default: ₹69 / month</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  Priority Rating Threshold
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={3.0}
                  max={5.0}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <p className="mt-1 text-[11px] text-neutral-500">Default: 4.5 stars</p>
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Platform Settings</span>
            </button>
          </form>

          <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 lg:col-span-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="font-display text-lg font-bold">Demo Data Management</h2>
            <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              All KOOLIE accounts, bookings, conversations, transactions, and Priority Pool metrics
              are persisted locally in browser storage. Resetting restores the original seed state
              (Rahul and the 5 demo workers).
            </p>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 rounded-md border border-neutral-950 px-4 py-2 text-xs font-semibold hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Demo Data</span>
              </button>
            ) : (
              <div className="space-y-3 rounded-md border border-neutral-950 bg-neutral-50 p-4 dark:border-white dark:bg-neutral-950">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Confirm resetting all demo data to initial state?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetDemoData();
                      setConfirmReset(false);
                      onNotify(true, 'Demo data restored to original seed state.');
                    }}
                    className="rounded-md bg-neutral-950 px-3.5 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
                  >
                    Yes, Reset Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-md border border-neutral-300 px-3.5 py-1.5 text-xs font-medium dark:border-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: WORKERS */}
      {activeTab === 'workers' && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Worker</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Genuine Avg</th>
                  <th className="px-4 py-3 font-medium">No-Show Penalty</th>
                  <th className="px-4 py-3 font-medium">Public Rating</th>
                  <th className="px-4 py-3 font-medium">Subscription</th>
                  <th className="px-4 py-3 font-medium">Priority Pool</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Auto Assigns</th>
                  <th className="px-4 py-3 font-medium">Capacity</th>
                  <th className="px-4 py-3 font-medium">Demo Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 tabular-nums dark:divide-neutral-800">
                {state.workers.map((w) => {
                  const stats = computeWorkerRatingStats(w, state.ratings);
                  const pri = getWorkerPriorityQualification(
                    w,
                    state.ratings,
                    state.adminSettings,
                    nowMs
                  );
                  const active = getWorkerActiveJobsCount(w.id, state.bookings);
                  return (
                    <tr key={w.id}>
                      <td className="px-4 py-3 font-semibold">
                        {w.fullName}
                        <span className="block text-[11px] font-normal text-neutral-500">
                          {w.workerOrigin}
                        </span>
                      </td>
                      <td className="px-4 py-3">{w.locationName}</td>
                      <td className="px-4 py-3 font-mono">{stats.genuineAverageRating.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono">-{w.noShowPenaltyPoints.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono font-bold">
                        {stats.publicAverageRating.toFixed(1)} ({stats.ratingCount})
                      </td>
                      <td className="px-4 py-3 uppercase">{w.subscription.status}</td>
                      <td className="px-4 py-3">{pri.poolLabel}</td>
                      <td className="px-4 py-3 font-mono">{w.internalPriorityScore}%</td>
                      <td className="px-4 py-3 font-mono">
                        {w.recentAutoAssignments} recent / {w.totalAutoAssignments} total
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {active}/{w.maxConcurrentJobs} ({w.availabilityStatus})
                      </td>
                      <td className="px-4 py-3">
                        {w.subscription.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = expireWorkerSubscriptionNow(w.id);
                              onNotify(res.ok, res.message);
                            }}
                            className="rounded border border-neutral-400 px-2.5 py-1 text-[11px] font-medium hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-600 dark:hover:bg-neutral-800"
                          >
                            Expire Sub Now
                          </button>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Booker</th>
                  <th className="px-4 py-3 font-medium">Worker</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Scheduled</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Commission</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 tabular-nums dark:divide-neutral-800">
                {state.bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{b.id}</td>
                    <td className="px-4 py-3">{b.bookerName}</td>
                    <td className="px-4 py-3">{b.workerName || '—'}</td>
                    <td className="px-4 py-3">{b.category}</td>
                    <td className="px-4 py-3">
                      {b.locationName} ({b.distanceKm ?? '—'} km)
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatShortDate(b.scheduledDate)} {b.scheduledTime}
                    </td>
                    <td className="px-4 py-3 capitalize">{b.bookingMethod}</td>
                    <td className="px-4 py-3 font-mono">
                      {formatCurrency(b.commissionAmount)} ({b.commissionPaid ? 'Paid' : 'Unpaid'})
                    </td>
                    <td className="px-4 py-3 font-semibold uppercase">
                      {BOOKING_STATUS_LABELS[b.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Transaction ID</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Payer</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 tabular-nums dark:divide-neutral-800">
                {state.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-mono">{t.id}</td>
                    <td className="px-4 py-3 uppercase">{t.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3">{t.payerName}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(t.amount)}</td>
                    <td className="px-4 py-3 font-semibold uppercase">{t.status}</td>
                    <td className="px-4 py-3">{t.description}</td>
                    <td className="px-4 py-3 font-mono">{formatDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: NO-SHOWS */}
      {activeTab === 'noshows' && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          {state.noShowReports.length === 0 ? (
            <p className="p-8 text-center text-xs text-neutral-500">
              No no-show incidents reported yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Report ID</th>
                    <th className="px-4 py-3 font-medium">Booking</th>
                    <th className="px-4 py-3 font-medium">Worker</th>
                    <th className="px-4 py-3 font-medium">Rating Penalty</th>
                    <th className="px-4 py-3 font-medium">Priority Score Penalty</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                    <th className="px-4 py-3 font-medium">Reported At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 tabular-nums dark:divide-neutral-800">
                  {state.noShowReports.map((ns) => (
                    <tr key={ns.id}>
                      <td className="px-4 py-3 font-mono">{ns.id}</td>
                      <td className="px-4 py-3 font-mono">{ns.bookingId}</td>
                      <td className="px-4 py-3 font-semibold">{ns.workerName}</td>
                      <td className="px-4 py-3 font-mono">-{ns.ratingDeducted.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono">-{ns.priorityScoreDeducted}%</td>
                      <td className="px-4 py-3">{ns.notes}</td>
                      <td className="px-4 py-3 font-mono">{formatDateTime(ns.reportedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: PRIORITY LOG */}
      {activeTab === 'priority_log' && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          {state.priorityAssignmentHistory.length === 0 ? (
            <p className="p-8 text-center text-xs text-neutral-500">
              No automatic Priority Circulation assignments recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Booking</th>
                    <th className="px-4 py-3 font-medium">Selected Worker</th>
                    <th className="px-4 py-3 font-medium">Pool Route</th>
                    <th className="px-4 py-3 font-medium">Candidates</th>
                    <th className="px-4 py-3 font-medium">Score / Prior Auto</th>
                    <th className="px-4 py-3 font-medium">Selection Reason</th>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 tabular-nums dark:divide-neutral-800">
                  {state.priorityAssignmentHistory.map((pa) => (
                    <tr key={pa.id}>
                      <td className="px-4 py-3 font-mono font-semibold">
                        {pa.bookingId}
                        <span className="block font-sans text-[11px] font-normal text-neutral-500">
                          {pa.category} · {pa.locationName}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{pa.selectedWorkerName}</td>
                      <td className="px-4 py-3 uppercase">{pa.poolType.replace('_', ' ')}</td>
                      <td className="px-4 py-3 font-mono">{pa.candidateCount}</td>
                      <td className="px-4 py-3 font-mono">
                        {pa.workerScoreSnapshot}% / {pa.recentAssignmentsBefore} prior
                      </td>
                      <td className="max-w-sm px-4 py-3 leading-relaxed">{pa.reason}</td>
                      <td className="px-4 py-3 font-mono">{formatDateTime(pa.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
