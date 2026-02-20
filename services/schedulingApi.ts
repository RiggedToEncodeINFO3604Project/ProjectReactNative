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
  ConfirmedBooking,
  CustomerCreate,
  CustomerSnapshot,
  DateScheduleData,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError, AxiosInstance } from "axios";

// API URL - change this for production
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

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
): Promise<AvailableSlotsResponse> => {
  const response = await api.get<AvailableSlotsResponse>(
    `/customer/providers/${providerId}/availability/${date}`,
  );
  return response.data;
};

// Get calendar booking status for a provider for a month
export const getProviderCalendar = async (
  providerId: string,
  year: number,
  month: number,
): Promise<DayBookingStatus[]> => {
  const response = await api.get<DayBookingStatus[]>(
    `/customer/providers/${providerId}/calendar/${year}/${month}`,
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
    schedule: Array<{
      day_of_week: number;
      time_slots: Array<{
        start_time: string;
        end_time: string;
        session_duration?: number;
      }>;
    }>;
  }>("/provider/availability");

  return {
    providerId: response.data.provider_id,
    schedule: response.data.schedule.map((day) => ({
      day_of_week: day.day_of_week,
      time_slots: day.time_slots.map((slot) => ({
        start_time: slot.start_time,
        end_time: slot.end_time,
        session_duration: slot.session_duration ?? 30, // Default to 30 if not provided
      })),
    })),
  };
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
  return date.toISOString().split("T")[0];
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
  const dateObj = new Date(response.date + "T00:00:00");
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
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

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
  const dates = generateDateRange(startDate, endDate);
  const today = new Date();

  const responses = await Promise.all(
    dates.map((date) => getAvailableSlotsForReschedule(bookingId, date)),
  );

  return responses.map((response) => transformToScheduleData(response, today));
};

// =====================
// Customer Snapshot APIs (Provider-Only)
// =====================

// Get customer snapshot for a specific customer
export const getCustomerSnapshot = async (
  customerId: string,
): Promise<CustomerSnapshot> => {
  const response = await api.get<CustomerSnapshot>(
    `/provider/customer/${customerId}/snapshot`,
  );
  return response.data;
};

// Export the axios instance for custom requests
export default api;
