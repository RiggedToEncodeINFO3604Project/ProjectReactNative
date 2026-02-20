// ======================================================================
// = TypeScript types for the Scheduling Service.                       =
// =  These types correspond to the Pydantic models in the backend.     =
// ======================================================================

// User roles enum
export type UserRole = "Customer" | "Provider";

// User types
export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  lastLogin?: Date;
}

export interface UserCreate {
  email: string;
  password: string;
  role: UserRole;
}

export interface UserInDB extends User {
  password: string;
}

// Token response from login
export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
}

// Customer types
export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone: string;
}

export interface CustomerCreate {
  name: string;
  phone: string;
  userId?: string;
}

// Provider types
export interface Provider {
  id: string;
  userId: string;
  providerName: string;
  businessName: string;
  bio: string;
  providerAddress: string;
  isActive: boolean;
}

export interface ProviderCreate {
  providerName: string;
  businessName: string;
  bio: string;
  providerAddress: string;
  isActive?: boolean;
  userId?: string;
}

// Service types
export interface Service {
  id: string;
  provider_id: string;
  name: string;
  description: string;
  price: number;
}

export interface ServiceCreate {
  name: string;
  description: string;
  price: number;
  providerId?: string;
}

// Availability types
export interface TimeSlot {
  start_time: string; // Format: "HH:MM"
  end_time: string; // Format: "HH:MM"
  session_duration: number; // Duration in minutes
}

export interface DayAvailability {
  day_of_week: number; // 0=Monday, 6=Sunday
  time_slots: TimeSlot[];
}

export interface AvailabilitySchedule {
  providerId: string;
  schedule: DayAvailability[];
}

// Booking types
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface Booking {
  id: string;
  date: Date;
  cost: number;
  customerId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

export interface BookingRequest {
  providerId: string;
  serviceId: string;
  date: string; // Format: "YYYY-MM-DD"
  startTime: string; // Format: "HH:MM"
  endTime: string; // Format: "HH:MM"
}

// API response types
export interface ProviderSearchResult {
  id: string;
  provider_name: string;
  business_name: string;
  bio: string;
  provider_address: string;
  is_active: boolean;
  services: Service[];
}

export interface DayBookingStatus {
  date: string;
  status:
    | "available"
    | "partially_booked"
    | "mostly_booked"
    | "fully_booked"
    | "unavailable";
  available_percentage: number;
}

export interface AvailableSlotsResponse {
  available_slots: TimeSlot[];
}

// Booking with details (for display purposes)
export interface BookingWithDetails {
  booking_id: string;
  date: string;
  start_time: string;
  end_time: string;
  cost: number;
  status: BookingStatus;
  service_name: string;
  provider_name?: string;
  customer_name?: string;
  customer_phone?: string;
}

// Registration types
export interface RegisterCustomerRequest {
  userData: UserCreate;
  customerData: CustomerCreate;
}

export interface RegisterProviderRequest {
  userData: UserCreate;
  providerData: ProviderCreate;
}

// API response wrappers
export interface MessageResponse {
  message: string;
  user_id?: string;
  booking_id?: string;
}

// Auth state for context
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<TokenResponse>;
  logout: () => Promise<void>;
  registerCustomer: (
    userData: UserCreate,
    customerData: CustomerCreate,
  ) => Promise<MessageResponse>;
  registerProvider: (
    userData: UserCreate,
    providerData: ProviderCreate,
  ) => Promise<MessageResponse>;
}

// Availability response with warnings
export interface AvailabilityWarning {
  day: string;
  slot: string;
  session_duration: number;
  remainder_minutes: number;
  unused_time_range: string;
  sessions_created: number;
  message: string;
  suggestions: string[];
}

export interface AvailabilityResponse {
  message: string;
  warnings?: AvailabilityWarning[];
  summary?: {
    total_slots_created: number;
    total_remainder_minutes: number;
  };
}

// Reschedule request type
export interface RescheduleRequest {
  date: string; // Format: "YYYY-MM-DD"
  start_time: string; // Format: "HH:MM"
  end_time: string; // Format: "HH:MM"
}

// Confirmed booking with full details
export interface ConfirmedBooking {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  service_id: string;
  service_name: string;
  service_duration: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  notes?: string;
  created_at: string;
}

export interface BookedSlot {
  start_time: string;
  end_time: string;
  booking_id: string;
}

export interface RescheduleSlotsResponse {
  date: string; // Format: "YYYY-MM-DD"
  day_of_week: string; // e.g., "Monday"
  available_slots: TimeSlot[];
  booked_slots: BookedSlot[];
  message?: string; // Optional error/info message
}

export interface DateScheduleData {
  date: string;
  dayOfWeek: string;
  displayDate: string; // Formatted for display (e.g., "Mon, Jan 15")
  isToday: boolean;
  isTomorrow: boolean;
  availableSlots: TimeSlot[];
  bookedSlots: BookedSlot[];
  hasAvailability: boolean;
  totalSlots: number;
  availableCount: number;
}

export interface DateRangeParams {
  bookingId: string;
  startDate: string; // Format: "YYYY-MM-DD"
  endDate: string; // Format: "YYYY-MM-DD"
}

export interface DateRangeResponse {
  dates: DateScheduleData[];
  hasMore: boolean;
  nextStartDate?: string;
}

// Legacy type - keeping for backward compatibility but prefer RescheduleSlotsResponse
export interface AvailableSlot {
  start_time: string;
  end_time: string;
  available: boolean;
}

// Customer Snapshot types
export interface CustomerTag {
  id: string;
  tag: string;
  color: string;
}

export interface CustomerNote {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerSnapshot {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_visits: number;
  last_service_date: string | null;
  last_service_name: string | null;
  payment_preference: string;
  total_spent: number;
  tags: CustomerTag[];
  notes: CustomerNote[];
}
