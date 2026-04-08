// =======================================================
// = API Service for the Scheduling Service.             =
// = Handles all HTTP requests to the FastAPI backend.   =
// =======================================================

import {
  AvailabilityResponse,
  AvailabilitySchedule,
  AvailableSlotsResponse,
  BookingRequest,
  BookingWithDetails,
  BusyTime,
  ConfirmedBooking,
  CustomerCreate,
  CustomerSnapshot,
  DateScheduleData,
  DateRangeResponse,
  DayBookingStatus,
  MessageResponse,
  ProviderCreate,
  ProviderSearchResult,
  RescheduleRequest,
  RescheduleSlotsResponse,
  Service,
  ServiceCreate,
  TokenResponse,
  UserCreate,
} from "@/types/scheduling";
import { formatLocalDate, parseLocalDate } from "@/utils/time";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError, AxiosInstance } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

const normalizeApiUrl = (value?: string | null): string => {
  return (value || "").trim().replace(/\/+$/, "");
};

const extractPort = (value: string): string => {
  const match = value.match(/:(\d+)(?:\/|$)/);
  return match?.[1] || "8000";
};

const isPrivateOrLocalHost = (hostname: string): boolean => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
};

const extractExpoHost = (): string | null => {
  const expoConfigHost = (Constants.expoConfig as { hostUri?: string } | null)
    ?.hostUri;
  if (expoConfigHost) {
    return expoConfigHost;
  }

  const manifest2Host = (
    Constants as typeof Constants & {
      manifest2?: {
        extra?: {
          expoGo?: {
            debuggerHost?: string;
          };
        };
      };
    }
  ).manifest2?.extra?.expoGo?.debuggerHost;

  return manifest2Host || null;
};

const resolveApiUrl = (): string => {
  const configuredUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
  const isLocalhostConfig =
    !configuredUrl ||
    configuredUrl.includes("localhost") ||
    configuredUrl.includes("127.0.0.1");

  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (isLocalhostConfig && configuredUrl) {
      const configuredPort = extractPort(configuredUrl);
      const currentHostname = window.location.hostname;
      if (isPrivateOrLocalHost(currentHostname)) {
        return `${window.location.protocol}//${currentHostname}:${configuredPort}`;
      }
      return window.location.origin;
    }
    return configuredUrl || window.location.origin;
  }

  if (!isLocalhostConfig) {
    return configuredUrl;
  }

  if (Platform.OS === "android" && configuredUrl.includes("10.0.2.2")) {
    return configuredUrl;
  }

  const expoHost = extractExpoHost();
  const expoHostname = expoHost?.split(":")[0];

  if (expoHostname) {
    const protocol = configuredUrl.startsWith("https://") ? "https" : "http";
    const configuredPort = extractPort(configuredUrl);
    const resolvedUrl = `${protocol}://${expoHostname}:${configuredPort}`;
    console.log(
      `[API] Resolved Expo device API URL from "${configuredUrl || "(empty)"}" to "${resolvedUrl}"`,
    );
    return resolvedUrl;
  }

  return configuredUrl;
};

const API_URL = resolveApiUrl();

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      await AsyncStorage.multiRemove(["token", "role", "userId"]);
    }
    return Promise.reject(error);
  },
);

// =====================
// Authentication APIs
// =====================

// Register a new customer
export const registerCustomer = async (
  userData: UserCreate,
  customerData: CustomerCreate,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>("/auth/register/customer", {
    email: userData.email,
    password: userData.password,
    role: userData.role,
    name: customerData.name,
    phone: customerData.phone,
    user_id: customerData.userId || "",
  });
  return response.data;
};

// Register a new provider
export const registerProvider = async (
  userData: UserCreate,
  providerData: ProviderCreate,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>("/auth/register/provider", {
    email: userData.email,
    password: userData.password,
    role: userData.role,
    provider_name: providerData.providerName,
    business_name: providerData.businessName,
    bio: providerData.bio,
    provider_address: providerData.providerAddress,
    is_active: providerData.isActive ?? true,
    user_id: providerData.userId || "",
  });
  return response.data;
};

