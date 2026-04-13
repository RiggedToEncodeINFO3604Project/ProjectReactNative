import {
  login as apiLogin,
  logout as apiLogout,
  registerCustomer as apiRegisterCustomer,
  registerProvider as apiRegisterProvider,
  restoreAuthSession,
} from "@/services/schedulingApi";
import {
  clearDevicePushToken,
  clearScheduledBookingReminders,
} from "@/services/notifications";
import {
  AuthContextType,
  AuthState,
  CustomerCreate,
  MessageResponse,
  ProviderCreate,
  TokenResponse,
  UserCreate,
} from "@/types/scheduling";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  role: null,
  isLoading: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await restoreAuthSession();

        if (session) {
          setState({
            isAuthenticated: true,
            user: {
              id: session.user_id,
              email: "",
              role: session.role,
              createdAt: new Date(),
            },
            token: session.access_token,
            role: session.role,
            isLoading: false,
          });
        } else {
          setState({ ...initialState, isLoading: false });
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        setState({ ...initialState, isLoading: false });
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<TokenResponse> => {
      const response = await apiLogin(email, password);

      console.log("Login response role:", response.role);
      console.log("Role type:", typeof response.role);

      setState({
        isAuthenticated: true,
        user: {
          id: response.user_id,
          email,
          role: response.role,
          createdAt: new Date(),
        },
        token: response.access_token,
        role: response.role,
        isLoading: false,
      });

      return response;
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await clearDevicePushToken();
    } catch (error) {
      console.error("Error clearing push token:", error);
    }

    try {
      await clearScheduledBookingReminders();
    } catch (error) {
      console.error("Error clearing scheduled booking reminders:", error);
    }

    await apiLogout();
    setState({
      isAuthenticated: false,
      user: null,
      token: null,
      role: null,
      isLoading: false,
    });
  }, []);

  const registerCustomer = useCallback(
    async (
      userData: UserCreate,
      customerData: CustomerCreate,
    ): Promise<MessageResponse> => {
      return await apiRegisterCustomer(userData, customerData);
    },
    [],
  );

  const registerProvider = useCallback(
    async (
      userData: UserCreate,
      providerData: ProviderCreate,
    ): Promise<MessageResponse> => {
      return await apiRegisterProvider(userData, providerData);
    },
    [],
  );

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    registerCustomer,
    registerProvider,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
