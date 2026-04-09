const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : process.cwd();

const expoPackageJsonPath = require.resolve("expo/package.json", {
  paths: [projectRoot],
});
const expoPackageRoot = path.dirname(expoPackageJsonPath);
const sharedNodeModulesDir = path.dirname(expoPackageRoot);
const binDir = path.join(projectRoot, "node_modules", ".bin");
const autoLinkingPackageDir = path.join(
  sharedNodeModulesDir,
  "expo-modules-autolinking",
);
const autoLinkingVersion = "3.0.24";

const run = (command, args) => {
  const resolvedCommand =
    process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(resolvedCommand, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const ensureAutolinkingPackage = () => {
  const exportsPath = path.join(autoLinkingPackageDir, "exports.js");
  if (fs.existsSync(exportsPath)) {
    return;
  }

  const tempRoot = path.join(projectRoot, ".expo-autolinking-tmp");
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(tempRoot, { recursive: true });

  run("npm", [
    "install",
    "--no-package-lock",
    "--ignore-scripts",
    `expo-modules-autolinking@${autoLinkingVersion}`,
    "--prefix",
    tempRoot,
  ]);

  const installedPackageDir = path.join(
    tempRoot,
    "node_modules",
    "expo-modules-autolinking",
  );
  fs.rmSync(autoLinkingPackageDir, { recursive: true, force: true });
  fs.cpSync(installedPackageDir, autoLinkingPackageDir, { recursive: true });

  fs.rmSync(tempRoot, { recursive: true, force: true });
};

const ensureExpoBin = () => {
  fs.mkdirSync(binDir, { recursive: true });

  const nodeBinary = process.execPath.replace(/\\/g, "/");
  const normalizedExpoCliPath = path
    .join(expoPackageRoot, "bin", "cli")
    .replace(/\\/g, "/");

  const shellWrapper = `#!/usr/bin/env sh
"${nodeBinary}" "${normalizedExpoCliPath}" "$@"
`;
  fs.writeFileSync(path.join(binDir, "expo"), shellWrapper, "utf8");
  fs.chmodSync(path.join(binDir, "expo"), 0o755);

  const cmdWrapper = `@"${process.execPath}" "${path.join(expoPackageRoot, "bin", "cli")}" %*\r\n`;
  fs.writeFileSync(path.join(binDir, "expo.cmd"), cmdWrapper, "utf8");
};

const patchReactNativeCliPath = () => {
  const osKtPath = path.join(
    sharedNodeModulesDir,
    "@react-native",
    "gradle-plugin",
    "shared",
    "src",
    "main",
    "kotlin",
    "com",
    "facebook",
    "react",
    "utils",
    "Os.kt",
  );

  if (!fs.existsSync(osKtPath)) {
    return;
  }

  const original = fs.readFileSync(osKtPath, "utf8");
  const target = `  fun File.cliPath(base: File): String =
      if (isWindows()) {
        this.relativeTo(base).path
      } else {
        absolutePath
      }
`;
  const replacement = `  fun File.cliPath(base: File): String {
      val absoluteBase = base.absoluteFile
      val absoluteTarget = absoluteFile
      return if (isWindows()) {
        absoluteTarget.relativeTo(absoluteBase).path
      } else if (absoluteTarget.toPath().startsWith(absoluteBase.toPath())) {
        absoluteTarget.absolutePath
      } else {
        absoluteTarget.relativeTo(absoluteBase).path
      }
  }
`;

  if (!original.includes(target)) {
    return;
  }

  fs.writeFileSync(osKtPath, original.replace(target, replacement), "utf8");
};

ensureAutolinkingPackage();
ensureExpoBin();
patchReactNativeCliPath();
