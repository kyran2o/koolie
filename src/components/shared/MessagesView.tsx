import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Lock,
  MessageSquare,
  Phone,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useKoolie } from '../../context/KoolieContext';
import { AccountId, Booking } from '../../types/koolie';
import {
  BOOKING_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
} from '../../utils/formatters';
import {
  detectPhoneNumbers,
  isMessageRetentionExpired,
  SEVEN_DAYS_MS,
} from '../../utils/matching';
import { PaymentSimulationModal } from './Modals';

export function MessagesView({
  viewerAccountId,
  viewerRole,
  initialBookingId,
  onNotify,
}: {
  viewerAccountId: AccountId;
  viewerRole: 'booker' | 'worker';
  initialBookingId?: string | null;
  onNotify: (ok: boolean, text: string) => void;
}) {
  const {
    state,
    nowMs,
    sendMessage,
    markConversationRead,
    processCommissionPayment,
    processPhoneUnlockPayment,
  } = useKoolie();

  const eligibleBookings = useMemo(() => {
    return state.bookings.filter((b) => {
      const belongs =
        viewerRole === 'booker'
          ? b.bookerId === state.booker.id
          : state.workers.find((w) => w.accountId === viewerAccountId)?.id === b.workerId;
      if (!belongs) return false;
      return ['awaiting_commission', 'accepted', 'confirmed', 'in_progress', 'completed'].includes(
        b.status
      );
    });
  }, [state.bookings, state.booker.id, state.workers, viewerAccountId, viewerRole]);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    initialBookingId || eligibleBookings[0]?.id || null
  );
  const [draft, setDraft] = useState('');
  const [payCommissionFor, setPayCommissionFor] = useState<Booking | null>(null);
  const [payPhoneUnlockFor, setPayPhoneUnlockFor] = useState<Booking | null>(null);

  useEffect(() => {
    if (initialBookingId && eligibleBookings.some((b) => b.id === initialBookingId)) {
      setSelectedBookingId(initialBookingId);
    } else if (
      (!selectedBookingId || !eligibleBookings.some((b) => b.id === selectedBookingId)) &&
      eligibleBookings.length > 0
    ) {
      setSelectedBookingId(eligibleBookings[0].id);
    }
  }, [initialBookingId, eligibleBookings, selectedBookingId]);

  const activeBooking = eligibleBookings.find((b) => b.id === selectedBookingId) || null;
  const activeConversation = activeBooking ? state.conversations[activeBooking.id] : undefined;

  useEffect(() => {
    if (activeBooking && activeBooking.commissionPaid) {
      markConversationRead(activeBooking.id, viewerAccountId);
    }
  }, [activeBooking, viewerAccountId, markConversationRead, activeConversation?.messages.length]);

  const isExpired =
    activeBooking?.status === 'completed' &&
    isMessageRetentionExpired(activeBooking.completedAt, nowMs);

  const daysRemaining = useMemo(() => {
    if (!activeBooking || activeBooking.status !== 'completed' || !activeBooking.completedAt) {
      return null;
    }
    const diff =
      SEVEN_DAYS_MS - (nowMs - new Date(activeBooking.completedAt).getTime());
    if (diff <= 0) return 0;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  }, [activeBooking, nowMs]);

  const draftHasPhone = detectPhoneNumbers(draft);
  const workerForActive = activeBooking
    ? state.workers.find((w) => w.id === activeBooking.workerId)
    : undefined;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;
    const res = sendMessage(activeBooking.id, draft);
    if (res.ok) {
      setDraft('');
      if (res.message.includes('masked')) {
        onNotify(true, res.message);
      }
    } else {
      onNotify(false, res.message);
    }
  };

  if (eligibleBookings.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <MessageSquare className="mx-auto h-8 w-8 text-neutral-400" />
        <h3 className="mt-3 font-display text-base font-semibold">No Conversations Yet</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Conversations appear once a worker accepts a booking and the ₹15 platform commission is
          paid.
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-h-[540px] grid-cols-1 overflow-hidden rounded-lg border border-neutral-200 bg-white lg:grid-cols-12 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Left: Booking Conversation List */}
      <div className="border-b border-neutral-200 lg:col-span-4 lg:border-b-0 lg:border-r dark:border-neutral-800">
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Booking Conversations ({eligibleBookings.length})
          </h2>
        </div>
        <div className="max-h-[300px] divide-y divide-neutral-200 overflow-y-auto lg:max-h-[520px] dark:divide-neutral-800">
          {eligibleBookings.map((b) => {
            const conv = state.conversations[b.id];
            const unread = conv
              ? conv.messages.filter(
                  (m) => m.senderAccountId !== viewerAccountId && !m.readByOther
                ).length
              : 0;
            const otherName =
              viewerRole === 'booker' ? b.workerName || 'Worker' : b.bookerName;
            const isSelected = b.id === activeBooking?.id;
            const expired =
              b.status === 'completed' && isMessageRetentionExpired(b.completedAt, nowMs);

            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBookingId(b.id)}
                className={`w-full px-4 py-3.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-neutral-100 dark:bg-neutral-800'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{otherName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!b.commissionPaid && <Lock className="h-3.5 w-3.5 text-neutral-500" />}
                    {unread > 0 && (
                      <span className="rounded bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums dark:bg-white dark:text-neutral-950">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-600 dark:text-neutral-400">
                  {b.id} · {b.category}
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {!b.commissionPaid
                    ? 'Locked — awaiting commission'
                    : expired
                    ? 'Messages expired (7d)'
                    : BOOKING_STATUS_LABELS[b.status]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Active Thread */}
      <div className="flex flex-col lg:col-span-8">
        {!activeBooking ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
            Select a booking conversation to view messages.
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-bold">
                  {viewerRole === 'booker'
                    ? `${activeBooking.workerName} (Worker)`
                    : `${activeBooking.bookerName} (Booker)`}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {activeBooking.id} · {activeBooking.category} ·{' '}
                  {BOOKING_STATUS_LABELS[activeBooking.status]}
                  {daysRemaining !== null && !isExpired && ` · Messages retained ${daysRemaining}d`}
                </p>
              </div>

              {activeBooking.commissionPaid && (
                <div>
                  {activeBooking.phoneNumbersUnlocked ? (
                    <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950">
                      <Phone className="h-3.5 w-3.5" />
                      <span>
                        {viewerRole === 'booker'
                          ? `${activeBooking.workerName}: ${workerForActive?.mobile || '—'}`
                          : `${activeBooking.bookerName}: ${state.booker.mobile}`}
                      </span>
                    </div>
                  ) : viewerRole === 'booker' ? (
                    <button
                      type="button"
                      onClick={() => setPayPhoneUnlockFor(activeBooking)}
                      className="flex items-center gap-1.5 rounded-md border border-neutral-950 px-3 py-1.5 text-xs font-medium hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span className="whitespace-nowrap">Unlock Phone Numbers (₹10)</span>
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      Phone numbers private (Booker can unlock for ₹10)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Locked State before ₹15 commission */}
            {!activeBooking.commissionPaid ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700">
                  <Lock className="h-5 w-5" />
                </div>
                <h4 className="mt-4 font-display text-base font-bold">Chat Locked</h4>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Two-way messaging unlocks immediately after the booker pays the{' '}
                  {formatCurrency(activeBooking.commissionAmount)} KOOLIE platform commission. The
                  worker&apos;s {formatCurrency(activeBooking.serviceChargeSnapshot)} service charge
                  is paid directly between booker and worker.
                </p>
                {viewerRole === 'booker' && (
                  <button
                    type="button"
                    onClick={() => setPayCommissionFor(activeBooking)}
                    className="mt-5 rounded-md bg-neutral-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                  >
                    Pay {formatCurrency(activeBooking.commissionAmount)} Commission &amp; Unlock Chat
                  </button>
                )}
              </div>
            ) : isExpired ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <ShieldAlert className="h-8 w-8 text-neutral-500" />
                <h4 className="mt-3 font-display text-base font-bold">
                  Conversation Expired (7-Day Retention Policy)
                </h4>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Completed on {formatDateTime(activeBooking.completedAt)}. Message contents are
                  retained for 7 days after job completion and have now been permanently cleared
                  from local browser storage.
                </p>
              </div>
            ) : (
              <>
                {/* Message Thread */}
                <div className="flex-1 space-y-3 overflow-y-auto p-5 max-h-[360px]">
                  {(!activeConversation || activeConversation.messages.length === 0) && (
                    <p className="py-10 text-center text-xs text-neutral-500">
                      Chat is unlocked. Coordinate arrival time and site directions here.
                    </p>
                  )}
                  {activeConversation?.messages.map((msg) => {
                    const isMine = msg.senderAccountId === viewerAccountId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-lg border px-3.5 py-2.5 text-sm ${
                            isMine
                              ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                              : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50'
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px] opacity-75">
                            <span className="font-semibold">{msg.senderName}</span>
                            <span>·</span>
                            <span className="capitalize">{msg.senderRole}</span>
                          </div>
                          <p className="leading-relaxed">{msg.text}</p>
                          {msg.containedMaskedPhone && (
                            <p className="mt-1.5 border-t border-current/20 pt-1 text-[10px] opacity-80">
                              Phone digits masked for prototype privacy. Unlock phone visibility for
                              ₹10 if needed.
                            </p>
                          )}
                        </div>
                        <span className="mt-1 font-mono text-[10px] text-neutral-500 tabular-nums">
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Phone Detection Warning */}
                {draftHasPhone && !activeBooking.phoneNumbersUnlocked && (
                  <div className="mx-5 mb-2 flex items-start gap-2 rounded-md border border-neutral-950 bg-neutral-100 px-3 py-2 text-xs text-neutral-950 dark:border-neutral-200 dark:bg-neutral-800 dark:text-neutral-50">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Prototype privacy check: Phone numbers are masked in chat unless phone sharing
                      (₹10) is unlocked.
                    </span>
                  </div>
                )}

                {/* Composer */}
                <form
                  onSubmit={handleSend}
                  className="flex items-center gap-2 border-t border-neutral-200 p-3.5 dark:border-neutral-800"
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-950 focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-white"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="flex items-center gap-1.5 rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>

      {payCommissionFor && (
        <PaymentSimulationModal
          title="Pay Platform Commission"
          amount={payCommissionFor.commissionAmount}
          description={`Booking ${payCommissionFor.id} · ${payCommissionFor.category} with ${payCommissionFor.workerName}`}
          note={`This ₹${payCommissionFor.commissionAmount} platform commission goes to KOOLIE to confirm the booking and unlock chat. The worker's ₹${payCommissionFor.serviceChargeSnapshot} service charge is paid directly to the worker.`}
          onConfirm={(ok) => {
            const res = processCommissionPayment(payCommissionFor.id, ok);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setPayCommissionFor(null)}
        />
      )}

      {payPhoneUnlockFor && (
        <PaymentSimulationModal
          title="Unlock Registered Phone Numbers"
          amount={10}
          description={`Mutually reveal registered mobile numbers for ${payPhoneUnlockFor.id} (${payPhoneUnlockFor.bookerName} & ${payPhoneUnlockFor.workerName}).`}
          note="Prototype privacy feature: only the booker and assigned worker for this booking can view the revealed numbers."
          onConfirm={(ok) => {
            const res = processPhoneUnlockPayment(payPhoneUnlockFor.id, ok);
            onNotify(res.ok, res.message);
            return res;
          }}
          onClose={() => setPayPhoneUnlockFor(null)}
        />
      )}
    </div>
  );
}