// Login with email and password
export const login = async (
  email: string,
  password: string,
): Promise<TokenResponse> => {
  const formData = new FormData();
  formData.append("username", email);
  formData.append("password", password);

  const response = await axios.post<TokenResponse>(
    `${API_URL}/auth/login`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (response.data.access_token) {
    await AsyncStorage.setItem("token", response.data.access_token);
    await AsyncStorage.setItem("role", response.data.role);
    await AsyncStorage.setItem("userId", response.data.user_id);
  }

  return response.data;
};

// Logout and clear stored credentials
export const logout = async (): Promise<void> => {
  await AsyncStorage.multiRemove(["token", "role", "userId"]);
};

export const registerPushToken = async (pushToken: string): Promise<void> => {
  await api.post("/auth/push-token", { push_token: pushToken });
};

export const unregisterPushToken = async (pushToken: string): Promise<void> => {
  await api.post("/auth/push-token/remove", { push_token: pushToken });
};

// Get stored auth data
export const getStoredAuth = async (): Promise<{
  token: string | null;
  role: string | null;
  userId: string | null;
}> => {
  const [token, role, userId] = await AsyncStorage.multiGet([
    "token",
    "role",
    "userId",
  ]);
  return {
    token: token[1],
    role: role[1],
    userId: userId[1],
  };
};

// =====================
// Customer APIs
// =====================

// Search for providers by name or ID
export const searchProviders = async (
  name?: string | null,
  providerId?: string | null,
): Promise<ProviderSearchResult[]> => {
  const params: Record<string, string> = {};
  if (name) params.name = name;
  if (providerId) params.provider_id = providerId;

  const response = await api.get<ProviderSearchResult[]>(
    "/customer/providers/search",
    {
      params,
    },
  );

  return response.data;
};

// Get available time slots for a provider on a specific date
export const getProviderAvailability = async (
  providerId: string,
  date: string,
  serviceId?: string | null,
): Promise<AvailableSlotsResponse> => {
  const response = await api.get<AvailableSlotsResponse>(
    `/customer/providers/${providerId}/availability/${date}`,
    {
      params: serviceId ? { service_id: serviceId } : undefined,
    },
  );
  return response.data;
};

// Get calendar booking status for a provider for a month
export const getProviderCalendar = async (
  providerId: string,
  year: number,
  month: number,
  serviceId?: string | null,
): Promise<DayBookingStatus[]> => {
  const response = await api.get<DayBookingStatus[]>(
    `/customer/providers/${providerId}/calendar/${year}/${month}`,
    {
      params: serviceId ? { service_id: serviceId } : undefined,
    },
  );
  return response.data;
};

// Create a new booking request
export const createBooking = async (
  bookingData: BookingRequest,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>("/customer/bookings", {
    provider_id: bookingData.providerId,
    service_id: bookingData.serviceId,
    date: bookingData.date,
    start_time: bookingData.startTime,
    end_time: bookingData.endTime,
  });
  return response.data;
};

// Get all bookings for the current customer
export const getMyBookings = async (): Promise<BookingWithDetails[]> => {
  const response = await api.get<BookingWithDetails[]>("/customer/bookings");
  return response.data;
};

// Cancel a booking
export const cancelBooking = async (
  bookingId: string,
): Promise<MessageResponse> => {
  const response = await api.delete<MessageResponse>(
    `/customer/bookings/${bookingId}`,
  );
  return response.data;
};

// =====================
// Provider APIs
// =====================

// Add a new service
export const addService = async (
  serviceData: ServiceCreate,
): Promise<Service> => {
  const response = await api.post<Service>("/provider/services", {
    name: serviceData.name,
    description: serviceData.description,
    price: serviceData.price,
    provider_id: serviceData.providerId || "",
  });
  return response.data;
};

// Get all services for the current provider
export const getMyServices = async (): Promise<Service[]> => {
  const response = await api.get<Service[]>("/provider/services");
  return response.data;
};

// Set availability schedule

export const setAvailability = async (
  availabilityData: AvailabilitySchedule,
): Promise<AvailabilityResponse> => {
  const response = await api.post<AvailabilityResponse>(
    "/provider/availability",
    {
      provider_id: availabilityData.providerId,
      schedule: availabilityData.schedule,
    },
  );
  return response.data;
};

// Get availability schedule
export const getAvailability = async (): Promise<AvailabilitySchedule> => {
  const response = await api.get<{
    provider_id: string;
    schedule: {
      day_of_week: number;
      time_slots: {
        start_time: string;
        end_time: string;
        session_duration?: number;
        recurrence_type?: string;
        start_date?: string | null;
        end_date?: string | null;
        service_ids?: string[];
      }[];
    }[];
  }>("/provider/availability");

  return {
    providerId: response.data.provider_id,
    schedule: response.data.schedule.map((day) => ({
      day_of_week: day.day_of_week,
      time_slots: day.time_slots.map((slot) => ({
        start_time: slot.start_time,
        end_time: slot.end_time,
        session_duration: slot.session_duration ?? 30, // Default to 30 if not provided
        recurrence_type:
          slot.recurrence_type === "just_this_week"
            ? "just_today"
            : (slot.recurrence_type ?? "repeat_weekly"),
        start_date: slot.start_date ?? null,
        end_date: slot.end_date ?? null,
        service_ids: slot.service_ids ?? [],
      })),
    })),
  };
};

// Sync busy times for the current provider
export const syncBusyTimes = async (
  busyTimes: BusyTime[],
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>(
    "/provider/calendar/busy-times",
    busyTimes,
  );
  return response.data;
};

// Get pending bookings for the current provider
export const getPendingBookings = async (): Promise<BookingWithDetails[]> => {
  const response = await api.get<BookingWithDetails[]>(
    "/provider/bookings/pending",
  );
  return response.data;
};

// Accept a booking request
export const acceptBooking = async (
  bookingId: string,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>(
    `/provider/bookings/${bookingId}/accept`,
  );
  return response.data;
};

// Reject a booking request
export const rejectBooking = async (
  bookingId: string,
): Promise<MessageResponse> => {
  const response = await api.post<MessageResponse>(
    `/provider/bookings/${bookingId}/reject`,
  );
  return response.data;
};

// Get confirmed bookings for the current provider
export const getConfirmedBookings = async (): Promise<BookingWithDetails[]> => {
  const response = await api.get<BookingWithDetails[]>(
    "/provider/bookings/confirmed",
  );
  return response.data;
};

// Delete a booking
export const deleteBooking = async (
  bookingId: string,
): Promise<MessageResponse> => {
  const response = await api.delete<MessageResponse>(
    `/provider/bookings/${bookingId}`,
  );
  return response.data;
};

// Reschedule a booking
export const rescheduleBooking = async (
  bookingId: string,
  data: RescheduleRequest,
): Promise<ConfirmedBooking> => {
  const response = await api.put<ConfirmedBooking>(
    `/provider/bookings/${bookingId}/reschedule`,
    {
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
    },
  );
  return response.data;
};

// Get available slots for rescheduling a booking
export const getAvailableSlotsForReschedule = async (
  bookingId: string,
  date: string,
): Promise<RescheduleSlotsResponse> => {
  const response = await api.get<RescheduleSlotsResponse>(
    `/provider/bookings/${bookingId}/available-slots`,
    {
      params: { date },
    },
  );
  return response.data;
};

// ============================================================
// DATE UTILITY FUNCTIONS
// ============================================================

// Formatting
export const formatDate = (date: Date): string => {
  return formatLocalDate(date);
};

// Add days to a date and return a new Date
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Format a date for display (e.g., "Mon, Jan 15")
export const formatDisplayDate = (date: Date): string => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = date.getDate();

  return `${dayName}, ${monthName} ${dayNum}`;
};

