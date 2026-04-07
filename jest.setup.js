// Silence all console output during tests to keep results clean.
// Individual tests can spy on console.error / console.warn as needed.
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Stub alert() – React Native's global alert is not available in node env
global.alert = jest.fn();
