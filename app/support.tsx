import Chatbot from "@/components/Chatbot";
import { useTheme } from "@/context/ThemeContext";
import { StatusBar } from "react-native";

export default function ModalScreen() {
  const { isDarkMode } = useTheme();

  return (
    <>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <Chatbot />
    </>
  );
}
