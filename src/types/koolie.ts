export const SERVICE_CATEGORIES = [
  'General Labour / Coolie Work',
  'Plumbing',
  'Electrical Work',
  'Carpentry',
  'Painting',
  'Cleaning',
  'Masonry',
  'Gardening',
  'Loading and Unloading',
  'Other Services',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'awaiting_commission'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show_reported';

export type BookingMethod = 'auto' | 'manual';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type AccountId =
  | 'booker-rahul'
  | 'worker-ramesh'
  | 'worker-suresh'
  | 'worker-akash'
  | 'worker-rahim'
  | 'worker-babu'
  | 'admin-console';

export type ThemeMode = 'light' | 'dark';

export interface LocationPoint {
  name: string;
  district: string;
  lat: number;
  lng: number;
  isPrimary?: boolean;
}

export interface SubscriptionRecord {
  id: string;
  workerId: string;
  planName: string;
  amount: number;
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'failed';
  purchasedAt: string;
}

export interface WorkerSubscription {
  status: 'none' | 'active' | 'expired';
  startDate: string | null;
  expiryDate: string | null;
  history: SubscriptionRecord[];
}

export interface WorkerProfile {
  id: string;
  accountId: AccountId;
  fullName: string;
  mobile: string;
  mobileVerified: boolean;
  locationName: string;
  lat: number;
  lng: number;
  workerOrigin: 'Local (Kerala)' | 'Migrant Worker';
  homeState: string;
  languages: string[];
  categories: ServiceCategory[];
  skills: string;
  experienceYears: number;
  serviceCharge: number; // INR per job/day
  maxWorkingRadiusKm: number;
  workingDays: DayOfWeek[];
  workingHours: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  availabilityStatus: 'open' | 'closed';
  temporaryUnavailable: boolean;
  temporaryUnavailableReason: string;
  maxConcurrentJobs: number;
  responseTimeoutMinutes: number;
  subscription: WorkerSubscription;
  // Fair circulation & penalty metrics
  internalPriorityScore: number; // starts at 100, -5 per no-show
  recentAutoAssignments: number;
  totalAutoAssignments: number;
  lastSelectedAt: string | null;
  noShowCount: number;
  noShowPenaltyPoints: number; // sum of 1.0 deductions
}

export interface BookerProfile {
  id: string;
  accountId: AccountId;
  fullName: string;
  mobile: string;
  mobileVerified: boolean;
  locationName: string;
  lat: number;
  lng: number;
  defaultSearchRadiusKm: 5 | 10 | 15 | 20;
}

export interface Booking {
  id: string;
  bookerId: string;
  bookerName: string;
  workerId: string | null;
  workerName: string | null;
  category: ServiceCategory;
  locationName: string;
  lat: number;
  lng: number;
  addressNote: string;
  searchRadiusKm: 5 | 10 | 15 | 20;
  distanceKm: number | null;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  estimatedDurationHours: number;
  description: string;
  additionalDetails: string;
  serviceChargeSnapshot: number;
  commissionAmount: number;
  bookingMethod: BookingMethod;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  requestSentAt: string | null;
  requestExpiresAt: string | null;
  acceptedAt: string | null;
  confirmedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  bookerConfirmedCompletion: boolean;
  commissionPaid: boolean;
  phoneNumbersUnlocked: boolean;
  attemptedWorkerIds: string[];
  rated: boolean;
  noShowReported: boolean;
  assignmentSource: 'manual' | 'priority_subscription' | 'priority_rating' | 'priority_both' | 'fallback_standard';
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  senderAccountId: AccountId;
  senderName: string;
  senderRole: 'booker' | 'worker';
  text: string;
  containedMaskedPhone: boolean;
  createdAt: string;
  readByOther: boolean;
}

export interface Conversation {
  bookingId: string;
  messages: ChatMessage[];
  expiredPurged: boolean;
}

export interface RatingReview {
  id: string;
  bookingId: string;
  workerId: string;
  bookerId: string;
  bookerName: string;
  category: ServiceCategory;
  stars: number; // 1 to 5
  review: string;
  feedbackTags: string[];
  createdAt: string;
}

export interface NoShowReport {
  id: string;
  bookingId: string;
  workerId: string;
  workerName: string;
  bookerId: string;
  bookerName: string;
  scheduledAt: string;
  reportedAt: string;
  notes: string;
  ratingDeducted: number;
  priorityScoreDeducted: number;
}

export interface Transaction {
  id: string;
  type: 'commission' | 'phone_unlock' | 'priority_subscription';
  amount: number;
  status: 'success' | 'failed';
  payerAccountId: AccountId;
  payerName: string;
  bookingId?: string;
  workerId?: string;
  description: string;
  createdAt: string;
}

export interface PriorityAssignmentRecord {
  id: string;
  bookingId: string;
  category: ServiceCategory;
  locationName: string;
  selectedWorkerId: string;
  selectedWorkerName: string;
  poolType: 'priority_subscription' | 'priority_rating' | 'priority_both' | 'fallback_standard';
  reason: string;
  candidateCount: number;
  workerScoreSnapshot: number;
  recentAssignmentsBefore: number;
  createdAt: string;
}

export type NotificationType =
  | 'booking_request'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'request_expired'
  | 'commission_paid'
  | 'new_message'
  | 'booking_confirmed'
  | 'work_started'
  | 'work_completed'
  | 'rating_submitted'
  | 'no_show_reported'
  | 'subscription_activated'
  | 'subscription_expired'
  | 'booking_cancelled';

export interface AppNotification {
  id: string;
  recipientAccountId: AccountId;
  type: NotificationType;
  title: string;
  message: string;
  bookingId?: string;
  read: boolean;
  createdAt: string;
}

export interface AdminSettings {
  platformCommission: number; // default 15
  prioritySubscriptionPrice: number; // 60 - 70, default 69
  priorityRatingThreshold: number; // default 4.5
}

export interface KoolieState {
  version: number;
  theme: ThemeMode;
  activeAccountId: AccountId;
  booker: BookerProfile;
  workers: WorkerProfile[];
  bookings: Booking[];
  conversations: Record<string, Conversation>;
  ratings: RatingReview[];
  noShowReports: NoShowReport[];
  transactions: Transaction[];
  priorityAssignmentHistory: PriorityAssignmentRecord[];
  notifications: AppNotification[];
  adminSettings: AdminSettings;
}
