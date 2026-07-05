import path from "node:path";
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { readdir } from "node:fs/promises";
import { buildAll } from "./build.mjs";
import { fileURLToPath } from "node:url";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distEntry = path.resolve(artifactDir, "dist/index.mjs");
const watchRoots = [
  path.resolve(artifactDir, "src"),
  path.resolve(artifactDir, "../../lib/api-zod"),
  path.resolve(artifactDir, "../../lib/api-spec"),
  path.resolve(artifactDir, "../../lib/db"),
];

let child = null;
let rebuildInFlight = null;
let rebuildQueued = false;
const watchers = [];

function log(message) {
  console.log("[dev] " + message);
}

function spawnServer() {
  child = spawn(process.execPath, ["--enable-source-maps", distEntry], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      log("server stopped (" + signal + ")");
      return;
    }

    if (code && code !== 0) {
      log("server exited with code " + code);
    }
  });
}

async function stopServer() {
  if (!child) {
    return;
  }

  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
  });

  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  child = null;
}

async function collectDirs(root, output) {
  output.add(root);

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await collectDirs(path.join(root, entry.name), output);
    }
  }
}

async function refreshWatchers() {
  while (watchers.length > 0) {
    watchers.pop().close();
  }

  const dirs = new Set();
  for (const root of watchRoots) {
    await collectDirs(root, dirs);
  }

  for (const dir of dirs) {
    const watcher = watch(dir, { persistent: true }, (_eventType, filename) => {
      if (filename && filename.toString().startsWith(".")) {
        return;
      }

      queueRebuild();
    });
    watchers.push(watcher);
  }

  log("watching " + dirs.size + " directories");
}

function queueRebuild() {
  if (rebuildInFlight) {
    rebuildQueued = true;
    return;
  }

  rebuildInFlight = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await stopServer();
    await buildAll();
    await refreshWatchers();
    spawnServer();
  })()
    .catch((err) => {
      console.error(err);
    })
    .finally(() => {
      rebuildInFlight = null;
      if (rebuildQueued) {
        rebuildQueued = false;
        queueRebuild();
      }
    });
}

process.on("SIGINT", async () => {
  await stopServer();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await stopServer();
  process.exit(0);
});

await buildAll();
await refreshWatchers();
spawnServer();
log("backend dev server ready");
