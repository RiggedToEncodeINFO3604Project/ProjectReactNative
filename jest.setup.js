// jest.setup.js
const { Platform } = require("react-native");
Platform.OS = Platform.OS ?? "ios";

globalThis.__ExpoImportMetaRegistry = undefined;
Object.defineProperty(globalThis, "__ExpoImportMetaRegistry", {
  get: () => undefined,
  set: () => {},
  configurable: true,
});
