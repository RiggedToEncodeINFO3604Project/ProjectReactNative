const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_ROOT = path.join(REPO_ROOT, "apps", "expo-frontend");

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`Warning: ${message}`);
}

function packagePath(name) {
  return path.join("node_modules", ...name.split("/"));
}

function resolvePackageRoot(name, fromDir) {
  let resolvedEntryPath;
  try {
    resolvedEntryPath = require.resolve(name, { paths: [fromDir] });
  } catch (entryError) {
    try {
      resolvedEntryPath = require.resolve(`${name}/package.json`, {
        paths: [fromDir],
      });
    } catch (packageError) {
      fail(`${name} is not resolvable from ${fromDir}.`);
    }
  }

  let currentDir = path.dirname(resolvedEntryPath);
  while (true) {
    const pkgJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      return { packageDir: currentDir, pkgJsonPath };
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      fail(`Could not find package.json for ${name}.`);
    }
    currentDir = parentDir;
  }
}

function ensureInstalled(name) {
  if (!fs.existsSync(packagePath(name))) {
    fail(`${name} is missing from node_modules.`);
  }
}

function readPackageJson(name) {
  const pkgPath = path.join(packagePath(name), "package.json");
  if (!fs.existsSync(pkgPath)) {
    fail(`${name} package.json was not found.`);
  }
  return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
}

function parseEnvFile(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) {
    return env;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function isPlaceholderValue(value) {
  if (!value) {
    return true;
  }

  return /your-|example|placeholder|changeme/i.test(value);
}

function validateFirebaseEnvironment() {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    warn(".env was not found. Skipping Firebase environment validation.");
    return;
  }

  const env = parseEnvFile(envPath);
  const requiredFirebaseKeys = [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
  ];

  for (const key of requiredFirebaseKeys) {
    const value = env[key];
    if (isPlaceholderValue(value)) {
      fail(
        `${key} is missing or still set to a placeholder in .env. Copy the full Firebase Web config from Firebase Console > Project settings > Your apps.`,
      );
    }
  }

  const firebaseApiKey = env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const geminiApiKey =
    env.EXPO_PUBLIC_GEMINI_API_KEY || env.GEMINI_API_KEY || "";

  if (firebaseApiKey && geminiApiKey && firebaseApiKey === geminiApiKey) {
    warn(
      "EXPO_PUBLIC_FIREBASE_API_KEY matches the Gemini API key. Firebase Authentication should use the Firebase Web API key from your Firebase app config, not your Gemini key.",
    );
  }
}

function ensurePackageDependenciesInstalled(name) {
  const visited = new Set();

  function walk(packageName, fromDir) {
    const { packageDir, pkgJsonPath } = resolvePackageRoot(packageName, fromDir);
    const visitKey = `${packageName}::${packageDir}`;
    if (visited.has(visitKey)) {
      return;
    }
    visited.add(visitKey);

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    for (const dependency of Object.keys(pkg.dependencies || {})) {
      try {
        resolvePackageRoot(dependency, packageDir);
      } catch (error) {
        fail(
          `${packageName} has an unresolved dependency: ${dependency}.`,
        );
      }
      walk(dependency, packageDir);
    }
  }

  walk(name, FRONTEND_ROOT);
}

if (!fs.existsSync(path.join(REPO_ROOT, "package.json"))) {
  fail("package.json was not found in the project root.");
}

if (!fs.existsSync(path.join(FRONTEND_ROOT, "package.json"))) {
  fail("apps/expo-frontend/package.json was not found.");
}

[
  "expo",
  "@expo/cli",
  "expo-asset",
  "expo-router",
  "react-fast-compare",
  "invariant",
  "shallowequal",
  "toidentifier",
  "abort-controller",
  "event-target-shim",
].forEach(ensureInstalled);

ensurePackageDependenciesInstalled("expo-router");
ensurePackageDependenciesInstalled("abort-controller");
validateFirebaseEnvironment();

console.log("Frontend dependency validation passed.");