// Transform API response to UI-ready format
export const transformToScheduleData = (
  response: RescheduleSlotsResponse,
  today: Date = new Date(),
): DateScheduleData => {
  const dateObj = parseLocalDate(response.date);
  const todayStr = formatDate(today);
  const tomorrowStr = formatDate(addDays(today, 1));

  // Defensive: Handle missing properties with defaults
  const availableSlots = response.available_slots || [];
  const bookedSlots = response.booked_slots || [];

  return {
    date: response.date,
    dayOfWeek: response.day_of_week,
    displayDate: formatDisplayDate(dateObj),
    isToday: response.date === todayStr,
    isTomorrow: response.date === tomorrowStr,
    availableSlots: availableSlots,
    bookedSlots: bookedSlots,
    hasAvailability: availableSlots.length > 0,
    totalSlots: availableSlots.length + bookedSlots.length,
    availableCount: availableSlots.length,
  };
};

// Generate an array of date strings between start and end dates (inclusive)
export const generateDateRange = (
  startDate: string,
  endDate: string,
): string[] => {
  const dates: string[] = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  while (start <= end) {
    dates.push(formatDate(start));
    start.setDate(start.getDate() + 1);
  }

  return dates;
};

// Get available slots for a date range
export const getAvailableSlotsForDateRange = async (
  bookingId: string,
  startDate: string,
  endDate: string,
): Promise<DateScheduleData[]> => {
  const today = new Date();
  const response = await api.get<DateRangeResponse>(
    `/provider/bookings/${bookingId}/available-slots-range`,
    {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    },
  );

  return response.data.dates.map((date) => transformToScheduleData(date, today));
};

