module.exports = {
  preset: "react-native",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.[tj]sx?$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(" +
      "(jest-)?react-native|" +
      "@react-native(-community)?|" +
      "expo(nent)?|" +
      "@expo(nent)?/.*|" +
      "expo-calendar|" +
      "expo-constants|" +
      "expo-router|" +
      "react-native-calendars|" +
      "react-native-swipe-gestures|" +
      "@expo/vector-icons|" +
      "react-navigation|" +
      "@react-navigation/.*" +
      "))",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  setupFiles: [
    "<rootDir>/jest.setup.js",
    "<rootDir>/node_modules/react-native/jest/setup.js",
  ],
};
