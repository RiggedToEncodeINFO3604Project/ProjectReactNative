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
const candidates = process.platform === "win32"
  ? [
      path.join(workspaceRoot, "venv", "Scripts", "python.exe"),
      "py",
      "python",
    ]
  : [
      path.join(workspaceRoot, "venv", "bin", "python"),
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
