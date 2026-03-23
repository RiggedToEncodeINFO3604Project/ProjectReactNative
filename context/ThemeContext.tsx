import {
  CustomerColors,
  getThemeColors,
  ProviderColors,
  UserType,
} from "@/constants/theme";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

type ThemeContextType = {
  isDarkMode: boolean;
  userType: UserType;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  setUserType: (type: UserType) => void;
  // Current colors based on isDarkMode and userType
  colors: ReturnType<typeof getThemeColors>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialUserType?: UserType;
}

export function ThemeProvider({
  children,
  initialUserType = "customer",
}: ThemeProviderProps) {
  const systemColorScheme = useRNColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
  const [userType, setUserType] = useState<UserType>(initialUserType);

  useEffect(() => {
    setIsDarkMode(systemColorScheme === "dark");
  }, [systemColorScheme]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const setDarkMode = (value: boolean) => {
    setIsDarkMode(value);
  };

  const setUserTypeHandler = (type: UserType) => {
    setUserType(type);
  };

  // Get the current colors based on isDarkMode and userType
  const colors = getThemeColors(userType, isDarkMode);

  // Memoize the context value to ensure proper theme change propagation
  const contextValue = useMemo(
    () => ({
      isDarkMode,
      userType,
      toggleDarkMode,
      setDarkMode,
      setUserType: setUserTypeHandler,
      colors,
    }),
    [isDarkMode, userType, colors],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Export function to get appropriate colors based on user type and dark mode
export { CustomerColors, getThemeColors, ProviderColors };

