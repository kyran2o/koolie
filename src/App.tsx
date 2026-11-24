import React, { useMemo, useState } from 'react';
import {
  Award,
  Bell,
  Briefcase,
  Calendar,
  ChevronDown,
  Inbox,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import { KoolieProvider, useKoolie } from './context/KoolieContext';
import { AccountId } from './types/koolie';
import { BookerDashboard, BookerTab } from './components/booker/BookerDashboard';
import { WorkerDashboard, WorkerTab } from './components/worker/WorkerDashboard';
import { AdminConsole, AdminTab } from './components/admin/AdminConsole';
import { ToastBanner, ToastMessage } from './components/shared/ToastBanner';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function KoolieWorkspace() {
  const { state, switchAccount, toggleTheme } = useKoolie();
  const [bookerTab, setBookerTab] = useState<BookerTab>('find');
  const [workerTab, setWorkerTab] = useState<WorkerTab>('requests');
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = (ok: boolean, text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToast({ id, ok, text });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  const isBooker = state.activeAccountId === 'booker-rahul';
  const isAdmin = state.activeAccountId === 'admin-console';
  const activeWorker = !isBooker && !isAdmin
    ? state.workers.find((w) => w.accountId === state.activeAccountId) || state.workers[0]
    : null;

  const unreadNotifs = useMemo(
    () =>
      state.notifications.filter(
        (n) => n.recipientAccountId === state.activeAccountId && !n.read
      ).length,
    [state.notifications, state.activeAccountId]
  );

  const unreadChats = useMemo(() => {
    if (isAdmin) return 0;
    return state.bookings.reduce((sum, b) => {
      const belongs = isBooker
        ? b.bookerId === state.booker.id
        : activeWorker?.id === b.workerId;
      if (!belongs || !b.commissionPaid) return sum;
      const conv = state.conversations[b.id];
      if (!conv) return sum;
      return (
        sum +
        conv.messages.filter(
          (m) => m.senderAccountId !== state.activeAccountId && !m.readByOther
        ).length
      );
    }, 0);
  }, [isAdmin, isBooker, activeWorker, state.bookings, state.conversations, state.booker.id, state.activeAccountId]);

  const incomingRequestsCount = useMemo(() => {
    if (!activeWorker) return 0;
    return state.bookings.filter(
      (b) => b.workerId === activeWorker.id && b.status === 'pending'
    ).length;
  }, [activeWorker, state.bookings]);

  const navItems: NavItem[] = useMemo(() => {
    if (isBooker) {
      return [
        { id: 'find', label: 'Find Workers', icon: Search },
        { id: 'bookings', label: 'My Bookings', icon: Calendar },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadChats },
        { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
    }
    if (activeWorker) {
      return [
        {
          id: 'requests',
          label: 'Incoming Requests',
          icon: Inbox,
          badge: incomingRequestsCount,
        },
        { id: 'jobs', label: 'My Jobs', icon: Briefcase },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadChats },
        { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
        { id: 'subscription', label: 'Priority Plan', icon: Award },
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
    }
    return [
      { id: 'overview', label: 'Overview & Settings', icon: Settings },
      { id: 'workers', label: 'Workers Directory', icon: Users },
      { id: 'bookings', label: 'Booking History', icon: Calendar },
      { id: 'transactions', label: 'Transactions', icon: Briefcase },
      { id: 'noshows', label: 'No-Show Reports', icon: Shield },
      { id: 'priority_log', label: 'Priority Circulation Log', icon: Award },
    ];
  }, [isBooker, activeWorker, unreadChats, unreadNotifs, incomingRequestsCount]);

  const currentTabId = isBooker ? bookerTab : activeWorker ? workerTab : adminTab;
  const currentTabLabel =
    navItems.find((item) => item.id === currentTabId)?.label || 'Dashboard';

  const handleSelectNav = (id: string) => {
    if (isBooker) setBookerTab(id as BookerTab);
    else if (activeWorker) setWorkerTab(id as WorkerTab);
    else setAdminTab(id as AdminTab);
    setMobileMenuOpen(false);
  };

  const activeAccountDisplay = isBooker
    ? `${state.booker.fullName} — Booker`
    : activeWorker
    ? `${activeWorker.fullName} — Worker`
    : 'Admin & Demo Controls';

  const accountOptions: { id: AccountId; label: string; sub: string }[] = [
    {
      id: 'booker-rahul',
      label: `${state.booker.fullName} — Booker`,
      sub: `${state.booker.locationName}, Kerala`,
    },
    ...state.workers.map((w) => ({
      id: w.accountId,
      label: `${w.fullName} — Worker`,
      sub: `${w.categories[0]} · ${w.locationName}`,
    })),
    {
      id: 'admin-console',
      label: 'Admin & Demo Controls',
      sub: 'Platform rules & audit logs',
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex h-16 items-center border-b border-neutral-200 px-6 dark:border-neutral-800">
            <span className="font-display text-xl font-extrabold tracking-tight whitespace-nowrap">
              KOOLIE
            </span>
          </div>

          <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              Active Workspace
            </p>
            <p className="mt-1 truncate text-sm font-bold">{activeAccountDisplay}</p>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === currentTabId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
                        isActive
                          ? 'bg-white text-neutral-950 dark:bg-neutral-950 dark:text-white'
                          : 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-neutral-200 p-4 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <p className="font-semibold text-neutral-950 dark:text-neutral-50">
              KOOLIE Static Prototype
            </p>
            <p className="mt-0.5">All demo data is saved in your browser&apos;s local storage.</p>
          </div>
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative z-50 flex w-72 max-w-[85vw] flex-col bg-white dark:bg-neutral-900">
              <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-5 dark:border-neutral-800">
                <span className="font-display text-lg font-extrabold tracking-tight">KOOLIE</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-md p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === currentTabId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                        isActive
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="font-mono text-xs font-bold tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Header */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 sm:px-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                className="rounded-md border border-neutral-200 p-2 hover:bg-neutral-100 lg:hidden dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <Menu className="h-4 w-4" />
              </button>
              <span className="font-display text-base font-extrabold tracking-tight lg:hidden">
                KOOLIE
              </span>
              <span className="hidden text-neutral-300 lg:hidden dark:text-neutral-700">/</span>
              <h1 className="truncate font-display text-sm font-bold sm:text-base">
                {currentTabLabel}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Demo Account Switcher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSwitcherOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-md border border-neutral-950 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-100 whitespace-nowrap dark:border-white dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
                >
                  <span className="max-w-[140px] truncate sm:max-w-none">
                    {activeAccountDisplay}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </button>

                {switcherOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setSwitcherOpen(false)}
                    />
                    <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="border-b border-neutral-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800">
                        Demo Account Switcher
                      </div>
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {accountOptions.map((opt) => {
                          const selected = opt.id === state.activeAccountId;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                switchAccount(opt.id);
                                setSwitcherOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition-colors ${
                                selected
                                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{opt.label}</p>
                                <p
                                  className={`text-[11px] ${
                                    selected
                                      ? 'opacity-80'
                                      : 'text-neutral-500 dark:text-neutral-400'
                                  }`}
                                >
                                  {opt.sub}
                                </p>
                              </div>
                              {selected && (
                                <span className="font-mono text-[10px] uppercase">Active</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Light / Dark Theme Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle light or dark theme"
                className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-100 whitespace-nowrap dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
              >
                {state.theme === 'light' ? (
                  <>
                    <Moon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Main Content Container */}
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
            {isBooker && (
              <BookerDashboard
                activeTab={bookerTab}
                setActiveTab={setBookerTab}
                onNotify={notify}
              />
            )}
            {activeWorker && (
              <WorkerDashboard
                worker={activeWorker}
                activeTab={workerTab}
                setActiveTab={setWorkerTab}
                onNotify={notify}
              />
            )}
            {isAdmin && (
              <AdminConsole
                activeTab={adminTab}
                setActiveTab={setAdminTab}
                onNotify={notify}
              />
            )}
          </main>
        </div>
      </div>

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export default function App() {
  return (
    <KoolieProvider>
      <KoolieWorkspace />
    </KoolieProvider>
  );
}
