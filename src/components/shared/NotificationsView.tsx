import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useKoolie } from '../../context/KoolieContext';
import { AccountId } from '../../types/koolie';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

export function NotificationsView({
  accountId,
  onOpenBooking,
}: {
  accountId: AccountId;
  onOpenBooking?: (bookingId: string) => void;
}) {
  const { state, markNotificationRead, markAllNotificationsRead } = useKoolie();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const userNotifs = state.notifications.filter((n) => n.recipientAccountId === accountId);
  const unreadCount = userNotifs.filter((n) => !n.read).length;
  const displayed = filter === 'unread' ? userNotifs.filter((n) => !n.read) : userNotifs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                : 'border border-neutral-200 text-neutral-600 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            All ({userNotifs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                : 'border border-neutral-200 text-neutral-600 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllNotificationsRead(accountId)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <Bell className="mx-auto h-7 w-7 text-neutral-400" />
          <p className="mt-3 text-sm font-medium">No notifications to display</p>
          <p className="mt-1 text-xs text-neutral-500">
            Booking requests, status changes, payments, and messages generate notifications here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {displayed.map((notif) => (
            <div
              key={notif.id}
              className={`flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center ${
                !notif.read ? 'bg-neutral-50 dark:bg-neutral-950/60' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  {!notif.read && (
                    <span className="border border-neutral-950 px-1.5 py-0.5 text-[10px] font-bold uppercase dark:border-white">
                      Unread
                    </span>
                  )}
                  <span className="font-semibold text-sm">{notif.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {notif.message}
                </p>
                <p className="font-mono text-[11px] text-neutral-500 tabular-nums">
                  {formatRelativeTime(notif.createdAt)} · {formatDateTime(notif.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {notif.bookingId && onOpenBooking && (
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationRead(notif.id);
                      onOpenBooking(notif.bookingId!);
                    }}
                    className="rounded-md border border-neutral-950 px-3 py-1.5 text-xs font-medium hover:bg-neutral-950 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-950"
                  >
                    View Booking
                  </button>
                )}
                {!notif.read && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(notif.id)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
