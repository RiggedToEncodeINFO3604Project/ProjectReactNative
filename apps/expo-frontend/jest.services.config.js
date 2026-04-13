/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",
  setupFiles: ["./jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.ts$": [
      "babel-jest",
      {
        configFile: require.resolve("./babel.jest.services.config.js"),
      },
    ],
  },
  testMatch: ["**/__tests__/services/**/*.test.ts"],
};
