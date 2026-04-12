const { spawnSync } = require("child_process");
const path = require("path");

const appPath = process.argv[2];

if (!appPath) {
  console.error("Usage: node scripts/run-python-tests.js <app-path>");
  process.exit(1);
}

const repoRoot = process.cwd();
const workspaceRoot = path.join(repoRoot, appPath);
const testsDir = path.join(workspaceRoot, "tests");
const sharedApiVenv = path.join(repoRoot, "apps", "api", "venv");
const isRagService = appPath === "apps/rag-service";
const sharedVenvPath = (() => {
  if (["apps/scheduling-service", "apps/messaging-service", "apps/snapshot-service"].includes(appPath)) {
    return sharedApiVenv;
  }

  if (isRagService) {
    return sharedApiVenv;
  }

  return null;
})();
const candidates = process.platform === "win32"
  ? [
      ...(isRagService ? [] : [path.join(workspaceRoot, "venv", "Scripts", "python.exe")]),
      ...(sharedVenvPath ? [path.join(sharedVenvPath, "Scripts", "python.exe")] : []),
      "py",
      "python",
    ]
  : [
      ...(isRagService ? [] : [path.join(workspaceRoot, "venv", "bin", "python")]),
      ...(sharedVenvPath ? [path.join(sharedVenvPath, "bin", "python")] : []),
      "python3",
      "python",
    ];

let result = null;

for (const candidate of candidates) {
  const args =
    candidate === "py"
      ? ["-m", "unittest", "discover", "-s", testsDir, "-p", "test_*.py"]
      : ["-m", "unittest", "discover", "-s", testsDir, "-p", "test_*.py"];

  result = spawnSync(candidate, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...(isRagService
        ? {
            PYTHONPATH: [
              workspaceRoot,
              path.join(workspaceRoot, "venv", "Lib", "site-packages"),
              process.env.PYTHONPATH,
            ]
              .filter(Boolean)
              .join(path.delimiter),
          }
        : {}),
    },
    stdio: "inherit",
    shell: false,
  });

  if (!result.error) {
    process.exit(result.status ?? 0);
  }
}

console.error(`Could not run Python tests for ${appPath}.`);
if (result?.error) {
  console.error(result.error.message);
}
process.exit(1);
