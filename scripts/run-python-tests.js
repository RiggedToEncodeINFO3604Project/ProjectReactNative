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
const workspaceVenv = path.join(repoRoot, appPath, "venv");
const legacyApiVenv = path.join(repoRoot, "apps", "api", "venv");
const candidates = process.platform === "win32"
  ? [
      path.join(workspaceVenv, "Scripts", "python.exe"),
      path.join(legacyApiVenv, "Scripts", "python.exe"),
      "py",
      "python",
    ]
  : [
      path.join(workspaceVenv, "bin", "python"),
      path.join(legacyApiVenv, "bin", "python"),
      "python3",
      "python",
    ];

let result = null;

function isUsablePython(candidate) {
  const versionArgs = candidate === "py" ? ["-3", "--version"] : ["--version"];
  const probe = spawnSync(candidate, versionArgs, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });

  return !probe.error && probe.status === 0;
}

for (const candidate of candidates) {
  if (!isUsablePython(candidate)) {
    continue;
  }

  const args =
    candidate === "py"
      ? ["-3", "-m", "unittest", "discover", "-s", testsDir, "-p", "test_*.py"]
      : ["-m", "unittest", "discover", "-s", testsDir, "-p", "test_*.py"];

  result = spawnSync(candidate, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      PYTHONPATH: [workspaceRoot, process.env.PYTHONPATH]
        .filter(Boolean)
        .join(path.delimiter),
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