// Get customer snapshot for a specific customer
export const getCustomerSnapshot = async (
  customerId: string,
): Promise<CustomerSnapshot> => {
  // adding console log to confirm request being made, page still unmounting early
  const url = `/provider/customer/${customerId}/snapshot`;
  console.log(
    "[DEBUG schedulingApi] getCustomerSnapshot called with customerId:",
    customerId,
  );
  console.log("[DEBUG schedulingApi] customerId type:", typeof customerId);
  console.log("[DEBUG schedulingApi] Full URL:", API_URL + url);

  try {
    const response = await api.get<CustomerSnapshot>(url);
    console.log("[DEBUG schedulingApi] Raw response:", response);
    console.log("[DEBUG schedulingApi] Response data:", response.data);
    console.log(
      "[DEBUG schedulingApi] Response data keys:",
      Object.keys(response.data),
    );
    console.log(
      "[DEBUG schedulingApi] customer_name in response:",
      response.data.customer_name,
    );
    return response.data;
  } catch (error) {
    console.error("[DEBUG schedulingApi] Error fetching snapshot:", error);
    throw error;
  }
};

// Auto-tagging API endpoints
export interface TaggingConfig {
  frequency_thresholds?: { returning: number; regular: number; loyal: number };
  spending_thresholds?: {
    regular_spender: number;
    high_value: number;
    premium: number;
  };
  recency_thresholds?: { active_days: number; at_risk_days: number };
  tag_colors?: Record<string, string>;
  tag_priority?: "auto_first" | "manual_first" | "merge";
  tag_weighting_enabled?: boolean;
  category_weights?: {
    frequency?: number;
    recency?: number;
    spending?: number;
  };
  enable_phases?: {
    phase1: boolean;
    phase2: boolean;
    phase3: boolean;
    phase4: boolean;
  };
  enabled?: boolean;
}

export const getTaggingRules = async (): Promise<TaggingConfig> => {
  const url = `/provider/tags/rules`;
  const response = await api.get<TaggingConfig>(url);
  return response.data;
};

export const updateTaggingRules = async (
  rules: Partial<TaggingConfig>,
): Promise<any> => {
  const url = `/provider/tags/rules`;
  const response = await api.put<any>(url, rules);
  return response.data;
};

export const refreshCustomerAutoTags = async (
  customerId: string,
): Promise<any[]> => {
  const url = `/provider/customer/${customerId}/tags/auto-refresh`;
  const response = await api.post<any[]>(url);
  return response.data;
};

// Tag management
export interface CustomerTag {
  id: string;
  tag: string;
  color: string;
  weight?: number;
}

export const createCustomerTag = async (
  customerId: string,
  tagData: { tag: string; color: string },
): Promise<CustomerTag> => {
  const url = `/provider/customer/${customerId}/tags`;
  const response = await api.post<CustomerTag>(url, tagData);
  return response.data;
};

export const updateCustomerTag = async (
  tagId: string,
  tagData: Partial<{ tag: string; color: string }>,
): Promise<any> => {
  const url = `/provider/tags/${tagId}`;
  const response = await api.put<any>(url, tagData);
  return response.data;
};

export const deleteCustomerTag = async (tagId: string): Promise<any> => {
  const url = `/provider/tags/${tagId}`;
  const response = await api.delete<any>(url);
  return response.data;
};

// Notes management
export interface CustomerNote {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export const createCustomerNote = async (
  customerId: string,
  noteData: { note: string },
): Promise<CustomerNote> => {
  const url = `/provider/customer/${customerId}/notes`;
  const response = await api.post<CustomerNote>(url, noteData);
  return response.data;
};

export const updateCustomerNote = async (
  noteId: string,
  noteData: { note: string },
): Promise<any> => {
  const url = `/provider/notes/${noteId}`;
  const response = await api.put<any>(url, noteData);
  return response.data;
};

export const deleteCustomerNote = async (noteId: string): Promise<any> => {
  const url = `/provider/notes/${noteId}`;
  const response = await api.delete<any>(url);
  return response.data;
};

// Export the axios instance for custom requests
export default api;
