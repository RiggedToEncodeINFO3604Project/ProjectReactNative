const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
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

  walk(name, process.cwd());
}

if (!fs.existsSync("package.json")) {
  fail("package.json was not found in the project root.");
}

[
  "expo",
  "@expo/cli",
  "expo-asset",
  "expo-router",
  "http-errors",
  "react-fast-compare",
  "invariant",
  "shallowequal",
  "statuses",
  "toidentifier",
  "abort-controller",
  "event-target-shim",
].forEach(ensureInstalled);

ensurePackageDependenciesInstalled("expo-router");
ensurePackageDependenciesInstalled("abort-controller");

console.log("Frontend dependency validation passed.");
